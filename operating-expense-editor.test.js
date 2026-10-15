const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const model=require('./public/weekly-sales-report');

// Exercise the real editor without adding a browser dependency to npm test.
function editorFixture(){
 class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.value='';this.textContent='';}
  append(...children){this.children.push(...children);}
  prepend(...children){this.children.unshift(...children);}
  replaceChildren(...children){this.children=children;}
  setAttribute(){}
  setCustomValidity(message){this.validationMessage=message;}
 }
 const context={window:{},document:{createElement:tag=>new Element(tag)},weeklySalesReport:model,Intl,Date};
 vm.runInNewContext(fs.readFileSync(require.resolve('./public/operating-expenses.js'),'utf8'),context);
 const amount=input=>input.value.trim()===''?null:Math.round(Number(input.value.replaceAll(',',''))*100);
 const host=new Element('div');let editor;
 editor=context.window.createOperatingExpenseEditor({host,amount,
  currencyInput(){return {wrap:new Element('div'),input:new Element('input')};},
  validateMoney(){},wording:text=>text,onChange:()=>editor.render(),onTypeChange:()=>{throw Error('Unexpected catalogue change');}
 });
 editor.setTypes({revision:1,types:[{id:'marketing',name:'Marketing'}]});
 const allocation={typeId:'marketing',description:'Marketing',totalCents:120000,weeks:4,startWeek:'2026-10-05'};
 const load=week=>editor.setRecord({weekStart:week,operatingAllocations:[{...allocation}]});
 const find=predicate=>{function walk(node){return predicate(node)?node:node.children.map(walk).find(Boolean);}return walk(host);};
 const input=(index,value)=>{const node=editor.inputs()[index];node.value=value;node.oninput();};
 return {editor,allocation,load,input,find};
}

test('re-entering or reverting to the same cost and duration preserves the original expense dates',()=>{
 const {editor,load,input}=editorFixture();load('2026-10-12');
 input(1,'4');input(0,'1200.00');assert.equal(editor.values()[0].startWeek,'2026-10-05');
 input(0,'12');input(0,'1,200.00');input(1,'2');input(1,'4');
 assert.equal(editor.values()[0].startWeek,'2026-10-05');
 assert.equal(model.allocationCost(editor.values()[0],'2026-10-12'),30000);
 assert.equal(model.allocationCost(editor.values()[0],'2026-11-02'),0);
 const draft={operatingAllocations:editor.draft()};
 editor.setRecord({weekStart:'2026-10-12',operatingAllocations:editor.values()},draft);
 assert.equal(editor.values()[0].startWeek,'2026-10-05');
});

test('two-week Marketing costs cover 5–18 October and completed weeks show neither the total nor its division',()=>{
 const {editor,allocation,load,find}=editorFixture();allocation.weeks=2;
 for(const week of ['2026-10-05','2026-10-12']){
  load(week);assert.notEqual(editor.inputs()[0].value,'');
  assert.equal(model.allocationCost(editor.values()[0],week),60000);
  assert.match(find(node=>node.className==='operating-type-calculation').textContent,/600\.00 per week/);
 }
 for(const week of ['2026-10-19','2026-10-26','2026-11-02']){
  load(week);assert.equal(editor.inputs()[0].value,'');
  assert.equal(find(node=>node.className==='operating-type-calculation').textContent,'');
  assert.equal(model.allocationCost(editor.values()[0],week),0);
 }
 assert.equal(editor.values()[0].totalCents,120000);
 assert.equal(editor.draft()[0].totalCost,'1200.00');
 const draft={operatingAllocations:editor.draft()};
 editor.setRecord({weekStart:'2026-11-02',operatingAllocations:editor.values()},draft);
 assert.equal(editor.inputs()[0].value,'');
 assert.equal(find(node=>node.className==='operating-type-calculation').textContent,'');
 load('2026-10-05');assert.notEqual(editor.inputs()[0].value,'');
});

test('a blank 12 October browser draft cannot hide a saved two-week Marketing bill entered on 5 October',()=>{
 const {editor,allocation}=editorFixture();allocation.weeks=2;
 editor.setRecord({weekStart:'2026-10-12',operatingAllocations:[]});
 const olderDraft={operatingAllocations:editor.draft()};
 assert.equal(olderDraft.operatingAllocations[0].totalCost,'');
 editor.setRecord({weekStart:'2026-10-12',operatingAllocations:[allocation]},olderDraft);
 assert.notEqual(editor.inputs()[0].value,'');
 assert.equal(editor.values()[0].startWeek,'2026-10-05');
 assert.equal(model.allocationCost(editor.values()[0],'2026-10-12'),60000);
 assert.equal(model.allocationCost(editor.values()[0],'2026-10-19'),0);
});

test('new amounts and explicit renewal still start a new bill, while editing an empty completed total cannot revive the old charge',()=>{
 const {editor,load,input,find}=editorFixture();load('2026-10-12');
 input(0,'800');assert.equal(editor.values()[0].startWeek,'2026-10-12');
 load('2026-10-12');find(node=>node.dataset.editId==='operating-type-marketing-renew').onclick();
 input(0,'1200');input(1,'4');assert.equal(editor.values()[0].startWeek,'2026-10-12');
 load('2026-11-02');input(1,'2');assert.equal(editor.inputs()[0].value,'');
 assert.equal(model.operatingCost(null,editor.values(),'2026-11-02'),0);
 input(0,'600');assert.equal(editor.values()[0].startWeek,'2026-11-02');
 assert.equal(model.allocationCost(editor.values()[0],'2026-11-09'),30000);
 assert.equal(model.allocationCost(editor.values()[0],'2026-11-16'),0);
});
