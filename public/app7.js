const FINANCE_MODEL_VERSION=1;
const ESTIMATE_STATUSES={draft:'Черновик',sent:'Отправлена',approved:'Согласована',in_progress:'Выполняется',closed:'Закрыта'};
const ACT_STATUSES={draft:'Черновик',sent:'Отправлен',signed:'Подписан'};
let financeSaveTimer=null;
let financeEditContext=null;
let photoObjectUrls=[];

function financeId(prefix){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8)}
function todayIso(){const d=new Date();return d.toISOString().slice(0,10)}
function moneyNumber(v){const n=typeof v==='number'?v:parseMoney(v);return Number.isFinite(n)?n:0}
function estimateFiles(project){return (project?.files||[]).filter(f=>f?.documentType==='estimate')}
function photoFiles(project){return (project?.files||[]).filter(f=>f?.documentType==='photo')}
function projectDocuments(project){return (project?.files||[]).filter(f=>f?.documentType==='contract'||f?.documentType==='document')}
function approvedEstimate(estimate){return ['approved','in_progress','closed'].includes(estimate?.estimateStatus)}
function estimateAmount(estimate){return estimate?.estimateConfirmed===true?moneyNumber(estimate.confirmedEstimateTotal):0}
function estimateCompleted(estimate){
  const amount=estimateAmount(estimate);
  const stored=moneyNumber(estimate?.estimateCompletedAmount);
  if(stored>0||Number(estimate?.estimateCompletionPercent)>0)return Math.min(amount||stored,stored);
  if(estimate?.estimateStatus==='closed')return amount;
  return 0;
}
function signedActAmount(project){return (project?.acts||[]).filter(a=>a.status==='signed').reduce((s,a)=>s+moneyNumber(a.amount),0)}
function receivedAmount(project){return (project?.payments||[]).reduce((s,p)=>s+moneyNumber(p.amount),0)}
function approvedAmount(project){return estimateFiles(project).filter(approvedEstimate).reduce((s,e)=>s+estimateAmount(e),0)}
function completedAmount(project){return estimateFiles(project).filter(approvedEstimate).reduce((s,e)=>s+estimateCompleted(e),0)}
function projectFinance(project){
  const approved=approvedAmount(project);
  const completed=completedAmount(project);
  const acted=signedActAmount(project);
  const received=receivedAmount(project);
  return {approved,completed,acted,received,toReceive:Math.max(0,acted-received),remaining:Math.max(0,approved-completed)};
}
function allFinance(){
  const total={approved:0,completed:0,acted:0,received:0,toReceive:0,remaining:0};
  (state.projects||[]).forEach(p=>{const f=projectFinance(p);Object.keys(total).forEach(k=>total[k]+=f[k])});
  return total;
}
function estimatePaid(project,estimateId){return (project?.payments||[]).filter(p=>p.estimateId===estimateId).reduce((s,p)=>s+moneyNumber(p.amount),0)}
function estimateActed(project,estimateId){return (project?.acts||[]).filter(a=>a.estimateId===estimateId&&a.status==='signed').reduce((s,a)=>s+moneyNumber(a.amount),0)}

function ensureFinanceModel(project){
  if(!project)return;
  project.files=Array.isArray(project.files)?project.files:[];
  project.acts=Array.isArray(project.acts)?project.acts:[];
  project.payments=Array.isArray(project.payments)?project.payments:[];
  if(!project.financeModelVersion){
    project.plannedBudget=project.plannedBudget||project.budget||'';
    project.financeModelVersion=FINANCE_MODEL_VERSION;
  }
  project.files.forEach(f=>{
    if(!f.documentType){
      if(f.estimateConfirmed===true||f.analysisStatus||Number.isFinite(Number(f.estimateTotal)))f.documentType='estimate';
      else if(String(f.type||'').startsWith('image/'))f.documentType='photo';
      else f.documentType='document';
    }
    if(f.documentType==='estimate'){
      f.estimateNumber=f.estimateNumber||('Смета '+((project.files.filter(x=>x.documentType==='estimate').indexOf(f))+1));
      f.estimateStatus=f.estimateStatus||'sent';
      f.estimateDate=f.estimateDate||new Date(f.lastModified||Date.now()).toISOString().slice(0,10);
      f.estimateCompletionPercent=Number(f.estimateCompletionPercent)||0;
      f.estimateCompletedAmount=moneyNumber(f.estimateCompletedAmount);
    }
  });
  project.nextActNumber=Number(project.nextActNumber)||Math.max(0,...project.acts.map(a=>Number(String(a.number||'').match(/\d+/)?.[0])||0))+1;
  project.nextPaymentNumber=Number(project.nextPaymentNumber)||project.payments.length+1;
  estimateFiles(project).filter(approvedEstimate).forEach(e=>ensureDraftAct(project,e,false));
}
function ensureAllFinanceModels(){(state.projects||[]).forEach(ensureFinanceModel)}

function ensureDraftAct(project,estimate,shouldRender=true){
  if(!project||!estimate)return null;
  const existing=(project.acts||[]).find(a=>a.estimateId===estimate.id);
  if(existing)return existing;
  const act={id:financeId('act'),number:'Акт №'+(project.nextActNumber++),estimateId:estimate.id,date:todayIso(),amount:0,status:'draft',description:'',createdAt:Date.now(),autoCreated:true};
  project.acts.push(act);
  if(shouldRender){save(false);render()}
  return act;
}

ensureAllFinanceModels();
save(false);

const baseQueueEstimateConfirmation=queueEstimateConfirmation;
queueEstimateConfirmation=function(project,meta,front=false){
  if(meta?.documentType!=='estimate')return;
  return baseQueueEstimateConfirmation(project,meta,front);
};

budgetTotals=function(project){return estimateFiles(project).filter(approvedEstimate).map(estimateAmount).filter(n=>n>=0)};
recalcBudget=function(project){
  if(!project)return;
  const total=approvedAmount(project);
  project.budget=formatRub(total);
};

function ensureFinanceModals(){
  if($('#estimateMetaModal'))return;
  const holder=document.createElement('div');
  holder.innerHTML=`
  <div class="modal" id="estimateMetaModal" aria-hidden="true"><div class="modalbox" role="dialog" aria-modal="true"><h3>Параметры сметы</h3><div class="finance-modal-grid">
    <div><label>Номер / название</label><input class="field" id="estimateMetaNumber" placeholder="Смета №1"></div>
    <div><label>Дата</label><input class="field" id="estimateMetaDate" type="date"></div>
    <div><label>Статус</label><select class="field" id="estimateMetaStatus"><option value="draft">Черновик</option><option value="sent">Отправлена</option><option value="approved">Согласована</option><option value="in_progress">Выполняется</option><option value="closed">Закрыта</option></select></div>
    <div><label>Выполнение, %</label><input class="field" id="estimateMetaPercent" inputmode="decimal" placeholder="0"></div>
    <div class="full"><label>Выполнено на сумму</label><input class="field" id="estimateMetaCompleted" inputmode="decimal" placeholder="0"></div>
  </div><div class="actions"><button class="btn" id="estimateMetaCancel">Отмена</button><button class="btn primary" id="estimateMetaSave">Сохранить</button></div></div></div>
  <div class="modal" id="actEditModal" aria-hidden="true"><div class="modalbox" role="dialog" aria-modal="true"><h3>Акт выполненных работ</h3><div class="finance-modal-grid">
    <div><label>Номер</label><input class="field" id="actNumber"></div><div><label>Дата</label><input class="field" id="actDate" type="date"></div>
    <div><label>Смета</label><select class="field" id="actEstimate"></select></div><div><label>Статус</label><select class="field" id="actStatus"><option value="draft">Черновик</option><option value="sent">Отправлен</option><option value="signed">Подписан</option></select></div>
    <div class="full"><label>Сумма акта</label><input class="field" id="actAmount" inputmode="decimal"></div>
    <div class="full"><label>Описание выполненных работ</label><textarea id="actDescription" placeholder="Какие работы вошли в акт"></textarea></div>
  </div><div class="actions"><button class="btn" id="actCancel">Отмена</button><button class="btn primary" id="actSave">Сохранить акт</button></div></div></div>
  <div class="modal" id="paymentEditModal" aria-hidden="true"><div class="modalbox" role="dialog" aria-modal="true"><h3>Поступление оплаты</h3><div class="finance-modal-grid">
    <div><label>Дата</label><input class="field" id="paymentDate" type="date"></div><div><label>Сумма</label><input class="field" id="paymentAmount" inputmode="decimal"></div>
    <div class="full"><label>Привязать к смете</label><select class="field" id="paymentEstimate"></select></div>
    <div class="full"><label>Комментарий</label><textarea id="paymentNote" placeholder="Например: аванс, оплата по акту №2"></textarea></div>
  </div><div class="actions"><button class="btn" id="paymentCancel">Отмена</button><button class="btn primary" id="paymentSave">Сохранить оплату</button></div></div></div>`;
  [...holder.children].forEach(x=>document.body.appendChild(x));
  $('#estimateMetaCancel').onclick=()=>modal('#estimateMetaModal',false);
  $('#actCancel').onclick=()=>modal('#actEditModal',false);
  $('#paymentCancel').onclick=()=>modal('#paymentEditModal',false);
  $('#estimateMetaSave').onclick=saveEstimateMeta;
  $('#actSave').onclick=saveActEditor;
  $('#paymentSave').onclick=savePaymentEditor;
}

function ensureFinanceWorkspace(){
  const main=document.querySelector('.main');if(!main)return;
  const grid=document.querySelector('.grid');
  const docs=document.querySelector('.documents-panel');
  if(grid){const ps=[...grid.querySelectorAll(':scope > .panel')];if(ps[0])ps[0].id='tasksPanel';if(ps[1])ps[1].id='notesPanel'}
  if(docs)docs.id='documentsPanel';
  if($('#financeShell'))return;
  const shell=document.createElement('div');shell.id='financeShell';shell.className='finance-shell';
  shell.innerHTML=`
    <div class="workspace-nav" id="workspaceNav">
      <button data-jump="globalFinancePanel">Общая ведомость</button><button data-jump="projectFinancePanel">Финансы объекта</button><button data-jump="estimatesPanel">Сметы</button><button data-jump="actsPanel">Акты</button><button data-jump="paymentsPanel">Оплаты</button><button data-jump="tasksPanel">Задачи</button><button data-jump="photosPanel">Фото</button><button data-jump="documentsPanel">Документы</button>
    </div>
    <section class="panel finance-panel" id="globalFinancePanel"><div class="section-title"><div><h2>Общая финансовая ведомость</h2><div class="small">Все проекты и согласованные сметы площадки</div></div></div><div class="finance-summary" id="globalFinanceSummary"></div><div id="globalProjectsTable"></div></section>
    <section class="panel finance-panel" id="projectFinancePanel"><div class="section-title"><div><h2>Финансы объекта</h2><div class="small">Согласовано, выполнено, актировано и получено</div></div></div><div class="finance-summary" id="projectFinanceSummary"></div><div class="finance-plan"><div><label for="plannedBudgetInput">Плановый бюджет объекта</label><input class="field" id="plannedBudgetInput" inputmode="decimal" placeholder="Например: 2 500 000"></div><div class="small" id="plannedBudgetDiff"></div></div></section>
    <section class="panel estimates-panel" id="estimatesPanel"><div class="section-title"><div><h2>Сметы</h2><div class="small">Каждая смета отдельно: статус, сумма, выполнение, акты и оплаты</div></div><div class="section-actions"><button class="btn primary" id="addEstimateBtn">+ Добавить смету</button><input type="file" id="estimateFileInput" accept=".pdf,.xls,.xlsx,application/pdf" multiple hidden></div></div><div id="estimatesBody"></div></section>
    <section class="panel acts-panel" id="actsPanel"><div class="section-title"><div><h2>Акты выполненных работ</h2><div class="small">Черновик акта создаётся автоматически после согласования сметы</div></div><button class="btn" id="addActBtn">+ Акт</button></div><div id="actsBody"></div></section>
    <section class="panel payments-panel" id="paymentsPanel"><div class="section-title"><div><h2>Оплаты</h2><div class="small">Все поступления денег с датой и привязкой к смете</div></div><button class="btn primary" id="addPaymentBtn">+ Оплата</button></div><div id="paymentsBody"></div></section>
    <section class="panel photos-panel" id="photosPanel"><div class="section-title"><div><h2>Фотоотчёт</h2><div class="small">Фотографии по объекту для отчётности и истории работ</div></div><div class="photos-upload"><button class="btn primary" id="addPhotosBtn">+ Фото</button><input type="file" id="photoFileInput" accept="image/*" multiple hidden></div></div><div id="photosBody"></div></section>`;
  const dashboard=$('#projectDashboard');
  if(dashboard)dashboard.insertAdjacentElement('afterend',shell);else if(grid)grid.insertAdjacentElement('beforebegin',shell);else main.appendChild(shell);
  shell.addEventListener('click',e=>{const b=e.target.closest('[data-jump]');if(!b)return;document.getElementById(b.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'})});
  $('#addEstimateBtn').onclick=()=>$('#estimateFileInput').click();
  $('#estimateFileInput').onchange=async e=>{await uploadEstimateFiles(e.target.files);e.target.value=''};
  $('#addActBtn').onclick=()=>openActEditor(null);
  $('#addPaymentBtn').onclick=()=>openPaymentEditor(null);
  $('#addPhotosBtn').onclick=()=>$('#photoFileInput').click();
  $('#photoFileInput').onchange=async e=>{await uploadProjectFiles(e.target.files,'photo');e.target.value=''};
  $('#plannedBudgetInput').addEventListener('input',()=>{clearTimeout(financeSaveTimer);financeSaveTimer=setTimeout(()=>{const p=active();p.plannedBudget=$('#plannedBudgetInput').value.trim();save(false);renderFinanceWorkspace()},220)});
  ensureDocumentControls();
}

function ensureDocumentControls(){
  const docs=$('#documentsPanel');if(!docs)return;
  const title=docs.querySelector('.section-title h2');if(title)title.textContent='Документы проекта';
  const sub=docs.querySelector('.section-title .small');if(sub)sub.textContent='Договоры, приложения, переписка и прочие файлы';
  const note=docs.querySelector('.storage-note');if(note)note.textContent='Документы и фотографии сохраняются целиком на этом устройстве. Сметы ведутся отдельно в разделе «Сметы», чтобы финансовая ведомость не смешивалась с договорами и прочими файлами.';
  const oldActions=docs.querySelector('.doc-head-actions');
  if(oldActions&&!$('#contractFileInput')){
    oldActions.innerHTML='<button class="btn primary" id="addContractBtn">+ Договор</button><button class="btn" id="addDocumentBtn">+ Документ</button><input type="file" id="contractFileInput" multiple hidden><input type="file" id="projectDocFileInput" multiple hidden>';
    $('#addContractBtn').onclick=()=>$('#contractFileInput').click();
    $('#addDocumentBtn').onclick=()=>$('#projectDocFileInput').click();
    $('#contractFileInput').onchange=async e=>{await uploadProjectFiles(e.target.files,'contract');e.target.value=''};
    $('#projectDocFileInput').onchange=async e=>{await uploadProjectFiles(e.target.files,'document');e.target.value=''};
  }
  const drop=$('#drop');if(drop){drop.textContent='Перетащи сюда договор или другой документ';drop.onclick=()=>$('#projectDocFileInput')?.click()}
}

async function persistBlobFile(project,file,documentType){
  const id=fileId();
  await dbPut({id,projectId:project.id,name:file.name,type:file.type||'',size:file.size,lastModified:file.lastModified||Date.now(),blob:file,documentType});
  const meta={id,name:file.name,type:file.type||'',size:file.size,lastModified:file.lastModified||Date.now(),stored:true,documentType,createdAt:Date.now()};
  project.files.push(meta);return meta;
}
async function uploadProjectFiles(list,documentType){
  const project=active(),files=[...list];if(!project||!files.length)return;
  let saved=0;
  for(const file of files){try{await persistBlobFile(project,file,documentType);saved++}catch(e){console.error(e);toast('Не удалось сохранить «'+file.name+'».',true)}}
  save(false);render();if(saved)toast('Сохранено файлов: '+saved);
}
async function uploadEstimateFiles(list){
  const project=active(),files=[...list];if(!project||!files.length)return;
  let index=estimateFiles(project).length;
  const pending=[];
  for(const file of files){
    try{
      const meta=await persistBlobFile(project,file,'estimate');
      index++;
      meta.estimateNumber='Смета №'+index;
      meta.estimateDate=todayIso();
      meta.estimateStatus='sent';
      meta.estimateCompletionPercent=0;meta.estimateCompletedAmount=0;
      if(isPdf(meta))await analyzePdfMeta(meta,file);else meta.analysisStatus='not_found';
      pending.push(meta);
    }catch(e){console.error(e);toast('Не удалось сохранить смету «'+file.name+'».',true)}
  }
  save(false);render();
  pending.forEach((meta,i)=>setTimeout(()=>{if(isPdf(meta))queueEstimateConfirmation(project,meta);else editEstimateTotal(project,meta)},i*120));
}

addFiles=async function(list){return uploadProjectFiles(list,'document')};

function moneyCard(label,value,note,cls=''){return '<div class="money-card '+cls+'"><div class="money-label">'+esc(label)+'</div><strong>'+esc(formatRub(value))+'</strong><div class="money-note">'+esc(note||'')+'</div></div>'}
function renderSummaryCards(target,finance){
  const el=$(target);if(!el)return;
  el.innerHTML=moneyCard('Согласовано',finance.approved,'По согласованным сметам','good')+moneyCard('Выполнено',finance.completed,'Фактическое выполнение')+moneyCard('Актировано',finance.acted,'Подписанные акты')+moneyCard('Получено',finance.received,'Все поступившие оплаты','good')+moneyCard('К получению',finance.toReceive,'Подписано актов минус оплаты',finance.toReceive>0?'warn':'')+moneyCard('Остаток работ',finance.remaining,'Согласовано минус выполнено');
}
function renderGlobalFinance(){
  renderSummaryCards('#globalFinanceSummary',allFinance());
  const rows=(state.projects||[]).map(p=>{const f=projectFinance(p);return '<tr><td><div class="record-title">'+esc(p.name||'Без названия')+'</div><div class="record-sub">'+esc(p.client||'Без заказчика')+'</div></td><td class="num">'+esc(formatRub(f.approved))+'</td><td class="num">'+esc(formatRub(f.completed))+'</td><td class="num">'+esc(formatRub(f.acted))+'</td><td class="num">'+esc(formatRub(f.received))+'</td><td class="num">'+esc(formatRub(f.toReceive))+'</td><td class="num">'+esc(formatRub(f.remaining))+'</td></tr>'}).join('');
  $('#globalProjectsTable').innerHTML='<table class="records-table"><thead><tr><th>Объект</th><th class="num">Согласовано</th><th class="num">Выполнено</th><th class="num">Актировано</th><th class="num">Получено</th><th class="num">К получению</th><th class="num">Остаток</th></tr></thead><tbody>'+rows+'</tbody></table>';
}
function renderProjectFinance(){
  const p=active();if(!p)return;const f=projectFinance(p);renderSummaryCards('#projectFinanceSummary',f);
  const inp=$('#plannedBudgetInput');if(inp&&document.activeElement!==inp)inp.value=p.plannedBudget||'';
  const plan=moneyNumber(p.plannedBudget);const diff=plan?plan-f.approved:0;
  $('#plannedBudgetDiff').textContent=plan?('План '+formatRub(plan)+' · резерв к согласованным сметам '+formatRub(diff)):'Можно задать общий плановый бюджет независимо от смет.';
  p.budget=formatRub(f.approved);
  const budget=$('#budget');if(budget){budget.value=p.budget;budget.readOnly=true}
  const bs=$('#budgetSource');if(bs)bs.innerHTML='<span class="budget-auto">Согласованные сметы: '+estimateFiles(p).filter(approvedEstimate).length+'</span>';
}

function renderEstimates(){
  const p=active(),body=$('#estimatesBody');if(!p||!body)return;const estimates=estimateFiles(p);
  if(!estimates.length){body.innerHTML='<div class="finance-empty">Смет пока нет. Добавь PDF или Excel через «Добавить смету».</div>';return}
  const rows=estimates.map(e=>{
    const amount=estimateAmount(e),completed=estimateCompleted(e),paid=estimatePaid(p,e.id),acted=estimateActed(p,e.id),percent=amount?Math.min(100,Math.round(completed/amount*100)):Number(e.estimateCompletionPercent)||0;
    const statusOpts=Object.entries(ESTIMATE_STATUSES).map(([v,l])=>'<option value="'+v+'" '+(e.estimateStatus===v?'selected':'')+'>'+l+'</option>').join('');
    const confirmed=e.estimateConfirmed===true?'<span class="status-badge approved">Сумма подтверждена</span>':'<span class="status-badge in_progress">Подтвердить сумму</span>';
    return '<tr data-estimate-id="'+esc(e.id)+'"><td><div class="record-title">'+esc(e.estimateNumber||e.name)+'</div><div class="record-sub">'+esc(e.name)+' · '+esc(e.estimateDate||'')+'</div>'+confirmed+'</td><td><select class="estimate-status">'+statusOpts+'</select></td><td class="num">'+esc(formatRub(amount))+'</td><td><div>'+percent+'% · '+esc(formatRub(completed))+'</div><div class="inline-progress"><span style="width:'+percent+'%"></span></div></td><td class="num">'+esc(formatRub(acted))+'</td><td class="num">'+esc(formatRub(paid))+'</td><td class="num">'+esc(formatRub(Math.max(0,amount-paid)))+'</td><td><div class="record-actions"><button class="btn edit-estimate">Изменить</button><button class="btn total-estimate">'+(e.estimateConfirmed?'Итог':'Подтвердить')+'</button><button class="btn open-estimate">Открыть</button><button class="btn danger delete-estimate">Удалить</button></div></td></tr>';
  }).join('');
  body.innerHTML='<table class="records-table"><thead><tr><th>Смета</th><th>Статус</th><th class="num">Сумма</th><th>Выполнение</th><th class="num">Актировано</th><th class="num">Получено</th><th class="num">Остаток денег</th><th></th></tr></thead><tbody>'+rows+'</tbody></table><div class="financial-footnote">В общую финансовую ведомость попадают только сметы со статусом «Согласована», «Выполняется» или «Закрыта» и с подтверждённой суммой.</div>';
  body.querySelectorAll('tr[data-estimate-id]').forEach(row=>{
    const e=estimates.find(x=>x.id===row.dataset.estimateId);if(!e)return;
    row.querySelector('.estimate-status').onchange=ev=>changeEstimateStatus(p,e,ev.target.value);
    row.querySelector('.edit-estimate').onclick=()=>openEstimateMeta(e);
    row.querySelector('.total-estimate').onclick=()=>editEstimateTotal(p,e);
    row.querySelector('.open-estimate').onclick=()=>openFile(e);
    row.querySelector('.delete-estimate').onclick=()=>deleteEstimate(p,e);
  });
}
function changeEstimateStatus(project,estimate,status){
  estimate.estimateStatus=status;
  if(['approved','in_progress','closed'].includes(status)){
    estimate.approvedAt=estimate.approvedAt||Date.now();
    ensureDraftAct(project,estimate,false);
    if(estimate.estimateConfirmed!==true)setTimeout(()=>editEstimateTotal(project,estimate),50);
  }
  save(false);render();
}
function openEstimateMeta(estimate){
  financeEditContext={type:'estimate',record:estimate};
  $('#estimateMetaNumber').value=estimate.estimateNumber||estimate.name||'';
  $('#estimateMetaDate').value=estimate.estimateDate||todayIso();
  $('#estimateMetaStatus').value=estimate.estimateStatus||'sent';
  $('#estimateMetaPercent').value=String(Number(estimate.estimateCompletionPercent)||0);
  $('#estimateMetaCompleted').value=estimate.estimateCompletedAmount?String(estimate.estimateCompletedAmount).replace('.',','):'';
  modal('#estimateMetaModal',true);
}
function saveEstimateMeta(){
  const ctx=financeEditContext;if(ctx?.type!=='estimate')return;const e=ctx.record,p=active();
  e.estimateNumber=$('#estimateMetaNumber').value.trim()||e.name;e.estimateDate=$('#estimateMetaDate').value||todayIso();
  e.estimateStatus=$('#estimateMetaStatus').value;
  let percent=Math.max(0,Math.min(100,Number(String($('#estimateMetaPercent').value).replace(',','.'))||0));
  let completed=parseMoney($('#estimateMetaCompleted').value);
  if(!Number.isFinite(completed)||completed<0)completed=estimateAmount(e)*percent/100;
  e.estimateCompletionPercent=percent;e.estimateCompletedAmount=Math.min(estimateAmount(e)||completed,completed);
  if(['approved','in_progress','closed'].includes(e.estimateStatus)){e.approvedAt=e.approvedAt||Date.now();ensureDraftAct(p,e,false)}
  modal('#estimateMetaModal',false);save(false);render();
  if(['approved','in_progress','closed'].includes(e.estimateStatus)&&e.estimateConfirmed!==true)setTimeout(()=>editEstimateTotal(p,e),60);
}
async function deleteEstimate(project,estimate){
  if(!confirm('Удалить «'+(estimate.estimateNumber||estimate.name)+'»? Связанные акты останутся в журнале, но будут без сметы.'))return;
  try{if(estimate.id)await dbDelete(estimate.id)}catch(e){console.error(e)}
  project.files=project.files.filter(f=>f.id!==estimate.id);
  project.acts.forEach(a=>{if(a.estimateId===estimate.id)a.estimateId=null});
  save(false);render();
}

function estimateSelectOptions(project,selected='',allowEmpty=true){
  let html=allowEmpty?'<option value="">Без привязки</option>':'';
  return html+estimateFiles(project).map(e=>'<option value="'+esc(e.id)+'" '+(selected===e.id?'selected':'')+'>'+esc(e.estimateNumber||e.name)+'</option>').join('');
}
function renderActs(){
  const p=active(),body=$('#actsBody');if(!p||!body)return;const acts=p.acts||[];
  if(!acts.length){body.innerHTML='<div class="finance-empty">Актов пока нет. После согласования сметы черновик акта появится автоматически.</div>';return}
  body.innerHTML='<div class="act-list">'+acts.map(a=>{const e=estimateFiles(p).find(x=>x.id===a.estimateId);return '<div class="act-card act-row"><div class="act-main"><strong>'+esc(a.number||'Акт')+'</strong><div class="act-meta">'+esc(e?.estimateNumber||'Без привязки к смете')+' · '+esc(a.date||'')+'</div></div><div><span class="status-badge '+esc(a.status||'draft')+'">'+esc(ACT_STATUSES[a.status]||a.status)+'</span></div><div class="num"><strong>'+esc(formatRub(a.amount||0))+'</strong></div><div class="record-actions"><button class="btn edit-act" data-id="'+esc(a.id)+'">Заполнить</button><button class="btn danger delete-act" data-id="'+esc(a.id)+'">Удалить</button></div></div>'}).join('')+'</div>';
  body.querySelectorAll('.edit-act').forEach(b=>b.onclick=()=>openActEditor(acts.find(a=>a.id===b.dataset.id)));
  body.querySelectorAll('.delete-act').forEach(b=>b.onclick=()=>{const a=acts.find(x=>x.id===b.dataset.id);if(a&&confirm('Удалить '+a.number+'?')){p.acts=p.acts.filter(x=>x.id!==a.id);save(false);render()}});
}
function openActEditor(act){
  const p=active();if(!p)return;const record=act||{id:financeId('act'),number:'Акт №'+(p.nextActNumber++),estimateId:estimateFiles(p)[0]?.id||'',date:todayIso(),amount:0,status:'draft',description:'',createdAt:Date.now()};
  financeEditContext={type:'act',record,isNew:!act};
  $('#actNumber').value=record.number||'';$('#actDate').value=record.date||todayIso();$('#actEstimate').innerHTML=estimateSelectOptions(p,record.estimateId,false);$('#actStatus').value=record.status||'draft';$('#actAmount').value=record.amount?String(record.amount).replace('.',','):'';$('#actDescription').value=record.description||'';modal('#actEditModal',true);
}
function saveActEditor(){
  const ctx=financeEditContext;if(ctx?.type!=='act')return;const p=active(),a=ctx.record;
  a.number=$('#actNumber').value.trim()||a.number;a.date=$('#actDate').value||todayIso();a.estimateId=$('#actEstimate').value||null;a.status=$('#actStatus').value;a.amount=moneyNumber($('#actAmount').value);a.description=$('#actDescription').value.trim();
  if(ctx.isNew)p.acts.push(a);modal('#actEditModal',false);save(false);render();
}

function renderPayments(){
  const p=active(),body=$('#paymentsBody');if(!p||!body)return;const ps=p.payments||[];
  if(!ps.length){body.innerHTML='<div class="finance-empty">Поступлений пока нет. Добавляй каждую оплату отдельно — с датой и привязкой к смете.</div>';return}
  body.innerHTML='<div class="payment-list">'+ps.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(pay=>{const e=estimateFiles(p).find(x=>x.id===pay.estimateId);return '<div class="payment-card payment-row"><div class="payment-main"><strong>'+esc(formatRub(pay.amount||0))+'</strong><div class="payment-meta">'+esc(pay.date||'')+' · '+esc(e?.estimateNumber||'Без привязки')+'</div></div><div>'+esc(pay.note||'')+'</div><div><span class="status-badge approved">Получено</span></div><div class="record-actions"><button class="btn edit-payment" data-id="'+esc(pay.id)+'">Изменить</button><button class="btn danger delete-payment" data-id="'+esc(pay.id)+'">Удалить</button></div></div>'}).join('')+'</div>';
  body.querySelectorAll('.edit-payment').forEach(b=>b.onclick=()=>openPaymentEditor(ps.find(x=>x.id===b.dataset.id)));
  body.querySelectorAll('.delete-payment').forEach(b=>b.onclick=()=>{const pay=ps.find(x=>x.id===b.dataset.id);if(pay&&confirm('Удалить оплату '+formatRub(pay.amount)+'?')){p.payments=p.payments.filter(x=>x.id!==pay.id);save(false);render()}});
}
function openPaymentEditor(payment){
  const p=active();if(!p)return;const record=payment||{id:financeId('pay'),date:todayIso(),amount:0,estimateId:'',note:'',createdAt:Date.now()};financeEditContext={type:'payment',record,isNew:!payment};$('#paymentDate').value=record.date||todayIso();$('#paymentAmount').value=record.amount?String(record.amount).replace('.',','):'';$('#paymentEstimate').innerHTML=estimateSelectOptions(p,record.estimateId,true);$('#paymentNote').value=record.note||'';modal('#paymentEditModal',true);setTimeout(()=>$('#paymentAmount').focus(),0);
}
function savePaymentEditor(){
  const ctx=financeEditContext;if(ctx?.type!=='payment')return;const p=active(),pay=ctx.record;const amount=moneyNumber($('#paymentAmount').value);if(!(amount>0)){toast('Укажите сумму оплаты.',true);return}pay.date=$('#paymentDate').value||todayIso();pay.amount=amount;pay.estimateId=$('#paymentEstimate').value||null;pay.note=$('#paymentNote').value.trim();if(ctx.isNew)p.payments.push(pay);modal('#paymentEditModal',false);save(false);render();
}

async function deleteProjectFile(project,meta){try{if(meta.id)await dbDelete(meta.id)}catch(e){console.error(e)}project.files=project.files.filter(f=>f.id!==meta.id);save(false);render()}
renderFiles=function(){
  const p=active(),b=$('#files');if(!p||!b)return;const docs=projectDocuments(p);b.innerHTML='';
  if(!docs.length){b.innerHTML='<div class="finance-empty">Договоров и прочих документов пока нет.</div>';return}
  const grid=document.createElement('div');grid.className='doc-grid';
  docs.forEach(f=>{const card=document.createElement('div');card.className='doc-card';const type=f.documentType==='contract'?'ДОГ':'ФАЙЛ';card.innerHTML='<div class="doc-type">'+type+'</div><div class="doc-body"><div class="doc-name">'+esc(f.name)+'</div><div class="doc-meta">'+(f.documentType==='contract'?'Договор':'Документ')+' · '+bytes(f.size)+'</div></div><div class="doc-buttons"><button class="btn compact open-doc">Открыть</button><button class="btn compact download-doc">Скачать</button><button class="btn compact danger delete-doc">Удалить</button></div>';card.querySelector('.open-doc').onclick=()=>openFile(f);card.querySelector('.download-doc').onclick=()=>downloadFile(f);card.querySelector('.delete-doc').onclick=()=>deleteProjectFile(p,f);grid.appendChild(card)});b.appendChild(grid);
}
async function renderPhotos(){
  photoObjectUrls.forEach(u=>URL.revokeObjectURL(u));photoObjectUrls=[];
  const p=active(),body=$('#photosBody');if(!p||!body)return;const photos=photoFiles(p);body.innerHTML='';if(!photos.length){body.innerHTML='<div class="finance-empty">Фотографий пока нет. Добавляй фото по ходу работ — они останутся привязаны к объекту.</div>';return}
  const grid=document.createElement('div');grid.className='photo-grid';body.appendChild(grid);
  for(const f of photos){const card=document.createElement('div');card.className='photo-card';card.innerHTML='<button class="photo-open"><div class="photo-thumb">Загрузка…</div><div class="photo-name">'+esc(f.photoCaption||f.name)+'</div><div class="photo-meta">'+bytes(f.size)+'</div></button><div class="record-actions" style="margin-top:7px"><button class="btn compact caption-photo">Подпись</button><button class="btn compact danger delete-photo">Удалить</button></div>';card.querySelector('.photo-open').onclick=()=>openFile(f);card.querySelector('.caption-photo').onclick=()=>{const text=prompt('Подпись к фотографии:',f.photoCaption||'');if(text!==null){f.photoCaption=text.trim();save(false);render()}};card.querySelector('.delete-photo').onclick=()=>deleteProjectFile(p,f);grid.appendChild(card);try{const r=await dbGet(f.id),blob=ensureBlob(r,f);if(blob){const u=URL.createObjectURL(blob);photoObjectUrls.push(u);const img=document.createElement('img');img.src=u;img.alt=f.photoCaption||f.name;const thumb=card.querySelector('.photo-thumb');thumb.textContent='';thumb.appendChild(img)}}catch(e){console.error(e)}}
}

function renderFinanceWorkspace(){
  ensureAllFinanceModels();ensureFinanceWorkspace();ensureFinanceModals();ensureDocumentControls();renderGlobalFinance();renderProjectFinance();renderEstimates();renderActs();renderPayments();renderFiles();renderPhotos();
  const p=active();if(p){const es=estimateFiles(p),confirmed=es.filter(e=>e.estimateConfirmed===true).length,pending=es.filter(e=>e.estimateConfirmed!==true).length;if($('#overviewConfirmed'))$('#overviewConfirmed').textContent=String(confirmed);if($('#overviewPending'))$('#overviewPending').textContent=String(pending);const c=$('#overviewPending')?.closest('.overview-card');if(c)c.classList.toggle('has-pending',pending>0);if($('#overviewDocs'))$('#overviewDocs').textContent=String(projectDocuments(p).length+photoFiles(p).length+es.length)}
}

const financeBaseRender=render;
render=function(){financeBaseRender();renderFinanceWorkspace()};

ensureFinanceWorkspace();ensureFinanceModals();renderFinanceWorkspace();
