const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { classes, teachers } = require('./seed.cjs');
const { workbook } = require('./xlsx.cjs');
const folder = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(folder, { recursive: true });
const db = new DatabaseSync(path.join(folder, 'rehberlik.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS accounts(username TEXT PRIMARY KEY, salt TEXT, hash TEXT);
CREATE TABLE IF NOT EXISTS students(id TEXT PRIMARY KEY, classId TEXT, name TEXT, birthDate TEXT, gender TEXT, parentName TEXT, phone TEXT);
CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, studentId TEXT, kind TEXT, teacher TEXT, day TEXT, date TEXT, type TEXT, note TEXT, createdAt TEXT);
CREATE TABLE IF NOT EXISTS meetings(id TEXT PRIMARY KEY, studentId TEXT, kind TEXT, date TEXT, participant TEXT, subject TEXT, note TEXT, createdAt TEXT);`);
if (!db.prepare('SELECT 1 FROM accounts LIMIT 1').get()) {
  const salt = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO accounts VALUES(?,?,?)').run('ilaydahisarbeyli', salt, crypto.scryptSync(process.env.EDITOR_PASSWORD || '123456', salt, 64).toString('hex'));
}
const insert = db.prepare('INSERT OR IGNORE INTO students VALUES(?,?,?,?,?,?,?)');
classes.forEach((c, ci) => c.students.forEach((name, i) => {
  const year = 2026 - (ci < 3 ? ci + 3 : 6);
  insert.run(`${c.id}-${i}`, c.id, name, `${year}-${String((i % 8) + 1).padStart(2,'0')}-${String(i + 5).padStart(2,'0')}`, 'Belirtilmedi', '', '');
}));
const sessions = new Map();
const attempts = new Map();
function json(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); }
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function required(value, name, max=10000) { if(typeof value !== 'string' || !value.trim() || value.length > max) fail(400, `${name} alanını kontrol edin.`); return value.trim(); }
function date(value) { required(value, 'Tarih', 10); if(!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail(400, 'Geçerli bir tarih girin.'); return value; }
async function body(req) { let s=''; for await (const chunk of req) { s += chunk; if(s.length>65536) fail(413,'Kayıt çok uzun.'); } try { return JSON.parse(s || '{}'); } catch { fail(400,'Geçersiz istek.'); } }
function session(req) { const token=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('session='))?.slice(8); const s=sessions.get(token); if(s && s.expires > Date.now()) return { ...s, token }; if(token) sessions.delete(token); return null; }
function editor(s) { if(s?.role !== 'editor') fail(403,'Bu işlem için düzenleyici girişi gereklidir.'); }
function student(id) { const s=db.prepare('SELECT * FROM students WHERE id=?').get(id); if(!s) fail(404,'Öğrenci bulunamadı.'); return s; }
function records() { return db.prepare('SELECT r.*, s.name AS student, s.classId FROM records r JOIN students s ON s.id=r.studentId ORDER BY r.createdAt DESC').all().map(r=>({...r,className:classes.find(c=>c.id===r.classId).name})); }
const server = http.createServer(async (req,res) => {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try {
    const url=new URL(req.url, 'http://localhost');
    const route=url.pathname;
    if(['POST','DELETE','PUT'].includes(req.method)) {
      if(req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}`) fail(403,'Geçersiz kaynak.');
      if(req.headers['sec-fetch-site']==='cross-site') fail(403,'Geçersiz kaynak.');
      if(!req.headers['content-type']?.startsWith('application/json')) fail(415,'JSON gereklidir.');
    }
    const s=session(req);
    if(route==='/api/session' && req.method==='GET') return json(res,200,{role:s?.role || null});
    if(route==='/api/login' && req.method==='POST') {
      const b=await body(req); let role='guest';
      if(b.guest !== true) {
        const key=req.socket.remoteAddress; const a=attempts.get(key);
        if(a && a.until > Date.now() && a.count>=10) fail(429,'Çok fazla deneme. 5 dakika sonra tekrar deneyin.');
        const account=typeof b.username==='string' ? db.prepare('SELECT * FROM accounts WHERE username=?').get(b.username) : null;
        if(!account || typeof b.password!=='string' || b.password.length>200 || !crypto.timingSafeEqual(crypto.scryptSync(b.password,account.salt,64),Buffer.from(account.hash,'hex'))) {
          const next=a && a.until>Date.now() ? a : {count:0,until:Date.now()+300000}; next.count++; attempts.set(key,next); fail(401,'Kullanıcı adı veya şifre hatalı.');
        }
        attempts.delete(key); role='editor';
      }
      if(s) sessions.delete(s.token);
      const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,{role,expires:Date.now()+8*60*60*1000});
      res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
      return json(res,200,{role});
    }
    if(route==='/api/logout' && req.method==='POST') { if(s) sessions.delete(s.token); res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); return json(res,200,{ok:true}); }
    if(route.startsWith('/api/')) {
      if(!s) fail(401,'Lütfen giriş yapın.');
      if(route==='/api/data' && req.method==='GET') return json(res,200,{classes:classes.map(({id,name})=>({id,name})),teachers,students:db.prepare('SELECT * FROM students').all(),records:records()});
      const sm=route.match(/^\/api\/students\/([^/]+)$/);
      if(sm && req.method==='PUT') {
        editor(s); student(sm[1]); const b=await body(req);
        if(!['Kız','Erkek','Belirtilmedi'].includes(b.gender)) fail(400,'Cinsiyet seçimini kontrol edin.');
        if(b.birthDate && date(b.birthDate)>new Date().toISOString().slice(0,10)) fail(400,'Doğum tarihi gelecekte olamaz.');
        for(const k of ['parentName','phone']) if(typeof b[k]!=='string'|| b[k].length>200) fail(400,'Veli bilgilerini kontrol edin.');
        db.prepare('UPDATE students SET birthDate=?,gender=?,parentName=?,phone=? WHERE id=?').run(b.birthDate || '',b.gender,b.parentName.trim(),b.phone.trim(),sm[1]);
        return json(res,200,{ok:true});
      }
      if(route==='/api/records' && req.method==='POST') {
        const b=await body(req); student(b.studentId);
        if(!['observation','parent'].includes(b.kind)) fail(400,'Form türü geçersiz.');
        if(!teachers.includes(b.teacher)) fail(400,'Öğretmen seçin.');
        const id=crypto.randomUUID();
        db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?)').run(id,b.studentId,b.kind,b.teacher,b.kind==='observation'?required(b.day,'Gün',30):'',date(b.date),required(b.type,'Tür',100),required(b.note,'Form içeriği'),new Date().toISOString());
        return json(res,201,{id});
      }
      if(route==='/api/meetings') {
        editor(s);
        if(req.method==='GET') { const id=url.searchParams.get('studentId'); student(id); return json(res,200,db.prepare('SELECT * FROM meetings WHERE studentId=? ORDER BY date DESC,createdAt DESC').all(id)); }
        if(req.method==='POST') {
          const b=await body(req); student(b.studentId); if(!['student','parent'].includes(b.kind)) fail(400,'Görüşme türü geçersiz.');
          const id=crypto.randomUUID(); db.prepare('INSERT INTO meetings VALUES(?,?,?,?,?,?,?,?)').run(id,b.studentId,b.kind,date(b.date),required(b.participant,'Katılımcı',200),required(b.subject,'Konu',200),required(b.note,'Görüşme notu'),new Date().toISOString()); return json(res,201,{id});
        }
      }
      const mm=route.match(/^\/api\/meetings\/([^/]+)$/);
      if(mm && req.method==='DELETE') { editor(s); const result=db.prepare('DELETE FROM meetings WHERE id=?').run(mm[1]); if(!result.changes) fail(404,'Görüşme bulunamadı.'); return json(res,200,{ok:true}); }
      if(route==='/api/export' && req.method==='GET') {
        const rows=records().filter(r=>(!url.searchParams.get('classId')||r.classId===url.searchParams.get('classId')) && (!url.searchParams.get('teacher')||r.teacher===url.searchParams.get('teacher')) && (!url.searchParams.get('q')||`${r.student} ${r.note} ${r.type}`.toLocaleLowerCase('tr').includes(url.searchParams.get('q').toLocaleLowerCase('tr'))));
        const bytes=workbook([['Sınıf','Öğrenci','Form','Öğretmen','Gün','Tarih','Tür','Açıklama'],...rows.map(r=>[r.className,r.student,r.kind==='parent'?'Veli bilgi formu':'Öğretmen gözlem formu',r.teacher,r.day,r.date,r.type,r.note])]);
        res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="rehberlik-kayitlari.xlsx"'}); return res.end(bytes);
      }
      fail(404,'İşlem bulunamadı.');
    }
    const files={'/':'preview.html','/preview.html':'preview.html','/app.js':'app.js'};
    if(req.method!=='GET'||!files[route]) fail(404,'Sayfa bulunamadı.');
    res.setHeader('Content-Type',route==='/app.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8'); res.end(fs.readFileSync(path.join(__dirname,files[route])));
  } catch(e) { if(!e.status) console.error(e); json(res,e.status || 500,{error:e.status?e.message:'Kayıt işlenemedi. Lütfen tekrar deneyin.'}); }
});
server.listen(Number(process.env.PORT || 3000),process.env.HOST || '127.0.0.1',()=>console.log(`Rehberlik platformu: http://localhost:${server.address().port}`));
