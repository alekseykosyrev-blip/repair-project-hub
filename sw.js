const CACHE='stroycrm-v2-1';
const SHELL=['./','./index.html','./crm.css','./crm-app.mjs','./crm-core.mjs','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(SHELL);await self.skipWaiting()})());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})());
});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{const response=await fetch(req);if(response.ok){const c=await caches.open(CACHE);c.put(req,response.clone())}return response}
      catch{return await caches.match(req)||await caches.match('./index.html')||Response.error()}
    })());return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    const response=await fetch(req);
    if(response.ok){const c=await caches.open(CACHE);c.put(req,response.clone())}
    return response;
  })());
});
