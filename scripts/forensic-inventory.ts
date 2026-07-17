import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const STATE_DIR = '.translation-control';
const CONTENT_ROOT = path.join('src', 'data', 'roadmaps');
const INVENTORY_PATH = path.join(STATE_DIR, 'inventory.jsonl');
const BASELINE_PATH = path.join(STATE_DIR, 'baseline.json');

function hashString(str: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(str).digest('hex');
}

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return (
    'sha256:' +
    crypto.createHash('sha256').update(new Uint8Array(content)).digest('hex')
  );
}

function countOccurrences(str: string, regex: RegExp): number {
  return (str.match(regex) || []).length;
}

function buildInventory() {
  console.log(`Scanning ${CONTENT_ROOT} for markdown files...`);

  const files: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (item === 'node_modules' || item === '.git') continue;
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        walk(itemPath);
      } else {
        if (
          itemPath.endsWith('.md') &&
          !itemPath.toLowerCase().endsWith('.pt-br.md') &&
          itemPath.includes(path.sep + 'content' + path.sep)
        ) {
          files.push(itemPath);
        }
      }
    }
  }

  walk(CONTENT_ROOT);
  console.log(`Found ${files.length} candidate files. Analyzing...`);

  const inventoryLines: string[] = [];
  let totalSize = 0;

  for (const file of files) {
    // Normalize path for consistent ID
    const normalizedPath = file.replace(/\\/g, '/');
    const roadmapMatch = normalizedPath.match(/^src\/data\/roadmaps\/([^\/]+)/);
    const roadmap = roadmapMatch ? roadmapMatch[1] : 'unknown';
    const targetPath = normalizedPath.replace(/\.md$/, '.pt-br.md');

    const content = fs.readFileSync(file, 'utf-8');
    const sizeBytes = Buffer.byteLength(content, 'utf8');
    const lineCount = content.split('\n').length;

    // Count metrics
    const codeBlockCount = countOccurrences(content, /```[\s\S]*?```/g);
    const linkCount = countOccurrences(content, /\]\(([^)]+)\)/g);
    const hasFrontmatter = /^---\n[\s\S]*?\n---\n/.test(content);

    const fileId = hashString(normalizedPath);
    const sourceHash = hashFile(file);

    const entry = {
      fileId,
      roadmap,
      sourcePath: normalizedPath,
      targetPath,
      sourceHash,
      sizeBytes,
      lineCount,
      codeBlockCount,
      linkCount,
      frontmatterPresent: hasFrontmatter,
      status: 'pending',
    };

    inventoryLines.push(JSON.stringify(entry));
    totalSize += sizeBytes;
  }

  fs.writeFileSync(INVENTORY_PATH, inventoryLines.join('\n') + '\n');

  const baseline = {
    generatedAt: new Date().toISOString(),
    totalEligibleFiles: files.length,
    totalEligibleBytes: totalSize,
    engine: 'ollama',
    modelsAvailable: ['translategemma:latest', 'qwen3.6:latest'],
    liteLLMState: 'OFFLINE_AT_INSPECTION',
    deepLXState: 'RATE_LIMITED',
  };

  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));

  console.log(
    `Inventory complete. ${files.length} files tracked in ${INVENTORY_PATH}`,
  );
}

try {
  buildInventory();
} catch (e) {
  console.error('Failed to build inventory:', e);
  process.exit(1);
}
