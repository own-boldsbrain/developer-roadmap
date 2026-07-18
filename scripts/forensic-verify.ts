import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const args = process.argv.slice(2);
const manifestArg = args
  .find((a) => a.startsWith('--manifest='))
  ?.split('=')[1];
const inventoryArg = args
  .find((a) => a.startsWith('--inventory='))
  ?.split('=')[1];
const failOnMismatch = args.includes('--fail-on-mismatch');

if (!manifestArg || !inventoryArg) {
  console.error(
    'Usage: npx tsx forensic-verify.ts --manifest=<path> --inventory=<path> [--fail-on-mismatch]',
  );
  process.exit(1);
}

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`FILE_MISSING`);
  }
  const content = fs.readFileSync(filePath);
  return (
    'sha256:' +
    crypto.createHash('sha256').update(new Uint8Array(content)).digest('hex')
  );
}

function verify() {
  if (!fs.existsSync(manifestArg as string)) {
    console.error(`Manifest not found at ${manifestArg}`);
    process.exit(1);
  }

  if (!fs.existsSync(inventoryArg as string)) {
    console.error(`Inventory not found at ${inventoryArg}`);
    process.exit(1);
  }

  // Read inventory to map fileId -> sourcePath
  const inventory = fs
    .readFileSync(inventoryArg as string, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const idToPath = new Map<string, string>();
  for (const entry of inventory) {
    idToPath.set(entry.fileId, entry.targetPath);
  }

  const manifests = fs
    .readFileSync(manifestArg as string, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const latestPublished = new Map<string, any>();
  for (const entry of manifests) {
    if (
      entry.state === 'PUBLISHED' ||
      entry.status === 'PUBLISHED' ||
      entry.status === 'MIRRORED'
    ) {
      latestPublished.set(entry.fileId, entry);
    }
  }

  let publishedExpected = 0;
  let publishedVerified = 0;
  let mirroredExpected = 0;
  let mirroredVerified = 0;

  let missing = 0;
  let mismatched = 0;
  let unverifiable = 0;
  let validStructural = 0;

  for (const [fileId, entry] of latestPublished.entries()) {
    const isMirrored =
      entry.processingMode === 'MIRRORED_FALLBACK' ||
      entry.status === 'MIRRORED';
    if (isMirrored) mirroredExpected++;
    else publishedExpected++;

    const sourcePath = idToPath.get(fileId);
    if (!sourcePath) {
      console.error(
        `[MANIFEST_AMBIGUOUS] Cannot resolve target path for fileId ${fileId}`,
      );
      unverifiable++;
      continue;
    }

    const expectedHash = isMirrored ? entry.sourceHash : entry.finalHash;

    if (!expectedHash) {
      console.error(
        `[MANIFEST_MISSING_HASH] fileId ${fileId} lacks expected hash in manifest`,
      );
      unverifiable++;
      continue;
    }

    try {
      const currentHash = hashFile(sourcePath);
      if (currentHash !== expectedHash) {
        console.error(`[POST_PUBLICATION_MODIFICATION] ${sourcePath}`);
        console.error(`  Expected (manifest): ${expectedHash}`);
        console.error(`  Got (disk):          ${currentHash}`);
        mismatched++;
      } else {
        if (isMirrored) mirroredVerified++;
        else publishedVerified++;

        if (entry.structuralStatus !== 'INVALID') validStructural++;
      }
    } catch (e: any) {
      if (e.message === 'FILE_MISSING') {
        console.error(`[FILE_MISSING] ${sourcePath} is no longer on disk`);
        missing++;
      } else {
        console.error(`[ERROR] ${sourcePath}: ${e.message}`);
        unverifiable++;
      }
    }
  }

  const totalExpected = publishedExpected + mirroredExpected;
  const totalVerified = publishedVerified + mirroredVerified;

  let status: string;
  let reason: string | undefined;

  if (totalExpected === 0) {
    status = 'FAILED';
    reason = 'EMPTY_VERIFICATION';
    console.error(
      '[EMPTY_VERIFICATION] No PUBLISHED or MIRRORED records found in manifest.',
    );
  } else if (totalVerified === 0) {
    status = 'FAILED';
    reason = 'ZERO_VERIFIED';
    console.error(
      '[ZERO_VERIFIED] Published records exist but none could be verified.',
    );
  } else if (missing > 0 || mismatched > 0 || unverifiable > 0) {
    status = 'FAILED';
    reason = 'INTEGRITY_ERRORS';
  } else {
    status = 'PASSED';
  }

  const publicationCoverage =
    inventory.length > 0
      ? Math.round((totalVerified / inventory.length) * 100)
      : 0;
  const linguisticCoverage =
    inventory.length > 0
      ? Math.round((publishedVerified / inventory.length) * 100)
      : 0;
  const structuralCoverage =
    totalVerified > 0 ? Math.round((validStructural / totalVerified) * 100) : 0;

  const results = {
    publishedExpected,
    publishedVerified,
    mirroredExpected,
    mirroredVerified,
    linguisticCoverage,
    publicationCoverage,
    structuralCoverage,
    missing,
    mismatched,
    unverifiable,
    status,
    ...(reason ? { reason } : {}),
  };

  console.log(JSON.stringify(results, null, 2));

  if (failOnMismatch && results.status === 'FAILED') {
    process.exit(1);
  }
}

verify();
