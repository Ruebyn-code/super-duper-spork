// Entity collections for the rebuilt app.
//
// Each collection is a JSON file holding an array of records, written
// atomically (temp file + rename, mode 0600) and serialised per collection so
// concurrent writes cannot interleave — the durability rules the current app's
// stores already use, so Phase 7 can copy records across without reshaping them.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const collections=['companies','locations','accounts','sessions','audit'];
function createStore(dir){
 const queues=new Map();
 const file=name=>path.join(dir,name+'.json');
 async function raw(name){
  try{return JSON.parse(await fs.readFile(file(name),'utf8'));}
  catch(error){if(error.code==='ENOENT')return[];throw error;}
 }
 async function read(name){
  if(!collections.includes(name))throw Error('Unknown collection '+name);
  await queues.get(name);
  return raw(name);
 }
 function change(name,fn){
  if(!collections.includes(name))return Promise.reject(Error('Unknown collection '+name));
  const task=(queues.get(name)||Promise.resolve()).then(async()=>{
   const data=await raw(name),result=await fn(data);
   await fs.mkdir(dir,{recursive:true});
   const temp=file(name)+'.'+crypto.randomUUID()+'.tmp';
   try{await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,file(name));}
   finally{await fs.rm(temp,{force:true});}
   return result;
  });
  queues.set(name,task.catch(()=>{}));
  return task;
 }
 return {dir,read,change};
}
module.exports={createStore,collections};
