const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const root = path.join(__dirname, '..');

test('PDF fonts are embedded for serverless deployments', () => {
  const source = fs.readFileSync(path.join(root, 'server', 'pdf.cjs'), 'utf8');
  assert.match(source, /pdfmake\/build\/vfs_fonts\.js/);
  assert.doesNotMatch(source, /require\.resolve\([^)]*\.ttf/);
});

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

test('Old Nazmi demo students and their records are replaced by the real roster', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mtss-real-roster-migration-'));
  const { createDatabase, initialize } = require('../server/database.cjs');
  const db = createDatabase({ DATA_DIR: folder });
  try {
    await initialize(db, { DATA_DIR: folder });
    await db.run('INSERT OR REPLACE INTO students VALUES(?,?,?,?,?,?,?)', 'ana5-0', 'nazmi-anaokulu5yas', 'DENEME ÖĞRENCİ', '2021-01-01', 'Belirtilmedi', '', '');
    await db.run('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?)', 'demo-record', 'ana5-0', 'observation', 'İlayda Hisarbeyli', '', '2026-09-01', 'Genel Gözlem', 'deneme', new Date().toISOString());
    await db.run('INSERT INTO parent_forms VALUES(?,?,?,?,?,?)', 'demo-parent', 'ana5-0', 'Deneme Veli', 'Anne', '{}', new Date().toISOString());
    await db.run('INSERT INTO interviews VALUES(?,?,?,?,?,?,?,?,?,?,?)', 'demo-interview', 'student', 'individual', 'completed', '2026-09-01', '', '', 'Deneme', 'Deneme', 'ilaydahisarbeyli', new Date().toISOString());
    await db.run('INSERT INTO interview_students VALUES(?,?,?)', 'demo-interview', 'ana5-0', 1);
    await initialize(db, { DATA_DIR: folder });
    assert.equal(await db.get('SELECT id FROM students WHERE id=?', 'ana5-0'), undefined);
    assert.equal(await db.get('SELECT id FROM records WHERE id=?', 'demo-record'), undefined);
    assert.equal(await db.get('SELECT id FROM parent_forms WHERE id=?', 'demo-parent'), undefined);
    assert.equal(await db.get('SELECT id FROM interviews WHERE id=?', 'demo-interview'), undefined);
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM students')).count, 288);
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM students WHERE classId=?', 'nazmi-anaokulu5yasa')).count, 10);
    assert.equal((await db.get('SELECT COUNT(*) AS count FROM students WHERE classId LIKE ? AND birthDate<>?', 'nazmi-%', '')).count, 0);
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
