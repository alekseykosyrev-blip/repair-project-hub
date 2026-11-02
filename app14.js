const WORKLOG_SEEN_KEY='repairHubWorklogSeen_v1';
let worklogLastStamp='';
let worklogFirstLoad=true;
let worklogAuthorFilter='all';
let worklogLatestData=null;

function worklogAuthor(message){
  const author=String(message?.author||'').trim();
  const text=String(message?.text||'').trim();
  if(/^(астра|astra)(?:$|[\s·:—-])/i.test(author||text))return {id:'astra',label:'Астра'};
  if(/^(chatgpt|чат)(?:$|[\s·:—-])/i.test(author||text))return {id:'chatgpt',label:'ChatGPT'};
  if(author||/^Команда(?:$|[\s·:—-])/i.test(text))return {id:'team',label:author||'Команда'};
  return {id:'team',label:'Автор не указан'};
}

function worklogTime(value){
  if(!value)return '—';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);
}
function worklogStatusClass(status){
  return ['working','checking','published','waiting','error'].includes(status)?status:'waiting';
}
function ensureWorklogUi(){
  if(document.getElementById('worklogLauncher'))return;
  const style=document.createElement('style');
  style.textContent=`
    .worklog-launcher{position:fixed;right:18px;bottom:168px;z-index:950;display:flex;align-items:center;gap:9px;border:0;border-radius:999px;padding:11px 14px;background:#111827;color:#fff;font-weight:800;box-shadow:0 10px 30px rgba(15,23,42,.28);cursor:pointer;min-height:46px}
    .worklog-launcher-dot{width:10px;height:10px;border-radius:50%;background:#94a3b8}.worklog-launcher-dot.working,.worklog-launcher-dot.checking{background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.16);animation:worklogPulse 1.6s infinite}.worklog-launcher-dot.published{background:#3b82f6}.worklog-launcher-dot.error{background:#ef4444}.worklog-badge{display:none;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#ef4444;color:#fff;font-size:11px;align-items:center;justify-content:center}.worklog-badge.show{display:inline-flex}
    @keyframes worklogPulse{0%,100%{opacity:1}50%{opacity:.45}}
    .worklog-panel{position:fixed;right:18px;bottom:226px;z-index:951;width:min(390px,calc(100vw - 24px));max-height:min(620px,calc(100vh - 255px));display:none;flex-direction:column;background:#fff;border:1px solid #e5e7eb;border-radius:18px;box-shadow:0 22px 60px rgba(15,23,42,.25);overflow:hidden;color:#111827}.worklog-panel.open{display:flex}
    .worklog-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:15px 16px;border-bottom:1px solid #eef2f7}.worklog-title{font-size:16px;font-weight:900}.worklog-sub{font-size:11px;color:#64748b;margin-top:2px}.worklog-close{border:0;background:#f1f5f9;width:36px;height:36px;border-radius:10px;font-size:20px;cursor:pointer}
    .worklog-now{padding:14px 16px;background:#f8fafc;border-bottom:1px solid #eef2f7}.worklog-state{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:900;margin-bottom:7px}.worklog-state-dot{width:9px;height:9px;border-radius:50%;background:#94a3b8}.worklog-state-dot.working,.worklog-state-dot.checking{background:#22c55e}.worklog-state-dot.published{background:#3b82f6}.worklog-state-dot.error{background:#ef4444}.worklog-current{font-size:13px;line-height:1.45}.worklog-next{font-size:12px;color:#64748b;line-height:1.4;margin-top:7px}
    .worklog-head,.worklog-now,.worklog-foot,.worklog-filters{flex-shrink:0}.worklog-list{padding:12px 14px 14px;overflow:auto;min-height:0;flex:1 1 auto;overscroll-behavior:contain;overflow-wrap:anywhere}.worklog-filters{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #eef2f7}.worklog-filter{border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;background:#fff;color:#334155;cursor:pointer;font-size:12px;min-height:36px}.worklog-filter[aria-pressed="true"]{background:#1e40af;color:#fff;border-color:#1e40af}.worklog-author{font-size:11px;font-weight:800;color:#334155}.worklog-author.astra{color:#6d28d9}.worklog-author.chatgpt{color:#047857}.worklog-msg-top{flex-wrap:wrap}.worklog-panel{overflow:auto}.worklog-msg{padding:11px 12px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:9px}.worklog-msg:last-child{margin-bottom:0}.worklog-msg-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}.worklog-msg-type{font-size:11px;font-weight:900}.worklog-msg-time{font-size:10px;color:#94a3b8}.worklog-msg-text{font-size:12px;line-height:1.45}.worklog-foot{padding:10px 14px;border-top:1px solid #eef2f7;font-size:10px;color:#94a3b8;background:#fff}
    @media(max-width:800px){.worklog-launcher{right:12px;bottom:176px;padding:10px 12px}.worklog-panel{right:12px;bottom:232px;width:calc(100vw - 24px);max-height:calc(100vh - 252px)}}
    @media(prefers-reduced-motion:reduce){.worklog-launcher-dot{animation:none!important}}
  `;
  document.head.appendChild(style);

  const launcher=document.createElement('button');
  launcher.id='worklogLauncher';
  launcher.type='button';
  launcher.className='worklog-launcher';
  launcher.setAttribute('aria-controls','worklogPanel');
  launcher.setAttribute('aria-expanded','false');
  launcher.innerHTML='<span id="worklogLauncherDot" class="worklog-launcher-dot"></span><span>Ход работы</span><span id="worklogBadge" class="worklog-badge"></span>';

  const panel=document.createElement('aside');
  panel.id='worklogPanel';
  panel.className='worklog-panel';
  panel.setAttribute('aria-label','Ход работ по развитию сайта');
  panel.innerHTML=`
    <div class="worklog-head"><div><div class="worklog-title">Ход работы</div><div class="worklog-sub">Короткие фактические отчёты по доработкам</div></div><button type="button" class="worklog-close" id="worklogClose" aria-label="Закрыть">×</button></div>
    <div class="worklog-now"><div class="worklog-state"><span id="worklogStateDot" class="worklog-state-dot"></span><span id="worklogStateLabel">Проверяю статус…</span><span id="worklogUpdated" style="margin-left:auto;color:#94a3b8;font-weight:600"></span></div><div id="worklogCurrent" class="worklog-current">Загружаю текущий отчёт…</div><div id="worklogNext" class="worklog-next"></div></div>
    <div class="worklog-filters" role="group" aria-label="Автор отчётов"><button type="button" class="worklog-filter" data-worklog-author="all" aria-pressed="true">Все</button><button type="button" class="worklog-filter" data-worklog-author="chatgpt" aria-pressed="false">ChatGPT</button><button type="button" class="worklog-filter" data-worklog-author="astra" aria-pressed="false">Астра</button><button type="button" class="worklog-filter" data-worklog-author="team" aria-pressed="false">Другие</button></div>
    <div class="worklog-list" id="worklogMessages" tabindex="0" role="region" aria-label="Отчёты о выполненных работах"></div>
    <div class="worklog-foot" id="worklogFoot">Обновление отчётов каждые 15 секунд. Показывается только фактический статус.</div>`;
  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  function setOpen(open){
    panel.classList.toggle('open',open);
    launcher.setAttribute('aria-expanded',open?'true':'false');
    if(open){
      const latest=worklogLastStamp||new Date().toISOString();
      localStorage.setItem(WORKLOG_SEEN_KEY,latest);
      const badge=document.getElementById('worklogBadge');if(badge){badge.textContent='';badge.classList.remove('show')}
    }
  }
  launcher.addEventListener('click',()=>setOpen(!panel.classList.contains('open')));
  document.getElementById('worklogClose').addEventListener('click',()=>setOpen(false));
  panel.querySelectorAll('[data-worklog-author]').forEach(button=>button.addEventListener('click',()=>{
    worklogAuthorFilter=button.dataset.worklogAuthor;
    panel.querySelectorAll('[data-worklog-author]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    if(worklogLatestData)renderWorklog(worklogLatestData);
    document.getElementById('worklogMessages').scrollTop=0;
  }));
}

function renderWorklog(data){
  worklogLatestData=data;
  ensureWorklogUi();
  const status=worklogStatusClass(data?.status);
  const label=data?.statusLabel||({working:'Работаю',checking:'Проверяю',published:'Опубликовано',waiting:'Текущий этап завершён',error:'Есть проблема'}[status]||'Статус');
  const stateDot=document.getElementById('worklogStateDot');
  const launcherDot=document.getElementById('worklogLauncherDot');
  [stateDot,launcherDot].forEach(el=>{if(el){el.className=(el===stateDot?'worklog-state-dot ':'worklog-launcher-dot ')+status}});
  const labelEl=document.getElementById('worklogStateLabel');if(labelEl)labelEl.textContent=label;
  const updated=document.getElementById('worklogUpdated');if(updated)updated.textContent=worklogTime(data?.updatedAt);
  const current=document.getElementById('worklogCurrent');if(current)current.textContent=data?.current||'Сейчас активных изменений нет.';
  const next=document.getElementById('worklogNext');if(next)next.textContent=data?.next?'Дальше: '+data.next:'';
  const messages=document.getElementById('worklogMessages');
  if(messages){
    const list=(Array.isArray(data?.messages)?data.messages:[]).filter(m=>m&&typeof m==='object').filter(m=>worklogAuthorFilter==='all'||worklogAuthor(m).id===worklogAuthorFilter);
    const html=list.length?list.map(m=>{const author=worklogAuthor(m);return `<div class="worklog-msg"><div class="worklog-msg-top"><span class="worklog-author ${author.id}">${esc(author.label)}</span><span class="worklog-msg-type">${esc(({working:'Сейчас',checking:'Проверяю',published:'Опубликовано',waiting:'Этап завершён',error:'Проблема'}[m.type])||'Отчёт')}</span><span class="worklog-msg-time">${esc(worklogTime(m.time))}</span></div><div class="worklog-msg-text">${esc(m.text||'')}</div></div>`}).join(''):'<div class="worklog-msg"><div class="worklog-msg-text">Для выбранного автора пока нет отчётов.</div></div>';
    if(messages.innerHTML!==html){const scrollTop=messages.scrollTop;messages.innerHTML=html;messages.scrollTop=scrollTop;}
  }

  const stamp=String(data?.updatedAt||'');
  const seen=localStorage.getItem(WORKLOG_SEEN_KEY)||'';
  const panel=document.getElementById('worklogPanel');
  if(stamp&&stamp!==worklogLastStamp){
    worklogLastStamp=stamp;
    if(stamp>seen&&!panel?.classList.contains('open')){
      const badge=document.getElementById('worklogBadge');if(badge){badge.textContent='1';badge.classList.add('show')}
      if(worklogFirstLoad&&['working','checking'].includes(status)){
        panel?.classList.add('open');
        document.getElementById('worklogLauncher')?.setAttribute('aria-expanded','true');
        localStorage.setItem(WORKLOG_SEEN_KEY,stamp);
        if(badge){badge.textContent='';badge.classList.remove('show')}
      }
    }
  }
  worklogFirstLoad=false;
}

async function refreshWorklog(){
  ensureWorklogUi();
  try{
    const r=await fetch('worklog.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('WORKLOG_FETCH_'+r.status);
    renderWorklog(await r.json());
    const foot=document.getElementById('worklogFoot');if(foot)foot.textContent='Проверено '+new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())+' · обновление каждые 15 секунд · только фактический статус';
  }catch(e){
    console.warn('Worklog check failed',e);
    const foot=document.getElementById('worklogFoot');if(foot)foot.textContent='Не удалось обновить отчёт. Повторю проверку через 15 секунд.';
  }
}

ensureWorklogUi();
refreshWorklog();
setInterval(refreshWorklog,15000);
