const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture,password}=require('./test-support/ai-assistance-fixture.cjs'),history=require('./order-history'),usage=require('./stock-usage'),sales=require('./sales');
async function setup(t){
 const app=await fixture();t.after(()=>app.close());
 const supplier=await app.api(app.office,'/api/suppliers','POST',{name:'Delete test supplier'}),product=await app.api(app.office,'/api/products','POST',{name:'Delete test stock',supplierId:supplier.id,price:25,stock:0});
 const input={requestId:crypto.randomUUID(),companyId:app.office.session.companyId,locationId:app.location,orderDate:'2026-10-11',reference:'DELETE-TEST',items:[{id:product.id,quantity:3,price:1250}]};
 return{...app,supplier,product,input,context:{companyId:app.office.session.companyId,locationId:app.location},file:id=>path.join(app.dir,id+'.json')};
}
test('deleting a past order updates cached history, Sunday costs, budgets and stock usage without changing counts',async t=>{
 const app=await setup(t),order=await app.api(app.office,'/api/order-history','POST',app.input),url='/api/order-history/'+order.id;
 const countFiles=[];for(const [countDate,quantity]of [['2026-10-11',10],['2026-10-18',8]]){const count=await app.api(app.office,'/api/stock-counts','POST',{requestId:crypto.randomUUID(),countDate,items:[{id:app.product.id,quantity}]});countFiles.push(path.join(app.dir,'stock-counts',count.id+'.json'));}
 const snapshots=await Promise.all(countFiles.map(f=>fs.readFile(f,'utf8'))),before=await fs.readFile(app.file(order.id),'utf8'),reader=usage.createReader();
 assert.equal((await reader(app.dir)).orders.length,1);
 assert.equal((await app.api(app.office,'/api/weekly-sales-reports?week=2026-10-12')).weeklyOrders.totalCents,3750);
 assert.equal((await app.api(app.office,'/api/stock-usage?week=2026-10-11')).record.items.find(i=>i.id===app.product.id).ordered,3);
 assert.equal(sales.calculate([],(await reader(app.dir)).orders,app.office.session,{now:new Date('2026-10-13T00:00:00Z')}).spentCents,3750);
 assert.equal((await app.api(app.office,'/api/order-history')).canDelete,true);
 assert.deepEqual(await app.api(app.office,url,'DELETE',app.context),{removed:true,id:order.id});
 const deleted=JSON.parse(await fs.readFile(app.file(order.id),'utf8'));assert.equal(deleted.status,'deleted');assert.equal(deleted.deletedById,app.office.session.id);assert.equal(deleted.deletedBy,'Office');assert(Number.isFinite(Date.parse(deleted.deletedAt)));
 const {status,deletedAt,deletedById,deletedBy,...original}=deleted;assert.deepEqual(original,((({status,...rest})=>rest)(JSON.parse(before))));
 assert.equal((await reader(app.dir)).orders.length,0);assert.equal((await app.api(app.office,'/api/order-history')).total,0);assert.equal((await app.request(app.office,url)).status,404);assert.equal((await app.request(app.office,'/api/orders/'+order.id)).status,404);
 const weekly=await app.api(app.office,'/api/weekly-sales-reports?week=2026-10-12');assert.equal(weekly.weeklyOrders.totalCents,0);assert(!weekly.stockOrders.some(o=>o.id===order.id));
 const item=(await app.api(app.office,'/api/stock-usage?week=2026-10-11')).record.items.find(i=>i.id===app.product.id);assert.equal(item.ordered,0);assert.equal(item.quantity,2);
 assert.equal(sales.calculate([],[deleted],app.office.session,{now:new Date('2026-10-13T00:00:00Z')}).spentCents,0);assert.equal(sales.allTimeTotals([],[deleted],app.office.session).orderCount,0);
 assert.deepEqual(await Promise.all(countFiles.map(f=>fs.readFile(f,'utf8'))),snapshots);assert.equal((await app.request(app.office,'/api/order-history','POST',app.input)).status,409);assert.equal(app.calls.length,0);
});
test('platform orders can be deleted without resending and their original UUID cannot be reused',async t=>{
 const app=await setup(t),input={requestId:crypto.randomUUID(),items:[{id:app.product.id,quantity:2}]},order=await app.api(app.office,'/api/orders','POST',input),calls=app.calls.length;
 await app.api(app.staff,'/api/order-history/'+order.id,'DELETE',app.context);
 assert.equal((await app.api(app.office,'/api/order-history')).total,0);assert.equal((await app.request(app.office,'/api/orders/'+order.id)).status,404);
 assert.equal((await app.request(app.office,'/api/orders','POST',input)).status,409);assert.equal((await app.request(app.office,'/api/order-history','POST',{...app.input,requestId:order.id})).status,409);
 const deleted=JSON.parse(await fs.readFile(app.file(order.id),'utf8'));assert.equal(deleted.deletedById,app.staff.session.id);assert.deepEqual(deleted.delivery,order.delivery);assert.equal(app.calls.length,calls);
});
test('concurrent deletion and lost-response retries retain one private audit and cannot resurrect history',async t=>{
 const app=await setup(t),order=await app.api(app.office,'/api/order-history','POST',app.input),url='/api/order-history/'+order.id;
 const results=await Promise.all(Array.from({length:5},()=>app.request(app.office,url,'DELETE',app.context)));assert(results.every(r=>r.status===200));assert(results.every(r=>JSON.stringify(r.data)===JSON.stringify({removed:true,id:order.id})));
 const deleted=await fs.readFile(app.file(order.id),'utf8');await app.api(app.staff,url,'DELETE',app.context);assert.equal(await fs.readFile(app.file(order.id),'utf8'),deleted);
 assert.equal((await app.request(app.office,'/api/order-history','POST',app.input)).status,409);assert.equal((await app.api(app.staff,'/api/order-history')).total,0);
});
test('delete requires write permission, CSRF, matching context and sign-in, including on retries',async t=>{
 const app=await setup(t),order=await app.api(app.office,'/api/order-history','POST',app.input),url='/api/order-history/'+order.id;
 let levels=await app.api(app.office,'/api/permission-levels');levels=await app.api(app.office,'/api/permission-levels','POST',{revision:levels.revision,name:'History delete viewer',scope:'company',level:10,permissions:['orders.view']});
 await app.api(app.office,'/api/accounts','POST',{username:'Viewer',password,role:levels.levels.find(r=>r.name==='History delete viewer').id,companyId:app.office.session.companyId,locationId:app.location});const viewer=await app.login('Viewer');
 assert.equal((await app.api(viewer,'/api/order-history')).canDelete,false);assert.equal((await app.request(viewer,url,'DELETE',app.context)).status,403);
 assert.equal((await app.request(app.office,url,'DELETE',app.context,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await app.request(null,url,'DELETE',app.context)).status,401);
 for(const context of [{},{...app.context,companyId:'other-company'},{...app.context,locationId:'other-location'}])assert.equal((await app.request(app.office,url,'DELETE',context)).status,409);
 assert.equal((await app.request(app.office,'/api/order-history/'+crypto.randomUUID(),'DELETE',app.context)).status,404);
 assert.equal((await app.api(app.office,'/api/order-history')).total,1);await app.api(app.office,url,'DELETE',app.context);assert.equal((await app.request(viewer,url,'DELETE',app.context)).status,403);
});
test('deletion cannot cross location or company boundaries, delete counts, or bypass required reading',async t=>{
 const app=await setup(t),order=await app.api(app.office,'/api/order-history','POST',app.input),url='/api/order-history/'+order.id,stored=JSON.parse(await fs.readFile(app.file(order.id),'utf8'));
 const other=await app.api(app.office,'/api/locations','POST',{name:'Other delete location'}),headers={'X-Location-Id':other.id};
 assert.equal((await app.request(app.office,url,'DELETE',{...app.context,locationId:other.id},headers)).status,404);assert.equal((await app.request(app.staff,url,'DELETE',app.context,headers)).status,403);
 const wrong={...stored,id:crypto.randomUUID(),companyId:'another-company'};await fs.writeFile(app.file(wrong.id),JSON.stringify(wrong));assert.equal((await app.request(app.office,'/api/order-history/'+wrong.id,'DELETE',app.context)).status,404);
 const count={id:crypto.randomUUID(),accountId:app.office.session.id,companyId:app.context.companyId,locationId:app.location,items:[],countDate:'2026-10-11'};await fs.writeFile(app.file(count.id),JSON.stringify(count));assert.equal((await app.request(app.office,'/api/order-history/'+count.id,'DELETE',app.context)).status,404);
 await app.api(app.office,'/api/communications/posts','POST',{title:'Read before deleting',body:'Important update.',scope:'company',requireRead:true});assert.equal((await app.request(app.staff,url,'DELETE',app.context)).status,428);
 assert.equal(JSON.parse(await fs.readFile(app.file(order.id),'utf8')).status,'requested');
});
test('an order still being sent cannot be deleted before the final sending state is saved',async t=>{
 const app=await setup(t),order=await app.api(app.office,'/api/orders','POST',{requestId:crypto.randomUUID(),items:[{id:app.product.id,quantity:2}]}),file=app.file(order.id),stored=JSON.parse(await fs.readFile(file,'utf8'));
 stored.delivery[0].status='pending';await fs.writeFile(file,JSON.stringify(stored));assert.equal((await app.request(app.office,'/api/order-history/'+order.id,'DELETE',app.context)).status,409);assert.equal(JSON.parse(await fs.readFile(file,'utf8')).status,'requested');
 stored.delivery[0].status='unconfirmed';await fs.writeFile(file,JSON.stringify(stored));assert.equal((await app.request(app.office,'/api/order-history/'+order.id,'DELETE',app.context)).status,200);
});
