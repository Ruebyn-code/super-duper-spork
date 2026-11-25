/* Head Office has its own branding (logos, colours/appearance and fonts), separate from the company that owns the
   network's Head Office location. Until someone changes Head Office branding it shows the owning company's look;
   the first branding write copies those files into a private Head Office folder, so later edits never touch the
   company. Wording, layouts, Home sections and App edit icons stay with the company. Reads never write. */
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),customisations=require('./company-customisations');
const ID='head-office',FILES=['appearance.json','logo.json','sidebar-logo.json','fonts.json'],MARKER='branding.json';
const queues=new Map();
function folder(dataDir){return customisations.folder(dataDir,ID);}
async function active(dataDir){try{await fs.access(path.join(folder(dataDir),MARKER));return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
async function copy(from,to){try{await fs.copyFile(from,to);}catch(error){if(error.code!=='ENOENT')throw error;}}
/* Copies the owning company's branding once (serialised per data folder) and returns the Head Office folder. */
function seed(dataDir,companyDir,companyId){
 const key=path.resolve(dataDir),task=(queues.get(key)||Promise.resolve()).then(async()=>{
  const target=folder(dataDir);if(await active(dataDir))return target;
  await fs.mkdir(target,{recursive:true});
  for(const file of FILES)await copy(path.join(companyDir,file),path.join(target,file));
  let fonts=[];try{fonts=await fs.readdir(path.join(companyDir,'fonts'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(fonts.length){await fs.mkdir(path.join(target,'fonts'),{recursive:true});for(const font of fonts)await copy(path.join(companyDir,'fonts',font),path.join(target,'fonts',font));}
  const marker=path.join(target,MARKER),temp=marker+'.'+crypto.randomUUID()+'.tmp';
  await fs.writeFile(temp,JSON.stringify({seededFrom:companyId||null,seededAt:new Date().toISOString()}),{mode:0o600});await fs.rename(temp,marker);
  return target;
 });
 queues.set(key,task.catch(()=>{}));return task;
}
/* Head Office branding applies while the selected location is Head Office, unless a request explicitly names another
   company's assets with ?company=<id> (for example the company picker's logos). */
function applies({session,isHeadOffice,queryCompany,headerCompany}){
 if(!session||!isHeadOffice)return false;
 if(queryCompany)return queryCompany===ID;
 return !headerCompany||headerCompany===ID||headerCompany===session.companyId;
}
module.exports={ID,FILES,folder,active,seed,applies};
