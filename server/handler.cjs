const crypto = require('node:crypto');
const { schools, classes, teachers } = require('../seed.cjs');
const { rubricScale, rubricCriteria, rubricSections } = require('./observation-form.cjs');
const { workbook } = require('../xlsx.cjs');
const { getDatabase } = require('./database.cjs');
const { editorProfile, canAccessClass, publicEditorProfile } = require('./editor-accounts.cjs');
const interviewSubjects = ['Genel Görüşme', 'Akademik', 'Sosyal-Duygusal', 'Davranış', 'Akran İlişkileri', 'Uyum Süreci', 'Devamsızlık / Okula Katılım', 'Diğer'];
const parentRelationships = ['Anne', 'Baba', 'Vasi / Diğer'];
const parentPortalOrigin = process.env.PARENT_PORTAL_ORIGIN || 'https://veli-bilgi-formlari-kagithane.vercel.app';
const parentFormQuestions = [
  { id: 'strengths', label: 'Çocuğunuzun güçlü yönleri nelerdir?', required: true, max: 2000 },
  { id: 'supportNeeds', label: 'En çok hangi alanlarda desteğe ihtiyaç duyuyor?', required: true, max: 2000 },
  { id: 'homeRoutine', label: 'Evdeki ders ve etkinlik çalışma düzenini kısaca anlatır mısınız?', required: true, max: 2000 },
  { id: 'schoolNotes', label: 'Okulla paylaşmak istediğiniz başka bir bilgi var mı?', required: false, max: 3000 }
];

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
function clock(value, mandatory = false) {
  if (!value && !mandatory) return '';
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) fail(400, 'Görüşme saatini kontrol edin.');
  return value;
}
function optionalText(value, name, max) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > max) fail(400, `${name} alanını kontrol edin.`);
  return value.trim();
}
function normalizeLookup(value) {
  return String(value || '').trim().toLocaleLowerCase('tr').replaceAll('ı', 'i').replaceAll('ş', 's').replaceAll('ğ', 'g').replaceAll('ü', 'u').replaceAll('ö', 'o').replaceAll('ç', 'c').replace(/[^a-z0-9]+/g, '');
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
  return await db.get('SELECT tokenHash, role, username, expires FROM sessions_v2 WHERE tokenHash=? AND expires>?', tokenHash(token), Date.now()) || null;
}
function editor(s) { if (s?.role !== 'editor') fail(403, 'Bu işlem için düzenleyici girişi gereklidir.'); }
function visibleClasses(s, schoolId) {
  const values = classes.filter(item => item.schoolId === schoolId);
  return s?.role === 'editor' ? values.filter(item => canAccessClass(s.username, item)) : values;
}
function authorizeClass(s, classId) {
  if (s?.role !== 'editor') return;
  const classItem = classes.find(item => item.id === classId);
  if (!classItem || !canAccessClass(s.username, classItem)) fail(403, 'Bu sınıf için düzenleyici yetkiniz yok.');
}
async function student(db, id, s) {
  required(id, 'Öğrenci', 100);
  const value = await db.get('SELECT * FROM students WHERE id=?', id);
  if (!value) fail(404, 'Öğrenci bulunamadı.');
  authorizeClass(s, value.classId);
  return value;
}
function selectedSchool(id) {
  const value = schools.find(item => item.id === id);
  if (!value) fail(400, 'Geçerli bir okul seçin.');
  return value;
}
function placeholders(values) { return values.map(() => '?').join(','); }
function rubricAnswer(value) {
  const option = rubricScale.find(item => item.value === value);
  return option ? `${option.value} — ${option.label}` : value || '—';
}
function displayNote(record) {
  if (record.kind === 'observation') {
    try {
      const value = JSON.parse(record.note);
      if (value.version !== 1) return record.note;
      return `Gözlem: ${value.note}\nNe zamandır / ne sıklıkta: ${value.frequency}\nDaha önce yapılanlar: ${value.previousActions}`;
    } catch { return record.note; }
  }
  try {
    const value = JSON.parse(record.note);
    const ratings = rubricCriteria.map(item => `${item.code} — ${item.area}\nSoru: ${item.behavior}\nCevap: ${rubricAnswer(value.ratings[item.code])}`).join('\n\n');
    return value.note ? `${ratings}\nGenel not: ${value.note}` : ratings;
  } catch { return 'MTSS öğrenci takip formu yanıtı'; }
}
async function schoolStudents(db, classItems) {
  const ids = classItems.map(item => item.id);
  if (!ids.length) return [];
  return db.all(`SELECT * FROM students WHERE classId IN (${placeholders(ids)})`, ...ids);
}
async function records(db, classItems) {
  const ids = classItems.map(item => item.id);
  if (!ids.length) return [];
  return (await db.all(`SELECT r.*, s.name AS student, s.classId FROM records r JOIN students s ON s.id=r.studentId WHERE r.kind IN ('observation','rubric') AND s.classId IN (${placeholders(ids)}) ORDER BY r.createdAt DESC`, ...ids))
    .map(r => ({ ...r, className: classes.find(c => c.id === r.classId).name, displayNote: displayNote(r) }));
}
async function scopedInterviews(db, classItems, targetStudentId = '') {
  const classIds = classItems.map(item => item.id);
  if (!classIds.length) return [];
  const links = await db.all(`SELECT l.interviewId,l.studentId,l.isPrimary,s.name,s.classId FROM interview_students l JOIN students s ON s.id=l.studentId WHERE s.classId IN (${placeholders(classIds)}) ORDER BY l.isPrimary DESC,s.name`, ...classIds);
  const eventIds = [...new Set((targetStudentId ? links.filter(link => link.studentId === targetStudentId) : links).map(link => link.interviewId))];
  if (!eventIds.length) return [];
  const events = await db.all(`SELECT * FROM interviews WHERE id IN (${placeholders(eventIds)}) ORDER BY date DESC,time DESC,createdAt DESC`, ...eventIds);
  return events.map(event => ({ ...event, students: links.filter(link => link.interviewId === event.id).map(link => ({ id: link.studentId, name: link.name, classId: link.classId, isPrimary: Boolean(link.isPrimary) })) }));
}
async function createInterview(db, s, value) {
  editor(s);
  const studentIds = [...new Set((Array.isArray(value.studentIds) ? value.studentIds : [value.studentId]).filter(id => typeof id === 'string' && id))];
  if (!studentIds.length || studentIds.length > 40) fail(400, 'Görüşmedeki öğrencileri kontrol edin.');
  for (const id of studentIds) await student(db, id, s);
  const status = value.status || 'completed';
  const format = value.format || 'individual';
  if (!['completed', 'appointment'].includes(status)) fail(400, 'Görüşme durumunu kontrol edin.');
  if (!['individual', 'group'].includes(format)) fail(400, 'Görüşme biçimini kontrol edin.');
  if (format === 'individual' && studentIds.length !== 1) fail(400, 'Bireysel görüşme için bir öğrenci seçin.');
  if (format === 'group' && studentIds.length < 2) fail(400, 'Grup çalışması için en az iki öğrenci seçin.');
  if (status === 'appointment' && format !== 'individual') fail(400, 'Randevular bireysel olarak eklenir.');
  if (!['student', 'parent'].includes(value.kind)) fail(400, 'Görüşme türünü kontrol edin.');
  const id = crypto.randomUUID(), interviewDate = date(value.date), interviewTime = clock(value.time, status === 'appointment');
  const subject = required(value.subject, 'Görüşme konusu', 200);
  if (!value.allowCustomSubject && !interviewSubjects.includes(subject)) fail(400, 'Görüşme konusunu kontrol edin.');
  const note = status === 'completed' ? required(value.note, 'Görüşme içeriği', 3000) : optionalText(value.note, 'Randevu notu', 3000);
  const participant = optionalText(value.participant, 'Görüşülen kişi', 200);
  await db.batch([
    { sql: 'INSERT INTO interviews VALUES(?,?,?,?,?,?,?,?,?,?,?)', args: [id, value.kind, format, status, interviewDate, interviewTime, participant, subject, note, s.username, new Date().toISOString()] },
    ...studentIds.map((studentId, index) => ({ sql: 'INSERT INTO interview_students VALUES(?,?,?)', args: [id, studentId, index === 0 ? 1 : 0] }))
  ]);
  return id;
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
function publicParentFormSetup() {
  return { schools: schools.map(({ id, name }) => ({ id, name })), relationships: parentRelationships, questions: parentFormQuestions.map(({ id, label, required }) => ({ id, label, required })) };
}
function parseParentFormAnswers(raw) {
  let value = {};
  try { value = JSON.parse(raw); } catch {}
  return parentFormQuestions.map(question => ({ id: question.id, label: question.label, value: typeof value[question.id] === 'string' ? value[question.id] : '' }));
}
async function handler(req, res) {
  setHeaders(res);
  try {
    const url = new URL(req.url, 'http://localhost');
    // Accept both Vercel's rewritten URL and the original API URL.
    const route = url.pathname === '/api/index' && url.searchParams.has('route')
      ? '/api/' + url.searchParams.get('route') : url.pathname;
    if (!route.startsWith('/api/')) fail(404, 'İşlem bulunamadı.');
    const parentFormRoute = route === '/api/parent-form';
    const parentPortalRequest = parentFormRoute && req.headers.origin === parentPortalOrigin;
    if (parentPortalRequest) {
      res.setHeader('Access-Control-Allow-Origin', parentPortalOrigin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Vary', 'Origin');
    }
    if (parentFormRoute && req.method === 'OPTIONS') {
      if (!parentPortalRequest) fail(403, 'Geçersiz kaynak.');
      res.writeHead(204); return res.end();
    }
    if (['POST', 'DELETE', 'PUT'].includes(req.method)) {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}` && !parentPortalRequest) fail(403, 'Geçersiz kaynak.');
      if (req.headers['sec-fetch-site'] === 'cross-site' && !parentPortalRequest) fail(403, 'Geçersiz kaynak.');
      if (!req.headers['content-type']?.startsWith('application/json')) fail(415, 'JSON gereklidir.');
    }
    // Lazy initialization: importing the function never opens SQLite or accesses the DOM.
    const db = await getDatabase();
    const s = await session(req, db);
    if (route === '/api/parent-form' && req.method === 'GET') return json(res, 200, publicParentFormSetup());
    if (route === '/api/parent-form' && req.method === 'POST') {
      const b = await body(req);
      if (b.website) return json(res, 201, { ok: true });
      const school = selectedSchool(b.schoolId);
      const className = required(b.className, 'Sınıf', 100), studentName = required(b.studentName, 'Öğrenci adı', 200);
      const classItem = classes.find(item => item.schoolId === school.id && normalizeLookup(item.name) === normalizeLookup(className));
      const candidates = classItem ? await db.all('SELECT id,name FROM students WHERE classId=?', classItem.id) : [];
      const matches = candidates.filter(item => normalizeLookup(item.name) === normalizeLookup(studentName));
      if (!classItem || matches.length !== 1) fail(404, 'Okul, sınıf veya öğrenci adı kayıtlarla eşleşmedi. Lütfen bilgileri kontrol edin.');
      const respondentName = required(b.respondentName, 'Veli adı soyadı', 200);
      if (!parentRelationships.includes(b.relationship)) fail(400, 'Yakınlık seçimini kontrol edin.');
      if (!b.answers || typeof b.answers !== 'object' || Array.isArray(b.answers)) fail(400, 'Form yanıtlarını kontrol edin.');
      const answers = {};
      for (const question of parentFormQuestions) answers[question.id] = question.required ? required(b.answers[question.id], question.label, question.max) : optionalText(b.answers[question.id], question.label, question.max);
      const id = crypto.randomUUID();
      await db.run('INSERT INTO parent_forms VALUES(?,?,?,?,?,?)', id, matches[0].id, respondentName, b.relationship, JSON.stringify(answers), new Date().toISOString());
      return json(res, 201, { ok: true });
    }
    if (route === '/api/session' && req.method === 'GET') return json(res, 200, { role: s?.role || null, user: s?.role === 'editor' ? publicEditorProfile(s.username) : null });
    if (route === '/api/login' && req.method === 'POST') {
      const b = await body(req); let role = 'guest', username = '';
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
        username = typeof b.username === 'string' ? b.username.trim().toLocaleLowerCase('tr') : '';
        const account = editorProfile(username) ? await db.get('SELECT * FROM accounts WHERE username=?', username) : null;
        if (!account || typeof b.password !== 'string' || b.password.length > 200 || !crypto.timingSafeEqual(crypto.scryptSync(b.password, account.salt, 64), Buffer.from(account.hash, 'hex'))) fail(401, 'Kullanıcı adı veya şifre hatalı.');
        await db.run('DELETE FROM login_attempts WHERE key=?', key);
        role = 'editor';
      }
      const token = crypto.randomBytes(32).toString('hex');
      await db.batch([
        { sql: 'DELETE FROM sessions_v2 WHERE expires<=?', args: [Date.now()] },
        ...(s ? [{ sql: 'DELETE FROM sessions_v2 WHERE tokenHash=?', args: [s.tokenHash] }] : []),
        { sql: 'INSERT INTO sessions_v2 VALUES(?,?,?,?)', args: [tokenHash(token), role, username, Date.now() + 8 * 60 * 60 * 1000] }
      ]);
      res.setHeader('Set-Cookie', cookie(req, token, 28800));
      return json(res, 200, { role, user: role === 'editor' ? publicEditorProfile(username) : null });
    }
    if (route === '/api/logout' && req.method === 'POST') {
      if (s) await db.run('DELETE FROM sessions_v2 WHERE tokenHash=?', s.tokenHash);
      res.setHeader('Set-Cookie', cookie(req, '', 0));
      return json(res, 200, { ok: true });
    }
    if (!s) fail(401, 'Lütfen giriş yapın.');
    if (route === '/api/schools' && req.method === 'GET') {
      return json(res, 200, schools.map(item => ({ ...item, classCount: visibleClasses(s, item.id).length })).filter(item => item.classCount));
    }
    if (route === '/api/data' && req.method === 'GET') {
      // Keep already-open browser tabs working while a new frontend deployment rolls out.
      const school = selectedSchool(url.searchParams.get('schoolId') || schools[0].id);
      const allowedClasses = visibleClasses(s, school.id);
      if (!allowedClasses.length) fail(403, 'Bu okulda erişebileceğiniz bir sınıf yok.');
      return json(res, 200, { school, classes: allowedClasses.map(({ id, name }) => ({ id, name })), teachers, rubricScale, rubricCriteria, rubricSections, students: await schoolStudents(db, allowedClasses), records: s.role === 'editor' ? await records(db, allowedClasses) : [] });
    }
    const sm = route.match(/^\/api\/students\/([^/]+)$/);
    if (sm && req.method === 'PUT') {
      editor(s); await student(db, sm[1], s); const b = await body(req);
      if (!['Kız', 'Erkek', 'Belirtilmedi'].includes(b.gender)) fail(400, 'Cinsiyet seçimini kontrol edin.');
      if (b.birthDate && date(b.birthDate) > new Date().toISOString().slice(0, 10)) fail(400, 'Doğum tarihi gelecekte olamaz.');
      for (const k of ['parentName', 'phone']) if (typeof b[k] !== 'string' || b[k].length > 200) fail(400, 'Veli bilgilerini kontrol edin.');
      await db.run('UPDATE students SET birthDate=?,gender=?,parentName=?,phone=? WHERE id=?', b.birthDate || '', b.gender, b.parentName.trim(), b.phone.trim(), sm[1]);
      return json(res, 200, { ok: true });
    }
    if (route === '/api/records' && req.method === 'POST') {
      const b = await body(req); await student(db, b.studentId, s);
      if (!['observation', 'rubric'].includes(b.kind)) fail(400, 'Form türü geçersiz.');
      if (!teachers.includes(b.teacher)) fail(400, 'Öğretmen seçin.');
      let day, type, note;
      if (b.kind === 'observation') {
        day = '';
        type = required(b.type, 'Tür', 100);
        if (!['Genel Gözlem', 'Akademik', 'Sosyal-Duygusal', 'Davranış', 'Akran İlişkileri', 'Uyum Süreci', 'Devamsızlık / Okula Katılım', 'Diğer'].includes(type)) fail(400, 'Gözlem türünü kontrol edin.');
        note = JSON.stringify({ version: 1, note: required(b.note, 'Form içeriği'), frequency: required(b.frequency, 'Gözlem sıklığı', 1000), previousActions: required(b.previousActions, 'Daha önce yapılanlar', 5000) });
      } else {
        if (!b.ratings || typeof b.ratings !== 'object' || Array.isArray(b.ratings)) fail(400, 'Gözlem düzeylerini işaretleyin.');
        const allowed = rubricScale.map(item => item.value);
        const ratings = {};
        for (const item of rubricCriteria) {
          if (!allowed.includes(b.ratings[item.code])) fail(400, `${item.code} için bir düzey seçin.`);
          ratings[item.code] = b.ratings[item.code];
        }
        if (typeof b.note !== 'string' || b.note.length > 5000) fail(400, 'Genel not alanını kontrol edin.');
        day = '';
        type = 'MTSS Öğrenci Takip Formu';
        note = JSON.stringify({ ratings, note: b.note.trim() });
      }
      const id = crypto.randomUUID();
      await db.run('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?)', id, b.studentId, b.kind, b.teacher, day, date(b.date), type, note, new Date().toISOString());
      return json(res, 201, { id });
    }
    if (route === '/api/parent-forms' && req.method === 'GET') {
      editor(s);
      const target = await student(db, url.searchParams.get('studentId'), s);
      const rows = await db.all('SELECT * FROM parent_forms WHERE studentId=? ORDER BY createdAt DESC', target.id);
      return json(res, 200, rows.map(row => ({ id: row.id, respondentName: row.respondentName, relationship: row.relationship, createdAt: row.createdAt, answers: parseParentFormAnswers(row.answers) })));
    }
    if (route === '/api/interviews') {
      editor(s);
      if (req.method === 'GET') {
        const school = selectedSchool(url.searchParams.get('schoolId') || schools[0].id);
        const allowedClasses = visibleClasses(s, school.id);
        if (!allowedClasses.length) fail(403, 'Bu okulda erişebileceğiniz bir sınıf yok.');
        return json(res, 200, await scopedInterviews(db, allowedClasses));
      }
      if (req.method === 'POST') {
        const id = await createInterview(db, s, await body(req));
        return json(res, 201, { id });
      }
    }
    if (route === '/api/meetings') {
      editor(s);
      if (req.method === 'GET') {
        const id = url.searchParams.get('studentId'), target = await student(db, id, s);
        const classItem = classes.find(item => item.id === target.classId);
        return json(res, 200, await scopedInterviews(db, visibleClasses(s, classItem.schoolId), id));
      }
      if (req.method === 'POST') {
        const b = await body(req);
        const id = await createInterview(db, s, { ...b, studentIds: [b.studentId], format: 'individual', status: 'completed', allowCustomSubject: true });
        return json(res, 201, { id });
      }
    }
    const mm = route.match(/^\/api\/(?:meetings|interviews)\/([^/]+)$/);
    if (mm && req.method === 'DELETE') {
      editor(s); const event = await db.get('SELECT id FROM interviews WHERE id=?', mm[1]);
      if (!event) fail(404, 'Görüşme bulunamadı.');
      const participants = await db.all('SELECT studentId FROM interview_students WHERE interviewId=?', mm[1]);
      for (const participant of participants) await student(db, participant.studentId, s);
      await db.batch([
        { sql: 'DELETE FROM interview_students WHERE interviewId=?', args: [mm[1]] },
        { sql: 'DELETE FROM interviews WHERE id=?', args: [mm[1]] },
        { sql: 'DELETE FROM meetings WHERE id=?', args: [mm[1]] }
      ]);
      return json(res, 200, { ok: true });
    }
    if (route === '/api/export' && req.method === 'GET') {
      editor(s);
      const school = selectedSchool(url.searchParams.get('schoolId') || schools[0].id);
      const allowedClasses = visibleClasses(s, school.id);
      if (!allowedClasses.length) fail(403, 'Bu okulda erişebileceğiniz bir sınıf yok.');
      const classId = url.searchParams.get('classId') || '';
      if (classId && !allowedClasses.some(item => item.id === classId)) fail(403, 'Bu sınıf için Excel yetkiniz yok.');
      const kind = url.searchParams.get('kind') || '';
      if (kind && !['observation', 'rubric'].includes(kind)) fail(400, 'Form türünü kontrol edin.');
      const query = (url.searchParams.get('q') || '').toLocaleLowerCase('tr');
      const rows = (await records(db, allowedClasses)).filter(r => (!kind || r.kind === kind) && (!classId || r.classId === classId) && (!url.searchParams.get('teacher') || r.teacher === url.searchParams.get('teacher')) && (!query || `${r.student} ${r.displayNote} ${r.type}`.toLocaleLowerCase('tr').includes(query)));
      let sheet, filename;
      if (kind === 'rubric') {
        const answers = rows.map(r => {
          let value = { ratings: {}, note: '' };
          try { value = JSON.parse(r.note); } catch {}
          return [r.className, r.student, 'MTSS Öğrenci Takip Formu', r.teacher, r.date, ...rubricCriteria.map(item => rubricAnswer(value.ratings?.[item.code])), value.note || ''];
        });
        sheet = [['Sınıf', 'Öğrenci', 'Form', 'Öğretmen', 'Tarih', ...rubricCriteria.map(item => `${item.code} · ${item.area} — ${item.behavior}`), 'Genel not'], ...answers];
        filename = 'mtss-ogrenci-takip-formu.xlsx';
      } else {
        sheet = [['Sınıf', 'Öğrenci', 'Form', 'Öğretmen', 'Tarih', 'Tür', 'Açıklama'], ...rows.map(r => [r.className, r.student, r.kind === 'rubric' ? 'MTSS Öğrenci Takip Formu' : 'Gözlem Formu', r.teacher, r.date, r.type, r.displayNote])];
        filename = kind === 'observation' ? 'gozlem-formu.xlsx' : 'rehberlik-kayitlari.xlsx';
      }
      const bytes = workbook(sheet);
      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename}"` });
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
