(()=>{
'use strict';
const KEY='repair-hub-smetchik-url-v1',SCHEMA='repair-hub-estimate-result-v1';
const el=id=>document.getElementById(id),p=()=>typeof active==='function'?active():null;
const num=v=>v===null||v===undefined||v===''?null:(()=>{const n=Number(String(v).replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:null})();
const money=v=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'}).format(v);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function permitted(v){try{const u=new URL(String(v||'').trim());return u.protocol==='https:'&&['chatgpt.com','chat.openai.com'].includes(u.hostname)?u.href:null}catch{return null}}
function saved(){try{return permitted(localStorage.getItem(KEY))}catch{return null}}
function message(s,error=false){const x=el('smetchikStatus');if(x){x.textContent=s;x.style.color=error?'#a13838':'#285c3b'}}
function pack(){const x=window.measurementPackageForEstimator?.();if(!x?.project?.id||!x.items?.length)throw Error('Сначала выбери объект и внеси обмеры.');return x}
function request(x){
return [
'СМЕТЧИК. Проверь обмеры и подготовь рабочую смету по помещениям.',
'Используй только УТВЕРЖДЁННЫЕ расценки. Цены самостоятельно не назначай. Ни одной позиции не пропускай. Сохрани порядок, помещение, работу, единицу и объём.',
'Для отсутствующей расценки возвращай priceStatus="missing", unitPrice=null, amount=null и комментарий: "Для этой работы нет утверждённой расценки. Нужно передать оценщику". Для известных утверждённых расценок возвращай priceStatus="approved", unitPrice в рублях и amount=quantity*unitPrice. Все расчёты перепроверь.',
'После пояснения верни JSON между маркерами ESTIMATE_RESULT_JSON_START и ESTIMATE_RESULT_JSON_END. Формат:',
'ESTIMATE_RESULT_JSON_START',
JSON.stringify({schema:SCHEMA,projectId:x.project.id,items:[{room:'Название помещения',work:'Работа',unit:'м²',quantity:1,unitPrice:null,amount:null,priceStatus:'missing',comment:'нет утверждённой расценки'}],notes:'Комментарии'},null,2),
'ESTIMATE_RESULT_JSON_END',
'ЭТО ТОЛЬКО ПРИМЕР ФОРМАТА. Верни реальные позиции из следующего пакета, не копируй пример.',
'ИСХОДНЫЕ ОБМЕРЫ:',JSON.stringify(x,null,2)
].join('\n\n')}
async function copy(s){
try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(s);return true}}catch{}
const t=document.createElement('textarea');t.value=s;t.style.cssText='position:fixed;top:0;left:0;opacity:.01;z-index:99999';document.body.appendChild(t);t.select();let ok=false;try{ok=document.execCommand('copy')}catch{}t.remove();if(!ok){const f=el('smetchikRequestFallback');f.hidden=false;f.value=s;f.focus();f.select()}return ok}
function saveLink(){
const v=el('smetchikLink').value.trim();if(!v){try{localStorage.removeItem(KEY)}catch{}message('Ссылка очищена: откроется обычный ChatGPT.');return}
const u=permitted(v);if(!u){message('Вставь ссылку на своего Сметчика с chatgpt.com.',true);return}
try{localStorage.setItem(KEY,u);message('Ссылка сохранена на этом устройстве.')}catch{message('Сохранение ссылки заблокировано браузером.',true)}}
function open(){
let s;try{s=request(pack())}catch(e){message(e.message,true);return}
const tab=window.open(saved()||'https://chatgpt.com/','_blank','noopener,noreferrer');
copy(s).then(ok=>message((ok?'Обмеры скопированы. ':'Не удалось скопировать автоматически — выделен текст ниже. ')+(saved()?'Вставь запрос в открывшегося Сметчика.':'Открылся обычный ChatGPT. Чтобы открыть именно своего Сметчика, сохрани ссылку на него.')+(!tab?' Если новое окно не появилось, разреши всплывающие окна.':''),!ok))}
function parse(text){
let s=String(text||'').trim(),a=s.indexOf('ESTIMATE_RESULT_JSON_START'),b=s.indexOf('ESTIMATE_RESULT_JSON_END');
if(a>=0&&b>a)s=s.slice(a+'ESTIMATE_RESULT_JSON_START'.length,b).trim();
s=s.replace(/^\x60{3}(?:json)?\s*/i,'').replace(/\s*\x60{3}$/,'');
if(!s.startsWith('{')){const i=s.indexOf('{'),j=s.lastIndexOf('}');if(i>=0&&j>i)s=s.slice(i,j+1)}
return JSON.parse(s)}
function audit(text){
const data=parse(text),source=pack();if(data.projectId&&String(data.projectId)!==String(source.project.id))throw Error('В ответе указан другой объект.');
if(!Array.isArray(data.items)||data.items.length!==source.items.length)throw Error('Количество позиций отличается от исходных обмеров.');
let total=0,priced=0;const warnings=[];
const rows=source.items.map((x,i)=>{
 const y=data.items[i];if(!y||String(y.room)!==x.room||String(y.work)!==x.work||String(y.unit)!==x.unit)throw Error('Позиция '+(i+1)+' не совпадает с исходными данными.');
 const q=num(y.quantity),original=num(x.quantity);if(q===null||original===null||Math.abs(q-original)>0.00001)throw Error('Сметчик изменил объём в позиции '+(i+1)+'.');
 const price=num(y.unitPrice),valid=y.priceStatus==='approved'&&price!==null;
 const amount=valid?Math.round((original*price+Number.EPSILON)*100)/100:null;
 if(valid){priced++;total=Math.round((total+amount+Number.EPSILON)*100)/100;if(num(y.amount)===null||Math.abs(num(y.amount)-amount)>.01)warnings.push('Пересчитана позиция '+(i+1))}
 return {room:x.room,work:x.work,unit:x.unit,quantity:original,unitPrice:valid?price:null,amount,priceStatus:valid?'approved':'missing',comment:String(y.comment||'')};
});
return {schema:SCHEMA,projectId:source.project.id,createdAt:Date.now(),items:rows,total,priced,missing:rows.length-priced,warnings,notes:String(data.notes||''),approved:false}}
function render(){
const host=el('smetchikDraft');if(!host)return;const pr=p(),d=pr?.measurementEstimateResult;
if(!d||d.projectId!==pr.id){host.innerHTML='<p class="measurement-muted">Черновик сметы от ИИ ещё не загружен.</p>';return}
let html='<h4>Проверенный черновик</h4><p><b>Позиций: '+d.items.length+' · с расценками: '+d.priced+' · без расценок: '+d.missing+'</b></p><p><b>Предварительно: '+esc(money(d.total))+'</b></p><p class="measurement-muted">Не согласовано: эти суммы не влияют на акты, оплаты и финансы объекта.</p>';
html+='<div class="smetchik-scroll"><table><thead><tr><th>Работа</th><th>Объём</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>';
d.items.forEach(x=>{html+='<tr><td>'+esc(x.room+' · '+x.work)+'</td><td>'+esc(x.quantity+' '+x.unit)+'</td><td>'+esc(x.unitPrice===null?'—':money(x.unitPrice))+'</td><td>'+esc(x.amount===null?'Нет расценки':money(x.amount))+'</td></tr>'});
html+='</tbody></table></div>';if(d.warnings?.length)html+='<div class="measurement-note">'+esc(d.warnings.join('; '))+'</div>';
host.innerHTML=html;
}
function importResult(){const pr=p();if(!pr){message('Выбери объект.',true);return}
try{const result=audit(el('smetchikResponse').value);pr.measurementEstimateResult=result;if(typeof save==='function')save(false);render();message('Ответ проверен: '+result.priced+' с расценками, '+result.missing+' без цен; объёмы и математика проверены.')}catch(e){message('Импорт отменён: '+e.message,true)}}
function init(){
const root=el('measurementWorkspace');if(!root||el('smetchikBridge'))return;const aside=root.querySelector('aside.measurement-card');if(!aside)return;
const div=document.createElement('section');div.id='smetchikBridge';div.className='measurement-handoff smetchik-bridge';
div.innerHTML='<h3>🤖 Подключение сметчика</h3><p class="measurement-muted">Обмеры хранятся офлайн. Для ИИ нужен интернет: запрос копируется и открывается в ChatGPT; ответ загружается сюда. Прямого автоматического API пока нет.</p><label for="smetchikLink" class="measurement-muted">Ссылка на твоего Сметчика (один раз)</label><input id="smetchikLink" type="url" placeholder="https://chatgpt.com/g/..."><div class="measurement-toolbar"><button id="smetchikSave" class="measurement-btn soft">Сохранить ссылку</button><button id="smetchikOpen" class="measurement-btn primary">Скопировать и открыть Сметчика</button></div><textarea id="smetchikRequestFallback" hidden readonly aria-label="Запрос для Сметчика"></textarea><p class="measurement-muted">Вставь ответ Сметчика с блоком ESTIMATE_RESULT_JSON_START / END:</p><textarea id="smetchikResponse" placeholder="Ответ сметчика с расчётом" aria-label="Ответ Сметчика"></textarea><button class="measurement-btn primary" id="smetchikImport">Проверить и загрузить</button><div id="smetchikStatus" role="status" aria-live="polite" class="measurement-muted"></div><div id="smetchikDraft"></div>';
aside.prepend(div);el('smetchikLink').value=saved()||'';el('smetchikSave').onclick=saveLink;el('smetchikOpen').onclick=open;el('smetchikImport').onclick=importResult;render();
const base=window.render;if(typeof base==='function')window.render=function(){const r=base.apply(this,arguments);queueMicrotask(render);return r};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();