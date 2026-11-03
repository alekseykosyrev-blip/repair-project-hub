import fs from 'node:fs';
import assert from 'node:assert/strict';

const helper=fs.readFileSync('app21.js','utf8');
const route=fs.readFileSync('app20.js','utf8');
const actions=fs.readFileSync('field-actions.js','utf8');
const index=fs.readFileSync('index.html','utf8');

for(const step of ['estimate','confirm','approve','budget','costs','act','payment']){
  assert.match(helper,new RegExp(`id:'${step}'`),`helper must define ${step}`);
  assert.match(route,new RegExp(`id:'${step}'`),`route must define ${step}`);
}
assert.match(helper,/repairHubFirstUseHelper_v4/);
assert.match(helper,/lastAutoStep/);
assert.match(helper,/seenSteps/);
assert.match(helper,/addEstimateBtn/);
assert.match(helper,/editEstimateTotal/);
assert.match(helper,/openEstimateMeta/);
assert.match(helper,/fcCostBudget/);
assert.match(helper,/fcAddCost/);
assert.match(helper,/actsPanel/);
assert.match(helper,/addPaymentBtn/);
assert.match(helper,/Оплата закрыта — заверши объект/);
assert.doesNotMatch(helper,/estimateStatus!=='closed'/);
assert.doesNotMatch(route,/id:'close'/);
assert.match(route,/0 из 7/);
assert.match(route,/data-guided-action="finish"/);
assert.match(route,/Закрыть объект/);
assert.match(actions,/Рабочая панель/);
assert.match(actions,/📐 Обмеры/);
assert.match(actions,/☑ Закрыть объект/);
assert.match(actions,/К получению/);
assert.match(index,/ux-green\.css/);

console.log('Helper and workbench smoke test passed');
