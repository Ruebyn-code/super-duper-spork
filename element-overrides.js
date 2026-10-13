const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {defaults,fontOptions,validateSettings}=require('./appearance');const labels=new Set(require('./interface-labels.json').map(l=>l.text));
async function read(dir){try{return JSON.parse(await fs.readFile(path.join(dir,'element-overrides.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
let pending=Promise.resolve();
function patch(dir,input){const task=pending.then(async()=>{
 if(typeof input?.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,240}$/.test(input.id)||!input.changes||typeof input.changes!=='object'||Array.isArray(input.changes))throw Error('Invalid element change.');
 const allowed=['font','fontColour','background','backgroundImage','text','restoreText'];if(Object.keys(input.changes).some(k=>!allowed.includes(k)))throw Error('Unknown element setting.');
 const current=await read(dir),entry={...(current[input.id]||{})};
 for(const [key,value] of Object.entries(input.changes)){
  if(key==='restoreText'){if(value!==true)throw Error('Invalid text reset.');delete entry.text;continue;}
  if(key==='text'){if(!value||typeof value.original!=='string'||!labels.has(value.original)||(value.value!==null&&typeof value.value!=='string')||(typeof value.value==='string'&&value.value.length>1000))throw Error('Invalid element wording.');for(const token of value.original.match(/\{\w+\}/g)||[])if(value.value&& !value.value.includes(token))throw Error('Keep the '+token+' placeholder.');if(value.attribute!==undefined&&!['placeholder','title'].includes(value.attribute))throw Error('Invalid wording field.');entry.text={original:value.original,value:value.value,...(value.attribute?{attribute:value.attribute}:{})};continue;}
  if(value===null){delete entry[key];continue;}
  if(key==='font'&&!Object.hasOwn(fontOptions,value))throw Error('Unsupported font.');
  if(['fontColour','background'].includes(key)&&!/^#[0-9a-f]{6}$/i.test(value))throw Error('Invalid colour.');
  if(key==='backgroundImage'&&value!=='')validateSettings({...defaults,backgroundImages:{page:value}});
  entry[key]=value;
 }
 if(Object.keys(entry).length)current[input.id]=entry;else delete current[input.id];
 await fs.mkdir(dir,{recursive:true});const target=path.join(dir,'element-overrides.json'),temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(current),{mode:0o600});await fs.rename(temp,target);return current;
 });pending=task.catch(()=>{});return task;}
module.exports={read,patch};
