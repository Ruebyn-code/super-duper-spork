const {test}=require('node:test'),assert=require('node:assert/strict');
const logic=require('./public/ops-step-logic'),model=require('./public/ops-step-model');
const steps=[
 {id:'fridge',type:'yes-no-na',title:'Fridge OK?',required:true,passRule:{pass:'yes'},failAction:{note:true,photo:false}},
 {id:'why',type:'text',title:'What happened?',required:true,showWhen:{stepId:'fridge',operator:'is',value:'no'}},
 {id:'temp',type:'number',title:'Temperature',required:true,format:'decimal',decimals:1,unit:'°C',passRule:{min:0,max:5},failAction:{note:false,photo:true}},
 {id:'hot',type:'check',title:'Moved stock',required:true,showWhen:{stepId:'temp',operator:'fails'}},
 {id:'after',type:'instruction',title:'Call the manager',showWhen:{stepId:'hot',operator:'checked'}}
];
test('Yes / No / N/A answers and outcomes',()=>{
 assert.equal(model.answered({type:'yes-no-na'},'na'),true);assert.equal(model.answered({type:'yes-no-na'},'maybe'),false);
 assert.equal(logic.outcome(steps[0],'yes'),'pass');assert.equal(logic.outcome(steps[0],'no'),'fail');assert.equal(logic.outcome(steps[0],'na'),'na');assert.equal(logic.outcome(steps[0],null),null);
 assert.equal(logic.outcome(steps[2],5),'pass');assert.equal(logic.outcome(steps[2],5.1),'fail');assert.equal(logic.outcome(steps[2],-1),'fail');
 assert.equal(logic.outcome({type:'selection',source:'custom',options:['A','B','C'],passRule:{options:['A','B']}},['A','C']),'fail');
});
test('show-when rules hide follow-ups until the earlier answer matches, including chains',()=>{
 assert.deepEqual([...logic.hidden(steps,{})],['why','hot','after']);
 assert.deepEqual([...logic.hidden(steps,{fridge:'no',temp:9})],['after']);
 assert.deepEqual([...logic.hidden(steps,{fridge:'no',temp:9,hot:true})],[]);
 assert.deepEqual([...logic.hidden(steps,{fridge:'yes',temp:4,hot:true})],['why','hot','after'],'a hidden source hides its followers');
 assert.ok(logic.hidden([{id:'b',type:'check',showWhen:{stepId:'a',operator:'checked'}},{id:'a',type:'check'}],{a:true}).has('b'),'a later source never shows a step');
});
test('completion needs visible answers and corrective actions for failures',()=>{
 assert.equal(logic.complete(steps,{fridge:'yes',temp:3}),true);
 assert.equal(logic.complete(steps,{fridge:'no',temp:3}),false,'follow-up and note needed');
 assert.equal(logic.complete(steps,{fridge:'no',why:'Door open',temp:3},{fridge:{note:'Closed it'}}),true);
 const state=logic.evaluate(steps,{fridge:'yes',temp:8,hot:true});assert.deepEqual(state.fails,['temp']);assert.deepEqual(state.missingActions,[{id:'temp',missing:['photo']}]);
 assert.equal(logic.complete(steps,{fridge:'yes',temp:8,hot:true},{temp:{photos:['p1']}}),true);
 assert.equal(logic.complete(steps,{fridge:'na',temp:2}),true,'N/A never fails');
});
test('sanitize drops rules that no longer fit and texts explain them',()=>{
 const cleaned=logic.sanitize([{id:'b',type:'text',showWhen:{stepId:'a',operator:'checked'}},{id:'a',type:'check'},{id:'c',type:'text',passRule:{min:1},failAction:{note:true,photo:false}}]);
 assert.equal(cleaned[0].showWhen,undefined);assert.equal(cleaned[2].passRule,undefined);assert.equal(cleaned[2].failAction,undefined);
 assert.equal(logic.conditionText(steps[1],steps),'Shown when “Fridge OK?” is No');
 assert.equal(logic.ruleText(steps[2]),'Passes from 0.0 °C to 5.0 °C');
 assert.match(logic.actionText(steps[2]),/photo/);
});
