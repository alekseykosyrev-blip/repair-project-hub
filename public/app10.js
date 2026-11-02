// Object view should contain only project-specific information.
// Keep the global finance calculations in data, but do not render the global ledger inside a selected object.
renderGlobalFinance=function(){};

function removeGlobalFinanceFromObject(){
  document.getElementById('globalFinancePanel')?.remove();
  const nav=document.getElementById('workspaceNav');
  if(nav){
    const globalButton=nav.querySelector('[data-jump="globalFinancePanel"]');
    globalButton?.remove();
  }
}

const objectOnlyFinanceBaseRender=render;
render=function(){
  objectOnlyFinanceBaseRender();
  removeGlobalFinanceFromObject();
};

removeGlobalFinanceFromObject();
