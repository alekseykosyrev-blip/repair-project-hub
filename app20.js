(()=>{
  const STEP_LABELS={
    estimate:'Смета добавлена',
    confirm:'Итоговая сумма подтверждена',
    approve:'Смета согласована',
    budget:'Плановая себестоимость заполнена',
    costs:'Фактические расходы внесены',
    act:'Акт подписан',
    payment:'Оплата получена полностью'
  };

  function money(v){
    if(typeof moneyNumber==='function')return moneyNumber(v);
    const n=Number(String(v??'').replace(/[^\d.,-]/g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  }
  function estimates(p){return typeof estimateFiles==='function'?estimateFiles(p):(p?.files||[]).filter(f=>f?.documentType==='estimate')}
  function currentEstimate(p){
    const list=estimates(p);
    return list.slice().sort((a,b)=>(Number(b.createdAt)||Number(b.lastModified)||0)-(Number(a.createdAt)||Number(a.lastModified)||0))[0]||null;
  }
  function hasApprovedStatus(e){return !!e&&['approved','in_progress','closed'].includes(e.estimateStatus)}
  function hasSignedAct(p,e){return !!e&&(p?.acts||[]).some(a=>a.estimateId===e.id&&a.status==='signed')}
  function finance(p){try{return typeof projectFinance==='function'?projectFinance(p):{toReceive:0}}catch{return {toReceive:0}}}
  function hasFullPayment(p,e){return !!e&&(p?.payments||[]).some(x=>!x.estimateId||x.estimateId===e.id)&&money(finance(p).toReceive)<=.01}
  function rub(v){return typeof formatRub==='function'?formatRub(v):Math.round(money(v)).toLocaleString('ru-RU')+' ₽'}

  function stepsFor(p){
    const e=currentEstimate(p),f=finance(p);
    return [
      {id:'estimate',done:!!e,title:STEP_LABELS.estimate,desc:e?(e.estimateNumber||e.name||'Смета загружена'):'Добавь PDF или Excel сметы',action:'Добавить смету'},
      {id:'confirm',done:!!e&&e.estimateConfirmed===true,title:STEP_LABELS.confirm,desc:'Проверь распознанный итог и подтверди сумму',action:'Подтвердить сумму'},
      {id:'approve',done:hasApprovedStatus(e),title:STEP_LABELS.approve,desc:'После согласования смета попадёт в финансовую ведомость',action:'Открыть статус'},
      {id:'budget',done:money(p?.costBudget)>0,title:STEP_LABELS.budget,desc:'Укажи, сколько планируем потратить на выполнение объекта',action:'Заполнить себестоимость'},
      {id:'costs',done:Array.isArray(p?.costs)&&p.costs.length>0,title:STEP_LABELS.costs,desc:'Материалы, подрядчики, работа, доставка и прочие расходы',action:'Добавить расход'},
      {id:'act',done:hasSignedAct(p,e),title:STEP_LABELS.act,desc:'Черновик акта создаётся автоматически после согласования сметы',action:'Перейти к акту'},
      {id:'payment',done:hasFullPayment(p,e),title:STEP_LABELS.payment,desc:money(f.toReceive)>.01?`Осталось получить ${rub(f.toReceive)}`:'Зафиксируй поступившую сумму и привяжи её к смете',action:'Добавить оплату'}
    ];
  }

  function ensureStyles(){
    if(document.getElementById('guidedFinanceStyle'))return;
    const s=document.createElement('style');s.id='guidedFinanceStyle';
    s.textContent=`
      .guided-finance{margin-top:16px;border:1px solid #dbeafe;background:linear-gradient(180deg,#f8fbff,#fff);border-radius:18px;padding:16px}.guided-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.guided-head h2{margin:0;font-size:18px}.guided-head .small{margin-top:4px}.guided-progress{min-width:170px}.guided-progress strong{font-size:18px}.guided-track{height:8px;background:#e5e7eb;border-radius:999px;overflow:hidden;margin-top:7px}.guided-track span{display:block;height:100%;background:#2563eb;border-radius:999px;transition:width .2s}.guided-steps{display:grid;gap:9px;margin-top:14px}.guided-step{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid #e5e7eb;border-radius:13px;background:#fff}.guided-step.current{border-color:#60a5fa;background:#eff6ff;box-shadow:0 0 0 2px rgba(96,165,250,.12)}.guided-step.done{background:#f8fafc}.guided-num{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:900;background:#e5e7eb;color:#475569}.guided-step.done .guided-num{background:#dcfce7;color:#166534}.guided-step.current .guided-num{background:#2563eb;color:#fff}.guided-title{font-weight:850;font-size:13px}.guided-desc{font-size:11px;color:#64748b;margin-top:2px;line-height:1.35}.guided-step .btn{white-space:nowrap}.guided-empty{padding:14px;border:1px dashed #bfdbfe;border-radius:13px;background:#eff6ff;margin-top:12px;font-size:13px}.guided-complete{margin-top:12px;padding:12px;border-radius:12px;background:#ecfdf5;color:#166534;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      @media(max-width:700px){.guided-step{grid-template-columns:32px minmax(0,1fr)}.guided-step .btn{grid-column:2;justify-self:start}.guided-progress{width:100%}}
    `;
    document.head.appendChild(s);
  }

  function ensurePanel(){
    ensureStyles();
    if(document.getElementById('guidedFinancePanel'))return;
    const anchor=document.getElementById('estimatesPanel')||document.getElementById('financeShell');
    if(!anchor)return;
    const panel=document.createElement('section');
    panel.id='guidedFinancePanel';panel.className='guided-finance';
    panel.innerHTML='<div class="guided-head"><div><h2>Финансовый маршрут</h2><div class="small">После добавления сметы система сама ведёт по обязательным финансовым шагам</div></div><div class="guided-progress"><strong id="guidedProgressText">0 из 7</strong><div class="guided-track"><span id="guidedProgressBar"></span></div></div></div><div id="guidedFinanceBody"></div>';
    anchor.insertAdjacentElement('beforebegin',panel);
    panel.addEventListener('click',e=>{
      const b=e.target.closest('[data-guided-action]');if(!b)return;
      runAction(b.dataset.guidedAction);
    });
  }

  function finishProject(p){
    const f=finance(p);
    if(money(f.toReceive)>.01){if(typeof toast==='function')toast(`До закрытия объекта осталось получить ${rub(f.toReceive)}.`,true);return}
    p.status='Завершён';
    const status=document.getElementById('status');if(status)status.value='Завершён';
    if(typeof save==='function')save(false);
    if(typeof render==='function')render();
    if(typeof toast==='function')toast('Объект закрыт.');
  }

  function runAction(id){
    const p=typeof active==='function'?active():null;if(!p)return;
    const e=currentEstimate(p);
    if(id==='finish'){finishProject(p);return}
    if(id==='estimate'){document.getElementById('addEstimateBtn')?.click();return}
    if(!e){document.getElementById('addEstimateBtn')?.click();return}
    if(id==='confirm'){
      if(typeof editEstimateTotal==='function')editEstimateTotal(p,e);
      else document.querySelector(`[data-estimate-id="${CSS.escape(e.id)}"] .total-estimate`)?.click();
      return;
    }
    if(id==='approve'){
      if(typeof openEstimateMeta==='function')openEstimateMeta(e);
      else document.querySelector(`[data-estimate-id="${CSS.escape(e.id)}"] .edit-estimate`)?.click();
      return;
    }
    if(id==='budget'){
      document.getElementById('costProfitPanel')?.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>document.getElementById('fcCostBudget')?.focus(),350);return;
    }
    if(id==='costs'){
      document.getElementById('fcAddCost')?.click();
      if(!document.getElementById('fcAddCost'))document.getElementById('costProfitPanel')?.scrollIntoView({behavior:'smooth',block:'center'});
      return;
    }
    if(id==='act'){
      document.getElementById('actsPanel')?.scrollIntoView({behavior:'smooth',block:'center'});
      const act=(p.acts||[]).find(a=>a.estimateId===e.id);
      setTimeout(()=>{
        const btn=act?document.querySelector(`#actsBody .edit-act[data-id="${CSS.escape(act.id)}"]`):document.getElementById('addActBtn');
        btn?.click();
      },350);return;
    }
    if(id==='payment'){document.getElementById('addPaymentBtn')?.click();return}
  }

  function renderGuide(){
    ensurePanel();
    const p=typeof active==='function'?active():null,body=document.getElementById('guidedFinanceBody');
    if(!p||!body)return;
    const steps=stepsFor(p),doneCount=steps.filter(s=>s.done).length,next=steps.find(s=>!s.done);
    const text=document.getElementById('guidedProgressText'),bar=document.getElementById('guidedProgressBar');
    if(text)text.textContent=`${doneCount} из ${steps.length}`;
    if(bar)bar.style.width=`${Math.round(doneCount/steps.length*100)}%`;
    if(!currentEstimate(p)){
      body.innerHTML='<div class="guided-empty"><strong>Начни со сметы.</strong><div style="margin-top:4px">После загрузки система автоматически откроет финансовый маршрут и покажет следующий обязательный шаг.</div><button class="btn primary" style="margin-top:10px" data-guided-action="estimate">+ Добавить смету</button></div>';
      return;
    }
    const complete=doneCount===steps.length;
    const completeHtml=complete
      ?(p.status==='Завершён'
        ?'<div class="guided-complete"><span>Финансовый цикл завершён, объект закрыт.</span></div>'
        :'<div class="guided-complete"><span>Все финансовые шаги завершены. Отдельно закрывать смету не нужно.</span><button class="btn primary" data-guided-action="finish">Закрыть объект</button></div>')
      :'';
    body.innerHTML='<div class="guided-steps">'+steps.map((s,i)=>{
      const cls=s.done?' done':(!s.done&&s===next?' current':'');
      const mark=s.done?'✓':String(i+1);
      return `<div class="guided-step${cls}"><div class="guided-num">${mark}</div><div><div class="guided-title">${s.title}</div><div class="guided-desc">${s.desc}</div></div>${s.done?'<span class="status-badge approved">Готово</span>':s===next?`<button class="btn primary" data-guided-action="${s.id}">${s.action}</button>`:'<span class="status-badge">Далее</span>'}</div>`;
    }).join('')+'</div>'+completeHtml;
  }

  const previousRender=typeof window.render==='function'?window.render:null;
  if(previousRender){
    window.render=function(){const r=previousRender.apply(this,arguments);queueMicrotask(()=>{try{renderGuide()}catch(err){console.error('Guided finance render',err)}});return r};
  }

  const baseUpload=typeof window.uploadEstimateFiles==='function'?window.uploadEstimateFiles:null;
  if(baseUpload){
    window.uploadEstimateFiles=async function(){
      const p=typeof active==='function'?active():null,before=estimates(p).length;
      const r=await baseUpload.apply(this,arguments);
      const after=estimates(p).length;
      if(after>before){
        renderGuide();
        setTimeout(()=>document.getElementById('guidedFinancePanel')?.scrollIntoView({behavior:'smooth',block:'start'}),250);
      }
      return r;
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderGuide,{once:true});else renderGuide();
})();
