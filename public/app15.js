const BACKUP_FORMAT='repair-project-hub-backup';
const BACKUP_VERSION=1;
const BACKUP_LAST_KEY='repairHubLastBackup_v1';
const BACKUP_ROLLBACK_KEY='repairHubRestoreRollback_v1';
let backupZipPromise=null;

function loadBackupZipLib(){
  if(window.JSZip)return Promise.resolve(window.JSZip);
  if(backupZipPromise)return backupZipPromise;
  backupZipPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.async=true;
    script.crossOrigin='anonymous';
    script.onload=()=>window.JSZip?resolve(window.JSZip):reject(new Error('ZIP_LIBRARY_UNAVAILABLE'));
    script.onerror=()=>reject(new Error('ZIP_LIBRARY_LOAD_FAILED'));
    document.head.appendChild(script);
  });
  return backupZipPromise;
}

function backupDate(value){
  if(!value)return 'ещё не создавалась';
  const d=new Date(value);
  if(Number.isNaN(d.getTime()))return '—';
  return new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);
}

function backupFileName(){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return `repair-project-hub-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.repairhub`;
}

function downloadBackupBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=name;
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),120000);
}

function setBackupBusy(busy,text=''){
  const modal=document.getElementById('backupModal');
  if(modal)modal.dataset.busy=busy?'1':'0';
  document.querySelectorAll('#backupModal button').forEach(btn=>btn.disabled=busy);
  const input=document.getElementById('backupRestoreInput');
  if(input)input.disabled=busy;
  const status=document.getElementById('backupStatus');
  if(status&&text)status.textContent=text;
}

function backupProgress(text){
  const status=document.getElementById('backupStatus');
  if(status)status.textContent=text;
}

function projectWord(n){
  const mod10=n%10,mod100=n%100;
  if(mod10===1&&mod100!==11)return 'объект';
  if(mod10>=2&&mod10<=4&&(mod100<12||mod100>14))return 'объекта';
  return 'объектов';
}

function fileWord(n){
  const mod10=n%10,mod100=n%100;
  if(mod10===1&&mod100!==11)return 'файл';
  if(mod10>=2&&mod10<=4&&(mod100<12||mod100>14))return 'файла';
  return 'файлов';
}

function updateBackupSummary(){
  const last=document.getElementById('backupLast');
  if(last)last.textContent=backupDate(localStorage.getItem(BACKUP_LAST_KEY));
  const rollback=document.getElementById('backupRollbackBtn');
  if(rollback)rollback.style.display=localStorage.getItem(BACKUP_ROLLBACK_KEY)?'inline-flex':'none';
  const summary=document.getElementById('backupSummary');
  if(summary){
    const projects=Array.isArray(state?.projects)?state.projects.length:0;
    const files=(state?.projects||[]).reduce((n,p)=>n+(p.files||[]).filter(f=>f.stored&&f.id).length,0);
    summary.textContent=`Сейчас: ${projects} ${projectWord(projects)} · локальных файлов: ${files}`;
  }
}

function ensureBackupUi(){
  if(document.getElementById('backupToolsBtn'))return;
  const newProject=document.getElementById('newProjectBtn');
  if(!newProject)return;
  const style=document.createElement('style');
  style.textContent=`
    .backup-tools-btn{border:1px solid #374151;background:#1f2937;color:#fff;padding:10px 12px;border-radius:12px;font-weight:800;cursor:pointer;min-height:44px;width:100%;display:flex;align-items:center;justify-content:center;gap:7px}.backup-tools-btn:hover{background:#273449;border-color:#4b5563}
    .backup-modal{position:fixed;inset:0;z-index:980;background:rgba(17,24,39,.58);display:none;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(2px)}.backup-modal.open{display:flex}.backup-card{width:min(620px,100%);max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:20px;padding:19px;box-shadow:0 24px 70px rgba(0,0,0,.24);color:#111827}.backup-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.backup-title{font-size:20px;font-weight:900}.backup-sub{font-size:12px;color:#64748b;margin-top:4px;line-height:1.45}.backup-close{border:0;background:#f1f5f9;width:38px;height:38px;border-radius:11px;font-size:20px;cursor:pointer;flex:0 0 auto}.backup-info{margin-top:15px;padding:12px;border-radius:13px;background:#eff6ff;color:#1e3a8a;font-size:12px;line-height:1.5}.backup-summary{margin-top:12px;font-size:13px;font-weight:800}.backup-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.backup-action{border:1px solid #dbe2ea;background:#fff;border-radius:13px;padding:13px;text-align:left;cursor:pointer;min-height:88px}.backup-action:hover{background:#f8fafc}.backup-action strong{display:block;font-size:14px}.backup-action span{display:block;font-size:11px;color:#64748b;margin-top:5px;line-height:1.4}.backup-action.primary{background:#2563eb;border-color:#2563eb;color:#fff}.backup-action.primary span{color:#dbeafe}.backup-status{min-height:42px;margin-top:12px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;font-size:12px;color:#475569;line-height:1.45}.backup-meta{font-size:11px;color:#94a3b8;margin-top:9px}.backup-rollback{display:none;margin-top:12px}.backup-modal[data-busy="1"] .backup-close{opacity:.45}.backup-modal button:disabled{cursor:wait;opacity:.62}
    @media(max-width:600px){.backup-actions{grid-template-columns:1fr}.backup-card{padding:16px;border-radius:17px}.backup-action{min-height:76px}}
  `;
  document.head.appendChild(style);

  const btn=document.createElement('button');
  btn.id='backupToolsBtn';
  btn.type='button';
  btn.className='backup-tools-btn';
  btn.textContent='Резервная копия';
  newProject.insertAdjacentElement('afterend',btn);

  const modal=document.createElement('div');
  modal.id='backupModal';
  modal.className='backup-modal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`
    <section class="backup-card" role="dialog" aria-modal="true" aria-labelledby="backupTitle">
      <div class="backup-head"><div><div class="backup-title" id="backupTitle">Резервная копия</div><div class="backup-sub">Сохраняет объекты, задачи, финансы, сметы, акты, настройки и локальные документы в один файл.</div></div><button type="button" class="backup-close" id="backupClose" aria-label="Закрыть">×</button></div>
      <div class="backup-info">Копия скачивается на ваше устройство и никуда не отправляется. Её можно перенести на другой компьютер или телефон и восстановить там этот же рабочий набор данных.</div>
      <div class="backup-summary" id="backupSummary"></div>
      <div class="backup-actions">
        <button type="button" class="backup-action primary" id="backupCreateBtn"><strong>Скачать копию</strong><span>Создать один файл со всеми доступными локальными данными и документами.</span></button>
        <button type="button" class="backup-action" id="backupRestoreBtn"><strong>Восстановить</strong><span>Выбрать ранее созданный файл .repairhub и безопасно заменить текущий набор данных.</span></button>
      </div>
      <input id="backupRestoreInput" type="file" accept=".repairhub,application/zip,application/octet-stream" hidden>
      <div class="backup-status" id="backupStatus">Готово к созданию резервной копии.</div>
      <button type="button" class="btn backup-rollback" id="backupRollbackBtn">Отменить последнее восстановление</button>
      <div class="backup-meta">Последняя резервная копия на этом устройстве: <span id="backupLast">—</span></div>
    </section>`;
  document.body.appendChild(modal);

  const open=()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false');updateBackupSummary()};
  const close=()=>{if(modal.dataset.busy==='1')return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true')};
  btn.addEventListener('click',open);
  document.getElementById('backupClose').addEventListener('click',close);
  modal.addEventListener('click',e=>{if(e.target===modal)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
  document.getElementById('backupCreateBtn').addEventListener('click',createFullBackup);
  document.getElementById('backupRestoreBtn').addEventListener('click',()=>document.getElementById('backupRestoreInput').click());
  document.getElementById('backupRestoreInput').addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    e.target.value='';
    if(file)await restoreFullBackup(file);
  });
  document.getElementById('backupRollbackBtn').addEventListener('click',rollbackLastRestore);
  updateBackupSummary();
}

async function createFullBackup(){
  ensureBackupUi();
  setBackupBusy(true,'Подготавливаю данные…');
  try{
    if(typeof sync==='function')sync();
    const JSZip=await loadBackupZipLib();
    const zip=new JSZip();
    const snapshot=clone(state);
    const manifestFiles=[];
    const warnings=[];
    let totalBytes=0;
    let done=0;
    const storedCount=(state.projects||[]).reduce((n,p)=>n+(p.files||[]).filter(f=>f.stored&&f.id).length,0);

    for(const project of state.projects||[]){
      const snapshotProject=(snapshot.projects||[]).find(p=>p.id===project.id);
      for(const meta of project.files||[]){
        if(!meta.stored||!meta.id)continue;
        done++;
        backupProgress(`Добавляю файлы: ${done} из ${storedCount}…`);
        let record=null,blob=null;
        try{record=await dbGet(meta.id);blob=ensureBlob(record,meta)}catch(e){console.warn('Backup file read failed',meta.id,e)}
        if(!blob){
          warnings.push(`Файл «${meta.name||meta.id}» не найден в локальном хранилище.`);
          const sm=(snapshotProject?.files||[]).find(f=>f.id===meta.id);
          if(sm){sm.stored=false;sm.backupMissing=true}
          continue;
        }
        const path=`files/${encodeURIComponent(String(meta.id))}.bin`;
        zip.file(path,blob,{binary:true});
        manifestFiles.push({id:String(meta.id),projectId:project.id,path,name:meta.name||record?.name||'document',type:meta.type||record?.type||blob.type||'',size:blob.size,lastModified:meta.lastModified||record?.lastModified||Date.now()});
        totalBytes+=blob.size;
      }
    }

    const manifest={format:BACKUP_FORMAT,formatVersion:BACKUP_VERSION,createdAt:new Date().toISOString(),siteBuild:typeof SITE_BUILD!=='undefined'?SITE_BUILD:null,summary:{projects:(snapshot.projects||[]).length,files:manifestFiles.length,totalBytes,warnings:warnings.length},warnings,state:snapshot,files:manifestFiles};
    zip.file('manifest.json',JSON.stringify(manifest,null,2));
    backupProgress('Собираю один файл резервной копии…');
    const out=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}},meta=>{
      backupProgress(`Упаковываю резервную копию: ${Math.max(1,Math.round(meta.percent||0))}%`);
    });
    downloadBackupBlob(out,backupFileName());
    localStorage.setItem(BACKUP_LAST_KEY,manifest.createdAt);
    updateBackupSummary();
    const projects=(snapshot.projects||[]).length;
    backupProgress(warnings.length?`Копия создана. Важно: ${warnings.length} ${fileWord(warnings.length)} не удалось включить, потому что браузер их уже не нашёл.`:`Копия создана: ${projects} ${projectWord(projects)}, ${manifestFiles.length} ${fileWord(manifestFiles.length)}, ${bytes(totalBytes)}.`);
    toast(warnings.length?'Резервная копия создана с предупреждением.':'Резервная копия создана и передана в загрузки.',warnings.length>0);
  }catch(e){
    console.error('Backup failed',e);
    backupProgress('Не удалось создать резервную копию. Текущие данные не изменены.');
    toast('Не удалось создать резервную копию.',true);
  }finally{setBackupBusy(false)}
}

function validBackupManifest(manifest){
  if(!manifest||manifest.format!==BACKUP_FORMAT||Number(manifest.formatVersion)!==BACKUP_VERSION)return false;
  if(!manifest.state||!Array.isArray(manifest.state.projects)||!Array.isArray(manifest.files))return false;
  if(manifest.state.projects.length>10000||manifest.files.length>5000)return false;
  const ids=new Set(),paths=new Set();
  for(const info of manifest.files){
    if(!info||!info.id||typeof info.path!=='string'||!info.path.startsWith('files/'))return false;
    const id=String(info.id);
    if(ids.has(id)||paths.has(info.path))return false;
    ids.add(id);paths.add(info.path);
  }
  return true;
}

async function restoreFullBackup(file){
  ensureBackupUi();
  setBackupBusy(true,'Проверяю выбранную резервную копию…');
  const stagedIds=[];
  const previousRollbackRaw=localStorage.getItem(BACKUP_ROLLBACK_KEY);
  let committed=false;
  try{
    if(file.size>2147483648)throw new Error('BACKUP_TOO_LARGE');
    const JSZip=await loadBackupZipLib();
    const zip=await JSZip.loadAsync(file);
    const manifestEntry=zip.file('manifest.json');
    if(!manifestEntry)throw new Error('MANIFEST_MISSING');
    const manifest=JSON.parse(await manifestEntry.async('string'));
    if(!validBackupManifest(manifest))throw new Error('INVALID_BACKUP');
    const projectCount=manifest.state.projects.length;
    const fileCount=manifest.files.length;
    const stamp=backupDate(manifest.createdAt);
    setBackupBusy(false,`Копия от ${stamp}: ${projectCount} ${projectWord(projectCount)}, ${fileCount} ${fileWord(fileCount)}.`);
    const ok=confirm(`Восстановить резервную копию от ${stamp}?\n\nТекущие данные в приложении будут заменены данными из копии. Перед заменой приложение сохранит возможность отменить это восстановление.`);
    if(!ok){backupProgress('Восстановление отменено. Текущие данные не изменены.');return}
    setBackupBusy(true,'Подготавливаю безопасное восстановление…');

    const imported=clone(manifest.state);
    const idMap=new Map();
    const restoreToken=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
    let done=0;

    for(const info of manifest.files){
      done++;
      backupProgress(`Проверяю и восстанавливаю файлы: ${done} из ${fileCount}…`);
      const entry=zip.file(info.path);
      if(!entry)throw new Error('BACKUP_FILE_MISSING');
      const blob=await entry.async('blob');
      if(Number.isFinite(Number(info.size))&&Number(info.size)>=0&&blob.size!==Number(info.size))throw new Error('FILE_SIZE_MISMATCH');
      const newId=`restore_${restoreToken}_${fileId()}`;
      const targetProject=(imported.projects||[]).find(p=>String(p.id)===String(info.projectId));
      await dbPut({id:newId,projectId:targetProject?.id??info.projectId,name:info.name||'document',type:info.type||blob.type||'',size:blob.size,lastModified:info.lastModified||Date.now(),blob});
      stagedIds.push(newId);
      idMap.set(String(info.id),newId);
    }

    for(const project of imported.projects||[]){
      project.files=Array.isArray(project.files)?project.files:[];
      for(const meta of project.files){
        if(meta?.stored&&meta.id){
          const mapped=idMap.get(String(meta.id));
          if(mapped){meta.id=mapped;meta.stored=true}
          else{meta.stored=false;meta.backupMissing=true}
        }
      }
    }

    const rollback={createdAt:new Date().toISOString(),state:clone(state),importedIds:stagedIds};
    localStorage.setItem(BACKUP_ROLLBACK_KEY,JSON.stringify(rollback));
    localStorage.setItem(KEY,JSON.stringify(imported));
    committed=true;
    state=loadState();
    save(false);
    backupProgress(`Восстановлено: ${projectCount} ${projectWord(projectCount)}, ${fileCount} ${fileWord(fileCount)}. Перезагружаю приложение…`);
    toast('Резервная копия восстановлена.');
    setTimeout(()=>location.reload(),900);
  }catch(e){
    console.error('Restore failed',e);
    if(!committed){
      for(const id of stagedIds){try{await dbDelete(id)}catch(err){console.warn('Staged cleanup failed',id,err)}}
      if(previousRollbackRaw===null)localStorage.removeItem(BACKUP_ROLLBACK_KEY);
      else localStorage.setItem(BACKUP_ROLLBACK_KEY,previousRollbackRaw);
      backupProgress('Восстановление не выполнено. Текущие данные оставлены без изменений.');
      toast('Не удалось восстановить копию. Текущие данные сохранены.',true);
    }else{
      backupProgress('Данные восстановлены, но интерфейс не смог обновиться автоматически. Перезагрузите страницу.');
      toast('Данные восстановлены. Обновите страницу.',true);
    }
  }finally{setBackupBusy(false)}
}

async function rollbackLastRestore(){
  const raw=localStorage.getItem(BACKUP_ROLLBACK_KEY);
  if(!raw){backupProgress('Нет восстановления, которое можно отменить.');updateBackupSummary();return}
  if(!confirm('Отменить последнее восстановление и вернуть данные, которые были до него?'))return;
  setBackupBusy(true,'Возвращаю данные до последнего восстановления…');
  try{
    const rollback=JSON.parse(raw);
    if(!rollback?.state||!Array.isArray(rollback.state.projects))throw new Error('INVALID_ROLLBACK');
    localStorage.setItem(KEY,JSON.stringify(rollback.state));
    state=loadState();
    save(false);
    for(const id of rollback.importedIds||[]){try{await dbDelete(id)}catch(e){console.warn('Rollback cleanup failed',id,e)}}
    localStorage.removeItem(BACKUP_ROLLBACK_KEY);
    toast('Последнее восстановление отменено.');
    setTimeout(()=>location.reload(),700);
  }catch(e){
    console.error('Rollback failed',e);
    backupProgress('Не удалось отменить восстановление. Данные не перезаписаны.');
    toast('Не удалось отменить восстановление.',true);
  }finally{setBackupBusy(false)}
}

ensureBackupUi();
