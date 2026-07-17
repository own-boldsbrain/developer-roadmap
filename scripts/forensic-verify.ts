import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const INVENTORY_PATH = path.join('.translation-control', 'inventory.jsonl');

function hashFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath);
  return 'sha256:' + crypto.createHash('sha256').update(new Uint8Array(content)).digest('hex');
}

function verify() {
  if (!fs.existsSync(INVENTORY_PATH)) {
    console.error('No inventory found.');
    process.exit(1);
  }

  const inventory = fs
    .readFileSync(INVENTORY_PATH, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  let errors = 0;
  for (const entry of inventory) {
    try {
      const currentHash = hashFile(entry.sourcePath);
      if (currentHash !== entry.fileId) {
        console.error(`[POST_PUBLICATION_MODIFICATION] ${entry.sourcePath}`);
        console.error(`  Expected: ${entry.fileId}`);
        console.error(`  Got:      ${currentHash}`);
        errors++;
      }
    } catch (e: any) {
      console.error(`[ERROR] ${entry.sourcePath}: ${e.message}`);
      errors++;
    }
  }

  if (errors > 0) {
    console.error(`\nVerification failed. ${errors} files have been modified post-inventory.`);
    process.exit(1);
  } else {
    console.log('All files verified successfully against the inventory digest.');
  }
}

verify();
