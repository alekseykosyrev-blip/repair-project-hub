(()=>{
const n=v=>typeof moneyNumber==='function'?moneyNumber(v):(Number(String(v||'').replace(/[^\d.,-]/g,'').replace(',','.'))||0);
const id=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
function ensure(p){if(!p)return;p.acts=Array.isArray(p.acts)?p.acts:[];p.payments=Array.isArray(p.payments)?p.payments:[];p.paymentCorrections=Array.isArray(p.paymentCorrections)?p.paymentCorrections:[];p.financeHistory=Array.isArray(p.financeHistory)?p.financeHistory:[];p.acts.forEach(a=>{a.createdAt=a.createdAt||Date.now();if(a.status==='signed'){a.signedAt=a.signedAt||a.updatedAt||a.createdAt;a.locked=true}});p.payments.forEach(x=>{x.createdAt=x.createdAt||Date.now();x.locked=true})}
function log(p,type,data){ensure(p);p.financeHistory.unshift({id:id('fh'),type,at:Date.now(),data:JSON.parse(JSON.stringify(data||{}))});p.financeHistory=p.financeHistory.slice(0,300)}
function cap(p,estimateId){const e=(typeof estimateFiles==='function'?estimateFiles(p):(p.files||[])).find(x=>x.id===estimateId);return e&&typeof estimateAmount==='function'?estimateAmount(e):0}
function signed(p,estimateId,except){return (p.acts||[]).filter(a=>a.id!==except&&a.estimateId===estimateId&&a.status==='signed').reduce((s,a)=>s+n(a.amount),0)}
function paid(p,estimateId){return (p.payments||[]).filter(x=>x.estimateId===estimateId).reduce((s,x)=>s+n(x.amount),0)}
function installHints(){const m=document.getElementById('actEditModal');if(m&&!m.querySelector('.partial-act-hint'))m.querySelector('.finance-modal-grid')?.insertAdjacentHTML('beforeend','<div class="full partial-act-hint small">Можно создавать несколько частичных актов по одной смете. Сумма подписанных актов не может превышать согласованную сумму. Подписанный акт блокируется от изменения.</div>');const p=document.getElementById('paymentEditModal');if(p&&!p.querySelector('.payment-history-hint'))p.querySelector('.finance-modal-grid')?.insertAdjacentHTML('beforeend','<div class="full payment-history-hint small">Оплата сохраняется как финансовая запись. Для исправления ошибочной оплаты создайте корректировку ниже: исходная запись останется в истории.</div>')}
const baseEnsure=window.ensureFinanceModel;if(typeof baseEnsure==='function')window.ensureFinanceModel=function(p){const r=baseEnsure.apply(this,arguments);ensure(p);return r};
const baseOpen=window.openActEditor;if(typeof baseOpen==='function')window.openActEditor=function(act){const p=active();ensure(p);if(act&&act.status==='signed'){toast('Подписанный акт защищён от изменения',true);return}const r=baseOpen.apply(this,arguments);installHints();return r};
const baseSaveAct=window.saveActEditor;if(typeof baseSaveAct==='function')window.saveActEditor=function(){const p=active();ensure(p);const ctx=window.financeEditContext||financeEditContext;const old=ctx?.record;if(old?.status==='signed'){toast('Подписанный акт защищён от изменения',true);return}const estimateId=document.getElementById('actEstimate')?.value||old?.estimateId;const amount=n(document.getElementById('actAmount')?.value);const status=document.getElementById('actStatus')?.value;const maximum=cap(p,estimateId),already=signed(p,estimateId,old?.id);if(status==='signed'&&maximum>0&&already+amount>maximum+.01){toast('Сумма подписанных актов превышает согласованную смету',true);return}const before=old?JSON.parse(JSON.stringify(old)):null;const beforeIds=new Set(p.acts.map(a=>a.id));const r=baseSaveAct.apply(this,arguments);const newest=old?p.acts.find(a=>a.id===old.id):p.acts.find(a=>!beforeIds.has(a.id));if(newest&&(!before||JSON.stringify(before)!==JSON.stringify(newest))){if(newest.status==='signed'){newest.signedAt=newest.signedAt||Date.now();newest.locked=true}log(p,before?'act_updated':'act_created',{before,after:newest});save(false)}return r};
const baseSavePay=window.savePaymentEditor;if(typeof baseSavePay==='function')window.savePaymentEditor=function(){const p=active();ensure(p);const beforeIds=new Set(p.payments.map(x=>x.id));const r=baseSavePay.apply(this,arguments);const x=p.payments.find(v=>!beforeIds.has(v.id));if(x){x.locked=true;x.createdAt=x.createdAt||Date.now();log(p,'payment_created',x);save(false)}return r};
function paymentCorrection(project,paymentId,reason){
 ensure(project);
 const original=project.payments.find(x=>x.id===paymentId);
 if(!original)throw Error('Исходная оплата не найдена');
 const note=String(reason||'').trim();
 if(note.length<5)throw Error('Укажите причину корректировки (не менее 5 символов)');
 if(original.correctionId)throw Error('Оплата уже помечена для корректировки');
 const correction={id:id('pc'),paymentId,estimateId:original.estimateId||null,amount:n(original.amount),reason:note,createdAt:Date.now(),status:'pending'};
 project.paymentCorrections=Array.isArray(project.paymentCorrections)?project.paymentCorrections:[];
 project.paymentCorrections.push(correction);
 original.correctionId=correction.id;
 log(project,'payment_correction_requested',{correction,originalPayment:original});
 return correction;
}
window.requestPaymentCorrection=paymentCorrection;
function confirmPaymentCorrection(project,correctionId){
 ensure(project);
 const c=project.paymentCorrections.find(x=>x.id===correctionId);
 if(!c)throw Error('Корректировка не найдена');
 if(c.status!=='pending')throw Error('Корректировка уже обработана');
 const original=project.payments.find(x=>x.id===c.paymentId);
 if(!original||original.correctionId!==c.id)throw Error('Связь с исходной оплатой нарушена');
 if(!Number.isFinite(Number(c.amount))||n(c.amount)!==n(original.amount))throw Error('Сумма исходной оплаты изменилась');
 c.status='confirmed';c.confirmedAt=Date.now();
 log(project,'payment_correction_confirmed',{correctionId:c.id,paymentId:c.paymentId,amount:c.amount,reason:c.reason});
 if(typeof save==='function'){try{save(false)}catch(error){c.status='pending';delete c.confirmedAt;project.financeHistory=project.financeHistory.filter(x=>!(x.type==='payment_correction_confirmed'&&x.data?.correctionId===c.id));throw error}}
 return c;
}
function effectivePaid(project,estimateId){
 ensure(project);
 const reversed=confirmedReversals(project);
 return project.payments.filter(x=>x.estimateId===estimateId&&!reversed.has(x.id)).reduce((sum,x)=>sum+n(x.amount),0);
}
window.confirmPaymentCorrection=confirmPaymentCorrection;
window.effectivePaidForEstimate=effectivePaid;
// Only a confirmed correction linked to the original payment and its unchanged
// amount can remove a receipt from financial totals. Invalid legacy records are ignored.
function confirmedReversals(project){
 ensure(project);
 const reversed=new Set();
 project.paymentCorrections.forEach(c=>{
  if(c.status!=='confirmed')return;
  const original=project.payments.find(p=>p.id===c.paymentId);
  if(!original||original.correctionId!==c.id)return;
  if(!Number.isFinite(Number(c.amount))||n(c.amount)!==n(original.amount))return;
  reversed.add(original.id);
 });
 return reversed;
}
window.effectivePaidForProject=function(project){
 if(!project)return 0;
 const reversed=confirmedReversals(project);
 return project.payments.filter(x=>!reversed.has(x.id)).reduce((sum,x)=>sum+n(x.amount),0);
};
// Use effective confirmed receipts consistently in all finance screens and closure checks.
const originalProjectFinance=typeof window.projectFinance==='function'?window.projectFinance:null;
if(originalProjectFinance)window.projectFinance=function(project){
 const base=originalProjectFinance(project);
 if(!project)return base;
 const received=window.effectivePaidForProject(project);
 return {...base,received,toReceive:Math.max(0,n(base.acted)-received)};
};
if(typeof window.estimatePaid==='function'){
 window.estimatePaid=function(project,estimateId){return effectivePaid(project,estimateId)};
}
function correctionControls(){
 const project=typeof active==='function'?active():null;
 if(!project)return;
 ensure(project);
 const panel=document.getElementById('paymentsPanel')||document.getElementById('paymentsBody');
 if(!panel)return;const existing=panel.querySelector('#paymentCorrectionPanel');if(existing){refreshCorrections(existing,project);return;}
 const box=document.createElement('section');box.id='paymentCorrectionPanel';box.className='measurement-note';
 box.innerHTML='<strong>Корректировка ошибочной оплаты</strong><p class="small">Исходная запись сохраняется. После подтверждения сумма исключается из эффективных поступлений.</p><label class="small" for="correctionPayment">Оплата</label><select id="correctionPayment" style="max-width:100%;width:100%"></select><label class="small" for="correctionReason">Причина</label><input id="correctionReason" placeholder="Причина исправления" style="max-width:100%;width:100%"><div class="actions"><button class="btn" id="correctionRequest">Создать корректировку</button></div><div id="correctionPending"></div>';
 panel.appendChild(box);
 box.querySelector('#correctionRequest').onclick=()=>{
  const project=typeof active==='function'?active():null;
  if(!project)return;
  ensure(project);
  try{const paymentId=box.querySelector('#correctionPayment').value,reason=box.querySelector('#correctionReason').value;
   const correction=paymentCorrection(project,paymentId,reason);try{if(typeof save==='function')save(false)}catch(error){project.paymentCorrections=project.paymentCorrections.filter(x=>x.id!==correction.id);const original=project.payments.find(x=>x.id===paymentId);if(original&&original.correctionId===correction.id)delete original.correctionId;project.financeHistory=project.financeHistory.filter(x=>!(x.type==='payment_correction_requested'&&x.data?.correction?.id===correction.id));throw error}refreshCorrections(box,project);
   if(typeof toast==='function')toast('Корректировка создана. Подтвердите её отдельно.');
  }catch(err){if(typeof toast==='function')toast(err.message,true)}
 };
 refreshCorrections(box,project);
}
function refreshCorrections(box,project){
 const select=box.querySelector('#correctionPayment');
 const eligible=project.payments.filter(x=>!x.correctionId);
 select.innerHTML=eligible.map(x=>'<option value="'+String(x.id).replace(/["&<>]/g,'')+'">'+String(x.date||'')+' · '+n(x.amount).toLocaleString('ru-RU')+' ₽</option>').join('');
 box.querySelector('#correctionRequest').disabled=!eligible.length;
 const pending=project.paymentCorrections.filter(x=>x.status==='pending');
 const host=box.querySelector('#correctionPending');host.replaceChildren();
 pending.forEach(c=>{
  const row=document.createElement('div');row.className='small';row.style.marginTop='8px';
  const label=document.createElement('span');label.textContent=n(c.amount).toLocaleString('ru-RU')+' ₽ · '+c.reason+' ';
  const btn=document.createElement('button');btn.className='btn';btn.textContent='Подтвердить корректировку';
  btn.onclick=()=>{if(!window.confirm('Исключить эту оплату из эффективных поступлений? Исходная запись останется в истории.'))return;
   try{confirmPaymentCorrection(project,c.id);refreshCorrections(box,project);if(typeof render==='function')render();if(typeof toast==='function')toast('Корректировка подтверждена')}
   catch(err){if(typeof toast==='function')toast(err.message,true)}
  };
  row.append(label,btn);host.append(row);
 });
}

function patchRows(){const p=active();if(!p)return;ensure(p);document.querySelectorAll('[data-act-edit]').forEach(b=>{const a=p.acts.find(x=>x.id===b.dataset.actEdit);if(a?.status==='signed'){b.textContent='Подписан';b.disabled=true;b.title='Подписанный акт защищён'}})}
const baseRender=window.render;if(typeof baseRender==='function')window.render=function(){const r=baseRender.apply(this,arguments);queueMicrotask(()=>{installHints();patchRows();correctionControls()});return r};
function audit(){const p=active();if(!p)return;ensure(p);const issues=[];(p.acts||[]).filter(a=>a.status==='signed').forEach(a=>{const max=cap(p,a.estimateId),total=signed(p,a.estimateId,null);if(max>0&&total>max+.01&&!issues.includes(a.estimateId))issues.push(a.estimateId)});p.financeAudit={checkedAt:Date.now(),overActedEstimateIds:issues,paymentTotal:window.effectivePaidForProject(p),originalPaymentTotal:(p.payments||[]).reduce((s,x)=>s+n(x.amount),0),confirmedCorrections:(p.paymentCorrections||[]).filter(c=>c.status==='confirmed').length,signedActTotal:(p.acts||[]).filter(a=>a.status==='signed').reduce((s,a)=>s+n(a.amount),0)};return p.financeAudit}
window.auditFinanceHistory=audit;
(state.projects||[]).forEach(ensure);installHints();patchRows();correctionControls();
})();