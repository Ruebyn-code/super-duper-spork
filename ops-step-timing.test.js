const test=require('node:test'),assert=require('node:assert/strict'),timing=require('./public/ops-step-timing'),steps=require('./public/ops-step-model');
const section=(id,startTime='09:15',endTime='10:25')=>({id,type:'timed-section',startTime,endTime}),check=id=>({id,type:'check'});
function run(children,date='2026-10-19'){return{workDate:date,snapshot:{steps:children},answers:{},stepActivity:{}};}
function answer(value,id,at){value.answers[id]=true;value.stepActivity[id]={completedAt:at};}
test('timed sections evaluate inclusive Melbourne boundaries, ignore instructions and stop at either section type',()=>{
 const value=run([check('outside'),section('morning'),check('early'),{id:'note',type:'instruction'},check('start'),check('end'),check('late'),check('missing'),check('pending'),{id:'normal',type:'section'},check('excluded'),section('evening','17:00','18:00'),check('later')]);
 answer(value,'early','2026-10-18T22:14:59.999Z');answer(value,'start','2026-10-18T22:15:00Z');answer(value,'end','2026-10-18T23:25:00Z');answer(value,'late','2026-10-18T23:25:00.001Z');answer(value,'missing',null);answer(value,'excluded','2026-10-18T23:00:00Z');answer(value,'later','2026-10-19T06:30:00Z');
 const result=timing.evaluate(value);assert.deepEqual(Object.fromEntries(Object.entries(result.byStep).map(([id,entry])=>[id,entry.state])),{early:'early',start:'within',end:'within',late:'late',missing:'unrecorded',pending:'pending',later:'within'});assert.equal(result.sections[0].total,6);assert.equal(result.sections[0].within,2);assert.equal(result.sections[0].state,'outside');assert.equal(result.sections[1].state,'within');
});
test('overnight sections use the next date, including Melbourne daylight-saving transitions',()=>{
 let value=run([section('night','23:00','02:00'),check('after-midnight')]);answer(value,'after-midnight','2026-10-19T14:30:00Z');let result=timing.evaluate(value);assert.equal(result.byStep['after-midnight'].state,'within');assert.equal(result.sections[0].window.end,'2026-10-19T15:00:00.000Z');assert.equal(result.sections[0].window.overnight,true);
 value=run([section('spring','01:00','02:30'),check('spring-check')],'2026-10-04');answer(value,'spring-check','2026-10-03T16:00:00Z');assert.equal(timing.evaluate(value).byStep['spring-check'].state,'within');assert.equal(timing.windowFor(value,value.snapshot.steps[0]).end,'2026-10-03T16:00:00.000Z');
 value=run([section('autumn','01:00','02:30'),check('autumn-check')],'2026-04-05');assert.equal(timing.windowFor(value,value.snapshot.steps[0]).end,'2026-04-04T16:30:00.000Z');
});
test('legacy missing dates or timestamps stay unrecorded and pending sections never pass',()=>{
 const value=run([section('window'),check('answer')]);assert.equal(timing.evaluate(value).sections[0].state,'pending');answer(value,'answer',null);assert.equal(timing.evaluate(value).sections[0].state,'unrecorded');delete value.workDate;answer(value,'answer','2026-10-18T23:00:00Z');assert.equal(timing.evaluate(value).byStep.answer.state,'unrecorded');
 assert.equal(timing.windowFor(value,section('bad','25:00','10:00')),null);assert.equal(timing.windowFor(value,section('same','10:00','10:00')),null);assert.equal(timing.evaluate(run([section('empty')])).sections[0].state,'pending');
});
test('both section types carry their children during reordering and never count as responses',()=>{
 const list=[section('timed'),check('child'),{id:'normal',type:'section'},check('other'),section('last'),check('final')];assert.deepEqual(steps.movingIds(list,'timed'),['timed','child']);assert.deepEqual(steps.movingIds(list,'normal'),['normal','other']);assert.deepEqual(steps.move(list,'timed',null).map(x=>x.id),['normal','other','last','final','timed','child']);assert.equal(steps.responseStep(list[0]),false);assert.equal(steps.answered(list[0],true),false);assert.equal(steps.responseStep(list[2]),false);assert.equal(steps.editable(list[0]).startTime,'09:15');
});

test('timed section titles use the selected period, including midnight, midday and overnight windows',()=>{
 assert.equal(timing.sectionTitle(section('morning')),'9:15 am – 10:25 am');assert.equal(timing.sectionTitle(section('midday','12:00','13:05')),'12:00 pm – 1:05 pm');assert.equal(timing.sectionTitle(section('night','23:00','00:00')),'11:00 pm – 12:00 am');assert.equal(timing.sectionTitle(section('incomplete','','10:00')),'Timed section');
});
