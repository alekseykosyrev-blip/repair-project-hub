(()=>{
  const FIRST_RUN='repairHubCloudflareFirstRun_v1';
  const DISMISSED='repairHubCloudflareIntroDismissed_v1';
  function addBadge(){
    const brand=document.querySelector('.brand');
    if(!brand||document.querySelector('.cf-lab-badge'))return;
    const badge=document.createElement('div');
    badge.className='cf-lab-badge';
    badge.innerHTML='<i></i><span>Cloudflare Lab · отдельная версия</span>';
    brand.appendChild(badge);
  }
  function openBackup(){
    const btn=document.getElementById('backupToolsBtn');
    if(btn){btn.click();setTimeout(()=>document.getElementById('backupRestoreBtn')?.click(),120);return}
    setTimeout(openBackup,300);
  }
  function showMigrationNote(){
    if(localStorage.getItem(FIRST_RUN)!=='1'||localStorage.getItem(DISMISSED)==='1'||document.querySelector('.cf-migration-note'))return;
    const note=document.createElement('div');
    note.className='cf-migration-note';
    note.innerHTML='<div><strong>Это отдельная Cloudflare-версия</strong><span>Данные Webflow сюда автоматически не переносятся. Для безопасного переноса восстановите файл .repairhub. Текущий Webflow-сайт останется без изменений.</span></div><button class="btn primary" type="button" id="cfImportBackup">Перенести данные</button><button class="btn" type="button" id="cfDismissIntro">Позже</button>';
    document.body.appendChild(note);
    document.getElementById('cfImportBackup').onclick=()=>{localStorage.setItem(DISMISSED,'1');note.remove();openBackup()};
    document.getElementById('cfDismissIntro').onclick=()=>{localStorage.setItem(DISMISSED,'1');note.remove()};
  }
  function labelEnvironment(){
    document.documentElement.dataset.host='cloudflare-lab';
    const title=document.querySelector('title');
    if(title&&!title.textContent.includes('Cloudflare'))title.textContent='Мои ремонтные проекты · Cloudflare Lab';
  }
  function init(){addBadge();labelEnvironment();showMigrationNote()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
