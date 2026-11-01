function openDb(){
  return new Promise((res,rej)=>{
    if(!('indexedDB'in window)){rej(new Error('IndexedDB не поддерживается'));return}
    const r=indexedDB.open(DB_NAME,1);
    r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(DB_STORE))r.result.createObjectStore(DB_STORE,{keyPath:'id'})};
    r.onsuccess=()=>res(r.result);
    r.onerror=()=>rej(r.error);
  });
}
async function dbPut(v){
  const d=await openDb();
  return new Promise((res,rej)=>{
    const t=d.transaction(DB_STORE,'readwrite');
    t.objectStore(DB_STORE).put(v);
    t.oncomplete=()=>{d.close();res()};
    t.onerror=()=>{const e=t.error;d.close();rej(e)};
    t.onabort=t.onerror;
  });
}
async function dbGet(id){
  const d=await openDb();
  return new Promise((res,rej)=>{
    const t=d.transaction(DB_STORE,'readonly');
    const r=t.objectStore(DB_STORE).get(id);
    r.onsuccess=()=>res(r.result||null);
    r.onerror=()=>rej(r.error);
    t.oncomplete=()=>d.close();
  });
}
async function dbDelete(id){
  if(!id)return;
  const d=await openDb();
  return new Promise((res,rej)=>{
    const t=d.transaction(DB_STORE,'readwrite');
    t.objectStore(DB_STORE).delete(id);
    t.oncomplete=()=>{d.close();res()};
    t.onerror=()=>{const e=t.error;d.close();rej(e)};
  });
}
function fileId(){
  return window.crypto&&crypto.randomUUID?crypto.randomUUID():'f_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
}
function ensureBlob(record,meta){
  if(record?.blob instanceof Blob)return record.blob;
  if(record?.blob!=null)return new Blob([record.blob],{type:meta?.type||record?.type||'application/octet-stream'});
  return null;
}

function renderProjects(){
  const b=$('#projects'); b.innerHTML='';
  state.projects.forEach(p=>{
    const e=document.createElement('div');
    e.className='project'+(p.id===state.active?' active':'');
    e.tabIndex=0;
    e.setAttribute('role','button');
    e.innerHTML=`<div class="name">${esc(p.name)}</div><div class="meta"><span class="dot"></span>${esc(p.status)} · ${progress(p)}%</div>`;
    const go=()=>{sync();state.active=p.id;save(false);render()};
    e.onclick=go;
    e.onkeydown=x=>{if(x.key==='Enter'||x.key===' '){x.preventDefault();go()}};
    b.appendChild(e);
  });
}
function renderTasks(){
  const p=active(),b=$('#tasks'); b.innerHTML='';
  if(!p||!p.tasks.length){b.innerHTML='<div class="empty">Пока задач нет.</div>';return}
  p.tasks.forEach(t=>{
    const e=document.createElement('div');
    e.className='task';
    e.innerHTML=`<input type="checkbox" aria-label="Выполнено" ${t.done?'checked':''}><div class="grow"><div class="${t.done?'done':''}">${esc(t.text)}</div><div class="stage">${esc(t.stage||'Общие работы')}</div></div><button class="btn compact">Удалить</button>`;
    e.querySelector('input').onchange=x=>{t.done=x.target.checked;save();render()};
    e.querySelector('button').onclick=()=>{p.tasks=p.tasks.filter(x=>x.id!==t.id);save();render()};
    b.appendChild(e);
  });
}
function renderFiles(){
  const p=active(),b=$('#files'); b.innerHTML='';
  if(!p||!p.files.length){b.innerHTML='<div class="empty">Документы ещё не добавлены.</div>';return}
  p.files.forEach((f,i)=>{
    const stored=!!(f.id&&f.stored);
    const e=document.createElement('div');
    e.className='file'+(stored?'':' legacy');
    let estimate='';
    if(stored&&isPdf(f)){
      if(f.analysisStatus==='recognized'&&Number.isFinite(Number(f.estimateTotal)))estimate=` · <span class="estimate-total">Смета: ${esc(formatRub(f.estimateTotal))}</span>`;
      else if(f.analysisStatus==='processing')estimate=' · Анализирую итоговую сумму…';
      else if(f.analysisStatus==='not_found')estimate=' · <span class="estimate-missing">Итоговая сумма не найдена</span>';
      else if(f.analysisStatus==='error')estimate=' · <span class="estimate-missing">Не удалось прочитать итог</span>';
    }
    const status=stored?`Сохранён на устройстве · ${bytes(f.size)}${estimate}`:'<span class="legacy-note">Старый файл: было сохранено только имя. Загрузите файл заново.</span>';
    const primaryAction=stored
      ? (canPreview(f)?'<button class="btn compact open-file">Открыть</button>':'<button class="btn compact download-file">Скачать</button>')
      : '';
    const secondDownload=stored&&canPreview(f)?'<button class="btn compact download-file">Скачать</button>':'';
    e.innerHTML=`<div class="file-icon">${esc(kind(f.name,f.type))}</div><div class="grow"><div class="fname" title="${esc(f.name)}">${esc(f.name)}</div><div class="file-meta">${status}</div></div><div class="file-actions">${primaryAction}${secondDownload}<button class="btn compact delete-file">Удалить</button></div>`;
    const o=e.querySelector('.open-file'),d=e.querySelector('.download-file');
    if(o)o.onclick=()=>openFile(f);
    if(d)d.onclick=()=>downloadFile(f);
    e.querySelector('.delete-file').onclick=()=>removeFile(i,f);
    b.appendChild(e);
  });
}

function render(){
  const p=active(); if(!p)return;
  recalcBudget(p);
  $('#name').value=p.name||'';
  $('#client').value=p.client||'';
  $('#status').value=p.status||'В работе';
  const budget=$('#budget');
  budget.value=p.budget||'';
  budget.readOnly=!!p.budgetFromEstimates;
  const recognized=budgetTotals(p).length;
  $('#budgetSource').innerHTML=p.budgetFromEstimates?`<span class="budget-auto">Авто из PDF-смет: ${recognized}</span>`:'Ручной ввод';
  $('#deadline').value=p.deadline||'';
  $('#notes').value=p.notes||'';
  const pr=progress(p);
  $('#progressText').textContent=pr+'%';
  $('#progressBar').style.width=pr+'%';
  renderProjects();renderTasks();renderFiles();
}
function sync(){
  const p=active(); if(!p)return;
  p.name=$('#name').value.trim()||'Без названия';
  p.client=$('#client').value.trim();
  p.status=$('#status').value;
  if(!p.budgetFromEstimates)p.budget=$('#budget').value.trim();
  p.deadline=$('#deadline').value.trim();
  p.notes=$('#notes').value;
  save();
}

['#name','#client','#budget','#deadline','#notes'].forEach(s=>$(s).addEventListener('input',()=>{
  clearTimeout(inputSyncTimer);
  inputSyncTimer=setTimeout(()=>{sync();renderProjects()},180);
}));
$('#status').addEventListener('change',()=>{sync();renderProjects()});
window.addEventListener('beforeunload',()=>sync());

function modal(id,on){
  const e=$(id);
  e.classList.toggle('show',on);
  e.setAttribute('aria-hidden',on?'false':'true');
}
$('#newProjectBtn').onclick=()=>{modal('#projectModal',true);setTimeout(()=>$('#newName').focus(),0)};
$('#cancelProject').onclick=()=>modal('#projectModal',false);
$('#createProject').onclick=()=>{
  const name=$('#newName').value.trim();
  if(!name){$('#newName').focus();return}
  sync();
  const p={id:state.nextProject++,name,client:$('#newClient').value.trim(),status:'В работе',budget:'0 ₽',deadline:'—',notes:'',tasks:[],files:[]};
  state.projects.push(p);
  state.active=p.id;
  $('#newName').value='';$('#newClient').value='';
  modal('#projectModal',false);
  save();render();
};
$('#newName').addEventListener('keydown',e=>{if(e.key==='Enter')$('#createProject').click()});
$('#addTaskBtn').onclick=()=>{modal('#taskModal',true);setTimeout(()=>$('#taskText').focus(),0)};
$('#cancelTask').onclick=()=>modal('#taskModal',false);
$('#createTask').onclick=()=>{
  const text=$('#taskText').value.trim();
  if(!text){$('#taskText').focus();return}
  active().tasks.push({id:state.nextTask++,text,stage:$('#taskStage').value.trim()||'Общие работы',done:false});
  $('#taskText').value='';$('#taskStage').value='';
  modal('#taskModal',false);
  save();render();
};
$('#taskText').addEventListener('keydown',e=>{if(e.key==='Enter')$('#createTask').click()});
