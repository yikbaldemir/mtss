const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
let setup={
  schools:[
    {id:'nazmi',name:'Kağıthane Nazmi Arıkan Fen Bilimleri İlkokulu'},
    {id:'atagen',name:'Kağıthane Atagen İlkokulu'}
  ],
  relationships:['Anne','Baba','Vasi / Diğer'],
  questions:[
    {id:'strengths',label:'Çocuğunuzun güçlü yönleri nelerdir?',required:true},
    {id:'supportNeeds',label:'En çok hangi alanlarda desteğe ihtiyaç duyuyor?',required:true},
    {id:'homeRoutine',label:'Evdeki ders ve etkinlik çalışma düzenini kısaca anlatır mısınız?',required:true},
    {id:'schoolNotes',label:'Okulla paylaşmak istediğiniz başka bir bilgi var mı?',required:false}
  ]
};

async function api(method='GET',payload){
  const response=await fetch('/api/parent-form',{method,headers:payload?{'Content-Type':'application/json'}:{},body:payload?JSON.stringify(payload):undefined});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'İşlem tamamlanamadı.');
  return result;
}

function renderSetup(){
  $('schoolId').innerHTML='<option value="">Okul seçin</option>'+setup.schools.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
  $('relationship').innerHTML='<option value="">Seçin</option>'+setup.relationships.map(value=>`<option value="${esc(value)}">${esc(value)}</option>`).join('');
  $('questions').innerHTML=setup.questions.map(question=>`<div class="field full"><label for="question-${esc(question.id)}">${esc(question.label)}</label><textarea id="question-${esc(question.id)}" maxlength="3000" ${question.required?'required':''}></textarea></div>`).join('');
}

async function loadSetup(){
  renderSetup();
  if(location.protocol==='file:'){$('formError').textContent='Bu dosya önizleme modunda açık. Formu göndermek için canlı veli bağlantısını kullanın.';$('submitButton').disabled=true;return;}
  try{setup=await api();renderSetup();}
  catch(error){$('formError').textContent='Form şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin.';$('submitButton').disabled=true;}
}

$('parentForm').addEventListener('submit',async event=>{
  event.preventDefault();
  const button=$('submitButton');button.disabled=true;$('formError').textContent='';
  try{
    const answers=Object.fromEntries(setup.questions.map(question=>[question.id,$('question-'+question.id).value]));
    await api('POST',{schoolId:$('schoolId').value,className:$('className').value,studentName:$('studentName').value,respondentName:$('respondentName').value,relationship:$('relationship').value,website:$('website').value,answers});
    $('formCard').hidden=true;$('successCard').hidden=false;window.scrollTo({top:0,behavior:'smooth'});
  }catch(error){$('formError').textContent=error.message;}
  finally{button.disabled=false;}
});

$('newFormButton').addEventListener('click',()=>{$('parentForm').reset();$('successCard').hidden=true;$('formCard').hidden=false;$('formError').textContent='';window.scrollTo({top:0,behavior:'smooth'});});
loadSetup();
