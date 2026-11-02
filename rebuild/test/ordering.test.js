// Phase 2 gate tests: count → recommendation → cart → order with snapshotted
// prices, delivery into stock, and a two-location transfer that cannot
// half-apply. Every test runs in its own temporary data directory.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createCatalogue}=require('../catalogue');
const {createOrdering}=require('../ordering');
const {createStock}=require('../stock');
const {createTransfers}=require('../transfers');
const {seed}=require('../seed');
const par=require('../../par-levels');
const {prefix}=require('../../order-numbers');

const password='harbour-demo-passphrase';
const dayMs=86400000;
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*dayMs).toISOString().slice(0,10);
const today=()=>new Date().toISOString().slice(0,10);
function sundays(){
 const window=par.windowFor(new Date(),par.defaultTimeZone);
 return [0,1,2,3].map(week=>shift(window.startDate,week*7));
}
const rejects=async(promise,status,message)=>assert.rejects(promise,error=>{
 assert.equal(error.status,status,`expected ${status}, got ${error.status}: ${error.message}`);
 if(message)assert.match(error.message,message);
 return true;
});

let counter=0;
async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-ordering-'));
 const store=createStore(dir);
 const data=await seed(store,{password});
 const catalogue=createCatalogue({store});
 const ordering=createOrdering({store});
 const stock=createStock({store});
 const transfers=createTransfers({store});
 const actor=email=>data.accounts.find(account=>account.email===email);
 const company=name=>data.companies.find(entry=>entry.name===name);
 const location=name=>data.locations.find(entry=>entry.name===name);
 async function addProduct(owner,companyId,settings={}){
  const supplier=(await store.read('suppliers')).find(entry=>entry.companyId===companyId);
  counter+=1;
  return catalogue.saveProduct(owner,{companyId,supplierId:supplier.id,name:'Test item '+counter,unitPriceCents:1000,orderRule:'minimum',minimumOrder:1,...settings});
 }
 const hand=async(locationId,productId)=>{
  const records=(await store.read('stock')).filter(record=>record.locationId===locationId&&record.productId===productId);
  return records.reduce((total,record)=>total+record.delta,0)/1000;
 };
 return {dir,store,data,catalogue,ordering,stock,transfers,actor,company,location,addProduct,hand};
}

test('a count sets on-hand and a later count only applies the difference',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const company=app.company('Harbour Group');
 const street=app.location('Harbour Street');
 const product=await app.addProduct(admin,company.id,{name:'Counted item',unitPriceCents:500});
 await app.stock.saveCount(admin,{companyId:company.id,locationId:street.id,countDate:today(),items:[{productId:product.id,quantity:10}]});
 assert.equal(await app.hand(street.id,product.id),10);
 await app.stock.saveCount(admin,{companyId:company.id,locationId:street.id,countDate:today(),items:[{productId:product.id,quantity:6}]});
 assert.equal(await app.hand(street.id,product.id),6);
 const movements=(await app.store.read('stock')).filter(record=>record.productId===product.id);
 assert.deepEqual(movements.map(record=>record.delta),[10000,-4000]);
 const counts=await app.stock.listCounts(admin);
 assert.equal(counts[0].items.some(item=>item.productId===product.id),true,'the newest count at this location is listed first');
});

test('recommendations use the four completed Sunday weeks and the order-when level',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@riverside.test');
 const company=app.company('Riverside Group');
 const store=app.location('Riverside Store');
 const product=await app.addProduct(admin,company.id,{name:'Coffee beans',unitPriceCents:3200});
 const dates=sundays();
 for(const [index,countDate] of dates.entries()){
  await app.stock.saveCount(admin,{companyId:company.id,locationId:store.id,countDate,items:[{productId:product.id,quantity:[8,10,12,9][index]}]});
 }
 const sheet=await app.ordering.recommendations(admin,{companyId:company.id,locationId:store.id});
 const row=sheet.rows.find(entry=>entry.productId===product.id);
 assert.equal(row.weeks,4);
 assert.equal(row.level,10,'the target level rounds up from a 9.75 average');
 assert.equal(row.orderWhenLevel,9.75);
 assert.equal(row.counted,9);
 assert.equal(row.quantity,1);
 assert.equal(row.toOrder,true);
 const never=sheet.rows.find(entry=>entry.productId!==product.id);
 assert.equal(never.level,null);
 assert.equal(never.quantity,null,'an item with no counts has no suggestion');
 // Counting above "order when" stops the suggestion for that week.
 await app.stock.saveCount(admin,{companyId:company.id,locationId:store.id,countDate:dates[3],items:[{productId:product.id,quantity:11}]});
 const after=await app.ordering.recommendations(admin,{companyId:company.id,locationId:store.id});
 assert.equal(after.rows.find(entry=>entry.productId===product.id).quantity,0);
});

test('the cart rounds to the item rule and the order keeps its prices',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const company=app.company('Harbour Group');
 const street=app.location('Harbour Street');
 const product=await app.addProduct(admin,company.id,{name:'Fries box',unitPriceCents:1234,orderRule:'multiples',minimumOrder:6});
 const cart=await app.ordering.review(admin,{companyId:company.id,locationId:street.id,items:[{productId:product.id,quantity:7}]});
 assert.equal(cart.lines[0].quantity,12,'multiples of 6 round 7 up to 12');
 assert.equal(cart.lines[0].unitPriceCents,1234);
 assert.equal(cart.totalCents,14808);
 assert.deepEqual(cart.rounded.map(entry=>entry.to),[12]);
 const placed=await app.ordering.place(admin,{companyId:company.id,locationId:street.id,items:[{productId:product.id,quantity:7}],note:'Before the weekend'});
 assert.equal(placed.order.items[0].unitPriceCents,1234);
 assert.equal(placed.order.totalCents,14808);
 assert.equal(placed.order.note,'Before the weekend');
 await app.catalogue.saveProduct(admin,{companyId:company.id,productId:product.id,name:product.name,supplierId:product.supplierId,unitPriceCents:2000,orderRule:'multiples',minimumOrder:6});
 const stored=(await app.store.read('orders')).find(order=>order.id===placed.order.id);
 assert.equal(stored.items[0].unitPriceCents,1234,'a later price change never rewrites a placed order');
 assert.equal(stored.totalCents,14808);
});

test('order numbers are reserved once per company and location, and a retry reuses its order',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const company=app.company('Harbour Group');
 const street=app.location('Harbour Street');
 const product=await app.addProduct(admin,company.id,{name:'Numbered item',unitPriceCents:900});
 const first=await app.ordering.place(admin,{companyId:company.id,locationId:street.id,items:[{productId:product.id,quantity:1}],requestId:'retry-order-1'});
 const second=await app.ordering.place(admin,{companyId:company.id,locationId:street.id,items:[{productId:product.id,quantity:1}],requestId:'retry-order-1'});
 assert.equal(first.created,true);
 assert.equal(second.created,false);
 assert.equal(second.order.orderNumber,first.order.orderNumber);
 assert.equal((await app.store.read('orders')).filter(order=>order.id==='retry-order-1').length,1);
 assert.match(first.order.orderNumber,new RegExp('^'+prefix(company.name,street.name)+'-\\d{4}$'));
 const next=await app.ordering.place(admin,{companyId:company.id,locationId:street.id,items:[{productId:product.id,quantity:1}]});
 assert.equal(Number(next.order.orderNumber.slice(-4)),Number(first.order.orderNumber.slice(-4))+1);
 await rejects(app.ordering.place(admin,{companyId:company.id,locationId:street.id,items:[{productId:product.id,quantity:2}],requestId:'retry-order-1'}),409,/already used/);
});

test('confirming a delivery adds the ordered stock exactly once',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const company=app.company('Harbour Group');
 const street=app.location('Harbour Street');
 const product=await app.addProduct(admin,company.id,{name:'Delivered item',unitPriceCents:450});
 const placed=await app.ordering.place(admin,{companyId:company.id,locationId:street.id,items:[{productId:product.id,quantity:6}]});
 assert.equal(await app.hand(street.id,product.id),0);
 const received=await app.ordering.receiveDelivery(admin,placed.order.id);
 assert.equal(received.created,true);
 assert.equal(await app.hand(street.id,product.id),6);
 const again=await app.ordering.receiveDelivery(admin,placed.order.id);
 assert.equal(again.created,false);
 assert.equal(await app.hand(street.id,product.id),6,'a repeated confirmation cannot add stock twice');
});

test('a transfer moves stock between two locations in one confirmed write',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const company=app.company('Harbour Group');
 const street=app.location('Harbour Street');
 const central=app.location('Harbour Central');
 const product=await app.addProduct(admin,company.id,{name:'Transferred item',unitPriceCents:700});
 await app.stock.saveCount(admin,{companyId:company.id,locationId:street.id,countDate:today(),items:[{productId:product.id,quantity:10}]});
 const sent=await app.transfers.send(admin,{companyId:company.id,fromLocationId:street.id,toLocationId:central.id,items:[{productId:product.id,quantity:4}],note:'Borrowing'});
 assert.equal(sent.status,'sent');
 assert.equal(await app.hand(street.id,product.id),10,'nothing moves until the other location confirms');
 const received=await app.transfers.receive(admin,sent.id);
 assert.equal(received.created,true);
 assert.equal(received.transfer.status,'received');
 assert.equal(await app.hand(street.id,product.id),6);
 assert.equal(await app.hand(central.id,product.id),4);
 const movements=(await app.store.read('stock')).filter(record=>record.refId===sent.id);
 assert.equal(movements.length,2,'one debit and one credit');
 assert.deepEqual(movements.map(record=>record.delta).sort((a,b)=>a-b),[-4000,4000]);
 const again=await app.transfers.receive(admin,sent.id);
 assert.equal(again.created,false);
 assert.equal((await app.store.read('stock')).filter(record=>record.refId===sent.id).length,2,'a retry cannot duplicate movements');
 assert.equal(await app.hand(street.id,product.id),6);
 await rejects(app.transfers.send(admin,{companyId:company.id,fromLocationId:street.id,toLocationId:central.id,items:[{productId:product.id,quantity:20}]}),400,/Only 6/);
 await rejects(app.transfers.send(admin,{companyId:company.id,fromLocationId:street.id,toLocationId:app.location('Riverside Store').id,items:[{productId:product.id,quantity:1}]}),404,/Location not found/);
 const pending=await app.transfers.send(admin,{companyId:company.id,fromLocationId:street.id,toLocationId:central.id,items:[{productId:product.id,quantity:2}]});
 await app.transfers.cancel(admin,pending.id);
 assert.equal(await app.hand(street.id,product.id),6,'a cancelled transfer changes nothing');
 await rejects(app.transfers.receive(admin,pending.id),409,/no longer waiting/);
});

test('counts, orders and transfers stay inside the actor scope',async()=>{
 const app=await fixture();
 const manager=app.actor('manager@harbour.test');
 const harbour=app.company('Harbour Group');
 const street=app.location('Harbour Street');
 const central=app.location('Harbour Central');
 const product=await app.addProduct(manager,{...harbour,id:harbour.id},{name:'Scoped item'}).catch(()=>null);
 const admin=app.actor('admin@harbour.test');
 const item=product||await app.addProduct(admin,harbour.id,{name:'Scoped item'});
 await rejects(app.stock.saveCount(manager,{companyId:harbour.id,locationId:central.id,countDate:today(),items:[{productId:item.id,quantity:1}]}),404,/Location not found/);
 await rejects(app.ordering.place(manager,{companyId:app.company('Riverside Group').id,locationId:app.location('Riverside Store').id,items:[{productId:item.id,quantity:1}]}),404,/Company not found/);
 const counted=await app.stock.saveCount(manager,{companyId:harbour.id,locationId:street.id,countDate:today(),items:[{productId:item.id,quantity:3}]});
 assert.equal(counted.locationId,street.id);
 const placed=await app.ordering.place(manager,{companyId:harbour.id,locationId:street.id,items:[{productId:item.id,quantity:2}]});
 assert.equal(placed.order.locationId,street.id);
 assert.deepEqual((await app.ordering.listOrders(manager)).map(order=>order.id),[placed.order.id]);
});

test('an ordering manager cannot change stock settings',async()=>{
 const app=await fixture();
 const manager=app.actor('manager@harbour.test');
 const harbour=app.company('Harbour Group');
 const supplier=(await app.store.read('suppliers')).find(entry=>entry.companyId===harbour.id);
 await rejects(app.catalogue.saveProduct(manager,{companyId:harbour.id,supplierId:supplier.id,name:'Not allowed',unitPriceCents:100}),403,/permission/);
});

test('wastage keeps a cost snapshot and never subtracts stock again',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const harbour=app.company('Harbour Group');
 const street=app.location('Harbour Street');
 const product=await app.addProduct(admin,harbour.id,{name:'Wasted item',unitPriceCents:640});
 await app.stock.saveCount(admin,{companyId:harbour.id,locationId:street.id,countDate:today(),items:[{productId:product.id,quantity:5}]});
 const before=(await app.store.read('stock')).length;
 const entry=await app.stock.recordWastage(admin,{companyId:harbour.id,locationId:street.id,productId:product.id,quantity:2,date:today(),reason:'Dropped'});
 assert.equal(entry.unitPriceCents,640);
 assert.equal(entry.estimatedCents,1280);
 assert.equal(await app.hand(street.id,product.id),5,'wastage is a log, not a stock movement');
 assert.equal((await app.store.read('stock')).length,before);
 assert.deepEqual((await app.stock.listWastage(admin)).map(record=>record.id),[entry.id]);
});
