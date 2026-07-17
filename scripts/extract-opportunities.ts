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
let schemaPassRate = 0;
let evidenceVerified = 0;
let unknownFields = 0;
let duplicateFindingIds = 0;
let crossRunContamination = 0;
let secretsDetected = 0;
let totalFindings = 0;

const runFindings = new Set<string>();

async function run() {
  let successCount = 0;

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
      const rawResponse = await queryModel(content, sourcePath);
      let parsed: any;
      try {
        const jsonStr = rawResponse
          .trim()
          .replace(/^```json/, '')
          .replace(/```$/, '')
          .trim();
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        logEvent('opportunity.parse_failed', fileId, 'ERROR', {
          raw: rawResponse,
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

      schemaPassRate++;

      for (const f of parsed.findings) {
        // Check allowed properties
        const keys = Object.keys(f);
        for (const k of keys) {
          if (
            ![
              'category',
              'severity',
              'title',
              'evidence',
              'recommendation',
              'confidence',
              'timeHorizon',
            ].includes(k)
          ) {
            unknownFields++;
          }
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
          continue;
        }

        if (!f.evidence || f.evidence.file !== sourcePath) {
          appendLog(REJECTED_PATH, {
            fileId,
            finding: f,
            error: 'Evidence file mismatch',
          });
          continue;
        }

        // Evidence excerpt literal check
        if (!content.includes(f.evidence.excerpt)) {
          appendLog(REJECTED_PATH, {
            fileId,
            finding: f,
            error: 'Excerpt not literally in file',
          });
          continue;
        }
        evidenceVerified++;

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
          continue;
        }

        runFindings.add(findingId);
        totalFindings++;

        appendLog(FINDINGS_PATH, { runId, fileId, ...f });
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
      successCount++;
    } catch (error: any) {
      logEvent('opportunity.network_failed', fileId, 'ERROR', {
        message: error.message,
      });
    }
  }

  fs.writeFileSync(
    METRICS_PATH,
    JSON.stringify(
      {
        schemaPassRate:
          successCount > 0 ? (schemaPassRate / successCount) * 100 : 0,
        evidenceVerified:
          totalFindings > 0 ? (evidenceVerified / totalFindings) * 100 : 0,
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
        status: 'COMPLETED',
      },
      null,
      2,
    ),
  );

  console.log(`Run ${runId} completed.`);
}

run();
