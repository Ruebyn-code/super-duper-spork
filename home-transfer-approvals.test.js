const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {homeTransfersFixture}=require('./test-support/home-transfers-fixture.cjs'),effects=require('./stock-transfer-effects');
const endpoint='/api/stock-transfers/home-pending';

test('Home pending transfers belong only to the receiving location’s assigned managers and reads never apply stock or expose costs',async()=>{
 const f=await homeTransfersFixture();try{
  const incoming=await f.send({notes:'Two boxes for the weekend'});await f.send({from:f.receiving.id,to:f.location});
  const cancelled=await f.send();await f.api(f.office,'/api/stock-transfers/'+cancelled.id+'/cancel','POST',{revision:1,requestId:crypto.randomUUID()});
  const before=await fs.readFile(path.join(f.dir,'stock-transfers.json'),'utf8'),pending=await f.api(f.manager,endpoint);
  assert.equal(pending.locationId,f.receiving.id);assert.equal(pending.companyId,f.manager.session.companyId);assert.deepEqual(pending.transfers.map(t=>t.id),[incoming.id]);assert.equal(pending.transfers[0].notes,'Two boxes for the weekend');assert.equal(pending.transfers[0].items[0].targetQuantity,2);
  assert.ok(!/price|totalCents|unitCostCents|fingerprint|requestId|receivedBy/.test(JSON.stringify(pending)));assert.equal(pending.transfers[0].moveCosts,true);
  for(const actor of [f.office,f.ordinary,f.staff])assert.equal((await f.request(actor,endpoint)).status,403);
  assert.equal((await f.request(f.manager,endpoint,'GET',undefined,{'X-Location-Id':f.location})).status,403);
  assert.equal(await fs.readFile(path.join(f.dir,'stock-transfers.json'),'utf8'),before);assert.equal(effects.movements(JSON.parse(before),f.manager.session).length,0);assert.equal(f.calls.length,0);
 }finally{await f.close();}
});

test('Home approvals reuse native receipt revisions, CSRF and idempotency, apply stock once and preserve saved counts',async()=>{
 const f=await homeTransfersFixture();try{
  const count=await f.api(f.manager,'/api/stock-counts','POST',{countDate:'2026-10-18',items:[{id:'paper',quantity:0}]}),countFile=path.join(f.dir,'stock-counts',count.id+'.json'),originalCount=await fs.readFile(countFile,'utf8');
  const sent=await f.send(),url=endpoint+'/'+sent.id+'/receive',input={revision:1,requestId:crypto.randomUUID()};
  assert.equal((await f.request(f.manager,url,'POST',input,{'X-CSRF-Token':''})).status,403);assert.equal((await f.request(f.ordinary,url,'POST',input)).status,403);
  assert.equal((await f.request(f.office,url,'POST',input)).status,403);
  const replies=await Promise.all([f.request(f.manager,url,'POST',input),f.request(f.manager,url,'POST',input)]);assert.deepEqual(replies.map(r=>r.status),[200,200]);assert.deepEqual(replies[0].data,replies[1].data);assert.deepEqual(Object.keys(replies[0].data).sort(),['from','id','revision','status','to']);
  assert.deepEqual((await f.api(f.manager,endpoint)).transfers,[]);assert.equal((await f.request(f.manager,url,'POST',{...input,requestId:crypto.randomUUID()})).status,409);
  const records=JSON.parse(await fs.readFile(path.join(f.dir,'stock-transfers.json'),'utf8'));assert.equal(records.length,1);assert.equal(records[0].receivedBy.id,f.manager.session.id);assert.equal(records[0].revision,2);assert.equal(effects.movements(records,f.manager.session).length,1);assert.equal(effects.costs(records,f.office.session).totalCents+effects.costs(records,f.manager.session).totalCents,0);
  assert.equal(await fs.readFile(countFile,'utf8'),originalCount);assert.equal(f.calls.length,0);
 }finally{await f.close();}
});

test('removing a location manager blocks an already reviewed Home approval without changing normal transfer permissions',async()=>{
 const f=await homeTransfersFixture();try{
  const sent=await f.send();assert.equal((await f.api(f.manager,endpoint)).transfers.length,1);await f.assign(f.receiving.id,[]);const manager=await f.login('LocationManager'),before=await fs.readFile(path.join(f.dir,'stock-transfers.json'),'utf8');
  assert.equal((await f.request(manager,endpoint)).status,403);assert.equal((await f.request(manager,endpoint+'/'+sent.id+'/receive','POST',{revision:1,requestId:crypto.randomUUID()})).status,403);
  assert.equal((await f.request(manager,'/api/stock-transfers')).status,200);assert.equal(await fs.readFile(path.join(f.dir,'stock-transfers.json'),'utf8'),before);
 }finally{await f.close();}
});

test('assigned managers using Staff Home receive only operational cross-company transfer details and retain receiver units',async()=>{
 const f=await homeTransfersFixture();try{
  const company=await f.api(f.office,'/api/companies','POST',{name:'Other company',locationName:'Other store'}),headers={'X-Location-Id':company.locationId};
  const supplier=await f.api(f.office,'/api/suppliers','POST',{name:'Other supplier'},headers),product=await f.api(f.office,'/api/products','POST',{name:'Receiving sleeves',supplierId:supplier.id,unitAmount:'50 cups',price:999},headers);
  let levels=await f.api(f.office,'/api/permission-levels','GET',undefined,headers);levels=await f.api(f.office,'/api/permission-levels','POST',{revision:levels.revision,scope:'company',name:'Receiving location manager',level:10,homeDashboard:'staff',permissions:['home.view','transfers.view','transfers.receive']},headers);const role=levels.levels.find(r=>r.name==='Receiving location manager');
  const person=await f.api(f.office,'/api/accounts','POST',{username:'StaffHomeManager',password:'ai-test-password',role:role.id,companyId:company.id,locationId:company.locationId},headers),settings=await f.api(f.office,'/api/locations/'+company.locationId+'/managers','GET',undefined,headers);
  await f.api(f.office,'/api/locations/'+company.locationId+'/managers','PUT',{revision:settings.revision,userIds:[person.id],roleId:role.id},headers);const manager=await f.login('StaffHomeManager');assert.equal(manager.session.homeDashboard,'staff');assert.ok(!manager.session.permissions.includes('sales.view'));
  const transfer=await f.send({to:company.locationId,items:[{sourceProductId:'paper',targetProductId:product.id,quantity:1,targetQuantity:20}]});
  const pending=await f.api(manager,endpoint);assert.deepEqual(pending.transfers.map(t=>t.id),[transfer.id]);assert.equal(pending.transfers[0].items[0].target.name,'Receiving sleeves');assert.equal(pending.transfers[0].items[0].targetQuantity,20);assert.equal(pending.transfers[0].items[0].quantity,1);assert.equal(pending.transfers[0].items[0].target.unitAmount,'50 cups');
  assert.ok(!/price|totalCents|unitCostCents/.test(JSON.stringify(pending)));assert.deepEqual((await f.api(f.manager,endpoint)).transfers,[]);
  assert.equal((await f.request(manager,endpoint,'GET',undefined,{'X-Location-Id':f.receiving.id})).status,403);
  const received=await f.api(manager,endpoint+'/'+transfer.id+'/receive','POST',{revision:1,requestId:crypto.randomUUID()});assert.equal(received.status,'received');
 }finally{await f.close();}
});
