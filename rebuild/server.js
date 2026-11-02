const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createStore}=require('./store');
const {createSessions}=require('./sessions');
const {createAccounts}=require('./accounts');
const {createLocations}=require('./locations');
const {createAudit}=require('./audit');
const {seed,demoPassword,demoAccounts}=require('./seed');
const access=require('./access');
const permissions=require('./permissions');
const views=require('./views');

const port=Number(process.env.PORT||3001);
const dataDir=process.env.REBUILD_DATA_DIR||path.join(__dirname,'data');
// The preview only helper: shows seeded demo credentials and one-time setup
// links in the UI. Unset in every ordinary deployment.
const previewMode=process.env.BASE44_PREVIEW_MODE==='1';
const secureCookies=/^https:/i.test(process.env.REBUILD_PUBLIC_ORIGIN||'');
const cookieName='rebuild_session';
const cookieMaxAge=28800;
const roleNames={admin:'Head Office',franchisee:'Franchisee',user:'Ordering manager'};

const store=createStore(dataDir);
const sessions=createSessions({store});
const accounts=createAccounts({store});
const locations=createLocations({store});
const audit=createAudit({store});
const grantsTotal=permissions.keys.length+permissions.actionKeys.length;
// Setup links created in this process, shown once to the inviter. Email delivery
// is a later phase; nothing here is persisted or logged.
const setupLinks=new Map();

const fail=(message,status=400)=>Object.assign(Error(message),{status});
const readCookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(part=>part.trim()).filter(Boolean).map(part=>{
 const index=part.indexOf('=');
 return index<0?[part,'']:[part.slice(0,index),decodeURIComponent(part.slice(index+1))];
}));
const sessionCookie=(value,maxAge)=>`${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookies?'; Secure':''}`;
function readBody(req){
 return new Promise((resolve,reject)=>{
  let raw='';
  req.on('data',chunk=>{raw+=chunk;if(raw.length>65536){reject(fail('That request was too large.',413));req.destroy();}});
  req.on('end',()=>{
   const form={};
   for(const [key,value] of new URLSearchParams(raw)){
    if(key==='locationIds')form.locationIds=[...(form.locationIds||[]),value];
    else form[key]=typeof value==='string'?value.slice(0,2048):value;
   }
   resolve(form);
  });
  req.on('error',reject);
 });
}
const send=(res,status,type,body)=>{res.writeHead(status,{'content-type':type,'cache-control':'no-store'});res.end(body);};
const html=(res,status,body)=>send(res,status,'text/html; charset=utf-8',body);
const redirect=(res,location)=>{res.writeHead(303,{location,'cache-control':'no-store'});res.end();};

function identity(account,session,companies){
 const grants=permissions.grants(account);
 return {
  // Plain fields only: password salt, hash and KDF stay out of anything a view
  // can render.
  id:account.id,name:account.name,email:account.email,role:account.role,
  permissions:account.permissions,networkPermissions:account.networkPermissions,actionPermissions:account.actionPermissions||{},
  companyIds:permissions.companyIds(account),locationIds:permissions.locationIds(account),
  csrf:session.csrf,roleName:roleNames[account.role]||'User',grants,
  companyNames:permissions.accessibleCompanies(account,companies).map(company=>company.name).join(', '),
  canInvite:permissions.can(account,'users.manage')&&permissions.can(account,'users.create'),
  canCreateLocation:permissions.can(account,'locations.manage')&&permissions.can(account,'locations.create')
 };
}
function grantGroups(account){
 const counts=new Map();
 for(const item of permissions.definitions)if(permissions.can(account,item.id))counts.set(item.group,(counts.get(item.group)||0)+1);
 for(const item of permissions.actionDefinitions)if(permissions.can(account,item.id))counts.set(item.group,(counts.get(item.group)||0)+1);
 return [...counts].filter(([,count])=>count).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}
function takeSetupLinks(){
 const entries=[...setupLinks.values()];
 setupLinks.clear();
 return entries;
}
function assertCsrf(form,session){
 if(form._csrf!==session.csrf)throw fail('This page has expired. Reload and try again.',403);
}

async function handle(req,res){
 let session=null;
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/healthz')return send(res,200,'application/json; charset=utf-8',JSON.stringify({ok:true,service:'opstack-rebuild',collections:dataDir}));
  if(url.pathname==='/rebuild.css'){
   const css=await fs.readFile(path.join(__dirname,'public','rebuild.css'),'utf8');
   return send(res,200,'text/css; charset=utf-8',css);
  }
  session=await sessions.lookup(readCookies(req)[cookieName]);
  const actor=session?session.account:null;
  const companies=await store.read('companies');
  const viewer=actor?identity(actor,session,companies):null;

  if(url.pathname==='/'&&req.method==='GET'){
   if(viewer)return redirect(res,'/home');
   const notice=url.searchParams.get('ready')?'Your account is ready. Sign in below.':url.searchParams.get('revoked')?'Signed out on every device.':url.searchParams.get('left')?'You are signed out.':'';
   return html(res,200,views.signIn({previewMode,demo:demoAccounts.map(item=>({...item,password:demoPassword})),notice}));
  }
  if(url.pathname==='/sign-in'&&req.method==='POST'){
   const form=await readBody(req);
   try{
    const account=await accounts.signIn(form);
    const issued=await sessions.issue(account);
    await audit(account,'session.started');
    res.setHeader('set-cookie',sessionCookie(issued.token,cookieMaxAge));
    return redirect(res,'/home');
   }catch(error){
    return html(res,error.status||401,views.signIn({previewMode,demo:demoAccounts.map(item=>({...item,password:demoPassword})),error:error.message,email:form.email}));
   }
  }
  // Invitation acceptance is the one write an anonymous visitor may make.
  if(url.pathname==='/accept'&&req.method==='POST'){
   const form=await readBody(req);
   try{
    if(form.password!==form.confirm)throw fail('The passwords do not match.',400);
    const created=await accounts.accept(form.token,form);
    await audit(created,'account.activated');
    return redirect(res,'/?ready=1');
   }catch(error){
    let email='';
    try{email=(await accounts.pending(form.token)).email;}catch{}
    return html(res,error.status||400,views.accept({token:form.token,name:form.name,email,error:error.message}));
   }
  }
  if(!viewer){
   if(url.pathname==='/accept'&&req.method==='GET')return acceptPage(req,res,url);
   return redirect(res,'/');
  }
  if(url.pathname==='/home'&&req.method==='GET'){
   const scopedCompanies=permissions.accessibleCompanies(actor,companies);
   return html(res,200,views.home({account:viewer,companies:scopedCompanies,locations:await locations.list(actor),groups:grantGroups(actor),total:grantsTotal}));
  }
  if(url.pathname==='/users'&&req.method==='GET'){
   const scopedLocations=await locations.list(actor);
   const links=previewMode?takeSetupLinks():[];
   const setupLink=links.length?{email:links[0].email,url:links[0].url}:null;
   return html(res,200,views.users({account:viewer,users:await accounts.list(actor),companies:permissions.accessibleCompanies(actor,companies),locations:scopedLocations,setupLink}));
  }
  if(url.pathname==='/users/invite'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   const {company}=await access.write({store,account:actor,permission:'users.manage',companyId:form.companyId});
   const result=await accounts.invite(actor,{...form,companyId:company.id});
   await audit(actor,'user.invited',{targetId:result.account.id,companyId:company.id});
   setupLinks.set(result.account.invitation.id,{email:result.account.email,url:'/accept?token='+result.token});
   return redirect(res,'/users');
  }
  if(url.pathname==='/locations'&&req.method==='GET'){
   return html(res,200,views.locations({account:viewer,locations:await locations.list(actor),companies:permissions.accessibleCompanies(actor,companies)}));
  }
  if(url.pathname==='/locations'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   const {company}=await access.write({store,account:actor,permission:'locations.manage',companyId:form.companyId});
   const created=await locations.create(actor,{...form,companyId:company.id});
   await audit(actor,'location.created',{locationId:created.id,companyId:company.id});
   return redirect(res,'/locations');
  }
  if(url.pathname==='/sign-out'&&req.method==='POST'){
   assertCsrf(await readBody(req),session);
   await sessions.destroy(session.token);
   res.setHeader('set-cookie',sessionCookie('',0));
   return redirect(res,'/?left=1');
  }
  if(url.pathname==='/sign-out-everywhere'&&req.method==='POST'){
   assertCsrf(await readBody(req),session);
   await accounts.revokeSessions(actor.id);
   await sessions.destroyAll(actor.id);
   await audit(actor,'session.revoked_all');
   res.setHeader('set-cookie',sessionCookie('',0));
   return redirect(res,'/?revoked=1');
  }
  html(res,404,views.message({account:viewer,title:'Page not found',text:'That address is not part of the rebuild yet.',status:404}));
 }catch(error){
  const status=error.status||500;
  if(status>=500)console.error('rebuild request failed',error);
  const companies=await store.read('companies').catch(()=>[]);
  html(res,status,views.message({account:session?identity(session.account,session,companies):null,title:status===403?'Not allowed':status===404?'Not found':'Something went wrong',text:error.message||'Please try again.',status}));
 }
}

async function acceptPage(req,res,url){
 const token=url.searchParams.get('token')||'';
 try{
  const invitation=await accounts.pending(token);
  return html(res,200,views.accept({token,name:invitation.name,email:invitation.email}));
 }catch(error){
  return html(res,error.status||400,views.message({title:'Invitation unavailable',text:error.message,status:error.status||400}));
 }
}

(async()=>{
 const result=await seed(store);
 if(result.seeded)console.log(`Seeded ${result.companies.length} companies, ${result.locations.length} locations and ${result.accounts.length} accounts into ${dataDir}`);
 http.createServer((req,res)=>{
  handle(req,res).catch(error=>{
   console.error('rebuild request crashed',error);
   if(!res.headersSent)html(res,500,views.message({title:'Something went wrong',text:'Please reload and try again.',status:500}));
  });
 }).listen(port,'0.0.0.0',()=>console.log(`Opstack rebuild foundations listening on http://0.0.0.0:${port}`));
})();
