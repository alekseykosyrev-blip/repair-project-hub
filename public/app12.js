const detailedActBaseSaveEstimateMeta=saveEstimateMeta;
saveEstimateMeta=function(){
  const estimate=currentEstimateForModal();
  detailedActBaseSaveEstimateMeta();
  if(estimate?.estimateStatus==='closed'&&estimate.estimateConfirmed===true){
    const project=active();
    setTimeout(async()=>{
      toast('Обновляю акт по позициям сметы…');
      await finalizeClosedEstimateWithItems(project,estimate);
      toast('Акт обновлён по позициям закрытой сметы.');
    },60);
  }
};
