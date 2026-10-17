const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),model=require('./public/order-email-template');
function target(dir,companyId){if(typeof companyId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(companyId))throw Error('Choose a valid company.');return path.join(dir,'company-email-templates',companyId+'.json');}
async function read(dir,companyId){try{return JSON.parse(await fs.readFile(target(dir,companyId),'utf8'));}catch(error){if(error.code==='ENOENT')return {template:{...model.defaults},revision:0};throw error;}}
const pending=new Map();
function save(dir,companyId,input){
 const file=target(dir,companyId),operation=(pending.get(file)||Promise.resolve()).then(async()=>{
  const template=model.validate(input?.template);if(!Number.isSafeInteger(input.revision)||input.revision<0)throw Error('Reload the email template before saving.');
  const previous=await read(dir,companyId);if(previous.revision!==input.revision)throw Object.assign(Error('Another administrator changed this company’s email template. Reload to review their changes before saving.'),{status:409});
  const result={template,revision:previous.revision+1,savedAt:new Date().toISOString()};await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(result),{mode:0o600});await fs.rename(temp,file);return result;
 });
 const settled=operation.catch(()=>{});pending.set(file,settled);return operation.finally(()=>{if(pending.get(file)===settled)pending.delete(file);});
}
module.exports={read,save};
