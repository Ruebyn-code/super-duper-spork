// Ordering for the rebuilt app: the usage window, the order sheet, the cart and
// placed orders with snapshotted prices.
//
// The rounding engine is public/stock-order-rules.js verbatim (minimum order,
// multiples, rounding cut-off and separate-unit rules) and the usage window is
// par-levels.windowFor() — up to four completed Sunday–Saturday cycles ending
// last Sunday — so a recommendation matches the current app's for the same
// counts. "Order when" is always derived, never stored: an item is recommended
// only when available stock is at or below it.
const crypto=require('node:crypto');
const access=require('./access');
const ledger=require('./ledger');
const permissions=require('./permissions');
const par=require('../par-levels');
const rules=require('../public/stock-order-rules');
const {prefix}=require('../order-numbers');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const dayMs=86400000;

// Average weekly usage from the latest count on each completed Sunday, mirroring
// par-levels.calculate: the target level rounds up, and "order when" is the
// greatest three-decimal count no higher than the average.
function usageLevels(counts,locationId,now){
 const window=par.windowFor(new Date(now),par.defaultTimeZone);
 const start=Date.parse(window.startDate+'T00:00:00Z')/dayMs;
 const end=Date.parse(window.currentWeekStart+'T00:00:00Z')/dayMs;
 const latest=new Map();
 const records=counts
  .filter(record=>record&&record.locationId===locationId&&Array.isArray(record.items))
  .sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||String(a.id).localeCompare(String(b.id)));
 for(const record of records){
  const day=Date.parse(String(record.countDate)+'T00:00:00Z')/dayMs;
  if(!Number.isFinite(day)||day<start||day>=end)continue;
  if(new Date(day*dayMs).getUTCDay()!==0)continue;
  const snapshot=latest.get(record.countDate)||new Map();
  for(const item of record.items)if(item&&Number.isFinite(item.quantity))snapshot.set(item.productId,ledger.toThousands(item.quantity));
  latest.set(record.countDate,snapshot);
 }
 const totals=new Map();
 for(const snapshot of latest.values())for(const [productId,quantity] of snapshot){
  const total=totals.get(productId)||{thousandths:0,weeks:0};
  total.thousandths+=quantity;
  total.weeks+=1;
  totals.set(productId,total);
 }
 const levels=new Map();
 for(const [productId,total] of totals)levels.set(productId,{
  weeks:total.weeks,
  level:Math.ceil(total.thousandths/(total.weeks*1000)),
  orderWhenLevel:Math.floor(total.thousandths/total.weeks)/1000
 });
 return {window,countedWeeks:latest.size,levels};
}

function createOrdering({store,now=Date.now}){
 async function recommendations(actor,{companyId,locationId}={}){
  const {company,location}=await access.read({store,account:actor,permission:'orders.view',companyId,locationId});
  const [products,suppliers,counts,movements]=await Promise.all([store.read('products'),store.read('suppliers'),store.read('counts'),store.read('stock')]);
  const hand=ledger.onHand(movements,location.id);
  const usage=usageLevels(counts,location.id,now());
  const supplierNames=new Map(suppliers.filter(supplier=>supplier.companyId===company.id).map(supplier=>[supplier.id,supplier.name]));
  const rows=products
   .filter(product=>product.companyId===company.id&&!product.archived)
   .map(product=>{
    const counted=Math.max(0,hand.get(product.id)||0);
    const history=usage.levels.get(product.id)||null;
    const quantity=history?rules.recommendation({...product,par:{orderWhenLevel:history.orderWhenLevel}},history.level,counted):null;
    return {
     productId:product.id,name:product.name,sku:product.sku||'',unit:product.unit||'',
     supplierId:product.supplierId||'',supplier:supplierNames.get(product.supplierId)||'Supplier',
     category:product.category||'',rule:rules.describe(product),
     counted,level:history?history.level:null,orderWhenLevel:history?history.orderWhenLevel:null,weeks:history?history.weeks:0,
     quantity,toOrder:typeof quantity==='number'&&quantity>0
    };
   })
   .sort((a,b)=>a.supplier.localeCompare(b.supplier)||a.name.localeCompare(b.name));
  return {company,location,window:usage.window,countedWeeks:usage.countedWeeks,rows};
 }

 // Turns entered quantities into priced lines. A quantity that does not match
 // the item's ordering rule is rounded by the same engine the order sheet's
 // recommendation uses, and the review page shows the result before it is sent.
 function price(products,suppliers,items){
  const supplierNames=new Map(suppliers.map(supplier=>[supplier.id,supplier.name]));
  const lines=[],rounded=[],seen=new Set();
  for(const item of Array.isArray(items)?items:[]){
   const quantity=Number(item?.quantity);
   if(!item?.productId||!Number.isFinite(quantity)||quantity<=0)continue;
   const product=products.find(candidate=>candidate.id===item.productId&&!candidate.archived);
   if(!product||seen.has(product.id))continue;
   const ordered=rules.valid(product,quantity)?quantity:rules.round(product,quantity);
   if(!Number.isInteger(ordered)||ordered<=0)continue;
   if(ordered!==quantity)rounded.push({name:product.name,from:quantity,to:ordered});
   seen.add(product.id);
   const unitPriceCents=Number.isSafeInteger(product.unitPriceCents)?product.unitPriceCents:null;
   lines.push({
    productId:product.id,name:product.name,sku:product.sku||'',unit:product.unit||'',
    supplierId:product.supplierId||'',supplier:supplierNames.get(product.supplierId)||'Supplier',
    quantity:ordered,unitPriceCents,lineTotalCents:unitPriceCents===null?null:ordered*unitPriceCents
   });
  }
  if(!lines.length)fail('Choose at least one stock item and quantity.');
  const totalCents=lines.reduce((sum,line)=>sum+(line.lineTotalCents||0),0);
  return {lines,totalCents,rounded,hasUnknownPrice:lines.some(line=>line.unitPriceCents===null)};
 }

 const catalogues=async companyId=>{
  const [products,suppliers]=await Promise.all([store.read('products'),store.read('suppliers')]);
  return {
   products:products.filter(product=>product.companyId===companyId),
   suppliers:suppliers.filter(supplier=>supplier.companyId===companyId)
  };
 };

 async function review(actor,input){
  const {company,location}=await access.read({store,account:actor,permission:'orders.view',companyId:input?.companyId,locationId:input?.locationId});
  const {products,suppliers}=await catalogues(company.id);
  return {company,location,...price(products,suppliers,input.items),note:String(input.note||'').trim().slice(0,500)};
 }

 async function place(actor,input){
  const {company,location}=await access.write({store,account:actor,permission:'orders.place',companyId:input?.companyId,locationId:input?.locationId});
  const {products,suppliers}=await catalogues(company.id);
  const priced=price(products,suppliers,input.items);
  const note=String(input.note||'').trim().slice(0,500);
  const requestId=typeof input.requestId==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(input.requestId)?input.requestId:null;
  const signature=crypto.createHash('sha256').update(JSON.stringify([location.id,priced.lines.map(line=>[line.productId,line.quantity])])).digest('hex');
  const at=new Date(now()).toISOString();
  return store.changeMany(['orders','sequences'],data=>{
   if(requestId){
    const previous=data.orders.find(order=>order.id===requestId);
    if(previous){
     if(previous.locationId!==location.id||previous.signature!==signature)fail('That order reference was already used. Start a new order.',409);
     return {created:false,order:previous};
    }
   }
   // Order numbers are reserved in the same write as the order: CC-LOC-0001,
   // shared by every order path and never recycled.
   const sequenceId=prefix(company.name,location.name);
   const sequence=data.sequences.find(item=>item.id===sequenceId);
   const next=(sequence?.value||0)+1;
   if(!Number.isSafeInteger(next))fail('Order numbers are used up for this company and location.');
   if(sequence)sequence.value=next;else data.sequences.push({id:sequenceId,value:next});
   const order={
    id:requestId||crypto.randomUUID(),
    companyId:company.id,locationId:location.id,locationName:location.name,
    orderNumber:sequenceId+'-'+String(next).padStart(4,'0'),
    status:'requested',note,items:priced.lines,totalCents:priced.totalCents,
    requestedById:actor.id,requestedByName:actor.name,createdAt:at,signature
   };
   data.orders.push(order);
   return {created:true,order};
  });
 }

 // Confirming a delivery is the only thing that adds ordered stock, and it adds
 // the ordered quantities once: a repeated confirmation returns the same order.
 async function receiveDelivery(actor,orderId){
  const orders=await store.read('orders');
  const pending=orders.find(order=>order.id===orderId);
  if(!pending)fail('Order not found.',404);
  const {company,location}=await access.write({store,account:actor,permission:'orders.receive',companyId:pending.companyId,locationId:pending.locationId});
  const at=new Date(now()).toISOString();
  return store.changeMany(['orders','stock'],data=>{
   const order=data.orders.find(record=>record.id===orderId);
   if(order.status==='received')return {created:false,order};
   if(order.status!=='requested')fail('That order is not waiting on a delivery.',409);
   order.status='received';
   order.receivedAt=at;
   order.receivedById=actor.id;
   order.receivedByName=actor.name;
   for(const line of order.items)data.stock.push(ledger.movement({companyId:company.id,locationId:location.id,productId:line.productId,kind:'receipt',delta:ledger.toThousands(line.quantity),refId:order.id,at,actorId:actor.id}));
   return {created:true,order};
  });
 }

 async function listOrders(actor){
  const [orders,locations]=await Promise.all([store.read('orders'),store.read('locations')]);
  const allowed=new Set(permissions.accessibleLocations(actor,locations).map(location=>location.id));
  return orders.filter(order=>allowed.has(order.locationId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 }

 return {recommendations,review,place,receiveDelivery,listOrders};
}
module.exports={createOrdering,usageLevels};
