const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {fixture}=require('./test-support/roster-hourly-fixture.cjs'),{createStore}=require('./prep-list');
const item=(extra={})=>({requestId:crypto.randomUUID(),name:'Tzatziki',amount:4,unit:'litres',station:'Cold prep',days:[1,2,3,4,5,6,7],labelTemplateId:null,notes:'',active:true,...extra});
test('managers build a store prep list and staff tick items off with who and when recorded',async t=>{
 const f=await fixture({seed:false});t.after(()=>f.close());
 const payload=item(),replies=await Promise.all([f.api(f.office,'/api/prep-list/items','POST',payload),f.api(f.office,'/api/prep-list/items','POST',payload)]);assert.equal(replies[0].id,replies[1].id,'retries create one item');
 const saved=replies[0];for(const key of ['requestId','requestFingerprint','companyId','locationId'])assert(!Object.hasOwn(saved,key));
 assert.equal((await f.request(f.office,'/api/prep-list/items','POST',{...payload,name:'Other'})).status,409,'a reused retry ID with new details is rejected');
 for(const bad of [item({name:''}),item({amount:0}),item({amount:1.2345}),item({days:[]}),item({days:[8]}),item({labelTemplateId:crypto.randomUUID()}),item({notes:'a'.repeat(301)})])assert.equal((await f.request(f.office,'/api/prep-list/items','POST',bad)).status,400);
 assert.equal((await f.request(f.staff,'/api/prep-list/items','POST',item())).status,403,'staff cannot edit prep items');
 const weekend=await f.api(f.office,'/api/prep-list/items','POST',item({name:'Weekend dough',station:'Bakery',days:[6,7]}));
 const list=await f.api(f.staff,'/api/prep-list');assert.equal(list.date,'2026-10-23');assert(list.canTick);assert.equal(list.canManage,false);assert(!Object.hasOwn(list,'items'),'staff do not receive the manage list');
 assert(list.rows.some(row=>row.id===saved.id));assert(!list.rows.some(row=>row.id===weekend.id),'items only show on their days (Friday here)');
 assert.equal((await f.api(f.staff,'/api/prep-list?date=2026-10-24')).rows.some(row=>row.id===weekend.id),true);
 const tick={date:'2026-10-23',itemId:saved.id,done:true,revision:0};
 const done=await f.api(f.staff,'/api/prep-list/tick','POST',tick);assert.equal(done.done,true);assert.equal(done.doneBy.name,'Staff');assert.equal(done.tickRevision,1);
 assert.equal((await f.api(f.staff,'/api/prep-list/tick','POST',tick)).tickRevision,1,'repeating a tick is harmless');
 assert.equal((await f.request(f.office,'/api/prep-list/tick','POST',{...tick,done:false,revision:0})).status,409,'stale unticks are rejected');
 assert.equal((await f.request(f.staff,'/api/prep-list/tick','POST',{...tick,date:'2026-10-22'})).status,409,'only today can be ticked');
 const undone=await f.api(f.office,'/api/prep-list/tick','POST',{...tick,done:false,revision:1});assert.equal(undone.done,false);
 await f.api(f.office,'/api/prep-list/tick','POST',{...tick,revision:2});
 const home=await f.api(f.staff,'/api/home-prep');assert.equal(home.total,1);assert.equal(home.done,1);
 // Deleting an item keeps today's tick on the list from its snapshot.
 const current=(await f.api(f.office,'/api/prep-list')).items.find(entry=>entry.id===saved.id);
 await f.api(f.office,'/api/prep-list/items/'+saved.id,'DELETE',{revision:current.revision});
 const after=await f.api(f.office,'/api/prep-list');const kept=after.rows.find(row=>row.id===saved.id);assert(kept.removed);assert.equal(kept.name,'Tzatziki');assert.equal(kept.done,true);assert(!after.items.some(entry=>entry.id===saved.id));
 const report=await f.api(f.office,'/api/reporting/activity?start=2026-10-23&end=2026-10-23');
 assert(report.rows.some(row=>row.type==='prep-done'&&/Tzatziki/.test(row.title)),'Staff activity shows who prepped what');
 assert.equal(f.calls(),0);
});
test('prep items can link to the company\'s label templates only',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'prep-list-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const template=crypto.randomUUID(),store=createStore(dir,{now:()=>Date.parse('2026-10-23T02:00:00Z'),templates:async()=>[{id:template,name:'Dips',active:true}]});
 const manager={id:'m',username:'Manager',role:'user',permissions:['prep.view','prep.manage','prep.print'],companyId:'co',locationId:'loc-a'};
 const saved=await store.create(manager,item({labelTemplateId:template}));assert.equal(saved.labelTemplateId,template);
 const list=await store.list(manager);assert.deepEqual(list.rows[0].label,{id:template,name:'Dips'});assert.deepEqual(list.labelTemplates,[{id:template,name:'Dips'}]);
 assert.equal((await store.list({...manager,locationId:'loc-b'})).rows.length,0,'each location keeps its own list');
 await assert.rejects(store.list({...manager,permissions:[]}),{status:403});
});
