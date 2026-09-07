const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const root = path.join(__dirname, '..');

test('Vercel function imports without a DOM, database configuration, or listener', () => {
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', "const {default:handler}=await import('./api/index.mjs'); if(typeof handler!=='function')throw Error('Missing export'); console.log('import-ok');"], {
    cwd: root, timeout: 5000, env: { ...process.env, VERCEL: '1', TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '' }
  }).toString();
  assert.match(output, /import-ok/);
});

test('Only public assets are published and API rewrites preserve the requested path', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json')));
  assert.equal(config.framework, null);
  assert.equal(config.outputDirectory, 'public');
  assert.deepEqual(fs.readdirSync(path.join(root, 'public')).sort(), ['app.js', 'index.html', 'veli-formu.html', 'veli-formu.js']);
  assert.equal(config.rewrites.find(r => r.source === '/api/:path*').destination, '/api/index?route=:path*');
  assert.equal(config.rewrites.find(r => r.source === '/veli-formu').destination, '/veli-formu.html');
  assert.ok(fs.readFileSync(path.join(root, 'public/index.html'), 'utf8').includes('src="/app.js"'));
  assert.ok(fs.readFileSync(path.join(root, 'public/veli-formu.html'), 'utf8').includes('src="veli-formu.js"'));
});

test('The separate parent portal publishes no MTSS application assets', () => {
  const portal = path.join(root, 'parent-portal');
  const config = JSON.parse(fs.readFileSync(path.join(portal, 'vercel.json')));
  assert.equal(config.outputDirectory, 'public');
  assert.deepEqual(fs.readdirSync(path.join(portal, 'public')).sort(), ['app.js', 'index.html']);
  assert.equal(config.rewrites.find(r => r.source === '/').destination, '/index.html');
  const html = fs.readFileSync(path.join(portal, 'public/index.html'), 'utf8');
  assert.ok(html.includes('Veli Bilgi Formu'));
  assert.ok(!html.includes('MTSS'));
  assert.ok(!fs.readFileSync(path.join(portal, 'public/app.js'), 'utf8').includes('/api/login'));
});

test('Existing Nazmi five-year-old students migrate to class A', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mtss-five-year-migration-'));
  const { createDatabase, initialize } = require('../server/database.cjs');
  const db = createDatabase({ DATA_DIR: folder });
  try {
    await initialize(db, { DATA_DIR: folder });
    await db.run('UPDATE students SET classId=? WHERE id=?', 'nazmi-anaokulu5yas', 'ana5-0');
    await initialize(db, { DATA_DIR: folder });
    assert.equal((await db.get('SELECT classId FROM students WHERE id=?', 'ana5-0')).classId, 'nazmi-anaokulu5yasa');
  } finally {
    db.close();
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('Vercel never silently falls back to temporary SQLite storage', () => {
  const { createDatabase } = require('../server/database.cjs');
  assert.throws(() => createDatabase({ VERCEL: '1' }), e => e.status === 503 && /TURSO_DATABASE_URL/.test(e.message));
  assert.throws(() => createDatabase({ VERCEL: '1', TURSO_DATABASE_URL: 'file:/tmp/test.sqlite', TURSO_AUTH_TOKEN: 'test' }), e => e.status === 503);
});

test('Missing cloud configuration returns actionable JSON rather than crashing the runtime', async () => {
  const previous = { VERCEL: process.env.VERCEL, TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL, TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN };
  process.env.VERCEL = '1'; delete process.env.TURSO_DATABASE_URL; delete process.env.TURSO_AUTH_TOKEN;
  try {
    const handler = require('../server/handler.cjs');
    const req = Object.assign(Readable.from([]), { url: '/api/session', method: 'GET', headers: {} });
    let status, value;
    const res = { setHeader() {}, writeHead(code) { status = code; }, end(bytes) { value = JSON.parse(bytes); } };
    await handler(req, res);
    assert.equal(status, 503); assert.match(value.error, /TURSO_DATABASE_URL/);
  } finally { for (const [key, value] of Object.entries(previous)) value === undefined ? delete process.env[key] : process.env[key] = value; }
});
