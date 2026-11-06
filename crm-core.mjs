export const STORE='repairCRM2_v1';
export const BACKUP='repairCRM2_backup_v1';
export const LEGACY='repairHubProjects_v1';
export const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36);
export const today=()=>new Date().toISOString().slice(0,10);
export function blank(){return {version:2,projects:[],rates:[],createdAt:Date.now(),updatedAt:Date.now()};}
export const clone=v=>JSON.parse(JSON.stringify(v));
export function assert(ok,msg){if(!ok)throw new Error(msg);}
export function cents(input){
  const s=String(input??'').replace(/[\s\u00a0\u202f₽]/g,'').replace(',','.');
  assert(/^\d+(?:\.\d{1,2})?$/.test(s),'Укажи корректную сумму (не более двух знаков после запятой)');
  const [a,b='']=s.split('.');
  const n=Number(a)*100+Number(b.padEnd(2,'0'));
  assert(Number.isSafeInteger(n)&&n>=0,'Слишком большая сумма');
  return n;
}
export function quantity(input){
  const s=String(input??'').replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
  assert(/^\d+(?:\.\d{1,3})?$/.test(s),'Объём должен быть числом с точностью до 0,001');
  const n=Math.round(Number(s)*1000);
  assert(Number.isSafeInteger(n)&&n>0,'Объём должен быть больше нуля');
  return n;
}
export const amount=(qMilli,priceCents)=>priceCents===null?null:Math.round(qMilli*priceCents/1000);
export const rub=v=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(v/100);
export const qfmt=m=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(m/1000);
export const sum=(a,fn)=>a.reduce((n,x)=>n+(fn(x)||0),0);
export function read(storage=localStorage){
  const raw=storage.getItem(STORE);
  if(!raw)return blank();
  let data;try{data=JSON.parse(raw)}catch{throw new Error('Хранилище повреждено. Новые записи остановлены; восстанови данные из резервной копии.');}
  assert(data&&data.version===2&&Array.isArray(data.projects)&&Array.isArray(data.rates),'Неизвестный формат данных. Запись остановлена.');
  return data;
}
export function write(state,storage=localStorage){
  assert(state.version===2&&Array.isArray(state.projects),'Ошибка структуры данных');
  const next=clone(state);next.updatedAt=Date.now();
  const previous=storage.getItem(STORE);
  if(previous){try{storage.setItem(BACKUP,previous)}catch{}}
  storage.setItem(STORE,JSON.stringify(next));
  return next;
}
export function project(state,id){return state.projects.find(x=>x.id===id);}
export function estimate(p,id){return p.estimates.find(x=>x.id===id);}
export function newProject(state,title,client='',address=''){
  assert(title.trim(),'Нужно название объекта');
  const p={id:uid(),title:title.trim(),client:client.trim(),address:address.trim(),status:'active',createdAt:Date.now(),estimates:[],expenses:[],payments:[],acts:[],tasks:[],notes:'',legacyInfo:null};
  state.projects.unshift(p);return p;
}
export function newEstimate(p,title){
  assert(title.trim(),'Нужно название сметы');
  const e={id:uid(),title:title.trim(),approved:false,createdAt:Date.now(),items:[]};p.estimates.push(e);return e;
}
export function addRate(state,title,unit,price,approved){
  assert(approved===true,'Сначала подтвердите, что расценка уже утверждена');
  assert(title.trim()&&['м²','м.п.','шт.','компл.'].includes(unit),'Заполни название и единицу');
  const r={id:uid(),title:title.trim(),unit,priceCents:cents(price),approved:true};state.rates.push(r);return r;
}
export function addLine(state,p,e,room,name,q,unit,rateId=''){
  assert(!e.approved,'Согласованную смету нельзя незаметно менять. Создай отдельную смету на дополнительные работы.');
  assert(name.trim(),'Нужно название работы');
  assert(['м²','м.п.','шт.','компл.'].includes(unit),'Неизвестная единица');
  const rate=rateId?state.rates.find(r=>r.id===rateId&&r.approved):null;
  if(rateId)assert(rate,'Расценка не найдена');
  if(rate)assert(rate.unit===unit,'Единица не совпадает с утверждённой расценкой');
  const item={id:uid(),room:room.trim()||'Общие работы',name:name.trim(),qtyMilli:quantity(q),unit,rateId:rate?.id||null,priceCents:rate?rate.priceCents:null};
  e.items.push(item);return item;
}
export function assignRate(state,e,lineId,rateId){
  assert(!e.approved,'Согласованную смету менять нельзя');
  const line=e.items.find(i=>i.id===lineId);
  assert(line,'Позиция не найдена');
  const rate=state.rates.find(r=>r.id===rateId&&r.approved);
  assert(rate,'Утверждённая расценка не найдена');
  assert(rate.unit===line.unit,'Единица расценки не совпадает с единицей работы');
  line.priceCents=rate.priceCents;line.rateId=rate.id;return line;
}
export function removeLine(e,lineId){
  assert(!e.approved,'Согласованную смету менять нельзя');
  const index=e.items.findIndex(i=>i.id===lineId);
  assert(index>=0,'Позиция не найдена');e.items.splice(index,1);
}
export function estimateTotal(e){
  const priced=sum(e.items,i=>amount(i.qtyMilli,i.priceCents));
  const missing=e.items.filter(i=>i.priceCents===null).length;
  return {priced,missing,complete:!!e.items.length&&!missing};
}
export function approveEstimate(e){
  const t=estimateTotal(e);assert(t.complete,'Нельзя согласовать смету без утверждённых расценок по всем позициям');
  assert(!e.approved,'Смета уже согласована');e.approved=true;e.approvedAt=Date.now();return t.priced;
}
export function addExpense(p,title,category,value,date=today()){
  assert(title.trim(),'Укажи расход');const x={id:uid(),title:title.trim(),category,date,amountCents:cents(value),createdAt:Date.now()};p.expenses.push(x);return x;
}
export function addPayment(p,value,note='',date=today()){
  const v=cents(value);assert(v>0,'Оплата должна быть больше нуля');
  const x={id:uid(),amountCents:v,note:note.trim(),date,createdAt:Date.now(),reversal:null};p.payments.push(x);return x;
}
export function reversePayment(p,id,reason){
  const x=p.payments.find(y=>y.id===id);
  assert(x&&!x.reversal,'Оплата не найдена или уже отменена');
  assert(reason.trim().length>=5,'Напиши причину корректировки (от пяти символов)');
  x.reversal={id:uid(),reason:reason.trim(),date:today(),createdAt:Date.now()};return x;
}
export function addAct(p,estimateId,value,number){
  const e=estimate(p,estimateId);assert(e&&e.approved,'Акт можно оформить только по согласованной смете');
  const v=cents(value);assert(v>0,'Сумма акта должна быть больше нуля');
  const already=sum(p.acts.filter(a=>a.estimateId===e.id&&a.signed),a=>a.amountCents);
  assert(already+v<=estimateTotal(e).priced,'Подписанные акты превысят согласованную сумму этой сметы');
  const a={id:uid(),estimateId:e.id,number:number.trim()||'Акт',date:today(),amountCents:v,signed:true,createdAt:Date.now()};
  p.acts.push(a);return a;
}
export function addTask(p,title,due=''){
  assert(title.trim(),'Напиши задачу');const t={id:uid(),title:title.trim(),due,done:false,createdAt:Date.now()};p.tasks.push(t);return t;
}
export function summary(p){
  const agreed=sum(p.estimates.filter(e=>e.approved),e=>estimateTotal(e).priced);
  const proposed=sum(p.estimates.filter(e=>!e.approved),e=>estimateTotal(e).priced);
  const expenses=sum(p.expenses,x=>x.amountCents);
  const received=sum(p.payments.filter(x=>!x.reversal),x=>x.amountCents);
  const acted=sum(p.acts.filter(x=>x.signed),x=>x.amountCents);
  return {agreed,proposed,expenses,received,acted,
    toCollect:Math.max(0,acted-received),
    contractRemainder:Math.max(0,agreed-received),
    unacted:Math.max(0,agreed-acted),
    profit:agreed-expenses,
    tasksOpen:p.tasks.filter(x=>!x.done).length};
}
export function closeProject(p){
  assert(p.status!=='closed','Объект уже закрыт');
  const s=summary(p);
  assert(s.agreed>0,'Нет согласованной сметы');
  assert(s.unacted===0,'Не все согласованные работы актированы');
  assert(s.contractRemainder===0,'Осталась неоплаченная сумма');
  p.status='closed';p.closedAt=Date.now();
}
export function legacyPreview(storage=localStorage){
  const raw=storage.getItem(LEGACY);if(!raw)return {found:false,count:0};
  try{const old=JSON.parse(raw);return {found:true,count:Array.isArray(old.projects)?old.projects.length:0};}
  catch{return {found:true,count:null,error:true};}
}
export function importLegacy(state,storage=localStorage){
  const raw=storage.getItem(LEGACY);assert(raw,'Старые данные не найдены');
  const old=JSON.parse(raw);assert(Array.isArray(old.projects),'Файл старого проекта повреждён');
  const known=new Set(state.projects.map(p=>p.legacyInfo?.sourceId).filter(x=>x!==undefined));
  let count=0;
  for(const prev of old.projects){
    if(known.has(prev.id))continue;
    const p=newProject(state,String(prev.name||'Объект'),String(prev.client||''),String(prev.address||''));
    p.status=prev.status==='Завершён'?'closed':'active';
    p.notes=String(prev.notes||'');
    p.legacyInfo={sourceId:prev.id,oldStatus:prev.status||'',documentCount:(prev.files||[]).length,warning:'Старые вложения и сметы остались в прежней версии; финансовые итоги не переносились автоматически'};
    p.tasks=(prev.tasks||[]).map(t=>({id:uid(),title:String(t.text||''),due:String(t.dueDate||''),done:!!t.done,createdAt:Date.now()}));
    count++;
  }
  return count;
}
