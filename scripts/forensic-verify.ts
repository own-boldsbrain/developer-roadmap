import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const args = process.argv.slice(2);
const manifestArg = args.find(a => a.startsWith('--manifest='))?.split('=')[1];
const inventoryArg = args.find(a => a.startsWith('--inventory='))?.split('=')[1];
const failOnMismatch = args.includes('--fail-on-mismatch');

if (!manifestArg || !inventoryArg) {
  console.error('Usage: npx tsx forensic-verify.ts --manifest=<path> --inventory=<path> [--fail-on-mismatch]');
  process.exit(1);
}

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`FILE_MISSING`);
  }
  const content = fs.readFileSync(filePath);
  return 'sha256:' + crypto.createHash('sha256').update(new Uint8Array(content)).digest('hex');
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
  const inventory = fs.readFileSync(inventoryArg as string, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const idToPath = new Map<string, string>();
  for (const entry of inventory) {
    idToPath.set(entry.fileId, entry.targetPath);
  }

  // Read manifest to get finalHashes
  // Select latest terminal entry by fileId for PUBLISHED entries
  const manifests = fs.readFileSync(manifestArg as string, 'utf-8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  
  const latestPublished = new Map<string, any>();
  for (const entry of manifests) {
    if (entry.status === 'PUBLISHED') {
      // Assuming ordered chronologically in jsonl, so later overwrites earlier
      latestPublished.set(entry.fileId, entry);
    }
  }

  let verified = 0;
  let missing = 0;
  let mismatched = 0;
  let unverifiable = 0;

  for (const [fileId, entry] of latestPublished.entries()) {
    const sourcePath = idToPath.get(fileId);
    if (!sourcePath) {
      console.error(`[MANIFEST_AMBIGUOUS] Cannot resolve target path for fileId ${fileId}`);
      unverifiable++;
      continue;
    }

    if (!entry.finalHash) {
      console.error(`[MANIFEST_MISSING_FINAL_HASH] fileId ${fileId} lacks finalHash in manifest`);
      unverifiable++;
      continue;
    }

    try {
      const currentHash = hashFile(sourcePath);
      if (currentHash !== entry.finalHash) {
        console.error(`[POST_PUBLICATION_MODIFICATION] ${sourcePath}`);
        console.error(`  Expected (manifest): ${entry.finalHash}`);
        console.error(`  Got (disk):          ${currentHash}`);
        mismatched++;
      } else {
        verified++;
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

  const results = {
    verified,
    missing,
    mismatched,
    unverifiable,
    status: (missing > 0 || mismatched > 0 || unverifiable > 0) ? 'FAILED' : 'PASSED'
  };

  console.log(JSON.stringify(results, null, 2));

  if (failOnMismatch && results.status === 'FAILED') {
    process.exit(1);
  }
}

verify();
