const {belongs}=require('./location-scope');
const stockCountGroups=require('./public/stock-count-groups');
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
  seen.add(item.id);return {id:item.id,quantity:Math.round(item.quantity*1000)/1000};
 }).sort((a,b)=>a.id.localeCompare(b.id));
 return {countDate:input.countDate,location:(input.location||'').trim(),notes:(input.notes||'').trim(),items};
}
function folder(dir){return path.join(dir,'stock-counts');}
async function read(dir,id){if(!uuid.test(id))return null;try{return JSON.parse(await fs.readFile(path.join(folder(dir),id+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function canRead(record,session){return record&&(session.role==='admin'||belongs(record,session));}
async function get(dir,id,session){const record=await read(dir,id);if(!canRead(record,session))invalid('Stock count not found.',404);return record;}
async function list(dir,session){
 let files;try{files=await fs.readdir(folder(dir));}catch(error){if(error.code==='ENOENT')return [];throw error;}
 const summaries=[];for(const file of files){if(!file.endsWith('.json')||!uuid.test(file.slice(0,-5)))continue;const record=await read(dir,file.slice(0,-5));if(canRead(record,session))summaries.push({id:record.id,countDate:record.countDate,location:record.location,counterName:record.counterName,locationId:record.locationId,locationName:record.locationName,createdAt:record.createdAt,itemCount:record.items.length});}
 return summaries.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
}
async function save(dir,input,catalogue,session){
 const normalized=normalize(input);const id=input.requestId===undefined?crypto.randomUUID():input.requestId;if(typeof id!=='string'||!uuid.test(id))invalid('Invalid count reference.');
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
 const previous=await read(dir,id);if(previous){if(previous.accountId!==session.id||!belongs(previous,session)||previous.fingerprint!==fingerprint)invalid('This count reference was already used. Start a new count.',409);return {created:false,record:previous};}
 const products=new Map(catalogue.products.map(product=>[product.id,product])),suppliers=new Map(catalogue.suppliers.map(supplier=>[supplier.id,supplier.name]));
 const items=normalized.items.map(item=>{const product=products.get(item.id);if(!product)invalid('A counted stock item was removed. Refresh the catalogue and try again.');return {...item,name:product.name,sku:product.sku||'',category:product.category||'',stockCountGroup:stockCountGroups.resolve(product),description:product.description||'',supplierId:product.supplierId,supplier:suppliers.get(product.supplierId)||'Supplier removed'};});
 const record={...normalized,items,id,accountId:session.id,counterName:session.username,...(session.locationId?{companyId:session.companyId,locationId:session.locationId,locationName:session.locationName}:{}),createdAt:new Date().toISOString(),fingerprint};
 await fs.mkdir(folder(dir),{recursive:true});const temp=path.join(folder(dir),id+'.'+crypto.randomUUID()+'.tmp'),target=path.join(folder(dir),id+'.json');
 try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});try{await fs.link(temp,target);}catch(error){if(error.code!=='EEXIST')throw error;const existing=await read(dir,id);if(existing.accountId!==session.id||!belongs(existing,session)||existing.fingerprint!==fingerprint)invalid('This count reference was already used. Start a new count.',409);return {created:false,record:existing};}}finally{await fs.rm(temp,{force:true});}
 return {created:true,record};
}
module.exports={get,list,save};
