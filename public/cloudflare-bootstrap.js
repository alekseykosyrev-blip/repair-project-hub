(()=>{
  const KEY='repairHubProjects_v1';
  const FIRST_RUN='repairHubCloudflareFirstRun_v1';
  try{
    if(localStorage.getItem(KEY))return;
    const cleanState={
      active:1,
      nextProject:2,
      nextTask:1,
      projects:[{
        id:1,
        name:'Новый объект',
        client:'',
        status:'В работе',
        budget:'0 ₽',
        deadline:'—',
        notes:'',
        tasks:[],
        files:[]
      }]
    };
    localStorage.setItem(KEY,JSON.stringify(cleanState));
    localStorage.setItem(FIRST_RUN,'1');
  }catch(e){console.warn('Cloudflare first-run bootstrap failed',e)}
})();
