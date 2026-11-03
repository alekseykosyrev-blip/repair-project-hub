(()=>{
  const SCHEMA='repair-hub-measurements-v1';
  const CATEGORIES=['Стены','Потолок','Пол','Откосы','Погонаж','Углы','Швы','Проёмы','Штробы','Другое'];
  const UNITS=['м²','м.п.','шт.','компл.'];
  const SOURCES={manual:'Вручную',smetchik:'Сметчик',scan:'Скан',calc:'Расчёт'};
  let workspace=null;

  function uid(prefix='m'){return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,7)}
  function p(){return typeof active==='function'?active():null}
  function cleanNumber(v){const n=Number(String(v??'').replace(',','.').replace(/[^\d.-]/g,''));return Number.isFinite(n)?Math.max(0,n):0}
  function qty(v){const n=cleanNumber(v);return Number.isInteger(n)?String(n):n.toFixed(2).replace(/0+$/,'').replace(/\.$/,'').replace('.',',')}
  function escHtml(v){return typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

  function ensureData(project){
    if(!project)return null;
    if(!project.measurements||typeof project.measurements!=='object')project.measurements={version:1,rooms:[],items:[],updatedAt:Date.now()};
    const d=project.measurements;
    d.version=1;d.rooms=Array.isArray(d.rooms)?d.rooms:[];d.items=Array.isArray(d.items)?d.items:[];
    d.items=d.items.map(x=>({id:x.id||uid(),room:String(x.room||'Общее'),work:String(x.work||x.name||'Работа'),category:String(x.category||'Другое'),unit:UNITS.includes(x.unit)?x.unit:'м²',quantity:cleanNumber(x.quantity??x.qty),formula:String(x.formula||''),source:SOURCES[x.source]?x.source:'manual',comment:String(x.comment||'')}));
    const seen=new Set(d.rooms.map(String));
    d.items.forEach(x=>{if(x.room&&!seen.has(x.room)){d.rooms.push(x.room);seen.add(x.room)}});
    if(!d.rooms.length)d.rooms.push('Общее');
    return d;
  }
  function persist(project,show=false){if(!project)return;project.measurements.updatedAt=Date.now();if(typeof save==='function')save(show)}

  function totals(d){
    const out={'м²':0,'м.п.':0,'шт.':0,'компл.':0};
    d.items.forEach(x=>{if(out[x.unit]!==undefined)out[x.unit]+=cleanNumber(x.quantity)});
    return out;
  }
  function packageObject(project){
    const d=ensureData(project);
    return {schema:SCHEMA,project:{id:project.id,name:project.name||'',client:project.client||''},rooms:d.rooms.slice(),items:d.items.map(x=>({room:x.room,work:x.work,category:x.category,unit:x.unit,quantity:cleanNumber(x.quantity),formula:x.formula||'',source:x.source,comment:x.comment||''}))};
  }
  function estimatorText(project){
    const pack=packageObject(project);
    const lines=[
      'СМЕТЧИК — ПАКЕТ ОБМЕРОВ',
      `Объект: ${project.name||'Без названия'}`,
      project.client?`Заказчик: ${project.client}`:'',
      '',
      'Правила: используй только утверждённые расценки. Не назначай цены самостоятельно. Если для работы нет утверждённой расценки, пометь: «Для этой работы нет утверждённой расценки. Нужно передать оценщику». Не теряй позиции. Проверь единицы и арифметику.',
      ''
    ].filter(Boolean);
    const byRoom=new Map();pack.items.forEach(x=>{if(!byRoom.has(x.room))byRoom.set(x.room,[]);byRoom.get(x.room).push(x)});
    byRoom.forEach((items,room)=>{lines.push(`ПОМЕЩЕНИЕ: ${room}`);items.forEach((x,i)=>lines.push(`${i+1}. ${x.work} — ${qty(x.quantity)} ${x.unit}${x.formula?` | расчёт: ${x.formula}`:''}${x.comment?` | ${x.comment}`:''}`));lines.push('')});
    lines.push('Верни смету по разделам с подитогами и общей суммой. Отдельно сформируй машинный блок JSON для обратной загрузки в «Обмеры объекта» по схеме ниже:');
    lines.push('MEASUREMENTS_JSON_START');lines.push(JSON.stringify(pack,null,2));lines.push('MEASUREMENTS_JSON_END');
    return lines.join('\n');
  }
  async function copyText(text){
    try{await navigator.clipboard.writeText(text);if(typeof toast==='function')toast('Пакет скопирован. Можно передавать сметчику.');return true}catch{}
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand('copy')}catch{}ta.remove();if(typeof toast==='function')toast(ok?'Пакет скопирован.':'Не удалось скопировать автоматически.',!ok);return ok;
  }
  function parsePackage(raw){
    let text=String(raw||'').trim();
    const a=text.indexOf('MEASUREMENTS_JSON_START'),b=text.indexOf('MEASUREMENTS_JSON_END');
    if(a>=0&&b>a)text=text.slice(a+'MEASUREMENTS_JSON_START'.length,b).trim();
    if(text.startsWith('```'))text=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    if(!text.startsWith('{')){const s=text.indexOf('{'),e=text.lastIndexOf('}');if(s>=0&&e>s)text=text.slice(s,e+1)}
    const data=JSON.parse(text);
    const items=Array.isArray(data)?data:Array.isArray(data.items)?data.items:[];
    if(!items.length)throw new Error('В пакете нет позиций');
    return {rooms:Array.isArray(data.rooms)?data.rooms.map(String):[],items:items.map(x=>({id:uid(),room:String(x.room||x.помещение||'Общее'),work:String(x.work||x.name||x.работа||'Работа'),category:String(x.category||x.категория||'Другое'),unit:UNITS.includes(x.unit)?x.unit:(UNITS.includes(x.единица)?x.единица:'м²'),quantity:cleanNumber(x.quantity??x.qty??x.объём??x.объем),formula:String(x.formula||x.расчёт||x.расчет||''),source:'smetchik',comment:String(x.comment||x.примечание||'')}))};
  }

  function ensureUi(){
    if(workspace)return workspace;
    const root=document.createElement('section');root.id='measurementWorkspace';root.className='measurement-workspace';root.hidden=true;
    root.innerHTML=`<div class="measurement-shell">
      <div class="measurement-topbar"><button class="measurement-back" id="measurementBack">← Проекты</button><div class="measurement-title"><h2>Обмеры объекта</h2><p id="measurementProjectName">—</p></div><div class="measurement-badge">Офлайн · внутри объекта</div></div>
      <div class="measurement-grid">
        <div class="measurement-card"><h3>Рабочие обмеры</h3><div class="measurement-muted">Один формат для ручного ввода, данных со скана и пакета от сметчика.</div>
          <div class="measurement-summary" id="measurementSummary"></div>
          <div class="measurement-toolbar"><button class="measurement-btn soft" id="measurementAddRoom">+ Помещение</button><button class="measurement-btn" id="measurementCopyEstimator">Скопировать для сметчика</button><button class="measurement-btn" id="measurementToggleImport">Импорт от сметчика</button><button class="measurement-btn primary" id="measurementToEstimate">Передать в смету</button></div>
          <div class="measurement-import" id="measurementImport"><textarea id="measurementImportText" placeholder="Вставь JSON-блок, который вернул сметчик"></textarea><div class="measurement-toolbar"><button class="measurement-btn primary" id="measurementImportApply">Загрузить пакет</button><button class="measurement-btn" id="measurementImportCancel">Отмена</button></div></div>
          <div class="measurement-form"><select id="measurementRoom"></select><input id="measurementWork" placeholder="Работа / позиция"><select id="measurementUnit"></select><input id="measurementQty" inputmode="decimal" placeholder="Объём"><input id="measurementFormula" placeholder="Формула / размеры"><button class="measurement-btn primary" id="measurementAddItem">Добавить</button></div>
          <div id="measurementRows"></div>
        </div>
        <aside class="measurement-card"><h3>Связка со сметчиком</h3><div class="measurement-muted">Обмеры хранятся в этом же объекте. Сметчик получает уже нормализованные помещения, единицы, объёмы и формулы.</div><div class="measurement-handoff"><strong>Рабочий маршрут</strong><div class="measurement-muted">1. Загрузить/внести данные → 2. Проверить объёмы → 3. Передать сметчику → 4. Получить смету → 5. Согласовать и вести финансы объекта.</div></div><div class="measurement-note">Прямой вызов ИИ из офлайн-PWA пока не включён: для него нужен защищённый серверный API. Поэтому сейчас сделан безопасный мост без ключей — копирование/импорт машинного пакета и передача данных в раздел смет.</div><div class="measurement-handoff" id="measurementDraftState"><strong>Черновик сметы</strong><div class="measurement-muted">Ещё не подготовлен.</div></div></aside>
      </div>
    </div>`;
    document.body.appendChild(root);workspace=root;
    const unit=root.querySelector('#measurementUnit');unit.innerHTML=UNITS.map(x=>`<option>${x}</option>`).join('');
    root.querySelector('#measurementBack').onclick=closeWorkspace;
    root.querySelector('#measurementAddRoom').onclick=()=>{const project=p();if(!project)return;const d=ensureData(project);const name=(prompt('Название помещения')||'').trim();if(!name)return;if(!d.rooms.includes(name))d.rooms.push(name);persist(project);renderWorkspace()};
    root.querySelector('#measurementToggleImport').onclick=()=>root.querySelector('#measurementImport').classList.toggle('open');
    root.querySelector('#measurementImportCancel').onclick=()=>root.querySelector('#measurementImport').classList.remove('open');
    root.querySelector('#measurementImportApply').onclick=applyImport;
    root.querySelector('#measurementCopyEstimator').onclick=()=>{const project=p();if(project)copyText(estimatorText(project))};
    root.querySelector('#measurementToEstimate').onclick=handoffToEstimate;
    root.querySelector('#measurementAddItem').onclick=addItem;
    root.querySelector('#measurementRows').addEventListener('input',editRow);
    root.querySelector('#measurementRows').addEventListener('change',editRow);
    root.querySelector('#measurementRows').addEventListener('click',deleteRow);
    return root;
  }
  function openWorkspace(){const project=p();if(!project){if(typeof toast==='function')toast('Сначала создай объект.',true);return}ensureUi();ensureData(project);workspace.hidden=false;document.body.classList.add('measurements-open');renderWorkspace()}
  function closeWorkspace(){if(!workspace)return;workspace.hidden=true;document.body.classList.remove('measurements-open');ensureEstimateCard()}
  function renderWorkspace(){
    if(!workspace||workspace.hidden)return;const project=p();if(!project){closeWorkspace();return}const d=ensureData(project),t=totals(d);
    workspace.querySelector('#measurementProjectName').textContent=`${project.name||'Без названия'}${project.client?` · ${project.client}`:''}`;
    workspace.querySelector('#measurementSummary').innerHTML=[['Позиций',d.items.length],['м²',qty(t['м²'])],['м.п.',qty(t['м.п.'])]].map(([k,v])=>`<div class="measurement-kpi"><strong>${escHtml(v)}</strong><span>${escHtml(k)}</span></div>`).join('');
    const room=workspace.querySelector('#measurementRoom');const current=room.value;room.innerHTML=d.rooms.map(x=>`<option>${escHtml(x)}</option>`).join('');if(d.rooms.includes(current))room.value=current;
    const rows=workspace.querySelector('#measurementRows');if(!d.items.length){rows.innerHTML='<div class="measurement-empty">Пока нет обмеров. Добавь первую позицию или импортируй пакет от сметчика.</div>'}else{
      const groups=d.rooms.map(roomName=>[roomName,d.items.filter(x=>x.room===roomName)]).filter(([,items])=>items.length);
      rows.innerHTML=groups.map(([roomName,items])=>`<div class="measurement-room"><div class="measurement-room-head"><h4>${escHtml(roomName)}</h4><span class="measurement-muted">${items.length} поз.</span></div>${items.map(x=>`<div class="measurement-row" data-id="${escHtml(x.id)}"><input data-field="work" value="${escHtml(x.work)}" aria-label="Работа"><select data-field="category">${CATEGORIES.map(c=>`<option${c===x.category?' selected':''}>${escHtml(c)}</option>`).join('')}</select><select data-field="unit">${UNITS.map(u=>`<option${u===x.unit?' selected':''}>${u}</option>`).join('')}</select><input class="qty" data-field="quantity" inputmode="decimal" value="${escHtml(qty(x.quantity))}" aria-label="Объём"><input data-field="formula" value="${escHtml(x.formula)}" placeholder="Формула"><select data-field="source">${Object.entries(SOURCES).map(([v,l])=>`<option value="${v}"${v===x.source?' selected':''}>${l}</option>`).join('')}</select><button class="measurement-btn danger measurement-delete" data-delete="${escHtml(x.id)}">×</button></div>`).join('')}</div>`).join('')
    }
    const draft=project.measurementEstimateDraft;workspace.querySelector('#measurementDraftState').innerHTML=draft?`<strong>Черновик для сметы готов</strong><div class="measurement-muted">${draft.itemCount||0} поз. · ${new Date(draft.createdAt).toLocaleString('ru-RU')}</div>`:'<strong>Черновик сметы</strong><div class="measurement-muted">Ещё не подготовлен.</div>';
  }
  function addItem(){const project=p();if(!project)return;const d=ensureData(project),room=workspace.querySelector('#measurementRoom').value||'Общее',work=workspace.querySelector('#measurementWork').value.trim(),unit=workspace.querySelector('#measurementUnit').value,quantity=cleanNumber(workspace.querySelector('#measurementQty').value),formula=workspace.querySelector('#measurementFormula').value.trim();if(!work){if(typeof toast==='function')toast('Укажи работу или позицию.',true);return}d.items.push({id:uid(),room,work,category:'Другое',unit,quantity,formula,source:'manual',comment:''});workspace.querySelector('#measurementWork').value='';workspace.querySelector('#measurementQty').value='';workspace.querySelector('#measurementFormula').value='';persist(project,true);renderWorkspace()}
  function editRow(e){const row=e.target.closest('[data-id]');if(!row||!e.target.dataset.field)return;const project=p();if(!project)return;const item=ensureData(project).items.find(x=>x.id===row.dataset.id);if(!item)return;const f=e.target.dataset.field;item[f]=f==='quantity'?cleanNumber(e.target.value):e.target.value;persist(project,false);if(f==='quantity')renderSummaryOnly()}
  function renderSummaryOnly(){const project=p();if(!project||!workspace)return;const d=ensureData(project),t=totals(d);workspace.querySelector('#measurementSummary').innerHTML=[['Позиций',d.items.length],['м²',qty(t['м²'])],['м.п.',qty(t['м.п.'])]].map(([k,v])=>`<div class="measurement-kpi"><strong>${escHtml(v)}</strong><span>${escHtml(k)}</span></div>`).join('')}
  function deleteRow(e){const id=e.target.dataset.delete;if(!id)return;const project=p();if(!project)return;const d=ensureData(project);d.items=d.items.filter(x=>x.id!==id);persist(project,true);renderWorkspace()}
  function applyImport(){const project=p();if(!project)return;try{const incoming=parsePackage(workspace.querySelector('#measurementImportText').value),d=ensureData(project);incoming.rooms.forEach(r=>{if(r&&!d.rooms.includes(r))d.rooms.push(r)});incoming.items.forEach(x=>{if(x.room&&!d.rooms.includes(x.room))d.rooms.push(x.room);d.items.push(x)});workspace.querySelector('#measurementImportText').value='';workspace.querySelector('#measurementImport').classList.remove('open');persist(project,true);renderWorkspace();if(typeof toast==='function')toast(`Импортировано позиций: ${incoming.items.length}`)}catch(err){if(typeof toast==='function')toast('Не удалось загрузить пакет: '+err.message,true)}}
  async function handoffToEstimate(){const project=p();if(!project)return;const d=ensureData(project);if(!d.items.length){if(typeof toast==='function')toast('Сначала добавь обмеры.',true);return}const text=estimatorText(project);project.measurementEstimateDraft={createdAt:Date.now(),itemCount:d.items.length,text,schema:SCHEMA};persist(project,true);await copyText(text);renderWorkspace();ensureEstimateCard();if(typeof toast==='function')toast('Пакет для сметы подготовлен и сохранён в объекте.')}

  function ensureEstimateCard(){
    const panel=document.getElementById('estimatesPanel'),project=p();if(!panel||!project)return;let card=document.getElementById('measurementEstimateCard');if(!card){card=document.createElement('div');card.id='measurementEstimateCard';card.className='measurement-estimate-card';const body=document.getElementById('estimatesBody');panel.insertBefore(card,body||null)}const d=ensureData(project),draft=project.measurementEstimateDraft;card.innerHTML=`<strong>📐 Обмеры объекта</strong><div class="small">${d.items.length} позиций в обмерах${draft?' · пакет для сметчика подготовлен':''}</div><div class="actions"><button class="btn" id="estimateOpenMeasurements">Открыть обмеры</button>${d.items.length?'<button class="btn primary" id="estimateCopyMeasurements">Скопировать для сметчика</button>':''}</div>`;card.querySelector('#estimateOpenMeasurements').onclick=openWorkspace;card.querySelector('#estimateCopyMeasurements')?.addEventListener('click',()=>copyText(estimatorText(project)))}

  function bindEntrypoints(){
    ensureUi();const external=[...document.querySelectorAll('a')].find(a=>/foreman-field\.webflow\.io/i.test(a.href)||/обмеры объекта/i.test(a.textContent));if(external){external.href='#';external.removeAttribute('target');external.onclick=e=>{e.preventDefault();openWorkspace()};external.setAttribute('aria-label','Открыть обмеры текущего объекта')}
    const nav=document.getElementById('workspaceNav');if(nav&&!nav.querySelector('[data-measurements-nav]')){const b=document.createElement('button');b.type='button';b.dataset.measurementsNav='1';b.textContent='Обмеры';b.onclick=openWorkspace;nav.appendChild(b)}
    ensureEstimateCard();
  }
  function init(){bindEntrypoints();setTimeout(bindEntrypoints,700)}
  const baseRender=typeof window.render==='function'?window.render:null;if(baseRender){window.render=function(){const r=baseRender.apply(this,arguments);setTimeout(()=>{ensureEstimateCard();if(workspace&&!workspace.hidden)renderWorkspace()},80);return r}}
  window.openMeasurementsWorkspace=openWorkspace;window.closeMeasurementsWorkspace=closeWorkspace;window.measurementPackageForEstimator=()=>{const project=p();return project?packageObject(project):null};window.measurementEstimatorText=()=>{const project=p();return project?estimatorText(project):''};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
