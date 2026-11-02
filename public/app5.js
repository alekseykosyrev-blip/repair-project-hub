const estimateConfirmQueue=[];
let estimateConfirmCurrent=null;

function confirmedBudgetTotals(project){
  return (project?.files||[])
    .filter(f=>f&&f.estimateConfirmed===true)
    .map(f=>Number(f.confirmedEstimateTotal))
    .filter(n=>Number.isFinite(n)&&n>=0);
}

budgetTotals=function(project){
  return confirmedBudgetTotals(project);
};

recalcBudget=function(project){
  if(!project?.budgetFromEstimates)return;
  const total=confirmedBudgetTotals(project).reduce((a,b)=>a+b,0);
  project.budget=formatRub(total);
};

function ensureEstimateConfirmModal(){
  if($('#estimateConfirmModal'))return;
  const wrap=document.createElement('div');
  wrap.className='modal';
  wrap.id='estimateConfirmModal';
  wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML=`
    <div class="modalbox" role="dialog" aria-modal="true" aria-labelledby="estimateConfirmTitle">
      <h3 id="estimateConfirmTitle">Подтвердите итог сметы</h3>
      <div id="estimateConfirmFile" class="small" style="margin-bottom:10px"></div>
      <div id="estimateConfirmHint" class="storage-note" style="margin-top:0;margin-bottom:12px"></div>
      <label for="estimateConfirmAmount" class="small" style="display:block;margin-bottom:6px">Итоговая сумма по этой смете</label>
      <input class="field" id="estimateConfirmAmount" inputmode="decimal" placeholder="Например: 670 000">
      <div class="small" style="margin-top:7px">В общий бюджет попадёт только подтверждённая вами сумма.</div>
      <div class="actions">
        <button class="btn" id="estimateConfirmLater">Позже</button>
        <button class="btn primary" id="estimateConfirmSave">Подтвердить</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  $('#estimateConfirmLater').onclick=()=>closeEstimateConfirm(false);
  $('#estimateConfirmSave').onclick=saveEstimateConfirmation;
  $('#estimateConfirmAmount').addEventListener('keydown',e=>{
    if(e.key==='Enter')saveEstimateConfirmation();
    if(e.key==='Escape')closeEstimateConfirm(false);
  });
}

function queueEstimateConfirmation(project,meta,front=false){
  if(!project||!meta||!isPdf(meta)||!meta.stored||meta.estimateConfirmed===true)return;
  if(estimateConfirmCurrent?.meta===meta||estimateConfirmQueue.some(x=>x.meta===meta))return;
  const item={project,meta};
  if(front)estimateConfirmQueue.unshift(item); else estimateConfirmQueue.push(item);
  showNextEstimateConfirmation();
}

function showNextEstimateConfirmation(){
  ensureEstimateConfirmModal();
  if(estimateConfirmCurrent||!estimateConfirmQueue.length)return;
  estimateConfirmCurrent=estimateConfirmQueue.shift();
  const {meta}=estimateConfirmCurrent;
  $('#estimateConfirmFile').textContent=meta.name||'PDF-смета';
  const detected=Number(meta.estimateTotal);
  if(Number.isFinite(detected)&&detected>=0){
    $('#estimateConfirmHint').innerHTML=`Сайт нашёл итог: <strong>${esc(formatRub(detected))}</strong>. Проверьте сумму по PDF. Если она верная — подтвердите; если нет — исправьте поле ниже.`;
    $('#estimateConfirmAmount').value=String(detected).replace('.',',');
  }else{
    $('#estimateConfirmHint').textContent='Сайт не смог надёжно определить итоговую сумму. Введите сумму из сметы вручную.';
    $('#estimateConfirmAmount').value='';
  }
  modal('#estimateConfirmModal',true);
  setTimeout(()=>{$('#estimateConfirmAmount').focus();$('#estimateConfirmAmount').select()},0);
}

function closeEstimateConfirm(next=true){
  modal('#estimateConfirmModal',false);
  estimateConfirmCurrent=null;
  if(next)setTimeout(showNextEstimateConfirmation,0);
}

function saveEstimateConfirmation(){
  if(!estimateConfirmCurrent)return;
  const raw=$('#estimateConfirmAmount').value;
  const amount=parseMoney(raw);
  if(!Number.isFinite(amount)||amount<0){
    toast('Введите корректную итоговую сумму.',true);
    $('#estimateConfirmAmount').focus();
    return;
  }
  const {project,meta}=estimateConfirmCurrent;
  meta.confirmedEstimateTotal=amount;
  meta.estimateConfirmed=true;
  meta.confirmedAt=Date.now();
  const detected=Number(meta.estimateTotal);
  meta.confirmationSource=Number.isFinite(detected)&&Math.abs(detected-amount)<0.01?'auto-confirmed':'manual';
  project.budgetFromEstimates=true;
  recalcBudget(project);
  save(false);
  render();
  toast(`Итог подтверждён: ${formatRub(amount)}. Бюджет пересчитан.`);
  closeEstimateConfirm(true);
}

function editEstimateTotal(project,meta){
  if(!project||!meta)return;
  estimateConfirmQueue.splice(0,estimateConfirmQueue.length);
  estimateConfirmCurrent={project,meta};
  ensureEstimateConfirmModal();
  $('#estimateConfirmFile').textContent=meta.name||'PDF-смета';
  if(meta.estimateConfirmed&&Number.isFinite(Number(meta.confirmedEstimateTotal))){
    $('#estimateConfirmHint').innerHTML=`Сейчас подтверждено: <strong>${esc(formatRub(meta.confirmedEstimateTotal))}</strong>. Измените сумму и подтвердите снова.`;
    $('#estimateConfirmAmount').value=String(meta.confirmedEstimateTotal).replace('.',',');
  }else if(Number.isFinite(Number(meta.estimateTotal))){
    $('#estimateConfirmHint').innerHTML=`Сайт нашёл: <strong>${esc(formatRub(meta.estimateTotal))}</strong>. Проверьте или исправьте сумму.`;
    $('#estimateConfirmAmount').value=String(meta.estimateTotal).replace('.',',');
  }else{
    $('#estimateConfirmHint').textContent='Введите итоговую сумму по этой смете вручную.';
    $('#estimateConfirmAmount').value='';
  }
  modal('#estimateConfirmModal',true);
  setTimeout(()=>{$('#estimateConfirmAmount').focus();$('#estimateConfirmAmount').select()},0);
}

renderFiles=function(){
  const project=active(),b=$('#files'); b.innerHTML='';
  if(!project||!project.files.length){b.innerHTML='<div class="empty">Документы ещё не добавлены.</div>';return}
  project.files.forEach((f,i)=>{
    const stored=!!(f.id&&f.stored);
    const e=document.createElement('div');
    e.className='file'+(stored?'':' legacy');
    let estimate='';
    if(stored&&isPdf(f)){
      if(f.estimateConfirmed===true&&Number.isFinite(Number(f.confirmedEstimateTotal))){
        estimate=` · <span class="estimate-total">Подтверждено: ${esc(formatRub(f.confirmedEstimateTotal))}</span>`;
      }else if(f.analysisStatus==='recognized'&&Number.isFinite(Number(f.estimateTotal))){
        estimate=` · <span class="estimate-missing">Найдено: ${esc(formatRub(f.estimateTotal))} — требуется подтверждение</span>`;
      }else if(f.analysisStatus==='processing')estimate=' · Анализирую итоговую сумму…';
      else if(f.analysisStatus==='not_found')estimate=' · <span class="estimate-missing">Итог не найден — укажите вручную</span>';
      else if(f.analysisStatus==='error')estimate=' · <span class="estimate-missing">Не удалось прочитать итог — укажите вручную</span>';
      else estimate=' · <span class="estimate-missing">Требуется подтверждение итога</span>';
    }
    const status=stored?`Сохранён на устройстве · ${bytes(f.size)}${estimate}`:'<span class="legacy-note">Старый файл: было сохранено только имя. Загрузите файл заново.</span>';
    const primaryAction=stored
      ? (canPreview(f)?'<button class="btn compact open-file">Открыть</button>':'<button class="btn compact download-file">Скачать</button>')
      : '';
    const secondDownload=stored&&canPreview(f)?'<button class="btn compact download-file">Скачать</button>':'';
    const totalAction=stored&&isPdf(f)?`<button class="btn compact total-file">${f.estimateConfirmed?'Изменить итог':'Указать итог'}</button>`:'';
    e.innerHTML=`<div class="file-icon">${esc(kind(f.name,f.type))}</div><div class="grow"><div class="fname" title="${esc(f.name)}">${esc(f.name)}</div><div class="file-meta">${status}</div></div><div class="file-actions">${primaryAction}${secondDownload}${totalAction}<button class="btn compact delete-file">Удалить</button></div>`;
    const o=e.querySelector('.open-file'),d=e.querySelector('.download-file'),t=e.querySelector('.total-file');
    if(o)o.onclick=()=>openFile(f);
    if(d)d.onclick=()=>downloadFile(f);
    if(t)t.onclick=()=>editEstimateTotal(project,f);
    e.querySelector('.delete-file').onclick=()=>removeFile(i,f);
    b.appendChild(e);
  });
};

const originalRender=render;
render=function(){
  originalRender();
  const project=active();
  if(!project)return;
  const pdfs=(project.files||[]).filter(f=>f.stored&&isPdf(f));
  if(pdfs.length){
    project.budgetFromEstimates=true;
    recalcBudget(project);
    const budget=$('#budget');
    budget.value=project.budget||formatRub(0);
    budget.readOnly=true;
    const confirmed=confirmedBudgetTotals(project).length;
    const pending=pdfs.filter(f=>f.estimateConfirmed!==true).length;
    $('#budgetSource').innerHTML=`<span class="budget-auto">Подтверждено смет: ${confirmed}${pending?` · ждут подтверждения: ${pending}`:''}</span>`;
  }
  renderFiles();
};

addFiles=async function(list){
  const project=active(),files=[...list];
  if(!files.length)return;
  let savedCount=0;
  const newPdfItems=[];
  for(const f of files){
    const id=fileId();
    try{
      await dbPut({id,projectId:project.id,name:f.name,type:f.type||'',size:f.size,lastModified:f.lastModified||Date.now(),blob:f});
      const legacy=project.files.findIndex(x=>!x.stored&&x.name===f.name);
      if(legacy>=0)project.files.splice(legacy,1);
      const meta={id,name:f.name,type:f.type||'',size:f.size,lastModified:f.lastModified||Date.now(),stored:true};
      project.files.push(meta);
      renderFiles();
      if(isPdf(meta)){
        project.budgetFromEstimates=true;
        await analyzePdfMeta(meta,f);
        newPdfItems.push(meta);
      }
      savedCount++;
    }catch(e){
      console.error(e);
      toast(`Не удалось сохранить «${f.name}». Возможно, в браузере недостаточно места.`,true);
    }
  }
  recalcBudget(project);
  save(false);render();
  if(savedCount)toast(savedCount===1?'Файл сохранён. Проверьте итог сметы.':`Сохранено файлов: ${savedCount}. Проверьте итоги смет.`);
  newPdfItems.forEach(meta=>queueEstimateConfirmation(project,meta));
};

ensureEstimateConfirmModal();
render();
setTimeout(()=>{
  for(const project of state.projects||[]){
    for(const meta of project.files||[]){
      if(meta?.stored&&isPdf(meta)&&meta.estimateConfirmed!==true)queueEstimateConfirmation(project,meta);
    }
  }
},700);
