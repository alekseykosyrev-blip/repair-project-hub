const KEY='repairHubProjects_v1';
const DB_NAME='repairProjectHubFiles_v1';
const DB_STORE='files';
const ESTIMATE_PARSER_VERSION=2;

const defaultState={
  active:1,nextProject:3,nextTask:10,
  projects:[
    {id:1,name:'Коттедж — отделочные работы',client:'Равиль',status:'В работе',budget:'1 850 000 ₽',deadline:'15 декабря',notes:'Проверить фактические объёмы перед следующим этапом.',tasks:[
      {id:1,text:'Подготовка стен',stage:'Малярные работы',done:true},
      {id:2,text:'Финишная шпаклёвка',stage:'Малярные работы',done:false},
      {id:3,text:'Окраска фасада',stage:'Фасад',done:false}
    ],files:[]},
    {id:2,name:'Квартира — ремонт',client:'Антон',status:'Ожидает согласования',budget:'640 000 ₽',deadline:'30 ноября',notes:'',tasks:[
      {id:4,text:'Согласовать смету',stage:'Документы',done:true},
      {id:5,text:'Заказать материалы',stage:'Закупка',done:false}
    ],files:[]}
  ]
};

const $=s=>document.querySelector(s);
let toastTimer,saveTimer,inputSyncTimer;
let state=loadState();

function clone(v){return JSON.parse(JSON.stringify(v))}
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(KEY)||'null');
    if(!s||!Array.isArray(s.projects)) return clone(defaultState);
    s.projects.forEach(p=>{
      p.tasks=Array.isArray(p.tasks)?p.tasks:[];
      p.files=Array.isArray(p.files)?p.files:[];
      if(typeof p.notes!=='string') p.notes='';
    });
    s.nextProject=Number(s.nextProject)||Math.max(0,...s.projects.map(p=>Number(p.id)||0))+1;
    s.nextTask=Number(s.nextTask)||Math.max(0,...s.projects.flatMap(p=>p.tasks.map(t=>Number(t.id)||0)))+1;
    if(!s.projects.some(p=>p.id===s.active)&&s.projects.length) s.active=s.projects[0].id;
    return s;
  }catch(e){console.error(e);return clone(defaultState)}
}
function save(show=true){
  try{
    localStorage.setItem(KEY,JSON.stringify(state));
    if(show) flashSave();
    return true;
  }catch(e){
    console.error(e);
    toast('Не удалось сохранить данные в браузере. Проверь свободное место.',true);
    return false;
  }
}
function flashSave(){
  const e=$('#saveState'); if(!e)return;
  e.textContent='Сохранено';
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>e.textContent='Данные сохраняются на этом устройстве',1100);
}
function active(){return state.projects.find(p=>p.id===state.active)||state.projects[0]||null}
function progress(p){return p&&p.tasks.length?Math.round(p.tasks.filter(t=>t.done).length/p.tasks.length*100):0}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function bytes(n){
  n=Number(n)||0;
  if(n<1024)return n+' Б';
  if(n<1048576)return(n/1024).toFixed(n<10240?1:0)+' КБ';
  if(n<1073741824)return(n/1048576).toFixed(n<10485760?1:0)+' МБ';
  return(n/1073741824).toFixed(1)+' ГБ';
}
function extension(name){return (String(name||'').split('.').pop()||'').toLowerCase()}
function kind(name,type){
  const x=extension(name).toUpperCase();
  if(type==='application/pdf'||x==='PDF')return'PDF';
  if(['XLS','XLSX','CSV'].includes(x))return x;
  if(['DOC','DOCX'].includes(x))return x;
  if(['JPG','JPEG','PNG','WEBP','GIF'].includes(x))return'IMG';
  return(x||'FILE').slice(0,5);
}
function canPreview(meta){
  const type=String(meta?.type||'').toLowerCase();
  const ext=extension(meta?.name);
  return type==='application/pdf'||type.startsWith('image/')||type.startsWith('text/')||
    ['pdf','jpg','jpeg','png','webp','gif','txt','html','htm'].includes(ext);
}
function isPdf(meta){
  return String(meta?.type||'').toLowerCase()==='application/pdf'||extension(meta?.name)==='pdf';
}
function formatRub(value){
  const n=Number(value)||0;
  return new Intl.NumberFormat('ru-RU',{minimumFractionDigits:Number.isInteger(n)?0:2,maximumFractionDigits:2}).format(n)+' ₽';
}
function parseMoney(raw){
  let s=String(raw||'').replace(/[  \s]/g,'').replace(/[^\d.,-]/g,'');
  if(!s)return null;
  const comma=s.lastIndexOf(','),dot=s.lastIndexOf('.');
  let decimal=-1;
  if(comma>=0||dot>=0){
    const pos=Math.max(comma,dot),digitsAfter=s.length-pos-1;
    if(digitsAfter>0&&digitsAfter<=2)decimal=pos;
  }
  let normalized='';
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(/\d|-/.test(ch))normalized+=ch;
    else if(i===decimal)normalized+='.';
  }
  const n=Number(normalized);
  return Number.isFinite(n)&&n>=0?n:null;
}
function moneyValues(text){
  const re=/(?:\d{1,3}(?:[   .]\d{3})+|\d{4,}|\d{1,3})(?:[,.]\d{1,2})?/g;
  return [...String(text||'').matchAll(re)].map(m=>parseMoney(m[0])).filter(n=>Number.isFinite(n));
}
function budgetTotals(p){
  return (p?.files||[]).map(f=>Number(f.estimateTotal)).filter(n=>Number.isFinite(n)&&n>=0);
}
function recalcBudget(p){
  if(!p?.budgetFromEstimates)return;
  const total=budgetTotals(p).reduce((a,b)=>a+b,0);
  p.budget=formatRub(total);
}
async function pdfTextLines(blob){
  if(!window.pdfjsLib)throw new Error('PDF_ENGINE_UNAVAILABLE');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const data=new Uint8Array(await blob.arrayBuffer());
  const pdf=await pdfjsLib.getDocument({data}).promise;
  const pages=[];
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
    const page=await pdf.getPage(pageNo),content=await page.getTextContent();
    const rows=[];
    for(const item of content.items||[]){
      const str=String(item.str||'').trim(); if(!str)continue;
      const x=Number(item.transform?.[4])||0,y=Number(item.transform?.[5])||0;
      let row=rows.find(r=>Math.abs(r.y-y)<=2.5);
      if(!row){row={y,items:[]};rows.push(row)}
      row.items.push({x,str});
    }
    rows.sort((a,b)=>b.y-a.y);
    const lines=rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean);
    pages.push(lines);
  }
  return pages;
}
async function analyzeEstimatePdf(blob){
  const pages=await pdfTextLines(blob);
  const allLines=[];
  pages.forEach((lines,pageIndex)=>lines.forEach((line,lineIndex)=>allLines.push({line,pageIndex,lineIndex,linesOnPage:lines.length})));
  if(!allLines.length)return null;

  const skipRe=/(?:итого|всего).*(?:добавленн|дополнительн|по\s+разделу|раздела|по\s+этапу|этапа|по\s+позици|позици|по\s+группе|группы)/i;
  const strongLabels=[
    {re:/итоговая\s+сумма/i,label:'Итоговая сумма',priority:1000},
    {re:/общая\s+(?:стоимость|сумма)/i,label:'Общая сумма',priority:980},
    {re:/итого\s+по\s+смете/i,label:'Итого по смете',priority:970},
    {re:/всего\s+по\s+смете/i,label:'Всего по смете',priority:965},
    {re:/всего\s+к\s+оплате/i,label:'Всего к оплате',priority:960},
    {re:/итого\s+к\s+оплате/i,label:'Итого к оплате',priority:955},
    {re:/к\s+оплате/i,label:'К оплате',priority:940}
  ];
  const genericLabels=[
    {re:/^\s*итого\b/i,label:'Итого'},
    {re:/^\s*всего\b/i,label:'Всего'}
  ];
  const candidates=[];
  const lastPage=pages.length-1;

  function addCandidate(entry,label,priority,isStrong){
    if(skipRe.test(entry.line))return;
    const m=entry.line.match(label.re); if(!m)return;
    const after=entry.line.slice((m.index||0)+m[0].length);
    let values=moneyValues(after),source='same';
    if(!values.length){
      const next=pages[entry.pageIndex]?.[entry.lineIndex+1];
      if(next){values=moneyValues(next);source='next'}
    }
    if(!values.length)return;
    const amount=values[values.length-1];
    if(!(amount>=1))return;
    const globalIndex=allLines.indexOf(entry);
    const endRatio=globalIndex/Math.max(1,allLines.length-1);
    const pageEndRatio=entry.lineIndex/Math.max(1,entry.linesOnPage-1);
    const finalZone=entry.pageIndex===lastPage&&pageEndRatio>=0.55;
    if(!isStrong&&!finalZone)return;
    candidates.push({
      amount,label:label.label,
      score:priority+(entry.pageIndex===lastPage?220:0)+(endRatio*120)+(pageEndRatio*40)-(source==='next'?2:0),
      globalIndex,
      isStrong
    });
  }

  for(const entry of allLines){
    for(const label of strongLabels)addCandidate(entry,label,label.priority,true);
    for(const label of genericLabels)addCandidate(entry,label,500,false);
  }
  if(!candidates.length)return null;

  const strong=candidates.filter(c=>c.isStrong);
  const pool=strong.length?strong:candidates;
  pool.sort((a,b)=>b.score-a.score||b.globalIndex-a.globalIndex);
  return pool[0];
}
async function analyzePdfMeta(meta,blob){
  meta.analysisStatus='processing';
  meta.analysisVersion=ESTIMATE_PARSER_VERSION;
  try{
    const result=await analyzeEstimatePdf(blob);
    if(result){
      meta.estimateTotal=result.amount;
      meta.estimateLabel=result.label;
      meta.analysisStatus='recognized';
      return true;
    }
    delete meta.estimateTotal;delete meta.estimateLabel;
    meta.analysisStatus='not_found';
    return false;
  }catch(e){
    console.error('PDF analysis failed',e);
    delete meta.estimateTotal;delete meta.estimateLabel;
    meta.analysisStatus='error';
    return false;
  }
}
function toast(msg,err=false){
  const e=$('#toast');
  e.textContent=msg;
  e.classList.toggle('error',err);
  e.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>e.classList.remove('show'),3000);
}
