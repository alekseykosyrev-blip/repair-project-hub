(()=>{
  function ensureOfflineStatus(){
    if(document.getElementById('offlineStatus'))return;
    const save=document.getElementById('saveState');
    if(!save)return;
    const badge=document.createElement('span');
    badge.id='offlineStatus';
    badge.style.cssText='display:inline-flex;align-items:center;gap:6px;margin-left:8px;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:800;vertical-align:middle;background:#ecfdf5;color:#166534;border:1px solid #bbf7d0';
    save.insertAdjacentElement('afterend',badge);
    updateOfflineStatus();
  }

  function updateOfflineStatus(){
    const badge=document.getElementById('offlineStatus');
    if(!badge)return;
    const online=navigator.onLine;
    badge.textContent=online?'Онлайн · офлайн-копия готова':'Офлайн · данные сохраняются на устройстве';
    badge.style.background=online?'#ecfdf5':'#fff7ed';
    badge.style.color=online?'#166534':'#9a3412';
    badge.style.borderColor=online?'#bbf7d0':'#fed7aa';
  }

  async function registerOffline(){
    ensureOfflineStatus();
    if(!('serviceWorker' in navigator)){
      const badge=document.getElementById('offlineStatus');
      if(badge)badge.textContent='Офлайн-режим не поддерживается браузером';
      return;
    }
    try{
      await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      updateOfflineStatus();
    }catch(error){
      console.error('Service worker registration failed',error);
      const badge=document.getElementById('offlineStatus');
      if(badge)badge.textContent='Офлайн-копия пока не готова';
    }
  }

  window.addEventListener('online',updateOfflineStatus);
  window.addEventListener('offline',updateOfflineStatus);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',registerOffline,{once:true});else registerOffline();
})();
