(()=>{
const n=v=>typeof moneyNumber==='function'?moneyNumber(v):(Number(String(v||'').replace(/[^\d.,-]/g,'').replace(',','.'))||0);
const id=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
function ensure(p){if(!p)return;p.acts=Array.isArray(p.acts)?p.acts:[];p.payments=Array.isArray(p.payments)?p.payments:[];p.paymentCorrections=Array.isArray(p.paymentCorrections)?p.paymentCorrections:[];p.financeHistory=Array.isArray(p.financeHistory)?p.financeHistory:[];p.acts.forEach(a=>{a.createdAt=a.createdAt||Date.now();if(a.status==='signed'){a.signedAt=a.signedAt||a.updatedAt||a.createdAt;a.locked=true}});p.payments.forEach(x=>{x.createdAt=x.createdAt||Date.now();x.locked=true})}
function log(p,type,data){ensure(p);p.financeHistory.unshift({id:id('fh'),type,at:Date.now(),data:JSON.parse(JSON.stringify(data||{}))});p.financeHistory=p.financeHistory.slice(0,300)}
function cap(p,estimateId){const e=(typeof estimateFiles==='function'?estimateFiles(p):(p.files||[])).find(x=>x.id===estimateId);return e&&typeof estimateAmount==='function'?estimateAmount(e):0}
function signed(p,estimateId,except){return (p.acts||[]).filter(a=>a.id!==except&&a.estimateId===estimateId&&a.status==='signed').reduce((s,a)=>s+n(a.amount),0)}
function paid(p,estimateId){return (p.payments||[]).filter(x=>x.estimateId===estimateId).reduce((s,x)=>s+n(x.amount),0)}
function installHints(){const m=document.getElementById('actEditModal');if(m&&!m.querySelector('.partial-act-hint'))m.querySelector('.finance-modal-grid')?.insertAdjacentHTML('beforeend','<div class="full partial-act-hint small">Можно создавать несколько частичных актов по одной смете. Сумма подписанных актов не может превышать согласованную сумму. Подписанный акт блокируется от изменения.</div>');const p=document.getElementById('paymentEditModal');if(p&&!p.querySelector('.payment-history-hint'))p.querySelector('.finance-modal-grid')?.insertAdjacentHTML('beforeend','<div class="full payment-history-hint small">Оплата сохраняется как финансовая запись. Для исправления ошибочной оплаты удалите её с подтверждением и внесите новую запись.</div>')}
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
 if(typeof save==='function')save(false);
 return c;
}
function effectivePaid(project,estimateId){
 ensure(project);
 const reversed=new Set(project.paymentCorrections.filter(c=>c.status==='confirmed').map(c=>c.paymentId));
 return project.payments.filter(x=>x.estimateId===estimateId&&!reversed.has(x.id)).reduce((sum,x)=>sum+n(x.amount),0);
}
window.confirmPaymentCorrection=confirmPaymentCorrection;
window.effectivePaidForEstimate=effectivePaid;

function patchRows(){const p=active();if(!p)return;ensure(p);document.querySelectorAll('[data-act-edit]').forEach(b=>{const a=p.acts.find(x=>x.id===b.dataset.actEdit);if(a?.status==='signed'){b.textContent='Подписан';b.disabled=true;b.title='Подписанный акт защищён'}})}
const baseRender=window.render;if(typeof baseRender==='function')window.render=function(){const r=baseRender.apply(this,arguments);queueMicrotask(()=>{installHints();patchRows()});return r};
function audit(){const p=active();if(!p)return;ensure(p);const issues=[];(p.acts||[]).filter(a=>a.status==='signed').forEach(a=>{const max=cap(p,a.estimateId),total=signed(p,a.estimateId,null);if(max>0&&total>max+.01&&!issues.includes(a.estimateId))issues.push(a.estimateId)});p.financeAudit={checkedAt:Date.now(),overActedEstimateIds:issues,paymentTotal:(p.payments||[]).filter(x=>!(p.paymentCorrections||[]).some(c=>c.paymentId===x.id&&c.status==='confirmed')).reduce((s,x)=>s+n(x.amount),0),originalPaymentTotal:(p.payments||[]).reduce((s,x)=>s+n(x.amount),0),confirmedCorrections:(p.paymentCorrections||[]).filter(c=>c.status==='confirmed').length,signedActTotal:(p.acts||[]).filter(a=>a.status==='signed').reduce((s,a)=>s+n(a.amount),0)};return p.financeAudit}
window.auditFinanceHistory=audit;
(state.projects||[]).forEach(ensure);installHints();patchRows();
})();