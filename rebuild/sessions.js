// Sessions for the rebuilt app: 8-hour HttpOnly tokens, a per-session CSRF
// secret, and version-bound revocation. Bumping an account's `version`
// invalidates every session it holds, which is how the current app signs a
// changed permission set out immediately.
const crypto=require('node:crypto');
const lifetime=8*60*60*1000;
const digest=token=>crypto.createHash('sha256').update(token).digest('hex');
function createSessions({store,now=Date.now}){
 async function issue(account){
  const token=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomBytes(32).toString('hex'),at=now();
  await store.change('sessions',list=>{
   const live=list.filter(item=>Date.parse(item.expiresAt)>at&&!(item.accountId===account.id&&item.accountVersion!==account.version));
   live.push({id:digest(token),accountId:account.id,accountVersion:account.version,csrf,createdAt:new Date(at).toISOString(),expiresAt:new Date(at+lifetime).toISOString()});
   list.length=0;list.push(...live);
  });
  return {token,csrf};
 }
 async function lookup(token){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
  const id=digest(token),at=now(),session=(await store.read('sessions')).find(item=>item.id===id&&Date.parse(item.expiresAt)>at);
  if(!session)return null;
  const account=(await store.read('accounts')).find(item=>item.id===session.accountId);
  if(!account||account.disabled||account.invitation||account.version!==session.accountVersion)return null;
  return {account,token,csrf:session.csrf,expiresAt:session.expiresAt};
 }
 const destroy=token=>store.change('sessions',list=>{
  const id=digest(token),index=list.findIndex(item=>item.id===id);
  if(index>=0)list.splice(index,1);
 });
 const destroyAll=accountId=>store.change('sessions',list=>{
  for(let index=list.length-1;index>=0;index--)if(list[index].accountId===accountId)list.splice(index,1);
 });
 return {issue,lookup,destroy,destroyAll,lifetime};
}
module.exports={createSessions,lifetime};
