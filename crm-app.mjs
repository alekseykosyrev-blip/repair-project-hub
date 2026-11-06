import {STORE,BACKUP,blank,read,write,clone,assert,cents,quantity,amount,rub,qfmt,sum,project as getProject,estimate as getEstimate,newProject,newEstimate,addRate,addLine,estimateTotal,approveEstimate,addExpense,addPayment,reversePayment,addAct,addTask,summary,closeProject,legacyPreview,importLegacy,today} from './crm-core.mjs';

const app=document.getElementById('app');
const modal=document.getElementById('modal');
const file=document.getElementById('importFile');
const money=rub, fmt=qfmt;
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=null,view='dashboard',tab='overview',activeId=null,filter='',fatal=null,toastTimer=null;
try{state=read()}catch(err){fatal=err.message}
function notify(s,error=false){const x=document.getElementById('toast');x.textContent=s;x.className='show'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>x.className='',3600)}
function save(){state=write(state);render()}
function attempt(f){try{f();save();notify('Сохранено')}catch(e){notify(e.message||'Ошибка операции',true)}}
function p(){return getProject(state,activeId)}
function rows(items,fn){return items.length?items.map(fn).join(''):'<tr><td colspan="9"><div class="empty">Пока нет записей</div></td></tr>'}
function btn(text,action,style='',args=''){return '<button type="button" class="btn '+style+'" data-action="'+action+'" '+args+'>'+text+'</button>'}
function tag(tone,text){return '<span class="badge '+tone+'">'+safe(text)+'</span>'}
function metric(title,value,desc,em=false){return '<div class="kpi'+(em?' green':'')+'"><span class="klabel">'+title+'</span><strong>'+value+'</strong><div class="hint">'+desc+'</div></div>'}
function titlePage(title,desc,buttons=''){return '<header class="topbar"><div><div class="crumb">СтройCRM / Рабочее пространство</div><h1 class="pageTitle">'+title+'</h1><p class="subtitle">'+desc+'</p></div><div class="topactions">'+buttons+'</div></header>'}
function panel(title,content,actions=''){return '<section class="panel"><div class="paneltitle"><h2>'+title+'</h2><div class="actions">'+actions+'</div></div>'+content+'</section>'}
function headings(array){return '<thead><tr>'+array.map(t=>'<th>'+t+'</th>').join('')+'</tr></thead>'}
function table(head,body){return '<div class="tablewrap"><table>'+headings(head)+'<tbody>'+body+'</tbody></table></div>'}
function stat(t,v){return '<div class="statline"><span>'+t+'</span><strong>'+v+'</strong></div>'}
function statusLabel(v){return v==='closed'?tag('green','Завершён'):tag('orange','В работе')}
const navs=[['dashboard','Обзор','▦'],['projects','Объекты','▤'],['finances','Финансы','₽'],['rates','Расценки','≡'],['analytics','Отчёты','▥'],['data','Данные','⬇']];
function shell(content){
  app.innerHTML='<div class="app"><aside class="sidebar"><div class="brand"><div class="brandmark">С</div><div class="brandtext"><b>СТРОЙCRM</b><span>ПРОЕКТЫ · ФИНАНСЫ</span></div></div><div class="mobilebrand">СТРОЙCRM · РАБОЧЕЕ ПРОСТРАНСТВО</div><div class="navlabel">Управление</div><nav class="nav">'+navs.map(n=>'<button class="navbutton'+((view===n[0]||(view==='project'&&n[0]==='projects'))?' active':'')+'" data-action="nav" data-view="'+n[0]+'"><span class="symbol">'+n[2]+'</span>'+n[1]+'</button>').join('')+'</nav><div class="sidebarbottom"><button class="sidelink" data-action="backup">↓ Скачать резервную копию</button><div class="sidebarcaption">Локальное хранение · без регистрации. Для работы с нескольких устройств потребуется серверная синхронизация.</div></div></aside><main class="main">'+content+'<div class="footer">СтройCRM · Новая рабочая версия. Исходные данные предыдущего приложения не изменяются автоматически.</div></main></div>';
}
function dashboard(){
const ps=state.projects;
const totals=ps.reduce((a,x)=>{const s=summary(x);a.agreed+=s.agreed;a.received+=s.received;a.toCollect+=s.toCollect;a.expenses+=s.expenses;return a},{agreed:0,received:0,toCollect:0,expenses:0});
const latest=ps.slice(0,6);
let body=titlePage('Обзор компании','Объекты, задачи и финансы в одном месте',btn('+ Новый объект','newProject','primary')+btn('Экспорт','backup'));
body+='<div class="kpis">'+metric('Активных объектов',String(ps.filter(x=>x.status!=='closed').length),'Все объекты в работе',true)+metric('Согласовано',money(totals.agreed),'Общая стоимость работ')+metric('Получено',money(totals.received),'Зачтённые платежи')+metric('К получению по актам',money(totals.toCollect),'Актировано за вычетом оплат')+'</div>';
body+='<div class="grid columns"><div>'+panel('Последние объекты',ps.length?table(['Объект','Статус','Согласовано','Получено'],latest.map(x=>{const s=summary(x);return '<tr class="clickrow" data-action="openProject" data-id="'+safe(x.id)+'"><td><div class="projectname">'+safe(x.title)+'</div><div class="projclient">'+safe(x.client||'Заказчик не указан')+'</div></td><td>'+statusLabel(x.status)+'</td><td class="money">'+money(s.agreed)+'</td><td class="money">'+money(s.received)+'</td></tr>'}).join('')):'<div class="empty"><strong>Создай первый объект</strong>Начни с объекта, добавь смету и задачи.</div>',btn('Все объекты','goProjects'))+'</div><div>'+panel('Рабочая последовательность','<div class="stepList">'+[['01','Объект','Создай карточку объекта и укажи заказчика'],['02','Смета','Добавь работы и утверждённые расценки'],['03','Выполнение','Вноси расходы и подписанные акты'],['04','Оплата','Записывай платежи и закрывай задолженность'],['05','Завершение','Закрой объект после полного расчёта']].map(x=>'<div class="step"><div class="stepnum">'+x[0]+'</div><div><b>'+x[1]+'</b>'+x[2]+'</div></div>').join('')+'</div>')+'</div></div>';
return body;
}
function projects(){
let ps=state.projects.filter(x=>(x.title+' '+x.client).toLowerCase().includes(filter.toLowerCase()));
return titlePage('Объекты','Контроль всех строительных проектов',btn('+ Новый объект','newProject','primary'))+
panel('Список объектов','<div class="row" style="margin-bottom:16px"><input class="input search" id="search" placeholder="Поиск по объекту или клиенту" value="'+safe(filter)+'"><span class="small">Всего: '+ps.length+'</span></div>'+table(['Наименование','Статус','Согласовано','Расходы','Получено','Действие'],rows(ps,x=>{const s=summary(x);return '<tr><td><div class="projectname">'+safe(x.title)+'</div><div class="projclient">'+safe(x.client||x.address||'—')+'</div></td><td>'+statusLabel(x.status)+'</td><td class="money">'+money(s.agreed)+'</td><td class="money">'+money(s.expenses)+'</td><td class="money">'+money(s.received)+'</td><td><button class="link" data-action="openProject" data-id="'+safe(x.id)+'">Открыть</button></td></tr>'})));
}
function current(){
const x=p();if(!x)return projects();
const s=summary(x);
let h=titlePage('<span style="font-size:13px;color:#679079">Объекты /</span> '+safe(x.title),safe(x.client||'Заказчик не указан')+' · '+safe(x.address||'Адрес не указан'),btn('← К объектам','goProjects')+(x.status!=='closed'?btn('Завершить объект','closeProject','soft'):''));
h+='<div class="projfacts">'+statusLabel(x.status)+'<span class="fact">Задач открыто: <b>'+s.tasksOpen+'</b></span><span class="fact">Смет: <b>'+x.estimates.length+'</b></span><span class="fact">Актов: <b>'+x.acts.length+'</b></span></div>';
h+='<div class="kpis" style="margin-top:17px">'+metric('Согласовано',money(s.agreed),'Утверждённые сметы',true)+metric('Актировано',money(s.acted),'Подписанные акты')+metric('Получено',money(s.received),'Без отменённых платежей')+metric('Остаток по договору',money(s.contractRemainder),'Согласовано минус оплаты')+'</div>';
const tabs=[['overview','Карточка'],['estimates','Сметы'],['expenses','Расходы'],['acts','Акты'],['payments','Оплаты'],['tasks','Задачи']];
h+='<div class="tabs">'+tabs.map(t=>'<button data-action="tab" data-tab="'+t[0]+'" class="tab'+(tab===t[0]?' active':'')+'">'+t[1]+'</button>').join('')+'</div>';
if(tab==='overview')h+=overviewTab(x,s);
if(tab==='estimates')h+=estimatesTab(x);
if(tab==='expenses')h+=expensesTab(x);
if(tab==='acts')h+=actsTab(x);
if(tab==='payments')h+=paymentsTab(x);
if(tab==='tasks')h+=tasksTab(x);
return h;
}
function overviewTab(x,s){
let content='<div class="grid columns"><div>'+panel('Быстрые действия','<div class="shortcutGrid">'+[['＋','Смета','newEstimate'],['▤','Расход','newExpense'],['₽','Оплата','newPayment'],['✓','Подписанный акт','newAct'],['☷','Задача','newTask'],['✎','Заметка','editNote']].map(([symbol,title,action])=>'<button class="shortcut" data-action="'+action+'"><span>'+symbol+'</span>'+title+'</button>').join('')+'</div>')+'</div><div>'+panel('Финансовый итог',stat('Стоимость договора',money(s.agreed))+stat('Актировано',money(s.acted))+stat('Получено',money(s.received))+stat('К получению по актам',money(s.toCollect))+stat('Осталось актировать',money(s.unacted))+stat('Фактические расходы',money(s.expenses))+stat('Расчётная прибыль',money(s.profit)))+'</div></div>';
if(x.notes)content+=panel('Заметки','<div style="white-space:pre-wrap;font-size:13px;line-height:1.6">'+safe(x.notes)+'</div>',btn('Изменить','editNote'));
if(x.legacyInfo)content+='<div class="alert">Импортировано из старого приложения. Документы и расценки остались в предыдущей версии, финансовые данные требуют отдельной сверки. '+btn('Открыть архив','legacy','soft')+'</div>';
return content;
}
function estimatesTab(x){
let out=panel('Сметы объекта',x.estimates.length?table(['Смета','Статус','Позиций','Сумма','Действия'],x.estimates.map(e=>{const t=estimateTotal(e);return '<tr><td><div class="strong">'+safe(e.title)+'</div><div class="small">'+(t.missing?'Без расценок: '+t.missing:'Все цены заполнены')+'</div></td><td>'+tag(e.approved?'green':'orange',e.approved?'Согласована':'Черновик')+'</td><td>'+e.items.length+'</td><td class="money">'+money(t.priced)+'</td><td>'+btn('Открыть','openEstimate','','data-id="'+safe(e.id)+'"')+(e.approved?'':btn('Утвердить','approveEstimate','soft','data-id="'+safe(e.id)+'"'))+'</td></tr>'}).join('')):'<div class="empty"><strong>Пока нет смет</strong>Добавь первую смету по объекту.</div>',btn('+ Новая смета','newEstimate','primary'));
if(window.__estimateId){const e=getEstimate(x,window.__estimateId);if(e){const t=estimateTotal(e);
out+='<div style="margin-top:16px">'+panel('Смета: '+safe(e.title),'<div class="info">Стоимость рассчитывается только по утверждённым расценкам из справочника. Нет цены — позиция остаётся без стоимости.</div>'+table(['Помещение / работа','Объём','Цена за ед.','Сумма'],rows(e.items,i=>'<tr><td><div class="strong">'+safe(i.name)+'</div><div class="small">'+safe(i.room)+'</div></td><td>'+fmt(i.qtyMilli)+' '+safe(i.unit)+'</td><td class="money">'+(i.priceCents===null?'Нет цены':money(i.priceCents))+'</td><td class="money">'+(i.priceCents===null?'—':money(amount(i.qtyMilli,i.priceCents)))+'</td></tr>'))+'<div class="row" style="margin-top:15px"><div><b>Итого с расценками: '+money(t.priced)+'</b><div class="small">'+(t.missing?'Без расценок: '+t.missing:'Все позиции оценены')+'</div></div></div>',e.approved?tag('green','Согласована'):btn('+ Работа','newLine','primary','data-id="'+safe(e.id)+'"')+btn('Согласовать','approveEstimate','soft','data-id="'+safe(e.id)+'"'))+'</div>';
}}
return out;
}
function expensesTab(x){const s=summary(x);return panel('Фактические расходы',table(['Дата','Статья','Категория','Сумма'],rows(x.expenses.slice().reverse(),i=>'<tr><td>'+safe(i.date)+'</td><td class="strong">'+safe(i.title)+'</td><td>'+safe(i.category)+'</td><td class="money">'+money(i.amountCents)+'</td></tr>'))+'<div class="row" style="margin-top:16px"><b>Всего: '+money(s.expenses)+'</b></div>',btn('+ Добавить расход','newExpense','primary'))}
function actsTab(x){const s=summary(x);return panel('Подписанные акты',table(['Номер','Дата','Смета','Сумма'],rows(x.acts.slice().reverse(),i=>'<tr><td class="strong">'+safe(i.number)+'</td><td>'+safe(i.date)+'</td><td>'+safe(getEstimate(x,i.estimateId)?.title||'—')+'</td><td class="money">'+money(i.amountCents)+'</td></tr>'))+'<div class="row" style="margin-top:16px"><b>Итого актировано: '+money(s.acted)+'</b><span class="small">Записи подписанных актов не редактируются</span></div>',btn('+ Подписанный акт','newAct','primary'))}
function paymentsTab(x){const s=summary(x);return panel('Поступления и корректировки',table(['Дата','Комментарий','Сумма','Состояние','Действие'],rows(x.payments.slice().reverse(),i=>'<tr><td>'+safe(i.date)+'</td><td>'+safe(i.note||'Оплата по объекту')+'</td><td class="money">'+money(i.amountCents)+'</td><td>'+tag(i.reversal?'orange':'green',i.reversal?'Отменена':'Зачтена')+'</td><td>'+(i.reversal?'<span class="small">'+safe(i.reversal.reason)+'</span>':btn('Исправить','reversePayment','danger','data-id="'+safe(i.id)+'"'))+'</td></tr>'))+'<div class="row" style="margin-top:16px"><b>Получено: '+money(s.received)+'</b><span class="small">Отмена сохраняет исходный платёж в истории</span></div>',btn('+ Зафиксировать оплату','newPayment','primary'))}
function tasksTab(x){return panel('Задачи по объекту',table(['Статус','Задача','Срок'],rows(x.tasks,t=>'<tr><td><input aria-label="Задача выполнена" type="checkbox" data-action="toggleTask" data-id="'+safe(t.id)+'" '+(t.done?'checked':'')+'></td><td><span '+(t.done?'style="text-decoration:line-through;color:#94a298"':'')+'>'+safe(t.title)+'</span></td><td>'+safe(t.due||'—')+'</td></tr>')),btn('+ Задача','newTask','primary'))}
function rates(){return titlePage('Расценки','Только расценки, уже утверждённые тобой или оценщиком',btn('+ Добавить расценку','newRate','primary'))+panel('Справочник работ',table(['Вид работ','Единица','Утверждённая цена'],rows(state.rates,r=>'<tr><td class="strong">'+safe(r.title)+'</td><td>'+safe(r.unit)+'</td><td class="money positive">'+money(r.priceCents)+'</td></tr>'))+'<div class="info">Сметчик использует утверждённые цены. Для новой работы без цены сначала получи расценку у оценщика.</div>')}
function finances(){const ps=state.projects;const rowsHtml=rows(ps,x=>{const s=summary(x);return '<tr class="clickrow" data-action="openProject" data-id="'+safe(x.id)+'"><td class="strong">'+safe(x.title)+'</td><td class="money">'+money(s.agreed)+'</td><td class="money">'+money(s.acted)+'</td><td class="money">'+money(s.received)+'</td><td class="money">'+money(s.contractRemainder)+'</td><td class="money">'+money(s.expenses)+'</td><td class="money '+(s.profit<0?'negative':'positive')+'">'+money(s.profit)+'</td></tr>'});return titlePage('Финансовый центр','Согласовано → акты → поступления → расходы и прибыль')+panel('План / факт по объектам',table(['Объект','Договор','Акты','Получено','Не оплачено','Расходы','Прибыль'],rowsHtml)+'<div class="info">Прибыль = согласованная стоимость работ − учтённые расходы. Это управленческий расчёт, не фактический денежный остаток.</div>')}
function analytics(){const ps=state.projects;let t={approved:0,expenses:0,received:0,acted:0,profit:0};ps.forEach(x=>{const s=summary(x);t.approved+=s.agreed;t.expenses+=s.expenses;t.received+=s.received;t.acted+=s.acted;t.profit+=s.profit});return titlePage('Управленческий отчёт','Показатели по всем объектам без двойного учёта')+'<div class="kpis">'+metric('Стоимость договоров',money(t.approved),'Согласованные сметы',true)+metric('Подписанные акты',money(t.acted),'Факт актирования')+metric('Поступления',money(t.received),'Зачтённые деньги')+metric('Расходы',money(t.expenses),'По всем объектам')+'</div>'+panel('Экономика компании',stat('Договорная выручка',money(t.approved))+stat('Минус учтённые расходы',money(t.expenses))+stat('Расчётная прибыль',money(t.profit))+stat('Рентабельность договора',t.approved?(t.profit/t.approved*100).toFixed(1)+' %':'—')+'<div class="alert">Это управленческая оценка: незавершённые работы, налоги, задолженности и будущие расходы могут менять итоговую прибыль.</div>')}
function dataPage(){const old=legacyPreview();return titlePage('Хранение и резервные копии','Контроль данных и переход со старой CRM')+'<div class="grid columns"><div>'+panel('Резервное копирование','<div class="info">Рабочие данные хранятся в этом браузере. Перед сменой телефона, очисткой браузера или переустановкой обязательно скачай копию JSON.</div><div class="actions">'+btn('Скачать копию','backup','primary')+btn('Восстановить из файла','restore')+'</div><div class="splitline"></div><div class="small">Также хранится предыдущая версия данных для локального восстановления после последнего сохранения.</div>')+'</div><div>'+panel('Переход со старой CRM','<div class="statline"><span>Найдена старая база</span><strong>'+(old.found?'Да':'Нет')+'</strong></div><div class="statline"><span>Объектов в старой базе</span><strong>'+(old.count??'—')+'</strong></div><div class="alert">Импорт переносит названия объектов и задачи. Старые PDF, акты, оплаты и сметные суммы НЕ переносятся автоматически: их нужно сверять отдельно.</div><div class="actions">'+btn('Перенести объекты','migrate','soft',' '+(!old.found?'disabled':''))+btn('Открыть старую CRM','legacy')+'</div>')+'</div></div>'}
function render(){
if(fatal){app.innerHTML='<main style="max-width:600px;margin:70px auto;padding:28px;background:white;border-radius:18px"><h1>Не удалось открыть данные</h1><div class="alert">'+safe(fatal)+'</div>'+btn('Восстановить предыдущую копию','recover','primary')+'</main>';return}
let html;
if(view==='dashboard')html=dashboard();
else if(view==='projects')html=projects();
else if(view==='project')html=current();
else if(view==='finances')html=finances();
else if(view==='rates')html=rates();
else if(view==='analytics')html=analytics();
else html=dataPage();
shell(html);
}
function f(label,name,type='text',value='',required=false){
const content=type==='textarea'?'<textarea class="textarea" name="'+name+'" '+(required?'required':'')+'>'+safe(value)+'</textarea>':'<input class="input" name="'+name+'" type="'+type+'" value="'+safe(value)+'" '+(required?'required':'')+'>';
return '<div class="formgroup"><label>'+label+'</label>'+content+'</div>';
}
function select(label,name,options){return '<div class="formgroup"><label>'+label+'</label><select class="select" name="'+name+'">'+options.map(o=>'<option value="'+safe(o[0])+'">'+safe(o[1])+'</option>').join('')+'</select></div>'}
function form(action,id=''){
const x=p();let title='',fields='';
switch(action){
case 'newProject':title='Новый объект';fields=f('Название объекта','title','text','',true)+f('Заказчик','client')+f('Адрес','address');break;
case 'newEstimate':title='Новая смета';fields=f('Название сметы','title','text','',true);break;
case 'newLine':{const rates=state.rates;title='Добавить работу';fields=f('Помещение / раздел','room','text','Общие работы',true)+f('Название работы','name','text','',true)+f('Объём','quantity','text','',true)+select('Единица','unit',['м²','м.п.','шт.','компл.'].map(u=>[u,u]))+select('Утверждённая расценка','rateId',[['','— Цена отсутствует —'],...rates.map(r=>[r.id,r.title+' · '+r.unit+' · '+money(r.priceCents)])]);break}
case 'newRate':title='Добавить утверждённую расценку';fields=f('Вид работы','title','text','',true)+select('Единица','unit',['м²','м.п.','шт.','компл.'].map(u=>[u,u]))+f('Цена за единицу, ₽','price','text','',true)+'<div class="formgroup full"><label class="check"><input type="checkbox" name="approved" required> Подтверждаю: эта расценка уже утверждена, её можно использовать в сметах.</label></div>';break;
case 'newExpense':title='Фактический расход';fields=f('Наименование','title','text','',true)+select('Категория','category',['Материалы','Работа','Подрядчики','Доставка','Прочее'].map(z=>[z,z]))+f('Сумма, ₽','amount','text','',true)+f('Дата','date','date',today(),true);break;
case 'newPayment':title='Поступившая оплата';fields=f('Сумма, ₽','amount','text','',true)+f('Дата','date','date',today(),true)+f('Комментарий','note');break;
case 'reversePayment':title='Корректировка оплаты';fields='<div class="formgroup full"><div class="alert">Исходная запись останется в истории, но сумма перестанет учитываться в поступлениях.</div></div>'+f('Причина корректировки','reason','text','',true);break;
case 'newAct':title='Подписанный акт';fields=select('Согласованная смета','estimateId',x.estimates.filter(e=>e.approved).map(e=>[e.id,e.title+' · '+money(estimateTotal(e).priced)]))+f('Номер акта','number','text','Акт №'+(x.acts.length+1),true)+f('Сумма подписанных работ, ₽','amount','text','',true);break;
case 'newTask':title='Новая задача';fields=f('Что нужно сделать','title','text','',true)+f('Срок','due','date');break;
case 'editNote':title='Заметки по объекту';fields='<div class="formgroup full"><label>Заметки</label><textarea name="notes" class="textarea">'+safe(x.notes||'')+'</textarea></div>';break;
default:return;
}
modal.innerHTML='<form id="recordForm" method="dialog"><div class="modalhead"><h2>'+title+'</h2><button type="button" class="btn" data-modal-close>✕</button></div><div class="modalbody"><div class="formgrid">'+fields+'</div></div><div class="modalfoot"><button type="button" class="btn" data-modal-close>Отмена</button><button type="submit" class="btn primary">Сохранить</button></div></form>';
modal.dataset.kind=action;modal.dataset.itemid=id;modal.querySelectorAll('[data-modal-close]').forEach(b=>b.onclick=()=>modal.close());
modal.querySelector('form').addEventListener('submit',submit);
modal.showModal();setTimeout(()=>modal.querySelector('.input,.textarea')?.focus(),50);
}
function submit(ev){
ev.preventDefault();
const action=modal.dataset.kind,id=modal.dataset.itemid,d=new FormData(ev.target),v=k=>String(d.get(k)||'');
try{
if(action==='newProject'){const x=newProject(state,v('title'),v('client'),v('address'));activeId=x.id;view='project';tab='overview'}
if(action==='newEstimate'){newEstimate(p(),v('title'));tab='estimates'}
if(action==='newLine'){addLine(state,p(),getEstimate(p(),id),v('room'),v('name'),v('quantity'),v('unit'),v('rateId'));tab='estimates';window.__estimateId=id}
if(action==='newRate')addRate(state,v('title'),v('unit'),v('price'),d.has('approved'));
if(action==='newExpense')addExpense(p(),v('title'),v('category'),v('amount'),v('date'));
if(action==='newPayment')addPayment(p(),v('amount'),v('note'),v('date'));
if(action==='reversePayment')reversePayment(p(),id,v('reason'));
if(action==='newAct')addAct(p(),v('estimateId'),v('amount'),v('number'));
if(action==='newTask')addTask(p(),v('title'),v('due'));
if(action==='editNote')p().notes=v('notes');
save();modal.close();notify('Сохранено');
}catch(e){notify(e.message,true)}
}
function backup(){
try{const raw=localStorage.getItem(STORE)||JSON.stringify(state);const blob=new Blob([raw],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='StroyCRM-backup-'+today()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Резервная копия сохранена')}catch(e){notify(e.message,true)}
}
function action(act,el){
const id=el.dataset.id;
if(act==='nav'){view=el.dataset.view;render();return}
if(act==='goProjects'){view='projects';render();return}
if(act==='openProject'){activeId=id;view='project';tab='overview';window.__estimateId=null;render();return}
if(act==='tab'){tab=el.dataset.tab;render();return}
if(['newProject','newEstimate','newRate','newExpense','newPayment','reversePayment','newAct','newTask','editNote','newLine'].includes(act)){if(act==='newAct'&&!p().estimates.some(e=>e.approved))return notify('Сначала согласуй смету',true);form(act,id);return}
if(act==='openEstimate'){window.__estimateId=id;render();return}
if(act==='approveEstimate'){attempt(()=>approveEstimate(getEstimate(p(),id)));return}
if(act==='toggleTask'){attempt(()=>{const t=p().tasks.find(x=>x.id===id);assert(t,'Задача не найдена');t.done=!t.done});return}
if(act==='closeProject'){attempt(()=>closeProject(p()));return}
if(act==='backup'){backup();return}
if(act==='restore'){file.click();return}
if(act==='recover'){try{const r=localStorage.getItem(BACKUP);assert(r,'Нет предыдущей копии');const s=JSON.parse(r);assert(s?.version===2&&Array.isArray(s.projects),'Неверная копия');localStorage.setItem(STORE,r);state=read();fatal=null;render();notify('Предыдущая копия восстановлена')}catch(e){notify(e.message,true)}return}
if(act==='migrate'){if(!confirm('Перенести названия и задачи из старой CRM? Финансовые данные и документы НЕ переносятся. Старая база останется нетронутой.'))return;attempt(()=>{const n=importLegacy(state);notify('Перенесено объектов: '+n)});return}
if(act==='legacy'){location.href='legacy.html';return}
}
app.addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(b&&b.tagName!=='INPUT')action(b.dataset.action,b)});
app.addEventListener('change',ev=>{const t=ev.target;if(t.matches('[data-action="toggleTask"]'))action('toggleTask',t);if(t.id==='search'){filter=t.value;render()}});
app.addEventListener('input',ev=>{if(ev.target.id==='search'){filter=ev.target.value;const start=ev.target.selectionStart;render();const x=document.getElementById('search');x?.focus();x?.setSelectionRange(start,start)}});
file.addEventListener('change',async()=>{
if(!file.files?.length)return;
try{const text=await file.files[0].text();const data=JSON.parse(text);assert(data?.version===2&&Array.isArray(data.projects)&&Array.isArray(data.rates),'Формат файла не подходит');
if(!confirm('Заменить текущую новую базу данными из этого файла? Перед восстановлением будет сохранена предыдущая версия в браузере.'))return;
state=write(data);activeId=null;view='dashboard';render();notify('Копия восстановлена')}catch(e){notify('Импорт не удался: '+e.message,true)}finally{file.value=''}
});
window.addEventListener('unhandledrejection',ev=>notify('Ошибка: '+(ev.reason?.message||'операция не выполнена'),true));
render();
