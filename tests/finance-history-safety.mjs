import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const final=fs.readFileSync('app23.js','utf8');
const history=fs.readFileSync('app24.js','utf8');
assert.doesNotMatch(final,/patchGuidedRoute|8 из 8|normalizeClosedEstimate/, 'Must not resurrect old 8-step route or rewrite acts');
assert.match(final,/p\.status!=='Завершён'/, 'Final audit follows object closure');
assert.match(history,/originalProjectFinance/, 'Use corrected receipts across project finance');
assert.match(history,/function confirmedReversals/, 'Validate linked confirmed corrections');
assert.match(history,/function paymentCorrection/, 'Non-destructive correction request exists');
assert.match(history,/const project=typeof active==='function'\?active\(\):null;\s*if\(!project\)return;\s*ensure\(project\);/, 'Correction form must use active project on click');

const project={id:'test-object',acts:[{id:'act1',estimateId:'e1',amount:150,status:'signed'}],payments:[
 {id:'p1',estimateId:'e1',amount:100,date:'2026-11-03'},
 {id:'p2',estimateId:'e1',amount:50,date:'2026-11-04'}
],files:[]};
const ctx={console,state:{projects:[project]},active:()=>project,save:()=>true,
 document:{getElementById:()=>null,querySelectorAll:()=>[]}};
ctx.window=ctx;
ctx.projectFinance=p=>({approved:150,acted:150,received:p.payments.reduce((s,x)=>s+x.amount,0),toReceive:0,completed:150,remaining:0});
ctx.estimatePaid=(p,id)=>p.payments.filter(x=>x.estimateId===id).reduce((s,x)=>s+x.amount,0);
vm.runInNewContext(history,ctx,{timeout:2000});
assert.equal(ctx.projectFinance(project).received,150);
assert.equal(ctx.projectFinance(project).toReceive,0);
const c=ctx.requestPaymentCorrection(project,'p1','Ошибочно внесён платёж');
assert.equal(ctx.projectFinance(project).received,150,'Pending correction must not reduce receipt');
ctx.confirmPaymentCorrection(project,c.id);
assert.equal(ctx.projectFinance(project).received,50,'Confirmed correction reduces receipt');
assert.equal(ctx.projectFinance(project).toReceive,100,'Remaining balance updated');
assert.equal(ctx.estimatePaid(project,'e1'),50,'Estimate receipts updated');
assert.equal(project.payments.length,2,'Original payment record preserved');
assert.throws(()=>ctx.requestPaymentCorrection(project,'p1','Повторная ошибка'),/уже помечена/);
const fake={id:'bad',paymentId:'p2',status:'confirmed',amount:50};
project.paymentCorrections.push(fake);
assert.equal(ctx.projectFinance(project).received,50,'Unlinked correction must be ignored');
console.log('Finance correction regression passed');
