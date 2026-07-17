import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const args = process.argv.slice(2);
const sourceFile = args[0];
const STATE_DIR = '.translation-control';
const RUN_LOG_PATH = path.join(STATE_DIR, 'runs', 'opportunity-extraction.jsonl');

if (!sourceFile) {
  console.error("Usage: tsx extract-opportunities.ts <source-file>");
  process.exit(1);
}

const runId = `opp-extract-${new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14)}`;

function appendLog(file: string, obj: any) {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    if (!fs.existsSync(path.dirname(file))) fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

function logEvent(event: string, fileId: string, level: string, extras: any = {}) {
    appendLog(RUN_LOG_PATH, {
        timestamp: new Date().toISOString(),
        level,
        event,
        runId,
        fileId,
        ...extras
    });
}

function hashString(str: string): string {
    return 'sha256:' + crypto.createHash('sha256').update(str).digest('hex');
}

const content = fs.readFileSync(sourceFile, 'utf-8');
const fileId = hashString(sourceFile.replace(/\\/g, '/'));

logEvent('opportunity.extraction_started', fileId, 'INFO', { sourceFile });

const promptVersion = 'opportunities-v1.2.0';
const systemPrompt = `You are a Staff Software Architect analyzing technical roadmap documentation for evolution opportunities.
Your task is to identify outdated technologies, missing modern paradigms, structural improvements, or broken content.

You MUST respond with a valid JSON object matching this schema exactly:
{
  "roadmap": "string (name of the roadmap, inferred from file path)",
  "findings": [
    {
      "findingId": "string (generate a unique identifier, e.g. frontend-0042)",
      "category": "deprecated-technology | outdated-version | missing-link | conceptual-gap | insecure-practice | duplicate-content | inconsistency | missing-a11y | missing-observability | missing-tests | ia-improvement | automation-opportunity | ai-opportunity",
      "severity": "critical | high | medium | low",
      "title": "string (short description)",
      "evidence": {
        "file": "string (the file path)",
        "heading": "string (the markdown heading where this is located)",
        "excerpt": "string (short excerpt of the text)"
      },
      "recommendation": "string (actionable recommendation to fix/evolve)",
      "confidence": "number (0.0 to 1.0)",
      "timeHorizon": "immediate | 30-days | 60-90-days | strategic",
      "status": "proposed"
    }
  ]
}

Only include high-confidence findings. If the content is perfect, return an empty findings array.
Do NOT include markdown formatting (\`\`\`json) in your response, just the raw JSON object.
`;

async function queryModel(endpoint: string, model: string, apiKey: string = 'sk-no-key') {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `File: ${sourceFile}\n\nContent:\n${content}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function run() {
  console.log(`Analyzing ${sourceFile}...`);
  let result;
  let usedModel = 'gemini-pro';
  
  try {
    result = await queryModel('http://localhost:4002/v1/chat/completions', 'gemini-pro', '***REDACTED***');
  } catch (error: any) {
    try {
      usedModel = 'qwen3.6:latest';
      result = await queryModel('http://localhost:11434/v1/chat/completions', usedModel);
    } catch (ollamaError: any) {
      logEvent('opportunity.extraction_failed', fileId, 'ERROR', { error: ollamaError.message });
      process.exit(1);
    }
  }

  try {
    const jsonStr = result.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(jsonStr);
    
    // Inject model and prompt version into each finding
    if (parsed.findings) {
        parsed.findings.forEach((f: any) => {
            f.model = usedModel;
            f.promptVersion = promptVersion;
            logEvent('opportunity.finding_created', fileId, 'INFO', { findingId: f.findingId, category: f.category });
        });
    }

    const outPath = sourceFile + '.opportunities.json';
    fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2));
    
    logEvent('opportunity.extraction_completed', fileId, 'INFO', { 
        findingsCount: parsed.findings ? parsed.findings.length : 0 
    });

    console.log(`Analysis saved to ${outPath}`);
    process.exit(0);
  } catch (e: any) {
    logEvent('opportunity.extraction_failed', fileId, 'ERROR', { error: "Parse error" });
    process.exit(1);
  }
}

run();
