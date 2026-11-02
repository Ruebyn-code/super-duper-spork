// Accounts, sign-in and invitations for the rebuilt app.
//
// Sign-in reuses the app's existing password work (public/password-policy.js +
// password-security.js): scrypt v2 hashing, policy validation, attempt limits
// and legacy hash upgrades all behave exactly as they do today. Invitation
// tokens are issued and hashed by account-invitations.js, so only the hash is
// ever stored.
const crypto=require('node:crypto');
const passwordSecurity=require('../password-security');
const invitations=require('../account-invitations');
const permissions=require('./permissions');
const roles=['admin','franchisee','user'];
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const name=value=>{
 if(typeof value!=='string'||!value.trim()||value.trim().length>100)fail('Enter a name of 1–100 characters.');
 return value.trim();
};
const defaultsFor=role=>[...permissions.defaults.find(item=>item.id===role).permissions];
function createAccounts({store,now=Date.now}){
 const visible=account=>({
  id:account.id,name:account.name,email:account.email,role:account.role,roleLevel:permissions.level(account),
  grants:permissions.grants(account),actionPermissions:account.actionPermissions||{},
  companyIds:permissions.companyIds(account),locationIds:permissions.locationIds(account),
  disabled:Boolean(account.disabled),pending:Boolean(account.invitation),createdAt:account.createdAt,
  invitation:account.invitation?{id:account.invitation.id,expiresAt:account.invitation.expiresAt}:null
 });
 async function signIn(input){
  const email=typeof input?.email==='string'?input.email.trim().toLowerCase():'';
  return passwordSecurity.authenticate({
   input:{email,password:input?.password},
   read:()=>store.read('accounts'),
   change:fn=>store.change('accounts',fn),
   find:(accounts,target)=>accounts.find(account=>account.email===target.email),
   now,
   message:'Incorrect email or password.'
  });
 }
 // Users the actor may see: same company, and a location they can reach.
 async function list(actor){
  const [accounts,locations]=await Promise.all([store.read('accounts'),store.read('locations')]);
  const reachable=permissions.accessibleLocations(actor,locations).map(location=>location.id);
  return accounts
   .filter(account=>account.id!==actor.id&&permissions.companyIds(account).some(id=>permissions.companyIds(actor).includes(id))&&(account.locationIds||[]).some(id=>reachable.includes(id)))
   .map(visible);
 }
 async function invite(actor,input){
  const email=invitations.email(input?.email),displayName=name(input.name),role=roles.includes(input.role)?input.role:'user',companyId=input.companyId;
  const locationIds=(Array.isArray(input.locationIds)?input.locationIds:[]).filter(id=>typeof id==='string');
  if(!locationIds.length)fail('Choose at least one location for this user.');
  permissions.requirePermission(actor,'users.manage');
  permissions.requirePermission(actor,'users.create');
  const [companies,locations]=await Promise.all([store.read('companies'),store.read('locations')]);
  const company=permissions.company(actor,companyId,companies);
  for(const id of locationIds){
   if(permissions.location(actor,id,locations).companyId!==company.id)fail('All locations must belong to the selected company.',409);
  }
  const candidate={role,permissions:defaultsFor(role),actionPermissions:{},companyIds:[company.id],locationIds};
  if(!permissions.canAssign(actor,candidate))fail('You cannot grant permissions you do not hold yourself.',403);
  const issued=invitations.issue(now());
  const account=await store.change('accounts',accounts=>{
   if(accounts.some(item=>item.email===email))fail('A user already uses this email.',409);
   const record={id:crypto.randomUUID(),name:displayName,email,role,permissions:candidate.permissions,actionPermissions:{},companyIds:[company.id],locationIds:locationIds.slice(),version:crypto.randomUUID(),invitation:issued.record,createdAt:new Date(now()).toISOString()};
   accounts.push(record);
   return visible(record);
  });
  return {account,token:issued.token};
 }
 async function pending(token){
  const account=invitations.find(await store.read('accounts'),token,now());
  if(account.disabled)fail('This invitation is no longer available.');
  return {name:account.name,email:account.email,expiresAt:account.invitation.expiresAt};
 }
 async function accept(token,input){
  const displayName=name(input?.name);
  const credentials=await passwordSecurity.credentials(passwordSecurity.validate(input?.password,[displayName]));
  return store.change('accounts',accounts=>{
   const account=invitations.find(accounts,token,now());
   if(account.disabled)fail('This invitation is no longer available.');
   const invitation=account.invitation;
   Object.assign(account,{name:displayName,...credentials});
   delete account.invitation;
   // A different version refuses any session issued before the password existed.
   account.version=crypto.randomUUID();
   account.acceptedAt=new Date(now()).toISOString();
   account.invitedAt=invitation.createdAt;
   return visible(account);
  });
 }
 async function revokeSessions(accountId){
  return store.change('accounts',accounts=>{
   const account=accounts.find(item=>item.id===accountId);
   if(!account)fail('User not found.',404);
   account.version=crypto.randomUUID();
   return visible(account);
  });
 }
 return {signIn,list,invite,pending,accept,revokeSessions,visible};
}
module.exports={createAccounts,roles,defaultsFor};
