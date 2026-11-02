(()=>{
  const KEY='repairHubFirstUseHelper_v2';
  const defaults={visits:0,disabled:false,seen:{}};
  function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}}
  function persist(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}}
  let prefs=load();

  function money(v){
    if(typeof moneyNumber==='function')return moneyNumber(v);
    const n=Number(String(v??'').replace(/[^\d.,-]/g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  }
  function project(){return typeof active==='function'?active():null}
  function estimates(p){return typeof estimateFiles==='function'&&p?estimateFiles(p):(p?.files||[]).filter(f=>f?.documentType==='estimate')}
  function currentEstimate(p){
    return estimates(p).slice().sort((a,b)=>(Number(b.createdAt)||Number(b.lastModified)||0)-(Number(a.createdAt)||Number(a.lastModified)||0))[0]||null;
  }
  function approved(e){return !!e&&['approved','in_progress','closed'].includes(e.estimateStatus)}
  function signedAct(p,e){return !!e&&(p?.acts||[]).find(a=>a.estimateId===e.id&&a.status==='signed')}
  function payment(p,e){return !!e&&(p?.payments||[]).find(x=>!x.estimateId||x.estimateId===e.id)}

  function contextStep(){
    const p=project();
    if(!p)return {id:'project',title:'Создай объект',text:'Сначала создай объект. После этого помощник будет вести тебя по рабочему и финансовому маршруту.',target:'newProjectBtn',action:'Создать объект'};
    const e=currentEstimate(p);
    if(!e)return {id:'estimate',title:'Следующий шаг — добавить смету',text:'Сейчас у объекта нет сметы. Добавь PDF или Excel, и после загрузки система предложит проверить итоговую сумму.',target:'estimatesPanel',action:'Перейти к сметам'};
    if(e.estimateConfirmed!==true)return {id:'confirm',title:'Проверь итоговую сумму сметы',text:'Смета уже загружена. Сейчас важно подтвердить её итоговую сумму — только после этого расчёты будут надёжными.',target:'estimatesPanel',action:'Подтвердить сумму',run:()=>typeof editEstimateTotal==='function'?editEstimateTotal(p,e):document.querySelector(`[data-estimate-id="${CSS.escape(e.id)}"] .total-estimate`)?.click()};
    if(!approved(e))return {id:'approve',title:'Согласуй статус сметы',text:'Сумма подтверждена. Следующий шаг — отметить смету как согласованную, чтобы она вошла в финансовую ведомость и маршрут продолжился.',target:'estimatesPanel',action:'Открыть статус сметы',run:()=>typeof openEstimateMeta==='function'?openEstimateMeta(e):document.querySelector(`[data-estimate-id="${CSS.escape(e.id)}"] .edit-estimate`)?.click()};
    if(!(money(p?.costBudget)>0))return {id:'budget',title:'Заполни плановую себестоимость',text:'Смета согласована. Теперь задай плановую себестоимость объекта — это база для контроля прибыли и маржи.',target:'costProfitPanel',action:'К себестоимости',focus:'fcCostBudget'};
    if(!(Array.isArray(p?.costs)&&p.costs.length))return {id:'costs',title:'Добавь фактические расходы',text:'План уже задан. Теперь внеси первый фактический расход: материалы, работа, подрядчики, доставка или другое.',target:'costProfitPanel',action:'Добавить расход',run:()=>document.getElementById('fcAddCost')?.click()};
    if(!signedAct(p,e))return {id:'act',title:'Оформи и подпиши акт',text:'Расходы уже ведутся. Следующий шаг — заполнить акт по этой смете и перевести его в подписанный статус.',target:'actsPanel',action:'Перейти к акту',run:()=>{
      const act=(p.acts||[]).find(a=>a.estimateId===e.id);
      document.getElementById('actsPanel')?.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>{const btn=act?document.querySelector(`#actsBody .edit-act[data-id="${CSS.escape(act.id)}"]`):document.getElementById('addActBtn');btn?.click()},300);
    }};
    if(!payment(p,e))return {id:'payment',title:'Зафиксируй оплату',text:'Акт подписан. Теперь внеси оплату и привяжи её к смете, чтобы остаток к получению считался автоматически.',target:'paymentsPanel',action:'Добавить оплату',run:()=>document.getElementById('addPaymentBtn')?.click()};
    if(e.estimateStatus!=='closed')return {id:'close',title:'Закрой смету и проверь итог',text:'Смета, расходы, акт и оплата уже заведены. Осталось закрыть смету после завершения работ и проверить итоговую прибыль и маржу.',target:'estimatesPanel',action:'Закрыть смету',run:()=>typeof openEstimateMeta==='function'?openEstimateMeta(e):document.querySelector(`[data-estimate-id="${CSS.escape(e.id)}"] .edit-estimate`)?.click()};
    return {id:'done',title:'Финансовый цикл заполнен',text:'Основная цепочка по текущей смете завершена. Теперь проверь прибыль, маржу, остатки и при необходимости добавляй следующие сметы или допработы.',target:'projectFinancePanel',action:'Проверить итог'};
  }

  function ensureUi(){
    if(document.getElementById('firstUseHelper'))return;
    const style=document.createElement('style');style.textContent=`
      :root{--floating-safe-bottom:96px}
      .first-helper{position:fixed;right:16px;bottom:var(--floating-safe-bottom);z-index:1300;width:min(380px,calc(100vw - 32px));background:#fff;border:1px solid #dbe2ea;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.2);padding:15px;display:none;color:#111827}.first-helper.open{display:block}.first-helper h3{margin:0;padding-right:34px;font-size:15px}.first-helper p{margin:7px 0 0;font-size:12px;line-height:1.5;color:#475569}.first-helper-kicker{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#2563eb;margin-bottom:5px}.first-helper-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.first-helper-actions button{border:1px solid #dbe2ea;background:#fff;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer}.first-helper-actions .primary{background:#2563eb;border-color:#2563eb;color:#fff}.first-helper-close{position:absolute;right:10px;top:10px;border:0;background:#f1f5f9;width:30px;height:30px;border-radius:9px;font-size:18px;cursor:pointer}.first-helper-entry{position:fixed;right:16px;bottom:var(--floating-safe-bottom);z-index:1290;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:10px 13px;font-weight:900;box-shadow:0 10px 30px rgba(15,23,42,.12);cursor:pointer}
      @media(min-width:900px){:root{--floating-safe-bottom:82px}}
      @media(max-width:700px){:root{--floating-safe-bottom:112px}.first-helper,.first-helper-entry{right:12px}.first-helper{width:min(380px,calc(100vw - 24px))}}
    `;document.head.appendChild(style);
    const entry=document.createElement('button');entry.id='firstUseHelperEntry';entry.className='first-helper-entry';entry.type='button';entry.textContent='Помощник';document.body.appendChild(entry);
    const box=document.createElement('aside');box.id='firstUseHelper';box.className='first-helper';box.innerHTML='<button class="first-helper-close" id="firstUseHelperClose">×</button><div class="first-helper-kicker">Что делать дальше</div><h3 id="firstUseHelperTitle"></h3><p id="firstUseHelperText"></p><div class="first-helper-actions"><button class="primary" id="firstUseHelperGo">Перейти к шагу</button><button id="firstUseHelperDone">Скрыть</button><button id="firstUseHelperDisable">Не показывать автоматически</button></div>';document.body.appendChild(box);
    entry.onclick=()=>showCurrent(true);
    document.getElementById('firstUseHelperClose').onclick=()=>box.classList.remove('open');
    document.getElementById('firstUseHelperDone').onclick=()=>box.classList.remove('open');
    document.getElementById('firstUseHelperDisable').onclick=()=>{prefs.disabled=true;persist(prefs);box.classList.remove('open')};
    document.getElementById('firstUseHelperGo').onclick=()=>runCurrentStep();
  }

  function show(step,force=false){
    ensureUi();if(!step||(!force&&prefs.disabled))return;
    const box=document.getElementById('firstUseHelper');
    box.dataset.step=step.id;
    document.getElementById('firstUseHelperTitle').textContent=step.title;
    document.getElementById('firstUseHelperText').textContent=step.text;
    const go=document.getElementById('firstUseHelperGo');if(go)go.textContent=step.action||'Перейти к шагу';
    box.classList.add('open');
  }
  function showCurrent(force=false){show(contextStep(),force)}

  function runCurrentStep(){
    const step=contextStep();
    if(!step)return;
    if(typeof step.run==='function'){
      step.run();
      document.getElementById('firstUseHelper')?.classList.remove('open');
      return;
    }
    const target=document.getElementById(step.target);
    if(target){
      target.scrollIntoView({behavior:'smooth',block:'center'});
      if(step.focus)setTimeout(()=>document.getElementById(step.focus)?.focus(),350);
    }
    document.getElementById('firstUseHelper')?.classList.remove('open');
  }

  function init(){
    ensureUi();prefs.visits=(Number(prefs.visits)||0)+1;persist(prefs);
    if(!prefs.disabled&&prefs.visits<=5)setTimeout(()=>showCurrent(false),1200);
  }
  const baseRender=typeof window.render==='function'?window.render:null;
  if(baseRender){window.render=function(){const r=baseRender.apply(this,arguments);if(!prefs.disabled&&prefs.visits<=5)setTimeout(()=>showCurrent(false),650);return r}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
