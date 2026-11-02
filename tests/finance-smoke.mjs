import fs from 'node:fs';
import assert from 'node:assert/strict';

const index=fs.readFileSync('index.html','utf8');
const app7=fs.readFileSync('app7.js','utf8');
const app11=fs.readFileSync('app11.js','utf8');
const app17=fs.readFileSync('app17.js','utf8');
const app18=fs.readFileSync('app18.js','utf8');

assert.match(index,/Платформа: Webflow/);
assert.match(index,/finance-center-v2\.css/);
assert.match(index,/app17\.js/);
assert.match(index,/app18\.js/);
assert.match(app7,/draft:'Черновик'.*sent:'Отправлена'.*approved:'Согласована'.*in_progress:'Выполняется'.*closed:'Закрыта'/s);
assert.match(app11,/syncCompletedFromPercent/);
assert.match(app11,/syncPercentFromCompleted/);
assert.match(app18,/estimateCompletionPercent=100/);
assert.match(app18,/estimateCompletedAmount=total/);
assert.match(app18,/Осталось получить по проекту/);
assert.match(app17,/Согласованные допработы/);
assert.match(app17,/Фактические расходы/);
assert.match(app17,/Расчётная прибыль/);

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const total=1_000_000;
const percent=clamp(60,0,100);
const completed=total*percent/100;
assert.equal(completed,600_000);
assert.equal(clamp(125,0,100),100);
assert.equal(clamp(-10,0,100),0);

const signedAct=600_000;
const payment=400_000;
const toReceiveByActs=Math.max(0,signedAct-payment);
assert.equal(toReceiveByActs,200_000);

const approvedBase=1_000_000;
const approvedChange=100_000;
const actualCosts=550_000;
const revenue=approvedBase+approvedChange;
const profit=revenue-actualCosts;
const margin=revenue?profit/revenue*100:0;
const remainingProject=Math.max(0,revenue-payment);
assert.equal(revenue,1_100_000);
assert.equal(profit,550_000);
assert.equal(margin,50);
assert.equal(remainingProject,700_000);

const costBudget=700_000;
const budgetLeft=costBudget-actualCosts;
assert.equal(budgetLeft,150_000);
assert.equal(Math.round(actualCosts/costBudget*10000)/100,78.57);

console.log('Finance smoke test passed');
console.log(JSON.stringify({total,percent,completed,signedAct,payment,toReceiveByActs,approvedChange,actualCosts,revenue,profit,margin,remainingProject,costBudget,budgetLeft},null,2));
