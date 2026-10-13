const crypto=require('node:crypto');
const {promisify}=require('node:util');
const fs=require('node:fs/promises');
const path=require('node:path');
const scrypt=promisify(crypto.scrypt);
async function passwordHash(password,salt){return (await scrypt(password,salt,64)).toString('hex');}
async function saveAccount(dataDir,username,password,role){
 if(typeof username!=='string'||!username.trim()||username.length>80||typeof password!=='string'||password.length<12||password.length>256)throw Error('Use a username and a password of 12–256 characters.');
 const otherFile=path.join(dataDir,role==='admin'?'users.json':'admin.json');
 try{const other=JSON.parse(await fs.readFile(otherFile,'utf8'));if(role==='admin'?other.some(u=>u.username===username.trim()):other.username===username.trim())throw Error('That username belongs to a different permission level. Choose a different username.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const salt=crypto.randomBytes(32).toString('hex');
 const account={username:username.trim(),salt,hash:await passwordHash(password,salt),version:crypto.randomUUID()};
 await fs.mkdir(dataDir,{recursive:true});if(role==='admin'){const target=path.join(dataDir,'admin.json');await fs.writeFile(target+'.tmp',JSON.stringify(account),{mode:0o600});await fs.rename(target+'.tmp',target);}else{const target=path.join(dataDir,'users.json');let users=[];try{users=JSON.parse(await fs.readFile(target,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}users=users.filter(u=>u.username!==account.username);users.push(account);await fs.writeFile(target+'.tmp',JSON.stringify(users),{mode:0o600});await fs.rename(target+'.tmp',target);}
}
function createAuth(dataDir){
 const sessions=new Map();const attempts=new Map();
 async function account(username,role){const file=role==='admin'?'admin.json':'users.json';try{const data=JSON.parse(await fs.readFile(path.join(dataDir,file),'utf8'));return role==='admin'?data:data.find(u=>u.username===username);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async function session(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('admin_session='))?.slice(14);const entry=sessions.get(token);if(!entry)return null;const admin=await account(entry.username,entry.role);if(entry.expires<Date.now()||!admin||entry.version!==admin.version){sessions.delete(token);return null;}return {...entry,token};}
 async function login(req,input){
 const key=req.socket.remoteAddress;const now=Date.now();let rate=attempts.get(key);if(!rate||rate.until<now){rate={count:0,until:now+15*60*1000};attempts.set(key,rate);}if(rate.count>=10){const e=Error('Too many sign-in attempts. Try again in 15 minutes.');e.status=429;throw e;}rate.count++;
 let role='admin';let admin=await account(input?.username,'admin');if(!admin||admin.username!==input?.username){role='user';admin=await account(input?.username,'user');}if(!admin){await passwordHash(typeof input?.password==='string'&&input.password.length<=256?input.password:'','unconfigured-account');const e=Error('Incorrect username or password.');e.status=401;throw e;}
 const password=typeof input?.password==='string'&&input.password.length<=256?input.password:'';
 const hash=Buffer.from(await passwordHash(password,admin.salt),'hex');
 if(input?.username!==admin.username||!crypto.timingSafeEqual(hash,Buffer.from(admin.hash,'hex'))){const e=Error('Incorrect username or password.');e.status=401;throw e;}
 attempts.delete(key);for(const [token,s] of sessions)if(s.expires<now)sessions.delete(token);
 const token=crypto.randomBytes(32).toString('hex');const entry={username:admin.username,role,csrf:crypto.randomBytes(32).toString('hex'),version:admin.version,expires:now+8*60*60*1000};sessions.set(token,entry);return {...entry,token};
 }
 return {session,login,logout:token=>sessions.delete(token)};
}
module.exports={createAuth,saveAdmin:(dir,user,password)=>saveAccount(dir,user,password,'admin'),saveUser:(dir,user,password)=>saveAccount(dir,user,password,'user')};
