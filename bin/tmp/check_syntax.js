const fs = require('fs');
const path = process.argv[2];
if (!path) { console.error('Usage: node check_syntax.js <file>'); process.exit(2); }
const lines = fs.readFileSync(path,'utf8').split(/\r?\n/);
let buf = '';
for (let i = 0; i < lines.length; i++) {
  buf += lines[i] + '\n';
  try {
    const wrapped = '(function(){\n' + buf + '\n})();';
    new Function(wrapped);
  } catch (e) {
    console.log('FAIL_AT', i+1, ':', lines[i]);
    console.log(e && e.message || String(e));
    process.exit(1);
  }
}
console.log('OK');
