const crypto=require('node:crypto'),{promisify}=require('node:util');
const scrypt=promisify(crypto.scrypt),policy=require('./public/password-policy');
// OWASP's scrypt N=2^15, r=8, p=3 profile; bounded parallelism limits memory use.
const current='scrypt-v2',options={N:32768,r:8,p:3,maxmem:48*1024*1024},waiting=[];
let running=0;
const failure=(message,status=400)=>Object.assign(Error(message),{status});
async function derive(password,salt,modern=true){
 if(running>=2){if(waiting.length>=32)throw failure('Sign-in is busy. Please try again shortly.',503);await new Promise(resolve=>waiting.push(resolve));}else running++;
 try{return await scrypt(password,salt,64,modern?options:undefined);}finally{const next=waiting.shift();if(next)next();else running--;}
}
function validate(value,identities){const issue=policy.issue(value,identities);if(issue)throw failure(issue);return value;}
async function credentials(password){const salt=crypto.randomBytes(32).toString('hex');return{salt,hash:(await derive(password,salt)).toString('hex'),passwordKdf:current};}
const dummySalt=crypto.randomBytes(32).toString('hex');
async function matches(password,record){
 const valid=typeof password==='string'&&password.length<=256;
 const usable=record&&typeof record.salt==='string'&&record.salt.length<=128&&typeof record.hash==='string'&&/^[a-f0-9]{128}$/.test(record.hash)&&(!record.passwordKdf||record.passwordKdf===current);
 const modern=!usable||record.passwordKdf===current;
 const result=await derive(valid?password:'',usable?record.salt:dummySalt,modern);
 // An absent, corrupt, inactive or legacy account still performs modern work.
 if(!modern&&!crypto.timingSafeEqual(result,Buffer.from(record.hash,'hex')))await derive('',dummySalt);
 return Boolean(valid&&usable&&crypto.timingSafeEqual(result,Buffer.from(record.hash,'hex')));
}
// Both aliases resolve to the same private account counter; reserve before costly work.
async function authenticate({input,read,change,find,now=Date.now,message='Incorrect username or password.'}){
 const initial=find(await read(),input);
 let reserved;
 if(initial)reserved=await change(accounts=>{
  const account=accounts.find(a=>a.id===initial.id);if(!account||account.version!==initial.version||account.hash!==initial.hash)return null;
  const at=now();if(account.passwordAttempts?.until>at&&account.passwordAttempts.count>=10)throw failure('Too many sign-in attempts. Try again in 15 minutes.',429);
  if(!account.passwordAttempts||account.passwordAttempts.until<=at)account.passwordAttempts={count:0,until:at+15*60000};
  account.passwordAttempts.count++;return{...account,passwordAttempts:{...account.passwordAttempts}};
 });
 if(!await matches(input?.password,reserved?.invitation||reserved?.disabled?null:reserved))throw failure(message,401);
 const upgrade=reserved.passwordKdf===current?null:await credentials(input.password);
 return change(accounts=>{
  const account=accounts.find(a=>a.id===reserved.id);
  if(!account||account.version!==reserved.version||account.hash!==reserved.hash||account.invitation||account.disabled)throw failure(message,401);
  if(upgrade)Object.assign(account,upgrade);
  if(account.passwordAttempts?.until===reserved.passwordAttempts.until&&account.passwordAttempts.count===reserved.passwordAttempts.count)delete account.passwordAttempts;
  return{...account};
 });
}
module.exports={credentials,validate,matches,authenticate,current};
