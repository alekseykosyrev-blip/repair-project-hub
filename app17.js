(()=>{
  const COST_TYPES={material:'Материалы',subcontractor:'Подрядчики',labor:'Работа',transport:'Доставка',other:'Прочее'};
  const CHANGE_STATUSES={draft:'Черновик',sent:'На согласовании',approved:'Согласовано',rejected:'Отклонено'};
  const uid=p=>p+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7);
  const num=v=>typeof moneyNumber==='function'?moneyNumber(v):(Number(String(v||'').replace(/[^\d.,-]/g,'').replace(',','.'))||0);
  const rub=v=>typeof formatRub==='function'?formatRub(v):new Intl.NumberFormat('ru-RU').format(Number(v)||0)+' ₽';
  const escHtml=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

  function ensureModel(p){
    if(!p)return;
    p.costs=Array.isArray(p.costs)?p.costs:[];
    p.changeOrders=Array.isArray(p.changeOrders)?p.changeOrders:[];
    if(typeof p.costBudget!=='string')p.costBudget='';
  }
  function approvedChanges(p){return (p?.changeOrders||[]).filter(x=>x.status==='approved').reduce((s,x)=>s+num(x.amount),0)}
  function actualCosts(p){return (p?.costs||[]).reduce((s,x)=>s+num(x.amount),0)}
  function financeBase(p){
    try{return typeof projectFinance==='function'?projectFinance(p):{approved:0,received:0,toReceive:0}}catch{return{approved:0,received:0,toReceive:0}}
  }
  function metrics(p){
    ensureModel(p);
    const base=financeBase(p),extras=approvedChanges(p),costs=actualCosts(p),revenue=num(base.approved)+extras,profit=revenue-costs;
    const margin=revenue>0?profit/revenue*100:0,costBudget=num(p.costBudget),budgetLeft=costBudget-costs;
    return {base,extras,costs,revenue,profit,margin,costBudget,budgetLeft};
  }
  function tone(n){return n<0?'danger':n>0?'positive':'neutral'}
  function dateLabel(v){if(!v)return'—';try{return new Date(v+'T00:00:00').toLocaleDateString('ru-RU')}catch{return v}}
  function today(){return new Date().toISOString().slice(0,10)}

  function ensureModals(){
    if(document.getElementById('fcCostModal'))return;
    const holder=document.createElement('div');
    holder.innerHTML=`
      <div class="modal" id="fcCostModal" aria-hidden="true"><div class="modalbox fc-modal" role="dialog" aria-modal="true">
        <h3>Добавить расход</h3>
        <div class="fc-form-grid">
          <div><label>Дата</label><input class="field" id="fcCostDate" type="date"></div>
          <div><label>Категория</label><select class="field" id="fcCostType">${Object.entries(COST_TYPES).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
          <div class="full"><label>Описание</label><input class="field" id="fcCostTitle" placeholder="Например: краска, доставка, бригада"></div>
          <div class="full"><label>Сумма</label><input class="field" id="fcCostAmount" inputmode="decimal" placeholder="0"></div>
        </div>
        <div class="actions"><button class="btn" id="fcCostCancel">Отмена</button><button class="btn primary" id="fcCostSave">Сохранить расход</button></div>
      </div></div>
      <div class="modal" id="fcChangeModal" aria-hidden="true"><div class="modalbox fc-modal" role="dialog" aria-modal="true">
        <h3>Дополнительная работа</h3>
        <div class="fc-form-grid">
          <div><label>Дата</label><input class="field" id="fcChangeDate" type="date"></div>
          <div><label>Статус</label><select class="field" id="fcChangeStatus">${Object.entries(CHANGE_STATUSES).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div>
          <div class="full"><label>Название</label><input class="field" id="fcChangeTitle" placeholder="Например: дополнительная подготовка откосов"></div>
          <div class="full"><label>Сумма</label><input class="field" id="fcChangeAmount" inputmode="decimal" placeholder="0"></div>
        </div>
        <div class="actions"><button class="btn" id="fcChangeCancel">Отмена</button><button class="btn primary" id="fcChangeSave">Сохранить допработу</button></div>
      </div></div>`;
    [...holder.children].forEach(x=>document.body.appendChild(x));
    document.getElementById('fcCostCancel').onclick=()=>modal('#fcCostModal',false);
    document.getElementById('fcChangeCancel').onclick=()=>modal('#fcChangeModal',false);
    document.getElementById('fcCostSave').onclick=saveCost;
    document.getElementById('fcChangeSave').onclick=saveChange;
  }

  function ensurePanel(){
    const anchor=document.getElementById('projectFinancePanel');
    if(!anchor||document.getElementById('costProfitPanel'))return;
    const panel=document.createElement('section');
    panel.className='panel fc-panel';panel.id='costProfitPanel';
    panel.innerHTML=`
      <div class="section-title fc-title-row"><div><h2>Финансовый центр объекта</h2><div class="small">План/факт себестоимости, допработы и реальная прибыль</div></div><div class="fc-actions"><button class="btn" id="fcAddCost">+ Расход</button><button class="btn primary" id="fcAddChange">+ Допработа</button></div></div>
      <div id="fcKpis" class="fc-kpis"></div>
      <div class="fc-budget-box">
        <div class="fc-budget-head"><div><strong>Плановая себестоимость</strong><div class="small">Сколько планируем потратить на выполнение объекта</div></div><input id="fcCostBudget" class="field" inputmode="decimal" placeholder="Например: 1 200 000"></div>
        <div class="fc-budget-track"><div id="fcBudgetBar"></div></div><div id="fcBudgetCaption" class="small"></div>
      </div>
      <div class="fc-columns">
        <div><div class="fc-subhead"><h3>Фактические расходы</h3><span id="fcCostCount" class="small"></span></div><div id="fcCosts"></div></div>
        <div><div class="fc-subhead"><h3>Дополнительные работы</h3><span id="fcChangeCount" class="small"></span></div><div id="fcChanges"></div></div>
      </div>`;
    anchor.insertAdjacentElement('afterend',panel);
    const nav=document.getElementById('workspaceNav');
    if(nav&&!nav.querySelector('[data-jump="costProfitPanel"]')){
      const b=document.createElement('button');b.dataset.jump='costProfitPanel';b.textContent='Прибыль и расходы';
      const after=nav.querySelector('[data-jump="projectFinancePanel"]');after?.insertAdjacentElement('afterend',b);
    }
    document.getElementById('fcAddCost').onclick=openCost;
    document.getElementById('fcAddChange').onclick=openChange;
    let timer;
    document.getElementById('fcCostBudget').addEventListener('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{const p=active();if(!p)return;ensureModel(p);p.costBudget=e.target.value.trim();save(false);renderPanel()},200)});
    panel.addEventListener('click',e=>{
      const delCost=e.target.closest('[data-fc-del-cost]');
      if(delCost){const p=active();p.costs=p.costs.filter(x=>x.id!==delCost.dataset.fcDelCost);save(false);renderPanel();return}
      const delChange=e.target.closest('[data-fc-del-change]');
      if(delChange){const p=active();p.changeOrders=p.changeOrders.filter(x=>x.id!==delChange.dataset.fcDelChange);save(false);renderPanel();return}
    });
    panel.addEventListener('change',e=>{
      const s=e.target.closest('[data-fc-status]');if(!s)return;
      const p=active(),x=(p.changeOrders||[]).find(v=>v.id===s.dataset.fcStatus);if(!x)return;
      x.status=s.value;save(false);renderPanel();
    });
  }

  function openCost(){
    ensureModals();
    document.getElementById('fcCostDate').value=today();
    document.getElementById('fcCostType').value='material';
    document.getElementById('fcCostTitle').value='';document.getElementById('fcCostAmount').value='';
    modal('#fcCostModal',true);setTimeout(()=>document.getElementById('fcCostTitle').focus(),80);
  }
  function openChange(){
    ensureModals();
    document.getElementById('fcChangeDate').value=today();
    document.getElementById('fcChangeStatus').value='draft';
    document.getElementById('fcChangeTitle').value='';document.getElementById('fcChangeAmount').value='';
    modal('#fcChangeModal',true);setTimeout(()=>document.getElementById('fcChangeTitle').focus(),80);
  }
  function saveCost(){
    const p=active();if(!p)return;ensureModel(p);
    const title=document.getElementById('fcCostTitle').value.trim(),amount=num(document.getElementById('fcCostAmount').value);
    if(!title||amount<=0){toast('Укажи описание и сумму расхода',true);return}
    p.costs.unshift({id:uid('cost'),date:document.getElementById('fcCostDate').value||today(),type:document.getElementById('fcCostType').value,title,amount,createdAt:Date.now()});
    save(false);modal('#fcCostModal',false);renderPanel();toast('Расход добавлен');
  }
  function saveChange(){
    const p=active();if(!p)return;ensureModel(p);
    const title=document.getElementById('fcChangeTitle').value.trim(),amount=num(document.getElementById('fcChangeAmount').value);
    if(!title||amount<=0){toast('Укажи название и сумму допработы',true);return}
    p.changeOrders.unshift({id:uid('chg'),date:document.getElementById('fcChangeDate').value||today(),status:document.getElementById('fcChangeStatus').value,title,amount,createdAt:Date.now()});
    save(false);modal('#fcChangeModal',false);renderPanel();toast('Допработа добавлена');
  }

  function renderPanel(){
    const p=active();if(!p)return;ensureModel(p);ensurePanel();
    const root=document.getElementById('costProfitPanel');if(!root)return;
    const m=metrics(p),cash=num(m.base.received),receivable=Math.max(0,m.revenue-cash);
    document.getElementById('fcKpis').innerHTML=`
      <div class="fc-kpi"><span>Доход по сметам</span><strong>${rub(m.base.approved)}</strong></div>
      <div class="fc-kpi"><span>Согласованные допработы</span><strong>${rub(m.extras)}</strong></div>
      <div class="fc-kpi"><span>Фактические расходы</span><strong>${rub(m.costs)}</strong></div>
      <div class="fc-kpi ${tone(m.profit)}"><span>Расчётная прибыль</span><strong>${rub(m.profit)}</strong></div>
      <div class="fc-kpi ${tone(m.margin)}"><span>Маржа</span><strong>${m.margin.toFixed(1)}%</strong></div>
      <div class="fc-kpi"><span>Осталось получить</span><strong>${rub(receivable)}</strong></div>`;
    const budget=document.getElementById('fcCostBudget');if(document.activeElement!==budget)budget.value=p.costBudget||'';
    const pct=m.costBudget>0?Math.min(100,m.costs/m.costBudget*100):0;
    document.getElementById('fcBudgetBar').style.width=pct+'%';
    document.getElementById('fcBudgetBar').className=m.costBudget>0&&m.costs>m.costBudget?'over':'';
    document.getElementById('fcBudgetCaption').textContent=m.costBudget>0
      ?(m.budgetLeft>=0?`Израсходовано ${rub(m.costs)} из ${rub(m.costBudget)} · запас ${rub(m.budgetLeft)}`:`Перерасход ${rub(Math.abs(m.budgetLeft))}`)
      :'Укажи плановую себестоимость — появится автоматическое сравнение с фактом.';
    document.getElementById('fcCostCount').textContent=`${p.costs.length} записей · ${rub(m.costs)}`;
    document.getElementById('fcCosts').innerHTML=p.costs.length?p.costs.map(x=>`<div class="fc-row"><div class="fc-row-main"><strong>${escHtml(x.title)}</strong><span>${dateLabel(x.date)} · ${COST_TYPES[x.type]||'Прочее'}</span></div><b>${rub(x.amount)}</b><button class="btn compact" data-fc-del-cost="${x.id}">Удалить</button></div>`).join(''):'<div class="fc-empty">Расходов пока нет.</div>';
    document.getElementById('fcChangeCount').textContent=`${p.changeOrders.length} записей · согласовано ${rub(m.extras)}`;
    document.getElementById('fcChanges').innerHTML=p.changeOrders.length?p.changeOrders.map(x=>`<div class="fc-row"><div class="fc-row-main"><strong>${escHtml(x.title)}</strong><span>${dateLabel(x.date)}</span></div><b>${rub(x.amount)}</b><select class="fc-status" data-fc-status="${x.id}">${Object.entries(CHANGE_STATUSES).map(([v,l])=>`<option value="${v}" ${x.status===v?'selected':''}>${l}</option>`).join('')}</select><button class="btn compact" data-fc-del-change="${x.id}">Удалить</button></div>`).join(''):'<div class="fc-empty">Допработ пока нет.</div>';
  }

  function init(){
    (state.projects||[]).forEach(ensureModel);save(false);ensureModals();ensurePanel();renderPanel();
  }
  const previousRender=typeof render==='function'?render:null;
  if(previousRender){window.render=function(){const r=previousRender.apply(this,arguments);queueMicrotask(()=>{try{ensurePanel();renderPanel()}catch(e){console.error('Finance center render',e)}});return r}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
