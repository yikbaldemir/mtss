const crypto = require('node:crypto');
const { classes } = require('../seed.cjs');

// Both adapters expose the same asynchronous API. Only local development opens a file.
function createDatabase(env = process.env) {
  if (env.TURSO_DATABASE_URL) {
    if (!env.TURSO_AUTH_TOKEN || !/^(libsql|https):\/\//.test(env.TURSO_DATABASE_URL)) {
      throw Object.assign(new Error('TURSO_DATABASE_URL ve TURSO_AUTH_TOKEN ayarlarını kontrol edin.'), { status: 503 });
    }
    const { createClient } = require('@libsql/client/web');
    const client = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
    return {
      async all(sql, ...args) { return (await client.execute({ sql, args })).rows.map(row => ({ ...row })); },
      async get(sql, ...args) { return (await this.all(sql, ...args))[0]; },
      async run(sql, ...args) { const result = await client.execute({ sql, args }); return { changes: result.rowsAffected }; },
      async batch(statements) { await client.batch(statements, 'write'); },
      close() { client.close(); }
    };
  }
  if (env.VERCEL) {
    throw Object.assign(new Error('Kalıcı veritabanı bağlı değil. Vercel ortamında TURSO_DATABASE_URL ve TURSO_AUTH_TOKEN tanımlayın.'), { status: 503 });
  }
  const fs = require('node:fs');
  const path = require('node:path');
  const { DatabaseSync } = require('node:sqlite');
  const folder = env.DATA_DIR || path.join(__dirname, '..', 'data');
  fs.mkdirSync(folder, { recursive: true });
  const sqlite = new DatabaseSync(path.join(folder, 'rehberlik.sqlite'));
  sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  return {
    async all(sql, ...args) { return sqlite.prepare(sql).all(...args); },
    async get(sql, ...args) { return sqlite.prepare(sql).get(...args); },
    async run(sql, ...args) { return sqlite.prepare(sql).run(...args); },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        for (const statement of statements) {
          const { sql, args = [] } = typeof statement === 'string' ? { sql: statement } : statement;
          sqlite.prepare(sql).run(...args);
        }
        sqlite.exec('COMMIT');
      } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
    },
    close() { sqlite.close(); }
  };
}

async function initialize(db, env = process.env) {
  await db.batch([
    'CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY, salt TEXT, hash TEXT)',
    'CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY, classId TEXT, name TEXT, birthDate TEXT, gender TEXT, parentName TEXT, phone TEXT)',
    'CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, studentId TEXT, kind TEXT, teacher TEXT, day TEXT, date TEXT, type TEXT, note TEXT, createdAt TEXT)',
    'CREATE TABLE IF NOT EXISTS meetings(id TEXT PRIMARY KEY, studentId TEXT, kind TEXT, date TEXT, participant TEXT, subject TEXT, note TEXT, createdAt TEXT)',
    'CREATE TABLE IF NOT EXISTS sessions(tokenHash TEXT PRIMARY KEY, role TEXT NOT NULL, expires INTEGER NOT NULL)',
    'CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL)',
    'CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires)'
  ]);
  if (!await db.get('SELECT 1 FROM accounts WHERE username=?', 'ilaydahisarbeyli')) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(env.EDITOR_PASSWORD || '123456', salt, 64).toString('hex');
    // Safe if several cold starts initialize the database concurrently.
    await db.run('INSERT OR IGNORE INTO accounts VALUES(?,?,?)', 'ilaydahisarbeyli', salt, hash);
  }
  await db.batch(classes.flatMap((c, ci) => c.students.map((name, i) => ({
    sql: 'INSERT OR IGNORE INTO students VALUES(?,?,?,?,?,?,?)',
    args: [`${c.id}-${i}`, c.id, name, `${2026 - (ci < 3 ? ci + 3 : 6)}-${String((i % 8) + 1).padStart(2, '0')}-${String(i + 5).padStart(2, '0')}`, 'Belirtilmedi', '', '']
  }))));
  return db;
}

let ready;
function getDatabase() {
  if (!ready) ready = (async () => {
    const db = createDatabase();
    try { return await initialize(db); } catch (e) { db.close(); throw e; }
  })().catch(e => { ready = undefined; throw e; });
  return ready;
}
module.exports = { createDatabase, initialize, getDatabase };
