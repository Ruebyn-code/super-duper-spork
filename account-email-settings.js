const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {email}=require('./account-invitations'),pending=new Map();
async function read(dir){try{return JSON.parse(await fs.readFile(path.join(dir,'account-email-settings.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return{from:'',apiKey:'',enabled:false,revision:0};}}
const summary=record=>({from:record.from,enabled:record.enabled,configured:Boolean(record.apiKey),revision:record.revision});
function save(dir,input){
 const task=(pending.get(dir)||Promise.resolve()).then(async()=>{
  const current=await read(dir),fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
  if(input?.revision!==current.revision)fail('Account email settings changed. Reload before saving.',409);
  if(typeof input.enabled!=='boolean')fail('Choose whether account invitation emails are enabled.');
  const from=email(input.from);let apiKey=current.apiKey;
  if(input.apiKey!==undefined){if(typeof input.apiKey!=='string'||input.apiKey.length>1000||/[\r\n]/.test(input.apiKey))fail('Enter a valid Resend API key.');if(input.apiKey.trim())apiKey=input.apiKey.trim();}
  if(input.enabled&&!apiKey)fail('Add a Resend API key before enabling account emails.');
  const next={from,apiKey,enabled:input.enabled,revision:current.revision+1},file=path.join(dir,'account-email-settings.json'),temporary=file+'.'+crypto.randomUUID()+'.tmp';
  await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temporary,JSON.stringify(next),{mode:0o600});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}return summary(next);
 });const settled=task.catch(()=>{});pending.set(dir,settled);return task.finally(()=>{if(pending.get(dir)===settled)pending.delete(dir);});
}
module.exports={read,summary,save};
