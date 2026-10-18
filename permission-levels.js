const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./permissions');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function createStore(dir){
 const file=path.join(dir,'permission-levels.json');
 async function read(){
  try{
   const data=JSON.parse(await fs.readFile(file,'utf8')),same=(role,keys)=>role.permissions.length===keys.length&&keys.every(key=>role.permissions.includes(key)),features=[['communicationsVersion',model.communicationKeys],['knowledgeVersion',model.knowledgeKeys],['rosteringVersion',model.rosteringKeys],['awardsVersion',model.awardKeys],['leaveVersion',model.leaveKeys],['transfersVersion',model.transferKeys]];
   // Only exact historical defaults and full network roles gain new default grants.
   // Customised roles keep their existing access, including company overrides.
   for(let index=0;index<features.length;index++){
    const [version,added]=features[index];if(data[version])continue;const later=features.slice(index+1).map(([,keys])=>keys);
    for(const role of data.levels){
     const original=model.defaults.find(item=>item.id===role.id);let upgrade=false;
     for(let mask=0;mask<2**later.length&&!upgrade;mask++){
      const omitted=new Set([...added,...later.flatMap((keys,offset)=>mask&(1<<offset)?keys:[])]),previous=model.keys.filter(key=>!omitted.has(key));
      if(role.scope==='network'&&same(role,previous)){role.permissions=[...model.keys];upgrade=true;}
      else if(original&&same(role,original.permissions.filter(key=>!omitted.has(key)&&(role.scope==='network'||!model.networkKeys.includes(key))))){role.permissions=[...original.permissions].filter(key=>role.scope==='network'||!model.networkKeys.includes(key));upgrade=true;}
     }
    }
    data[version]=1;
   }
   return data;
  }catch(error){if(error.code!=='ENOENT')throw error;return{revision:0,communicationsVersion:1,knowledgeVersion:1,rosteringVersion:1,awardsVersion:1,leaveVersion:1,transfersVersion:1,levels:structuredClone(model.defaults)};}
 }
 async function locations(){try{return JSON.parse(await fs.readFile(path.join(dir,'locations.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return[];throw error;}}
 function decorate(account,companyId,data,stores=[]){if(!account)return null;const baseId=account.baseRole||account.role,network=data.levels.find(role=>role.id===baseId&&role.scope==='network'),id=account.companyRoles?.[companyId]||baseId,role=data.levels.find(role=>role.id===id&&role.scope===companyId)||data.levels.find(role=>role.id===id&&role.scope==='network')||{id,name:'No assigned permission level',level:0,permissions:['home.view']};return{...account,baseRole:baseId,role:id,roleName:role.name,roleLevel:role.level,permissions:role.permissions,networkPermissions:network?.permissions||[],companyId,companyIds:[...new Set(stores.filter(store=>model.locationIds(account).includes(store.id)).map(store=>store.companyId||'default'))],permissionRevision:data.revision};}
 async function context(account,companyId){return decorate(account,companyId,await read(),await locations());}
 function authority(actor,data){const network=data.levels.find(role=>role.id===(actor.baseRole||actor.role)&&role.scope==='network');return model.can(actor,'roles.network')&&network?{...actor,roleLevel:Math.max(model.level(actor),network.level),permissions:[...new Set([...actor.permissions,...network.permissions])]}:actor;}
 function complete(role){return role&&model.keys.every(key=>role.permissions.includes(key));}
 function preserve(accounts,before,after){const was=accounts.some(account=>complete(before.levels.find(role=>role.id===account.role&&role.scope==='network'))),still=accounts.some(account=>complete(after.levels.find(role=>role.id===account.role&&role.scope==='network')));if(was&&!still)fail('Keep at least one account with full network access and permission management.');}
 async function change(actor,accounts,input,method,id){
  const data=await read();if(!model.can(actor,'roles.manage'))fail('Permission-level management access required.',403);
  if(input?.revision!==data.revision)fail('Permission levels changed. Reload before saving.',409);
  actor=authority(actor,data);
  const scope=input.scope==='network'?'network':actor.companyId;if(scope==='network'&&!model.can(actor,'roles.network'))fail('Network permission management access required.',403);
  const current=id?(data.levels.find(role=>role.id===id&&role.scope===scope)||data.levels.find(role=>role.id===id&&role.scope==='network')):null;
  if(id&&!current)fail('Permission level not found.',404);
  const currentActor=current?{role:current.id,roleLevel:current.level,permissions:current.permissions,networkPermissions:scope==='network'?current.permissions:[]}:null;
  if(currentActor&&!model.canAssign(actor,currentActor))fail('You cannot change a permission level above your own access.',403);
  const next=structuredClone(data);
  if(method==='DELETE'){
   if(!data.levels.some(role=>role.id===id&&role.scope===scope))fail('This is an inherited network level. Select Entire network to delete it.',400);
   const used=accounts.some(account=>scope==='network'?(account.role===id||Object.values(account.companyRoles||{}).includes(id)):account.companyRoles?.[scope]===id||(account.role===id&&model.locationIds(account).some(storeId=>(input.companyLocationIds||[]).includes(storeId))));
   if(used)fail('Move users to another permission level before deleting this level.');
   next.levels=next.levels.filter(role=>!(role.id===id&&role.scope===scope));
  }else{
   if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>80)fail('Enter a permission-level name of 1–80 characters.');
   if(!Number.isInteger(input.level)||input.level<1||input.level>100||input.level>model.level(actor))fail('Choose a hierarchy level from 1 to your own level (maximum 100).');
   if(!Array.isArray(input.permissions)||input.permissions.length>model.keys.length||new Set(input.permissions).size!==input.permissions.length||input.permissions.some(key=>!model.keys.includes(key)))fail('Choose valid permissions.');
   if(input.permissions.some(key=>!model.can(actor,key)))fail('You cannot grant permissions you do not have.',403);
   const permissions=scope==='network'?input.permissions:input.permissions.filter(key=>!model.networkKeys.includes(key));
   if(Object.entries(model.dependencies).some(([key,required])=>permissions.includes(key)&&!permissions.includes(required)))fail('Include the view permission required by each editing permission.');
   const role={id:id||crypto.randomUUID(),name:input.name.trim(),level:input.level,scope,permissions:[...permissions]};
   if(next.levels.some(other=>other.id!==role.id&&other.scope===scope&&other.name.toLowerCase()===role.name.toLowerCase()))fail('That permission-level name already exists.');
   // Publishing to the network replaces company overrides of the same level.
   next.levels=next.levels.filter(other=>!(other.id===role.id&&(scope==='network'||other.scope===scope)));next.levels.push(role);
  }
  preserve(accounts,data,next);next.revision++;await fs.mkdir(dir,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(next,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return next;
 }
 function assertRecovery(accounts,nextAccounts,data){preserve(accounts,data,{...data,levels:data.levels});const before=accounts.some(account=>complete(data.levels.find(role=>role.id===account.role&&role.scope==='network'))),after=nextAccounts.some(account=>complete(data.levels.find(role=>role.id===account.role&&role.scope==='network')));if(before&&!after)fail('Keep at least one Head Office account with full network access.');}
 return{read,locations,decorate,context,change,assertRecovery,authority};
}
module.exports={createStore};
