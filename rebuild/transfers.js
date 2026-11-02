// Stock transfers between two locations of a company.
//
// Sending records the intent and reserves nothing; stock moves when the
// receiving location confirms, because that confirmation is what a person at
// the other end actually checked. Receiving therefore debits the sender and
// credits the receiver in ONE atomic store transaction, so a location can never
// be debited without the other side being credited, a retry cannot apply the
// same transfer twice, and a received transfer is immutable.
const crypto=require('node:crypto');
const access=require('./access');
const ledger=require('./ledger');
const permissions=require('./permissions');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};

function createTransfers({store,now=Date.now}){
 const reachable=async actor=>{
  permissions.requirePermission(actor,'transfers.view');
  const [locations,products]=await Promise.all([store.read('locations'),store.read('products')]);
  const names=new Map(products.map(product=>[product.id,product]));
  return {locations:permissions.accessibleLocations(actor,locations),products:names};
 };

 async function send(actor,input){
  const {company,location:from}=await access.write({store,account:actor,permission:'transfers.send',companyId:input?.companyId,locationId:input?.fromLocationId});
  const to=permissions.location(actor,input?.toLocationId,await store.read('locations'));
  if(to.id===from.id)fail('Choose a different location to send stock to.');
  if(to.companyId!==company.id)fail('That location is not in the selected company.',409);
  const products=(await store.read('products')).filter(product=>product.companyId===company.id);
  const movements=await store.read('stock'),hand=ledger.onHand(movements,from.id);
  const items=[],seen=new Set(),at=new Date(now()).toISOString();
  for(const item of Array.isArray(input.items)?input.items:[]){
   const quantity=Number(item?.quantity);
   if(item?.quantity===''||item?.quantity===undefined)continue;
   const product=products.find(candidate=>candidate.id===item.productId&&!candidate.archived);
   if(!product)fail('Choose a stock item from this catalogue.',404);
   if(seen.has(product.id))fail('Use each stock item once per transfer.');
   if(!ledger.validQuantity(quantity)||quantity<=0)fail('Enter a transfer quantity above zero with up to three decimal places.');
   if(quantity>Math.max(0,hand.get(product.id)||0))fail('Only '+(Math.max(0,hand.get(product.id)||0))+' '+product.name+' on hand at '+from.name+'.');
   seen.add(product.id);
   const unitPriceCents=Number.isSafeInteger(product.unitPriceCents)?product.unitPriceCents:null;
   items.push({productId:product.id,name:product.name,sku:product.sku||'',unit:product.unit||'',quantity,unitPriceCents,costCents:unitPriceCents===null?null:Math.round(quantity*unitPriceCents)});
  }
  if(!items.length)fail('Add at least one stock item to transfer.');
  const record={
   id:crypto.randomUUID(),companyId:company.id,
   from:{id:from.id,name:from.name},to:{id:to.id,name:to.name},
   items,note:String(input.note||'').trim().slice(0,500),status:'sent',
   sentById:actor.id,sentByName:actor.name,sentAt:at,receivedAt:null,receivedById:null
  };
  await store.change('transfers',list=>{list.push(record);});
  return record;
 }

 async function receive(actor,transferId){
  const pending=(await store.read('transfers')).find(record=>record.id===transferId);
  if(!pending)fail('Transfer not found.',404);
  // The receiver's location scope is what authorises this confirmation.
  const {company,location:to}=await access.write({store,account:actor,permission:'transfers.receive',companyId:pending.companyId,locationId:pending.to.id});
  const at=new Date(now()).toISOString();
  return store.changeMany(['transfers','stock'],data=>{
   const record=data.transfers.find(item=>item.id===transferId);
   if(!record)fail('Transfer not found.',404);
   if(record.status==='received')return {created:false,transfer:record};
   if(record.status!=='sent')fail('That transfer is no longer waiting to be received.',409);
   record.status='received';
   record.receivedAt=at;
   record.receivedById=actor.id;
   record.receivedByName=actor.name;
   for(const line of record.items){
    const delta=ledger.toThousands(line.quantity);
    // Both sides in one write: the sender is debited exactly as the receiver
    // is credited, and the transfer's own record changes with them.
    data.stock.push(ledger.movement({companyId:company.id,locationId:record.from.id,productId:line.productId,kind:'transfer-out',delta:-delta,refId:record.id,at,actorId:actor.id}));
    data.stock.push(ledger.movement({companyId:company.id,locationId:to.id,productId:line.productId,kind:'transfer-in',delta,refId:record.id,at,actorId:actor.id}));
   }
   return {created:true,transfer:record};
  });
 }

 async function cancel(actor,transferId){
  const pending=(await store.read('transfers')).find(record=>record.id===transferId);
  if(!pending)fail('Transfer not found.',404);
  await access.write({store,account:actor,permission:'transfers.send',companyId:pending.companyId,locationId:pending.from.id});
  return store.change('transfers',list=>{
   const record=list.find(item=>item.id===transferId);
   if(record.status!=='sent')fail('Only a transfer that has not been received can be cancelled.',409);
   record.status='cancelled';
   record.cancelledById=actor.id;
   record.cancelledAt=new Date(now()).toISOString();
   return record;
  });
 }

 async function list(actor){
  const {locations}=await reachable(actor);
  const allowed=new Set(locations.map(location=>location.id));
  const records=await store.read('transfers');
  return records.filter(record=>allowed.has(record.from.id)||allowed.has(record.to.id)).sort((a,b)=>b.sentAt.localeCompare(a.sentAt));
 }

 return {send,receive,cancel,list};
}
module.exports={createTransfers};
