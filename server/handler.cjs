const crypto = require('node:crypto');
const { schools, classes, teachers } = require('../seed.cjs');
const { workbook } = require('../xlsx.cjs');
const { getDatabase } = require('./database.cjs');

function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function required(value, name, max = 10000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400, `${name} alanını kontrol edin.`);
  return value.trim();
}
function date(value) {
  required(value, 'Tarih', 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(400, 'Geçerli bir tarih girin.');
  return value;
}
async function body(req) {
  let value;
  try {
    // Vercel may already have parsed/consumed the incoming JSON stream.
    value = req.body;
    if (value === undefined) {
      const chunks = []; let length = 0;
      for await (const chunk of req) {
        length += Buffer.byteLength(chunk);
        if (length > 65536) fail(413, 'Kayıt çok uzun.');
        chunks.push(Buffer.from(chunk));
      }
      value = Buffer.concat(chunks).toString('utf8') || '{}';
    }
    if (Buffer.isBuffer(value)) value = value.toString('utf8');
    if (typeof value === 'string') value = JSON.parse(value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'Geçersiz istek.');
    if (Buffer.byteLength(JSON.stringify(value)) > 65536) fail(413, 'Kayıt çok uzun.');
    return value;
  } catch (e) { if (e.status) throw e; fail(400, 'Geçersiz istek.'); }
}
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
async function session(req, db) {
  const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('session='))?.slice(8);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return await db.get('SELECT tokenHash, role, expires FROM sessions WHERE tokenHash=? AND expires>?', tokenHash(token), Date.now()) || null;
}
function editor(s) { if (s?.role !== 'editor') fail(403, 'Bu işlem için düzenleyici girişi gereklidir.'); }
async function student(db, id) {
  required(id, 'Öğrenci', 100);
  const s = await db.get('SELECT * FROM students WHERE id=?', id);
  if (!s) fail(404, 'Öğrenci bulunamadı.');
  return s;
}
function selectedSchool(id) {
  const value = schools.find(item => item.id === id);
  if (!value) fail(400, 'Geçerli bir okul seçin.');
  return value;
}
function schoolClasses(schoolId) { return classes.filter(item => item.schoolId === schoolId); }
function placeholders(values) { return values.map(() => '?').join(','); }
async function schoolStudents(db, schoolId) {
  const ids = schoolClasses(schoolId).map(item => item.id);
  return db.all(`SELECT * FROM students WHERE classId IN (${placeholders(ids)})`, ...ids);
}
async function records(db, schoolId) {
  const ids = schoolClasses(schoolId).map(item => item.id);
  return (await db.all(`SELECT r.*, s.name AS student, s.classId FROM records r JOIN students s ON s.id=r.studentId WHERE s.classId IN (${placeholders(ids)}) ORDER BY r.createdAt DESC`, ...ids))
    .map(r => ({ ...r, className: classes.find(c => c.id === r.classId).name }));
}
function cookie(req, value, maxAge) {
  const secure = process.env.VERCEL || req.socket?.encrypted;
  return `session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
function setHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}
async function handler(req, res) {
  setHeaders(res);
  try {
    const url = new URL(req.url, 'http://localhost');
    // Accept both Vercel's rewritten URL and the original API URL.
    const route = url.pathname === '/api/index' && url.searchParams.has('route')
      ? '/api/' + url.searchParams.get('route') : url.pathname;
    if (!route.startsWith('/api/')) fail(404, 'İşlem bulunamadı.');
    if (['POST', 'DELETE', 'PUT'].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) fail(403, 'Geçersiz kaynak.');
      if (req.headers['sec-fetch-site'] === 'cross-site') fail(403, 'Geçersiz kaynak.');
      if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'JSON gereklidir.');
    }
    // Lazy initialization: importing the function never opens SQLite or accesses the DOM.
    const db = await getDatabase();
    const s = await session(req, db);
    if (route === '/api/session' && req.method === 'GET') return json(res, 200, { role: s?.role || null });
    if (route === '/api/login' && req.method === 'POST') {
      const b = await body(req); let role = 'guest';
      if (b.guest !== true) {
        // Vercel supplies this header; local requests use the socket address.
        const ip = process.env.VERCEL ? req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress : req.socket?.remoteAddress;
        const key = tokenHash(String(ip || 'unknown'));
        const now = Date.now();
        await db.run('DELETE FROM login_attempts WHERE until<=?', now);
        // Increment atomically so concurrent instances cannot bypass the attempt limit.
        await db.run('INSERT INTO login_attempts(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=login_attempts.count+1', key, now + 300000);
        const attempt = await db.get('SELECT count FROM login_attempts WHERE key=?', key);
        if (attempt.count > 10) fail(429, 'Çok fazla deneme. 5 dakika sonra tekrar deneyin.');
        const account = typeof b.username === 'string' ? await db.get('SELECT * FROM accounts WHERE username=?', b.username) : null;
        if (!account || typeof b.password !== 'string' || b.password.length > 200 || !crypto.timingSafeEqual(crypto.scryptSync(b.password, account.salt, 64), Buffer.from(account.hash, 'hex'))) fail(401, 'Kullanıcı adı veya şifre hatalı.');
        await db.run('DELETE FROM login_attempts WHERE key=?', key);
        role = 'editor';
      }
      const token = crypto.randomBytes(32).toString('hex');
      await db.batch([
        { sql: 'DELETE FROM sessions WHERE expires<=?', args: [Date.now()] },
        ...(s ? [{ sql: 'DELETE FROM sessions WHERE tokenHash=?', args: [s.tokenHash] }] : []),
        { sql: 'INSERT INTO sessions VALUES(?,?,?)', args: [tokenHash(token), role, Date.now() + 8 * 60 * 60 * 1000] }
      ]);
      res.setHeader('Set-Cookie', cookie(req, token, 28800));
      return json(res, 200, { role });
    }
    if (route === '/api/logout' && req.method === 'POST') {
      if (s) await db.run('DELETE FROM sessions WHERE tokenHash=?', s.tokenHash);
      res.setHeader('Set-Cookie', cookie(req, '', 0));
      return json(res, 200, { ok: true });
    }
    if (!s) fail(401, 'Lütfen giriş yapın.');
    if (route === '/api/schools' && req.method === 'GET') {
      return json(res, 200, schools.map(item => ({ ...item, classCount: schoolClasses(item.id).length })));
    }
    if (route === '/api/data' && req.method === 'GET') {
      const school = selectedSchool(url.searchParams.get('schoolId'));
      const visibleClasses = schoolClasses(school.id);
      return json(res, 200, { school, classes: visibleClasses.map(({ id, name }) => ({ id, name })), teachers, students: await schoolStudents(db, school.id), records: await records(db, school.id) });
    }
    const sm = route.match(/^\/api\/students\/([^/]+)$/);
    if (sm && req.method === 'PUT') {
      editor(s); await student(db, sm[1]); const b = await body(req);
      if (!['Kız', 'Erkek', 'Belirtilmedi'].includes(b.gender)) fail(400, 'Cinsiyet seçimini kontrol edin.');
      if (b.birthDate && date(b.birthDate) > new Date().toISOString().slice(0, 10)) fail(400, 'Doğum tarihi gelecekte olamaz.');
      for (const k of ['parentName', 'phone']) if (typeof b[k] !== 'string' || b[k].length > 200) fail(400, 'Veli bilgilerini kontrol edin.');
      await db.run('UPDATE students SET birthDate=?,gender=?,parentName=?,phone=? WHERE id=?', b.birthDate || '', b.gender, b.parentName.trim(), b.phone.trim(), sm[1]);
      return json(res, 200, { ok: true });
    }
    if (route === '/api/records' && req.method === 'POST') {
      const b = await body(req); await student(db, b.studentId);
      if (!['observation', 'parent'].includes(b.kind)) fail(400, 'Form türü geçersiz.');
      if (!teachers.includes(b.teacher)) fail(400, 'Öğretmen seçin.');
      const id = crypto.randomUUID();
      await db.run('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?)', id, b.studentId, b.kind, b.teacher, b.kind === 'observation' ? required(b.day, 'Gün', 30) : '', date(b.date), required(b.type, 'Tür', 100), required(b.note, 'Form içeriği'), new Date().toISOString());
      return json(res, 201, { id });
    }
    if (route === '/api/meetings') {
      editor(s);
      if (req.method === 'GET') {
        const id = url.searchParams.get('studentId'); await student(db, id);
        return json(res, 200, await db.all('SELECT * FROM meetings WHERE studentId=? ORDER BY date DESC,createdAt DESC', id));
      }
      if (req.method === 'POST') {
        const b = await body(req); await student(db, b.studentId);
        if (!['student', 'parent'].includes(b.kind)) fail(400, 'Görüşme türü geçersiz.');
        const id = crypto.randomUUID();
        await db.run('INSERT INTO meetings VALUES(?,?,?,?,?,?,?,?)', id, b.studentId, b.kind, date(b.date), required(b.participant, 'Katılımcı', 200), required(b.subject, 'Konu', 200), required(b.note, 'Görüşme notu'), new Date().toISOString());
        return json(res, 201, { id });
      }
    }
    const mm = route.match(/^\/api\/meetings\/([^/]+)$/);
    if (mm && req.method === 'DELETE') {
      editor(s); const result = await db.run('DELETE FROM meetings WHERE id=?', mm[1]);
      if (!result.changes) fail(404, 'Görüşme bulunamadı.');
      return json(res, 200, { ok: true });
    }
    if (route === '/api/export' && req.method === 'GET') {
      const school = selectedSchool(url.searchParams.get('schoolId'));
      const rows = (await records(db, school.id)).filter(r => (!url.searchParams.get('classId') || r.classId === url.searchParams.get('classId')) && (!url.searchParams.get('teacher') || r.teacher === url.searchParams.get('teacher')) && (!url.searchParams.get('q') || `${r.student} ${r.note} ${r.type}`.toLocaleLowerCase('tr').includes(url.searchParams.get('q').toLocaleLowerCase('tr'))));
      const bytes = workbook([['Sınıf', 'Öğrenci', 'Form', 'Öğretmen', 'Gün', 'Tarih', 'Tür', 'Açıklama'], ...rows.map(r => [r.className, r.student, r.kind === 'parent' ? 'Veli bilgi formu' : 'Öğretmen gözlem formu', r.teacher, r.day, r.date, r.type, r.note])]);
      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="rehberlik-kayitlari.xlsx"' });
      return res.end(bytes);
    }
    fail(404, 'İşlem bulunamadı.');
  } catch (e) {
    // Do not log connection strings, tokens, or student content from driver errors.
    if (!e.status) console.error('MTSS API request failed:', e.code || e.name || 'Error');
    json(res, e.status || 500, { error: e.status ? e.message : 'Kayıt işlenemedi. Lütfen tekrar deneyin.' });
  }
}
handler.setHeaders = setHeaders;
module.exports = handler;
