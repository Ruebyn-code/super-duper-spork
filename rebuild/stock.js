// Stock counts and the wastage log for the rebuilt app.
//
// A count is a physical snapshot: saving one appends the count record and the
// ledger movement that brings on-hand to the counted quantity, in one atomic
// write, so a count can never change stock without recording who counted what
// and when. Wastage is its own company/location log under Ordering: it keeps
// the price snapshot and the reason, and never subtracts stock again, changes
// target levels or places orders.
const crypto=require('node:crypto');
const access=require('./access');
const ledger=require('./ledger');
const permissions=require('./permissions');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const reachable=(permissions,actor,locations)=>locations.filter(location=>permissions.locationAllowed(actor,location));

function createStock({store,now=Date.now}){
 const productsOf=async companyId=>(await store.read('products')).filter(product=>product.companyId===companyId);

 async function saveCount(actor,input){
  const countDate=input?.countDate;
  if(!validDate(countDate))fail('Choose a valid count date.');
  const {company,location}=await access.write({store,account:actor,permission:'counts.edit',companyId:input?.companyId,locationId:input?.locationId});
  const wanted=[],seen=new Set();
  for(const item of Array.isArray(input.items)?input.items:[]){
   if(item?.quantity===''||item?.quantity===undefined||item?.quantity===null)continue;
   const productId=String(item.productId||''),quantity=Number(item.quantity);
   if(!productId||seen.has(productId))fail('Use each stock item once per count.');
   if(!ledger.validQuantity(quantity))fail('Use quantities from 0 to 1,000,000 with up to three decimal places.');
   seen.add(productId);
   wanted.push({productId,quantity});
  }
  if(!wanted.length)fail('Enter a quantity for at least one stock item.');
  const products=await productsOf(company.id);
  const at=new Date(now()).toISOString();
  return store.changeMany(['counts','stock'],data=>{
   const totals=ledger.balances(data.stock),lines=[],movements=[];
   for(const item of wanted){
    const product=products.find(candidate=>candidate.id===item.productId);
    if(!product)fail('A counted stock item is not in this catalogue. Reload and try again.',409);
    const delta=ledger.toThousands(item.quantity)-(totals.get(ledger.key(location.id,product.id))||0);
    lines.push({productId:product.id,name:product.name,sku:product.sku||'',unit:product.unit||'',quantity:item.quantity});
    if(delta)movements.push(ledger.movement({companyId:company.id,locationId:location.id,productId:product.id,kind:'count',delta,refId:null,at,actorId:actor.id}));
   }
   const record={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,locationName:location.name,countDate,note:String(input.note||'').trim().slice(0,1000),counterId:actor.id,counterName:actor.name,items:lines,createdAt:at};
   for(const entry of movements){entry.refId=record.id;data.stock.push(entry);}
   data.counts.push(record);
   return record;
  });
 }

 async function listCounts(actor){
  permissions.requirePermission(actor,'counts.view');
  const [counts,locations]=await Promise.all([store.read('counts'),store.read('locations')]);
  const names=new Map(locations.map(location=>[location.id,location]));
  return counts
   .filter(record=>permissions.locationAllowed(actor,names.get(record.locationId)))
   .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
   .map(record=>({...record,itemCount:record.items.length}));
 }

 async function recordWastage(actor,input){
  const {company,location}=await access.write({store,account:actor,permission:'wastage.record',companyId:input?.companyId,locationId:input?.locationId});
  const quantity=Number(input?.quantity);
  if(!ledger.validQuantity(quantity)||quantity<=0)fail('Enter a wastage quantity above zero with up to three decimal places.');
  if(!validDate(input?.date))fail('Choose a valid wastage date.');
  const product=(await productsOf(company.id)).find(candidate=>candidate.id===input.productId);
  if(!product)fail('Choose a stock item from this catalogue.',404);
  const unitPriceCents=Number.isSafeInteger(product.unitPriceCents)?product.unitPriceCents:null;
  const record={
   id:crypto.randomUUID(),companyId:company.id,locationId:location.id,locationName:location.name,
   date:input.date,productId:product.id,name:product.name,sku:product.sku||'',unit:product.unit||'',
   quantity,unitPriceCents,estimatedCents:unitPriceCents===null?null:Math.round(quantity*unitPriceCents),
   reason:String(input.reason||'').trim().slice(0,500),recordedById:actor.id,recordedByName:actor.name,
   createdAt:new Date(now()).toISOString()
  };
  await store.change('wastage',list=>{list.push(record);});
  return record;
 }

 async function listWastage(actor){
  permissions.requirePermission(actor,'wastage.view');
  const [records,locations]=await Promise.all([store.read('wastage'),store.read('locations')]);
  const byId=new Map(locations.map(location=>[location.id,location]));
  return records.filter(record=>permissions.locationAllowed(actor,byId.get(record.locationId))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 }

 return {saveCount,listCounts,recordWastage,listWastage};
}
module.exports={createStock,reachable};
