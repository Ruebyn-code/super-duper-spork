const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const model=require('./public/weekly-sales-report');
function fixture(){
 class Element{constructor(){this.children=[];this.dataset={};this.value='';this.textContent='';this.validationMessage='';}append(...items){this.children.push(...items);}prepend(...items){this.children.unshift(...items);}replaceChildren(...items){this.children=items;}setAttribute(){}setCustomValidity(message){this.validationMessage=message;}get validity(){return {valid:!this.validationMessage};}reportValidity(){return this.validity.valid;}focus(){}select(){}}
 const context={window:{},document:{createElement:()=>new Element()},weeklySalesReport:model,Intl,Date,crypto};vm.runInNewContext(fs.readFileSync(require.resolve('./public/operating-expenses.js'),'utf8'),context);
 const host=new Element();let schedule={version:2,revision:0,bills:[]},editor;
 const amount=input=>input.value.trim()===''?null:Math.round(Number(input.value.replaceAll(',',''))*100);
 editor=context.window.createOperatingExpenseEditor({host,amount,currencyInput:()=>({wrap:new Element(),input:new Element()}),validateMoney:input=>input.setCustomValidity(''),wording:text=>text,onChange:()=>editor.render(),onTypeChange:()=>{throw Error('Unexpected type edit');},onScheduleChange:async body=>{assert.equal(body.revision,schedule.revision);const bills=schedule.bills.map(row=>({...row}));for(const item of body.changes){const index=bills.findIndex(row=>row.id===item.id);if(item.deleted)bills.splice(index,1);else if(index<0)bills.push(item);else bills[index]=item;}schedule={version:2,revision:schedule.revision+1,bills};return schedule;}});
 editor.setTypes({revision:1,types:[{id:'marketing',name:'Marketing'}]});
 const load=(week,draft)=>editor.setRecord({weekStart:week,operatingSchedule:schedule},draft);
 const input=(index,value)=>{const node=editor.inputs()[index];node.value=value;(node.oninput||node.onchange)();};
 const find=predicate=>{function walk(node){return predicate(node)?node:node.children.map(walk).find(Boolean);}return walk(host);};
 return {editor,load,input,find,schedule:()=>schedule};
}
test('saving a two-week bill keeps fixed dates when its amount is edited from a later report',async()=>{
 const {editor,load,input,schedule}=fixture();load('2026-10-05');input(0,'1200');input(1,'2');assert.equal(editor.values().length,0);await editor.saveAll();assert.equal(schedule().bills.length,1);
 load('2026-10-12',{operatingAllocations:[{typeId:'marketing',totalCost:'999',weeks:'4',startWeek:'2026-10-12'}]});assert.equal(model.allocationCost(editor.values()[0],'2026-10-12'),60000);input(0,'800');await editor.saveAll();assert.equal(schedule().bills.length,1);assert.equal(schedule().bills[0].startWeek,'2026-10-05');assert.equal(model.allocationCost(schedule().bills[0],'2026-10-12'),40000);assert.equal(model.allocationCost(schedule().bills[0],'2026-10-19'),0);
});
test('completed bills leave total cost empty, remain in saved bills, and never repeat without saving a new bill',async()=>{
 const {editor,load,input,find,schedule}=fixture();load('2026-10-05');input(0,'1200');input(1,'2');await editor.saveAll();
 for(const week of ['2026-10-19','2026-10-26','2026-11-02']){load(week);assert.equal(editor.inputs()[0].value,'');assert.equal(find(node=>node.className==='operating-type-calculation').textContent,'');assert.equal(model.operatingCost(null,editor.values(),week),0);}
 input(0,'600');input(1,'3');await editor.saveAll();assert.equal(schedule().bills.length,2);assert.equal(schedule().bills[1].startWeek,'2026-11-02');assert.equal(schedule().bills[0].startWeek,'2026-10-05');
});
test('only drafts made against the current schedule can restore unsaved bill edits',async()=>{
 const {editor,load,input,schedule}=fixture();load('2026-10-05');input(0,'1200');input(1,'2');const before=editor.draft();await editor.saveAll();
 load('2026-10-05',{operatingBillDraft:before});assert.equal(editor.inputs()[0].value,'1200.00');assert.equal(editor.draft().rows.length,0);
 input(0,'900');const draft=editor.draft();load('2026-10-05',{operatingBillDraft:draft});assert.equal(editor.inputs()[0].value,'900');assert.equal(editor.draft().rows.length,1);assert.equal(schedule().bills[0].totalCents,120000);
});
