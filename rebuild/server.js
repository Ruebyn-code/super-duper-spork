const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createStore}=require('./store');
const {createSessions}=require('./sessions');
const {createAccounts}=require('./accounts');
const {createLocations}=require('./locations');
const {createAudit}=require('./audit');
const {createCatalogue}=require('./catalogue');
const {createOrdering}=require('./ordering');
const {createStock}=require('./stock');
const {createTransfers}=require('./transfers');
const {createSales}=require('./sales');
const {createInvoices}=require('./invoices');
const {createWorkforce}=require('./workforce');
const {createComms}=require('./comms');
const {createLibrary}=require('./library');
const {createLearning}=require('./learning');
const {createChecklists}=require('./checklists');
const {createReporting}=require('./reporting');
const {createMigration}=require('./migrate');
const {createCutover}=require('./cutover');
const routesSales=require('./routes-sales');
const routesInvoices=require('./routes-invoices');
const routesWorkforce=require('./routes-workforce');
const routesComms=require('./routes-comms');
const routesLearning=require('./routes-learning');
const routesAdmin=require('./routes-admin');
const ledger=require('./ledger');
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
const catalogue=createCatalogue({store});
const ordering=createOrdering({store});
const stockApi=createStock({store});
const transfersApi=createTransfers({store});
const salesApi=createSales({store,dir:dataDir});
const invoicesApi=createInvoices({store});
const workforceApi=createWorkforce({store});
const commsApi=createComms({store});
const libraryApi=createLibrary({store});
const learningApi=createLearning({store});
const checklistsApi=createChecklists({store});
const reportingApi=createReporting({store,sales:salesApi,learning:learningApi,checklists:checklistsApi});
// Phase 7 reads the current app's data directory. It is only ever read unless
// the migration console explicitly applies an import.
const legacyDataDir=process.env.LEGACY_DATA_DIR||path.join(__dirname,'..','data');
const migrationApi=createMigration({store,sourceDir:legacyDataDir});
const cutoverApi=createCutover({store});
const grantsTotal=permissions.keys.length+permissions.actionKeys.length;
// Ordering and stock write routes redirect with one of these codes; the views
// turn the code into a sentence, so no message is ever taken from the URL.
const notices={
 placed:'Order placed. Its prices are saved with it.',
 delivery:'Delivery confirmed and added to stock.',
 counted:'Stock count saved.',
 wasted:'Wastage recorded.',
 sent:'Transfer sent. Stock moves when the other location confirms.',
 received:'Transfer received and added to stock.',
 cancelled:'Transfer cancelled.',
 item:'Stock item saved.',
 'week-saved':'Sales week saved.',
 'report-imported':'Weekly report imported and reconciled.',
 'hourly-saved':'Hourly sales saved.',
 'expense-added':'Operating expense added.',
 'budget-saved':'Budget saved.',
 'invoice-saved':'Invoice saved. Check the price comparison before applying anything.',
 'prices-applied':'Prices applied once and recorded in the invoice history.',
 'shift-saved':'Shift saved as a draft.',
 'shift-removed':'Shift removed.',
 'roster-published':'Week published with frozen costs.',
 'roster-withdrawn':'Publication withdrawn; the week is editable again.',
 clocked:'Clock updated.',
 'timesheet-approved':'Timesheets approved and their pay frozen.',
 'employer-saved':'Employer setup saved.',
 'terms-saved':'Employment terms saved.',
 'availability-saved':'Availability saved.',
 'leave-requested':'Leave requested.',
 'leave-decided':'Leave request decided.',
 'post-created':'Post published.',
 'post-acknowledged':'Thanks — that required post is acknowledged.',
 'message-sent':'Message sent.',
 'category-saved':'Category saved.',
 'article-saved':'Article saved as a draft.',
 'article-published':'Article published.',
 'course-saved':'Course saved as a draft.',
 'course-published':'Course published. Assignments bind to this version.',
 assigned:'Course assigned.',
 'attempt-passed':'Passed. That attempt is complete.',
 'migration-applied':'Migration applied and reconciled.',
 'migration-attention':'Migration applied, but some records need attention before cut-over.',
 'cutover-done':'The current app is retired to read-only.',
 'rollback-done':'Rolled back to rehearsal. The current app is writable again.'
};
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
    // Repeated checkbox fields arrive once per ticked box.
    if(key.endsWith('Ids'))form[key]=[...(form[key]||[]),value];
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
// Ordering and stock forms name each quantity field after its stock item.
function readItems(form){
 return Object.entries(form).filter(([key])=>key.startsWith('quantity:')).map(([key,value])=>({productId:key.slice('quantity:'.length),quantity:Number(value)}));
}
function melbourneToday(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
async function scopeFor(actor,requestedId){
 const list=await locations.list(actor);
 return {locations:list,location:list.find(item=>item.id===requestedId)||list[0]||null};
}
async function stockPage(actor,viewer,locations,location,notice){
 const [products,suppliers,counts,transfers,orders,wastage,movements]=await Promise.all([
  store.read('products'),store.read('suppliers'),
  permissions.can(actor,'counts.view')?stockApi.listCounts(actor).then(list=>list.filter(record=>record.locationId===location.id)):[],
  permissions.can(actor,'transfers.view')?transfersApi.list(actor):[],
  permissions.can(actor,'orders.view')?ordering.listOrders(actor):[],
  permissions.can(actor,'wastage.view')?stockApi.listWastage(actor).then(list=>list.filter(record=>record.locationId===location.id)):[],
  store.read('stock')
 ]);
 const hand=ledger.onHand(movements,location.id);
 const items=products.filter(product=>product.companyId===location.companyId&&!product.archived).map(product=>({
  id:product.id,name:product.name,unit:product.unit||'',
  onHand:Math.max(0,hand.get(product.id)||0)
 }));
 return views.stock({account:viewer,location,locations,items,counts,transfers,orders,wastage,
  suppliers:suppliers.filter(supplier=>supplier.companyId===location.companyId&&!supplier.archived),
  today:melbourneToday(),notice});
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
  // Every later phase's routes share one context: they resolve their own scope
  // through the same access module and never touch the store's files directly.
  const ctx={
   url,req,res,method:req.method,viewer,actor,session,
   services:{store,sales:salesApi,invoices:invoicesApi,workforce:workforceApi,comms:commsApi,library:libraryApi,
    learning:learningApi,checklists:checklistsApi,reporting:reportingApi,migration:migrationApi,cutover:cutoverApi},
   html:(status,body)=>html(res,status,body),
   redirect:location=>redirect(res,location),
   readBody:()=>readBody(req),
   assertCsrf:form=>assertCsrf(form,session),
   scopeFor:id=>scopeFor(actor,id),
   notice:code=>notices[code]||''
  };
  // Required reading is a gate on the rest of the app, not a badge: an
  // unacknowledged required post sends the reader to Comms first.
  if(req.method==='GET'&&!url.pathname.startsWith('/comms')&&!url.pathname.startsWith('/migration')){
   try{await commsApi.assertReadingClear(actor);}
   catch(error){if(error.reading)return redirect(res,'/comms?reading=1');throw error;}
  }
  for(const router of [routesSales,routesInvoices,routesWorkforce,routesComms,routesLearning,routesAdmin]){
   if(await router.route(ctx))return;
  }
  if(url.pathname==='/home'&&req.method==='GET'){
   const scopedCompanies=permissions.accessibleCompanies(actor,companies);
   const work=await workforceApi.summary(actor).catch(()=>null);
   const reading=await commsApi.outstanding(actor).catch(()=>[]);
   return html(res,200,views.home({account:viewer,companies:scopedCompanies,locations:await locations.list(actor),groups:grantGroups(actor),total:grantsTotal,
    work,reading:reading.map(post=>({id:post.id,title:post.title}))}));
  }
  if(url.pathname==='/ordering'&&req.method==='GET'){
   const scope=await scopeFor(actor,url.searchParams.get('locationId'));
   const reference=url.searchParams.get('ref')||'';
   const notice=url.searchParams.get('notice')==='placed'&&reference?`Order ${reference} placed. Its prices are saved with it.`:(notices[url.searchParams.get('notice')]||'');
   if(!scope.location)return html(res,200,views.ordering({account:viewer,location:null,locations:scope.locations,rows:[],window:null,countedWeeks:0,showAll:false,notice}));
   const sheet=await ordering.recommendations(actor,{companyId:scope.location.companyId,locationId:scope.location.id});
   return html(res,200,views.ordering({account:viewer,location:sheet.location,locations:scope.locations,rows:sheet.rows,window:sheet.window,countedWeeks:sheet.countedWeeks,showAll:url.searchParams.get('all')==='1',notice}));
  }
  if(url.pathname==='/ordering/cart'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   const cart=await ordering.review(actor,{companyId:form.companyId,locationId:form.locationId,items:readItems(form),note:form.note});
   return html(res,200,views.cart({account:viewer,location:cart.location,companyId:cart.company.id,lines:cart.lines,totalCents:cart.totalCents,rounded:cart.rounded,hasUnknownPrice:cart.hasUnknownPrice,note:cart.note}));
  }
  if(url.pathname==='/orders'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   const result=await ordering.place(actor,{companyId:form.companyId,locationId:form.locationId,items:readItems(form),note:form.note,requestId:form.requestId});
   return redirect(res,'/ordering?locationId='+encodeURIComponent(result.order.locationId)+'&notice=placed&ref='+encodeURIComponent(result.order.orderNumber));
  }
  if(url.pathname==='/orders/receive'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   const result=await ordering.receiveDelivery(actor,form.orderId);
   return redirect(res,'/stock?locationId='+encodeURIComponent(result.order.locationId)+'&notice=delivery');
  }
  if(url.pathname==='/stock'&&req.method==='GET'){
   permissions.requirePermission(actor,'counts.view');
   const scope=await scopeFor(actor,url.searchParams.get('locationId'));
   if(!scope.location)return html(res,200,views.stock({account:viewer,location:null,locations:scope.locations,items:[],counts:[],transfers:[],orders:[],wastage:[],suppliers:[],today:melbourneToday()}));
   return html(res,200,await stockPage(actor,viewer,scope.locations,scope.location,notices[url.searchParams.get('notice')]||''));
  }
  if(url.pathname==='/stock/counts'&&req.method==='GET'){
   permissions.requirePermission(actor,'counts.view');
   const scope=await scopeFor(actor,url.searchParams.get('locationId'));
   if(!scope.location)return html(res,200,views.countSheet({account:viewer,location:null,locations:scope.locations,items:[],today:melbourneToday()}));
   const location=scope.location;
   const [products,movements]=await Promise.all([store.read('products'),store.read('stock')]);
   const hand=ledger.onHand(movements,location.id);
   const items=products.filter(product=>product.companyId===location.companyId&&!product.archived).map(product=>({
    id:product.id,name:product.name,unit:product.unit||'',supplier:'',onHand:Math.max(0,hand.get(product.id)||0)
   }));
   return html(res,200,views.countSheet({account:viewer,location,locations:scope.locations,items,today:melbourneToday()}));
  }
  if(url.pathname==='/stock/counts'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   await stockApi.saveCount(actor,{companyId:form.companyId,locationId:form.locationId,countDate:form.countDate,note:form.note,items:readItems(form)});
   return redirect(res,'/stock?locationId='+encodeURIComponent(form.locationId)+'&notice=counted');
  }
  if(url.pathname==='/stock/wastage'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   await stockApi.recordWastage(actor,{companyId:form.companyId,locationId:form.locationId,productId:form.productId,quantity:Number(form.quantity),date:form.date,reason:form.reason});
   return redirect(res,'/stock?locationId='+encodeURIComponent(form.locationId)+'&notice=wasted');
  }
  if(url.pathname==='/stock/items'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   await catalogue.saveProduct(actor,{companyId:form.companyId,name:form.name,supplierId:form.supplierId,unit:form.unit,unitPriceCents:Math.round(Number(form.unitPrice)*100),orderRule:form.orderRule,minimumOrder:form.minimumOrder});
   return redirect(res,'/stock?locationId='+encodeURIComponent(form.locationId)+'&notice=item');
  }
  if(url.pathname==='/transfers'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   await transfersApi.send(actor,{companyId:form.companyId,fromLocationId:form.fromLocationId,toLocationId:form.toLocationId,note:form.note,items:[{productId:form.productId,quantity:Number(form.quantity)}]});
   return redirect(res,'/stock?locationId='+encodeURIComponent(form.fromLocationId)+'&notice=sent');
  }
  if(url.pathname==='/transfers/receive'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   const result=await transfersApi.receive(actor,form.transferId);
   return redirect(res,'/stock?locationId='+encodeURIComponent(result.transfer.to.id)+'&notice=received');
  }
  if(url.pathname==='/transfers/cancel'&&req.method==='POST'){
   const form=await readBody(req);
   assertCsrf(form,session);
   const result=await transfersApi.cancel(actor,form.transferId);
   return redirect(res,'/stock?locationId='+encodeURIComponent(result.from.id)+'&notice=cancelled');
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
 if(result.seededOrdering)console.log(`Seeded ${result.products.length} stock items and ${result.counts.length} counts into ${dataDir}`);
 if(result.seededBusiness)console.log(`Seeded the demo sales, invoice, roster, comms and learning history into ${dataDir}`);
 http.createServer((req,res)=>{
  handle(req,res).catch(error=>{
   console.error('rebuild request crashed',error);
   if(!res.headersSent)html(res,500,views.message({title:'Something went wrong',text:'Please reload and try again.',status:500}));
  });
 }).listen(port,'0.0.0.0',()=>console.log(`Opstack rebuild foundations listening on http://0.0.0.0:${port}`));
})();
