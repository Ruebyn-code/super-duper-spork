const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const platformStore=require('./opstack-store'),accountEmails=require('./account-email-settings'),invitations=require('./account-invitations');
const publicFiles=require('./public-files'),newNetworkDefaults=require('./new-network-defaults');
const monthlyReports=require('./opstack-monthly-reports');
const {supportIdentity,parsedBody}=require('./platform-identity');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(part=>{const at=part.indexOf('=');return[part.slice(0,at).trim(),part.slice(at+1)];}).filter(([name])=>name));
function createPlatformServer(root,options,createNetworkServer){
 const store=platformStore.createStore(root,{now:options.invitationNow,passwordNow:options.passwordNow||Date.now}),sessions=new Map(),reserveAttempt=require('./login-limiter')({now:options.passwordNow||Date.now}),services=new Map();
 const origin=req=>options.publicOrigin||`http${req.socket.encrypted?'s':''}://${req.headers.host}`;
 const cookie=(req,name,value,maxAge=28800)=>`${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${origin(req).startsWith('https:')?'; Secure':''}`;
 const addCookie=(res,value)=>res.setHeader('Set-Cookie',[...(res.getHeader('Set-Cookie')||[]),value]);
 async function session(req){const token=cookies(req).opstack_session,entry=sessions.get(token);if(!entry)return null;const account=await store.account(entry.id,entry.version);if(entry.expires<=Date.now()||!account){sessions.delete(token);return null;}return{...entry,account,token};}
 function actor(entry,network){return{id:'opstack-'+entry.id,username:entry.account.username+' (Opstack)',role:'admin',roleName:'Opstack support',roleLevel:100,csrf:entry.csrf,token:entry.token,version:entry.version,locationId:entry.locations[network.id],companyLocations:entry.companyLocations[network.id]||{},[supportIdentity]:{platformRole:entry.account.role,selectLocation:async(id,check)=>{const location=await check(id);entry.locations[network.id]=id;(entry.companyLocations[network.id]||={})[location.companyId]=id;return id;}}};}
 function service(network){if(!services.has(network.id)){const server=createNetworkServer(store.folder(network),{...options,platformDataDir:root,platformStore:store,network});services.set(network.id,server);}return services.get(network.id);}
 const primary=service({id:'default',slug:'default',name:'Existing network',active:true});
 async function body(req,limit=16000){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)fail('Request is too large.',413);}try{return JSON.parse(raw);}catch{fail('Invalid JSON.');}}
 function trusted(req){if(req.headers['content-type']!=='application/json'||(req.headers.origin&&req.headers.origin!==origin(req)))fail('Invalid request origin or content type.',403);}
 function rate(req,kind,max){return reserveAttempt(kind+':'+req.socket.remoteAddress,max);}
 async function discoverNetwork(input){
  const identity=typeof input?.username==='string'?input.username.trim():'',candidates=[];
  for(const network of (await store.summary()).networks.filter(network=>network.active)){
   const people=await service(network).networkServices.auth.directory();
   if(people.some(person=>!person.invitation&&(person.email===identity.toLowerCase()||person.username===identity)))candidates.push(network);
  }
  const matches=[];for(const network of candidates)if(await service(network).networkServices.auth.matchesLogin(input))matches.push(network);
  if(!candidates.length)await primary.networkServices.auth.matchesLogin(input);
  if(!matches.length)fail('Incorrect username or password.',401);
  if(matches.length>1)fail('These sign-in details belong to more than one network. Enter your network code to continue.',409);
  return matches[0];
 }
 const goCardless=require('./opstack-gocardless').createStore(root,{fetchImpl:options.fetchImpl,now:options.goCardlessNow||Date.now,publicOrigin:options.publicOrigin,
  ownerActive:async(id,version)=>version?(await store.account(id,version))?.role==='owner':(await store.summary()).accounts.some(a=>a.id===id&&a.role==='owner'&&!a.disabled&&!a.pending),
  locations:async()=>{const result=[];for(const network of (await store.summary()).networks){let values;try{values=JSON.parse(await fs.readFile(path.join(store.folder(network),'locations.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;values=[];}for(const location of values)result.push({id:location.id,name:location.name,networkId:network.id,networkName:network.name,archived:Boolean(location.archived)});}return result;}
 });
 async function deliver(req,issued,company,inviter,network,setupPath){const delivery=await invitations.send({...issued,origin:origin(req),company,inviter,network,setupPath},{env:await accountEmails.read(root),fetchImpl:options.fetchImpl});return delivery;}
 const server=http.createServer(async(req,res)=>{
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  try{
   const url=new URL(req.url,'http://localhost'),route=url.pathname;
   if(cookies(req).opstack_kiosk&&(/^\/api\/opstack\//.test(route)||route==='/opstack'))fail('The Opstack console is not available on a paired kiosk.',403);
   if(options.migrationMode||route==='/healthz')return primary.emit('request',req,res);
   const gcWebhook=route.match(/^\/api\/opstack\/gocardless\/webhook\/(sandbox|live)$/);if(gcWebhook){if(req.method!=='POST')fail('Unsupported webhook action.',405);let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>512000)fail('Webhook is too large.',413);chunks.push(chunk);}await goCardless.webhook(gcWebhook[1],Buffer.concat(chunks),req.headers['webhook-signature']);res.writeHead(204,{'Cache-Control':'no-store'});return res.end();}
   if(publicFiles[route]&&!publicFiles[route].endsWith('.html'))return primary.emit('request',req,res);
   if(req.method==='GET'&&url.searchParams.get('platform')==='1'&&(['/logo','/sidebar-logo','/interface-text','/element-overrides','/font-library','/layouts'].includes(route)||(route==='/appearance'&&url.searchParams.get('console')==='1')))return primary.emit('request',req,res);
   const entry=await session(req);
   if(route==='/api/kiosk/pair'&&req.method==='POST'&&entry)res.once('finish',()=>{if(res.statusCode===200)sessions.delete(entry.token);});
   if(route==='/opstack'||route==='/opstack/accept-invite'){
    if(req.method!=='GET')fail('Unsupported action.',405);res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});return res.end(await fs.readFile(path.join(__dirname,'public/opstack.html')));
   }
   if(route.startsWith('/api/opstack/')){
    if(req.method==='GET'&&route==='/api/opstack/session')return json(200,{configured:await store.enabled(),...(entry?{account:{id:entry.id,username:entry.account.username,email:entry.account.email,role:entry.account.role},csrf:entry.csrf}:{})});
    if(req.method==='POST'&&route==='/api/opstack/login'){
     trusted(req);const limit=rate(req,'login',10);let account;try{account=await store.verify(await body(req));limit.success();}catch(error){limit.failure();throw error;}
     const token=crypto.randomBytes(32).toString('hex'),created={id:account.id,version:account.version,csrf:crypto.randomBytes(32).toString('hex'),expires:Date.now()+8*3600000,locations:{},companyLocations:{}};sessions.set(token,created);addCookie(res,cookie(req,'opstack_session',token));addCookie(res,cookie(req,'opstack_support','',0));await store.audit(account,'signed.in');return json(200,{signedIn:true});
    }
    if(req.method==='POST'&&/^\/api\/opstack\/invitations\/(inspect|accept)$/.test(route)){
     trusted(req);const limit=rate(req,'invitations',40);try{const input=await body(req),result=route.endsWith('/inspect')?await store.inspect(input?.token):await store.accept(input);limit.success();return json(200,result);}catch(error){if(error.status<500)limit.failure();throw error;}
    }
    if(!entry)fail('Sign in with your Opstack account.',401);
    if(!['GET','HEAD'].includes(req.method)){trusted(req);if(req.headers['x-csrf-token']!==entry.csrf)fail('Invalid session token. Sign in again.',403);}
    const account=entry.account,owner=account.role==='owner';
    if(route==='/api/opstack/logout'&&req.method==='POST'){sessions.delete(entry.token);addCookie(res,cookie(req,'opstack_session','',0));addCookie(res,cookie(req,'opstack_support','',0));await store.audit(account,'signed.out');return json(200,{signedOut:true});}
    if(route==='/api/opstack/leave'&&req.method==='POST'){addCookie(res,cookie(req,'opstack_support','',0));await store.audit(account,'network.closed');return json(200,{closed:true});}
    if(route==='/api/opstack/networks'&&req.method==='GET'){const summary=await store.summary();return json(200,{networks:summary.networks.map(network=>({...network,signInUrl:origin(req)+'/login?network='+encodeURIComponent(network.slug)}))});}
    const networkRoute=route.match(/^\/api\/opstack\/networks\/([a-z0-9-]+)(?:\/(open|invitation))?$/);
    if(networkRoute){const network=await store.network(networkRoute[1]);if(!network)fail('Network not found.',404);
     if(req.method==='POST'&&networkRoute[2]==='open'){if(!network.active)fail('Activate this network before opening it.',409);const input=await body(req);addCookie(res,cookie(req,'opstack_support',network.id));await store.audit(account,'network.opened',{networkId:network.id});return json(200,{url:input.appearance&&owner?'/admin/settings?platform=1#colours':'/home'});}
    }
    if(!owner)fail('Opstack owner access required.',403);
    if(route==='/api/opstack/gocardless'&&req.method==='GET')return json(200,await goCardless.settings(account,url.searchParams.get('environment')||'sandbox'));
    if(route==='/api/opstack/gocardless'&&req.method==='PUT'){const result=await goCardless.save(account,await body(req));await store.audit(account,'gocardless.settings.updated',{environment:result.environment,enabled:result.enabled});return json(200,result);}
    if(route==='/api/opstack/gocardless/links'&&req.method==='PUT'){const result=await goCardless.link(account,await body(req,512000));await store.audit(account,'gocardless.links.updated',{environment:result.environment});return json(200,result);}
    if(route==='/api/opstack/gocardless/sync'&&req.method==='POST'){const input=await body(req);if(!/^[a-f0-9-]{36}$/i.test(input?.requestId||''))fail('Choose a valid sync reference.');return json(202,await goCardless.start(account,input.environment,input.requestId));}
    if(route==='/api/opstack/monthly-report'&&req.method==='GET'){const result=await monthlyReports.report(root,(await store.summary()).networks,url.searchParams.get('month')||undefined);return json(200,{...result,collections:await goCardless.report(result.month,url.searchParams.get('collectionEnvironment')||'live')});}
    const feeRoute=route.match(/^\/api\/opstack\/monthly-report\/fees\/([a-f0-9-]+|default)\/([a-zA-Z0-9-]{1,100})$/);
    if(feeRoute&&req.method==='PUT'){const input=await body(req);await monthlyReports.saveFee(root,(await store.summary()).networks,feeRoute[1],feeRoute[2],input);await store.audit(account,'report.fee.updated',{networkId:feeRoute[1],locationId:feeRoute[2],month:input.month});return json(200,{saved:true});}
    if(route==='/api/opstack/monthly-report/expenses'&&req.method==='PUT'){const input=await body(req,128000),saved=await monthlyReports.saveExpenses(root,input);await store.audit(account,'report.expenses.updated',{month:input.month});return json(200,saved);}
    if(route==='/api/opstack/networks'&&req.method==='POST'){
     invitations.sender(await accountEmails.read(root));const issued=await store.createNetwork(account,await body(req)),network=issued.network,delivery=await deliver(req,issued,network.name,account.username,network.slug);await service(network).networkServices.auth.invitationDelivered(issued.account.id,issued.invitationId,delivery);return json(201,{network,delivery});
    }
    if(networkRoute&&req.method==='PUT'&&!networkRoute[2])return json(200,await store.updateNetwork(account,networkRoute[1],await body(req)));
    if(networkRoute?.[2]==='invitation'&&req.method==='POST'){
     invitations.sender(await accountEmails.read(root));const network=await store.network(networkRoute[1]),auth=service(network).networkServices.auth,identity=actor(entry,network),issued=await auth.resendInvitation(identity,network.ownerId),delivery=await deliver(req,issued,network.name,account.username,network.slug);await auth.invitationDelivered(issued.account.id,issued.invitationId,delivery);await store.audit(account,'network.invitation.resent',{networkId:network.id});return json(200,{delivery});
    }
    if(route==='/api/opstack/accounts'&&req.method==='GET')return json(200,{accounts:(await store.summary()).accounts});
    if(route==='/api/opstack/accounts'&&req.method==='POST'){invitations.sender(await accountEmails.read(root));const issued=await store.invite(account,await body(req)),delivery=await deliver(req,issued,'Opstack platform',account.username,undefined,'/opstack/accept-invite');await store.delivered(issued.account.id,issued.invitationId,delivery);return json(201,{account:issued.account,delivery});}
    const accountRoute=route.match(/^\/api\/opstack\/accounts\/([a-f0-9-]+)(\/invitation)?$/);
    if(accountRoute&&req.method==='PUT'&&!accountRoute[2])return json(200,await store.updateAccount(account,accountRoute[1],await body(req)));
    if(accountRoute?.[2]&&req.method==='POST'){invitations.sender(await accountEmails.read(root));const issued=await store.resend(account,accountRoute[1]),delivery=await deliver(req,issued,'Opstack platform',account.username,undefined,'/opstack/accept-invite');await store.delivered(issued.account.id,issued.invitationId,delivery);return json(200,{delivery});}
    if(route==='/api/opstack/account-email-settings'){
     if(req.method==='GET')return json(200,accountEmails.summary(await accountEmails.read(root)));
     if(req.method==='PUT'){const settings=await accountEmails.save(root,await body(req));await store.audit(account,'account.emails.updated');return json(200,settings);}
    }
    if(route==='/api/opstack/new-network-defaults'){if(req.method==='GET')return json(200,await newNetworkDefaults.read(root));if(req.method==='PUT'){const saved=await newNetworkDefaults.save(root,await body(req));await store.audit(account,'network.defaults.updated');return json(200,saved);}}
    if(route==='/api/opstack/activity'&&req.method==='GET')return json(200,{events:await store.activity()});
    fail('Opstack action not found.',404);
   }
   const sharedSignIn=req.method==='GET'&&route==='/login'&&!url.searchParams.has('network');
   const pairedNetwork=cookies(req).opstack_kiosk?.match(/^([-a-zA-Z0-9]+)\.[a-f0-9]{64}$/)?.[1];
   let network=await store.network(pairedNetwork||(sharedSignIn?'default':cookies(req).opstack_network||'default'));
   if(sharedSignIn&&cookies(req).opstack_support)addCookie(res,cookie(req,'opstack_support','',0));
   const normalLogin=req.method==='POST'&&route==='/api/login';
   if(normalLogin){
    if(req.headers.origin&&req.headers.origin!==origin(req))fail('Invalid request origin.',403);const limit=rate(req,'network-login',10);res.once('finish',()=>{if(res.statusCode===200)limit.success();else limit.failure();});req[parsedBody]=await body(req);
    if(req[parsedBody]?.network){if(typeof req[parsedBody].network!=='string')fail('Check your network code.',400);network=await store.network(req[parsedBody].network.trim().toLowerCase());if(!network)fail('Check your network code.',404);}
    else if(req[parsedBody]?.autoNetwork===true)network=await discoverNetwork(req[parsedBody]);
    if(network){const selected=network,writeHead=res.writeHead;res.writeHead=function(status,...args){if(status===200){addCookie(res,cookie(req,'opstack_network',selected.id,365*86400));addCookie(res,cookie(req,'opstack_support','',0));}return writeHead.call(this,status,...args);};}
   }
   if(url.searchParams.has('network')){
    if(!['/login','/accept-invite','/kiosk'].includes(route)||req.method!=='GET')fail('Choose a network from its sign-in link.',400);
    network=await store.network(url.searchParams.get('network'));if(!network)fail('Network not found.',404);
    if(cookies(req).opstack_network!==network.id){addCookie(res,cookie(req,'opstack_network',network.id,365*86400));addCookie(res,cookie(req,'admin_session','',0));}
    addCookie(res,cookie(req,'opstack_support','',0));
   }else if(!pairedNetwork&&cookies(req).opstack_support&&!normalLogin&&!sharedSignIn){
    if(!entry)fail('Opstack support session expired. Return to the Opstack console.',401);
    network=await store.network(cookies(req).opstack_support);if(!network)fail('Network not found.',404);
    req[supportIdentity]=actor(entry,network);
   }
   if(!network)fail('Network not found.',404);
   if(route!=='/api/login'&&req.headers['x-opstack-network']&&req.headers['x-opstack-network']!==network.id)fail('The selected network changed. Reload this page before continuing.',409);
   if(!network.active&&!sharedSignIn&&!['/api/session','/api/logout'].includes(route))fail('This network is currently suspended. Contact Opstack support.',503);
   if(req[supportIdentity]&&route==='/api/logout'&&req.method==='POST'){trusted(req);if(req.headers['x-csrf-token']!==entry.csrf)fail('Invalid session token.',403);addCookie(res,cookie(req,'opstack_support','',0));return json(200,{signedOut:true});}
   if(req[supportIdentity]&&route.startsWith('/api/')&&!['GET','HEAD'].includes(req.method)){const requestPath=route;res.on('finish',()=>{store.audit(entry.account,'network.action',{networkId:network.id,method:req.method,path:requestPath,status:res.statusCode}).catch(()=>{});});}
   req.opstackNetwork=network;return service(network).emit('request',req,res);
  }catch(error){if(!res.headersSent)json(error.status||500,{error:error.status?error.message:'Unable to complete the Opstack request. Please try again.'});else res.end();}
 });
 let schedulerTimer,schedulerFlight,stopping=false;
 server.runScheduledReports=()=>{if(stopping||options.migrationMode)return Promise.resolve({processed:0});if(schedulerFlight)return schedulerFlight;const task=(async()=>{let processed=0;for(const network of (await store.summary()).networks.filter(item=>item.active)){if(stopping)break;const result=await service(network).networkServices.reportStore.tick();processed+=result.processed;}return{processed};})();schedulerFlight=task;return task.finally(()=>{schedulerFlight=null;});};
 server.on('listening',()=>{if(options.reportScheduler===false||options.migrationMode)return;const tick=()=>server.runScheduledReports().catch(()=>console.error('Scheduled report check failed; check report configuration and server storage.'));schedulerTimer=setInterval(tick,60000);schedulerTimer.unref();tick();});
 let gcTimer;server.runGoCardlessSync=()=>goCardless.tick();server.waitForGoCardlessSync=()=>goCardless.wait();server.goCardless=goCardless;
 server.on('listening',()=>{if(options.goCardlessScheduler===false||options.migrationMode)return;const tick=()=>goCardless.tick().catch(()=>console.error('GoCardless sync check failed; check the owner console.'));gcTimer=setInterval(tick,60000);gcTimer.unref();tick();});
 server.on('close',()=>{stopping=true;clearInterval(schedulerTimer);clearInterval(gcTimer);goCardless.stop();});
 server.platformStore=store;return server;
}
module.exports={createPlatformServer};
