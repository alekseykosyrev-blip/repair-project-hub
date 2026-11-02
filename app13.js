const SITE_BUILD='2026.11.02.5';

function formatReleaseTime(value){
  if(!value)return '—';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return String(value);
  return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
}

function ensureReleaseMonitor(){
  if(document.getElementById('releaseMonitor'))return;
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar)return;
  const style=document.createElement('style');
  style.textContent=`
    .release-monitor{margin-top:auto;padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.045);color:#fff}
    .release-monitor-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    .release-monitor-title{font-size:13px;font-weight:800}.release-monitor-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#cbd5e1}
    .release-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.14)}
    .release-meta{font-size:11px;color:#94a3b8;line-height:1.45}.release-changes{margin:8px 0 0;padding-left:16px;font-size:11px;line-height:1.45;color:#dbe4ef}
    .release-update{display:none;width:100%;margin-top:10px;border:0;border-radius:9px;padding:9px 10px;font-weight:800;cursor:pointer;background:#fff;color:#111827}
    .release-update.show{display:block}.release-check{margin-top:8px;font-size:10px;color:#64748b}
    @media(max-width:800px){.release-monitor{margin-top:14px}.release-changes{font-size:12px}.release-meta{font-size:12px}}
  `;
  document.head.appendChild(style);
  const box=document.createElement('section');
  box.id='releaseMonitor';
  box.className='release-monitor';
  box.innerHTML=`
    <div class="release-monitor-head"><div class="release-monitor-title">Развитие сайта</div><div class="release-monitor-status"><span class="release-dot"></span><span id="releaseStatusText">Опубликовано</span></div></div>
    <div class="release-meta">Версия: <strong id="releaseVersion">${SITE_BUILD}</strong><br>Последняя публикация: <span id="releaseTime">проверяю…</span></div>
    <ul class="release-changes" id="releaseChanges"><li>Проверяю актуальную опубликованную версию…</li></ul>
    <button type="button" class="release-update" id="releaseUpdateBtn">Есть новая версия — обновить</button>
    <div class="release-check" id="releaseCheckText">Автопроверка каждые 15 секунд</div>`;
  sidebar.appendChild(box);
  document.getElementById('releaseUpdateBtn').addEventListener('click',()=>location.reload());
}

async function checkPublishedVersion(){
  ensureReleaseMonitor();
  const status=document.getElementById('releaseStatusText');
  const time=document.getElementById('releaseTime');
  const changes=document.getElementById('releaseChanges');
  const update=document.getElementById('releaseUpdateBtn');
  const check=document.getElementById('releaseCheckText');
  try{
    const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('VERSION_FETCH_'+r.status);
    const data=await r.json();
    if(time)time.textContent=formatReleaseTime(data.publishedAt);
    if(changes){
      const list=Array.isArray(data.changes)?data.changes:[];
      const html=list.length?list.map(x=>'<li>'+esc(x)+'</li>').join(''):'<li>Нет описания изменений.</li>';
      if(changes.innerHTML!==html)changes.innerHTML=html;
    }
    if(status)status.textContent=data.status==='published'?'Опубликовано':'Обновляется';
    if(update)update.classList.toggle('show',Boolean(data.build&&data.build!==SITE_BUILD));
    if(check)check.textContent='Проверено '+new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date())+' · каждые 15 секунд';
  }catch(e){
    console.warn('Version check failed',e);
    if(status)status.textContent='Версия открыта';
    if(check)check.textContent='Не удалось проверить новый деплой · повтор через 15 секунд';
  }
}

ensureReleaseMonitor();
checkPublishedVersion();
setInterval(checkPublishedVersion,15000);

if(!document.querySelector('script[data-worklog-script]')){
  const s=document.createElement('script');
  s.src='app14.js?v='+encodeURIComponent(SITE_BUILD);
  s.dataset.worklogScript='1';
  document.body.appendChild(s);
}
if(!document.querySelector('script[data-backup-script]')){
  const s=document.createElement('script');
  s.src='app15.js?v='+encodeURIComponent(SITE_BUILD);
  s.dataset.backupScript='1';
  document.body.appendChild(s);
}
if(!document.querySelector('script[data-ops-script]')){
  const s=document.createElement('script');
  s.src='app16.js?v='+encodeURIComponent(SITE_BUILD);
  s.dataset.opsScript='1';
  document.body.appendChild(s);
}

