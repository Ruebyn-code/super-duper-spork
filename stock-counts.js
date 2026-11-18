const {belongs}=require('./location-scope');
const {headOffice}=require('./permissions');
const stockCountGroups=require('./public/stock-count-groups');
const countUnits=require('./public/stock-count-units');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(message,status=400){const error=Error(message);error.status=status;throw error;}
function normalize(input){
 if(!input||!/^\d{4}-\d{2}-\d{2}$/.test(input.countDate||''))invalid('Choose a valid count date.');
 const date=new Date(input.countDate+'T00:00:00Z');if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==input.countDate)invalid('Choose a valid count date.');
 for(const [key,max] of [['location',200],['notes',1000]])if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>max))invalid('Enter valid count details.');
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>10000)invalid('Enter a quantity for at least one stock item.');
 const seen=new Set();const items=input.items.map(item=>{
  if(!item||typeof item.id!=='string'||!item.id||item.id.length>240||seen.has(item.id)||typeof item.quantity!=='number'||!Number.isFinite(item.quantity)||item.quantity<0||item.quantity>1000000||Math.abs(item.quantity*1000-Math.round(item.quantity*1000))>0.000001)invalid('Use unique stock items and quantities from 0 to 1,000,000, with up to three decimal places.');
  if(item.countUnit!==undefined&&!countUnits.valid(item.countUnit))invalid('Choose a valid stock counting unit.');
  // Optional whole ordered units counted alongside the smaller counting unit (only with a counting unit).
  if(item.packs!==undefined&&(item.countUnit===undefined||typeof item.packs!=='number'||!Number.isFinite(item.packs)||item.packs<0||item.packs>1000000||Math.abs(item.packs*1000-Math.round(item.packs*1000))>0.000001))invalid('Enter ordered units from 0 to 1,000,000, with up to three decimal places, alongside a counting unit.');
  seen.add(item.id);return {id:item.id,quantity:Math.round(item.quantity*1000)/1000,...(item.countUnit===undefined?{}:{countUnit:countUnits.normalize(item.countUnit)}),...(item.packs===undefined?{}:{packs:Math.round(item.packs*1000)/1000})};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 return {countDate:input.countDate,location:(input.location||'').trim(),notes:(input.notes||'').trim(),items};
}
// Saved quantity in ordered units; the entered counting-unit amount (and any whole ordered units) are kept beside it.
function counted(item){const {packs,...rest}=item;if(!item.countUnit)return rest;const quantity=countUnits.total(packs,item.quantity,item.countUnit);if(quantity>1000000)invalid('Counted quantities must be 1,000,000 ordered units or less.');return {...rest,countedQuantity:item.quantity,...(packs===undefined?{}:{countedPacks:packs}),quantity};}
function folder(dir){return path.join(dir,'stock-counts');}
async function read(dir,id){if(!uuid.test(id))return null;try{return JSON.parse(await fs.readFile(path.join(folder(dir),id+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function canRead(record,session){return record&&(headOffice(session)||belongs(record,session));}
async function get(dir,id,session){const record=await read(dir,id);if(!canRead(record,session))invalid('Stock count not found.',404);return apply(record,await readEdits(dir,id));}
async function list(dir,session){
 let files;try{files=await fs.readdir(folder(dir));}catch(error){if(error.code==='ENOENT')return [];throw error;}
 const summaries=[];for(const file of files){if(!file.endsWith('.json')||!uuid.test(file.slice(0,-5)))continue;const raw=await read(dir,file.slice(0,-5));if(!canRead(raw,session))continue;const record=apply(raw,await readEdits(dir,raw.id));summaries.push({id:record.id,countDate:record.countDate,location:record.location,counterName:record.counterName,locationId:record.locationId,locationName:record.locationName,createdAt:record.createdAt,itemCount:record.items.length,...(record.edited?{edited:record.edited}:{})});}
 return summaries.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
}
async function save(dir,input,catalogue,session){
 const normalized=normalize(input);const id=input.requestId===undefined?crypto.randomUUID():input.requestId;if(typeof id!=='string'||!uuid.test(id))invalid('Invalid count reference.');
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
 const previous=await read(dir,id);if(previous){if(previous.accountId!==session.id||!belongs(previous,session)||previous.fingerprint!==fingerprint)invalid('This count reference was already used. Start a new count.',409);return {created:false,record:previous};}
 const products=new Map(catalogue.products.map(product=>[product.id,product])),suppliers=new Map(catalogue.suppliers.map(supplier=>[supplier.id,supplier.name]));
 const items=normalized.items.map(item=>{
  const product=products.get(item.id);if(!product)invalid('A counted stock item was removed. Refresh the catalogue and try again.');
  if(item.countUnit&&!countUnits.equal(item.countUnit,product.countUnit))invalid(product.name+': the counting unit changed. Refresh, clear this quantity and enter it again.',409);
  return {...counted(item),name:product.name,sku:product.sku||'',category:product.category||'',stockCountGroup:stockCountGroups.resolve(product),unitAmount:product.unitAmount||'',...(product.orderUnitName?{orderUnitName:product.orderUnitName}:{}),supplierId:product.supplierId,supplier:suppliers.get(product.supplierId)||'Supplier removed'};
 });
 const record={...normalized,items,id,accountId:session.id,counterName:session.username,...(session.locationId?{companyId:session.companyId,locationId:session.locationId,locationName:session.locationName}:{}),createdAt:new Date().toISOString(),fingerprint};
 await fs.mkdir(folder(dir),{recursive:true});const temp=path.join(folder(dir),id+'.'+crypto.randomUUID()+'.tmp'),target=path.join(folder(dir),id+'.json');
 try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});try{await fs.link(temp,target);}catch(error){if(error.code!=='EEXIST')throw error;const existing=await read(dir,id);if(existing.accountId!==session.id||!belongs(existing,session)||existing.fingerprint!==fingerprint)invalid('This count reference was already used. Start a new count.',409);return {created:false,record:existing};}}finally{await fs.rm(temp,{force:true});}
 return {created:true,record};
}
// Corrections to saved counts. The original count file is never rewritten: corrected items and notes live in
// stock-count-edits/<countId>.json with a revision and a private before/after audit of every change.
function editsFolder(dir){return path.join(dir,'stock-count-edits');}
async function readEdits(dir,id){if(!uuid.test(id||''))return null;try{return JSON.parse(await fs.readFile(path.join(editsFolder(dir),id+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function apply(record,edits){if(!record||!edits||edits.countId!==record.id)return record;const last=edits.edits[edits.edits.length-1];return {...record,items:edits.items,notes:edits.notes,revision:edits.revision,edited:{revision:edits.revision,at:last?.at,by:last?.by,count:edits.edits.length}};}
async function applyAll(dir,records){let files;try{files=await fs.readdir(editsFolder(dir));}catch(error){if(error.code==='ENOENT')return records;throw error;}const ids=new Set(files.filter(file=>file.endsWith('.json')).map(file=>file.slice(0,-5)));if(!ids.size)return records;return Promise.all(records.map(async record=>ids.has(record?.id)?apply(record,await readEdits(dir,record.id)):record));}
const editQueues=new Map();
function queued(id,task){const run=(editQueues.get(id)||Promise.resolve()).catch(()=>{}).then(task);editQueues.set(id,run.finally(()=>{if(editQueues.get(id)===run)editQueues.delete(id);}).catch(()=>{}));return run;}
async function edit(dir,id,input,catalogue,session){
 if(!uuid.test(id||''))invalid('Stock count not found.',404);
 if(!input||typeof input!=='object'||Array.isArray(input))invalid('Enter the corrected count.');
 const requestId=input.requestId;if(typeof requestId!=='string'||!uuid.test(requestId))invalid('Invalid correction reference.');
 const reason=typeof input.reason==='string'?input.reason.trim():'';if(!reason||reason.length>300)invalid('Say why the count is being corrected (up to 300 characters).');
 return queued(id,async()=>{
  const original=await read(dir,id);if(!canRead(original,session)||original.locationId&&!belongs(original,session))invalid('Stock count not found.',404);
  const existing=await readEdits(dir,id),current=apply(original,existing),revision=existing?.revision||0;
  const normalized=normalize({countDate:original.countDate,location:original.location,notes:input.notes===undefined?current.notes:input.notes,items:input.items});
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify({items:normalized.items,notes:normalized.notes,reason})).digest('hex');
  const replay=existing?.edits.find(entry=>entry.id===requestId);if(replay){if(replay.byId!==session.id||replay.fingerprint!==fingerprint)invalid('This correction reference was already used. Reload the count and try again.',409);return current;}
  if(input.revision!==revision)invalid('Someone else changed this count. Reload it before correcting it again.',409);
  const products=new Map(catalogue.products.map(product=>[product.id,product])),suppliers=new Map(catalogue.suppliers.map(supplier=>[supplier.id,supplier.name])),before=new Map(current.items.map(item=>[item.id,item]));
  const items=normalized.items.map(item=>{
   const previous=before.get(item.id),sameUnit=previous&&(item.countUnit?countUnits.equal(item.countUnit,previous.countUnit):!previous.countUnit),enteredBefore=previous&&(previous.countUnit?previous.countedQuantity:previous.quantity);
   if(previous&&sameUnit&&enteredBefore===item.quantity&&(previous.countedPacks??null)===(item.packs??null))return previous;
   const product=products.get(item.id);if(!product)invalid((previous?.name||'A stock item')+' is no longer in the catalogue, so its quantity cannot be changed.');
   if(item.countUnit&&!countUnits.equal(item.countUnit,product.countUnit))invalid(product.name+': the counting unit changed. Reload and enter it again.',409);
   return {...counted(item),name:product.name,sku:product.sku||'',category:product.category||'',stockCountGroup:stockCountGroups.resolve(product),unitAmount:product.unitAmount||'',...(product.orderUnitName?{orderUnitName:product.orderUnitName}:{}),supplierId:product.supplierId,supplier:suppliers.get(product.supplierId)||'Supplier removed'};
  });
  const brief=list=>list.map(item=>({id:item.id,name:item.name,quantity:item.quantity,...(item.countUnit?{countedQuantity:item.countedQuantity,...(item.countedPacks===undefined?{}:{countedPacks:item.countedPacks}),countUnit:item.countUnit.name}:{})}));
  const changed=JSON.stringify(brief(items))!==JSON.stringify(brief(current.items))||normalized.notes!==(current.notes||'');if(!changed)invalid('Nothing changed in this count.');
  const entry={id:requestId,at:new Date().toISOString(),byId:session.id,by:session.username,reason,fingerprint,before:{items:brief(current.items),notes:current.notes||''},after:{items:brief(items),notes:normalized.notes}};
  const next={countId:id,revision:revision+1,items,notes:normalized.notes,edits:[...(existing?.edits||[]),entry].slice(-100)};
  await fs.mkdir(editsFolder(dir),{recursive:true});const temp=path.join(editsFolder(dir),id+'.'+crypto.randomUUID()+'.tmp');try{await fs.writeFile(temp,JSON.stringify(next,null,2),{mode:0o600});await fs.rename(temp,path.join(editsFolder(dir),id+'.json'));}finally{await fs.rm(temp,{force:true});}
  return apply(original,next);
 });
}
// Correction history for people who can see the count: who, when, why and which quantities changed.
async function history(dir,id,session){const original=await read(dir,id);if(!canRead(original,session))invalid('Stock count not found.',404);const edits=await readEdits(dir,id);return (edits?.edits||[]).map(entry=>{const before=new Map(entry.before.items.map(item=>[item.id,item]));const after=new Map(entry.after.items.map(item=>[item.id,item]));const changes=[];for(const [itemId,item] of after){const old=before.get(itemId);if(!old)changes.push({name:item.name,from:null,to:item.quantity});else if(old.quantity!==item.quantity)changes.push({name:item.name,from:old.quantity,to:item.quantity});}for(const [itemId,item] of before)if(!after.has(itemId))changes.push({name:item.name,from:item.quantity,to:null});return {at:entry.at,by:entry.by,reason:entry.reason,changes,notesChanged:entry.before.notes!==entry.after.notes};}).reverse();}
module.exports={get,list,save,edit,history,applyAll};
