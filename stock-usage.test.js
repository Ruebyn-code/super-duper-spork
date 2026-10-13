const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');const usage=require('./stock-usage'),par=require('./par-levels'),counts=require('./stock-counts');
const catalogue={suppliers:[{id:'supplier',name:'Supplier'}],products:[{id:'a',name:'First',supplierId:'supplier',sku:'A'},{id:'b',name:'Second',supplierId:'supplier'}]};
test('usage is derived from counts and actual receipts, with safe week replacement, account isolation and missing weeks',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stock-usage-')),first={id:'first',username:'First',role:'user'},second={id:'second',username:'Second',role:'admin'};try{
 const current=par.windowFor().currentWeekStart;const previous=usage.shift(current,-7);
 const body={weekStart:previous,items:[{id:'a',opening:12.125,received:3.5,closing:2.625},{id:'b',opening:0,received:0,closing:0}]};
 let record=await usage.save(dir,first,body,catalogue);assert.equal(record.items[0].quantity,13);assert.equal(record.items[1].quantity,0);
 const createdAt=record.createdAt;record=await usage.save(dir,first,body,catalogue);assert.equal(record.createdAt,createdAt);assert.equal((await fs.readdir(path.join(dir,'stock-usage'))).length,1);assert.equal(await usage.readWeek(dir,second,previous),null);
 for(let index=2;index<=4;index++)await usage.save(dir,first,{weekStart:usage.shift(current,-7*index),items:[{id:'a',opening:10,received:0,closing:3},{id:'b',opening:0,received:0,closing:0}]},catalogue);
 let levels=await usage.parLevels(dir,first,catalogue.products);assert.deepEqual(levels.levels.a,{level:9,average:8.5,usedQuantity:34,weeksRecorded:4});assert.equal(levels.levels.b.level,0);assert.equal((await usage.parLevels(dir,second,catalogue.products)).levels.a.level,null);
 await usage.save(dir,first,{weekStart:current,items:[{id:'a',opening:999,received:0,closing:0}]},catalogue);assert.equal((await usage.parLevels(dir,first,catalogue.products)).levels.a.usedQuantity,34);
 await usage.save(dir,first,{...body,items:[]},catalogue);levels=await usage.parLevels(dir,first,catalogue.products);assert.equal(levels.levels.a.level,null);assert.equal(levels.levels.a.weeksRecorded,3);
 for(const changes of [{weekStart:'2026-02-30'},{weekStart:usage.shift(current,7)},{items:[{id:'a',opening:1,received:0,closing:2}]},{items:[{id:'a',opening:-1,received:0,closing:0}]},{items:[{id:'a',opening:1.0001,received:0,closing:0}]},{items:[{id:'a',opening:1,received:0,closing:0},{id:'a',opening:1,received:0,closing:0}]},{items:[{id:'unknown',opening:1,received:0,closing:0}]}])await assert.rejects(usage.save(dir,first,{...body,...changes},catalogue));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('saved count sources are account-owned and tied to the week; usage uses stored quantities and preserves removed stock',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'usage-sources-')),first={id:'first',username:'First',role:'admin'},second={id:'second',username:'Second',role:'user'};try{
 const weekStart=usage.shift(par.windowFor().currentWeekStart,-7);
 const opening=await counts.save(dir,{countDate:weekStart,items:[{id:'a',quantity:20},{id:'b',quantity:5}]},catalogue,first);
 const closing=await counts.save(dir,{countDate:usage.shift(weekStart,6),items:[{id:'a',quantity:8},{id:'b',quantity:5}]},catalogue,first);
 const other=await counts.save(dir,{countDate:weekStart,items:[{id:'a',quantity:999}]},catalogue,second);
 const editor=await usage.editor(dir,first,weekStart);assert.deepEqual(editor.openingCounts.map(record=>record.id),[opening.record.id]);assert.deepEqual(editor.closingCounts.map(record=>record.id),[closing.record.id]);
 const body={weekStart,openingCountId:opening.record.id,closingCountId:closing.record.id,items:[{id:'a',opening:999,received:3,closing:0},{id:'b',opening:999,received:0,closing:0}]};
 const result=await usage.save(dir,first,body,catalogue);assert.equal(result.items[0].opening,20);assert.equal(result.items[0].closing,8);assert.equal(result.items[0].quantity,15);assert.equal(result.items[1].quantity,0);
 await assert.rejects(usage.save(dir,first,{...body,openingCountId:other.record.id},catalogue),error=>error.status===404);
 await assert.rejects(usage.save(dir,first,{...body,weekStart:usage.shift(weekStart,-7)},catalogue));
 const reduced={...catalogue,products:catalogue.products.slice(1)};await usage.save(dir,first,{weekStart,items:[{id:'b',opening:5,received:2,closing:3}]},reduced);const saved=await usage.readWeek(dir,first,weekStart);assert.equal(saved.items.find(item=>item.id==='a').name,'First');assert.equal(saved.items.find(item=>item.id==='a').quantity,15);assert.equal(saved.items.find(item=>item.id==='b').quantity,4);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
