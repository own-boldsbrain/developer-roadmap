const fs = require('fs');
const f = 'scripts/extract-opportunities.ts';
if (fs.existsSync(f)) {
  let c = fs.readFileSync(f, 'utf8');
  if (c.includes('***REDACTED***')) {
    fs.writeFileSync(f, c.replace(/***REDACTED***/ g, '***REDACTED***'));
  }
}
