function closedEstimateAct(project,estimate){
  if(!project||!estimate)return null;
  const act=ensureDraftAct(project,estimate,false);
  const amount=estimateAmount(estimate);
  estimate.estimateCompletionPercent=100;
  estimate.estimateCompletedAmount=amount;
  if(act){
    act.amount=amount;
    act.date=act.date||todayIso();
    act.autoFilledOnClose=true;
    act.updatedAt=Date.now();
    if(!String(act.description||'').trim()){
      act.description='Работы по '+(estimate.estimateNumber||estimate.name||'смете')+' выполнены в полном объёме.';
    }
  }
  return act;
}

changeEstimateStatus=function(project,estimate,status){
  estimate.estimateStatus=status;
  if(['approved','in_progress','closed'].includes(status)){
    estimate.approvedAt=estimate.approvedAt||Date.now();
    ensureDraftAct(project,estimate,false);
  }
  if(status==='closed'&&estimate.estimateConfirmed===true){
    closedEstimateAct(project,estimate);
  }
  save(false);
  render();
  if(['approved','in_progress','closed'].includes(status)&&estimate.estimateConfirmed!==true){
    setTimeout(()=>editEstimateTotal(project,estimate),50);
  }else if(status==='closed'){
    toast('Смета закрыта. Акт сформирован на сумму '+formatRub(estimateAmount(estimate))+'.');
  }
};

const actCloseBaseSaveEstimateMeta=saveEstimateMeta;
saveEstimateMeta=function(){
  const ctx=financeEditContext;
  actCloseBaseSaveEstimateMeta();
  if(ctx?.type==='estimate'&&ctx.record?.estimateStatus==='closed'&&ctx.record.estimateConfirmed===true){
    const project=active();
    closedEstimateAct(project,ctx.record);
    save(false);
    render();
    toast('Смета закрыта. Акт сформирован на сумму '+formatRub(estimateAmount(ctx.record))+'.');
  }
};

const actCloseBaseSaveEstimateConfirmation=saveEstimateConfirmation;
saveEstimateConfirmation=function(){
  const ctx=estimateConfirmCurrent;
  const project=ctx?.project;
  const estimate=ctx?.meta;
  actCloseBaseSaveEstimateConfirmation();
  if(project&&estimate?.estimateStatus==='closed'&&estimate.estimateConfirmed===true){
    closedEstimateAct(project,estimate);
    save(false);
    render();
    toast('Итог подтверждён. Акт сформирован на сумму '+formatRub(estimateAmount(estimate))+'.');
  }
};

function actPrintDate(value){
  if(!value)return '';
  const d=new Date(value+'T00:00:00');
  if(Number.isNaN(d.getTime()))return value;
  return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'long',year:'numeric'}).format(d);
}

function openPrintableAct(project,act){
  if(!project||!act)return;
  const estimate=estimateFiles(project).find(e=>e.id===act.estimateId);
  const w=window.open('','_blank');
  if(!w){toast('Браузер заблокировал окно акта. Разрешите всплывающие окна для сайта.',true);return}
  const amount=moneyNumber(act.amount);
  const title=act.number||'Акт выполненных работ';
  const description=String(act.description||'Работы выполнены в соответствии с согласованной сметой.').trim();
  const client=project.client||'____________________________';
  const projectName=project.name||'Объект';
  const estimateName=estimate?.estimateNumber||estimate?.name||'Согласованная смета';
  const statusLabel=ACT_STATUSES[act.status]||act.status||'Черновик';
  w.document.open();
  w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#111;font-family:Arial,Helvetica,sans-serif}.sheet{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:20mm 18mm;box-shadow:0 10px 35px rgba(0,0,0,.12)}.toolbar{width:210mm;margin:16px auto 0;display:flex;justify-content:flex-end;gap:8px}.toolbar button{border:1px solid #d1d5db;background:white;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}.toolbar .primary{background:#111827;color:white;border-color:#111827}h1{text-align:center;font-size:22px;margin:8px 0 4px;text-transform:uppercase}.subtitle{text-align:center;font-size:13px;margin-bottom:28px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;margin-bottom:25px;font-size:14px}.meta div{border-bottom:1px solid #bbb;padding:6px 0}.label{color:#555;font-size:12px;display:block;margin-bottom:3px}.section{margin-top:24px;font-size:14px;line-height:1.55}.amount{margin-top:28px;border:2px solid #111;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;font-size:16px}.amount strong{font-size:20px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:55px;margin-top:70px}.sign{font-size:14px}.line{border-bottom:1px solid #111;height:34px;margin-top:12px}.hint{font-size:11px;color:#666;margin-top:5px;text-align:center}.status{display:inline-block;padding:5px 9px;border:1px solid #bbb;border-radius:999px;font-size:12px}@media print{body{background:#fff}.toolbar{display:none}.sheet{box-shadow:none;margin:0;width:auto;min-height:auto;padding:15mm 15mm}@page{size:A4;margin:0}}</style></head><body>
  <div class="toolbar"><button onclick="window.close()">Закрыть</button><button class="primary" onclick="window.print()">Печать / PDF</button></div>
  <main class="sheet">
    <h1>Акт выполненных работ</h1>
    <div class="subtitle">${esc(title)}</div>
    <div class="meta">
      <div><span class="label">Объект</span>${esc(projectName)}</div>
      <div><span class="label">Дата акта</span>${esc(actPrintDate(act.date)||'________________')}</div>
      <div><span class="label">Заказчик</span>${esc(client)}</div>
      <div><span class="label">Основание</span>${esc(estimateName)}</div>
    </div>
    <div class="section"><strong>Выполненные работы</strong><p>${esc(description)}</p></div>
    <div class="amount"><span>Стоимость выполненных работ</span><strong>${esc(formatRub(amount))}</strong></div>
    <div class="section">Работы выполнены в полном объёме. Стороны подтверждают объём и стоимость выполненных работ по указанной смете. Претензии по объёму и качеству указываются при подписании акта.</div>
    <div class="section"><span class="status">Статус: ${esc(statusLabel)}</span></div>
    <div class="signatures">
      <div class="sign"><strong>Подрядчик</strong><div class="line"></div><div class="hint">подпись / ФИО</div></div>
      <div class="sign"><strong>Заказчик: ${esc(client)}</strong><div class="line"></div><div class="hint">подпись / ФИО</div></div>
    </div>
  </main></body></html>`);
  w.document.close();
  w.focus();
}

renderActs=function(){
  const project=active(),body=$('#actsBody');if(!project||!body)return;
  const acts=project.acts||[];
  const subtitle=$('#actsPanel .section-title .small');
  if(subtitle)subtitle.textContent='При закрытии сметы акт автоматически заполняется на полную сумму сметы';
  if(!acts.length){body.innerHTML='<div class="finance-empty">Актов пока нет. При закрытии сметы акт сформируется автоматически на полную сумму.</div>';return}
  body.innerHTML='<div class="act-list">'+acts.map(act=>{
    const estimate=estimateFiles(project).find(e=>e.id===act.estimateId);
    return '<div class="act-card act-row"><div class="act-main"><strong>'+esc(act.number||'Акт')+'</strong><div class="act-meta">'+esc(estimate?.estimateNumber||'Без привязки к смете')+' · '+esc(act.date||'')+'</div></div><div><span class="status-badge '+esc(act.status||'draft')+'">'+esc(ACT_STATUSES[act.status]||act.status)+'</span></div><div class="num"><strong>'+esc(formatRub(act.amount||0))+'</strong></div><div class="record-actions"><button class="btn open-act" data-id="'+esc(act.id)+'">Открыть</button><button class="btn edit-act" data-id="'+esc(act.id)+'">Заполнить</button><button class="btn danger delete-act" data-id="'+esc(act.id)+'">Удалить</button></div></div>';
  }).join('')+'</div>';
  body.querySelectorAll('.open-act').forEach(b=>b.onclick=()=>{const act=acts.find(a=>a.id===b.dataset.id);if(act)openPrintableAct(project,act)});
  body.querySelectorAll('.edit-act').forEach(b=>b.onclick=()=>openActEditor(acts.find(a=>a.id===b.dataset.id)));
  body.querySelectorAll('.delete-act').forEach(b=>b.onclick=()=>{const act=acts.find(a=>a.id===b.dataset.id);if(act&&confirm('Удалить '+act.number+'?')){project.acts=project.acts.filter(x=>x.id!==act.id);save(false);render()}});
};

for(const project of state.projects||[]){
  for(const estimate of estimateFiles(project)){
    if(estimate.estimateStatus==='closed'&&estimate.estimateConfirmed===true)closedEstimateAct(project,estimate);
  }
}
save(false);
render();
