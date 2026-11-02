import fs from 'node:fs';
import assert from 'node:assert/strict';

const helper=fs.readFileSync('app21.js','utf8');
const route=fs.readFileSync('app20.js','utf8');

for(const step of ['estimate','confirm','approve','budget','costs','act','payment','close']){
  assert.match(helper,new RegExp(`id:'${step}'`),`helper must define ${step}`);
}
assert.match(helper,/repairHubFirstUseHelper_v3/);
assert.match(helper,/lastAutoStep/);
assert.match(helper,/seenSteps/);
assert.match(helper,/addEstimateBtn/);
assert.match(helper,/editEstimateTotal/);
assert.match(helper,/openEstimateMeta/);
assert.match(helper,/fcCostBudget/);
assert.match(helper,/fcAddCost/);
assert.match(helper,/actsPanel/);
assert.match(helper,/addPaymentBtn/);
assert.match(helper,/estimateStatus!=='closed'/);
assert.match(route,/Финансовый маршрут/);
assert.match(route,/data-guided-action/);

console.log('Helper smoke test passed');
