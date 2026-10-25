const {test}=require('node:test'),assert=require('node:assert/strict'),model=require('./public/stock-item-save');
const body={name:'Cups',unitAmount:'Box of 1,000',countUnit:{name:'Sleeves',perUnit:20},price:25};
test('unchanged item settings do not rewrite the company catalogue when saving a location target level',async()=>{
 const state=model.create({id:'cups',body,level:null}),calls=[];
 const io={stock:()=>{throw Error('Catalogue must stay unchanged');},target:async(id,level)=>calls.push({id,level})};
 await state.save(body,0,io);assert.deepEqual(calls,[{id:'cups',level:0}]);await state.save(body,0,io);assert.equal(calls.length,1);
 await state.save(body,null,io);assert.deepEqual(calls[1],{id:'cups',level:null});
});
test('a target failure keeps completed stock changes for an explicit retry without repeating the catalogue write',async()=>{
 const state=model.create({id:'cups',body,level:null}),updated={...body,name:'Small chip cups'},calls=[];let fail=true;
 const io={stock:async(id,input)=>{calls.push('stock');return{id,...input};},target:async()=>{calls.push('target');if(fail)throw Error('Temporary target save problem');}};
 await assert.rejects(state.save(updated,12,io),error=>error.partial&&error.message==='Temporary target save problem');assert.equal(state.level,null);
 fail=false;await state.save(updated,12,io);assert.deepEqual(calls,['stock','target','target']);assert.equal(state.level,12);
});
test('new item creation is retained after a later target failure, so retry does not create another item',async()=>{
 const state=model.create(),calls=[];let fail=true;
 const io={stock:async(id,input)=>{calls.push({id,input});return{id:'new-cups'};},target:async(id,level)=>{assert.equal(id,'new-cups');assert.equal(level,6);if(fail)throw Error('Failed');}};
 await assert.rejects(state.save(body,6,io));assert.equal(state.id,'new-cups');fail=false;await state.save(body,6,io);assert.equal(calls.length,1);assert.equal(calls[0].id,null);
});
test('automatic target levels skip manual writes, and a failed stock save never writes a target',async()=>{
 const state=model.create({id:'cups',body,level:10}),updated={...body,price:26};let target=0,stock=0;
 await state.save(body,undefined,{stock:async()=>stock++,target:async()=>target++});assert.equal(stock,0);assert.equal(target,0);
 await assert.rejects(state.save(updated,12,{stock:async()=>{throw Error('Save failed');},target:async()=>target++}),error=>!error.partial);
 assert.equal(target,0);assert.equal(state.level,10);
});
