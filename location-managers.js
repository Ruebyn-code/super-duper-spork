const crypto=require('node:crypto'),permissions=require('./permissions');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function create({readAccounts,snapshots,decorate,canManage,manage,requireAssignable,applyRole,assertRecovery}){
 const ids=account=>account.managedLocationIds||[];
 function target(snapshot,actor,id){const store=snapshot.stores.find(s=>s.id===id);if(!store||!permissions.canAccessLocation(actor,store))fail('Location not found.',404);return store;}
 const eligible=(account,store,snapshot)=>!account.invitation&&permissions.canAccessLocation(decorate(account,store.companyId||'default',snapshot),store);
 const revision=(accounts,snapshot)=>crypto.createHash('sha256').update(JSON.stringify({roles:snapshot.data.revision,accounts:accounts.map(a=>({id:a.id,version:a.version,managedLocationIds:ids(a),companyRoles:a.companyRoles,role:a.role}))})).digest('hex');
 function config(accounts,actor,snapshot,store){
  const allowed=!store.archived&&permissions.can(actor,'locations.manage')&&permissions.can(actor,'users.manage');
  const person=account=>{const context=decorate(account,store.companyId||'default',snapshot);return{id:account.id,username:account.username,roleName:context.roleName,canAssign:allowed&&canManage(actor,account,snapshot)};};
  const managers=accounts.filter(a=>ids(a).includes(store.id)&&eligible(a,store,snapshot)).map(person);
  const resolved=new Map();for(const role of snapshot.data.levels.filter(r=>r.scope==='network'))resolved.set(role.id,role);for(const role of snapshot.data.levels.filter(r=>r.scope===actor.companyId))resolved.set(role.id,role);
  return{revision:revision(accounts,snapshot),managers,canManage:allowed,candidates:allowed?accounts.filter(a=>eligible(a,store,snapshot)&&canManage(actor,a,snapshot)).map(person):[],levels:allowed?[...resolved.values()].filter(role=>permissions.canAssign(actor,{roleLevel:role.level,permissions:role.permissions,networkPermissions:[]})).map(({id,name,level})=>({id,name,level})):[]};
 }
 async function locationManagers(actor,id){const snapshot=await snapshots(),context=decorate(actor,actor.companyId,snapshot),store=target(snapshot,context,id);if(!permissions.any(context,['locations.manage','users.manage','email.manage']))fail('Location settings permission required.',403);return config(await readAccounts(),context,snapshot,store);}
 const assignLocationManagers=(actor,id,input)=>manage(actor,async(accounts,manager,snapshot)=>{
  const store=target(snapshot,manager,id);if(store.archived||!permissions.can(manager,'locations.manage'))fail('Location and user management permissions are required.',403);
  if(input?.revision!==revision(accounts,snapshot))fail('Users or manager assignments changed. Reload managers before saving.',409);
  if(!Array.isArray(input.userIds)||input.userIds.length>100||input.userIds.some(id=>typeof id!=='string'||!id)||new Set(input.userIds).size!==input.userIds.length)fail('Choose managers without duplicates.');
  const selected=new Set(input.userIds),next=structuredClone(accounts),companyId=store.companyId||'default';
  for(const id of selected){const account=accounts.find(a=>a.id===id);if(!account||!eligible(account,store,snapshot))fail('Choose existing users with access to this location.');}
  for(const account of next){const was=ids(account).includes(store.id),added=selected.has(account.id);if(!was&&!added)continue;
   if(!canManage(manager,account,snapshot)){if(was&&added)continue;fail('You cannot manage this user or their locations.',403);}
   account.managedLocationIds=added?[...new Set([...ids(account),store.id])]:ids(account).filter(value=>value!==store.id);
   const beforeRoles=JSON.stringify(account.companyRoles||{});
   if(added){const selection=requireAssignable(manager,{role:input.roleId,companyId},{locationIds:permissions.locationIds(account)},snapshot),current=decorate(account,companyId,snapshot);
    // Existing broader access is retained; assigning a manager never downgrades a user.
    if(!selection.definition.permissions.every(key=>permissions.can(current,key))){if(!permissions.grants(current).every(key=>selection.definition.permissions.includes(key)))fail('Choose a manager level that includes this user’s current permissions.');
     account.managerPermissionGrants||={};account.managerPermissionGrants[companyId]||={previousCompanyRole:account.companyRoles?.[companyId]??null};account.managerPermissionGrants[companyId].roleId=input.roleId;applyRole(account,{role:input.roleId,companyId},selection);
    }
   }else if(!account.managedLocationIds.some(value=>snapshot.stores.some(s=>s.id===value&&(s.companyId||'default')===companyId&&!s.archived))){const grant=account.managerPermissionGrants?.[companyId];if(grant){if(account.companyRoles?.[companyId]===grant.roleId){account.companyRoles={...account.companyRoles};if(grant.previousCompanyRole&&snapshot.data.levels.some(r=>r.id===grant.previousCompanyRole&&(r.scope==='network'||r.scope===companyId)))account.companyRoles[companyId]=grant.previousCompanyRole;else delete account.companyRoles[companyId];}delete account.managerPermissionGrants[companyId];}}
   if(JSON.stringify(account.companyRoles||{})!==beforeRoles)account.version=crypto.randomUUID();
   if(!canManage(manager,account,snapshot))fail('The resulting account would have access above your own.',403);
  }
  assertRecovery(accounts,next,snapshot.data);accounts.splice(0,accounts.length,...next);return config(accounts,manager,snapshot,store);
 });
 return{locationManagers,assignLocationManagers};
}
module.exports={create};
