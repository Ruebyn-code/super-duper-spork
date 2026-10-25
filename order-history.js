const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {belongs}=require('./location-scope'),{can}=require('./permissions');
const calendar=require('./public/rostering-model'),orderNumbers=require('./order-numbers');
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const uuidFile=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$/i;
function fail(message,status=400){throw Object.assign(Error(message),{status});}
function scope(record,actor,status='requested'){return record?.status===status&&Array.isArray(record.items)&&(record.companyId?record.companyId===actor.companyId:actor.companyId==='default')&&belongs(record,actor,'requestOwnerId');}
function date(value){if(typeof value!=='string'||!/^20\d\d-\d\d-\d\d$/.test(value))fail('Choose a valid order date from 2000 onwards.');calendar.date(value);return value;}
function text(value,max,label){if(value===undefined)return '';if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))fail('Enter a valid '+label+'.');return value.trim();}
function placedDate(record){return record.source==='manual_history'?record.orderDate:calendar.today(Date.parse(record.createdAt));}
function summary(record){return{id:record.id,orderNumber:record.orderNumber||record.id,orderDate:placedDate(record),createdAt:record.createdAt,locationId:record.locationId,locationName:record.locationName||record.location||'',source:record.source==='manual_history'?'manual_history':'platform',reference:record.reference||'',name:record.name||'',itemCount:record.items.length,suppliers:[...new Map(record.items.map(i=>[i.supplierId,{id:i.supplierId,name:i.supplier||'Supplier removed'}])).values()],total:record.total,pricePending:Boolean(record.pricePending),recordedAt:record.recordedAt||null,recordedBy:record.recordedBy||null,delivery:(record.delivery||[]).map(d=>({supplierId:d.supplierId,supplier:d.supplier,status:d.status}))};}
function detail(record){return{...summary(record),notes:record.notes||'',items:record.items.map(i=>({id:i.id,name:i.name,sku:i.sku||'',unitAmount:i.unitAmount||'',supplierId:i.supplierId,supplier:i.supplier,quantity:i.quantity,price:i.price}))};}
async function read(dir,id){if(!uuidFile.test(id+'.json'))return null;try{const record=JSON.parse(await fs.readFile(path.join(dir,id+'.json'),'utf8'));return record.id===id?await orderNumbers.decorate(dir,record):null;}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function get(dir,actor,id){if(!can(actor,'orders.view'))fail('Ordering access required.',403);const record=await read(dir,id);if(!scope(record,actor))fail('Order not found.',404);return detail(record);}
async function list(dir,actor,params,{reader,now=Date.now()}={}){
 if(!can(actor,'orders.view'))fail('Ordering access required.',403);
 const from=params.get('from'),to=params.get('to'),supplier=params.get('supplier')||'',query=(params.get('q')||'').trim().toLowerCase();if(from)date(from);if(to)date(to);if(from&&to&&from>to)fail('The end date must follow the start date.');if(query.length>200||supplier.length>100)fail('Use shorter history filters.');
 const page=Number(params.get('page')||1);if(!Number.isInteger(page)||page<1||page>100000)fail('Choose a valid history page.');
 const records=(await reader(dir)).orders.filter(r=>scope(r,actor)&&Number.isFinite(Date.parse(r.createdAt)));
 const suppliers=[...new Map(records.flatMap(r=>r.items.map(i=>[i.supplierId,{id:i.supplierId,name:i.supplier||'Supplier removed'}]))).values()].sort((a,b)=>a.name.localeCompare(b.name));
 const filtered=records.filter(r=>{const day=placedDate(r);return(!from||day>=from)&&(!to||day<=to)&&(!supplier||r.items.some(i=>i.supplierId===supplier))&&(!query||[r.id,r.orderNumber,r.reference,r.name,r.notes,...r.items.flatMap(i=>[i.name,i.sku,i.supplier])].filter(Boolean).join(' ').toLowerCase().includes(query));}).sort((a,b)=>placedDate(b).localeCompare(placedDate(a))||String(b.recordedAt||b.createdAt).localeCompare(String(a.recordedAt||a.createdAt))||b.id.localeCompare(a.id));
 const pageSize=25,pages=Math.max(1,Math.ceil(filtered.length/pageSize)),current=Math.min(page,pages);
 return{today:calendar.today(now),locationId:actor.locationId,locationName:actor.locationName,companyId:actor.companyId,canRecord:can(actor,'orders.place'),canDelete:can(actor,'orders.place'),suppliers,page:current,pages,total:filtered.length,orders:filtered.slice((current-1)*pageSize,current*pageSize).map(summary)};
}
const removals=new Map();
async function remove(dir,actor,id,input,{now=Date.now()}={}){
 if(!can(actor,'orders.view')||!can(actor,'orders.place'))fail('Order placing permission required to delete a past order.',403);
 if(input?.companyId!==actor.companyId||input?.locationId!==actor.locationId)fail('The selected location changed. Reopen the order before deleting it.',409);
 if(!uuidFile.test(id+'.json'))fail('Order not found.',404);
 const target=path.join(dir,id+'.json'),operation=(removals.get(target)||Promise.resolve()).then(async()=>{
  const record=await read(dir,id);if(!scope(record,actor)&&!scope(record,actor,'deleted'))fail('Order not found.',404);
  if(record.status==='deleted')return{removed:true,id};
  if(record.delivery?.some(result=>result.status==='pending')||record.confirmation?.status==='pending')fail('This order is still being sent. Wait for sending to finish before deleting it.',409);
  // Retain the UUID and private audit so retries cannot recreate or resend it.
  const deleted={...record,status:'deleted',deletedAt:new Date(now).toISOString(),deletedById:actor.id,deletedBy:actor.username},temp=target+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(deleted,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
  return{removed:true,id};
 });
 const queued=operation.catch(()=>{});removals.set(target,queued);
 try{return await operation;}finally{if(removals.get(target)===queued)removals.delete(target);}
}
function normalize(input,actor,now){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter the past order details.');
 if(input.companyId!==actor.companyId||input.locationId!==actor.locationId)fail('The selected location changed. Reopen the past order form.',409);
 const orderDate=date(input.orderDate);if(orderDate>calendar.today(now))fail('Past orders cannot have a future date.');
 const reference=text(input.reference,100,'order reference'),notes=text(input.notes,1000,'order notes');
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>500)fail('Add from 1 to 500 stock items.');
 const seen=new Set(),items=input.items.map(i=>{if(!i||typeof i.id!=='string'||i.id.length>100||seen.has(i.id)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>999||i.price!==null&&(!Number.isSafeInteger(i.price)||i.price<0||i.price>100000000))fail('Choose unique stock items, whole quantities from 1 to 999 and valid unit prices.');seen.add(i.id);return{id:i.id,quantity:i.quantity,price:i.price};}).sort((a,b)=>a.id.localeCompare(b.id));
 return{orderDate,reference,notes,items};
}
async function save(dir,actor,input,catalogue,{now=Date.now()}={}){
 if(!can(actor,'orders.view')||!can(actor,'orders.place'))fail('Order placing permission required to record a past order.',403);
 const normalized=normalize(input,actor,now),id=input.requestId;if(typeof id!=='string'||!uuid.test(id))fail('Choose a valid order reference.');
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
 const replay=record=>{if(!scope(record,actor)||record.source!=='manual_history'||record.requestOwnerId!==actor.id||record.requestFingerprint!==fingerprint)fail('This order reference is already used. Reopen the form for a new order.',409);return{created:false,order:detail(record)};};
 const existing=await read(dir,id);if(existing)return replay(existing);
 const products=new Map(catalogue.products.map(p=>[p.id,p])),suppliers=new Map(catalogue.suppliers.map(s=>[s.id,s]));
 const items=normalized.items.map(item=>{const product=products.get(item.id),supplier=product&&suppliers.get(product.supplierId);if(!product||!supplier)fail('An item or supplier was removed. Reload the catalogue before saving.');return{...item,name:product.name,sku:product.sku||'',unitAmount:product.unitAmount||'',supplierId:supplier.id,supplier:supplier.name};});
 const recordedAt=new Date(now).toISOString(),noon=calendar.instant(normalized.orderDate,'12:00');
 const record={...normalized,id,items,total:items.reduce((sum,i)=>sum+(i.price===null?0:i.price*i.quantity),0),pricePending:items.some(i=>i.price===null),source:'manual_history',status:'requested',companyId:actor.companyId,companyName:actor.companyName,locationId:actor.locationId,locationName:actor.locationName,location:actor.locationName,name:actor.username,requestOwnerId:actor.id,requestFingerprint:fingerprint,createdAt:noon>recordedAt?recordedAt:noon,recordedAt,recordedBy:actor.username,recordedById:actor.id,delivery:[]};
 record.orderNumber=await orderNumbers.assign(dir,record);
 await fs.mkdir(dir,{recursive:true});const target=path.join(dir,id+'.json'),temp=target+'.'+crypto.randomUUID()+'.tmp';
 try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});try{await fs.link(temp,target);}catch(error){if(error.code!=='EEXIST')throw error;return replay(await read(dir,id));}}finally{await fs.rm(temp,{force:true});}
 return{created:true,order:detail(record)};
}
module.exports={get,list,save,remove};
