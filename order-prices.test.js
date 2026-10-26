const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {fixture}=require('./test-support/ai-assistance-fixture.cjs'),usage=require('./stock-usage'),sales=require('./sales'),prices=require('./order-prices'),catalogues=require('./catalogue-store');
async function setup(t,options){const app=await fixture(options);t.after(()=>app.close());
 const headers=locationId=>({'X-Location-Id':locationId});
 const save=(day,items,locationId=app.location)=>app.api(app.office,'/api/order-history','POST',{requestId:crypto.randomUUID(),companyId:app.office.session.companyId,locationId,orderDate:day,items:items.map(([id,quantity,price])=>({id,quantity,price}))},headers(locationId));
 const get=(order,locationId=app.location)=>app.api(app.office,'/api/order-history/'+order.id,'GET',undefined,headers(locationId));
 const change=async(id,price,extra={})=>{const product=(await app.api(app.office,'/api/catalogue')).products.find(p=>p.id===id);return app.api(app.office,'/api/products/'+id,'PUT',{...product,price,...extra});};
 return{...app,save,get,change,headers,file:id=>path.join(app.dir,id+'.json'),audit:async()=>JSON.parse(await fs.readFile(path.join(app.dir,'catalogue.json'),'utf8')).orderPriceUpdates||[]};
}
test('stock prices update the latest matching order per item and location, with consistent costs and unchanged quantities',async t=>{
 const app=await setup(t),south=await app.api(app.office,'/api/locations','POST',{name:'South'});
 const older=await app.save('2026-10-11',[['paper',2,600],['pens',1,1000]]),paper=await app.save('2026-10-12',[['paper',3,650]]),pens=await app.save('2026-10-13',[['pens',2,1200]]),southPaper=await app.save('2026-10-12',[['paper',4,500]],south.id),southOther=await app.save('2026-10-14',[['boxes',1,2800]],south.id);
 const count=await app.api(app.office,'/api/stock-counts','POST',{countDate:'2026-10-18',items:[{id:'paper',quantity:8}]}),countFile=path.join(app.dir,'stock-counts',count.id+'.json'),countBytes=await fs.readFile(countFile,'utf8');
 const raw=await Promise.all([older,paper,pens,southPaper,southOther].map(o=>fs.readFile(app.file(o.id),'utf8'))),reader=usage.createReader();await reader(app.dir);
 await app.change('paper',8);await app.change('pens',15);
 assert.equal((await app.get(paper)).total,2400);assert.equal((await app.get(paper)).items[0].originalPrice,650);assert.equal((await app.get(pens)).total,3000);assert.equal((await app.get(southPaper,south.id)).total,3200);
 assert.deepEqual(await app.get(older),older);assert.deepEqual(await app.get(southOther,south.id),southOther);
 const read=await reader(app.dir);assert.equal(sales.calculate([],read.orders,app.office.session,{now:new Date('2026-10-13T00:00:00Z')}).spentCents,7600);
 const weekly=await app.api(app.office,'/api/weekly-sales-reports?week=2026-10-12');assert.equal(weekly.weeklyOrders.totalCents,7600);assert.equal(weekly.stockCosts.invoiceCents,0,'financial expenses remain invoices only');
 assert.equal((await app.api(app.office,'/api/order-history')).orders.find(o=>o.id===paper.id).total,2400);assert.equal((await app.get(paper)).items[0].quantity,3);
 assert.deepEqual(await Promise.all([older,paper,pens,southPaper,southOther].map(o=>fs.readFile(app.file(o.id),'utf8'))),raw);assert.equal(await fs.readFile(countFile,'utf8'),countBytes);assert.equal(app.calls.length,0);
 const audit=await app.audit();assert.equal(audit.length,2);assert.equal(audit[0].actorId,app.office.session.id);assert.deepEqual(new Set(audit[0].orders.map(o=>o.id)),new Set([paper.id,southPaper.id]));assert.equal((await app.api(app.office,'/api/catalogue')).orderPriceUpdates,undefined);
 assert.equal((await app.request(app.staff,'/api/products/paper','PUT',{name:'Paper',supplierId:'office',price:9})).status,403);assert.equal((await app.request(app.staff,'/api/order-history/'+southPaper.id,'GET',undefined,app.headers(south.id))).status,403);
 const other=await app.api(app.office,'/api/companies','POST',{name:'Other company',locationName:'Other store'}),foreign={...JSON.parse(raw[1]),id:crypto.randomUUID(),companyId:other.id,locationId:other.locationId};await fs.writeFile(app.file(foreign.id),JSON.stringify(foreign));await app.change('paper',9);assert.equal((await prices.decorate(app.dir,foreign)).total,foreign.total);
});
test('repeated updates persist their selected orders, retain original prices and do not resurrect deleted orders',async t=>{
 const app=await setup(t),first=await app.save('2026-10-11',[['paper',2,650]]);await app.change('paper',8);await app.change('paper',8);assert.equal((await app.audit()).length,1);
 await app.change('paper',6.5);let order=await app.get(first);assert.equal(order.total,1300);assert.equal(order.items[0].originalPrice,650);assert.equal(order.priceAdjustment.originalTotal,1300);
 const next=await app.save('2026-10-12',[['paper',3,650]]);await app.change('paper',10);assert.equal((await app.get(first)).total,1300);assert.equal((await app.get(next)).total,3000);
 // A new reader/store models restart: adjustments are durable, not computed from today's latest order.
 await catalogues.createStore(app.dir,[]).read('default');assert.equal((await usage.createReader()(app.dir)).orders.find(o=>o.id===next.id).total,3000);
 await app.api(app.office,'/api/order-history/'+next.id,'DELETE',{companyId:app.office.session.companyId,locationId:app.location});assert.equal((await app.get(first)).total,1300);const tombstone=await fs.readFile(app.file(next.id),'utf8');
 await app.change('paper',11);assert.equal((await app.get(first)).total,2200);assert.equal(await fs.readFile(app.file(next.id),'utf8'),tombstone);assert.equal((await app.request(app.office,'/api/order-history/'+next.id)).status,404);
 const input={requestId:crypto.randomUUID(),items:[{id:'paper',quantity:2}]},live=await app.api(app.office,'/api/orders','POST',input),bytes=await fs.readFile(app.file(live.id),'utf8');await app.change('paper',12);const replay=await app.api(app.office,'/api/orders','POST',input);assert.equal(replay.total,2400);assert.equal(replay.items[0].originalPrice,1100);assert.deepEqual(replay.delivery,live.delivery);assert.deepEqual(replay.confirmation,live.confirmation);assert.equal(await fs.readFile(app.file(live.id),'utf8'),bytes);assert.equal(app.calls.length,0);
});
test('pending prices and zeroes stay distinct, and incompatible packs or suppliers never reprice older orders instead',async t=>{
 const app=await setup(t);await app.change('paper',6.5,{unitAmount:'10 reams'});const older=await app.save('2026-10-11',[['paper',2,650]]),latest=await app.save('2026-10-12',[['paper',3,null]]);
 await app.change('paper',8);assert.equal((await app.get(latest)).pricePending,false);assert.equal((await app.get(latest)).items[0].originalPrice,null);assert.equal((await app.get(latest)).total,2400);
 await app.change('paper',null);assert.equal((await app.get(latest)).total,2400,'unknown catalogue price cannot erase a known saved price');await app.change('paper',0);assert.equal((await app.get(latest)).total,0);assert.equal((await app.get(latest)).pricePending,false);
 await app.change('paper',1,{unitAmount:'20 reams'});const packOrder=await app.save('2026-10-13',[['paper',1,100]]);await app.change('paper',2,{unitAmount:'40 reams'});assert.equal((await app.get(packOrder)).total,100);assert.equal((await app.get(latest)).total,0);assert.deepEqual(await app.get(older),older);
 const supplierOrder=await app.save('2026-10-14',[['paper',1,200]]),supplier=await app.api(app.office,'/api/suppliers','POST',{name:'New supplier'});await app.change('paper',3,{supplierId:supplier.id});assert.equal((await app.get(supplierOrder)).total,200);assert.equal((await app.get(packOrder)).total,100);assert.deepEqual(await app.get(older),older);
});
test('legacy owner-only orders share their migrated location while other owners and deleted records stay separate',async t=>{
 const dir=await fs.mkdtemp('/tmp/opstack-legacy-prices-');t.after(()=>fs.rm(dir,{recursive:true,force:true}));await fs.writeFile(path.join(dir,'locations.json'),JSON.stringify([{id:'north',companyId:'default',legacyAccountIds:['one','two']} ]));
 const record=(owner,day,extra={})=>({id:crypto.randomUUID(),status:'requested',requestOwnerId:owner,createdAt:'2026-10-'+day+'T02:00:00.000Z',items:[{id:'paper',quantity:2,price:650}],total:1300,...extra});
 const old=record('one','10'),latest=record('two','11'),other=record('three','10'),deleted=record('two','12',{status:'deleted'}),records=[old,latest,other,deleted];await Promise.all(records.map(o=>fs.writeFile(path.join(dir,o.id+'.json'),JSON.stringify(o))));
 const data={products:[{id:'paper',price:800}]};await prices.capture(dir,'default',data,new Map([['paper',650]]));await fs.writeFile(path.join(dir,'catalogue.json'),JSON.stringify(data));const changed=await prices.decorate(dir,records);assert.deepEqual(changed.map(o=>o.total),[1300,1600,1600,1300]);assert.equal(data.orderPriceUpdates[0].orders.length,2);
});
test('a price change during supplier sending survives the final save without resending or changing provider payloads',async t=>{
 let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 const app=await setup(t,{fetchImpl:async()=>{entered();await gate;return new Response(JSON.stringify({id:'fake-email'}),{status:200});}});t.after(()=>release());
 await app.api(app.office,'/api/locations/'+app.location+'/email','PUT',{ORDER_FROM_EMAIL:'sender@example.test',RESEND_API_KEY:'fake-order-price-key',DELIVERY_EMAIL_ENABLED:true});
 await app.api(app.office,'/api/suppliers/office','PUT',{delivery:{method:'email',contact:'supplier@example.test'}});
 const input={requestId:crypto.randomUUID(),items:[{id:'paper',quantity:2}]},pending=app.api(app.office,'/api/orders','POST',input);
 try{await started;await app.change('paper',8);assert.equal((await app.get({id:input.requestId})).total,1600);release();const order=await pending;assert.equal(order.total,1600);assert.equal(order.items[0].originalPrice,650);assert.equal(order.delivery[0].status,'submitted');assert.equal(order.confirmation.status,'submitted');
 const raw=JSON.parse(await fs.readFile(app.file(order.id),'utf8'));assert.equal(raw.total,1300);assert.equal(raw.items[0].price,650);const calls=app.calls.length;assert.equal(calls,2);const receipt=JSON.parse(app.calls[1].options.body);assert.match(receipt.text,/\$13\.00/);
 assert.equal((await app.api(app.office,'/api/orders','POST',input)).total,1600);assert.equal(app.calls.length,calls);assert.equal((await app.get(order)).total,1600);
 }finally{release();await pending;}
});
