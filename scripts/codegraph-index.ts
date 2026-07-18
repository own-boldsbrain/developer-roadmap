import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

function generateReport() {
  const startTime = Date.now();
  let status = 'PASSED';
  let stdout = '';
  let stderr = '';
  let durationMs = 0;

  try {
    stdout = execSync('pnpm exec codegraph index .', { encoding: 'utf-8' });
  } catch (error: any) {
    status = 'FAILED';
    stdout = error.stdout?.toString() || '';
    stderr = error.stderr?.toString() || error.message;
  }

  durationMs = Date.now() - startTime;

  // Extract metrics from stdout
  // e.g. "Indexed 804 files"
  let filesIndexed = 0;
  const matchIndexed = stdout.match(/Indexed (\d+) files/);
  if (matchIndexed) {
    filesIndexed = parseInt(matchIndexed[1], 10);
  }

  // Get git commit
  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (e) {
    // Ignore
  }

  // Calculate db hash
  let databaseHash = '';
  const dbPath = path.join('.codegraph', 'codegraph.db');
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    databaseHash = `sha256:${hashSum.digest('hex')}`;
  } else {
    status = 'FAILED';
  }

  // Get tool version
  let toolVersion = 'unknown';
  try {
    const pkgStr = fs.readFileSync('package.json', 'utf-8');
    const pkg = JSON.parse(pkgStr);
    toolVersion =
      pkg.devDependencies['@colbymchenry/codegraph']?.replace(/[^0-9.]/g, '') ||
      'unknown';
  } catch (e) {
    // Ignore
  }

  const runId = `codegraph-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  const report = {
    runId,
    gitCommit,
    tool: '@colbymchenry/codegraph',
    toolVersion,
    filesDiscovered: filesIndexed, // Simplified, assume discovered = indexed for this tool unless parsing is deeper
    filesIndexed,
    failed: status === 'FAILED' ? 1 : 0,
    durationMs,
    databaseHash,
    status,
  };

  const reportsDir = '.codegraph-reports';
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const reportPath = path.join(reportsDir, 'index-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Report generated at ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));

  if (status === 'FAILED') {
    console.error('CodeGraph indexing failed:');
    console.error(stderr);
    process.exit(1);
  }
}

generateReport();
