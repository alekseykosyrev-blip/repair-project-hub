(() => {
  const byId = id => document.getElementById(id);
  const panel = document.createElement('details');
  panel.id = 'fieldActions';
  panel.open = true;
  panel.innerHTML = `
    <summary><span>Рабочая панель</span><small>быстрые действия на объекте</small></summary>
    <div class="field-action-summary" id="fieldActionSummary"></div>
    <div class="field-action-grid"></div>`;

  const grid = panel.querySelector('.field-action-grid');
  function add(label, handler, className='') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `btn field-action-btn ${className}`.trim();
    button.textContent = label;
    button.addEventListener('click', handler);
    grid.append(button);
    return button;
  }
  function click(id, missing='Действие пока недоступно на этом экране.') {
    const el=byId(id);
    if(el)el.click(); else if(typeof toast==='function')toast(missing,true);
  }
  function project(){return typeof active==='function'?active():null}
  function finance(p){
    try{return typeof projectFinance==='function'?projectFinance(p):{toReceive:0,received:0,approved:0}}
    catch{return {toReceive:0,received:0,approved:0}}
  }
  function rub(v){return typeof formatRub==='function'?formatRub(v):Math.round(Number(v)||0).toLocaleString('ru-RU')+' ₽'}
  function taskIn(days) {
    click('addTaskBtn');
    setTimeout(()=>{
      const field=byId('taskDueDate');
      if(!field)return;
      const date = new Date();
      date.setDate(date.getDate() + days);
      const pad = value => String(value).padStart(2, '0');
      field.value = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
      field.dispatchEvent(new Event('change',{bubbles:true}));
    },40);
  }
  function closeProject(){
    const p=project();
    if(!p)return;
    const f=finance(p);
    if(Number(f.toReceive||0)>.01){
      if(typeof toast==='function')toast(`Объект пока нельзя закрыть: к получению ${rub(f.toReceive)}.`,true);
      return;
    }
    if(!(p.payments||[]).length){
      if(typeof toast==='function')toast('Сначала зафиксируй оплату по объекту.',true);
      return;
    }
    p.status='Завершён';
    const status=byId('status');
    if(status)status.value='Завершён';
    if(typeof save==='function')save(false);
    if(typeof render==='function')render();
    if(typeof toast==='function')toast('Объект закрыт.');
  }
  function focusNotes(){
    const notes=byId('notes');
    if(!notes)return;
    notes.scrollIntoView({behavior:'smooth',block:'center'});
    notes.focus();
    notes.setSelectionRange(notes.value.length, notes.value.length);
  }
  function openMeasurements(){location.href='https://foreman-field.webflow.io/'}

  add('📐 Обмеры', openMeasurements, 'primary');
  add('＋ Задача', () => taskIn(0));
  add('📷 Фото', () => click('addPhotosBtn'));
  add('₽ Расход', () => click('fcAddCost'));
  add('₽ Оплата', () => click('addPaymentBtn'));
  add('📄 Смета', () => click('addEstimateBtn'));
  add('✓ Акт', () => click('addActBtn'));
  add('✎ Заметка', focusNotes);
  add('☑ Закрыть объект', closeProject, 'finish');
  add('Помощник', () => click('firstUseHelperEntry'));

  add('Задача на завтра', () => taskIn(1));
  add('Добавить допработу', () => click('fcAddChange'));
  add('Загрузить договор', () => click('addContractBtn'));
  add('Прикрепить документ', () => click('addDocumentBtn'));

  add('Скопировать задачи бригаде', async () => {
    panel.querySelector('textarea')?.remove();
    const p = project();
    const tasks = (p?.tasks||[]).filter(task => !task.done);
    if (!tasks.length) {
      if(typeof toast==='function')toast('По этому объекту открытых задач нет.');
      return;
    }
    const lines = tasks.map((task, index) => {
      const due = task.dueDate || task.deadline;
      const details = [task.stage, due && 'до ' + due, task.priority === 'high' && 'важно'].filter(Boolean);
      return (index + 1) + '. ' + task.text + (details.length ? ' (' + details.join(', ') + ')' : '');
    });
    const message = [p?.name||'Объект', ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(message);
      if(typeof toast==='function')toast('Список задач скопирован.');
    } catch {
      const output = document.createElement('textarea');
      output.readOnly = true;
      output.className='field-action-copy';
      output.setAttribute('aria-label', 'Список задач для копирования');
      output.value = message;
      panel.append(output);
      output.focus();
      output.select();
      if(typeof toast==='function')toast('Текст выделен. Выберите «Копировать».');
    }
  });

  function updateSummary(){
    const box=byId('fieldActionSummary');
    const p=project();
    if(!box||!p)return;
    const open=(p.tasks||[]).filter(t=>!t.done);
    const today=new Date(); today.setHours(0,0,0,0);
    const overdue=open.filter(t=>{
      const raw=t.dueDate||t.deadline;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(raw||'')))return false;
      const d=new Date(raw+'T12:00:00'); d.setHours(0,0,0,0);
      return d<today;
    }).length;
    const f=finance(p);
    box.innerHTML=`
      <div class="field-mini"><span>Открыто задач</span><b>${open.length}</b></div>
      <div class="field-mini ${overdue?'danger':''}"><span>Просрочено</span><b>${overdue}</b></div>
      <div class="field-mini money"><span>К получению</span><b>${rub(f.toReceive||0)}</b></div>
      <div class="field-mini"><span>Статус</span><b>${p.status||'В работе'}</b></div>`;
  }

  const anchor=byId('name')?.closest('.panel');
  anchor?.append(panel);
  updateSummary();

  const baseRender=typeof window.render==='function'?window.render:null;
  if(baseRender){window.render=function(){const r=baseRender.apply(this,arguments);queueMicrotask(updateSummary);return r}}
})();
