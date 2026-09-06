const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
// Static assets are source files, not server entrypoints. No code generation is needed.
for (const file of ['public/app.js', 'api/index.mjs', 'server/handler.cjs', 'server/database.cjs']) {
  execFileSync(process.execPath, ['--check', path.join(root, file)]);
}
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
if (!html.includes('src="/app.js"')) throw new Error('Browser script is missing.');
if (fs.existsSync(path.join(root, 'app.cjs'))) throw new Error('Remove the obsolete root app.cjs entrypoint; browser code belongs in public/app.js.');
console.log('MTSS 1.0 hazır: public/ statik dosyaları ve api/index.mjs sunucu fonksiyonu.');
