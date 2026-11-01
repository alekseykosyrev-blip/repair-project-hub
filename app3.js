async function addFiles(list){
  const p=active(),files=[...list];
  if(!files.length)return;
  let n=0,recognized=0;
  for(const f of files){
    const id=fileId();
    try{
      await dbPut({id,projectId:p.id,name:f.name,type:f.type||'',size:f.size,lastModified:f.lastModified||Date.now(),blob:f});
      const legacy=p.files.findIndex(x=>!x.stored&&x.name===f.name);
      if(legacy>=0)p.files.splice(legacy,1);
      const meta={id,name:f.name,type:f.type||'',size:f.size,lastModified:f.lastModified||Date.now(),stored:true};
      p.files.push(meta);
      renderFiles();
      if(isPdf(meta)){
        const ok=await analyzePdfMeta(meta,f);
        if(ok){p.budgetFromEstimates=true;recognized++}
      }
      n++;
    }catch(e){
      console.error(e);
      toast(`Не удалось сохранить «${f.name}». Возможно, в браузере недостаточно места.`,true);
    }
  }
  recalcBudget(p);
  save();render();
  if(recognized)toast(`Смета распознана. Бюджет пересчитан: ${p.budget}`);
  else if(n)toast(n===1?'Файл сохранён на устройстве':`Сохранено файлов: ${n}`);
}

async function getStoredBlob(meta){
  const r=await dbGet(meta.id);
  const blob=ensureBlob(r,meta);
  if(!r||!blob){
    meta.stored=false;
    save(false);
    renderFiles();
    throw new Error('FILE_NOT_FOUND');
  }
  return blob;
}

async function openFile(meta){
  const previewWindow=window.open('about:blank','_blank');
  try{
    const blob=await getStoredBlob(meta);
    const u=URL.createObjectURL(blob);
    if(previewWindow&&!previewWindow.closed){
      try{previewWindow.opener=null}catch(_){}
      previewWindow.location.replace(u);
      setTimeout(()=>URL.revokeObjectURL(u),300000);
      return;
    }
    window.location.assign(u);
  }catch(e){
    if(previewWindow&&!previewWindow.closed)previewWindow.close();
    if(e?.message==='FILE_NOT_FOUND'){
      toast('Файл не найден в локальном хранилище. Загрузите его заново.',true);
    }else{
      console.error(e);
      toast('Не удалось открыть файл. Попробуйте кнопку «Скачать».',true);
    }
  }
}

async function downloadFile(meta){
  try{
    const blob=await getStoredBlob(meta);
    const u=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=u;
    a.download=meta.name||'document';
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),120000);
    toast('Файл передан в загрузки.');
  }catch(e){
    if(e?.message==='FILE_NOT_FOUND'){
      toast('Файл не найден в локальном хранилище. Загрузите его заново.',true);
    }else{
      console.error(e);
      toast('Не удалось скачать файл.',true);
    }
  }
}

async function removeFile(i,m){
  const p=active();
  if(m.stored&&m.id){
    try{await dbDelete(m.id)}catch(e){console.error(e)}
  }
  p.files.splice(i,1);
  recalcBudget(p);
  save();render();
  toast(p.budgetFromEstimates?`Документ удалён. Бюджет пересчитан: ${p.budget}`:'Документ удалён');
}

async function analyzeExistingPdfBudgets(){
  let changed=false;
  for(const p of state.projects){
    for(const meta of p.files||[]){
      if(!meta.stored||!meta.id||!isPdf(meta)||meta.analysisStatus)continue;
      meta.analysisStatus='processing'; changed=true;
      if(p.id===state.active)renderFiles();
      try{
        const r=await dbGet(meta.id),blob=ensureBlob(r,meta);
        if(!blob){meta.stored=false;meta.analysisStatus='error';continue}
        const ok=await analyzePdfMeta(meta,blob);
        if(ok)p.budgetFromEstimates=true;
      }catch(e){console.error(e);meta.analysisStatus='error'}
    }
    recalcBudget(p);
  }
  if(changed){save(false);render()}
}

$('#fileInput').onchange=async e=>{await addFiles(e.target.files);e.target.value=''};
const drop=$('#drop');
drop.onclick=()=>$('#fileInput').click();
drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#fileInput').click()}};
['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));

$('#deleteProjectBtn').onclick=async()=>{
  const p=active(); if(!p)return;
  if(state.projects.length===1){toast('Нельзя удалить единственный объект. Сначала создайте другой.',true);return}
  if(!confirm(`Удалить объект «${p.name}»? Задачи, заметки и локальные документы этого объекта будут удалены.`))return;
  for(const f of p.files){
    if(f.stored&&f.id){
      try{await dbDelete(f.id)}catch(e){console.error(e)}
    }
  }
  state.projects=state.projects.filter(x=>x.id!==p.id);
  state.active=state.projects[0].id;
  save();render();
  toast('Объект удалён');
};

document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)modal('#'+m.id,false)}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal('#projectModal',false);modal('#taskModal',false)}});
render();
analyzeExistingPdfBudgets();
