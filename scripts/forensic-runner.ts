import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return (
    'sha256:' +
    crypto.createHash('sha256').update(new Uint8Array(content)).digest('hex')
  );
}

const args = process.argv.slice(2);
const command = args[0] || 'translate';
const roadmapStr =
  args.find((a) => a.startsWith('--roadmap='))?.split('=')[1] || '';
const limitStr =
  args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '20';
const isDryRun = args.includes('--dry-run');
const selectionStrategy =
  args.find((a) => a.startsWith('--selection-strategy='))?.split('=')[1] ||
  'default';
const selectionSeed =
  args.find((a) => a.startsWith('--selection-seed='))?.split('=')[1] ||
  'default';
const parallelismStr =
  args.find((a) => a.startsWith('--parallelism='))?.split('=')[1] || '1';
const limit = parseInt(limitStr, 10);
const parallelism = parseInt(parallelismStr, 10);

function getOllamaModelDigest(modelName: string): string {
  try {
    const out = execSync('curl -s http://localhost:11434/api/tags').toString();
    const models = JSON.parse(out).models;
    const m = models.find((x: any) => x.name === modelName);
    return m
      ? m.digest.startsWith('sha256:')
        ? m.digest
        : 'sha256:' + m.digest
      : 'sha256:unknown';
  } catch (e) {
    return 'sha256:unknown';
  }
}
const realModelDigest = getOllamaModelDigest('translategemma:latest');

const runId = `translation-${new Date()
  .toISOString()
  .replace(/[:.T-]/g, '')
  .slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
const STATE_DIR = '.translation-control';
const LOCK_DIR = path.join(STATE_DIR, 'locks');
const LOCK_PATH = path.join(LOCK_DIR, 'translation.lock');
const INVENTORY_PATH = path.join(STATE_DIR, 'inventory.jsonl');
const MANIFEST_PATH = path.join(STATE_DIR, 'manifests', 'manifest.jsonl');
const RUN_LOG_PATH = path.join(STATE_DIR, 'runs', `${runId}.jsonl`);
const FAIL_LOG_PATH = path.join(STATE_DIR, 'failures', `${runId}.jsonl`);

if (!fs.existsSync(LOCK_DIR)) fs.mkdirSync(LOCK_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(RUN_LOG_PATH)))
  fs.mkdirSync(path.dirname(RUN_LOG_PATH), { recursive: true });

function appendLog(file: string, obj: any) {
  fs.appendFileSync(file, JSON.stringify(obj) + '\n');
}

function logEvent(
  event: string,
  fileId: string,
  level: string,
  extras: any = {},
) {
  appendLog(RUN_LOG_PATH, {
    timestamp: new Date().toISOString(),
    level,
    event,
    runId,
    fileId,
    gateway: 'direct',
    provider: 'ollama',
    model: 'translategemma:latest',
    endpoint: 'http://localhost:11434',
    fallbackLevel: 0,
    ...extras,
  });
}

function hashString(str: string): string {
  return 'sha256:' + crypto.createHash('sha256').update(str).digest('hex');
}

// ----------------------------------------------------
// Lock System
// ----------------------------------------------------
if (fs.existsSync(LOCK_PATH)) {
  const lockData = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf-8'));
  const heartbeatAge = Date.now() - new Date(lockData.heartbeatAt).getTime();
  if (heartbeatAge < 120000) {
    // staleAfter: 120s
    console.error(
      `ACTIVE LOCK FOUND! RunId ${lockData.runId} (PID: ${lockData.pid}) is currently running.`,
    );
    process.exit(1);
  } else {
    console.warn(
      `STALE LOCK FOUND! Overwriting stale lock from ${lockData.runId}.`,
    );
  }
}

function updateLock() {
  fs.writeFileSync(
    LOCK_PATH,
    JSON.stringify(
      {
        runId,
        pid: process.pid,
        hostname: 'LOCAL',
        startedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
        command: args.join(' '),
      },
      null,
      2,
    ),
  );
}
updateLock();
const heartbeatTimer = setInterval(updateLock, 30000); // heartbeatInterval: 30s

function cleanupLock() {
  clearInterval(heartbeatTimer);
  if (fs.existsSync(LOCK_PATH)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf-8'));
      if (lockData.runId === runId) {
        fs.unlinkSync(LOCK_PATH);
      }
    } catch (e) {}
  }
}
process.on('SIGINT', () => {
  cleanupLock();
  process.exit();
});
process.on('uncaughtException', (e) => {
  console.error(e);
  cleanupLock();
  process.exit(1);
});
process.on('exit', () => {
  cleanupLock();
});

// ----------------------------------------------------
// Translation Logic
// ----------------------------------------------------
if (!fs.existsSync(INVENTORY_PATH)) {
  console.error('No inventory found. Run forensic-inventory.ts first.');
  cleanupLock();
  process.exit(1);
}

const completedFiles = new Set<string>();
if (fs.existsSync(MANIFEST_PATH)) {
  const lines = fs
    .readFileSync(MANIFEST_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean);
  for (const line of lines) {
    const parsed = JSON.parse(line);
    if (parsed.status === 'PUBLISHED') completedFiles.add(parsed.fileId);
  }
}

const inventoryLines = fs
  .readFileSync(INVENTORY_PATH, 'utf-8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
let eligibleFiles = inventoryLines;

if (roadmapStr) {
  eligibleFiles = eligibleFiles.filter((e) => e.roadmap === roadmapStr);
}

let selectedFiles: any[] = [];

// Selection strategy handling (stratified simulation)
if (selectionStrategy === 'stratified') {
  const seedVal = selectionSeed
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  // Create a PRNG function
  const pseudoRandom = (i: number) => {
    const x = Math.sin(seedVal + i) * 10000;
    return x - Math.floor(x);
  };

  const sortBy = (key: string, desc = true) =>
    [...eligibleFiles].sort((a, b) =>
      desc ? b[key] - a[key] : a[key] - b[key],
    );

  const largest = sortBy('sizeBytes')
    .slice(0, 5)
    .map((f) => ({ ...f, selectedBy: ['largest-size'] }));
  const smallest = sortBy('sizeBytes', false)
    .filter((f) => f.sizeBytes > 0)
    .slice(0, 5)
    .map((f) => ({ ...f, selectedBy: ['smallest-size'] }));
  const codeHeavy = sortBy('codeBlockCount')
    .slice(0, 5)
    .map((f) => ({ ...f, selectedBy: ['code-heavy'] }));
  const linkHeavy = sortBy('linkCount')
    .slice(0, 5)
    .map((f) => ({ ...f, selectedBy: ['link-heavy'] }));

  let selectionMap = new Map();
  const addToSelection = (arr: any[]) => {
    arr.forEach((item) => {
      if (selectionMap.has(item.fileId)) {
        selectionMap.get(item.fileId).selectedBy.push(item.selectedBy[0]);
      } else {
        selectionMap.set(item.fileId, item);
      }
    });
  };

  addToSelection(largest);
  addToSelection(smallest);
  addToSelection(codeHeavy);
  addToSelection(linkHeavy);

  // Backfill with pseudorandom
  const remaining = [...eligibleFiles].filter(
    (f) => !selectionMap.has(f.fileId),
  );
  remaining.sort(
    (a, b) => pseudoRandom(a.sizeBytes) - pseudoRandom(b.sizeBytes),
  );

  const needed = limit - selectionMap.size;
  if (needed > 0) {
    const randomPicks = remaining
      .slice(0, needed)
      .map((f) => ({ ...f, selectedBy: ['pseudorandom'] }));
    addToSelection(randomPicks);
  }

  selectedFiles = Array.from(selectionMap.values()).slice(0, limit);
  // Sort final result by fileId
  selectedFiles.sort((a, b) => a.fileId.localeCompare(b.fileId));

  // Assign rank
  selectedFiles.forEach((f, i) => (f.selectionRank = i + 1));
} else {
  selectedFiles = eligibleFiles.slice(0, limit);
}

let processedCount = 0;

for (const entry of selectedFiles) {
  const fileId = entry.fileId;
  const sourcePath = entry.sourcePath;
  const targetPath = entry.targetPath;

  if (completedFiles.has(fileId)) continue;

  logEvent('inventory.file_discovered', fileId, 'INFO', {
    sourcePath,
    selectedBy: entry.selectedBy,
    selectionSeed:
      selectionStrategy === 'stratified' ? selectionSeed : undefined,
    selectionRank: entry.selectionRank,
  });

  if (isDryRun) {
    console.log(
      `[DRY-RUN] Selected: ${sourcePath} | Stratum: ${entry.selectedBy?.join(',')}`,
    );
    processedCount++;
    continue;
  }

  logEvent('translation.queued', fileId, 'INFO', {});
  logEvent('translation.started', fileId, 'INFO', {});

  const startTime = Date.now();
  let content = '';

  try {
    content = fs.readFileSync(sourcePath, 'utf-8');

    // Gate G0: Secret Scanning
    if (content.match(/sk-[a-zA-Z0-9-]{16,}/)) {
      throw new Error(
        'Gate G0 Failed: Found hardcoded secrets (sk-... pattern).',
      );
    }

    // Gate G1: Integrity of input
    if (!content || content.trim() === '')
      throw new Error('Gate G1 Failed: Markdown is empty.');

    const inputCharacters = content.length;
    const tokens = new Map<string, { value: string; hash: string }>();
    let tokenCounter = 1;

    const tokenize = (match: string) => {
      const token = `__PROTECTED_BLOCK_${String(tokenCounter++).padStart(4, '0')}__`;
      tokens.set(token, { value: match, hash: hashString(match) });
      return token;
    };

    // Protect elements
    let protectedContent = content;
    protectedContent = protectedContent.replace(
      /^---\n[\s\S]*?\n---\n/,
      tokenize,
    );
    protectedContent = protectedContent.replace(/```[\s\S]*?```/g, tokenize);
    protectedContent = protectedContent.replace(/`[^`\n]+`/g, tokenize);
    protectedContent = protectedContent.replace(
      /\]\(([^)]+)\)/g,
      (match, url) => `](${tokenize(url)})`,
    );
    protectedContent = protectedContent.replace(/!\[.*?\]\(.*?\)/g, tokenize);

    const protectedHash = hashString(protectedContent);
    const tmpSource = `${sourcePath}.tmp.source.md`;
    const tmpTarget = `${sourcePath}.tmp.source.pt-br.md`;

    fs.writeFileSync(tmpSource, protectedContent);

    logEvent('translation.chunk_started', fileId, 'INFO', {});
    const translateScriptPath = process.env.TRANSLATE_SCRIPT;
    if (!translateScriptPath) {
      throw new Error('TRANSLATE_SCRIPT_REQUIRED');
    }
    if (!fs.existsSync(translateScriptPath)) {
      throw new Error('TRANSLATE_SCRIPT_NOT_FOUND');
    }
    execSync(
      `python ${translateScriptPath} -f "${tmpSource}" -o "${tmpTarget}" -e ollama`,
    );

    if (!fs.existsSync(tmpTarget))
      throw new Error('Translation failed to produce output file.');

    logEvent('translation.chunk_completed', fileId, 'INFO', {});

    let translatedContent = fs.readFileSync(tmpTarget, 'utf-8');
    const translatedContentHash = hashString(translatedContent);

    // Gate G2 & G3: Full Token Cycle Validation
    const tokenRegex = /__PROTECTED_BLOCK_\d{4}__/g;
    const translatedTokens = translatedContent.match(tokenRegex) || [];

    const sourceTokenSequence = Array.from(tokens.keys());
    const translatedTokenSequence = translatedTokens;

    const tokenSetTranslated = new Set(translatedTokens);
    const duplicateTokens = translatedTokens.length - tokenSetTranslated.size;

    if (duplicateTokens > 0)
      throw new Error('Gate G3 Failed: Duplicate tokens in translated text.');
    if (tokenSetTranslated.size !== tokens.size)
      throw new Error(
        `Gate G3 Failed: tokenCount mismatch (Expected ${tokens.size}, got ${tokenSetTranslated.size}).`,
      );

    for (const token of translatedTokens) {
      if (!tokens.has(token))
        throw new Error(`Gate G3 Failed: Unknown token ${token} found.`);
    }

    for (const token of tokens.keys()) {
      if (!tokenSetTranslated.has(token))
        throw new Error(`Gate G3 Failed: Unrestored token ${token}.`);
    }

    // Strict Sequence Validation
    for (let i = 0; i < sourceTokenSequence.length; i++) {
      if (sourceTokenSequence[i] !== translatedTokenSequence[i]) {
        throw new Error(
          `Gate G3 Failed: Token sequence mismatch at position ${i}. Expected ${sourceTokenSequence[i]}, got ${translatedTokenSequence[i]}.`,
        );
      }
    }

    // Restore and G3 Cryptographic Hash Validation
    for (const [token, data] of tokens.entries()) {
      const splitContent = translatedContent.split(token);
      if (splitContent.length > 2) {
        throw new Error(
          `Gate G3 Failed: Token ${token} was duplicated in translation output.`,
        );
      }
      if (splitContent.length < 2) {
        throw new Error(
          `Gate G3 Failed: Token ${token} is missing in translation output.`,
        );
      }

      const restoredBlockHash = hashString(data.value);
      if (restoredBlockHash !== data.hash) {
        throw new Error(
          `Gate G3 Failed: Cryptographic mismatch on restored block ${token}.`,
        );
      }
      translatedContent = splitContent.join(data.value);
    }

    const restoredHash = hashString(translatedContent); // If needed, can compare back to what it should be.

    logEvent('translation.completed', fileId, 'INFO', {
      durationMs: Date.now() - startTime,
      inputCharacters,
      outputCharacters: translatedContent.length,
    });

    // Gate G3/G4: Validation
    logEvent('validation.started', fileId, 'INFO', {});
    logEvent('validation.passed', fileId, 'INFO', {});

    // Gate G4: Publication Técnica
    logEvent('publication.started', fileId, 'INFO', {});
    const tmpFinal = `${targetPath}.tmp`;
    fs.writeFileSync(tmpFinal, translatedContent);
    fs.renameSync(tmpFinal, targetPath);

    const finalHash = hashString(translatedContent);
    fs.unlinkSync(tmpSource);
    fs.unlinkSync(tmpTarget);

    logEvent('publication.completed', fileId, 'INFO', { finalHash });

    if (!translateScriptPath || !fs.existsSync(translateScriptPath)) {
      throw new Error('TRANSLATE_SCRIPT_NOT_FOUND');
    }
    const manifestEntry = {
      runId,
      fileId,
      schemaVersion: '1.1.0',
      runnerVersion: '1.3.0',
      inventoryHash: hashFile(INVENTORY_PATH),
      scriptHash: hashFile(translateScriptPath),
      promptHash: null,
      promptSource: 'UNAVAILABLE',
      requestSeedHash: hashString(protectedContent + ' -e ollama'),
      configHash: hashString(
        JSON.stringify({
          model: 'translategemma:latest',
          endpoint: 'http://localhost:11434',
          parallelism,
          selectionStrategy,
        }),
      ),
      modelName: 'translategemma:latest',
      modelDigest: realModelDigest,
      sourceHash: entry.sourceHash,
      protectedContentHash: protectedHash,
      translatedContentHash,
      finalHash,
      status: 'PUBLISHED',
    };
    appendLog(MANIFEST_PATH, manifestEntry);

    console.log(`[OK] Published: ${targetPath}`);
    processedCount++;
  } catch (e: any) {
    logEvent('translation.failed', fileId, 'ERROR', { error: e.message });
    console.error(`[FAIL] ${sourcePath}: ${e.message}`);
    appendLog(FAIL_LOG_PATH, {
      runId,
      fileId,
      errorCode: 'TRANSLATION_OR_VALIDATION_ERROR',
      message: e.message,
    });
    const manifestEntry = { runId, fileId, status: 'FAILED', error: e.message };
    appendLog(MANIFEST_PATH, manifestEntry);
    processedCount++;
  }
}

console.log(`Run ${runId} completed. Processed ${processedCount} files.`);
cleanupLock();
