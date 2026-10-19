const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),model=require('./public/layout-model');
const pending=new Map();
function invalid(message,status=400){const error=Error(message);error.status=status;throw error;}
function validatePage(page){if(!model.pages.includes(page))invalid('Choose a valid app page.');}
async function read(dir){try{return JSON.parse(await fs.readFile(path.join(dir,'layouts.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return {};throw error;}}
async function page(dir,name){validatePage(name);return (await read(dir))[name]||{revision:0,groups:{}};}
async function save(dir,input){
 validatePage(input?.page);if(!Number.isSafeInteger(input.revision)||input.revision<0)invalid('Reload this page before saving its layout.');let groups,sizes;try{groups=model.validateGroups(input.groups);if(input.sizes!==undefined)sizes=model.validateSizes(input.sizes);}catch(error){invalid(error.message);}const file=path.join(dir,'layouts.json');
 const task=(pending.get(file)||Promise.resolve()).then(async()=>{
  const saved=await read(dir),previous=saved[input.page]||{revision:0,groups:{}};
  if(previous.revision!==input.revision)invalid('This layout changed in another tab. Discard your changes to load the saved layout before trying again.',409);
  const nextSizes=sizes===undefined?previous.sizes||{}:sizes,result={revision:previous.revision+1,groups,...(Object.keys(nextSizes).length?{sizes:nextSizes}:{})};saved[input.page]=result;await fs.mkdir(dir,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(saved),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result;
 });const settled=task.catch(()=>{});pending.set(file,settled);try{return await task;}finally{if(pending.get(file)===settled)pending.delete(file);}
}
module.exports={read,page,save};
