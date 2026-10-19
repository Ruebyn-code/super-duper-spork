const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),model=require('./public/home-greeting-model'),interfaceText=require('./interface-text'),overrides=require('./element-overrides'),parts=require('./public/edit-parts');
const queues=new Map();
async function read(dir,seed='Hello {user}'){
 try{const value=JSON.parse(await fs.readFile(path.join(dir,'home-greeting.json'),'utf8'));return{revision:value.revision,text:model.validate(value.text)};}catch(error){if(error.code!=='ENOENT')throw error;}
 const legacy=await interfaceText.read(dir),elements=await overrides.read(dir),local=parts.effective(elements,'home-greeting-intro','text'),spec=local.text?.original==='Hello'?local.text:local.texts?.Hello;
 const [before,after]=model.validate(seed).split('{user}'),choice=spec?spec.value:Object.hasOwn(legacy,'Hello')?legacy.Hello:before.trimEnd(),prefix=choice===null?'':String(choice).trimEnd();
 let text;try{text=model.validate((prefix?prefix+' ':'')+'{user}'+after);}catch{text=model.validate(seed);}return{revision:0,text};
}
async function save(dir,input,seed){if(!input||Object.keys(input).some(key=>!['revision','text'].includes(key))||!Number.isSafeInteger(input.revision)||input.revision<0)throw Object.assign(Error('Reload the greeting before saving.'),{status:400});let text;try{text=model.validate(input.text);}catch(error){throw Object.assign(error,{status:400});}
 const file=path.join(dir,'home-greeting.json'),task=(queues.get(file)||Promise.resolve()).then(async()=>{const previous=await read(dir,seed);if(previous.revision!==input.revision)throw Object.assign(Error('The greeting changed in another tab. Reload it before saving.'),{status:409});const value={revision:previous.revision+1,text},temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temp,JSON.stringify(value),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return value;});const settled=task.catch(()=>{});queues.set(file,settled);try{return await task;}finally{if(queues.get(file)===settled)queues.delete(file);}}
module.exports={read,save};
