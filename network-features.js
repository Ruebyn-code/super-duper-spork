// Per-network feature switches, stored in the network's own data folder and written only by Opstack owners.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),model=require('./public/network-features-model');
const queues=new Map(),name='network-features.json';
async function read(dir){try{const data=JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));return{revision:Number.isInteger(data.revision)?data.revision:0,disabled:(list=>!data.prepSplit&&list.includes('labels')&&!list.includes('prep')?model.ids.filter(id=>id==='prep'||list.includes(id)):list)(Array.isArray(data.disabled)?data.disabled.filter(id=>model.ids.includes(id)):[]),updatedAt:data.updatedAt||null,updatedBy:data.updatedBy||null};}catch(error){if(error.code!=='ENOENT')throw error;return{revision:0,disabled:[],updatedAt:null,updatedBy:null};}}
function save(dir,input,actor,now=()=>new Date()){const file=path.join(dir,name),task=(queues.get(file)||Promise.resolve()).then(async()=>{
 if(!input||typeof input!=='object'||Object.keys(input).some(key=>!['revision','disabled'].includes(key))||!Number.isInteger(input.revision))throw Object.assign(Error('Choose valid feature settings.'),{status:400});
 const disabled=model.normalize(input.disabled),current=await read(dir);if(input.revision!==current.revision)throw Object.assign(Error('These feature settings changed. Reload them before saving.'),{status:409});
 const next={revision:current.revision+1,prepSplit:1,disabled,updatedAt:now().toISOString(),updatedBy:actor?.username||null};await fs.mkdir(dir,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(next,null,2),{mode:0o600});await fs.rename(temp,file);return{...next,previous:current.disabled};});
 queues.set(file,task.catch(()=>{}));return task;}
module.exports={read,save,file:name};
