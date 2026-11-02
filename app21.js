(()=>{
  const KEY='repairHubFirstUseHelper_v1';
  const defaults={visits:0,disabled:false,seen:{}};
  function load(){try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}}
  function persist(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}}
  let prefs=load();

  const hints=[
    {id:'estimate',target:'estimatesPanel',title:'Начни со сметы',text:'Добавь PDF или Excel. После загрузки система сама предложит подтвердить сумму и проведёт дальше по финансовому маршруту.'},
    {id:'route',target:'guidedFinancePanel',title:'Финансовый маршрут',text:'Этот блок показывает, что уже заполнено и какой следующий обязательный шаг по объекту.'},
    {id:'budget',target:'costProfitPanel',title:'Плановая себестоимость',text:'После согласования сметы укажи плановую себестоимость. Тогда система начнёт сравнивать план и фактические расходы.'},
    {id:'costs',target:'costProfitPanel',title:'Фактические расходы',text:'Материалы, подрядчики, работа и доставка добавляются сюда. Прибыль и маржа пересчитываются автоматически.'},
    {id:'acts',target:'actsPanel',title:'Акты',text:'После выполнения работ проверь акт и переведи его в подписанный статус — это влияет на сумму к получению.'},
    {id:'payments',target:'paymentsPanel',title:'Оплаты',text:'Каждое поступление денег лучше привязывать к смете. Тогда остаток к получению будет считаться автоматически.'}
  ];

  function ensureUi(){
    if(document.getElementById('firstUseHelper'))return;
    const style=document.createElement('style');style.textContent=`.first-helper{position:fixed;right:16px;bottom:16px;z-index:1300;width:min(360px,calc(100vw - 32px));background:#fff;border:1px solid #dbe2ea;border-radius:16px;box-shadow:0 20px 60px rgba(15,23,42,.2);padding:15px;display:none;color:#111827}.first-helper.open{display:block}.first-helper h3{margin:0;font-size:15px}.first-helper p{margin:7px 0 0;font-size:12px;line-height:1.5;color:#475569}.first-helper-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.first-helper-actions button{border:1px solid #dbe2ea;background:#fff;border-radius:10px;padding:8px 10px;font-weight:800;cursor:pointer}.first-helper-actions .primary{background:#2563eb;border-color:#2563eb;color:#fff}.first-helper-close{position:absolute;right:10px;top:10px;border:0;background:#f1f5f9;width:30px;height:30px;border-radius:9px;font-size:18px;cursor:pointer}.first-helper-entry{position:fixed;right:16px;bottom:16px;z-index:1290;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:10px 13px;font-weight:900;box-shadow:0 10px 30px rgba(15,23,42,.12);cursor:pointer}`;document.head.appendChild(style);
    const entry=document.createElement('button');entry.id='firstUseHelperEntry';entry.className='first-helper-entry';entry.type='button';entry.textContent='Помощник';document.body.appendChild(entry);
    const box=document.createElement('aside');box.id='firstUseHelper';box.className='first-helper';box.innerHTML='<button class="first-helper-close" id="firstUseHelperClose">×</button><h3 id="firstUseHelperTitle"></h3><p id="firstUseHelperText"></p><div class="first-helper-actions"><button class="primary" id="firstUseHelperGo">Показать</button><button id="firstUseHelperDone">Понятно</button><button id="firstUseHelperDisable">Не показывать</button></div>';document.body.appendChild(box);
    entry.onclick=()=>showBest(true);
    document.getElementById('firstUseHelperClose').onclick=()=>box.classList.remove('open');
    document.getElementById('firstUseHelperDone').onclick=()=>{const id=box.dataset.hint;if(id){prefs.seen[id]=true;persist(prefs)}box.classList.remove('open')};
    document.getElementById('firstUseHelperDisable').onclick=()=>{prefs.disabled=true;persist(prefs);box.classList.remove('open')};
    document.getElementById('firstUseHelperGo').onclick=()=>{const target=box.dataset.target;document.getElementById(target)?.scrollIntoView({behavior:'smooth',block:'start'});box.classList.remove('open')};
  }

  function bestHint(){
    const p=typeof active==='function'?active():null;
    const estimates=typeof estimateFiles==='function'&&p?estimateFiles(p):[];
    if(!estimates.length)return hints[0];
    if(document.getElementById('guidedFinancePanel')&&!prefs.seen.route)return hints[1];
    if(!p?.costBudget)return hints[2];
    if(!(p?.costs||[]).length)return hints[3];
    if(!(p?.acts||[]).some(a=>a.status==='signed'))return hints[4];
    if(!(p?.payments||[]).length)return hints[5];
    return hints.find(h=>!prefs.seen[h.id])||hints[1];
  }

  function show(hint,force=false){
    ensureUi();if(!hint||(!force&&prefs.disabled)||(!force&&prefs.seen[hint.id]))return;
    const box=document.getElementById('firstUseHelper');box.dataset.hint=hint.id;box.dataset.target=hint.target;document.getElementById('firstUseHelperTitle').textContent=hint.title;document.getElementById('firstUseHelperText').textContent=hint.text;box.classList.add('open');
  }
  function showBest(force=false){show(bestHint(),force)}

  function init(){ensureUi();prefs.visits=(Number(prefs.visits)||0)+1;persist(prefs);if(!prefs.disabled&&prefs.visits<=5)setTimeout(()=>showBest(false),1200)}
  const baseRender=typeof window.render==='function'?window.render:null;
  if(baseRender){window.render=function(){const r=baseRender.apply(this,arguments);if(!prefs.disabled&&prefs.visits<=5)setTimeout(()=>showBest(false),500);return r}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
