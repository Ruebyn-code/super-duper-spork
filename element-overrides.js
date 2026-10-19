const uploadedFonts=require('./uploaded-fonts');const parts=require('./public/edit-parts');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {defaults,fontOptions,validateSettings,isColour}=require('./appearance');const labels=new Set(require('./interface-labels.json').map(l=>l.text));
const {canonical}=require('./interface-text');
async function read(dir){try{const saved=JSON.parse(await fs.readFile(path.join(dir,'element-overrides.json'),'utf8'));for(const entry of Object.values(saved)){if(entry.text)entry.text.original=canonical(entry.text.original);if(entry.texts){entry.texts=Object.fromEntries(Object.entries(entry.texts).map(([key,spec])=>[canonical(key),{...spec,original:canonical(spec.original)}]));}}return saved;}catch(e){if(e.code==='ENOENT')return {};throw e;}}
let pending=Promise.resolve();
function patch(dir,input){const task=pending.then(async()=>{
 if(typeof input?.id!=='string'||!/^[a-zA-Z0-9_.:-]{1,240}$/.test(input.id)||!input.changes||typeof input.changes!=='object'||Array.isArray(input.changes))throw Error('Invalid element change.');
 input={...input,original:canonical(input.original),changes:{...input.changes,...(input.changes.text?{text:{...input.changes.text,original:canonical(input.changes.text.original)}}:{})}};
 const allowed=['font','fontColour','background','backgroundImage','image','text','restoreText','linked','icon','iconColour','iconDetailColour','iconSize','iconStroke'];if(Object.keys(input.changes).some(k=>!allowed.includes(k)))throw Error('Unknown element setting.');
 if(input.scope!==undefined&&input.scope!=='type')throw Error('Invalid edit scope.');
 const shared=input.scope==='type',type=shared?input.type:input.id.startsWith('type:')?input.id.slice(5):'';if((shared||input.id.startsWith('type:'))&&!Object.hasOwn(parts.typeLabels,type))throw Error('Choose a valid matching type.');
 if(shared&&input.id.startsWith('type:'))throw Error('Choose an individual item to link.');
 const targetId=shared?'type:'+type:input.id;
 const library=await uploadedFonts.list(dir),current=await read(dir),entry={...(current[targetId]||{})};
 for(const [key,value] of Object.entries(input.changes)){
  if(key==='restoreText'){if(value!==true)throw Error('Invalid text reset.');if(targetId.startsWith('type:')){if(typeof input.original!=='string'||!labels.has(input.original))throw Error('Choose the original wording to restore.');if(entry.texts){delete entry.texts[input.original];if(!Object.keys(entry.texts).length)delete entry.texts;}if(entry.text?.original===input.original)delete entry.text;}else delete entry.text;continue;}
  if(key==='text'){if(!value||typeof value.original!=='string'||!labels.has(value.original)||(value.value!==null&&typeof value.value!=='string')||(typeof value.value==='string'&&value.value.length>1000))throw Error('Invalid element wording.');for(const token of value.original.match(/\{\w+\}/g)||[])if(value.value&& !value.value.includes(token))throw Error('Keep the '+token+' placeholder.');if(value.attribute!==undefined&&!['placeholder','title'].includes(value.attribute))throw Error('Invalid wording field.');const spec={original:value.original,value:value.value,...(value.attribute?{attribute:value.attribute}:{})};if(targetId.startsWith('type:')){entry.texts={...(entry.texts||{}),...(entry.text?{[entry.text.original]:entry.text}:{}),[value.original]:spec};delete entry.text;}else entry.text=spec;continue;}
  if(value===null){delete entry[key];continue;}
  if(key==='linked'&&(typeof value!=='boolean'||targetId.startsWith('type:')))throw Error('Invalid link setting.');
  if(key==='icon'&&!Object.hasOwn(parts.icons,value))throw Error('Choose a supported icon.');
  if(key==='iconSize'&&(!Number.isInteger(value)||value<8||value>96))throw Error('Choose an icon size from 8 to 96.');
  if(key==='iconStroke'&&(typeof value!=='number'||!Number.isFinite(value)||value<0.5||value>4))throw Error('Choose an icon line width from 0.5 to 4.');
  if(key==='font'&&!Object.hasOwn(fontOptions,value)&&!uploadedFonts.available(value,library))throw Error('Unsupported font.');
  if(['fontColour','background','iconColour','iconDetailColour'].includes(key)&&!isColour(value))throw Error('Invalid colour.');
  if(['backgroundImage','image'].includes(key)&&value!=='')validateSettings({...defaults,backgroundImages:{page:value}});
  entry[key]=value;
 }
 if(targetId.startsWith('type:')&&!type.startsWith('icon-')&&Object.keys(entry).some(key=>key.startsWith('icon')))throw Error('Icon settings require an icon type.');
 if(Object.keys(entry).length)current[targetId]=entry;else delete current[targetId];
 if(shared){const selected={...(current[input.id]||{})};for(const key of allowed)if(key!=='linked')delete selected[key];selected.linked=true;current[input.id]=selected;}
 await fs.mkdir(dir,{recursive:true});const target=path.join(dir,'element-overrides.json'),temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(current),{mode:0o600});await fs.rename(temp,target);return current;
 });pending=task.catch(()=>{});return task;}
module.exports={read,patch};
