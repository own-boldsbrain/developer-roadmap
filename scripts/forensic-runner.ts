import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

const args = process.argv.slice(2);
const limitStr = args.find(a => a.startsWith('--limit='))?.split('=')[1] || '20';
const engineStr = args.find(a => a.startsWith('--engine='))?.split('=')[1] || 'ollama';
const roadmapStr = args.find(a => a.startsWith('--roadmap='))?.split('=')[1] || '';
const limit = parseInt(limitStr, 10);

const runId = `translation-${new Date().toISOString().replace(/[:.T-]/g, '').slice(0, 14)}-${crypto.randomBytes(3).toString('hex')}`;
const STATE_DIR = '.translation-control';
const INVENTORY_PATH = path.join(STATE_DIR, 'inventory.jsonl');
const MANIFEST_PATH = path.join(STATE_DIR, 'manifests', 'manifest.jsonl');
const RUN_LOG_PATH = path.join(STATE_DIR, 'runs', `${runId}.jsonl`);
const FAIL_LOG_PATH = path.join(STATE_DIR, 'failures', `${runId}.jsonl`);

function appendLog(file: string, obj: any) {
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

function countOccurrences(str: string, regex: RegExp): number {
    return (str.match(regex) || []).length;
}

if (!fs.existsSync(INVENTORY_PATH)) {
    console.error("No inventory found. Run forensic-inventory.ts first.");
    process.exit(1);
}

// Read manifest to know what's already done
const completedFiles = new Set<string>();
if (fs.existsSync(MANIFEST_PATH)) {
    const lines = fs.readFileSync(MANIFEST_PATH, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
        const parsed = JSON.parse(line);
        if (parsed.status === 'PUBLISHED') {
            completedFiles.add(parsed.fileId);
        }
    }
}

const inventoryLines = fs.readFileSync(INVENTORY_PATH, 'utf-8').split('\n').filter(Boolean);
let processedCount = 0;

for (const line of inventoryLines) {
    if (processedCount >= limit) break;

    const entry = JSON.parse(line);
    
    if (roadmapStr && entry.roadmap !== roadmapStr) {
        continue;
    }
    const fileId = entry.fileId;
    const sourcePath = entry.sourcePath;
    const targetPath = entry.targetPath;

    logEvent('inventory.file_discovered', fileId, 'INFO', { sourcePath });

    if (completedFiles.has(fileId)) {
        logEvent('inventory.file_skipped', fileId, 'INFO', { reason: 'Already PUBLISHED' });
        continue;
    }

    logEvent('translation.queued', fileId, 'INFO', { engine: engineStr });
    logEvent('translation.started', fileId, 'INFO', {});

    const startTime = Date.now();
    let content = '';

    try {
        content = fs.readFileSync(sourcePath, 'utf-8');
        
        // Gate G1: Integrity of input
        if (!content || content.trim() === '') {
            throw new Error("Gate G1 Failed: Markdown is empty.");
        }

        const inputCharacters = content.length;
        const tokens = new Map<string, string>();
        let tokenCounter = 1;
        
        const tokenize = (match: string) => {
            const token = `__PROTECTED_BLOCK_${String(tokenCounter++).padStart(4, '0')}__`;
            tokens.set(token, match);
            return token;
        };
        
        // Protect elements
        let protectedContent = content;
        protectedContent = protectedContent.replace(/^---\n[\s\S]*?\n---\n/, tokenize);
        protectedContent = protectedContent.replace(/```[\s\S]*?```/g, tokenize);
        protectedContent = protectedContent.replace(/`[^`\n]+`/g, tokenize);
        protectedContent = protectedContent.replace(/\]\(([^)]+)\)/g, (match, url) => `](${tokenize(url)})`);
        protectedContent = protectedContent.replace(/!\[.*?\]\(.*?\)/g, tokenize);

        const protectedHash = hashString(protectedContent);

        const tmpSource = `${sourcePath}.tmp.source.md`;
        const tmpTarget = `${sourcePath}.tmp.source.pt-br.md`;
        
        fs.writeFileSync(tmpSource, protectedContent);

        logEvent('translation.chunk_started', fileId, 'INFO', {});

        // Run python translator
        const scriptPath = 'C:\\Users\\fjuni\\.gemini\\config\\skills\\translation\\scripts\\translate_doc.py';
        execSync(`python ${scriptPath} -f "${tmpSource}" -o "${tmpTarget}" -e ${engineStr}`);
        
        if (!fs.existsSync(tmpTarget)) {
            throw new Error("Translation failed to produce output file.");
        }

        logEvent('translation.chunk_completed', fileId, 'INFO', {});

        let translatedContent = fs.readFileSync(tmpTarget, 'utf-8');
        const translatedContentHash = hashString(translatedContent);

        // Restore tokens
        for (const [token, originalValue] of tokens.entries()) {
            translatedContent = translatedContent.split(token).join(originalValue);
        }

        logEvent('translation.completed', fileId, 'INFO', {
            durationMs: Date.now() - startTime,
            inputCharacters,
            outputCharacters: translatedContent.length
        });

        // Gate G2 & G3: Validation
        logEvent('validation.started', fileId, 'INFO', {});

        if (translatedContent.includes('__PROTECTED_BLOCK_')) {
            throw new Error("Gate G2 Failed: Tokens remaining in output.");
        }

        const targetCodeBlocks = countOccurrences(translatedContent, /```[\s\S]*?```/g);
        if (targetCodeBlocks !== entry.codeBlockCount) {
            throw new Error(`Gate G3 Failed: Code block mismatch. Expected ${entry.codeBlockCount}, got ${targetCodeBlocks}.`);
        }

        logEvent('validation.passed', fileId, 'INFO', {});

        // Gate G4: Publication
        logEvent('publication.started', fileId, 'INFO', {});
        const tmpFinal = `${targetPath}.tmp`;
        fs.writeFileSync(tmpFinal, translatedContent);
        fs.renameSync(tmpFinal, targetPath);

        const finalHash = hashString(translatedContent);

        // Cleanup
        fs.unlinkSync(tmpSource);
        fs.unlinkSync(tmpTarget);

        logEvent('publication.completed', fileId, 'INFO', { finalHash });

        // Update Manifest
        const manifestEntry = {
            runId,
            fileId,
            sourceHash: entry.sourceHash,
            protectedContentHash: protectedHash,
            translatedContentHash,
            finalHash,
            engine: engineStr,
            model: 'translategemma:latest',
            promptVersion: 'translation-v1.0.0',
            validatorVersion: 'markdown-validator-v1.0.0',
            status: 'PUBLISHED'
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
            classification: 'quality',
            severity: 'high',
            message: e.message
        });
        
        // Update manifest with FAILURE
        const manifestEntry = {
            runId,
            fileId,
            status: 'FAILED',
            error: e.message
        };
        appendLog(MANIFEST_PATH, manifestEntry);

        processedCount++;
    }
}

console.log(`Run ${runId} completed. Processed ${processedCount} files.`);
