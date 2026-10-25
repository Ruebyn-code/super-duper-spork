const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const queues=new Map(),uuidFile=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$/i;
const validNumber=/^[A-Z0-9]{3}-[A-Z0-9]{3}-\d{4,}$/;
function words(name){return String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().match(/[A-Z0-9]+/g)||[];}
function prefix(company,location){const parts=words(company),companyCode=parts.length>1?parts.slice(0,-1).map(p=>p[0]).join('')+parts.at(-1):parts[0];return(companyCode||'CMP').slice(0,3).padEnd(3,'X')+'-'+(words(location).join('')||'LOC').slice(0,3).padEnd(3,'X');}
async function read(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}}
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
async function locked(dir,change){const key=path.resolve(dir),operation=(queues.get(key)||Promise.resolve()).then(change),pending=operation.catch(()=>{});queues.set(key,pending);try{return await operation;}finally{if(queues.get(key)===pending)queues.delete(key);}}
function reserve(state,order){
 const previous=state.orders[order.id];if(previous)return previous;
 const key=prefix(order.companyName,order.locationName||order.location),sequence=(state.sequences[key]||0)+1;
 if(!Number.isSafeInteger(sequence))throw Error('Order number limit reached.');
 const number=key+'-'+String(sequence).padStart(4,'0');state.sequences[key]=sequence;state.orders[order.id]=number;return number;
}
// Reserve durably before saving or sending. Retries keep the UUID reservation,
// including interrupted writes and deleted orders; gaps are never recycled.
async function assign(dir,order){return locked(dir,async()=>{const file=path.join(dir,'order-numbers.json'),state=await read(file,{sequences:{},orders:{}}),number=reserve(state,order);await write(file,state);return number;});}
async function decorate(dir,records){const state=await read(path.join(dir,'order-numbers.json'),{orders:{}}),one=record=>record&&!record.orderNumber&&state.orders[record.id]?{...record,orderNumber:state.orders[record.id]}:record;return Array.isArray(records)?records.map(one):one(records);}
// Run once before operational requests. Backfill the separate display registry;
// legacy order files, fingerprints, send states, dates and audits stay untouched.
async function migrate(dir){return locked(dir,async()=>{
 let files;try{files=(await fs.readdir(dir)).filter(file=>uuidFile.test(file));}catch(error){if(error.code==='ENOENT')return;throw error;}
 const [companies,locations]=await Promise.all([read(path.join(dir,'companies.json'),[]),read(path.join(dir,'locations.json'),[])]),records=[];
 for(const file of files){const order=await read(path.join(dir,file),null);if(order?.id===file.slice(0,-5)&&['requested','deleted'].includes(order.status)&&Array.isArray(order.items))records.push(order);}
 if(!records.length)return;
 records.sort((a,b)=>String(a.recordedAt||a.createdAt||'').localeCompare(String(b.recordedAt||b.createdAt||''))||a.id.localeCompare(b.id));
 const file=path.join(dir,'order-numbers.json'),state=await read(file,{sequences:{},orders:{}});
 for(const order of records)if(validNumber.test(order.orderNumber||'')){const key=order.orderNumber.slice(0,7),sequence=Number(order.orderNumber.slice(8));state.sequences[key]=Math.max(state.sequences[key]||0,sequence);state.orders[order.id]=order.orderNumber;}
 for(const order of records){if(validNumber.test(order.orderNumber||''))continue;const location=locations.find(l=>order.locationId?l.id===order.locationId:(l.legacyAccountIds||[]).includes(order.requestOwnerId)),company=companies.find(c=>c.id===(order.companyId||location?.companyId||'default'));reserve(state,{...order,companyName:order.companyName||company?.name,locationName:order.locationName||location?.name||order.location});}
 await write(file,state);
});}
module.exports={prefix,assign,migrate,decorate};
