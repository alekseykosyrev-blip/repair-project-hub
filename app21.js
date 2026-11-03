(()=>{
  const KEY='repairHubFirstUseHelper_v4';
  const defaults={disabled:false,lastAutoStep:'',seenSteps:{}};
  function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}}
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(prefs))}catch{}}
  let prefs=load();

  function money(v){
    if(typeof moneyNumber==='function')return moneyNumber(v);
    const n=Number(String(v??'').replace(/[^\d.,-]/g,'').replace(',','.'));
    return Number.isFinite(n)?n:0;
  }
  function project(){return typeof active==='function'?active():null}
  function estimates(p){return typeof estimateFiles==='function'&&p?estimateFiles(p):(p?.files||[]).filter(f=>f?.documentType==='estimate')}
  function currentEstimate(p){return estimates(p).slice().sort((a,b)=>(Number(b.createdAt)||Number(b.lastModified)||0)-(Number(a.createdAt)||Number(a.lastModified)||0))[0]||null}
  function approved(e){return !!e&&['approved','in_progress','closed'].includes(e.estimateStatus)}
  function signedAct(p,e){return !!e&&(p?.acts||[]).find(a=>a.estimateId===e.id&&a.status==='signed')}
  function payment(p,e){return !!e&&(p?.payments||[]).find(x=>!x.estimateId||x.estimateId===e.id)}
  function finance(p){
    try{return typeof projectFinance==='function'?projectFinance(p):{toReceive:0,received:0,approved:0,acted:0}}
    catch{return {toReceive:0,received:0,approved:0,acted:0}}
  }
  function rub(v){return typeof formatRub==='function'?formatRub(v):Math.round(money(v)).toLocaleString('ru-RU')+' ₽'}

  function finishProject(p){
    if(!p)return;
    const f=finance(p);
    if(money(f.toReceive)>.01){if(typeof toast==='function')toast(`До закрытия объекта осталось получить ${rub(f.toReceive)}.`,true);return}
    p.status='Завершён';
    const status=document.getElementById('status');
    if(status)status.value='Завершён';
    if(typeof save==='function')save(false);
    if(typeof render==='function')render();
    if(typeof toast==='function')toast('Объект закрыт. Финансовый цикл завершён.');
  }

  function contextStep(){
    const p=project();
    if(!p)return {id:'project',index:0,title:'Создай объект',text:'Начни с нового объекта. После создания помощник будет вести тебя по рабочему и финансовому маршруту.',action:'Создать объект',run:()=>document.getElementById('newProjectBtn')?.click()};
    const e=currentEstimate(p);
    if(!e)return {id:'estimate',index:1,title:'Добавь смету',text:'У объекта пока нет сметы. Загрузи PDF или Excel — после этого система предложит проверить итоговую сумму.',action:'Добавить смету',run:()=>document.getElementById('addEstimateBtn')?.click(),target:'estimatesPanel'};
    if(e.estimateConfirmed!==true)return {id:'confirm',index:2,title:'Подтверди итоговую сумму',text:'Смета загружена. Проверь распознанный итог; если сумма неверная, введи правильную вручную.',action:'Подтвердить сумму',target:'estimatesPanel',run:()=>typeof editEstimateTotal==='function'?editEstimateTotal(p,e):document.querySelector(`[data-estimate-id="${CSS.escape(e.id)}"] .total-estimate`)?.click()};
    if(!approved(e))return {id:'approve',index:3,title:'Согласуй статус сметы',text:'Сумма подтверждена. Когда заказчик согласовал смету, переведи её в «Согласована» или «Выполняется», чтобы она вошла в финансовые расчёты.',action:'Открыть статус',target:'estimatesPanel',run:()=>typeof openEstimateMeta==='function'?openEstimateMeta(e):document.querySelector(`[data-estimate-id="${CSS.escape(e.id)}"] .edit-estimate`)?.click()};
    if(!(money(p?.costBudget)>0))return {id:'budget',index:4,title:'Заполни плановую себестоимость',text:'Смета согласована. Укажи, сколько планируешь потратить на объект — это база для контроля план/факт, прибыли и маржи.',action:'К себестоимости',target:'costProfitPanel',focus:'fcCostBudget'};
    if(!(Array.isArray(p?.costs)&&p.costs.length))return {id:'costs',index:5,title:'Добавь фактические расходы',text:'План уже задан. Теперь внеси первый фактический расход: материалы, работа, подрядчики, доставка или другое.',action:'Добавить расход',target:'costProfitPanel',run:()=>document.getElementById('fcAddCost')?.click()};
    if(!signedAct(p,e))return {id:'act',index:6,title:'Проверь и подпиши акт',text:'Расходы уже ведутся. Проверь акт по этой смете и переведи его в «Подписан» только после реального подписания.',action:'Открыть акт',target:'actsPanel',run:()=>{
      const act=(p.acts||[]).find(a=>a.estimateId===e.id);
      document.getElementById('actsPanel')?.scrollIntoView({behavior:'smooth',block:'center'});
      setTimeout(()=>{const btn=act?document.querySelector(`#actsBody .edit-act[data-id="${CSS.escape(act.id)}"]`):document.getElementById('addActBtn');btn?.click()},320);
    }};
    const f=finance(p);
    if(!payment(p,e)||money(f.toReceive)>.01)return {id:'payment',index:7,title:payment(p,e)?'Дополни оплату':'Зафиксируй оплату',text:money(f.toReceive)>.01?`По объекту осталось получить ${rub(f.toReceive)}. Внеси поступившую оплату — остаток пересчитается автоматически.`:'Акт подписан. Внеси поступившую оплату и привяжи её к смете.',action:'Добавить оплату',target:'paymentsPanel',run:()=>document.getElementById('addPaymentBtn')?.click()};
    if(p.status!=='Завершён')return {id:'finish',index:7,title:'Оплата закрыта — заверши объект',text:'Остаток к получению равен нулю. Отдельно закрывать смету больше не нужно: можно завершить весь объект.',action:'Закрыть объект',target:'costProfitPanel',run:()=>finishProject(p)};
    return {id:'done',index:7,title:'Объект закрыт',text:'Рабочий и финансовый маршрут завершён: смета согласована, расходы учтены, акт подписан, оплата получена, объект закрыт.',action:'Проверить итог',target:'costProfitPanel'};
  }

  function ensureUi(){
    if(document.getElementById('firstUseHelper'))return;
    const style=document.createElement('style');style.textContent=`
      :root{--helper-safe-bottom:96px}
      .first-helper{position:fixed;right:16px;bottom:var(--helper-safe-bottom);z-index:1300;width:min(380px,calc(100vw - 32px));background:#fff;border:1px solid #dbe2ea;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.2);padding:15px;display:none;color:#111827}.first-helper.open{display:block}.first-helper h3{margin:0;padding-right:34px;font-size:15px}.first-helper p{margin:7px 0 0;font-size:12px;line-height:1.5;color:#475569}.first-helper-kicker{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#2563eb;margin-bottom:5px}.first-helper-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.first-helper-actions button{border:1px solid #dbe2ea;background:#fff;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer}.first-helper-actions .primary{background:#2563eb;border-color:#2563eb;color:#fff}.first-helper-close{position:absolute;right:10px;top:10px;border:0;background:#f1f5f9;width:30px;height:30px;border-radius:9px;font-size:18px;cursor:pointer}.first-helper-entry{position:fixed;right:16px;bottom:var(--helper-safe-bottom);z-index:1290;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:10px 13px;font-weight:900;box-shadow:0 10px 30px rgba(15,23,42,.12);cursor:pointer}.first-helper-entry.attention{box-shadow:0 0 0 4px rgba(37,99,235,.14),0 10px 30px rgba(15,23,42,.12)}
      @media(max-width:700px){:root{--helper-safe-bottom:112px}.first-helper,.first-helper-entry{right:12px}.first-helper{width:min(380px,calc(100vw - 24px))}}
    `;document.head.appendChild(style);
    const entry=document.createElement('button');entry.id='firstUseHelperEntry';entry.className='first-helper-entry';entry.type='button';entry.textContent='Помощник';document.body.appendChild(entry);
    const box=document.createElement('aside');box.id='firstUseHelper';box.className='first-helper';box.innerHTML='<button class="first-helper-close" id="firstUseHelperClose">×</button><div class="first-helper-kicker" id="firstUseHelperKicker">Что делать дальше</div><h3 id="firstUseHelperTitle"></h3><p id="firstUseHelperText"></p><div class="first-helper-actions"><button class="primary" id="firstUseHelperGo">Перейти к шагу</button><button id="firstUseHelperDone">Понятно</button><button id="firstUseHelperDisable">Не показывать автоматически</button></div>';document.body.appendChild(box);
    entry.onclick=()=>showCurrent(true);
    document.getElementById('firstUseHelperClose').onclick=()=>box.classList.remove('open');
    document.getElementById('firstUseHelperDone').onclick=()=>{const id=box.dataset.step;if(id){prefs.seenSteps[id]=true;persist()}box.classList.remove('open');entry.classList.remove('attention')};
    document.getElementById('firstUseHelperDisable').onclick=()=>{prefs.disabled=true;persist();box.classList.remove('open');entry.classList.remove('attention')};
    document.getElementById('firstUseHelperGo').onclick=runCurrentStep;
  }

  function show(step,force=false){
    ensureUi();if(!step||(!force&&prefs.disabled))return;
    const box=document.getElementById('firstUseHelper');box.dataset.step=step.id;
    document.getElementById('firstUseHelperKicker').textContent=step.id==='done'?'Маршрут завершён':step.index?`Следующий шаг · ${step.index} из 7`:'Что делать дальше';
    document.getElementById('firstUseHelperTitle').textContent=step.title;
    document.getElementById('firstUseHelperText').textContent=step.text;
    const go=document.getElementById('firstUseHelperGo');go.textContent=step.action||'Перейти к шагу';
    box.classList.add('open');document.getElementById('firstUseHelperEntry')?.classList.remove('attention');
  }
  function showCurrent(force=false){const step=contextStep();if(!force&&prefs.seenSteps[step.id])return;show(step,force)}

  function runCurrentStep(){
    const step=contextStep();if(!step)return;
    const target=step.target&&document.getElementById(step.target);
    if(target)target.scrollIntoView({behavior:'smooth',block:'center'});
    document.getElementById('firstUseHelper')?.classList.remove('open');
    setTimeout(()=>{
      if(typeof step.run==='function')step.run();
      else if(step.focus)document.getElementById(step.focus)?.focus();
    },target?360:40);
  }

  function considerAutoHint(){
    ensureUi();
    const step=contextStep();
    if(step.id===prefs.lastAutoStep)return;
    prefs.lastAutoStep=step.id;persist();
    if(prefs.disabled||prefs.seenSteps[step.id])return;
    const entry=document.getElementById('firstUseHelperEntry');entry?.classList.add('attention');
    setTimeout(()=>show(step,false),700);
  }

  function init(){ensureUi();setTimeout(considerAutoHint,900)}
  const baseRender=typeof window.render==='function'?window.render:null;
  if(baseRender){window.render=function(){const r=baseRender.apply(this,arguments);setTimeout(considerAutoHint,350);return r}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
