const crypto=require('node:crypto');
const {promisify}=require('node:util');
const fs=require('node:fs/promises');
const path=require('node:path');
const scrypt=promisify(crypto.scrypt);
const queues=new Map();
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
 if(!['admin','user'].includes(input.role))throw error('Choose Administrator or Ordering user.');
 if(requiredPassword||input.password){if(typeof input.password!=='string'||input.password.length<12||input.password.length>256)throw error('Use a password of 12–256 characters.');}
}
async function credentials(password){const salt=crypto.randomBytes(32).toString('hex');return {salt,hash:await passwordHash(password,salt)};}
const memberships=account=>account.locationIds|| (account.locationId?[account.locationId]:[]);
const publicAccount=account=>({id:account.id,username:account.username,role:account.role,...(account.locationId?{locationId:account.locationId,locationIds:[...memberships(account)]}:{})});
async function locationAssignment(input,account,checkLocation){
 if(input.locationIds===undefined&&input.locationId===undefined)return {};
 const ids=input.locationIds===undefined?[input.locationId]:input.locationIds;
 if(!Array.isArray(ids)||!ids.length||ids.length>500||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw error('Choose at least one location, without duplicates.');
 const locationId=input.locationId===undefined?(ids.includes(account?.locationId)?account.locationId:ids[0]):input.locationId;
 if(!ids.includes(locationId))throw error('The default location must be one of the allowed locations.');
 if(checkLocation)for(const id of ids)await checkLocation(id);
 return {locationId,locationIds:[...ids]};
}
function preserveAdmin(accounts,existing,nextRole){if(existing?.role==='admin'&&nextRole!=='admin'&&accounts.filter(a=>a.role==='admin').length===1)throw error('Keep at least one administrator account.');}
async function saveAccount(dir,username,password,role){
 validate({username,password,role},true);
 return mutateAccounts(dir,async accounts=>{const existing=accounts.find(a=>a.username===username.trim());preserveAdmin(accounts,existing,role);const account={id:existing?.id||crypto.randomUUID(),username:username.trim(),role,...(existing?.locationId?{locationId:existing.locationId,locationIds:[...memberships(existing)]}:{}),...await credentials(password),version:crypto.randomUUID()};if(existing)accounts.splice(accounts.indexOf(existing),1,account);else accounts.push(account);});
}
function createAuth(dataDir){
 const sessions=new Map(),attempts=new Map();
 async function session(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('admin_session='))?.slice(14);const entry=sessions.get(token);if(!entry)return null;const account=(await readAccounts(dataDir)).find(a=>a.id===entry.id);if(entry.expires<Date.now()||!account||entry.version!==account.version){sessions.delete(token);return null;}return {...entry,...publicAccount(account),locationId:entry.activeLocationId||account.locationId,token};}
 async function login(req,input){
  const key=req.socket.remoteAddress,now=Date.now();let rate=attempts.get(key);if(!rate||rate.until<now){rate={count:0,until:now+15*60*1000};attempts.set(key,rate);}if(rate.count>=10)throw error('Too many sign-in attempts. Try again in 15 minutes.',429);rate.count++;
  const account=(await readAccounts(dataDir)).find(a=>a.username===input?.username);
  const password=typeof input?.password==='string'&&input.password.length<=256?input.password:'';
  const hash=Buffer.from(await passwordHash(password,account?.salt||'unconfigured-account'),'hex');
  if(!account||!crypto.timingSafeEqual(hash,Buffer.from(account.hash,'hex')))throw error('Incorrect username or password.',401);
  attempts.delete(key);for(const [token,s] of sessions)if(s.expires<now)sessions.delete(token);
  const token=crypto.randomBytes(32).toString('hex');const entry={...publicAccount(account),csrf:crypto.randomBytes(32).toString('hex'),version:account.version,expires:now+8*60*60*1000};sessions.set(token,entry);return {...entry,token};
 }
 function manage(actor,change){return mutateAccounts(dataDir,async accounts=>{if(!accounts.some(a=>a.id===actor.id&&a.version===actor.version&&a.role==='admin'))throw error('Administrator permission required.',403);return change(accounts);});}
 return {initializeLocations:change=>mutateAccounts(dataDir,change),configured:async()=>Boolean((await readAccounts(dataDir)).length),setup:input=>mutateAccounts(dataDir,async accounts=>{if(accounts.length)throw error('Initial setup is already complete.',409);input={...input,role:'admin'};validate(input,true);const account={id:crypto.randomUUID(),username:input.username.trim(),role:'admin',...await credentials(input.password),version:crypto.randomUUID()};accounts.push(account);return publicAccount(account);}),session,login,selectLocation:(actor,id,checkLocation)=>mutateAccounts(dataDir,async accounts=>{const account=accounts.find(account=>account.id===actor.id&&account.version===actor.version);const entry=sessions.get(actor.token);if(!account||!entry)throw error('Sign in again.',401);if(!memberships(account).includes(id))throw error('You do not have access to this location.',403);await checkLocation(id);entry.activeLocationId=id;return id;}),logout:token=>sessions.delete(token),list:async()=> (await readAccounts(dataDir)).map(publicAccount),
  create:(actor,input,checkLocation)=>manage(actor,async accounts=>{validate(input,true);const assignment=await locationAssignment(input,null,checkLocation);if(accounts.some(a=>a.username===input.username.trim()))throw error('That username already exists.');const account={id:crypto.randomUUID(),username:input.username.trim(),role:input.role,...assignment,...await credentials(input.password),version:crypto.randomUUID()};accounts.push(account);return publicAccount(account);}),
  update:(actor,id,input,checkLocation)=>manage(actor,async accounts=>{const account=accounts.find(a=>a.id===id);if(!account)throw error('Account not found.',404);validate(input,false);const assignment=await locationAssignment(input,account,checkLocation);if(accounts.some(a=>a.id!==id&&a.username===input.username.trim()))throw error('That username already exists.');preserveAdmin(accounts,account,input.role);const changed=account.username!==input.username.trim()||account.role!==input.role||Boolean(input.password)||(assignment.locationId!==undefined&&(account.locationId!==assignment.locationId||JSON.stringify([...memberships(account)].sort())!==JSON.stringify([...assignment.locationIds].sort())));if(input.password)Object.assign(account,await credentials(input.password));Object.assign(account,{username:input.username.trim(),role:input.role,...assignment});if(changed)account.version=crypto.randomUUID();return publicAccount(account);}),
  remove:(actor,id)=>manage(actor,accounts=>{const account=accounts.find(a=>a.id===id);if(!account)throw error('Account not found.',404);preserveAdmin(accounts,account,null);accounts.splice(accounts.indexOf(account),1);return {removed:true};})};
}
module.exports={createAuth,saveAdmin:(dir,user,password)=>saveAccount(dir,user,password,'admin'),saveUser:(dir,user,password)=>saveAccount(dir,user,password,'user')};
