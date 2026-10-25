const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const numbers=require('./order-numbers'),{fixture}=require('./test-support/ai-assistance-fixture.cjs');
async function temporary(t){const dir=await fs.mkdtemp('/tmp/opstack-order-numbers-');t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
test('company and location abbreviations give compact references, including Souvlaki GR and Mernda',()=>{
 assert.equal(numbers.prefix('Souvlaki GR','Mernda'),'SGR-MER');assert.equal(numbers.prefix('Some Great Restaurant','South Morang'),'SGR-SOU');assert.equal(numbers.prefix('OpStack','Épping'),'OPS-EPP');assert.equal(numbers.prefix('',null),'CMP-LOC');assert.equal(numbers.prefix('A','B'),'AXX-BXX');
});
test('durable reservations coalesce concurrent retries and stay unique across abbreviation collisions and restarts',async t=>{
 const dir=await temporary(t),order={id:crypto.randomUUID(),companyName:'Souvlaki GR',locationName:'Mernda'};
 const same=await Promise.all(Array.from({length:8},()=>numbers.assign(dir,order)));assert.deepEqual(new Set(same),new Set(['SGR-MER-0001']));
 const next=await Promise.all(Array.from({length:8},()=>numbers.assign(dir,{...order,id:crypto.randomUUID()})));assert.equal(new Set(next).size,8);assert(next.includes('SGR-MER-0009'));
 assert.equal(await numbers.assign(dir,{...order,id:crypto.randomUUID(),companyName:'Some Great Restaurant',locationName:'Meridian'}),'SGR-MER-0010');
 assert.equal(await numbers.assign(dir,{...order,companyName:'Renamed company',locationName:'New location'}),'SGR-MER-0001');
 await numbers.migrate(dir);assert.equal(await numbers.assign(dir,{...order,id:crypto.randomUUID()}),'SGR-MER-0011');
 const state=JSON.parse(await fs.readFile(path.join(dir,'order-numbers.json')));state.sequences['SGR-MER']=9999;await fs.writeFile(path.join(dir,'order-numbers.json'),JSON.stringify(state));assert.equal(await numbers.assign(dir,{...order,id:crypto.randomUUID()}),'SGR-MER-10000');
});
test('legacy backfill preserves data and send/deletion audits, uses legacy location ownership and resumes stable reservations',async t=>{
 const dir=await temporary(t),company={id:'default',name:'Souvlaki GR'},location={id:'mernda',name:'Mernda',companyId:'default',legacyAccountIds:['owner']};
 await fs.writeFile(path.join(dir,'companies.json'),JSON.stringify([company]));await fs.writeFile(path.join(dir,'locations.json'),JSON.stringify([location]));
 const records=[{id:crypto.randomUUID(),status:'deleted',requestOwnerId:'owner',createdAt:'2025-01-01',items:[],deletedAt:'2026-01-01',confirmation:{status:'submitted'},requestFingerprint:'immutable'},{id:crypto.randomUUID(),status:'requested',companyId:'default',locationId:'mernda',createdAt:'2026-01-01',items:[],delivery:[{status:'pending'}]}];
 for(const record of records)await fs.writeFile(path.join(dir,record.id+'.json'),JSON.stringify(record));
 // Simulate a reservation saved before the corresponding record rewrite.
 assert.equal(await numbers.assign(dir,{...records[0],companyName:company.name,locationName:location.name}),'SGR-MER-0001');
 await numbers.migrate(dir);
 for(const [i,record]of records.entries()){const saved=JSON.parse(await fs.readFile(path.join(dir,record.id+'.json')));assert.deepEqual(saved,record);assert.equal((await numbers.decorate(dir,saved)).orderNumber,'SGR-MER-000'+(i+1));}
 const before=await fs.readFile(path.join(dir,records[1].id+'.json'),'utf8');await numbers.migrate(dir);assert.equal(await fs.readFile(path.join(dir,records[1].id+'.json'),'utf8'),before);
 assert.equal(await numbers.assign(dir,{id:crypto.randomUUID(),companyName:company.name,locationName:location.name}),'SGR-MER-0003');
});
test('live and manually recorded orders share short numbers, retain UUID APIs and use short references in supplier and confirmation emails',async t=>{
 const app=await fixture({fetchImpl:async()=>({ok:true})});t.after(()=>app.close());
 const mernda=await app.api(app.office,'/api/locations','POST',{name:'Mernda'}),headers={'X-Location-Id':mernda.id};
 await app.api(app.office,'/api/locations/'+mernda.id+'/email','PUT',{ORDER_FROM_EMAIL:'sender@example.test',RESEND_API_KEY:'fake-order-number-key',DELIVERY_EMAIL_ENABLED:true});
 const supplier=await app.api(app.office,'/api/suppliers','POST',{name:'Number supplier'});await app.api(app.office,'/api/suppliers/'+supplier.id,'PUT',{delivery:{method:'email',contact:'supplier@example.test'}});
 const product=await app.api(app.office,'/api/products','POST',{name:'Number stock',supplierId:supplier.id,price:12.5}),input={requestId:crypto.randomUUID(),items:[{id:product.id,quantity:2}],orderNumber:'FORGED-0001'};
 const responses=await Promise.all(Array.from({length:4},()=>app.request(app.office,'/api/orders','POST',input,headers)));assert.equal(responses.filter(r=>r.status===201).length,1);assert(responses.every(r=>r.data.orderNumber==='SGR-MER-0001'));assert.equal(app.calls.length,2);
 const order=responses.find(r=>r.status===201).data;assert.equal(order.id,input.requestId);assert.equal((await app.api(app.office,'/api/orders/'+order.id,'GET',undefined,headers)).orderNumber,order.orderNumber);
 for(const call of app.calls){const message=JSON.parse(call.options.body);assert(message.text.includes(order.orderNumber));assert(!message.text.includes(order.id));}
 const supplierCall=app.calls.find(c=>!c.options.headers['Idempotency-Key'].startsWith('order-confirmation-'));assert.equal(supplierCall.options.headers['Idempotency-Key'],order.id+'-'+supplier.id);
 const manualInput={requestId:crypto.randomUUID(),companyId:app.office.session.companyId,locationId:mernda.id,orderDate:'2026-10-20',items:[{id:product.id,quantity:1,price:1250}]};
 const manual=await app.api(app.office,'/api/order-history','POST',manualInput,headers);assert.equal(manual.orderNumber,'SGR-MER-0002');assert.equal(app.calls.length,2);assert.equal((await app.api(app.office,'/api/order-history','POST',manualInput,headers)).orderNumber,manual.orderNumber);
 const history=await app.api(app.office,'/api/order-history?q='+order.orderNumber,'GET',undefined,headers);assert.equal(history.total,1);assert.equal(history.orders[0].id,order.id);assert.equal(history.orders[0].orderNumber,order.orderNumber);
 assert.equal((await app.api(app.office,'/api/order-history/'+order.id,'GET',undefined,headers)).orderNumber,order.orderNumber);
 assert.equal((await app.api(app.office,'/api/order-history','GET')).total,0);assert.equal((await app.request(app.staff,'/api/orders/'+order.id,'GET',undefined,headers)).status,403);
 const search=await app.api(app.office,'/api/search?q='+order.orderNumber,'GET',undefined,headers);assert(JSON.stringify(search).includes('Order '+order.orderNumber));assert(!JSON.stringify(await app.api(app.office,'/api/search?q='+order.orderNumber)).includes('Order '+order.orderNumber));
 await app.api(app.office,'/api/order-history/'+manual.id,'DELETE',{companyId:app.office.session.companyId,locationId:mernda.id},headers);
 const third=await app.api(app.office,'/api/orders','POST',{...input,requestId:crypto.randomUUID()},headers);assert.equal(third.orderNumber,'SGR-MER-0003');
});
test('server restart backfills legacy display numbers without rewriting orders, resending or changing access',async()=>{
 const app=await fixture(),{createServer}=require('./server');let server;
 try{
  const record={id:crypto.randomUUID(),companyId:app.office.session.companyId,locationId:app.location,locationName:'Mernda',requestOwnerId:app.office.session.id,name:'Office',createdAt:'2026-10-20T02:00:00Z',status:'requested',items:[{id:'paper',name:'Paper',supplierId:'s',supplier:'Supplier',quantity:1,price:650}],total:650,delivery:[{supplierId:'s',status:'submitted'}]},file=path.join(app.dir,record.id+'.json'),original=JSON.stringify(record);
  await fs.writeFile(file,original);await new Promise(r=>app.server.close(r));let calls=0;server=createServer(app.dir,{fetchImpl:()=>{calls++;throw Error('No legacy sends');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Office',password:require('./test-support/ai-assistance-fixture.cjs').password})});assert.equal(response.status,200);const headers={Cookie:response.headers.get('set-cookie').split(';')[0]};
  const detail=await(await fetch(base+'/api/orders/'+record.id,{headers})).json();assert.equal(detail.orderNumber,'SGR-MER-0001');assert.equal(detail.id,record.id);
  const history=await(await fetch(base+'/api/order-history?q=SGR-MER-0001',{headers})).json();assert.equal(history.total,1);assert.equal(history.orders[0].orderNumber,detail.orderNumber);
  assert.equal(await fs.readFile(file,'utf8'),original);assert.equal(calls,0);assert.equal((await fetch(base+'/api/orders/'+record.id)).status,401);
 }finally{if(server)await new Promise(r=>server.close(r));await app.close();}
});
