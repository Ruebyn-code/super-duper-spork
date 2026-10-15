const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const defaults=[['electricity','Electricity'],['gas','Gas'],['water','Water'],['internet-phone','Internet & phone'],['insurance','Insurance'],['waste-disposal','Waste disposal']];
const pending=new Map();
function fail(message,status=400){const error=Error(message);error.status=status;throw error;}
function target(dir,session){if(!/^[a-zA-Z0-9-]{1,100}$/.test(session?.locationId||''))fail('Choose an accessible location.',403);return path.join(dir,'operating-expense-types',session.locationId+'.json');}
async function read(dir,session){try{return JSON.parse(await fs.readFile(target(dir,session),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return {revision:0,types:defaults.map(([id,name])=>({id,name}))};}}
async function change(dir,session,input,method){const file=target(dir,session);if(!input||!Number.isSafeInteger(input.revision)||input.revision<0)fail('Reload expense types before editing.');
 const operation=(pending.get(file)||Promise.resolve()).then(async()=>{const previous=await read(dir,session);if(previous.revision!==input.revision)fail('Expense types changed in another tab. Reload the saved week before editing types.',409);const types=previous.types.map(type=>({...type}));
  if(method==='POST'){if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>120)fail('Enter an expense type name.');const name=input.name.trim();if(types.some(type=>type.name.toLowerCase()===name.toLowerCase()))fail('This expense type already exists.');if(types.length>=100)fail('Use up to 100 expense types.');types.push({id:crypto.randomUUID(),name});}
  else if(method==='DELETE'){const index=types.findIndex(type=>type.id===input.id);if(index<0)fail('Expense type not found.',404);types.splice(index,1);}
  else fail('Unsupported expense type change.');
  const next={revision:previous.revision+1,types,updatedAt:new Date().toISOString(),updatedBy:session.username},temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(next,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return next;
 });const settled=operation.catch(()=>{});pending.set(file,settled);try{return await operation;}finally{if(pending.get(file)===settled)pending.delete(file);}}
module.exports={read,change};
