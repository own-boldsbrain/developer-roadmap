import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { scanForSecrets } from './secret-scanner.js';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const roadmapStr =
  args.find((a) => a.startsWith('--roadmap='))?.split('=')[1] || '';
const limitStr =
  args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '5';
const provider =
  args.find((a) => a.startsWith('--provider='))?.split('=')[1] || 'ollama';
const model =
  args.find((a) => a.startsWith('--model='))?.split('=')[1] || 'qwen3.6:latest';
const selectionSeed =
  args.find((a) => a.startsWith('--selection-seed='))?.split('=')[1] ||
  'default';
const isDryRun = args.includes('--dry-run');
const limit = parseInt(limitStr, 10);

const runId = `opp-extract-${new Date()
  .toISOString()
  .replace(/[:.T-]/g, '')
  .slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
const RUN_DIR = path.join(
  '.translation-control',
  'opportunities',
  'runs',
  runId,
);
const MANIFEST_PATH = path.join(RUN_DIR, 'run-manifest.json');
const EVENTS_PATH = path.join(RUN_DIR, 'events.jsonl');
const FINDINGS_PATH = path.join(RUN_DIR, 'findings.jsonl');
const REJECTED_PATH = path.join(RUN_DIR, 'rejected.jsonl');
const METRICS_PATH = path.join(RUN_DIR, 'metrics.json');
const FILES_DIR = path.join(RUN_DIR, 'files');

if (!fs.existsSync(RUN_DIR)) fs.mkdirSync(RUN_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

// Ensure rejected.jsonl is created even if empty
fs.writeFileSync(REJECTED_PATH, '');

function appendLog(file: string, obj: any) {
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

function logEvent(
  event: string,
  fileId: string,
  level: string,
  extras: any = {},
) {
  appendLog(EVENTS_PATH, {
    timestamp: new Date().toISOString(),
    level,
    event,
    runId,
    fileId,
    provider,
    model,
    ...extras,
  });
}

function hashString(str: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(str).digest('hex');
}

function hashStringTruncated(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 12);
}

const INVENTORY_PATH = path.join('.translation-control', 'inventory.jsonl');
if (!fs.existsSync(INVENTORY_PATH)) {
  console.error('No inventory found.');
  process.exit(1);
}

let eligibleFiles = fs
  .readFileSync(INVENTORY_PATH, 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
if (roadmapStr) {
  eligibleFiles = eligibleFiles.filter((e) => e.roadmap === roadmapStr);
}

// Simple seeded PRNG selection
const seedVal = selectionSeed
  .split('')
  .reduce((acc, char) => acc + char.charCodeAt(0), 0);
const pseudoRandom = (i: number) => {
  const x = Math.sin(seedVal + i) * 10000;
  return x - Math.floor(x);
};
eligibleFiles.sort(
  (a, b) => pseudoRandom(a.sizeBytes) - pseudoRandom(b.sizeBytes),
);
const selectedFiles = eligibleFiles.slice(0, limit);

const systemPrompt = `You are a Staff Software Architect analyzing technical roadmap documentation for evolution opportunities.
Your task is to identify outdated technologies, missing modern paradigms, structural improvements, or broken content.

You MUST respond with a valid JSON object matching this schema exactly. NO additional properties allowed:
{
  "roadmap": "string",
  "findings": [
    {
      "category": "deprecated-technology | outdated-version | missing-link | conceptual-gap | insecure-practice | duplicate-content | inconsistency | missing-a11y | missing-observability | missing-tests | ia-improvement | automation-opportunity | ai-opportunity",
      "severity": "critical | high | medium | low",
      "title": "string (short description)",
      "evidence": {
        "file": "string (the file path provided)",
        "heading": "string (the exact markdown heading)",
        "excerpt": "string (exact literal short excerpt of the text)"
      },
      "recommendation": "string",
      "confidence": "number (0.0 to 1.0)",
      "timeHorizon": "immediate | 30-days | 60-90-days | strategic"
    }
  ]
}

Only include high-confidence findings. If the content is perfect, return an empty findings array.
Do NOT include markdown formatting (\`\`\`json) in your response, just the raw JSON object.
`;

async function queryModel(content: string, sourcePath: string) {
  let endpoint = 'http://localhost:11434/api/chat';
  if (provider === 'litellm')
    endpoint = 'http://localhost:4002/v1/chat/completions';

  const headers: any = { 'Content-Type': 'application/json' };
  if (provider === 'litellm')
    headers['Authorization'] = `Bearer ${process.env.LITELLM_API_KEY}`;

  const body =
    provider === 'ollama'
      ? {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `File: ${sourcePath}\\n\\nContent:\\n${content}`,
            },
          ],
          format: 'json',
          stream: false,
          options: { temperature: 0.1 },
        }
      : {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `File: ${sourcePath}\\n\\nContent:\\n${content}`,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  return provider === 'ollama'
    ? data.message.content
    : data.choices[0].message.content;
}

// Metrics
let responsesAttempted = 0;
let responsesParsed = 0;
let responsesSchemaPassed = 0;
let findingsReceived = 0;
let findingsSchemaPassed = 0;
let findingsAccepted = 0;
let evidenceChecksAttempted = 0;
let verifiedEvidence = 0;
let unknownFields = 0;
let duplicateFindingIds = 0;
let crossRunContamination = 0;
let secretsDetected = 0;
let totalFindings = 0;

const runFindings = new Set<string>();

async function run() {
  let successCount = 0;
  let partialRejections = 0;
  const startedAt = new Date().getTime();

  for (const entry of selectedFiles) {
    const sourcePath = entry.sourcePath;
    const fileId = entry.fileId;
    console.log(`Analyzing ${sourcePath}...`);

    let content = fs.readFileSync(sourcePath, 'utf-8');

    // Gate G0
    if (scanForSecrets(content, sourcePath)) {
      secretsDetected++;
      logEvent('opportunity.g0_failed', fileId, 'ERROR');
      continue;
    }

    if (isDryRun) {
      console.log(`[DRY-RUN] Would process ${sourcePath}`);
      continue;
    }

    logEvent('opportunity.extraction_started', fileId, 'INFO');

    try {
      responsesAttempted++;
      const rawResponse = await queryModel(content, sourcePath);
      let parsed: any;
      try {
        const jsonStr = rawResponse
          .trim()
          .replace(/^```json/, '')
          .replace(/```$/, '')
          .trim();
        parsed = JSON.parse(jsonStr);
        responsesParsed++;
      } catch (e) {
        logEvent('opportunity.parse_failed', fileId, 'ERROR', {
          raw: rawResponse,
        });
        continue;
      }

      // Check root unknown fields
      const rootKeys = Object.keys(parsed);
      const unknownRootKeys = rootKeys.filter(
        (k) => !['roadmap', 'findings'].includes(k),
      );
      if (unknownRootKeys.length > 0) {
        unknownFields += unknownRootKeys.length;
        appendLog(REJECTED_PATH, {
          fileId,
          error: 'UNKNOWN_FIELDS',
          keys: unknownRootKeys,
        });
        continue;
      }

      // Schema Strict Validation
      const allowedCategories = [
        'deprecated-technology',
        'outdated-version',
        'missing-link',
        'conceptual-gap',
        'insecure-practice',
        'duplicate-content',
        'inconsistency',
        'missing-a11y',
        'missing-observability',
        'missing-tests',
        'ia-improvement',
        'automation-opportunity',
        'ai-opportunity',
      ];
      const allowedSeverities = ['critical', 'high', 'medium', 'low'];
      const allowedHorizons = [
        'immediate',
        '30-days',
        '60-90-days',
        'strategic',
      ];

      if (!parsed.findings || !Array.isArray(parsed.findings)) {
        appendLog(REJECTED_PATH, {
          fileId,
          error: 'Missing findings array',
          raw: parsed,
        });
        continue;
      }

      responsesSchemaPassed++;
      let rejectedAny = false;
      findingsReceived += parsed.findings.length;

      for (const f of parsed.findings) {
        // Check allowed properties in finding
        const keys = Object.keys(f);
        const unknownFindingKeys = keys.filter(
          (k) =>
            ![
              'category',
              'severity',
              'title',
              'evidence',
              'recommendation',
              'confidence',
              'timeHorizon',
            ].includes(k),
        );

        let unknownEvKeys: string[] = [];
        if (f.evidence && typeof f.evidence === 'object') {
          unknownEvKeys = Object.keys(f.evidence).filter(
            (k) => !['file', 'heading', 'excerpt'].includes(k),
          );
        }

        if (unknownFindingKeys.length > 0 || unknownEvKeys.length > 0) {
          unknownFields += unknownFindingKeys.length + unknownEvKeys.length;
          appendLog(REJECTED_PATH, {
            fileId,
            error: 'UNKNOWN_FIELDS',
            keys: [...unknownFindingKeys, ...unknownEvKeys],
          });
          rejectedAny = true;
          continue;
        }

        // Strict validations
        if (
          !allowedCategories.includes(f.category) ||
          !allowedSeverities.includes(f.severity) ||
          !allowedHorizons.includes(f.timeHorizon)
        ) {
          appendLog(REJECTED_PATH, {
            fileId,
            finding: f,
            error: 'Enum validation failed',
          });
          rejectedAny = true;
          continue;
        }

        if (
          typeof f.confidence !== 'number' ||
          f.confidence < 0 ||
          f.confidence > 1
        ) {
          appendLog(REJECTED_PATH, {
            fileId,
            finding: f,
            error: 'Confidence out of bounds',
          });
          rejectedAny = true;
          continue;
        }

        // excerpt inexistente ou heading inexistente (already covered by missing fields above, but we also enforce it has heading here)
        if (
          !f.evidence ||
          f.evidence.file !== sourcePath ||
          !f.evidence.heading
        ) {
          appendLog(REJECTED_PATH, {
            fileId,
            finding: f,
            error: 'Evidence file/heading missing or mismatch',
          });
          rejectedAny = true;
          continue;
        }

        findingsSchemaPassed++;
        evidenceChecksAttempted++;

        // Evidence excerpt literal check
        if (!content.includes(f.evidence.excerpt)) {
          appendLog(REJECTED_PATH, {
            fileId,
            finding: f,
            error: 'Excerpt not literally in file',
          });
          rejectedAny = true;
          continue;
        }
        verifiedEvidence++;

        // Deterministic findingId
        const findingId = `opp-${hashStringTruncated(fileId + f.category + f.evidence.heading)}`;
        f.findingId = findingId;

        if (runFindings.has(findingId)) {
          duplicateFindingIds++;
          appendLog(REJECTED_PATH, {
            fileId,
            finding: f,
            error: 'Duplicate finding ID',
          });
          rejectedAny = true;
          continue;
        }

        runFindings.add(findingId);
        totalFindings++;
        findingsAccepted++;

        appendLog(FINDINGS_PATH, {
          ...f,
          runId,
          fileId,
          findingId,
          schemaVersion: '1.0.0',
          status: 'PROPOSED',
          provider,
          model,
          selectionSeed,
          evidenceVerified: true,
          createdAt: new Date().toISOString(),
        });
      }

      // Isolate output
      const outPath = path.join(
        FILES_DIR,
        `${path.basename(sourcePath)}.opportunities.json`,
      );
      fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2));

      logEvent('opportunity.extraction_completed', fileId, 'INFO', {
        findings: parsed.findings.length,
      });
      if (rejectedAny) partialRejections++;
      successCount++;
    } catch (error: any) {
      logEvent('opportunity.network_failed', fileId, 'ERROR', {
        message: error.message,
      });
    }
  }

  // Cross Run Contamination check
  let contaminationFound = false;
  if (fs.existsSync(FINDINGS_PATH)) {
    const records = fs
      .readFileSync(FINDINGS_PATH, 'utf-8')
      .split('\n')
      .filter(Boolean);
    for (const r of records) {
      const obj = JSON.parse(r);
      if (obj.runId !== runId) {
        contaminationFound = true;
        crossRunContamination++;
      }
    }
  }

  // Validate file creation dates
  if (fs.existsSync(FILES_DIR)) {
    const createdFiles = fs.readdirSync(FILES_DIR);
    for (const file of createdFiles) {
      const stat = fs.statSync(path.join(FILES_DIR, file));
      if (stat.birthtimeMs < startedAt) {
        crossRunContamination++;
      }
    }
  }

  let finalStatus = 'COMPLETED';
  if (successCount === 0 && selectedFiles.length > 0) finalStatus = 'FAILED';
  else if (successCount < selectedFiles.length) finalStatus = 'PARTIAL';
  else if (partialRejections > 0) finalStatus = 'COMPLETED_WITH_REJECTIONS';

  fs.writeFileSync(
    METRICS_PATH,
    JSON.stringify(
      {
        responsesAttempted,
        responsesParsed,
        responsesSchemaPassed,
        findingsReceived,
        findingsSchemaPassed,
        findingsAccepted,
        evidenceChecksAttempted,
        evidenceVerified: verifiedEvidence,
        responseParseRate:
          responsesAttempted > 0
            ? (responsesParsed / responsesAttempted) * 100
            : 0,
        responseSchemaPassRate:
          responsesParsed > 0
            ? (responsesSchemaPassed / responsesParsed) * 100
            : 0,
        findingSchemaPassRate:
          findingsReceived > 0
            ? (findingsSchemaPassed / findingsReceived) * 100
            : 0,
        findingAcceptanceRate:
          findingsSchemaPassed > 0
            ? (findingsAccepted / findingsSchemaPassed) * 100
            : 0,
        evidenceVerifiedRate:
          evidenceChecksAttempted > 0
            ? (verifiedEvidence / evidenceChecksAttempted) * 100
            : 0,
        unknownFields,
        duplicateFindingIds,
        crossRunContamination,
        secretsDetected,
      },
      null,
      2,
    ),
  );

  fs.writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        runId,
        roadmap: roadmapStr,
        limit,
        provider,
        model,
        selectionSeed,
        status: finalStatus,
      },
      null,
      2,
    ),
  );

  console.log(`Run ${runId} completed.`);
}

run();
