const KEY='repairHubProjects_v1';
const DB_NAME='repairProjectHubFiles_v1';
const DB_STORE='files';

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
  const labels=[
    {re:/итоговая\s+сумма/i,score:140,label:'Итоговая сумма'},
    {re:/всего\s+к\s+оплате/i,score:135,label:'Всего к оплате'},
    {re:/итого\s+к\s+оплате/i,score:132,label:'Итого к оплате'},
    {re:/к\s+оплате/i,score:128,label:'К оплате'},
    {re:/итого\s+по\s+смете/i,score:125,label:'Итого по смете'},
    {re:/всего/i,score:100,label:'Всего'},
    {re:/итого/i,score:90,label:'Итого'}
  ];
  const candidates=[];
  pages.forEach((lines,pageIndex)=>lines.forEach((line,lineIndex)=>{
    for(const label of labels){
      const m=line.match(label.re); if(!m)continue;
      const after=line.slice((m.index||0)+m[0].length);
      let values=moneyValues(after),fromNext=false;
      if(!values.length&&lines[lineIndex+1]){values=moneyValues(lines[lineIndex+1]);fromNext=true}
      if(values.length){
        const amount=Math.max(...values);
        if(amount>=1)candidates.push({amount,label:label.label,score:label.score+pageIndex*4+lineIndex/Math.max(lines.length,1)-(fromNext?1:0)});
      }
      break;
    }
  }));
  if(!candidates.length)return null;
  candidates.sort((a,b)=>b.score-a.score);
  return candidates[0];
}
async function analyzePdfMeta(meta,blob){
  meta.analysisStatus='processing';
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
