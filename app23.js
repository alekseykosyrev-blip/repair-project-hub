(()=>{
  const EPS=0.01;
  const num=v=>{
    if(typeof moneyNumber==='function')return moneyNumber(v);
    const n=Number(String(v??'').replace(/[^\d.,-]/g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  };
  const rub=v=>typeof formatRub==='function'?formatRub(v):new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(num(v))+' ₽';
  const estimates=p=>typeof estimateFiles==='function'?estimateFiles(p):(p?.files||[]).filter(f=>f?.documentType==='estimate');
  const currentEstimate=p=>estimates(p).slice().sort((a,b)=>(Number(b.createdAt)||Number(b.lastModified)||0)-(Number(a.createdAt)||Number(a.lastModified)||0))[0]||null;
  const estimateTotal=e=>typeof estimateAmount==='function'?estimateAmount(e):(e?.estimateConfirmed===true?num(e.confirmedEstimateTotal):0);
  const sum=(list,fn)=>Array.isArray(list)?list.reduce((s,x)=>s+num(fn?fn(x):x),0):0;
  const approvedChanges=p=>sum((p?.changeOrders||[]).filter(x=>x?.status==='approved'),x=>x.amount);
  const actualCosts=p=>sum(p?.costs||[],x=>x.amount);

  function normalizeClosedEstimate(p,e){
    if(!p||!e||e.estimateStatus!=='closed'||e.estimateConfirmed!==true)return false;
    const total=estimateTotal(e);
    let changed=false;
    if(Number(e.estimateCompletionPercent)!==100){e.estimateCompletionPercent=100;changed=true}
    if(Math.abs(num(e.estimateCompletedAmount)-total)>EPS){e.estimateCompletedAmount=total;changed=true}
    const act=(p.acts||[]).find(a=>a.estimateId===e.id);
    if(act&&Math.abs(num(act.amount)-total)>EPS){act.amount=total;act.updatedAt=Date.now();changed=true}
    if(changed&&typeof save==='function')save(false);
    return changed;
  }

  function patchGuidedRoute(e){
    const panel=document.getElementById('guidedFinancePanel');
    if(!panel||!e||e.estimateStatus!=='closed')return;
    const steps=[...panel.querySelectorAll('.guided-step')];
    const last=steps[steps.length-1];
    if(last){
      last.classList.add('done');last.classList.remove('current');
      const mark=last.querySelector('.guided-num');if(mark)mark.textContent='✓';
      const action=last.querySelector('[data-guided-action="close"]');
      if(action){const badge=document.createElement('span');badge.className='status-badge approved';badge.textContent='Готово';action.replaceWith(badge)}
    }
    const text=document.getElementById('guidedProgressText');if(text)text.textContent='8 из 8';
    const bar=document.getElementById('guidedProgressBar');if(bar)bar.style.width='100%';
    const body=document.getElementById('guidedFinanceBody');
    if(body&&!body.querySelector('.guided-complete'))body.insertAdjacentHTML('beforeend','<div class="guided-complete">Финансовый цикл по этой смете завершён. Итоговый расчёт проверен.</div>');
  }

  function ensureFinalAuditPanel(){
    if(document.getElementById('finalAuditPanel'))return;
    const guide=document.getElementById('guidedFinancePanel');
    if(!guide)return;
    const style=document.createElement('style');
    style.textContent='.final-audit{margin-top:12px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:16px;padding:14px}.final-audit h3{margin:0;font-size:16px}.final-audit-sub{font-size:11px;color:#64748b;margin-top:4px}.final-audit-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.final-audit-kpi{background:#fff;border:1px solid #dcfce7;border-radius:11px;padding:10px;min-width:0}.final-audit-kpi span{display:block;font-size:10px;color:#64748b}.final-audit-kpi strong{display:block;font-size:14px;margin-top:4px;overflow:hidden;text-overflow:ellipsis}.final-audit-formula{margin-top:10px;font-size:11px;color:#166534;line-height:1.45}@media(max-width:800px){.final-audit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    document.head.appendChild(style);
    const box=document.createElement('section');box.id='finalAuditPanel';box.className='final-audit';box.style.display='none';
    box.innerHTML='<h3>Итоговый расчёт объекта</h3><div class="final-audit-sub">Контрольная сводка после закрытия сметы</div><div class="final-audit-grid" id="finalAuditGrid"></div><div class="final-audit-formula" id="finalAuditFormula"></div>';
    guide.insertAdjacentElement('afterend',box);
  }

  function renderFinalAudit(p,e){
    ensureFinalAuditPanel();
    const box=document.getElementById('finalAuditPanel');if(!box)return;
    if(!p||!e||e.estimateStatus!=='closed'){box.style.display='none';return}
    const base=typeof projectFinance==='function'?projectFinance(p):{approved:0,completed:0,acted:0,received:0};
    const extras=approvedChanges(p),costs=actualCosts(p),revenue=num(base.approved)+extras,received=num(base.received);
    const remaining=Math.max(0,revenue-received),profit=revenue-costs,margin=revenue>0?profit/revenue*100:0;
    box.style.display='block';
    const grid=document.getElementById('finalAuditGrid');
    if(grid)grid.innerHTML=`<div class="final-audit-kpi"><span>Согласовано всего</span><strong>${rub(revenue)}</strong></div><div class="final-audit-kpi"><span>Выполнено</span><strong>${rub(base.completed)}</strong></div><div class="final-audit-kpi"><span>Актировано</span><strong>${rub(base.acted)}</strong></div><div class="final-audit-kpi"><span>Получено</span><strong>${rub(received)}</strong></div><div class="final-audit-kpi"><span>Осталось получить</span><strong>${rub(remaining)}</strong></div><div class="final-audit-kpi"><span>Фактические расходы</span><strong>${rub(costs)}</strong></div><div class="final-audit-kpi"><span>Расчётная прибыль</span><strong>${rub(profit)}</strong></div><div class="final-audit-kpi"><span>Маржа</span><strong>${margin.toFixed(1)}%</strong></div>`;
    const formula=document.getElementById('finalAuditFormula');
    if(formula)formula.textContent=`Проверка: ${rub(revenue)} согласовано − ${rub(costs)} расходов = ${rub(profit)} прибыли. Получено ${rub(received)}, остаток к получению ${rub(remaining)}.`;
  }

  function syncFinalState(){
    const p=typeof active==='function'?active():null;if(!p)return;
    const e=currentEstimate(p);if(!e)return;
    normalizeClosedEstimate(p,e);
    patchGuidedRoute(e);
    renderFinalAudit(p,e);
  }

  const baseRender=typeof window.render==='function'?window.render:null;
  if(baseRender){window.render=function(){const r=baseRender.apply(this,arguments);queueMicrotask(()=>{try{syncFinalState()}catch(err){console.error('Final finance audit',err)}});return r}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(syncFinalState,0),{once:true});else setTimeout(syncFinalState,0);
})();
