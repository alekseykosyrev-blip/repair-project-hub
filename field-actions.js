(() => {
  const panel = document.createElement('details');
  panel.id = 'fieldActions';
  panel.innerHTML = '<summary>Действия на объекте</summary><div class="field-action-grid"></div>';

  const grid = panel.querySelector('.field-action-grid');
  const byId = id => document.getElementById(id);
  function add(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = label;
    button.addEventListener('click', handler);
    grid.append(button);
  }

  function taskIn(days) {
    byId('addTaskBtn').click();
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = value => String(value).padStart(2, '0');
    byId('taskDueDate').value = [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }

  add('Задача на сегодня', () => taskIn(0));
  add('Задача на завтра', () => taskIn(1));
  for (const [label, id] of [
    ['Добавить фото', 'addPhotosBtn'],
    ['Загрузить смету', 'addEstimateBtn'],
    ['Добавить акт', 'addActBtn'],
    ['Внести оплату', 'addPaymentBtn'],
    ['Записать расход', 'fcAddCost'],
    ['Добавить допработу', 'fcAddChange'],
    ['Загрузить договор', 'addContractBtn'],
    ['Прикрепить документ', 'addDocumentBtn']
  ]) {
    add(label, () => byId(id).click());
  }

  add('Открыть заметки', () => {
    const notes = byId('notes');
    notes.focus();
    notes.setSelectionRange(notes.value.length, notes.value.length);
  });

  add('Скопировать задачи бригаде', async () => {
    panel.querySelector('textarea')?.remove();
    const project = active();
    const tasks = project.tasks.filter(task => !task.done);
    if (!tasks.length) {
      toast('По этому объекту открытых задач нет.');
      return;
    }
    const lines = tasks.map((task, index) => {
      const due = task.dueDate || task.deadline;
      const details = [task.stage, due && 'до ' + due, task.priority === 'high' && 'важно'].filter(Boolean);
      return (index + 1) + '. ' + task.text + (details.length ? ' (' + details.join(', ') + ')' : '');
    });
    const message = [project.name, ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(message);
      toast('Список задач скопирован.');
    } catch {
      let output = panel.querySelector('textarea');
      if (!output) {
        output = document.createElement('textarea');
        output.readOnly = true;
        output.setAttribute('aria-label', 'Список задач для копирования');
        panel.append(output);
      }
      output.value = message;
      output.focus();
      output.select();
      output.addEventListener('blur', () => output.remove(), {once: true});
      toast('Текст выделен. Выберите «Копировать».');
    }
  });

  byId('name').closest('.panel').append(panel);
})();
