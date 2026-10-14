const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function invalid(message){const error=Error(message);error.status=400;throw error;}
const valid=value=>Number.isInteger(value)&&value>=0&&value<=1000000;
function target(dir,locationId){if(typeof locationId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(locationId))invalid('Choose a valid location.');return path.join(dir,'location-par',locationId+'.json');}
function createStore(){
 const pending=new Map();
 async function read(dir,locationId){try{const values=JSON.parse(await fs.readFile(target(dir,locationId),'utf8'));if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Manual par settings could not be read.');return Object.fromEntries(Object.entries(values).filter(([id,value])=>/^[a-zA-Z0-9-]+$/.test(id)&&valid(value)));}catch(error){if(error.code==='ENOENT')return {};throw error;}}
 async function save(dir,locationId,productId,input,check){
  if(!input||typeof input!=='object'||Array.isArray(input)||!Object.hasOwn(input,'level')||(input.level!==null&&!valid(input.level)))invalid('Enter a whole manual par from 0 to 1,000,000, or leave it blank.');
  const file=target(dir,locationId),operation=(pending.get(file)||Promise.resolve()).then(async()=>{
   await check();const values=await read(dir,locationId);if(input.level===null)delete values[productId];else values[productId]=input.level;
   await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(values,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
   return {level:input.level};
  });
  const settled=operation.catch(()=>{});pending.set(file,settled);try{return await operation;}finally{if(pending.get(file)===settled)pending.delete(file);}
 }
 return {read,save};
}
module.exports={createStore};
