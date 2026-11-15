const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture}=require('./test-support/ai-assistance-fixture.cjs');

test('saved stock counts can be corrected with a reason; the original file stays untouched and usage follows the correction',async()=>{
 const f=await fixture({fetchImpl:()=>{throw Error('Unexpected provider request');}});
 try{
  const cola=await f.api(f.office,'/api/products','POST',{name:'Cola 450ml',supplierId:'packaging',unitAmount:'Carton of 24',price:30,category:'Drinks'});
  const chips=await f.api(f.office,'/api/products','POST',{name:'Chips',supplierId:'packaging',unitAmount:'Box',price:10,category:'Dry'});
  const opening=await f.api(f.staff,'/api/stock-counts','POST',{requestId:crypto.randomUUID(),countDate:'2026-10-18',items:[{id:cola.id,quantity:0.042}]});
  const closing=await f.api(f.staff,'/api/stock-counts','POST',{requestId:crypto.randomUUID(),countDate:'2026-10-25',items:[{id:cola.id,quantity:0.125}]});
  const file=path.join(f.dir,'stock-counts',closing.id+'.json'),originalBytes=await fs.readFile(file,'utf8');
  // The week is negative before the correction.
  let week=(await f.api(f.staff,'/api/stock-usage?week=2026-10-18')).record.items.find(item=>item.id===cola.id);assert.equal(week.status,'negative_usage');
  const url='/api/stock-counts/'+closing.id,requestId=crypto.randomUUID(),body={requestId,revision:0,reason:'Counted 3 bottles, should have been 1',items:[{id:cola.id,quantity:0.042},{id:chips.id,quantity:2}],notes:'Recounted'};
  // Validation: reason required, stale revision, CSRF and nothing-changed.
  assert.equal((await f.request(f.staff,url,'PUT',{...body,reason:''})).status,400);
  assert.equal((await f.request(f.staff,url,'PUT',{...body,revision:3})).status,409);
  assert.equal((await f.request(f.staff,url,'PUT',{...body,requestId:crypto.randomUUID(),items:[{id:cola.id,quantity:0.125}],notes:''})).status,400);
  const edited=await f.api(f.staff,url,'PUT',body);
  assert.equal(edited.revision,1);assert.equal(edited.edited.count,1);assert.equal(edited.notes,'Recounted');
  assert.deepEqual(edited.items.map(item=>[item.name,item.quantity]).sort(),[['Chips',2],['Cola 450ml',0.042]]);
  assert.equal(edited.createdAt,closing.createdAt);assert.equal(edited.countDate,closing.countDate);
  // Retrying the same correction is harmless; reusing its reference for different values is refused.
  assert.equal((await f.api(f.staff,url,'PUT',body)).revision,1);
  assert.equal((await f.request(f.staff,url,'PUT',{...body,items:[{id:cola.id,quantity:0.5}]})).status,409);
  // The original saved count is byte-for-byte unchanged; reads and usage use the corrected values.
  assert.equal(await fs.readFile(file,'utf8'),originalBytes);
  assert.equal((await f.api(f.staff,url)).items.find(item=>item.id===cola.id).quantity,0.042);
  assert.equal((await f.api(f.staff,'/api/stock-counts')).find(row=>row.id===closing.id).itemCount,2);
  week=(await f.api(f.staff,'/api/stock-usage?week=2026-10-18')).record.items.find(item=>item.id===cola.id);assert.equal(week.status,'complete');assert.equal(week.quantity,0);
  // History shows who changed what and why.
  const history=(await f.api(f.staff,url+'/edits')).edits;assert.equal(history.length,1);assert.equal(history[0].reason,body.reason);
  assert.deepEqual(history[0].changes.map(change=>[change.name,change.from,change.to]).sort(),[['Chips',null,2],['Cola 450ml',0.125,0.042]]);
  // Removing an item and a second correction bump the revision.
  const second=await f.api(f.staff,url,'PUT',{requestId:crypto.randomUUID(),revision:1,reason:'Chips belonged to another count',items:[{id:cola.id,quantity:0.042}]});
  assert.equal(second.revision,2);assert.equal(second.items.length,1);assert.equal(second.notes,'Recounted');
  assert.equal(opening.id.length,36);
 }finally{await f.close();}
});
