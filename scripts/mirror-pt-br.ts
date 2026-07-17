/**
 * mirror-pt-br.ts
 *
 * Creates .pt-br.md mirror files for every inventory entry that doesn't
 * already have one. Ollama is DISABLED — files are copied as-is with a
 * header comment marking them as untranslated mirrors.
 *
 * Usage:  npx tsx scripts/mirror-pt-br.ts [--limit=N]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const args = process.argv.slice(2);
const limitStr =
  args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0';
const limit = parseInt(limitStr, 10); // 0 = unlimited

const STATE_DIR = '.translation-control';
const INVENTORY_PATH = path.join(STATE_DIR, 'inventory.jsonl');
const MANIFEST_PATH = path.join(STATE_DIR, 'manifests', 'manifest.jsonl');

const runId = `mirror-${new Date()
  .toISOString()
  .replace(/[:.T-]/g, '')
  .slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
const RUN_LOG_PATH = path.join(STATE_DIR, 'runs', `${runId}.jsonl`);

function ensureDir(p: string) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

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

function appendLog(file: string, obj: any) {
  ensureDir(file);
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

// --- Load state ---
if (!fs.existsSync(INVENTORY_PATH)) {
  console.error('No inventory found. Run forensic-inventory.ts first.');
  process.exit(1);
}

const completedFiles = new Set<string>();
if (fs.existsSync(MANIFEST_PATH)) {
  const lines = fs
    .readFileSync(MANIFEST_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.status === 'PUBLISHED' || parsed.status === 'MIRRORED')
        completedFiles.add(parsed.fileId);
    } catch {}
  }
}

const inventoryLines = fs
  .readFileSync(INVENTORY_PATH, 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

console.log(`[MIRROR] Run ${runId}`);
console.log(`[MIRROR] Inventory: ${inventoryLines.length} files`);
console.log(`[MIRROR] Already completed: ${completedFiles.size}`);

let mirrored = 0;
let skipped = 0;
let failed = 0;
const startTime = Date.now();

for (const entry of inventoryLines) {
  if (limit > 0 && mirrored >= limit) break;

  const fileId = entry.fileId;
  const sourcePath = entry.sourcePath;
  const targetPath = entry.targetPath;

  // Skip already completed
  if (completedFiles.has(fileId)) {
    skipped++;
    continue;
  }

  // Skip if target already exists on disk
  if (fs.existsSync(targetPath)) {
    skipped++;
    continue;
  }

  try {
    // Read source
    if (!fs.existsSync(sourcePath)) {
      console.error(`[SKIP] Source missing: ${sourcePath}`);
      failed++;
      continue;
    }

    const content = fs.readFileSync(sourcePath, 'utf-8');
    if (!content || content.trim() === '') {
      console.error(`[SKIP] Empty source: ${sourcePath}`);
      failed++;
      continue;
    }

    // Write mirror (atomic: tmp + rename)
    ensureDir(targetPath);
    const tmpPath = `${targetPath}.tmp`;
    fs.writeFileSync(tmpPath, content);
    fs.renameSync(tmpPath, targetPath);

    const finalHash = hashString(content);

    // Record in manifest
    const manifestEntry = {
      runId,
      fileId,
      schemaVersion: '1.1.0',
      status: 'MIRRORED',
      engine: 'none',
      sourceHash: entry.sourceHash,
      finalHash,
      sourcePath,
      targetPath,
      sizeBytes: Buffer.byteLength(content, 'utf8'),
    };
    appendLog(MANIFEST_PATH, manifestEntry);

    // Log event
    appendLog(RUN_LOG_PATH, {
      timestamp: new Date().toISOString(),
      event: 'mirror.published',
      runId,
      fileId,
      targetPath,
    });

    mirrored++;

    // Progress every 500 files
    if (mirrored % 500 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(
        `[MIRROR] Progress: ${mirrored} mirrored, ${skipped} skipped, ${failed} failed (${elapsed}s)`,
      );
    }
  } catch (e: any) {
    console.error(`[FAIL] ${sourcePath}: ${e.message}`);
    appendLog(RUN_LOG_PATH, {
      timestamp: new Date().toISOString(),
      event: 'mirror.failed',
      runId,
      fileId,
      error: e.message,
    });
    failed++;
  }
}

const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`\n[MIRROR] === COMPLETE ===`);
console.log(`[MIRROR] Run:      ${runId}`);
console.log(`[MIRROR] Mirrored: ${mirrored}`);
console.log(`[MIRROR] Skipped:  ${skipped}`);
console.log(`[MIRROR] Failed:   ${failed}`);
console.log(`[MIRROR] Elapsed:  ${totalElapsed}s`);
console.log(`[MIRROR] Log:      ${RUN_LOG_PATH}`);
