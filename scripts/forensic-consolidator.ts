import * as fs from 'fs';
import * as path from 'path';

const STATE_DIR = '.translation-control';
const RUNS_DIR = path.join(STATE_DIR, 'opportunities', 'runs');
const REPORT_PATH = path.join(
  STATE_DIR,
  'reports',
  'ROADMAP_EVOLUTION_REPORT.md',
);
const FINDINGS_LOG = path.join(STATE_DIR, 'manifests', 'findings.jsonl');

const REQUIRED_FIELDS = [
  'runId',
  'fileId',
  'findingId',
  'schemaVersion',
  'status',
];

function findFindingsFiles(): string[] {
  if (!fs.existsSync(RUNS_DIR)) return [];
  const runs = fs.readdirSync(RUNS_DIR).filter((d) => {
    const fullPath = path.join(RUNS_DIR, d);
    return fs.statSync(fullPath).isDirectory();
  });
  const files: string[] = [];
  for (const run of runs) {
    const findingsPath = path.join(RUNS_DIR, run, 'findings.jsonl');
    if (fs.existsSync(findingsPath)) files.push(findingsPath);
  }
  return files;
}

function consolidate() {
  console.log(`Scanning for findings.jsonl in ${RUNS_DIR}...`);
  const findingsFiles = findFindingsFiles();

  if (findingsFiles.length === 0) {
    console.log('No findings files found to consolidate.');
    return;
  }

  console.log(`Found ${findingsFiles.length} run(s) with findings.`);

  // Ensure output dirs exist
  if (!fs.existsSync(path.dirname(REPORT_PATH)))
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  if (!fs.existsSync(path.dirname(FINDINGS_LOG)))
    fs.mkdirSync(path.dirname(FINDINGS_LOG), { recursive: true });

  const allFindings: any[] = [];
  let rejected = 0;

  for (const file of findingsFiles) {
    const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const finding = JSON.parse(line);

        // Validate required fields
        const missingFields = REQUIRED_FIELDS.filter((f) => !finding[f]);
        if (missingFields.length > 0) {
          console.error(
            `[REJECTED] Finding in ${file} missing fields: ${missingFields.join(', ')}`,
          );
          rejected++;
          continue;
        }

        allFindings.push(finding);
      } catch (e) {
        console.error(`[PARSE_ERROR] Failed to parse line in ${file}`);
        rejected++;
      }
    }
  }

  // Deduplicate by findingId (keep latest by runId lexicographic order)
  const deduped = new Map<string, any>();
  for (const f of allFindings) {
    const existing = deduped.get(f.findingId);
    if (!existing || f.runId > existing.runId) {
      deduped.set(f.findingId, f);
    }
  }
  const uniqueFindings = Array.from(deduped.values());

  // Write consolidated JSONL
  const jsonlContent =
    uniqueFindings.map((f) => JSON.stringify(f)).join('\n') + '\n';
  fs.writeFileSync(FINDINGS_LOG, jsonlContent);

  // Group by category for markdown
  const byCategory = uniqueFindings.reduce((acc: any, cur: any) => {
    const cat = cur.category || 'uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(cur);
    return acc;
  }, {});

  // Write Markdown Report
  let md = `# Roadmap Evolution Report\n\n`;
  md += `Generated at: ${new Date().toISOString()}\n`;
  md += `Total Findings: **${uniqueFindings.length}**\n`;
  md += `Rejected (missing fields): **${rejected}**\n`;
  md += `Deduplicated from: **${allFindings.length}** raw entries\n`;
  md += `Source runs: **${findingsFiles.length}**\n\n`;

  for (const category of Object.keys(byCategory).sort()) {
    md += `## Category: ${category}\n\n`;
    const categoryFindings = byCategory[category];
    for (const f of categoryFindings) {
      md += `### [${(f.severity || 'INFO').toUpperCase()}] ${f.title || f.findingId}\n`;
      md += `- **ID:** \`${f.findingId}\`\n`;
      md += `- **Run:** \`${f.runId}\`\n`;
      md += `- **Status:** \`${f.status}\`\n`;
      md += `- **Horizon:** ${f.timeHorizon || 'unspecified'}\n`;
      md += `- **File:** \`${f.evidence?.file || f.fileId}\`\n`;
      if (f.recommendation) md += `- **Recommendation:** ${f.recommendation}\n`;
      if (f.evidence?.heading || f.evidence?.excerpt) {
        md += `\n> **Evidence:**\n`;
        if (f.evidence.heading) md += `> *Heading:* ${f.evidence.heading}\n`;
        if (f.evidence.excerpt) md += `> *Excerpt:* "${f.evidence.excerpt}"\n`;
      }
      md += `\n`;
    }
    md += `---\n\n`;
  }

  fs.writeFileSync(REPORT_PATH, md);

  console.log(
    `Consolidated ${uniqueFindings.length} findings (${rejected} rejected).`,
  );
  console.log(`JSONL Manifest: ${FINDINGS_LOG}`);
  console.log(`Markdown Report: ${REPORT_PATH}`);
}

consolidate();
