const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
for (const entry of ['server/local.cjs', 'tests/vercel-host.mjs']) test(entry + ': Oturum, yetki, formlar, görüşmeler, Excel ve kalıcılık',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rehberlik-test-'));
  let child,base;
  async function start(){child=spawn(process.execPath,[entry],{cwd:__dirname,env:{...process.env,DATA_DIR:dir,PORT:'0',VERCEL:'',TURSO_DATABASE_URL:'',TURSO_AUTH_TOKEN:'',EDITOR_PASSWORD:'123456'},stdio:['ignore','pipe','pipe']});base=await new Promise((resolve,reject)=>{let out='';child.stdout.on('data',b=>{out+=b;const m=out.match(/http:\/\/localhost:(\d+)/);if(m)resolve(`http://127.0.0.1:${m[1]}`);});child.on('error',reject);child.on('exit',code=>reject(new Error('Server exited: '+code)));});}
  async function stop(){if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
  async function request(route,method='GET',body,cookie){const r=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});const bytes=Buffer.from(await r.arrayBuffer());return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],data:r.headers.get('content-type')?.includes('json')?JSON.parse(bytes):bytes};}
  try{
    await start();
    assert.equal((await request('/api/data')).status,401);
    assert.equal((await request('/api/login','POST',{username:'ilaydahisarbeyli',password:'wrong'})).status,401);
    const guest=(await request('/api/login','POST',{guest:true})).cookie;
    const editor=(await request('/api/login','POST',{username:'ilaydahisarbeyli',password:'123456'})).cookie;
    const schools=(await request('/api/schools','GET',null,guest)).data;
    assert.deepEqual(schools.map(s=>[s.id,s.classCount]),[['nazmi',12],['atagen',8]]);
    assert.equal((await request('/api/data','GET',null,guest)).data.school.id,'nazmi');
    const d=(await request('/api/data?schoolId=nazmi','GET',null,guest)).data;
    const atagen=(await request('/api/data?schoolId=atagen','GET',null,guest)).data;
    assert.equal(d.school.id,'nazmi');assert.equal(d.classes.length,12);assert.equal(d.students.length,120);
    assert.equal(atagen.school.id,'atagen');assert.equal(atagen.classes.length,8);assert.equal(atagen.students.length,80);
    for(const c of [...d.classes,...atagen.classes])assert.equal((c.id.startsWith('nazmi-')?d:atagen).students.filter(s=>s.classId===c.id).length,10);
    assert.equal(d.students.some(s=>atagen.students.some(a=>a.id===s.id)),false);
    assert.equal('meetings' in d,false);assert.deepEqual(d.records,[]);assert.equal(d.rubricCriteria.length,21);assert.equal(d.rubricScale.length,5);
    const sid=d.students[0].id;
    assert.equal((await request('/api/meetings?studentId='+sid,'GET',null,guest)).status,403);
    const profile={birthDate:'2023-04-03',gender:'Kız',parentName:'Örnek Veli',phone:'555 000 00 00'};
    assert.equal((await request('/api/students/'+sid,'PUT',profile,guest)).status,403);
    assert.equal((await request('/api/students/'+sid,'PUT',profile,editor)).status,200);
    assert.equal((await request('/api/students/'+sid,'PUT',{...profile,birthDate:'2023-02-31'},editor)).status,400);
    const form={studentId:sid,teacher:d.teachers[0],date:'2026-09-03',type:'Genel Gözlem',frequency:'Yaklaşık iki haftadır, her gün',previousActions:'Sınıf içinde kısa hatırlatmalar yaptım.',note:'=Örnek & <metin>\nİkinci satır'};
    assert.equal((await request('/api/records','POST',{...form,kind:'observation'},guest)).status,201);
    assert.equal((await request('/api/records','POST',{...form,kind:'observation',frequency:''},guest)).status,400);
    assert.equal((await request('/api/records','POST',{...form,kind:'parent'},guest)).status,400);
    const ratings=Object.fromEntries(d.rubricCriteria.map(item=>[item.code,'3']));
    assert.equal((await request('/api/records','POST',{studentId:sid,kind:'rubric',teacher:d.teachers[0],date:'2026-09-03',ratings,note:'Genel gözlem notu'},guest)).status,201);
    assert.equal((await request('/api/records','POST',{studentId:sid,kind:'rubric',teacher:d.teachers[0],date:'2026-09-03',ratings:{A1:'3'},note:''},guest)).status,400);
    const ids=[];
    for(const kind of ['student','parent']){
      const m={studentId:sid,kind,date:'2026-09-03',participant:'Örnek Katılımcı',subject:'Takip',note:'GİZLİ görüşme notu'};
      assert.equal((await request('/api/meetings','POST',m,guest)).status,403);
      const created=await request('/api/meetings','POST',m,editor);assert.equal(created.status,201);ids.push(created.data.id);
    }
    assert.equal((await request('/api/meetings?studentId='+sid,'GET',null,editor)).data.length,2);
    assert.equal((await request('/api/meetings/'+ids[0],'DELETE',{},guest)).status,403);
    assert.equal((await request('/api/meetings/'+ids[0],'DELETE',{},editor)).status,200);
    assert.equal((await request('/api/export?schoolId=nazmi','GET',null,guest)).status,403);
    const exported=await request('/api/export?schoolId=nazmi','GET',null,editor);assert.equal(exported.status,200);assert.equal(exported.data.readUInt32LE(0),0x04034b50);assert.ok(exported.data.includes(Buffer.from('=Örnek &amp; &lt;metin&gt;')));assert.ok(exported.data.includes(Buffer.from('A1: 3')));assert.ok(!exported.data.includes(Buffer.from('GİZLİ')));
    assert.equal((await request('/data/rehberlik.sqlite')).status,404);assert.equal((await request('/server.cjs')).status,404);
    const publicData=JSON.stringify((await request('/api/data?schoolId=nazmi','GET',null,guest)).data);assert.ok(!publicData.includes('GİZLİ'));assert.ok(!publicData.includes('=Örnek'));
    await request('/api/logout','POST',{},editor);assert.equal((await request('/api/meetings?studentId='+sid,'GET',null,editor)).status,401);
    await stop();await start();
    assert.equal((await request('/api/session','GET',null,guest)).data.role,'guest');
    assert.equal((await request('/api/session','GET',null,editor)).data.role,null);
    const again=(await request('/api/login','POST',{username:'ilaydahisarbeyli',password:'123456'})).cookie;
    const saved=(await request('/api/data?schoolId=nazmi','GET',null,again)).data;assert.equal(saved.records.length,2);assert.equal(saved.records.filter(r=>r.kind==='rubric').length,1);assert.equal(saved.students[0].parentName,'Örnek Veli');assert.equal((await request('/api/meetings?studentId='+sid,'GET',null,again)).data.length,1);
  }finally{if(child)await stop();fs.rmSync(dir,{recursive:true,force:true});}
});
