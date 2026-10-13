const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
function invalid(message,status=400){const error=Error(message);error.status=status;throw error;}
function name(value){if(typeof value!=='string'||!value.trim()||value.trim().length>100)invalid('Enter a location name of 1–100 characters.');return value.trim();}
function createStore(dir,auth){
 const file=path.join(dir,'locations.json');let pending=Promise.resolve(),initializing;
 async function read(){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return [];throw error;}}
 async function write(records){await fs.mkdir(dir,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(records,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
 function mutate(change){const operation=pending.then(async()=>{const records=await read(),result=await change(records);await write(records);return result;});pending=operation.catch(()=>{});return operation;}
 async function migrateEmail(accountId,locationId){
  const target=path.join(dir,'location-email',locationId+'.json');await fs.mkdir(path.dirname(target),{recursive:true});
  try{await fs.copyFile(path.join(dir,'account-email',accountId+'.json'),target,fs.constants.COPYFILE_EXCL);await fs.chmod(target,0o600);}catch(error){if(!['ENOENT','EEXIST'].includes(error.code))throw error;}
 }
 function ensure(fresh=false){
  if(fresh)initializing=undefined;
  if(!initializing)initializing=auth.initializeLocations(async accounts=>{
   if(!accounts.some(account=>!account.locationId))return;
   await mutate(async records=>{
    for(const account of accounts){if(account.locationId)continue;let location=records.find(record=>record.id===account.id);
     if(!location){let locationName=account.username,suffix=2;while(records.some(record=>record.name.toLowerCase()===locationName.toLowerCase()))locationName=account.username+' ('+(suffix++)+')';location={id:account.id,name:locationName,archived:false,legacyAccountIds:[account.id],createdAt:new Date().toISOString()};records.push(location);}
     await migrateEmail(account.id,location.id);account.locationId=location.id;
    }
   });
  }).catch(error=>{initializing=undefined;throw error;});
  return initializing;
 }
 async function get(id,{active=false}={}){const record=(await read()).find(record=>record.id===id);if(!record)invalid('Location not found.',404);if(active&&record.archived)invalid('Choose an active location.');return record;}
 async function sessionContext(session){if(!session)return null;if(!session.locationId){await ensure(true);const account=(await auth.list()).find(account=>account.id===session.id);session={...session,locationId:account?.locationId};}const location=await get(session.locationId,{active:true});return {...session,locationName:location.name,legacyAccountIds:location.legacyAccountIds||[],dataScope:'location-'+location.id,canMigrateBrowserData:(location.legacyAccountIds||[]).includes(session.id)};}
 async function list(){await ensure();const [records,accounts]=await Promise.all([read(),auth.list()]);return records.map(({legacyAccountIds,...record})=>({...record,memberCount:accounts.filter(account=>account.locationId===record.id).length}));}
 async function create(input){const locationName=name(input?.name);await ensure();return mutate(records=>{if(records.some(record=>record.name.toLowerCase()===locationName.toLowerCase()))invalid('That location name already exists.');const record={id:crypto.randomUUID(),name:locationName,archived:false,legacyAccountIds:[],createdAt:new Date().toISOString()};records.push(record);return {...record,legacyAccountIds:undefined,memberCount:0};});}
 async function update(id,input){const locationName=name(input?.name);if(input.archived!==undefined&&typeof input.archived!=='boolean')invalid('Choose whether the location is archived.');return auth.initializeLocations(accounts=>mutate(async records=>{const record=records.find(record=>record.id===id);if(!record)invalid('Location not found.',404);if(records.some(other=>other.id!==id&&other.name.toLowerCase()===locationName.toLowerCase()))invalid('That location name already exists.');const memberCount=accounts.filter(account=>account.locationId===id).length;if(input.archived&&memberCount)invalid('Move all users to another location before archiving this location.');record.name=locationName;if(input.archived!==undefined)record.archived=input.archived;return {...record,legacyAccountIds:undefined,memberCount};}));}
 return {ensure,get,list,create,update,sessionContext};
}
module.exports={createStore};
