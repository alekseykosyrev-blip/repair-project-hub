function ensureProjectDashboard(){
  const main=document.querySelector('.main');
  if(!main)return null;

  const grid=document.querySelector('.grid');
  const gridPanels=grid?[...grid.querySelectorAll(':scope > .panel')]:[];
  if(gridPanels[0])gridPanels[0].id='tasksPanel';
  if(gridPanels[1])gridPanels[1].id='notesPanel';
  const docs=document.querySelector('.documents-panel');
  if(docs)docs.id='documentsPanel';

  let dashboard=$('#projectDashboard');
  if(dashboard)return dashboard;

  dashboard=document.createElement('section');
  dashboard.id='projectDashboard';
  dashboard.className='panel overview-panel';
  dashboard.innerHTML=`
    <div class="overview-head">
      <div>
        <h2>Сводка объекта</h2>
        <div class="small">Главное по проекту на одном экране</div>
      </div>
      <div class="overview-actions">
        <button class="btn primary" id="quickAddTask">+ Задача</button>
        <button class="btn primary" id="quickAddFile">+ Файл</button>
      </div>
    </div>
    <div class="overview-metrics">
      <button class="overview-card" data-scroll="tasksPanel" type="button">
        <span class="overview-label">Задачи</span>
        <strong id="overviewTasks">0</strong>
        <span class="overview-note" id="overviewTasksNote">0 выполнено</span>
      </button>
      <button class="overview-card" data-scroll="documentsPanel" type="button">
        <span class="overview-label">Документы</span>
        <strong id="overviewDocs">0</strong>
        <span class="overview-note">сохранено на устройстве</span>
      </button>
      <button class="overview-card" data-scroll="documentsPanel" type="button">
        <span class="overview-label">Сметы</span>
        <strong id="overviewConfirmed">0</strong>
        <span class="overview-note">подтверждено</span>
      </button>
      <button class="overview-card overview-card-warn" data-scroll="documentsPanel" type="button">
        <span class="overview-label">Проверить</span>
        <strong id="overviewPending">0</strong>
        <span class="overview-note">ждут подтверждения</span>
      </button>
    </div>
    <div class="quick-nav" aria-label="Быстрые переходы">
      <button class="quick-nav-btn" data-scroll="tasksPanel" type="button">Задачи</button>
      <button class="quick-nav-btn" data-scroll="notesPanel" type="button">Заметки</button>
      <button class="quick-nav-btn" data-scroll="documentsPanel" type="button">Документы</button>
    </div>`;

  const topPanel=main.querySelector(':scope > .panel');
  if(topPanel)topPanel.insertAdjacentElement('afterend',dashboard);
  else main.prepend(dashboard);

  dashboard.addEventListener('click',e=>{
    const button=e.target.closest('[data-scroll]');
    if(!button)return;
    const target=document.getElementById(button.dataset.scroll);
    if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
  });

  $('#quickAddTask').onclick=()=>$('#addTaskBtn')?.click();
  $('#quickAddFile').onclick=()=>$('#fileInput')?.click();
  return dashboard;
}

function renderProjectDashboard(){
  ensureProjectDashboard();
  const project=active();
  if(!project)return;

  const tasks=Array.isArray(project.tasks)?project.tasks:[];
  const done=tasks.filter(t=>t.done).length;
  const files=Array.isArray(project.files)?project.files:[];
  const storedFiles=files.filter(f=>f?.stored).length;
  const pdfs=files.filter(f=>f?.stored&&isPdf(f));
  const confirmed=pdfs.filter(f=>f.estimateConfirmed===true).length;
  const pending=pdfs.filter(f=>f.estimateConfirmed!==true).length;

  $('#overviewTasks').textContent=`${done}/${tasks.length}`;
  $('#overviewTasksNote').textContent=tasks.length?`${done} выполнено из ${tasks.length}`:'Пока задач нет';
  $('#overviewDocs').textContent=String(storedFiles);
  $('#overviewConfirmed').textContent=String(confirmed);
  $('#overviewPending').textContent=String(pending);

  const pendingCard=$('#overviewPending')?.closest('.overview-card');
  if(pendingCard)pendingCard.classList.toggle('has-pending',pending>0);
}

const dashboardBaseRender=render;
render=function(){
  dashboardBaseRender();
  renderProjectDashboard();
};

ensureProjectDashboard();
renderProjectDashboard();
