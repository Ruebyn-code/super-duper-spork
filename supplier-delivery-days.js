const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),model=require('./public/supplier-delivery-days-model');
function fail(message,status=400){throw Object.assign(Error(message),{status});}
function createStore(dir){
 const pending=new Map();
 function file(locationId){if(typeof locationId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(locationId))fail('Choose a valid location.');return path.join(dir,'location-supplier-delivery-days',locationId+'.json');}
 async function read(locationId,companyId){try{const record=JSON.parse(await fs.readFile(file(locationId),'utf8'));if(record.locationId!==locationId||record.companyId!==companyId||!Number.isSafeInteger(record.revision)||record.revision<1)throw Error('Supplier delivery days could not be read.');return{revision:record.revision,schedules:model.normalize(record.schedules)};}catch(error){if(error.code==='ENOENT')return{revision:0,schedules:[]};throw error;}}
 async function save(locationId,companyId,input,check){
  if(!input||input.locationId!==locationId||input.companyId!==companyId)fail('The selected location changed. Reopen its delivery days.',409);
  if(!Number.isSafeInteger(input.revision)||input.revision<0)fail('Reload supplier delivery days before saving.');let schedules;try{schedules=model.normalize(input.schedules);}catch(error){fail(error.message);}
  const target=file(locationId),operation=(pending.get(target)||Promise.resolve()).then(async()=>{
   const suppliers=await check();if(schedules.some(row=>!suppliers.some(s=>s.id===row.supplierId)))fail('A supplier changed. Reload delivery days before saving.');
   const previous=await read(locationId,companyId);if(JSON.stringify(previous.schedules)===JSON.stringify(schedules))return previous;
   if(previous.revision!==input.revision)fail('Supplier delivery days changed in another session. Reload delivery days before saving.',409);
   const record={locationId,companyId,revision:previous.revision+1,schedules},temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
   return{revision:record.revision,schedules};
  });const settled=operation.catch(()=>{});pending.set(target,settled);try{return await operation;}finally{if(pending.get(target)===settled)pending.delete(target);}
 }
 return{read,save};
}
module.exports={createStore};
