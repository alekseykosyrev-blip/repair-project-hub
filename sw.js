const CACHE_NAME='repair-project-hub-v2';
const APP_SHELL=[
  './',
  './index.html',
  './styles.css',
  './dashboard.css',
  './finance.css',
  './finance-center-v2.css',
  './manifest.webmanifest',
  './icon.svg',
  './app1.js','./app2.js','./app3.js','./app4.js','./app5.js','./app6.js','./app7.js','./app8.js','./app9.js','./app10.js','./app11.js','./app12.js','./app13.js','./app17.js','./app18.js','./app19.js','./app20.js','./app21.js'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async url=>{
      try{await cache.add(url)}catch(error){console.warn('Cache miss during install',url,error)}
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(CACHE_NAME);
        cache.put('./index.html',fresh.clone());
        return fresh;
      }catch{
        return (await caches.match(req))||(await caches.match('./index.html'))||(await caches.match('./'));
      }
    })());
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      const network=fetch(req).then(async fresh=>{
        if(fresh&&fresh.ok){
          const cache=await caches.open(CACHE_NAME);
          cache.put(req,fresh.clone());
        }
        return fresh;
      }).catch(()=>null);
      return cached||(await network)||Response.error();
    })());
    return;
  }

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached)return cached;
    try{
      const fresh=await fetch(req);
      if(fresh){
        const cache=await caches.open(CACHE_NAME);
        cache.put(req,fresh.clone());
      }
      return fresh;
    }catch{
      return Response.error();
    }
  })());
});
