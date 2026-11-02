// Entity collections for the rebuilt app.
//
// Each collection is a JSON file holding an array of records, written
// atomically (temp file + rename, mode 0600). Every mutation is serialised
// through one queue, and changeMany() stages several collections and writes
// them together, restoring the files it already wrote if a later write fails —
// the durability rules the current app's stores already use, so Phase 7 can
// copy records across without reshaping them.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const collections=[
 'companies','locations','accounts','sessions','audit',
 // Phase 2 — ordering and stock
 'suppliers','products','counts','orders','transfers','wastage','stock','sequences',
 // Phase 3 — sales and reporting
 'salesWeeks','hourlySales','weeklyReports','expenses','budgets',
 // Phase 4 — invoices
 'invoices','invoicePriceUpdates',
 // Phase 5 — workforce
 'employees','shifts','publications','clockEvents','timesheets','availability','leaveRequests','paySnapshots','employer',
 // Phase 6 — comms, library and learning
 'posts','reads','conversations','messages','articles','articleCategories','courses','assignments','attempts','checklists','checklistRuns',
 // Phase 7 and 8 — migration and cut-over
 'migrationRuns','cutover'
];
function createStore(dir){
 let queue=Promise.resolve();
 const file=name=>path.join(dir,name+'.json');
 async function raw(name){
  try{return JSON.parse(await fs.readFile(file(name),'utf8'));}
  catch(error){if(error.code==='ENOENT')return[];throw error;}
 }
 async function write(name,data){
  await fs.mkdir(dir,{recursive:true});
  const temp=file(name)+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,file(name));}
  finally{await fs.rm(temp,{force:true});}
 }
 // One queue for every mutation, so the ledger and the record that explains it
 // can never interleave with another write.
 function enqueue(task){
  const run=queue.then(task),settled=run.catch(()=>{});
  queue=settled;
  return run;
 }
 async function read(name){
  if(!collections.includes(name))throw Error('Unknown collection '+name);
  await queue;
  return raw(name);
 }
 function change(name,fn){
  if(!collections.includes(name))return Promise.reject(Error('Unknown collection '+name));
  return enqueue(async()=>{
   const data=await raw(name),result=await fn(data);
   await write(name,data);
   return result;
  });
 }
 // All-or-nothing across collections. The callback receives already-read
 // collections and must not call read/change itself.
 function changeMany(names,fn){
  const list=[...new Set(names)];
  if(!list.every(name=>collections.includes(name)))return Promise.reject(Error('Unknown collection in that transaction'));
  return enqueue(async()=>{
   const data={},before=new Map();
   for(const name of list){before.set(name,await raw(name));data[name]=structuredClone(before.get(name));}
   const result=await fn(data);
   const written=[];
   try{
    for(const name of list){await write(name,data[name]);written.push(name);}
   }catch(error){
    for(const name of written)await write(name,before.get(name)).catch(()=>{});
    throw error;
   }
   return result;
  });
 }
 return {dir,read,change,changeMany};
}
module.exports={createStore,collections};
