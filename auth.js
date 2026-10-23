const crypto=require('node:crypto');
const {promisify}=require('node:util');
const fs=require('node:fs/promises');
const path=require('node:path');
const scrypt=promisify(crypto.scrypt);
const queues=new Map();
const permissions=require('./permissions');
const invitations=require('./account-invitations');
const networkEmails=require('./network-emails');
const {supportIdentity,isSupport}=require('./platform-identity');
const {ranks,managesUsers,headOffice}=permissions;
const error=(message,status=400)=>Object.assign(new Error(message),{status});
async function passwordHash(password,salt){return (await scrypt(password,salt,64)).toString('hex');}
async function readAccounts(dir){
 try{return JSON.parse(await fs.readFile(path.join(dir,'accounts.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const accounts=[];
 for(const [file,role] of [['admin.json','admin'],['users.json','user']]){
  try{const data=JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));for(const account of role==='admin'?[data]:data)accounts.push({...account,role,id:crypto.createHash('sha256').update(account.username).digest('hex')});}catch(e){if(e.code!=='ENOENT')throw e;}
 }
 return accounts;
}
function mutateAccounts(dir,change){const task=(queues.get(dir)||Promise.resolve()).then(async()=>{const accounts=await readAccounts(dir);const result=await change(accounts);await fs.mkdir(dir,{recursive:true});const file=path.join(dir,'accounts.json');await fs.writeFile(file+'.tmp',JSON.stringify(accounts),{mode:0o600});await fs.rename(file+'.tmp',file);return result;});queues.set(dir,task.catch(()=>{}));return task;}
function validate(input,requiredPassword){
 if(typeof input?.username!=='string'||!input.username.trim()||input.username.length>80)throw error('Enter a username of 1–80 characters.');
 if(!Object.hasOwn(ranks,input.role))throw error('Choose Head Office, Franchisee or Ordering manager.');
 if(requiredPassword||input.password){if(typeof input.password!=='string'||input.password.length<12||input.password.length>256)throw error('Use a password of 12–256 characters.');}
}
function phoneDigits(value){return typeof value==='string'?value.replace(/\D/g,''):'';}
async function phoneClockPin(accounts,account,input){
 if(input.phoneNumber===undefined){if(input.clockPin)throw error('Add a phone number. Clock PINs use its last four digits.');return;}
 const value=typeof input.phoneNumber==='string'?input.phoneNumber.trim():'',digits=phoneDigits(value);
 if(value.length>32||!/^\+?[\d ().-]+$/.test(value)||digits.length<7||digits.length>15)throw error('Enter a valid phone number with 7–15 digits.');
 const pin=digits.slice(-4);
 for(const other of accounts.filter(a=>a.id!==account.id&&a.phoneNumber)){
  const duplicate=phoneDigits(other.phoneNumber).slice(-4)===pin;
  if(duplicate)throw error('These last four digits are already used by another user. Every user needs a phone number with a different ending.',409);
 }
 account.phoneNumber=value;account.clockPin={...await credentials(pin),source:'phone'};delete account.clockPinAttempts;delete account.clockApprovalAttempts;
}
async function credentials(password){const salt=crypto.randomBytes(32).toString('hex');return {salt,hash:await passwordHash(password,salt)};}
const memberships=account=>account.locationIds|| (account.locationId?[account.locationId]:[]);
const publicAccount=account=>({clockPinSet:Boolean(account.clockPin&&account.phoneNumber),...(account.email?{email:account.email}:{}),...(account.invitation?{invitation:{expiresAt:account.invitation.expiresAt,status:account.invitation.status,sentAt:account.invitation.sentAt||null}}:{}),...(account.phoneNumber?{phoneNumber:account.phoneNumber}:{}),id:account.id,username:account.username,role:account.role,...(account.companyRoles?{companyRoles:account.companyRoles}:{}),...(account.roleName?{roleName:account.roleName,roleLevel:account.roleLevel,permissions:account.permissions,networkPermissions:account.networkPermissions}:{}),...(account.locationId?{locationId:account.locationId,locationIds:[...memberships(account)]}:{})});
async function locationAssignment(input,account,checkLocation){
 if(input.locationIds===undefined&&input.locationId===undefined)return {};
 const ids=input.locationIds===undefined?[input.locationId]:input.locationIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw error('Choose at least one location, without duplicates.');
 const locationId=input.locationId===undefined?(ids.includes(account?.locationId)?account.locationId:ids[0]):input.locationId;
 if(!ids.includes(locationId))throw error('The default location must be one of the allowed locations.');
 if(checkLocation)for(const id of ids)await checkLocation(id);
 return {locationId,locationIds:[...ids]};
}
function preserveAdmin(accounts,existing,nextRole){if(existing?.role==='admin'&&nextRole!=='admin'&&accounts.filter(a=>a.role==='admin'&&!a.invitation).length===1)throw error('Keep at least one Head Office account.');}
async function saveAccount(dir,username,password,role){
 validate({username,password,role},true);
 return mutateAccounts(dir,async accounts=>{const existing=accounts.find(a=>a.username===username.trim());preserveAdmin(accounts,existing,role);const account={id:existing?.id||crypto.randomUUID(),username:username.trim(),role,...(existing?.locationId?{locationId:existing.locationId,locationIds:[...memberships(existing)]}:{}),...(existing?.clockPin?{clockPin:existing.clockPin}:{}),...(existing?.phoneNumber?{phoneNumber:existing.phoneNumber}:{}),...await credentials(password),version:crypto.randomUUID()};if(existing)accounts.splice(accounts.indexOf(existing),1,account);else accounts.push(account);});
}
function createAuth(dataDir,{clockNow=Date.now,invitationNow=Date.now,emailRoot}={}){
 const sessions=new Map(),clockUnlocks=new Map(),attempts=new Map(),levels=require('./permission-levels').createStore(dataDir);
 async function snapshots(){return {data:await levels.read(),stores:await levels.locations()};}
 function decorate(account,companyId,snapshot){return levels.decorate(account,companyId||'default',snapshot.data,snapshot.stores);}
 async function forCompany(account,companyId){return levels.context(account,companyId);}
 async function session(req){if(req[supportIdentity])return req[supportIdentity];const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('admin_session='))?.slice(14),entry=sessions.get(token);if(!entry)return null;const account=(await readAccounts(dataDir)).find(a=>a.id===entry.id);if(entry.expires<Date.now()||!account||entry.version!==account.version){sessions.delete(token);clockUnlocks.delete(token);return null;}const snapshot=await snapshots(),locationId=entry.activeLocationId||account.locationId,companyId=snapshot.stores.find(store=>store.id===locationId)?.companyId||'default';return {...entry,...decorate(account,companyId,snapshot),locationId,defaultLocationId:account.locationId,token};}
 async function verifyLogin(input){
  const identity=typeof input?.username==='string'?input.username.trim():'',account=(await readAccounts(dataDir)).find(a=>a.email===identity.toLowerCase()||a.username===identity),password=typeof input?.password==='string'&&input.password.length<=256?input.password:'';
  const hash=Buffer.from(await passwordHash(password,account?.salt||'unconfigured-account'),'hex');if(!account?.hash||account.invitation||!crypto.timingSafeEqual(hash,Buffer.from(account.hash,'hex')))throw error('Incorrect username or password.',401);
  return account;
 }
 async function matchesLogin(input){try{await verifyLogin(input);return true;}catch(error){if(error.status===401)return false;throw error;}}
 async function login(req,input){
  const key=req.socket.remoteAddress,now=Date.now();let rate=attempts.get(key);if(!rate||rate.until<now){rate={count:0,until:now+15*60*1000};attempts.set(key,rate);}if(rate.count>=10)throw error('Too many sign-in attempts. Try again in 15 minutes.',429);rate.count++;
  const account=await verifyLogin(input);
  attempts.delete(key);for(const [token,s] of sessions)if(s.expires<now){sessions.delete(token);clockUnlocks.delete(token);}const token=crypto.randomBytes(32).toString('hex'),entry={...publicAccount(account),csrf:crypto.randomBytes(32).toString('hex'),version:account.version,expires:now+8*60*60*1000};sessions.set(token,entry);return {...entry,token};
 }
 function clockManager(account,actor,snapshot){const context=decorate(account,actor.companyId,snapshot),store=snapshot.stores.find(item=>item.id===actor.locationId&&item.companyId===actor.companyId&&!item.archived);return account.id!==actor.id&&store&&permissions.can(context,'rostering.approve')&&permissions.canAccessLocation(context,store);}
 async function openKiosk(pin,locationId){
  if(typeof pin!=='string'||!/^\d{4}$/.test(pin))throw error('Incorrect staff PIN or no access at this location.',401);
  const accounts=await readAccounts(dataDir),snapshot=await snapshots(),store=snapshot.stores.find(s=>s.id===locationId&&!s.archived),matches=accounts.filter(a=>!a.invitation&&a.phoneNumber&&a.clockPin&&phoneDigits(a.phoneNumber).slice(-4)===pin);
  const account=matches.length===1?matches[0]:null;
  if(!account||!store||!permissions.canAccessLocation(decorate(account,store.companyId,snapshot),store))throw error('Incorrect staff PIN or no access at this location.',401);
  if(account.clockPinAttempts?.until>clockNow()&&account.clockPinAttempts.count>=5)throw error('This PIN is temporarily locked. Try again later.',429);
  const digest=await passwordHash(pin,account.clockPin.salt);if(!crypto.timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(account.clockPin.hash,'hex')))throw error('Incorrect staff PIN or no access at this location.',401);
  const token=crypto.randomBytes(32).toString('hex'),entry={...publicAccount(account),csrf:crypto.randomBytes(32).toString('hex'),version:account.version,activeLocationId:locationId,expires:Date.now()+8*60*60*1000};sessions.set(token,entry);return{...entry,...decorate(account,store.companyId,snapshot),locationId,token};
 }
 function clockStage(actor){return actor.clockEntryId?'entry:'+actor.clockEntryId+':'+actor.clockRevision:'shift:'+actor.companyId+':'+actor.locationId+':'+actor.clockShiftId;}
 function unlocked(actor,account){const grant=clockUnlocks.get(actor.token);return Boolean(grant&&grant.until>clockNow()&&grant.userId===actor.id&&grant.stage===clockStage(actor)&&account?.clockPin?.hash===grant.pinKey);}
 async function clockIdentity(actor){const [accounts,snapshot]=await Promise.all([readAccounts(dataDir),snapshots()]),account=accounts.find(a=>a.id===actor.id),ready=unlocked(actor,account);return{pinSet:Boolean(account?.clockPin&&account.phoneNumber),hasApprover:accounts.some(a=>a.clockPin&&a.phoneNumber&&clockManager(a,actor,snapshot)),clockUnlocked:ready,unlockExpiresAt:ready?new Date(clockUnlocks.get(actor.token).until).toISOString():null};}
 async function verifyClockPin(actor,input,manager=false){
  const result=await mutateAccounts(dataDir,async accounts=>{
   const owner=accounts.find(a=>a.id===actor.id&&a.version===actor.version);if(!owner)return{failure:['Sign in again.',401]};
   const snapshot=await snapshots(),context=decorate(owner,actor.companyId,snapshot);if(!permissions.can(context,'rostering.clock'))return{failure:['Clocking permission required.',403]};
   const at=clockNow(),key=manager?'clockApprovalAttempts':'clockPinAttempts';
   if(!owner[key]||owner[key].until<=at)owner[key]={count:0,until:at+15*60000};
   if(owner[key].count>=5)return{failure:['Too many incorrect PIN attempts. Try again in 15 minutes or ask a manager to reset the PIN.',429]};
   const pin=manager?input.managerPin:input.pin,matches=[];
   if(manager&&input.managerId!==undefined)return{failure:['Managers are identified by PIN. Reload the time clock.',403]};
   const candidates=manager?accounts.filter(a=>a.clockPin&&a.phoneNumber&&clockManager(a,actor,snapshot)):owner.clockPin&&owner.phoneNumber?[owner]:[];
   if(!manager&&!candidates.length)return{failure:['Ask a manager to add your phone number in Users. Your PIN is its last four digits.',409]};
   // Check every eligible manager, using bounded memory, so duplicate PINs never select an arbitrary approver.
   for(const candidate of candidates){const hash=await passwordHash(typeof pin==='string'&&/^\d{4}$/.test(pin)?pin:'',candidate.clockPin.salt);if(crypto.timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(candidate.clockPin.hash,'hex')))matches.push(candidate);}
   if(matches.length!==1){owner[key].count++;return{failure:[matches.length>1?'More than one eligible manager uses this PIN. Give those managers different PINs in Users.':manager?'Incorrect manager PIN or no approval access at this location.':'Incorrect clock PIN.',matches.length>1?409:401]};}
   const target=matches[0];if(manager&&target.clockPinAttempts?.until>at&&target.clockPinAttempts.count>=5)return{failure:['This manager’s PIN is temporarily locked. Try again later or use another manager’s PIN.',429]};
   delete owner[key];return{id:target.id,username:target.username,pinKey:target.clockPin.hash};
  });
  if(result.failure)throw error(...result.failure);return result;
 }
 async function unlockClock(actor,input){const verified=await verifyClockPin(actor,input);if(!sessions.has(actor.token))throw error('Sign in again.',401);const until=clockNow()+5*60000;clockUnlocks.set(actor.token,{userId:actor.id,stage:clockStage({...actor,clockShiftId:input.shiftId,clockEntryId:input.entryId,clockRevision:input.revision}),pinKey:verified.pinKey,until});return{clockUnlocked:true,unlockExpiresAt:new Date(until).toISOString()};}
 async function authorizeClock(actor,input){
  if(input.pin!==undefined)return verifyClockPin(actor,input);
  const account=(await readAccounts(dataDir)).find(a=>a.id===actor.id&&a.version===actor.version);
  if(!unlocked({...actor,clockShiftId:input.shiftId,clockEntryId:input.entryId,clockRevision:input.revision},account))throw error('Enter your PIN to unlock this clock stage.',401);
 }
 function canManage(manager,target,snapshot){
  const current=decorate(target,manager.companyId,snapshot);if(!managesUsers(manager)||!permissions.canAssign(manager,current))return false;
  const network=snapshot.data.levels.find(role=>role.id===target.role&&role.scope==='network');if(network&&permissions.networkKeys.some(key=>network.permissions.includes(key)&&!permissions.can(manager,key)))return false;
  const ids=memberships(target);if(!ids.length)return permissions.can(manager,'network.access')&&headOffice(manager);
  return ids.every(id=>{const store=snapshot.stores.find(store=>store.id===id);if(!store)return false;const actorContext=decorate(manager,store.companyId,snapshot),targetContext=decorate(target,store.companyId,snapshot);return managesUsers(actorContext)&&permissions.canAssign(actorContext,targetContext)&&permissions.canAccessLocation(actorContext,store);});
 }
 async function photoAccess(actor,id,write=false){
  const accounts=await readAccounts(dataDir),raw=isSupport(actor)?actor:accounts.find(a=>a.id===actor.id&&a.version===actor.version),target=accounts.find(a=>a.id===id);if(!raw)throw error('Sign in again.',401);if(!target)throw error('Profile photo not found.',404);
  const snapshot=await snapshots(),manager=decorate(raw,actor.companyId,snapshot);if(!isSupport(actor)&&target.id===actor.id)return true;
  if(write){if(!canManage(manager,target,snapshot))throw error('You cannot manage this user or their locations.',403);return true;}
  if(canManage(manager,target,snapshot))return true;
  const companies=new Set(snapshot.stores.filter(store=>!store.archived&&permissions.canAccessLocation(decorate(raw,store.companyId,snapshot),store)).map(store=>store.companyId));
  return snapshot.stores.some(store=>!store.archived&&companies.has(store.companyId)&&permissions.canAccessLocation(decorate(target,store.companyId,snapshot),store));
 }
 const withEmails=change=>emailRoot?networkEmails.run(emailRoot,dataDir,change):change(async()=>{});
 function manage(actor,change,roleChange=false){return withEmails(checkEmail=>mutateAccounts(dataDir,async accounts=>{const raw=isSupport(actor)?actor:accounts.find(a=>a.id===actor.id&&a.version===actor.version);if(!raw)throw error('User management permission required.',403);const snapshot=await snapshots(),manager=decorate(raw,actor.companyId||snapshot.stores.find(store=>store.id===actor.locationId)?.companyId,snapshot);if(!permissions.can(manager,roleChange?'roles.manage':'users.manage'))throw error('User management permission required.',403);return change(accounts,manager,snapshot,checkEmail);}));}
 function candidate(manager,input,snapshot){const companyId=input.companyId||manager.companyId,network=input.companyId===undefined||input.roleScope==='network',definition=snapshot.data.levels.find(role=>role.id===input.role&&role.scope===(network?'network':companyId))||snapshot.data.levels.find(role=>role.id===input.role&&role.scope==='network');if(!definition)throw error('Choose an available permission level.');return {definition,network,companyId,subject:{role:definition.id,roleLevel:definition.level,permissions:definition.permissions,networkPermissions:network?definition.permissions:[]}};}
 function requireAssignable(manager,input,assignment,snapshot){const selection=candidate(manager,input,snapshot);if(!permissions.canAssign(manager,selection.subject))throw error('You cannot assign a permission level higher than your own or grant access you do not have.',403);if(input.companyId&&input.companyId!==manager.companyId)throw error('Switch company before assigning its permission levels.',403);for(const id of assignment.locationIds||[]){const store=snapshot.stores.find(store=>store.id===id),context=store&&decorate(manager,store.companyId,snapshot);if(!store||!managesUsers(context)||!permissions.canAccessLocation(context,store))throw error('Choose only locations you can manage.',403);}if(!assignment.locationIds?.length&&!permissions.can(manager,'network.access'))throw error('Choose at least one location.',403);return selection;}
 function validateRoleInput(input,required){validate({...input,role:'user'},required);}
 function applyRole(account,input,selection){if(selection.network){account.role=input.role;delete account.companyRoles;}else{account.companyRoles={...account.companyRoles,[selection.companyId]:input.role};}}
 function uniqueEmail(accounts,value,id){const email=invitations.email(value);if(accounts.some(account=>account.id!==id&&(account.email===email||account.username.toLowerCase()===email)))throw error('An account already uses this email address.',409);return email;}
 async function invite(actor,input,checkLocation){return manage(actor,async(accounts,manager,snapshot,checkEmail)=>{
  if(!input||typeof input!=='object'||input.password!==undefined)throw error('New users choose their password from the invitation email.');
  validateRoleInput(input,false);const email=uniqueEmail(accounts,input.email),assignment=await locationAssignment(input,null,checkLocation),selection=requireAssignable(manager,input,assignment,snapshot);
  if(accounts.some(account=>account.username===input.username.trim()||account.email===input.username.trim().toLowerCase()))throw error('That name is already used. Choose a different display name.');
  await checkEmail(email);await checkEmail(input.username);
  const {token,record}=invitations.issue(invitationNow()),account={id:crypto.randomUUID(),username:input.username.trim(),email,role:'user',...assignment,invitation:record,version:crypto.randomUUID()};
  if(input.phoneNumber)await phoneClockPin(accounts,account,input);applyRole(account,input,selection);
  if(!canManage(manager,account,snapshot))throw error('The resulting account would have access above your own in another company.',403);
  accounts.push(account);return{account:publicAccount(decorate(account,manager.companyId,snapshot)),token,invitationId:record.id};
 });}
 async function resendInvitation(actor,id){return manage(actor,(accounts,manager,snapshot)=>{
  const account=accounts.find(account=>account.id===id);if(!account||!canManage(manager,account,snapshot))throw error('User invitation not found.',404);
  if(!account.invitation||account.hash)throw error('This user has already set up their account.',409);
  if(account.invitation.tokenHash&&account.invitation.status!=='failed'&&invitationNow()-Date.parse(account.invitation.createdAt)<60000)throw error('Wait one minute before resending this invitation.',429);
  const {token,record}=invitations.issue(invitationNow());account.invitation=record;
  return{account:publicAccount(decorate(account,manager.companyId,snapshot)),token,invitationId:record.id};
 });}
 async function invitationDelivered(id,invitationId,result){return mutateAccounts(dataDir,accounts=>{
  const account=accounts.find(account=>account.id===id);if(account?.invitation?.id===invitationId){account.invitation.status=result.status;if(result.status==='sent')account.invitation.sentAt=new Date(invitationNow()).toISOString();}
  return account?publicAccount(account):null;
 });}
 async function invitationInfo(token){const account=invitations.find(await readAccounts(dataDir),token,invitationNow());return{username:account.username,email:account.email,expiresAt:account.invitation.expiresAt};}
 async function acceptInvitation(input){
  if(!input||typeof input!=='object'||Object.keys(input).some(key=>!['token','password','confirmPassword'].includes(key)))throw error('Invalid account setup request.');
  if(typeof input.password!=='string'||input.password.length<12||input.password.length>256)throw error('Use a password of 12–256 characters.');
  if(input.confirmPassword!==input.password)throw error('The passwords do not match.');
  return mutateAccounts(dataDir,async accounts=>{const account=invitations.find(accounts,input.token,invitationNow());Object.assign(account,await credentials(input.password),{version:crypto.randomUUID(),emailVerifiedAt:new Date(invitationNow()).toISOString()});delete account.invitation;return{email:account.email};});
 }
 const managerAssignments=require('./location-managers').create({readAccounts:()=>readAccounts(dataDir),snapshots,decorate,canManage,manage,requireAssignable,applyRole,assertRecovery:levels.assertRecovery});
 return {...managerAssignments,photoAccess,openKiosk,invite,resendInvitation,invitationDelivered,invitationInfo,acceptInvitation,initializeLocations:change=>mutateAccounts(dataDir,change),configured:async()=>Boolean((await readAccounts(dataDir)).length),setup:input=>withEmails(checkEmail=>mutateAccounts(dataDir,async accounts=>{if(accounts.length)throw error('Initial setup is already complete.',409);input={...input,role:'admin'};validate(input,true);await checkEmail(input.username);const account={id:crypto.randomUUID(),username:input.username.trim(),role:'admin',...await credentials(input.password),version:crypto.randomUUID()};accounts.push(account);return publicAccount(account);})),session,login,forCompany,levels,clockIdentity,verifyClockPin,unlockClock,authorizeClock,
  selectLocation:(actor,id,checkLocation)=>isSupport(actor)?actor[supportIdentity].selectLocation(id,checkLocation):mutateAccounts(dataDir,async accounts=>{const account=accounts.find(account=>account.id===actor.id&&account.version===actor.version),entry=sessions.get(actor.token);if(!account||!entry)throw error('Sign in again.',401);const location=await checkLocation(id),context=await forCompany(account,location.companyId||'default');if(!permissions.canAccessLocation(context,location))throw error('You do not have access to this location.',403);entry.activeLocationId=id;if(location.companyId)(entry.companyLocations||={})[location.companyId]=id;return id;}),logout:token=>{clockUnlocks.delete(token);return sessions.delete(token);},
  directory:async()=>(await readAccounts(dataDir)).map(publicAccount),matchesLogin,
  managerDirectory:async()=>(await readAccounts(dataDir)).map(a=>({...publicAccount(a),managedLocationIds:[...(a.managedLocationIds||[])]})),
  list:async actor=>{const snapshot=await snapshots();return (await readAccounts(dataDir)).filter(account=>!actor||canManage(actor,account,snapshot)).map(account=>publicAccount(decorate(account,actor?.companyId||snapshot.stores.find(store=>store.id===account.locationId)?.companyId,snapshot)));},
  permissionLevels:async actor=>{const snapshot=await snapshots(),accounts=await readAccounts(dataDir),policyActor=levels.authority(actor,snapshot.data),resolved=new Map();for(const role of snapshot.data.levels.filter(role=>role.scope==='network'))resolved.set(role.id,role);for(const role of snapshot.data.levels.filter(role=>role.scope===actor.companyId))resolved.set(role.id,role);return{revision:snapshot.data.revision,definitions:permissions.definitions,levels:[...resolved.values()].map(role=>({...role,networkDefault:snapshot.data.levels.some(other=>other.id===role.id&&other.scope==='network'),assigned:accounts.filter(account=>(account.companyRoles?.[actor.companyId]||account.role)===role.id).length,editable:permissions.canAssign(policyActor,{role:role.id,roleLevel:role.level,permissions:role.permissions,networkPermissions:[]}),assignable:permissions.canAssign(actor,{role:role.id,roleLevel:role.level,permissions:role.permissions,networkPermissions:[]}),networkAssignable:role.scope==='network'&&permissions.canAssign(actor,{roleLevel:role.level,permissions:role.permissions,networkPermissions:role.permissions})})),canManage:permissions.can(actor,'roles.manage'),canNetwork:permissions.can(actor,'roles.network'),maxLevel:permissions.level(policyActor),grantablePermissions:permissions.grants(policyActor)};},
  changePermissionLevel:(actor,input,method,id)=>manage(actor,async(accounts,manager,snapshot)=>{const companyLocationIds=snapshot.stores.filter(store=>store.companyId===manager.companyId).map(store=>store.id);return levels.change(manager,accounts,{...input,companyLocationIds},method,id);},true),
  create:(actor,input,checkLocation)=>manage(actor,async(accounts,manager,snapshot,checkEmail)=>{validateRoleInput(input,true);const assignment=await locationAssignment(input,null,checkLocation),selection=requireAssignable(manager,input,assignment,snapshot);if(accounts.some(a=>a.username===input.username.trim()||a.email===input.username.trim().toLowerCase()))throw error('That username already exists.');await checkEmail(input.username);const account={id:crypto.randomUUID(),username:input.username.trim(),role:'user',...assignment,...await credentials(input.password),version:crypto.randomUUID()};await phoneClockPin(accounts,account,input);applyRole(account,input,selection);if(!canManage(manager,account,snapshot))throw error('The resulting account would have access above your own in another company.',403);accounts.push(account);return publicAccount(decorate(account,manager.companyId,snapshot));}),
  addLocation:(actor,id,locationId,checkLocation)=>manage(actor,async(accounts,manager,snapshot)=>{
   const account=accounts.find(a=>a.id===id),store=snapshot.stores.find(s=>s.id===locationId&&s.companyId===manager.companyId&&!s.archived);
   if(!account||account.invitation||!canManage(manager,account,snapshot))throw error('Choose an active user you can manage.',403);
   if(!store||!permissions.canAccessLocation(manager,store))throw error('Choose a location you can manage.',403);await checkLocation(locationId);
   if(permissions.canAccessLocation(decorate(account,store.companyId,snapshot),store))return publicAccount(decorate(account,manager.companyId,snapshot));
   const ids=[...new Set([...memberships(account),locationId])];if(ids.length>500)throw error('This user already has the maximum number of locations.');const next={...account,locationIds:ids};
   if(!canManage(manager,next,snapshot))throw error('You cannot grant this user access at that location.',403);
   account.locationIds=ids;account.version=crypto.randomUUID();return publicAccount(decorate(account,manager.companyId,snapshot));
  }),
  update:(actor,id,input,checkLocation)=>manage(actor,async(accounts,manager,snapshot,checkEmail)=>{const account=accounts.find(a=>a.id===id);if(!account)throw error('Account not found.',404);if(!canManage(manager,account,snapshot))throw error('You cannot manage this user or their locations.',403);validateRoleInput(input,false);const assignment=await locationAssignment(input,account,checkLocation),selection=requireAssignable(manager,input,{locationIds:memberships(account),...assignment},snapshot);if(accounts.some(a=>a.id!==id&&(a.username===input.username.trim()||a.email===input.username.trim().toLowerCase())))throw error('That username already exists.');const next={...account,username:input.username.trim(),...assignment};if(account.invitation&&input.password)throw error('This user must choose their password from their invitation.');if(input.email!==undefined&&input.email!==account.email){if(!permissions.can(manager,'users.email.manage'))throw error('User email management permission required.',403);next.email=uniqueEmail(accounts,input.email,id);delete next.emailVerifiedAt;if(next.invitation)next.invitation={...next.invitation,tokenHash:null,status:'pending',expiresAt:new Date(invitationNow()).toISOString()};}if(input.preserveRole!==true){applyRole(next,input,selection);if(next.managerPermissionGrants){next.managerPermissionGrants={...next.managerPermissionGrants};if(selection.network)delete next.managerPermissionGrants;else delete next.managerPermissionGrants[selection.companyId];}}if(!canManage(manager,next,snapshot))throw error('The resulting account would have access above your own in another company.',403);levels.assertRecovery(accounts,accounts.map(a=>a.id===id?next:a),snapshot.data);if(next.email!==account.email)await checkEmail(next.email);if(next.username!==account.username)await checkEmail(next.username);const changed=next.email!==account.email||next.username!==account.username||next.role!==account.role||JSON.stringify(next.companyRoles||{})!==JSON.stringify(account.companyRoles||{})||next.locationId!==account.locationId||JSON.stringify([...memberships(next)].sort())!==JSON.stringify([...memberships(account)].sort())||Boolean(input.password);await phoneClockPin(accounts,next,input);if(input.phoneNumber!==undefined){delete account.clockPinAttempts;delete account.clockApprovalAttempts;}if(input.password)Object.assign(next,await credentials(input.password));if(changed)next.version=crypto.randomUUID();if(account.email!==next.email)delete account.emailVerifiedAt;Object.assign(account,next);if(!next.companyRoles)delete account.companyRoles;if(!next.managerPermissionGrants)delete account.managerPermissionGrants;return publicAccount(decorate(account,manager.companyId,snapshot));}),
  remove:(actor,id)=>manage(actor,(accounts,manager,snapshot)=>{const account=accounts.find(a=>a.id===id);if(!account)throw error('Account not found.',404);if(!canManage(manager,account,snapshot))throw error('You cannot manage this user or their locations.',403);levels.assertRecovery(accounts,accounts.filter(a=>a.id!==id),snapshot.data);accounts.splice(accounts.indexOf(account),1);return{removed:true};})};
}
module.exports={credentials,createAuth,saveAdmin:(dir,user,password)=>saveAccount(dir,user,password,'admin'),saveUser:(dir,user,password)=>saveAccount(dir,user,password,'user')};
