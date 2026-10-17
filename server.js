const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {createAuth}=require('./auth');
const {headOffice,managesUsers,locationIds,can,any:canAny,canAccessLocation}=require('./permissions');
const {apiPermission,pagePermission}=require('./access-routes');
const companies=require('./companies'),catalogues=require('./catalogue-store'),customisations=require('./company-customisations');
const {defaults,validateSettings,saveAppearance,readAppearance}=require('./appearance');
const {validateDelivery,providerStatus,dispatchOrder}=require('./order-delivery');
const deliverySettings=require('./delivery-settings');
const orderEmailTemplates=require('./order-email-templates');
const {splitBySupplier}=require('./supplier-orders');
const interfaceText=require('./interface-text');
const elementOverrides=require('./element-overrides');
const layouts=require('./layouts'),layoutModel=require('./public/layout-model');
const uploadedFonts=require('./uploaded-fonts');
const appearanceStyles=require('./public/appearance-style');const editParts=require('./public/edit-parts');
const stockCounts=require('./stock-counts');
const stockCountGroups=require('./public/stock-count-groups');
const manualPar=require('./manual-par');
const stockUsage=require('./stock-usage');
const sales=require('./sales');
const weeklySalesReports=require('./weekly-sales-reports'),weeklySalesOverview=require('./weekly-sales-overview'),operatingExpenseTypes=require('./operating-expense-types'),operatingExpenseSchedule=require('./operating-expense-schedule');
const reporting=require('./reporting'),reportingDetails=require('./reporting-details');
const locations=require('./locations');
const invoices=require('./invoices');
const communications=require('./communications'),communicationRoutes=require('./communications-routes');
const knowledgeLibrary=require('./knowledge-library'),knowledgeLibraryRoutes=require('./knowledge-library-routes');
const awardCompliance=require('./award-compliance');
const rostering=require('./rostering'),rosteringRoutes=require('./rostering-routes');
const {belongs}=require('./location-scope');
const menu = [
  {id:'paper',name:'A4 copy paper',category:'Office',price:650,emoji:'📄',description:'500 sheets · 80 gsm',sku:'OFF-001',stock:12},
  {id:'pens',name:'Black ballpoint pens',category:'Office',price:1200,emoji:'🖊️',description:'Box of 12 · medium point',sku:'OFF-002',stock:4},
  {id:'boxes',name:'Shipping boxes',category:'Packaging',price:2800,emoji:'📦',description:'Pack of 25 · 30 × 20 × 15 cm',sku:'PKG-001',stock:8},
  {id:'tape',name:'Packing tape',category:'Packaging',price:1800,emoji:'🧻',description:'Pack of 6 · 48 mm × 50 m',sku:'PKG-002',stock:3},
  {id:'gloves',name:'Nitrile gloves',category:'Safety',price:1500,emoji:'🧤',description:'Box of 100 · medium · powder free',sku:'SAF-001',stock:6},
  {id:'vest',name:'High visibility vest',category:'Safety',price:1400,emoji:'🦺',description:'Each · yellow · one size',sku:'SAF-002',stock:20}
];
function validateOrder(body, menu, requester = '') {
  if (!body || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > menu.length) throw Error('Add at least one stock item.');
  const requesterName=body.name===undefined?requester:body.name;
  if (typeof requesterName !== 'string' || !requesterName.trim() || requesterName.length > 80) throw Error('Invalid requester name.');
  if (body.phone !== undefined && (typeof body.phone !== 'string' || (body.phone !== '' && !/^[+\d ()-]{6,30}$/.test(body.phone)))) throw Error('Invalid contact number.');
  if (body.location !== undefined && (typeof body.location !== 'string' || body.location.length > 200)) throw Error('Invalid delivery location.');
  const seen = new Set();
  const items = body.items.map(item => {
    if (!item || typeof item !== 'object') throw Error('Invalid order items.');
    const product = menu.find(p => p.id === item.id);
    if (!product || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw Error('Invalid order items.');
    seen.add(item.id);
    return {id:product.id,name:product.name,supplierId:product.supplierId,supplier:product.supplier,quantity:item.quantity,price:product.price};
  });
  return {id:crypto.randomUUID(),name:requesterName.trim(),phone:typeof body.phone === 'string' ? body.phone.trim() : '',notes:typeof body.notes === 'string' ? body.notes.slice(0,500) : '',items,total:items.reduce((sum,i)=>sum+i.price*i.quantity,0),createdAt:new Date().toISOString(),pricePending:items.some(i=>i.price===null),status:'requested',location:typeof body.location === 'string' ? body.location.slice(0,200) : ''};
}
function createServer(dataDir = path.join(__dirname,'data'),{fetchImpl,communicationsNow=Date.now,rosteringNow=Date.now}={}) {
  const auth=createAuth(dataDir,{clockNow:rosteringNow});
  const locationStore=locations.createStore(dataDir,auth);
  const companyStore=companies.createStore(dataDir,locationStore);
  async function communicationPeople(){const [accounts,stores,levels]=await Promise.all([auth.directory(),auth.levels.locations(),auth.levels.read()]),companyIds=[...new Set(stores.filter(store=>!store.archived).map(store=>store.companyId||'default'))];return accounts.map(account=>{const context=auth.levels.decorate(account,stores.find(store=>store.id===account.locationId)?.companyId||'default',levels,stores);return{id:account.id,username:account.username,companyIds:can(context,'network.access')?companyIds:[...new Set(stores.filter(store=>!store.archived&&locationIds(account).includes(store.id)).map(store=>store.companyId||'default'))]};});}
  const libraryStore=knowledgeLibrary.createStore(dataDir);
  // Rich editors share private media URLs; library access is checked against article audiences.
  const communicationStore=communications.createStore(dataDir,{people:communicationPeople,now:communicationsNow,extraMediaAccess:libraryStore.canReadMedia});
  const catalogueStore=catalogues.createStore(dataDir,menu);
  const usageHistory=stockUsage.createReader();
  const salesStore=sales.createStore();
  const awardStore=awardCompliance.createStore(dataDir,{people:()=>auth.directory(),locations:()=>auth.levels.locations(),now:rosteringNow,fetchImpl});
  const rosteringStore=rostering.createStore(dataDir,{unlockClockPin:(actor,input)=>auth.unlockClock(actor,input),authorizeClock:(actor,input)=>auth.authorizeClock(actor,input),clockIdentity:actor=>auth.clockIdentity(actor),verifyClockPin:(actor,input,manager)=>auth.verifyClockPin(actor,input,manager),locations:actor=>locationStore.accessible(actor),awards:awardStore,people:()=>auth.directory(),forecast:(actor,weekStart)=>{const current=sales.currentWeek(new Date(rosteringNow())),anchor=weekStart<current?weekStart:current;return Promise.all([1,2,3,4].map(index=>sales.read(dataDir,actor,stockUsage.shift(anchor,-7*index))));},now:rosteringNow});
  const weeklySalesReportStore=weeklySalesReports.createStore();
  const manualParStore=manualPar.createStore();
  function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
  async function body(req,limit=16000){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)fail('Request is too large.',413);}try{return JSON.parse(raw);}catch{fail('Invalid JSON.');}}
  function name(value,label,max=100){if(typeof value !== 'string'||!value.trim()||value.length>max)fail('Enter a valid '+label+'.');return value.trim();}
  const assets=new Map(),platformDir=path.join(dataDir,'platform-appearance');
  async function readLogo(dir,sidebar=false){
    for(const scope of [...new Set([dir,platformDir])])for(const file of sidebar?['sidebar-logo.json','logo.json']:['logo.json']){
      try{return {...JSON.parse(await fs.readFile(path.join(scope,file),'utf8')),scope:scope===platformDir?'platform':'company'};}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    const bytes=await fs.readFile(path.join(__dirname,'public/assets/branding',sidebar?'opstack-wordmark.png':'opstack-symbol.png'));
    return {type:'image/png',data:bytes.toString('base64'),scope:'platform'};
  }
  async function asset(file){
    const target=path.join(__dirname,'public',file),stat=await fs.stat(target),stamp=stat.mtimeMs+':'+stat.size;
    let cached=assets.get(file);
    if(!cached||cached.stamp!==stamp){
      const data=await fs.readFile(target);cached={stamp,data,etag:'"'+crypto.createHash('sha256').update(data).digest('hex')+'"'};assets.set(file,cached);
    }
    return cached;
  }
  return http.createServer(async (req,res) => {
    const json = (code,body) => {res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      const requestUrl=new URL(req.url,'http://localhost');req.url=requestUrl.pathname;
      res.setHeader('Cache-Control','no-store');
      if(req.url==='/api/setup'&&req.method==='POST'){
        if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))fail('First-time setup must be opened on the computer running the app.',403);
        if(req.headers['content-type']!=='application/json'||(req.headers.origin&&req.headers.origin!==`http${req.socket.encrypted?'s':''}://${req.headers.host}`))fail('Invalid setup request.',403);
        const account=await auth.setup(await body(req));await locationStore.ensure(true);return json(201,(await auth.list()).find(saved=>saved.id===account.id));
      }
      if(req.method==='GET'&&req.url==='/admin/login'){res.writeHead(303,{Location:'/login'});return res.end();}
      if(req.method==='GET'&&['/login','/setup','/admin/appearance/signin','/admin/appearance/setup'].includes(req.url)&&requestUrl.searchParams.has('company')){res.writeHead(303,{Location:req.url});return res.end();}
      if(req.method==='GET'&&req.url==='/login'&&!await auth.configured()){res.writeHead(303,{Location:'/setup'});return res.end();}
      if(req.method==='GET'&&req.url==='/setup'&&await auth.configured()){res.writeHead(303,{Location:'/login'});return res.end();}
      await locationStore.ensure();await companyStore.ensure();
      let session=await companyStore.context(await locationStore.sessionContext(await auth.session(req),req.headers['x-location-id']));
      const customisationRoutes=['/logo','/sidebar-logo','/appearance','/interface-text','/element-overrides','/font-library','/api/logo','/api/sidebar-logo','/api/settings','/api/fonts','/api/interface-text','/api/element-overrides','/layouts','/api/layout'];
      const authPage=['/login','/setup','/admin/appearance/signin','/admin/appearance/setup'].includes(req.url),fontAsset=req.url.startsWith('/uploaded-fonts/'),settingsPage=['/admin/settings','/settings'].includes(req.url);
      const platformAppearance=authPage||((customisationRoutes.includes(req.url)||fontAsset||settingsPage)&&(req.headers['x-app-appearance']==='platform'||requestUrl.searchParams.get('platform')==='1'));
      const platformWrite=platformAppearance&&((req.url.startsWith('/api/')&&customisationRoutes.includes(req.url))||settingsPage||req.url.startsWith('/admin/appearance/'));
      if(platformWrite){if(!session){if(req.url.startsWith('/api/'))fail('Sign-in required.',401);res.writeHead(303,{Location:'/login'});return res.end();}if(!can(session,'network.access')||!can(session,'appearance.manage')){if(req.url.startsWith('/api/'))fail('Head Office platform appearance permission required.',403);res.writeHead(303,{Location:'/'});return res.end();}}
      const requestedCompany=!platformAppearance&&(customisationRoutes.includes(req.url)||fontAsset||settingsPage)?(req.headers['x-company-id']||requestUrl.searchParams.get('company')):undefined;
      const appearanceCompany=await companyStore.get(requestedCompany||session?.companyId||companies.defaultCompanyId);
      if(session&&requestedCompany&&!can(session,'network.access')&&!(await companyStore.accessible(session)).some(company=>company.id===appearanceCompany.id))fail('You do not have access to this company.',403);
      if(session&&requestedCompany&&(settingsPage||req.url.startsWith('/admin/appearance/')||(req.url.startsWith('/api/')&&customisationRoutes.includes(req.url)))&&session.companyId!==appearanceCompany.id){const target=await companyStore.switchLocation(session,appearanceCompany.id);session=await companyStore.context(await locationStore.sessionContext(session,target.id));}
      const customisationDir=platformAppearance?platformDir:customisations.folder(dataDir,appearanceCompany.id),scopedAsset=url=>platformAppearance?url+(url.includes('?')?'&':'?')+'platform=1':customisations.assetUrl(url,appearanceCompany.id),fontEntry=font=>({...font,url:scopedAsset('/uploaded-fonts/'+font.id.slice(7)+'.'+font.extension)}),readFontLibrary=async()=>(await uploadedFonts.list(customisationDir)).map(fontEntry);
      if(req.method==='GET'&&['/logo','/sidebar-logo'].includes(req.url)){
        try{const logo=await readLogo(customisationDir,req.url==='/sidebar-logo');res.writeHead(200,{'Content-Type':logo.type,'X-Content-Type-Options':'nosniff','X-Branding-Scope':logo.scope});return res.end(Buffer.from(logo.data,'base64'));}catch(error){if(error.code==='ENOENT')return json(404,{error:'No logo uploaded.'});throw error;}
      }
      if(req.method==='GET'&&req.url==='/appearance'){
        try{return json(200,JSON.parse(await fs.readFile(path.join(customisationDir,'appearance.json'),'utf8')));}catch(error){if(error.code==='ENOENT')return json(200,defaults);throw error;}
      }
      if(req.method==='GET'&&req.url==='/interface-text')return json(200,await interfaceText.read(customisationDir));
      if(req.method==='GET'&&req.url==='/element-overrides')return json(200,await elementOverrides.read(customisationDir));
      if(req.method==='GET'&&req.url==='/layouts')return json(200,await layouts.page(customisationDir,requestUrl.searchParams.get('page')));
      if(req.method==='GET'&&req.url==='/font-library')return json(200,await readFontLibrary());
      const fontRequest=req.url.match(/^\/uploaded-fonts\/([a-f0-9]{64})\.(ttf|otf|woff2?)$/);
      if(req.method==='GET'&&fontRequest){
        const font=await uploadedFonts.file(customisationDir,fontRequest[1],fontRequest[2]);if(!font)return json(404,{error:'Font not found.'});
        const etag='"'+fontRequest[1]+'"';res.setHeader('ETag',etag);res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.setHeader('X-Content-Type-Options','nosniff');
        if(req.headers['if-none-match']===etag){res.writeHead(304);return res.end();}res.writeHead(200,{'Content-Type':font.mime});return res.end(font.data);
      }
      const readCatalogue=()=>catalogueStore.read(session?.companyId||companies.defaultCompanyId),mutate=change=>catalogueStore.mutate(session.companyId,change);
      if(req.method==='GET'&&req.url==='/api/session')return json(200,session?{role:session.role,roleName:session.roleName,roleLevel:session.roleLevel,permissions:session.permissions,networkPermissions:session.networkPermissions,permissionRevision:session.permissionRevision,username:session.username,id:session.id,csrf:session.csrf,locationId:session.locationId,locationName:session.locationName,companyId:session.companyId,companyName:session.companyName,companies:await companyStore.accessible(session),locations:(await locationStore.accessible(session)).map(({id,name})=>({id,name})),dataScope:session.dataScope,canMigrateBrowserData:session.canMigrateBrowserData}:{role:'user'});
      if(req.method==='POST'&&req.url==='/api/login'){
        if(req.headers.origin&&req.headers.origin!==`http${req.socket.encrypted?'s':''}://${req.headers.host}`)fail('Invalid request origin.',403);
        const input=await body(req),loggedIn=await auth.login(req,input);
        res.setHeader('Set-Cookie',`admin_session=${loggedIn.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.socket.encrypted?'; Secure':''}`);
        return json(200,{role:loggedIn.role});
      }
      const privatePages=['/','/home','/cart','/stock-count','/sales','/reporting','/email-settings','/admin','/admin/accounts','/admin/settings','/settings','/settings/awards','/rostering','/communications','/knowledge-library','/admin/appearance/signin','/admin/appearance/setup'];
      let requiredReading;
      if(session){const exempt=['/api/session','/api/login','/api/logout','/api/communications/required'].includes(req.url)||(req.method==='GET'&&/^\/api\/communications\/media\/[a-f0-9-]+$/i.test(req.url))||/^\/api\/communications\/posts\/[a-f0-9-]+\/(read|snooze)$/i.test(req.url);if((req.url.startsWith('/api/')&&!exempt)||(req.method==='GET'&&privatePages.includes(req.url))){requiredReading=await communicationStore.required(session);if(requiredReading.due.length){if(req.url.startsWith('/api/'))return json(428,{error:'Read or snooze the required posts before continuing.',code:'REQUIRED_POSTS',required:requiredReading});if(req.url!=='/communications'){res.writeHead(303,{Location:'/communications?returnTo='+encodeURIComponent(requestUrl.pathname+requestUrl.search)+'#required'});return res.end();}}}}
      if(await communicationRoutes.route({req,res,url:req.url,params:requestUrl.searchParams,session,store:communicationStore,body,json,fail}))return;
      if(await knowledgeLibraryRoutes.route({req,url:req.url,params:requestUrl.searchParams,session,store:libraryStore,body,json,fail}))return;
      if(req.url==='/api/award-source'&&req.method==='GET'){if(!can(session,'awards.manage'))fail('Award settings permission required.',403);res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'private, no-store'});return res.end(await fs.readFile(path.join(__dirname,'docs/awards/ma000003-2026-07.pdf')));}
      if(await awardCompliance.route({req,url:req.url,session,store:awardStore,body,json,fail}))return;
      if(await rosteringRoutes.route({req,url:req.url,params:requestUrl.searchParams,session,store:rosteringStore,body,json,fail}))return;
      const required=apiPermission(req.url,req.method);
      if(required){if(!session)fail('Sign-in required.',401);if(!canAny(session,required))fail('Your permission level does not allow this action.',403);}
      const management=required&&!['/api/menu','/api/catalogue'].includes(req.url)&&(required.some(key=>key.endsWith('.manage'))||req.url.startsWith('/api/permission-levels')||req.url.startsWith('/api/companies'));
      if(management&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
      if(req.method==='POST'&&req.url==='/api/logout'){if(!session)fail('Sign-in required.',401);if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);auth.logout(session.token);res.setHeader('Set-Cookie','admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(200,{signedOut:true});}
      if(req.url.startsWith('/api/')&&!session)fail('Sign-in required.',401);
      if(req.url==='/api/permission-levels'&&req.method==='GET')return json(200,await auth.permissionLevels(session));
      const permissionLevelRoute=req.url.match(/^\/api\/permission-levels\/([a-zA-Z0-9-]+)$/);
      if((req.url==='/api/permission-levels'&&req.method==='POST')||(permissionLevelRoute&&['PUT','DELETE'].includes(req.method))){await auth.changePermissionLevel(session,await body(req,64000),req.method,permissionLevelRoute?.[1]);return json(req.method==='POST'?201:200,await auth.permissionLevels(await auth.forCompany(session,session.companyId)));}
      if(req.url==='/api/invoices'){
        if(req.method==='GET')return json(200,await invoices.list(dataDir,session,requestUrl.searchParams.get('week')));
        if(req.method==='POST'){if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);const saved=await invoices.create(dataDir,session,await body(req,16000000));return json(saved.alreadySaved?200:201,saved);}
        res.setHeader('Allow','GET, POST');fail('Unsupported invoice action.',405);
      }
      const invoiceRoute=req.url.match(/^\/api\/invoices\/([a-f0-9-]+)(?:\/(file|preview))?$/i);
      if(invoiceRoute){
        const [,id,kind]=invoiceRoute;
        if(req.method==='GET'&&kind){const file=await invoices.asset(dataDir,session,id,kind);res.writeHead(200,{'Content-Type':file.mime,'X-Content-Type-Options':'nosniff',...(kind==='file'?{'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(file.name).replace(/['()*]/g,char=>'%'+char.charCodeAt(0).toString(16).toUpperCase())}:{})});return res.end(file.data);}
        if(req.method==='GET'){const {fingerprint,...record}=await invoices.read(dataDir,session,id);return json(200,record);}
        if(kind)fail('Invoice not found.',404);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
        if(req.method==='PUT')return json(200,await invoices.update(dataDir,session,id,await body(req)));
        if(req.method==='DELETE'){const input=await body(req);return json(200,await invoices.remove(dataDir,session,id,input?.revision));}
        res.setHeader('Allow','GET, PUT, DELETE');fail('Unsupported invoice action.',405);
      }
      if(req.url==='/api/session/location'&&req.method==='PUT'){
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
        const input=await body(req);await auth.selectLocation(session,input?.locationId,id=>locationStore.get(id,{active:true}));return json(200,{locationId:input.locationId});
      }
      if(req.url==='/api/session/company'&&req.method==='PUT'){
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
        const input=await body(req),target=await companyStore.switchLocation(session,input?.companyId);await auth.selectLocation(session,target.id,id=>locationStore.get(id,{active:true}));return json(200,{companyId:input.companyId,locationId:target.id});
      }
      if(req.url==='/api/companies'&&req.method==='GET')return json(200,await companyStore.list(session));
      if(req.url==='/api/companies'&&req.method==='POST'){if(!can(session,'network.access'))fail('Network access is required to create a company.',403);return json(201,await companyStore.create(await body(req)));}
      const companyRoute=req.url.match(/^\/api\/companies\/([a-zA-Z0-9-]+)$/);if(companyRoute&&req.method==='PUT'){if(!can(await auth.forCompany(session,companyRoute[1]),'companies.manage')||!(await companyStore.accessible(session)).some(company=>company.id===companyRoute[1]))fail('You do not have access to this company.',403);return json(200,await companyStore.update(companyRoute[1],await body(req)));}
      if(req.url==='/api/locations'&&req.method==='GET'){
        const all=requestUrl.searchParams.get('all')==='true',companyList=await companyStore.list(session),records=(await Promise.all((await locationStore.list()).filter(record=>all||record.companyId===session.companyId).map(async record=>{const context=await auth.forCompany(session,record.companyId);return canAccessLocation(context,record)&&canAny(context,['users.manage','locations.manage','email.manage','companies.manage'])&&(!record.archived||can(context,'locations.manage'))?record:null;}))).filter(Boolean);
        return json(200,await Promise.all(records.map(async record=>{const company=companyList.find(company=>company.id===record.companyId),base={...record,companyName:company?.name||''};if(!canAny(session,['locations.manage','email.manage','companies.manage']))return all?{id:base.id,name:base.name,archived:base.archived,companyId:base.companyId,companyName:base.companyName}:{id:base.id,name:base.name,archived:base.archived};if(!can(await auth.forCompany(session,record.companyId),'email.manage'))return base;const email=deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,record.id));return {...base,senderEmail:email.values.ORDER_FROM_EMAIL,orderEmailEnabled:email.enabled.DELIVERY_EMAIL_ENABLED};})));
      }
      if(req.url==='/api/locations'&&req.method==='POST'){const input=await body(req),companyId=input?.companyId||session.companyId;await companyStore.get(companyId);if(!can(await auth.forCompany(session,companyId),'locations.manage')||!(await companyStore.accessible(session)).some(company=>company.id===companyId))fail('You do not have access to this company.',403);return json(201,await locationStore.create({...input,companyId}));}
      const locationRoute=req.url.match(/^\/api\/locations\/([a-zA-Z0-9-]+)$/);
      if(locationRoute&&req.method==='PUT'){const target=await locationStore.get(locationRoute[1]);if(!can(await auth.forCompany(session,target.companyId),'locations.manage')||!canAccessLocation(await auth.forCompany(session,target.companyId),target))fail('You do not have access to this location.',403);return json(200,await locationStore.update(locationRoute[1],await body(req)));}
      const locationEmailRoute=req.url.match(/^\/api\/locations\/([a-zA-Z0-9-]+)\/email$/);
      if(req.url==='/api/order-email-template'){
        if(!can(session,'email.manage'))fail('Email settings permission required.',403);
        if(req.method==='GET')return json(200,await orderEmailTemplates.read(dataDir,session.companyId));
        if(req.method==='PUT'){try{return json(200,await orderEmailTemplates.save(dataDir,session.companyId,await body(req,32000)));}catch(error){fail(error.message,error.status||400);}}
      }
      if(locationEmailRoute){
        const location=await locationStore.get(locationEmailRoute[1]),context=await auth.forCompany(session,location.companyId);if(!can(context,'email.manage')||!canAccessLocation(context,location))fail('Location email access required.',403);
        if(req.method==='GET')return json(200,deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,location.id)));
        if(req.method==='PUT'){if(location.archived)fail('Restore the location before changing its email settings.');try{return json(200,await deliverySettings.save(dataDir,await body(req),location.id));}catch(error){fail(error.message);}}
      }
      if(req.url==='/api/reporting/locations'&&req.method==='GET'){
        if(!can(session,'reporting.view'))fail('Reporting permission required.',403);
        const [accessible,companyList]=await Promise.all([locationStore.accessible(session,{allCompanies:true}),companyStore.accessible(session)]),available=(await Promise.all(accessible.map(async record=>can(await auth.forCompany(session,record.companyId),'reporting.view')?record:null))).filter(Boolean),names=new Map(companyList.map(company=>[company.id,company.name]));
        return json(200,{locations:available.map(location=>({...location,companyName:names.get(location.companyId)||''}))});
      }
      if(req.url==='/api/reporting'&&req.method==='GET'){
        if(!can(session,'reporting.view'))fail('Reporting permission required.',403);
        const params=Object.fromEntries(requestUrl.searchParams),now=new Date();reporting.range(params,now);
        if(Object.hasOwn(params,'locations')){
          const ids=reporting.selectLocations(params.locations,await locationStore.accessible(session,{allCompanies:true}));
          const contexts=await Promise.all(ids.map(async id=>companyStore.context(await locationStore.sessionContext(session,id))));
          if(contexts.some(context=>!can(context,'reporting.view')))fail('Reporting access is required in every selected company.',403);
          const [history,entries]=await Promise.all([usageHistory(dataDir),Promise.all([...new Set(contexts.map(context=>context.companyId))].map(async id=>[id,await catalogueStore.read(id)]))]),catalogues=new Map(entries),reports=[];
          for(let offset=0;offset<contexts.length;offset+=8)reports.push(...await Promise.all(contexts.slice(offset,offset+8).map(async context=>{
            const records=await salesStore.history(dataDir,context),catalogue=catalogues.get(context.companyId),report=reporting.calculate(records,history.orders,history.counts,catalogue,context,params,{now});
            report.details=await reportingDetails.build(dataDir,context,report.period,{...history,catalogue,store:weeklySalesReportStore,now,weekBasis:params.weekBasis});return report;
          })));
          return json(200,{period:reports[0].period,reports});
        }
        const [records,history,catalogue]=await Promise.all([salesStore.history(dataDir,session),usageHistory(dataDir),readCatalogue()]);
        const report=reporting.calculate(records,history.orders,history.counts,catalogue,session,params,{now});
        report.details=await reportingDetails.build(dataDir,session,report.period,{...history,catalogue,store:weeklySalesReportStore,now,weekBasis:params.weekBasis});return json(200,report);
      }
      if(req.url==='/api/home-totals'&&req.method==='GET'){
        const history=await usageHistory(dataDir);
        return json(200,await salesStore.totals(dataDir,session,{orders:history.orders}));
      }
      if(req.url==='/api/sales'&&req.method==='GET'){
        const history=await usageHistory(dataDir);
        return json(200,await salesStore.report(dataDir,session,requestUrl.searchParams.get('week'),{orders:history.orders}));
      }
      if(req.url==='/api/operating-expense-schedule'){
        if(req.method==='GET')return json(200,await operatingExpenseSchedule.read(dataDir,session));
        if(req.method==='PUT'){if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);return json(200,await operatingExpenseSchedule.change(dataDir,session,await body(req,512000)));}
        res.setHeader('Allow','GET, PUT');fail('Unsupported expense schedule change.',405);
      }
      if(req.url==='/api/operating-expense-types'){
        if(req.method==='GET')return json(200,await operatingExpenseTypes.read(dataDir,session));
        if(['POST','DELETE'].includes(req.method)){if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);return json(200,await operatingExpenseTypes.change(dataDir,session,await body(req),req.method));}
        res.setHeader('Allow','GET, POST, DELETE');fail('Unsupported expense type change.',405);
      }
      if(req.url==='/api/weekly-sales-overview'&&req.method==='GET'){
        const params=Object.fromEntries(requestUrl.searchParams);weeklySalesOverview.period(params);
        const history=await usageHistory(dataDir);
        return json(200,await weeklySalesOverview.build(dataDir,session,params,{orders:history.orders,store:weeklySalesReportStore}));
      }
      if(req.url==='/api/weekly-sales-reports'&&req.method==='GET'){
        const history=await usageHistory(dataDir);
        return json(200,await weeklySalesReportStore.report(dataDir,session,requestUrl.searchParams.get('week'),{orders:history.orders}));
      }
      if(req.url==='/api/weekly-sales-reports'&&req.method==='PUT'){
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
        return json(200,await weeklySalesReportStore.save(dataDir,session,await body(req,512000)));
      }
      if(req.url==='/api/sales'&&req.method==='PUT'){
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
        return json(200,await salesStore.save(dataDir,session,await body(req)));
      }
      if(req.url==='/api/stock-usage'&&req.method==='GET'){
        const week=requestUrl.searchParams.get('week');if(!week)fail('Choose a usage week.');const catalogue=await readCatalogue();const products=catalogue.products.map(product=>({...product,supplier:catalogue.suppliers.find(supplier=>supplier.id===product.supplierId)?.name}));return json(200,await stockUsage.report(dataDir,session,products,week,{reader:usageHistory}));
      }
      if(req.url==='/api/stock-usage'&&req.method==='PUT'){
        res.setHeader('Allow','GET');fail('Weekly usage is automatic. Save Sunday stock counts and place orders instead.',405);
      }
      if(req.url==='/api/stock-counts'&&req.method==='GET'){const records=await stockCounts.list(dataDir,session);if(!headOffice(session))return json(200,records);const ids=new Set((await locationStore.list()).filter(record=>record.companyId===session.companyId).map(record=>record.id));return json(200,records.filter(record=>record.locationId?ids.has(record.locationId):session.companyId===companies.defaultCompanyId));}
      if(req.url==='/api/stock-counts'&&req.method==='POST'){
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
        const saved=await stockCounts.save(dataDir,await body(req,2000000),await readCatalogue(),session);return json(saved.created?201:200,saved.record);
      }
      const stockCountRoute=req.url.match(/^\/api\/stock-counts\/([^/]+)$/);
      if(stockCountRoute&&req.method==='GET'){const record=await stockCounts.get(dataDir,stockCountRoute[1],session);if(record.locationId){const target=await locationStore.get(record.locationId),context=await auth.forCompany(session,target.companyId);if(!can(context,'counts.view')||!canAccessLocation(context,target))fail('Stock count not found.',404);}return json(200,record);}
      if(req.url==='/api/layout'&&req.method==='PUT')return json(200,await layouts.save(customisationDir,await body(req,1500000)));
      if(req.url==='/api/element-overrides'&&req.method==='PATCH'){try{return json(200,await elementOverrides.patch(customisationDir,await body(req,2900000)));}catch(error){fail(error.message);}}
      if(req.url==='/api/interface-text'&&req.method==='GET')return json(200,{labels:interfaceText.labels,overrides:await interfaceText.read(customisationDir)});
      if(req.url==='/api/interface-text'&&req.method==='PATCH'){try{return json(200,await interfaceText.patch(customisationDir,await body(req)));}catch(error){fail(error.message);}}
      if(req.url==='/api/interface-text'&&req.method==='PUT'){try{return json(200,await interfaceText.save(customisationDir,await body(req,300000)));}catch(error){fail(error.message);}}
      if(req.url==='/api/delivery-status'&&req.method==='GET')return json(200,providerStatus(await deliverySettings.deliveryEnvironment(dataDir,session.locationId)));
      const accountEmailRoute=req.url.match(/^\/api\/accounts\/([a-zA-Z0-9-]+)\/email$/);
      if(accountEmailRoute){const id=accountEmailRoute[1];const account=(await auth.list()).find(account=>account.id===id);if(!account)fail('Account not found.',404);const target=await locationStore.get(account.locationId),context=await auth.forCompany(session,target.companyId);if(!can(context,'email.manage')||!canAccessLocation(context,target))fail('Location email access required.',403);if(req.method==='GET')return json(200,deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,account.locationId)));if(req.method==='PUT'){res.setHeader('Allow','GET');fail('Edit store email in location settings.',405);}}
      if(req.url==='/api/my-email-settings'){if(!session)fail('Sign-in required.',401);if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);if(req.method==='GET')return json(200,deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,session.locationId)));if(req.method==='PUT'){res.setHeader('Allow','GET');fail('Edit store email in location settings.',405);}}
      if(req.url==='/api/delivery-settings'&&req.method==='GET')return json(200,deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,session.locationId)));
      if(req.url==='/api/delivery-settings'&&req.method==='PUT'){try{return json(200,await deliverySettings.save(dataDir,await body(req),session.locationId));}catch(error){fail(error.message);}}
      const supplierEdit=req.url.match(/^\/api\/suppliers\/([a-zA-Z0-9-]+)$/);
      if(req.method==='PUT'&&supplierEdit){const input=await body(req);let delivery;try{delivery=validateDelivery(input.delivery);}catch(error){fail(error.message);}return json(200,await mutate(c=>{const supplier=c.suppliers.find(s=>s.id===supplierEdit[1]);if(!supplier)fail('Supplier not found.',404);supplier.delivery=delivery;return supplier;}));}
      if(req.url==='/api/fonts'&&req.method==='GET')return json(200,await readFontLibrary());
      if(req.url==='/api/fonts'&&req.method==='POST'){try{const result=await uploadedFonts.save(customisationDir,await body(req,2900000));return json(result.alreadyExists?200:201,{...result,font:fontEntry(result.font)});}catch(error){if(error.code)throw error;fail(error.message,error.status||400);}}
      if(req.url==='/api/settings'&&['PUT','PATCH'].includes(req.method)){try{return json(200,await saveAppearance(customisationDir,await body(req,2900000),req.method==='PATCH'));}catch(error){fail(error.message);}}
      if(req.url==='/api/sidebar-logo'&&req.method==='DELETE'){await fs.rm(path.join(customisationDir,'sidebar-logo.json'),{force:true});return json(200,{saved:true});}
      if(['/api/logo','/api/sidebar-logo'].includes(req.url)&&req.method==='POST'){
        const input=await body(req,2900000);if(typeof input?.data!=='string'||!input.data.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))fail('Choose a PNG or JPG image.');
        const bytes=Buffer.from(input.data,'base64');if(bytes.length>2000000)fail('Logo must be smaller than 2 MB.');
        const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        if(!png&&!jpeg)fail('Choose a PNG or JPG image.');
        const target=path.join(customisationDir,req.url==='/api/sidebar-logo'?'sidebar-logo.json':'logo.json'),temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(customisationDir,{recursive:true});await fs.writeFile(temp,JSON.stringify({type:png?'image/png':'image/jpeg',data:bytes.toString('base64')}),{mode:0o600});await fs.rename(temp,target);return json(200,{saved:true});
      }
      if(req.url==='/api/accounts'&&req.method==='GET'){const records=await auth.list(session);if(requestUrl.searchParams.get('all')==='true')return json(200,records);const ids=new Set((await locationStore.list()).filter(record=>record.companyId===session.companyId).map(record=>record.id));return json(200,records.filter(account=>locationIds(account).some(id=>ids.has(id))));}
      if(req.url==='/api/accounts'&&req.method==='POST'){const account=await auth.create(session,await body(req),id=>locationStore.get(id,{active:true}));await locationStore.ensure(true);return json(201,(await auth.list()).find(saved=>saved.id===account.id));}
      const accountRoute=req.url.match(/^\/api\/accounts\/([a-zA-Z0-9-]+)$/);
      if(accountRoute&&req.method==='PUT')return json(200,await auth.update(session,accountRoute[1],await body(req),id=>locationStore.get(id,{active:true})));
      if(accountRoute&&req.method==='DELETE')return json(200,await auth.remove(session,accountRoute[1]));

      if(req.method==='GET'&&['/rostering','/knowledge-library','/communications','/','/home','/cart','/stock-count','/sales','/reporting','/email-settings','/admin','/admin/accounts','/admin/settings','/settings','/settings/awards','/admin/appearance/signin','/admin/appearance/setup'].includes(req.url)&&!session){res.writeHead(303,{Location:'/login'});return res.end();}
      if(req.method==='GET'&&!(req.url==='/communications'&&requiredReading?.due.length)&&pagePermission(req.url)&&!canAny(session,pagePermission(req.url))){res.writeHead(303,{Location:['/admin','/admin/accounts','/admin/settings','/admin/appearance/signin','/admin/appearance/setup','/email-settings'].includes(req.url)?'/':'/home'});return res.end();}
      if(req.method==='GET'&&req.url==='/email-settings'){const accountId=requestUrl.searchParams.get('account'),account=accountId?(await auth.list()).find(account=>account.id===accountId):null;const id=requestUrl.searchParams.get('location')||account?.locationId||session.locationId;res.writeHead(303,{Location:'/admin/accounts?location='+encodeURIComponent(id)+'#locations'});return res.end();}
      if (req.method === 'GET' && ['/api/menu','/api/catalogue'].includes(req.url)) {
        const catalogue=await readCatalogue();
        const manualLevels=await manualParStore.read(dataDir,session.locationId||session.id);
        const parLevels=await stockUsage.parLevels(dataDir,session,catalogue.products,{reader:usageHistory,manualLevels});
        const products=catalogue.products.map(p=>({...p,supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name,par:parLevels.levels[p.id],ordering:parLevels.suggestions[p.id]}));
        return json(200,req.url==='/api/menu'?products:{...catalogue,suppliers:can(session,'suppliers.manage')?catalogue.suppliers:catalogue.suppliers.map(({id,name})=>({id,name})),products,parWindow:parLevels.window,stockTake:parLevels.stockTake});
      }
      const manualParRoute=req.url.match(/^\/api\/products\/([a-zA-Z0-9-]+)\/par$/);
      if(manualParRoute&&req.method==='PUT'){
        const input=await body(req);
        return json(200,await manualParStore.save(dataDir,session.locationId||session.id,manualParRoute[1],input,async()=>{
          const catalogue=await readCatalogue();if(!catalogue.products.some(product=>product.id===manualParRoute[1]))fail('Stock not found.',404);
          const automatic=await stockUsage.parLevels(dataDir,session,catalogue.products,{reader:usageHistory});
          if(automatic.levels[manualParRoute[1]].weeksRecorded>0)fail('This item uses automatic par because completed usage history is available.');
        }));
      }
      if(req.method==='POST' && req.url==='/api/suppliers'){
        const input=await body(req);const supplierName=name(input?.name,'supplier name');
        return json(201,await mutate(c=>{if(c.suppliers.some(s=>s.name.toLowerCase()===supplierName.toLowerCase()))fail('That supplier already exists.');const supplier={id:crypto.randomUUID(),name:supplierName};c.suppliers.push(supplier);return supplier;}));
      }
      const edit=req.url.match(/^\/api\/products\/([a-zA-Z0-9-]+)$/);
      if((req.method==='POST' && req.url==='/api/products') || (req.method==='PUT' && edit)){
        const input=await body(req,2900000);const productName=name(input?.name,'stock name');
        if(input.stock===undefined)input.stock=0;
        let photo;if(input.photo===null)photo=null;else if(input.photo!==undefined){if(typeof input.photo!=='string')fail('Choose a PNG or JPG photo.');const match=input.photo.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)fail('Choose a PNG or JPG photo.');const bytes=Buffer.from(match[2],'base64');if(bytes.length>2000000)fail('Photo must be smaller than 2 MB.');const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!(match[1]==='png'?png:jpg))fail('Invalid image file.');photo=input.photo;}
        if((input.price!==null&&(typeof input.price!=='number'||!Number.isFinite(input.price)||input.price<0||input.price>1000000))||!Number.isInteger(input.stock)||input.stock<0||input.stock>1000000)fail('Enter a valid price and whole-number stock quantity.');
        if(input.stockCountGroup!==undefined&&!stockCountGroups.valid(input.stockCountGroup))fail('Choose a valid stock count group.');
        const product={id:crypto.randomUUID(),name:productName,supplierId:input.supplierId,price:input.price===null?null:Math.round(input.price*100),stock:input.stock,category:name(input.category||'General','category',60),sku:typeof input.sku==='string'?input.sku.trim().slice(0,60):'',description:typeof input.description==='string'?input.description.slice(0,300):'',emoji:'📦',photo:photo||null};
        return json(edit?200:201,await mutate(c=>{product.stockCountGroup=input.stockCountGroup??(edit?c.products.find(p=>p.id===edit[1])?.stockCountGroup:undefined)??stockCountGroups.resolve(product);if(!c.suppliers.some(s=>s.id===product.supplierId))fail('Choose an existing supplier.');if(edit){const index=c.products.findIndex(p=>p.id===edit[1]);if(index<0)fail('Stock not found.',404);product.id=c.products[index].id;product.emoji=c.products[index].emoji;if(photo===undefined)product.photo=c.products[index].photo||null;c.products[index]=product;}else{c.products.push(product);}return product;}));
      }
      const deletion=req.url.match(/^\/api\/(products|suppliers)\/([a-zA-Z0-9-]+)$/);
      if(req.method==='DELETE' && deletion){return json(200,await mutate(c=>{
        const collection=deletion[1];const id=deletion[2];if(!c[collection].some(item=>item.id===id))fail('Item not found.',404);
        if(collection==='suppliers'&&c.products.some(p=>p.supplierId===id))fail('Remove this supplier’s stock before removing the supplier.');
        c[collection]=c[collection].filter(item=>item.id!==id);return {removed:true};
      }));}
      const savedOrderRoute=req.url.match(/^\/api\/orders\/([a-f0-9-]{36})$/i);
      if(req.method==='GET'&&savedOrderRoute){let record;try{record=JSON.parse(await fs.readFile(path.join(dataDir,savedOrderRoute[1]+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')fail('Order not found.',404);throw error;}if(record.requestOwnerId!==session.id||!belongs(record,session,'requestOwnerId'))fail('Order not found.',404);return json(200,record);}
      if (req.method === 'POST' && req.url === '/api/orders') {
        const input=await body(req);
        const requestId=input?.requestId;
        if(requestId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))fail('Invalid request identifier.');
        const fingerprint=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
        if(requestId){try{const previous=JSON.parse(await fs.readFile(path.join(dataDir,requestId+'.json'),'utf8'));if(previous.requestOwnerId!==session.id||!belongs(previous,session,'requestOwnerId')||previous.requestFingerprint!==fingerprint)fail('This request identifier belongs to another order.',409);return json(200,previous);}catch(error){if(error.code!=='ENOENT')throw error;}}
        const catalogue=await readCatalogue();
        const products=catalogue.products.map(p=>({...p,supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name}));
        let order;try{order=validateOrder(input,products,session.username);}catch(error){fail(error.message);}
        if(requestId)order.id=requestId;order.companyId=session.companyId;order.locationId=session.locationId;order.locationName=session.locationName;order.requestOwnerId=session.id;order.requestFingerprint=fingerprint;order.delivery=splitBySupplier(order).map(s=>({supplierId:s.supplierId,supplier:s.supplier,status:'pending',message:'Delivery processing is not yet confirmed.'}));
        await fs.mkdir(dataDir,{recursive:true});
        const initial=path.join(dataDir,order.id+'.json'),staged=initial+'.'+crypto.randomUUID()+'.tmp';
        try{await fs.writeFile(staged,JSON.stringify(order,null,2),{mode:0o600});try{await fs.link(staged,initial);}catch(error){if(error.code!=='EEXIST')throw error;const previous=JSON.parse(await fs.readFile(initial,'utf8'));if(previous.requestOwnerId!==session.id||!belongs(previous,session,'requestOwnerId')||previous.requestFingerprint!==fingerprint)fail('This request identifier belongs to another order.',409);return json(200,previous);}}finally{await fs.rm(staged,{force:true});}
        const templateSettings=await orderEmailTemplates.read(dataDir,session.companyId);
        order.delivery=await dispatchOrder(order,catalogue.suppliers,{env:{...await deliverySettings.deliveryEnvironment(dataDir,session.locationId),...(templateSettings.revision?{ORDER_EMAIL_TEMPLATE:templateSettings.template}:{})},fetchImpl});
        const target=path.join(dataDir,`${order.id}.json`);const temp=target+'.tmp';await fs.writeFile(temp,JSON.stringify(order,null,2),{mode:0o600});await fs.rename(temp,target);
        return json(201,order);
      }
      const files = {'/shift-clock.js':'shift-clock.js','/shift-clock.css':'shift-clock.css','/clock-model.js':'clock-model.js','/user-employment.js':'user-employment.js','/user-employment.css':'user-employment.css','/settings/awards':'award-settings.html','/award-settings.js':'award-settings.js','/award-settings.css':'award-settings.css','/rostering':'rostering.html','/rostering.js':'rostering.js','/rostering.css':'rostering.css','/rostering-model.js':'rostering-model.js','/knowledge-library':'knowledge-library.html','/knowledge-library.js':'knowledge-library.js','/knowledge-library.css':'knowledge-library.css','/editor-menu.js':'editor-menu.js','/editor-menu.css':'editor-menu.css','/emoji-picker.js':'emoji-picker.js','/emoji-picker.css':'emoji-picker.css','/message-badge.js':'message-badge.js','/formatted-text.js':'formatted-text.js','/text-editor.js':'text-editor.js','/formatted-text.css':'formatted-text.css','/communications':'communications.html','/communications.js':'communications.js','/communications.css':'communications.css','/required-reading.js':'required-reading.js','/required-reading.css':'required-reading.css',"/vendor/invoice/CORE-LICENSE.txt":"vendor/invoice/CORE-LICENSE.txt","/vendor/invoice/pdf.worker.min.mjs":"vendor/invoice/pdf.worker.min.mjs","/vendor/invoice/worker.min.js":"vendor/invoice/worker.min.js","/vendor/invoice/pdf.min.mjs":"vendor/invoice/pdf.min.mjs","/vendor/invoice/TESSERACT-LICENSE.txt":"vendor/invoice/TESSERACT-LICENSE.txt","/vendor/invoice/tesseract-core-simd-lstm.wasm.js":"vendor/invoice/tesseract-core-simd-lstm.wasm.js","/vendor/invoice/tesseract.min.js":"vendor/invoice/tesseract.min.js","/vendor/invoice/tesseract-core-lstm.wasm.js":"vendor/invoice/tesseract-core-lstm.wasm.js","/vendor/invoice/README.md":"vendor/invoice/README.md","/vendor/invoice/eng.traineddata.gz":"vendor/invoice/eng.traineddata.gz","/vendor/invoice/PDFJS-LICENSE.txt":"vendor/invoice/PDFJS-LICENSE.txt","/vendor/invoice/standard_fonts/FoxitFixedBold.pfb":"vendor/invoice/standard_fonts/FoxitFixedBold.pfb","/vendor/invoice/standard_fonts/LICENSE_LIBERATION":"vendor/invoice/standard_fonts/LICENSE_LIBERATION","/vendor/invoice/standard_fonts/LiberationSans-Regular.ttf":"vendor/invoice/standard_fonts/LiberationSans-Regular.ttf","/vendor/invoice/standard_fonts/FoxitFixed.pfb":"vendor/invoice/standard_fonts/FoxitFixed.pfb","/vendor/invoice/standard_fonts/LiberationSans-Bold.ttf":"vendor/invoice/standard_fonts/LiberationSans-Bold.ttf","/vendor/invoice/standard_fonts/FoxitSerifBoldItalic.pfb":"vendor/invoice/standard_fonts/FoxitSerifBoldItalic.pfb","/vendor/invoice/standard_fonts/FoxitSerif.pfb":"vendor/invoice/standard_fonts/FoxitSerif.pfb","/vendor/invoice/standard_fonts/FoxitFixedBoldItalic.pfb":"vendor/invoice/standard_fonts/FoxitFixedBoldItalic.pfb","/vendor/invoice/standard_fonts/FoxitDingbats.pfb":"vendor/invoice/standard_fonts/FoxitDingbats.pfb","/vendor/invoice/standard_fonts/LiberationSans-Italic.ttf":"vendor/invoice/standard_fonts/LiberationSans-Italic.ttf","/vendor/invoice/standard_fonts/FoxitSerifBold.pfb":"vendor/invoice/standard_fonts/FoxitSerifBold.pfb","/vendor/invoice/standard_fonts/LICENSE_FOXIT":"vendor/invoice/standard_fonts/LICENSE_FOXIT","/vendor/invoice/standard_fonts/LiberationSans-BoldItalic.ttf":"vendor/invoice/standard_fonts/LiberationSans-BoldItalic.ttf","/vendor/invoice/standard_fonts/FoxitFixedItalic.pfb":"vendor/invoice/standard_fonts/FoxitFixedItalic.pfb","/vendor/invoice/standard_fonts/FoxitSymbol.pfb":"vendor/invoice/standard_fonts/FoxitSymbol.pfb","/vendor/invoice/standard_fonts/FoxitSerifItalic.pfb":"vendor/invoice/standard_fonts/FoxitSerifItalic.pfb",'/invoice-scanner.js':'invoice-scanner.js','/invoice-reader.js':'invoice-reader.js','/invoice-photo.js':'invoice-photo.js','/invoice-scanner.css':'invoice-scanner.css','/':'index.html','/home':'home.html','/home.js':'home.js','/cart':'cart.html','/stock-count':'stock-count.html','/sales':'sales.html','/sales.js':'sales.js','/weekly-sales-report.js':'weekly-sales-report.js','/sales-report-entry.js':'sales-report-entry.js','/weekly-expenses.js':'weekly-expenses.js','/operating-expenses.js':'operating-expenses.js','/weekly-sales.js':'weekly-sales.js','/weekly-sales-overview.js':'weekly-sales-overview.js','/weekly-sales.css':'weekly-sales.css','/assets/platforms/ubereats.svg':'assets/platforms/ubereats.svg','/assets/platforms/doordash.svg':'assets/platforms/doordash.svg','/reporting':'reporting.html','/reporting.js':'reporting.js','/reporting-model.js':'reporting-model.js','/reporting-detail-view.js':'reporting-detail-view.js','/reporting-details.css':'reporting-details.css','/reporting-export.js':'reporting-export.js','/sales-performance.js':'sales-performance.js','/sales-performance-view.js':'sales-performance-view.js','/sales-budget.js':'sales-budget.js','/stock-count.js':'stock-count.js','/stock-count-groups.js':'stock-count-groups.js','/stock-usage.js':'stock-usage.js','/order-destinations.js':'order-destinations.js','/order-delivery-results.js':'order-delivery-results.js','/order-delivery.css':'order-delivery.css','/order-email-template.js':'order-email-template.js','/email-template-editor.css':'email-template-editor.css','/email-template-editor.js':'email-template-editor.js','/email-settings.js':'email-settings.js','/locations.js':'locations.js','/companies.js':'companies.js','/admin':'admin.html','/admin/accounts':'accounts.html','/admin/settings':'settings.html','/settings.js':'settings.js','/font-uploads.js':'font-uploads.js','/admin/appearance/signin':'login.html','/admin/appearance/setup':'setup.html','/admin/login':'login.html','/login':'login.html','/setup':'setup.html','/setup.js':'setup.js','/branding.js':'branding.js','/company-context.js':'company-context.js','/location-picker.js':'location-picker.js','/edit-parts.js':'edit-parts.js','/layout-model.js':'layout-model.js','/app-layout.js':'app-layout.js','/appearance-style.js':'appearance-style.js','/password.js':'password.js','/admin.js':'admin.js','/admin-panels.js':'admin-panels.js','/admin-ui.js':'admin-ui.js','/login.js':'login.js','/app.js':'app.js','/style.css':'style.css','/top-navigation.css':'top-navigation.css','/smooth.css':'smooth.css','/interactions.js':'interactions.js','/navigation.js':'navigation.js','/navigation-groups.js':'navigation-groups.js','/app-controls.js':'app-controls.js','/settings':'settings-hub.html','/settings-hub.js':'settings-hub.js','/settings-hub.css':'settings-hub.css','/access.js':'access.js','/permission-model.js':'permission-model.js','/interface-text.js':'interface-text.js','/auth-preview.js':'auth-preview.js','/app-editor.js':'app-editor.js','/element-overrides.js':'element-overrides.js','/fonts/Opsilon-xRj8m.ttf':'fonts/Opsilon-xRj8m.ttf'};
      if (req.method !== 'GET' || !files[req.url]) return json(404,{error:'Not found'});
      const file=files[req.url];
      const contentType=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':file.endsWith('.svg')?'image/svg+xml':/\.(?:gz|pfb)$/.test(file)?'application/octet-stream':file.endsWith('.txt')||file.endsWith('.md')?'text/plain; charset=utf-8':'text/javascript';
      if(file.endsWith('.html')){
        const layoutPage=file.replace(/\.html$/,''),[rawMarkup,appearance,text,overrides,font,hasLogo,hasSidebarLogo,fontLibrary,layout]=await Promise.all([fs.readFile(path.join(__dirname,'public',file),'utf8'),readAppearance(customisationDir),interfaceText.read(customisationDir),elementOverrides.read(customisationDir),asset('fonts/Opsilon-xRj8m.ttf'),readLogo(customisationDir).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;}),readLogo(customisationDir,true).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;}),readFontLibrary(),layouts.page(customisationDir,layoutPage)]);
        const authPreview=req.url.startsWith('/admin/appearance/');const previewToolbar='<div id="admin-edit-controls" class="auth-preview-toolbar" data-copy-editor><strong>Page preview</strong><a href="'+scopedAsset('/admin/settings')+'#sign-in">Back to settings</a><button id="app-edit-toggle" type="button" aria-pressed="false"><span class="sidebar-edit-label">App edit</span></button><p id="app-edit-status" role="status" class="visually-hidden"></p></div>';
        const pageMarkup=authPreview?rawMarkup.replace(/<script src="\/(?:login|setup)\.js" defer><\/script>/,'<script src="/auth-preview.js" defer></script>').replace('</head>','<script src="/app-editor.js" defer></script></head>').replace('</body>',previewToolbar+'</body>'):rawMarkup;
        const sidebarPage=pageMarkup.includes('id="app-sidebar"'),source=scopedAsset(sidebarPage?'/sidebar-logo':'/logo'),branded=(sidebarPage?hasSidebarLogo:hasLogo)?pageMarkup.replace(/(<a class="brand"[^>]*>)[\s\S]*?<\/a>/g,'$1<img src="'+source+'" alt="Opstack" class="app-logo"></a>'):pageMarkup;
        const clockScripts=sidebarPage&&session&&can(session,'rostering.clock')?'<script src="/clock-model.js" defer></script><script src="/shift-clock.js" defer></script><link rel="stylesheet" href="/shift-clock.css">':'';
        const arrangedScripts=branded.replace('<script src="/appearance-style.js" defer></script>','<script src="/appearance-style.js" defer></script><script src="/permission-model.js" defer></script><script src="/access.js" defer></script><script src="/formatted-text.js" defer></script><link rel="stylesheet" href="/formatted-text.css"><script src="/required-reading.js" defer></script><script src="/message-badge.js" defer></script><link rel="stylesheet" href="/required-reading.css">'+clockScripts+'<script src="/layout-model.js" defer></script><script src="/app-layout.js" defer></script>');
        const markup=layoutModel.renderMarkup(editParts.renderImages(editParts.renderIcons(editParts.annotate(arrangedScripts,file),overrides),overrides),layout.groups);
        const bootstrap=JSON.stringify({requiredReading:requiredReading||null,access:session?{role:session.role,roleName:session.roleName,roleLevel:session.roleLevel,permissions:session.permissions,networkPermissions:session.networkPermissions}:null,interfaceText:text,elementOverrides:overrides,hasLogo,hasSidebarLogo,fontLibrary,layout,layoutPage}).replace(/</g,'\\u003c');
        const fontUrl='/fonts/Opsilon-xRj8m.ttf?v='+font.etag.slice(1,-1);
        const dynamicPrefix='dynamic-'+req.url.replace(/[^a-z0-9]/gi,'_')+'-';
        const usedFonts=new Set([...Object.values(appearance.fonts||{}),...Object.entries(overrides).filter(([id,entry])=>entry.font&&(markup.includes('data-edit-id="'+id+'"')||id.startsWith(dynamicPrefix)||id.startsWith('type:'))).map(([,entry])=>entry.font)]);
        const uploadedPreloads=fontLibrary.filter(entry=>usedFonts.has(entry.id)).map(entry=>'<link rel="preload" href="'+entry.url+'" as="font" type="font/'+entry.extension+'" crossorigin>').join('');
        const contextScript='<script>window.appCompanyId='+JSON.stringify(appearanceCompany.id).replace(/</g,'\\u003c')+';window.appCompanyName='+JSON.stringify(platformAppearance?'Opstack':appearanceCompany.name).replace(/</g,'\\u003c')+';window.appPlatformAppearance='+JSON.stringify(platformAppearance)+';</script>';
        const initial='<script>window.appLocationId='+JSON.stringify(session?.locationId||'').replace(/</g,'\\u003c')+';document.documentElement.dataset.accountRole='+JSON.stringify(session?.role||'')+';</script>'+uploadedPreloads+'<style id="uploaded-font-faces">'+appearanceStyles.fontFaces(fontLibrary,appearanceCompany.id)+'</style><link rel="preload" href="'+fontUrl+'" as="font" type="font/ttf" crossorigin><style id="app-font">@font-face{font-family:Opsilon;src:url("'+fontUrl+'");font-weight:400;font-style:normal;font-display:block}</style><style id="appearance-style">'+appearanceStyles.build(appearance,fontLibrary)+'</style><style id="element-appearance-style">'+appearanceStyles.buildElements(overrides,markup,fontLibrary)+'</style><script id="app-bootstrap" type="application/json">'+bootstrap+'</script>';
        res.writeHead(200,{'Content-Type':contentType,'X-Content-Type-Options':'nosniff'});return res.end(markup.replace('<head>','<head>'+contextScript).replace('</head>',initial+'</head>'));
      }
      const cached=await asset(file);res.setHeader('ETag',cached.etag);
      res.setHeader('Cache-Control',file.endsWith('.ttf')&&requestUrl.searchParams.get('v')===cached.etag.slice(1,-1)?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate');
      if(req.headers['if-none-match']===cached.etag){res.writeHead(304);return res.end();}
      res.writeHead(200,{'Content-Type':contentType,'X-Content-Type-Options':'nosniff'});res.end(cached.data);
    } catch(error) {json(error.status||500,{error:error.status?error.message:'Unable to save changes. Please try again.'});}
  });
}
if(require.main===module) createServer().listen(process.env.PORT || 3000,'0.0.0.0',()=>console.log('Opstack running on port '+(process.env.PORT || 3000)));
module.exports={createServer,validateOrder};
