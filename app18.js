(()=>{
  function closeEstimateFully(estimate){
    if(!estimate||estimate.estimateConfirmed!==true)return false;
    const total=typeof estimateAmount==='function'?estimateAmount(estimate):0;
    if(!(total>=0))return false;
    estimate.estimateCompletionPercent=100;
    estimate.estimateCompletedAmount=total;
    return true;
  }

  if(typeof changeEstimateStatus==='function'){
    const baseChangeEstimateStatus=changeEstimateStatus;
    changeEstimateStatus=async function(project,estimate,status){
      if(status==='closed')closeEstimateFully(estimate);
      const result=await baseChangeEstimateStatus(project,estimate,status);
      if(status==='closed'&&closeEstimateFully(estimate)){
        if(typeof save==='function')save(false);
        if(typeof render==='function')render();
      }
      return result;
    };
  }

  if(typeof saveEstimateMeta==='function'){
    const baseSaveEstimateMeta=saveEstimateMeta;
    saveEstimateMeta=function(){
      const estimate=typeof financeEditContext!=='undefined'&&financeEditContext?.type==='estimate'?financeEditContext.record:null;
      const wantsClosed=typeof $==='function'&&$('#estimateMetaStatus')?.value==='closed';
      if(wantsClosed&&estimate?.estimateConfirmed===true){
        const total=typeof estimateAmount==='function'?estimateAmount(estimate):0;
        if($('#estimateMetaPercent'))$('#estimateMetaPercent').value='100';
        if($('#estimateMetaCompleted'))$('#estimateMetaCompleted').value=String(total).replace('.',',');
      }
      return baseSaveEstimateMeta.apply(this,arguments);
    };
  }

  if(typeof saveEstimateConfirmation==='function'){
    const baseSaveEstimateConfirmation=saveEstimateConfirmation;
    saveEstimateConfirmation=function(){
      const estimate=typeof estimateConfirmCurrent!=='undefined'?estimateConfirmCurrent?.meta:null;
      const result=baseSaveEstimateConfirmation.apply(this,arguments);
      if(estimate?.estimateStatus==='closed'){
        setTimeout(()=>{
          if(closeEstimateFully(estimate)){
            if(typeof save==='function')save(false);
            if(typeof render==='function')render();
          }
        },80);
      }
      return result;
    };
  }

  function clarifyFinanceLabels(){
    document.querySelectorAll('#fcKpis .fc-kpi span').forEach(label=>{
      if(label.textContent.trim()==='Осталось получить')label.textContent='Осталось получить по проекту';
    });
  }
  const priorRender=typeof render==='function'?render:null;
  if(priorRender){
    window.render=function(){
      const result=priorRender.apply(this,arguments);
      queueMicrotask(clarifyFinanceLabels);
      return result;
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',clarifyFinanceLabels,{once:true});else clarifyFinanceLabels();
})();
