const ACT_TEMPLATE_VERSION=2;
const ACT_LEGAL_TEXT='Подписанием настоящего Акта стороны подтверждают факт выполнения и приёмки перечисленных в нём работ в указанном объёме и по указанной стоимости. Выявленные при приёмке замечания, при их наличии, фиксируются сторонами письменно. Подписание настоящего Акта не ограничивает права сторон, предусмотренные договором и применимым законодательством, в том числе в отношении скрытых недостатков и гарантийных обязательств. Настоящий Акт является основанием для взаиморасчётов в соответствии с условиями договора и/или согласованной сметы с учётом фактически произведённых платежей. Акт составлен в двух экземплярах, имеющих одинаковую силу, по одному для каждой стороны.';
let estimateProgressSyncLock=false;

function roundMoneyValue(value){return Math.round((Number(value)||0)*100)/100}
function roundPercentValue(value){return Math.round((Number(value)||0)*100)/100}
function editableNumber(value){
  const n=Number(value)||0;
  return String(Number.isInteger(n)?n:Math.round(n*100)/100).replace('.',',');
}
function currentEstimateForModal(){return financeEditContext?.type==='estimate'?financeEditContext.record:null}

function syncCompletedFromPercent(){
  if(estimateProgressSyncLock)return;
  const estimate=currentEstimateForModal();if(!estimate)return;
  const total=estimateAmount(estimate);
  const percent=Math.max(0,Math.min(100,Number(String($('#estimateMetaPercent')?.value||'0').replace(',','.'))||0));
  estimateProgressSyncLock=true;
  if($('#estimateMetaCompleted'))$('#estimateMetaCompleted').value=editableNumber(roundMoneyValue(total*percent/100));
  estimateProgressSyncLock=false;
  updateEstimateProgressHint(total,percent,roundMoneyValue(total*percent/100));
}
function syncPercentFromCompleted(){
  if(estimateProgressSyncLock)return;
  const estimate=currentEstimateForModal();if(!estimate)return;
  const total=estimateAmount(estimate);
  const amount=Math.max(0,Math.min(total||Infinity,parseMoney($('#estimateMetaCompleted')?.value)||0));
  const percent=total>0?Math.min(100,roundPercentValue(amount/total*100)):0;
  estimateProgressSyncLock=true;
  if($('#estimateMetaPercent'))$('#estimateMetaPercent').value=editableNumber(percent);
  estimateProgressSyncLock=false;
  updateEstimateProgressHint(total,percent,amount);
}
function updateEstimateProgressHint(total,percent,amount){
  const hint=$('#estimateProgressFormulaHint');if(!hint)return;
  hint.textContent=total>0?`Расчёт: ${formatRub(total)} × ${editableNumber(percent)}% = ${formatRub(amount)}`:'Сначала подтвердите итоговую сумму сметы — после этого процент и сумма будут пересчитываться автоматически.';
}
function installEstimateProgressFormula(){
  const percent=$('#estimateMetaPercent'),completed=$('#estimateMetaCompleted');
  if(!percent||!completed||percent.dataset.formulaReady==='1')return;
  percent.dataset.formulaReady='1';completed.dataset.formulaReady='1';
  percent.addEventListener('input',syncCompletedFromPercent);
  completed.addEventListener('input',syncPercentFromCompleted);
  const parent=completed.closest('.full')||completed.parentElement;
  if(parent&&!$('#estimateProgressFormulaHint')){
    const hint=document.createElement('div');hint.id='estimateProgressFormulaHint';hint.className='small';hint.style.marginTop='6px';parent.appendChild(hint);
  }
}

const progressBaseOpenEstimateMeta=openEstimateMeta;
openEstimateMeta=function(estimate){
  progressBaseOpenEstimateMeta(estimate);
  installEstimateProgressFormula();
  const total=estimateAmount(estimate),amount=moneyNumber(estimate.estimateCompletedAmount),percent=Number(estimate.estimateCompletionPercent)||0;
  updateEstimateProgressHint(total,percent,amount);
};

const progressBaseSaveEstimateMeta=saveEstimateMeta;
saveEstimateMeta=function(){
  const estimate=currentEstimateForModal();
  if(estimate&&estimate.estimateConfirmed===true){
    const total=estimateAmount(estimate);
    let percent=Math.max(0,Math.min(100,Number(String($('#estimateMetaPercent')?.value||'0').replace(',','.'))||0));
    let amount=parseMoney($('#estimateMetaCompleted')?.value);
    if(!Number.isFinite(amount))amount=roundMoneyValue(total*percent/100);
    amount=Math.max(0,Math.min(total,amount));
    percent=total>0?roundPercentValue(amount/total*100):percent;
    $('#estimateMetaPercent').value=editableNumber(percent);
    $('#estimateMetaCompleted').value=editableNumber(amount);
  }
  progressBaseSaveEstimateMeta();
};

function shouldSkipActLine(line){
  const s=String(line||'').replace(/\s+/g,' ').trim();
  if(!s)return true;
  if(/^(?:смета|объект|заказчик|подрядчик|исполнитель|дата|адрес|телефон|e-?mail|страница|примечани)/i.test(s))return true;
  if(/^(?:итог|итого|всего|к оплате|итоговая сумма|общая сумма|общая стоимость)\b/i.test(s))return true;
  if(/(?:итого|всего).*(?:раздел|этап|добавленн|дополнительн)/i.test(s))return true;
  if(/(?:^|\s)№\s*(?:п\/п)?\s+.*наименован.*(?:ед|кол|цена|стоим)/i.test(s))return true;
  if(/наименование\s+(?:работ|услуг).*(?:ед|кол|цена|стоим)/i.test(s))return true;
  if(/^(?:подпись|заказчик\s*\/|подрядчик\s*\/)/i.test(s))return true;
  return false;
}
function looksLikeActPosition(line){
  const s=String(line||'');
  if(!/[А-Яа-яA-Za-z]/.test(s)||!/\d/.test(s))return false;
  if(/^\s*\d+[.)]?\s+/.test(s))return true;
  if(/(?:м²|м2|м\s*\.\s*п|м\.п\.?|п\.м\.?|шт\.?|компл\.?|комплект|кг\.?|л\.?)(?:\s|$)/i.test(s))return true;
  return moneyValues(s).length>=2&&s.length>12;
}
function extractActPositionLines(pages){
  const all=[];pages.forEach(lines=>lines.forEach(line=>all.push(String(line||'').replace(/\s+/g,' ').trim())));
  const candidateIndexes=[];
  all.forEach((line,i)=>{if(!shouldSkipActLine(line)&&looksLikeActPosition(line))candidateIndexes.push(i)});
  if(!candidateIndexes.length)return all.filter(line=>!shouldSkipActLine(line)&&looksLikeActPosition(line)).slice(0,250);
  const start=candidateIndexes[0],end=candidateIndexes[candidateIndexes.length-1];
  const region=all.slice(start,end+1).filter(line=>!shouldSkipActLine(line));
  const cleaned=[];
  for(const line of region){
    if(!line)continue;
    if(cleaned[cleaned.length-1]===line)continue;
    if(/[А-Яа-яA-Za-z]/.test(line)||looksLikeActPosition(line))cleaned.push(line);
  }
  return cleaned.slice(0,300);
}
function actUnitMatch(text){
  const re=/(м²|м2|м\.\s*п\.?|м\.п\.?|п\.м\.?|шт\.?|компл\.?|комплект(?:а|ов)?|кг\.?|л\.?)(?=\s|$)/i;
  return String(text||'').match(re);
}
function structuredActRow(raw,index){
  let text=String(raw||'').replace(/\s+/g,' ').trim();
  const lead=text.match(/^\s*(\d+)[.)]?\s+/);const rowNo=lead?lead[1]:String(index+1);
  if(lead)text=text.slice(lead[0].length).trim();
  const unitMatch=actUnitMatch(text);
  if(!unitMatch)return {no:rowNo,name:text,unit:'',qty:'',price:'',amount:'',raw};
  const unit=unitMatch[1];const before=text.slice(0,unitMatch.index).trim();const after=text.slice((unitMatch.index||0)+unitMatch[0].length).trim();
  const beforeNums=moneyValues(before);const afterNums=moneyValues(after);
  let qty='',price='',amount='',name=before;
  const qtyText=before.match(/(?:^|\s)(\d+(?:[,.]\d{1,3})?)\s*$/);
  if(qtyText){qty=qtyText[1];name=before.slice(0,qtyText.index).trim()}
  if(!qty&&afterNums.length>=3)qty=editableNumber(afterNums[0]);
  if(afterNums.length>=2){price=editableNumber(afterNums[afterNums.length-2]);amount=editableNumber(afterNums[afterNums.length-1])}
  else if(afterNums.length===1)amount=editableNumber(afterNums[0]);
  if(!name)name=text;
  return {no:rowNo,name,unit,qty,price,amount,raw};
}

async function saveEstimatePositionsToAct(project,estimate,act,force=false){
  if(!project||!estimate||!act)return act;
  act.templateVersion=ACT_TEMPLATE_VERSION;
  act.legalText=ACT_LEGAL_TEXT;
  if(!force&&Array.isArray(act.items)&&act.items.length&&act.sourceEstimateId===estimate.id)return act;
  act.sourceEstimateId=estimate.id;
  act.sourceEstimateName=estimate.estimateNumber||estimate.name||'';
  if(!isPdf(estimate)){
    act.items=Array.isArray(act.items)?act.items:[];
    act.itemsSource='unsupported';
    return act;
  }
  try{
    const stored=await dbGet(estimate.id),blob=ensureBlob(stored,estimate);
    if(!blob){act.items=[];act.itemsSource='missing';return act}
    const pages=await pdfTextLines(blob);
    const lines=extractActPositionLines(pages);
    act.items=lines.map((line,i)=>structuredActRow(line,i));
    act.itemsSource='pdf-text';
    act.itemsCapturedAt=Date.now();
  }catch(e){
    console.error('ACT_ITEMS_EXTRACT_FAILED',e);
    act.items=Array.isArray(act.items)?act.items:[];
    act.itemsSource='error';
  }
  return act;
}

const actItemsBaseClosedEstimateAct=closedEstimateAct;
closedEstimateAct=function(project,estimate){
  const act=actItemsBaseClosedEstimateAct(project,estimate);
  if(act){
    act.templateVersion=ACT_TEMPLATE_VERSION;
    act.legalText=ACT_LEGAL_TEXT;
    act.description='Перечень выполненных работ сформирован по позициям закрытой сметы '+(estimate.estimateNumber||estimate.name||'')+'.';
  }
  return act;
};

async function finalizeClosedEstimateWithItems(project,estimate){
  const act=closedEstimateAct(project,estimate);
  if(act)await saveEstimatePositionsToAct(project,estimate,act,true);
  save(false);render();
  return act;
}

changeEstimateStatus=async function(project,estimate,status){
  estimate.estimateStatus=status;
  if(['approved','in_progress','closed'].includes(status)){
    estimate.approvedAt=estimate.approvedAt||Date.now();
    ensureDraftAct(project,estimate,false);
  }
  save(false);render();
  if(['approved','in_progress','closed'].includes(status)&&estimate.estimateConfirmed!==true){
    setTimeout(()=>editEstimateTotal(project,estimate),50);
    return;
  }
  if(status==='closed'){
    toast('Формирую акт по позициям сметы…');
    await finalizeClosedEstimateWithItems(project,estimate);
    toast('Смета закрыта. Акт сформирован по позициям сметы на сумму '+formatRub(estimateAmount(estimate))+'.');
  }
};

const actItemsBaseSaveEstimateConfirmation=saveEstimateConfirmation;
saveEstimateConfirmation=function(){
  const ctx=estimateConfirmCurrent;const project=ctx?.project;const estimate=ctx?.meta;
  actItemsBaseSaveEstimateConfirmation();
  if(project&&estimate?.estimateStatus==='closed'&&estimate.estimateConfirmed===true){
    setTimeout(async()=>{
      toast('Формирую акт по позициям сметы…');
      await finalizeClosedEstimateWithItems(project,estimate);
      toast('Итог подтверждён. Акт сформирован по позициям сметы.');
    },60);
  }
};

function actRowsHtml(items){
  const rows=Array.isArray(items)?items:[];
  if(!rows.length)return '<tr><td colspan="6" class="empty-row">Позиции сметы не удалось извлечь автоматически. Проверьте исходный PDF перед подписанием акта.</td></tr>';
  return rows.map((r,i)=>`<tr><td class="c">${esc(r.no||i+1)}</td><td>${esc(r.name||r.raw||'')}</td><td class="c">${esc(r.unit||'')}</td><td class="n">${esc(r.qty||'')}</td><td class="n">${r.price?esc(r.price)+' ₽':''}</td><td class="n">${r.amount?esc(r.amount)+' ₽':''}</td></tr>`).join('');
}

openPrintableAct=async function(project,act){
  if(!project||!act)return;
  const w=window.open('about:blank','_blank');
  if(!w){toast('Браузер заблокировал окно акта. Разрешите всплывающие окна для сайта.',true);return}
  try{
    const estimate=estimateFiles(project).find(e=>e.id===act.estimateId);
    if(estimate&&(!Array.isArray(act.items)||!act.items.length)&&isPdf(estimate)){
      w.document.write('<!doctype html><meta charset="utf-8"><title>Формирование акта</title><body style="font-family:Arial;padding:30px">Формирую акт по позициям сметы…</body>');
      await saveEstimatePositionsToAct(project,estimate,act,false);save(false);
    }
    const amount=moneyNumber(act.amount),title=act.number||'Акт выполненных работ';
    const client=project.client||'____________________________',projectName=project.name||'Объект';
    const estimateName=estimate?.estimateNumber||estimate?.name||act.sourceEstimateName||'Согласованная смета';
    const statusLabel=ACT_STATUSES[act.status]||act.status||'Черновик';
    const legal=act.legalText||ACT_LEGAL_TEXT;
    w.document.open();
    w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
    *{box-sizing:border-box}body{margin:0;background:#eef1f5;color:#111;font-family:Arial,Helvetica,sans-serif}.sheet{width:210mm;min-height:297mm;margin:18px auto;background:#fff;padding:15mm 14mm;box-shadow:0 10px 35px rgba(0,0,0,.12)}.toolbar{width:210mm;margin:16px auto 0;display:flex;justify-content:flex-end;gap:8px}.toolbar button{border:1px solid #d1d5db;background:white;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}.toolbar .primary{background:#111827;color:white;border-color:#111827}h1{text-align:center;font-size:19px;margin:5px 0 4px;text-transform:uppercase}.subtitle{text-align:center;font-size:12px;margin-bottom:20px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;margin-bottom:18px;font-size:13px}.meta div{border-bottom:1px solid #bbb;padding:5px 0}.label{color:#555;font-size:11px;display:block;margin-bottom:2px}.intro{font-size:13px;line-height:1.45;margin:16px 0 10px}.works{width:100%;border-collapse:collapse;font-size:10.5px}.works th,.works td{border:1px solid #888;padding:5px 5px;vertical-align:top}.works th{background:#f3f4f6;text-align:center;font-weight:700}.works .c{text-align:center;width:7%}.works .n{text-align:right;white-space:nowrap}.empty-row{text-align:center;color:#8a4b00;padding:12px!important}.amount{margin-top:14px;border:2px solid #111;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;font-size:14px}.amount strong{font-size:18px}.legal{margin-top:18px;font-size:11.5px;line-height:1.5;text-align:justify}.status{display:inline-block;margin-top:12px;padding:4px 8px;border:1px solid #bbb;border-radius:999px;font-size:10px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:38px}.sign{font-size:12px}.line{border-bottom:1px solid #111;height:30px;margin-top:8px}.hint{font-size:10px;color:#666;margin-top:4px;text-align:center}@media print{body{background:#fff}.toolbar{display:none}.sheet{box-shadow:none;margin:0;width:auto;min-height:auto;padding:10mm}@page{size:A4;margin:0}.works{font-size:9.5px}tr{break-inside:avoid}}
    </style></head><body><div class="toolbar"><button onclick="window.close()">Закрыть</button><button class="primary" onclick="window.print()">Печать / PDF</button></div><main class="sheet">
    <h1>Акт сдачи-приёмки выполненных работ</h1><div class="subtitle">${esc(title)} · к ${esc(estimateName)}</div>
    <div class="meta"><div><span class="label">Объект</span>${esc(projectName)}</div><div><span class="label">Дата акта</span>${esc(actPrintDate(act.date)||'________________')}</div><div><span class="label">Заказчик</span>${esc(client)}</div><div><span class="label">Подрядчик</span>____________________________</div></div>
    <div class="intro">Подрядчик выполнил, а Заказчик предъявленные к приёмке работы принимает по следующему перечню:</div>
    <table class="works"><thead><tr><th>№</th><th>Наименование работ / позиция сметы</th><th>Ед.</th><th>Кол-во</th><th>Цена</th><th>Стоимость</th></tr></thead><tbody>${actRowsHtml(act.items)}</tbody></table>
    <div class="amount"><span>Итого по настоящему Акту</span><strong>${esc(formatRub(amount))}</strong></div>
    <div class="legal">${esc(legal)}</div><div class="status">Статус документа: ${esc(statusLabel)}</div>
    <div class="signatures"><div class="sign"><strong>Подрядчик</strong><div class="line"></div><div class="hint">подпись / ФИО / реквизиты</div></div><div class="sign"><strong>Заказчик: ${esc(client)}</strong><div class="line"></div><div class="hint">подпись / ФИО / реквизиты</div></div></div>
    </main></body></html>`);
    w.document.close();w.focus();
  }catch(e){console.error(e);w.document.body.innerHTML='<div style="font-family:Arial;padding:30px">Не удалось сформировать акт. Закройте окно и попробуйте ещё раз.</div>'}
};

const actItemsBaseRenderActs=renderActs;
renderActs=function(){
  actItemsBaseRenderActs();
  const subtitle=$('#actsPanel .section-title .small');
  if(subtitle)subtitle.textContent='При закрытии сметы акт формируется на полную сумму и переносит позиции из исходной сметы';
};

installEstimateProgressFormula();
setTimeout(async()=>{
  let changed=false;
  for(const project of state.projects||[]){
    for(const estimate of estimateFiles(project)){
      if(estimate.estimateStatus!=='closed'||estimate.estimateConfirmed!==true)continue;
      const act=closedEstimateAct(project,estimate);
      if(act&&(!Array.isArray(act.items)||!act.items.length)){
        await saveEstimatePositionsToAct(project,estimate,act,false);changed=true;
      }
    }
  }
  if(changed){save(false);render()}
},350);
