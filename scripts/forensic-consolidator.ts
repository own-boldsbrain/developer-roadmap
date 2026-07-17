import * as fs from 'fs';
import * as path from 'path';

const STATE_DIR = '.translation-control';
const CONTENT_ROOT = path.join('src', 'data', 'roadmaps');
const REPORT_PATH = path.join(STATE_DIR, 'reports', 'ROADMAP_EVOLUTION_REPORT.md');
const FINDINGS_LOG = path.join(STATE_DIR, 'manifests', 'findings.jsonl');

function findOpportunityFiles(dir: string, fileList: string[] = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            findOpportunityFiles(fullPath, fileList);
        } else if (fullPath.endsWith('.opportunities.json')) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

function consolidate() {
    console.log(`Scanning for .opportunities.json files in ${CONTENT_ROOT}...`);
    const oppFiles = findOpportunityFiles(CONTENT_ROOT);
    
    if (oppFiles.length === 0) {
        console.log("No opportunity files found to consolidate.");
        return;
    }

    let allFindings: any[] = [];
    
    // Ensure dirs exist
    if (!fs.existsSync(path.dirname(REPORT_PATH))) fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    if (!fs.existsSync(path.dirname(FINDINGS_LOG))) fs.mkdirSync(path.dirname(FINDINGS_LOG), { recursive: true });

    for (const file of oppFiles) {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
            if (data && data.findings && Array.isArray(data.findings)) {
                allFindings = allFindings.concat(data.findings);
            }
        } catch (e) {
            console.error(`Failed to parse ${file}`);
        }
    }

    // Write to JSONL
    const jsonlContent = allFindings.map(f => JSON.stringify(f)).join('\n') + '\n';
    fs.writeFileSync(FINDINGS_LOG, jsonlContent);

    // Group by category for markdown
    const byCategory = allFindings.reduce((acc: any, cur: any) => {
        if (!acc[cur.category]) acc[cur.category] = [];
        acc[cur.category].push(cur);
        return acc;
    }, {});

    // Write Markdown Report
    let md = `# Roadmap Evolution Report\n\n`;
    md += `Generated at: ${new Date().toISOString()}\n`;
    md += `Total Findings: **${allFindings.length}**\n\n`;

    for (const category of Object.keys(byCategory).sort()) {
        md += `## Category: ${category}\n\n`;
        const categoryFindings = byCategory[category];
        for (const f of categoryFindings) {
            md += `### [${f.severity.toUpperCase()}] ${f.title}\n`;
            md += `- **ID:** \`${f.findingId}\`\n`;
            md += `- **Status:** \`${f.status || 'proposed'}\`\n`;
            md += `- **Horizon:** ${f.timeHorizon}\n`;
            md += `- **File:** \`${f.evidence?.file}\`\n`;
            md += `- **Recommendation:** ${f.recommendation}\n\n`;
            md += `> **Evidence:**\n> *Heading:* ${f.evidence?.heading}\n> *Excerpt:* "${f.evidence?.excerpt}"\n\n`;
        }
        md += `---\n\n`;
    }

    fs.writeFileSync(REPORT_PATH, md);

    console.log(`Consolidated ${allFindings.length} findings.`);
    console.log(`JSONL Manifest: ${FINDINGS_LOG}`);
    console.log(`Markdown Report: ${REPORT_PATH}`);
}

consolidate();
