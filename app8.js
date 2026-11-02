renderGlobalFinance=function(){
  renderSummaryCards('#globalFinanceSummary',allFinance());
  const projectRows=(state.projects||[]).map(p=>{const f=projectFinance(p);return '<tr><td><div class="record-title">'+esc(p.name||'Без названия')+'</div><div class="record-sub">'+esc(p.client||'Без заказчика')+'</div></td><td class="num">'+esc(formatRub(f.approved))+'</td><td class="num">'+esc(formatRub(f.completed))+'</td><td class="num">'+esc(formatRub(f.acted))+'</td><td class="num">'+esc(formatRub(f.received))+'</td><td class="num">'+esc(formatRub(f.toReceive))+'</td><td class="num">'+esc(formatRub(f.remaining))+'</td></tr>'}).join('');
  const projectTable='<h3 style="font-size:14px;margin:16px 0 0">По объектам</h3><table class="records-table"><thead><tr><th>Объект</th><th class="num">Согласовано</th><th class="num">Выполнено</th><th class="num">Актировано</th><th class="num">Получено</th><th class="num">К получению</th><th class="num">Остаток</th></tr></thead><tbody>'+projectRows+'</tbody></table>';
  const allEstimates=[];
  (state.projects||[]).forEach(p=>estimateFiles(p).forEach(e=>allEstimates.push({project:p,estimate:e})));
  const estimateRows=allEstimates.map(({project,estimate:e})=>{
    const amount=estimateAmount(e),completed=estimateCompleted(e),acted=estimateActed(project,e.id),paid=estimatePaid(project,e.id);
    return '<tr><td><div class="record-title">'+esc(e.estimateNumber||e.name)+'</div><div class="record-sub">'+esc(project.name||'Без объекта')+' · '+esc(project.client||'Без заказчика')+'</div></td><td><span class="status-badge '+esc(e.estimateStatus||'draft')+'">'+esc(ESTIMATE_STATUSES[e.estimateStatus]||e.estimateStatus||'Черновик')+'</span></td><td class="num">'+esc(formatRub(amount))+'</td><td class="num">'+esc(formatRub(completed))+'</td><td class="num">'+esc(formatRub(acted))+'</td><td class="num">'+esc(formatRub(paid))+'</td><td class="num">'+esc(formatRub(Math.max(0,amount-paid)))+'</td></tr>';
  }).join('');
  const estimateTable='<h3 style="font-size:14px;margin:18px 0 0">Все сметы</h3>'+(allEstimates.length?'<table class="records-table"><thead><tr><th>Смета / объект</th><th>Статус</th><th class="num">Сумма</th><th class="num">Выполнено</th><th class="num">Актировано</th><th class="num">Получено</th><th class="num">Остаток</th></tr></thead><tbody>'+estimateRows+'</tbody></table>':'<div class="finance-empty">Смет пока нет.</div>');
  $('#globalProjectsTable').innerHTML=projectTable+estimateTable;
};
render();
