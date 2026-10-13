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
const publicAccount=({id,username,role})=>({id,username,role});
function preserveAdmin(accounts,existing,nextRole){if(existing?.role==='admin'&&nextRole!=='admin'&&accounts.filter(a=>a.role==='admin').length===1)throw error('Keep at least one administrator account.');}
async function saveAccount(dir,username,password,role){
 validate({username,password,role},true);
 return mutateAccounts(dir,async accounts=>{const existing=accounts.find(a=>a.username===username.trim());preserveAdmin(accounts,existing,role);const account={id:existing?.id||crypto.randomUUID(),username:username.trim(),role,...await credentials(password),version:crypto.randomUUID()};if(existing)accounts.splice(accounts.indexOf(existing),1,account);else accounts.push(account);});
}
function createAuth(dataDir){
 const sessions=new Map(),attempts=new Map();
 async function session(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('admin_session='))?.slice(14);const entry=sessions.get(token);if(!entry)return null;const account=(await readAccounts(dataDir)).find(a=>a.id===entry.id);if(entry.expires<Date.now()||!account||entry.version!==account.version){sessions.delete(token);return null;}return {...entry,token};}
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
 return {configured:async()=>Boolean((await readAccounts(dataDir)).length),setup:input=>mutateAccounts(dataDir,async accounts=>{if(accounts.length)throw error('Initial setup is already complete.',409);input={...input,role:'admin'};validate(input,true);const account={id:crypto.randomUUID(),username:input.username.trim(),role:'admin',...await credentials(input.password),version:crypto.randomUUID()};accounts.push(account);return publicAccount(account);}),session,login,logout:token=>sessions.delete(token),list:async()=> (await readAccounts(dataDir)).map(publicAccount),
  create:(actor,input)=>manage(actor,async accounts=>{validate(input,true);if(accounts.some(a=>a.username===input.username.trim()))throw error('That username already exists.');const account={id:crypto.randomUUID(),username:input.username.trim(),role:input.role,...await credentials(input.password),version:crypto.randomUUID()};accounts.push(account);return publicAccount(account);}),
  update:(actor,id,input)=>manage(actor,async accounts=>{const account=accounts.find(a=>a.id===id);if(!account)throw error('Account not found.',404);validate(input,false);if(accounts.some(a=>a.id!==id&&a.username===input.username.trim()))throw error('That username already exists.');preserveAdmin(accounts,account,input.role);const changed=account.username!==input.username.trim()||account.role!==input.role||Boolean(input.password);if(input.password)Object.assign(account,await credentials(input.password));Object.assign(account,{username:input.username.trim(),role:input.role});if(changed)account.version=crypto.randomUUID();return publicAccount(account);}),
  remove:(actor,id)=>manage(actor,accounts=>{const account=accounts.find(a=>a.id===id);if(!account)throw error('Account not found.',404);preserveAdmin(accounts,account,null);accounts.splice(accounts.indexOf(account),1);return {removed:true};})};
}
module.exports={createAuth,saveAdmin:(dir,user,password)=>saveAccount(dir,user,password,'admin'),saveUser:(dir,user,password)=>saveAccount(dir,user,password,'user')};
