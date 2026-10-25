const http = require('node:http');
const stockOrderRules=require('./public/stock-order-rules');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const publicFiles=require('./public-files');
const globalSearch=require('./global-search');
const publicHolidays=require('./australian-public-holidays');
const prepLabels=require('./prep-labels');
const persistentShell=require('./persistent-shell');
const accountInvitations=require('./account-invitations');
const accountEmailSettings=require('./account-email-settings');
const aiBrandModel=require('./public/ai-brand-model');
const aiAssistance=require('./ai-assistance'),scheduledReports=require('./scheduled-reports');
const newNetworkDefaults=require('./new-network-defaults');
const {createPublicAssets}=require('./public-assets');
const {appOrigin,runtimeConfig,prepareDataDirectory}=require('./runtime-config');
const {createAuth}=require('./auth');
const {isSupport,parsedBody,supportIdentity}=require('./platform-identity');
const {createPlatformServer}=require('./opstack-router');
const {headOffice,managesUsers,locationIds,can,any:canAny,canAccessLocation}=require('./permissions');
const {apiPermission,pagePermission}=require('./access-routes');
const profilePhotos=require('./profile-photos');
const locationHoursModel=require('./public/location-hours-model');
const kioskDevices=require('./kiosk-devices'),kioskPolicy=require('./kiosk-policy');
const companies=require('./companies'),catalogues=require('./catalogue-store'),customisations=require('./company-customisations');
const {defaults,validateSettings,saveAppearance,readAppearance}=require('./appearance');
const {validateDelivery,providerStatus,deliveryConfigurationIssue,dispatchOrder}=require('./order-delivery');
const deliverySettings=require('./delivery-settings');
const orderEmailTemplates=require('./order-email-templates'),orderConfirmation=require('./order-confirmation');
const {splitBySupplier}=require('./supplier-orders');
const orderHistory=require('./order-history');
const interfaceText=require('./interface-text');
const elementOverrides=require('./element-overrides');
const wordingModel=require('./public/wording-model');
const homeBoard=require('./home-board'),homeGreeting=require('./home-greeting'),homeOperations=require('./home-operations');
const layouts=require('./layouts'),layoutModel=require('./public/layout-model');
const uploadedFonts=require('./uploaded-fonts');
const appearanceStyles=require('./public/appearance-style');const editParts=require('./public/edit-parts');
const stockCounts=require('./stock-counts');
const stockCountGroups=require('./public/stock-count-groups');
const manualPar=require('./manual-par');
const stockUsage=require('./stock-usage');
const stockTransfers=require('./stock-transfers');
const sales=require('./sales'),hourlySales=require('./hourly-sales'),hourlySalesModel=require('./hourly-sales-model');
const weeklySalesReports=require('./weekly-sales-reports'),weeklySalesImport=require('./weekly-sales-import'),weeklySalesOverview=require('./weekly-sales-overview'),operatingExpenseTypes=require('./operating-expense-types'),operatingExpenseSchedule=require('./operating-expense-schedule');
const reporting=require('./reporting'),reportingDetails=require('./reporting-details');
const locations=require('./locations');
const locationSetup=require('./location-setup');
const invoices=require('./invoices'),invoicePrices=require('./invoice-prices');
const communications=require('./communications'),communicationRoutes=require('./communications-routes');
const opsManagement=require('./ops-management');
const learningCentre=require('./learning-centre');
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
    if(!stockOrderRules.valid(product,item.quantity))throw Error(product.name+': '+stockOrderRules.describe(product)+'. Enter a quantity up to '+stockOrderRules.maximum(product)+'.');
    return {id:product.id,name:product.name,sku:product.sku||'',unitAmount:product.unitAmount||'',supplierId:product.supplierId,supplier:product.supplier,quantity:item.quantity,price:product.price};
  });
  return {id:crypto.randomUUID(),name:requesterName.trim(),phone:typeof body.phone === 'string' ? body.phone.trim() : '',notes:typeof body.notes === 'string' ? body.notes.slice(0,500) : '',items,total:items.reduce((sum,i)=>sum+i.price*i.quantity,0),createdAt:new Date().toISOString(),pricePending:items.some(i=>i.price===null),status:'requested',location:typeof body.location === 'string' ? body.location.slice(0,200) : ''};
}
function createNetworkServer(dataDir,{fetchImpl,communicationsNow=Date.now,rosteringNow=Date.now,transfersNow=Date.now,salesNow=Date.now,invitationNow=Date.now,locationNow=Date.now,kioskNow=Date.now,publicOrigin='',migrationMode=false,platformDataDir=dataDir,platformStore,network={id:'default',name:'Existing network'}}={}) {
  publicOrigin=appOrigin(publicOrigin);
  const requestOrigin=req=>publicOrigin||`http${req.socket.encrypted?'s':''}://${req.headers.host}`;
  const secureCookie=req=>publicOrigin?publicOrigin.startsWith('https://'):Boolean(req.socket.encrypted);
  const photoStore=profilePhotos.createStore(dataDir);
  const auth=createAuth(dataDir,{clockNow:rosteringNow,invitationNow,emailRoot:platformDataDir}),invitationAttempts=new Map();
  const locationStore=locations.createStore(dataDir,auth);
  const companyStore=companies.createStore(dataDir,locationStore,{defaultsRoot:platformDataDir});
  const kioskStore=kioskDevices.createStore(dataDir,{networkId:network.id,now:kioskNow,location:id=>locationStore.get(id),context:(actor,id)=>auth.forCompany(actor,id),openStaff:async(pin,id)=>companyStore.context(await locationStore.sessionContext(await auth.openKiosk(pin,id),id)),staffSession:async(token,id)=>{const raw=await auth.session({headers:{cookie:'admin_session='+token}});return raw?companyStore.context(await locationStore.sessionContext(raw,id)):null;},closeStaff:token=>auth.logout(token)});
  let defaultsMigration;
  async function communicationPeople(){const [accounts,stores,levels]=await Promise.all([auth.directory().then(photoStore.decorate),auth.levels.locations(),auth.levels.read()]),companyIds=[...new Set(stores.filter(store=>!store.archived).map(store=>store.companyId||'default'))];const people=accounts.map(account=>{const context=auth.levels.decorate(account,stores.find(store=>store.id===account.locationId)?.companyId||'default',levels,stores);return{id:account.id,username:account.username,photoUrl:account.photoUrl,companyIds:can(context,'network.access')?companyIds:[...new Set(stores.filter(store=>!store.archived&&locationIds(account).includes(store.id)).map(store=>store.companyId||'default'))]};});const operators=platformStore?(await platformStore.summary()).accounts.filter(account=>!account.disabled&&!account.pending):[];return[...people,...operators.map(account=>({id:'opstack-'+account.id,username:account.username+' (Opstack)',companyIds}))];}
  const prepLabelStore=prepLabels.createStore(dataDir,{locations:actor=>locationStore.accessible(actor),allLocations:()=>auth.levels.locations(),now:communicationsNow});
  const opsStore=opsManagement.createStore(dataDir,{locations:actor=>locationStore.accessible(actor,{includeTradingHours:true}),people:()=>auth.directory(),roleLevels:async actor=>(await auth.permissionLevels(actor)).levels,now:communicationsNow});
  const libraryStore=knowledgeLibrary.createStore(dataDir);
  const aiStore=aiAssistance.createStore(dataDir,{fetchImpl,now:communicationsNow,library:libraryStore});
  const learningStore=learningCentre.createStore(dataDir,{library:libraryStore,people:async companyId=>{const[accounts,data,stores]=await Promise.all([auth.directory(),auth.levels.read(),auth.levels.locations()]);return accounts.map(account=>auth.levels.decorate(account,companyId,data,stores));},locations:actor=>locationStore.accessible(actor),roles:async actor=>(await auth.permissionLevels(actor)).levels,now:communicationsNow});
  // Rich editors share private media URLs; article and training access follow their current audiences.
  const communicationStore=communications.createStore(dataDir,{people:communicationPeople,now:communicationsNow,extraMediaAccess:async(actor,record)=>await libraryStore.canReadMedia(actor,record)||await learningStore.canReadMedia(actor,record)});
  const catalogueStore=catalogues.createStore(dataDir,menu);
  const locationSetupStore=locationSetup.createStore(dataDir,{locations:locationStore,auth,catalogues:catalogueStore,now:locationNow});
  const usageHistory=stockUsage.createReader();
  const transferStore=stockTransfers.createStore(dataDir,{locations:locationStore,companies:companyStore,catalogues:catalogueStore,context:async(actor,id)=>companyStore.context(await locationStore.sessionContext(actor,id)),now:transfersNow});
  const salesStore=sales.createStore(),hourlySalesStore=hourlySales.createStore(dataDir,{now:salesNow});
  const awardStore=awardCompliance.createStore(dataDir,{people:()=>auth.directory(),locations:()=>auth.levels.locations(),now:rosteringNow,fetchImpl});
  const rosteringStore=rostering.createStore(dataDir,{unlockClockPin:(actor,input)=>auth.unlockClock(actor,input),authorizeClock:(actor,input)=>auth.authorizeClock(actor,input),clockIdentity:actor=>auth.clockIdentity(actor),verifyClockPin:(actor,input,manager)=>auth.verifyClockPin(actor,input,manager),locations:async actor=>(await locationStore.accessible(actor)).filter(shop=>!actor.kiosk||shop.id===actor.locationId),awards:awardStore,people:()=>auth.directory(),forecast:async(actor,weekStart)=>{
    const [projection,hourly,location]=await Promise.all([sales.rosterProjection(dataDir,actor,weekStart,{now:new Date(rosteringNow())}),hourlySalesStore.read(actor),locationStore.status(actor.locationId,rosteringNow())]);
    return{...projection,hourly:{days:projection.daily.map(day=>hourlySales.forecast(hourly,day.date,projection)),tradingHours:location.tradingHours}};
  },now:rosteringNow});
  const weeklySalesReportStore=weeklySalesReports.createStore();
  const reportSources=require('./ai-report-sources').createSources({dir:dataDir,auth,locations:locationStore,companies:companyStore,catalogues:catalogueStore,history:usageHistory,sales:salesStore,weekly:weeklySalesReportStore,learning:learningStore,ops:opsStore,now:communicationsNow});
  const reportStore=scheduledReports.createStore(dataDir,{sources:reportSources,ai:aiStore,auth,locations:locationStore,now:communicationsNow,fetchImpl,origin:publicOrigin,isActive:async()=>!platformStore||Boolean((await platformStore.network(network.id))?.active)});
  const manualParStore=manualPar.createStore();
  function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
  async function body(req,limit=16000){if(req[parsedBody]!==undefined)return req[parsedBody];const chunks=[];let length=0;for await(const chunk of req){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);length+=bytes.length;if(length>limit)fail('Request is too large.',413);chunks.push(bytes);}try{return JSON.parse(Buffer.concat(chunks,length).toString('utf8'));}catch{fail('Invalid JSON.');}}
  function name(value,label,max=100){if(typeof value !== 'string'||!value.trim()||value.length>max)fail('Enter a valid '+label+'.');return value.trim();}
  const publicAssets=createPublicAssets(path.join(__dirname,'public'),publicFiles),asset=publicAssets.read;
  const platformDir=path.join(platformDataDir,'platform-appearance');
  async function currentAppearance(dir,platform){const saved=await readAppearance(dir),seed=platform?await newNetworkDefaults.snapshot(dataDir):null;return seed?{...saved,primary:seed.primary,secondary:seed.secondary,fonts:newNetworkDefaults.files(seed)['appearance.json'].fonts}:saved;}
  async function readLogo(dir,sidebar=false){
    for(const scope of [...new Set([dir,platformDir])])for(const file of sidebar?['sidebar-logo.json','logo.json']:['logo.json']){
      try{return {...JSON.parse(await fs.readFile(path.join(scope,file),'utf8')),scope:scope===platformDir?'platform':'company'};}catch(error){if(error.code!=='ENOENT')throw error;}
    }
    let bytes;try{bytes=await fs.readFile(path.join(__dirname,'public/assets/branding',sidebar?'opstack-wordmark.png':'opstack-symbol.png'));}catch(error){if(error.code!=='ENOENT'||!await platformStore?.enabled())throw error;bytes=await fs.readFile(path.join(__dirname,'public/assets/branding/opstack-icon.png'));}
    return {type:'image/png',data:bytes.toString('base64'),scope:'platform'};
  }
  const server=http.createServer(async (req,res) => {
    const json = (code,body) => {res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      const requestUrl=new URL(req.url,'http://localhost'),embeddedContent=req.headers['sec-fetch-dest']==='iframe'||requestUrl.searchParams.get('__opstack_content')==='1';requestUrl.searchParams.delete('__opstack_content');req.url=requestUrl.pathname;
      res.setHeader('Cache-Control','no-store');
      if(['GET','HEAD'].includes(req.method)&&req.url==='/healthz')return json(200,{ok:true,migrationMode});
      if(migrationMode){res.setHeader('Retry-After','60');res.writeHead(503,{'Content-Type':'text/plain; charset=utf-8'});return res.end('Opstack is moving data. Please try again shortly.');}
      if(await publicAssets.serve(req,res,requestUrl))return;
      if(!defaultsMigration)defaultsMigration=newNetworkDefaults.migrate(dataDir,platformDataDir).catch(error=>{defaultsMigration=undefined;throw error;});
      await defaultsMigration;
      if(req.url==='/accept-invite'){res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');}
      if(req.method==='POST'&&['/api/invitations/inspect','/api/invitations/accept'].includes(req.url)){
        if(req.headers['content-type']!=='application/json'||(req.headers.origin&&req.headers.origin!==requestOrigin(req)))fail('Invalid account setup request.',403);
        const key=req.socket.remoteAddress,now=Date.now();let rate=invitationAttempts.get(key);if(!rate||rate.until<=now){rate={count:0,until:now+15*60000};invitationAttempts.set(key,rate);}if(rate.count>=40)fail('Too many setup attempts. Try again in 15 minutes.',429);
        try{const input=await body(req,9000),result=req.url.endsWith('/inspect')?await auth.invitationInfo(input?.token):await auth.acceptInvitation(input);invitationAttempts.delete(key);return json(200,result);}catch(error){if(error.status>=400&&error.status<500)rate.count++;throw error;}
      }
      if(req.url==='/api/setup'&&req.method==='POST'){
        if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))fail('First-time setup must be opened on the computer running the app.',403);
        if(req.headers['content-type']!=='application/json'||(req.headers.origin&&req.headers.origin!==requestOrigin(req)))fail('Invalid setup request.',403);
        const account=await auth.setup(await body(req));await locationStore.ensure(true);return json(201,(await auth.list()).find(saved=>saved.id===account.id));
      }
      if(req.method==='GET'&&req.url==='/admin/login'){res.writeHead(303,{Location:'/login'});return res.end();}
      if(req.method==='GET'&&['/login','/setup','/accept-invite','/admin/appearance/signin','/admin/appearance/setup'].includes(req.url)&&requestUrl.searchParams.has('company')){res.writeHead(303,{Location:req.url});return res.end();}
      if(req.method==='GET'&&req.url==='/login'&&!await auth.configured()&&!await platformStore?.enabled()){res.writeHead(303,{Location:'/setup'});return res.end();}
      if(req.method==='GET'&&req.url==='/setup'&&await auth.configured()){res.writeHead(303,{Location:'/login'});return res.end();}
      await locationStore.ensure();await companyStore.ensure();
      const kioskCookie=kioskDevices.cookie(req),kioskDevice=await kioskStore.device(req),kioskStaff=await kioskStore.worker(kioskDevice);
      const kioskCsrf=kioskCookie?crypto.createHash('sha256').update(kioskCookie+':csrf').digest('hex'):'';
      const deviceCookie=value=>`opstack_kiosk=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value?365*86400:0}${secureCookie(req)?'; Secure':''}`;
      const addCookie=value=>res.setHeader('Set-Cookie',[...(res.getHeader('Set-Cookie')||[]),value]);
      if(kioskDevice&&req.url==='/api/logout'&&req.method==='POST'){if(!kioskStaff||req.headers['x-csrf-token']!==kioskStaff.actor.csrf)fail('Invalid session token.',403);kioskStore.lock(kioskDevice.id);return json(200,{signedOut:true});}
      if(req.url.startsWith('/api/kiosk/')){
        if(req.method==='GET'&&req.url==='/api/kiosk/status'){if(kioskCookie&&!kioskDevice)addCookie(deviceCookie(''));return json(200,{now:new Date(kioskNow()).toISOString(),paired:Boolean(kioskDevice),...(kioskDevice?{device:{id:kioskDevice.id,name:kioskDevice.name,locationId:kioskDevice.locationId,locationName:kioskDevice.locationName},features:kioskPolicy.features,csrf:kioskCsrf,worker:kioskStaff?{sessionId:kioskStaff.sessionId,username:kioskStaff.actor.username,feature:kioskStaff.feature,expiresAt:kioskStaff.expiresAt}:null}:{}),network:network.slug||'default'});}
        if(req.method!=='POST')fail('Unsupported kiosk action.',405);
        if(req.headers['content-type']!=='application/json'||req.headers.origin&&req.headers.origin!==requestOrigin(req))fail('Invalid kiosk request origin or content type.',403);
        if(req.url==='/api/kiosk/pair'){const result=await kioskStore.pair(req,await body(req));const previousToken=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('admin_session='))?.slice(14);if(previousToken)auth.logout(previousToken);addCookie(deviceCookie(result.token));addCookie(`opstack_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie(req)?'; Secure':''}`);addCookie(`admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie(req)?'; Secure':''}`);addCookie(`opstack_support=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie(req)?'; Secure':''}`);return json(200,{paired:true});}
        if(!kioskDevice)fail('Pair this device before continuing.',401);
        if(req.headers['x-csrf-token']!==kioskCsrf)fail('Reload the kiosk before continuing.',403);
        if(req.url==='/api/kiosk/unlock'){await kioskStore.unlock(req,await body(req));return json(200,{unlocked:true,url:'/home'});}
        if(req.url==='/api/kiosk/lock'){kioskStore.lock(kioskDevice.id);return json(200,{locked:true});}
        if(req.url==='/api/kiosk/touch'){if(!kioskStaff)fail('Enter your PIN again.',401);return json(200,await kioskStore.touch(kioskDevice,kioskStaff.actor.csrf));}
        fail('Kiosk action not found.',404);
      }
      if(req.url==='/kiosk'&&req.method==='GET'&&kioskStaff){res.writeHead(303,{Location:'/home'});return res.end();}
      if(kioskCookie&&req.url!=='/kiosk'){
        if(!kioskDevice||!kioskStaff){if(req.method==='GET'&&!req.url.startsWith('/api/')){res.writeHead(303,{Location:'/kiosk'});return res.end();}fail('Enter your staff PIN at the kiosk.',401);}
        if(req.headers['x-location-id']&&req.headers['x-location-id']!==kioskDevice.locationId||req.headers['x-company-id']&&req.headers['x-company-id']!==kioskDevice.companyId||requestUrl.searchParams.has('company')&&requestUrl.searchParams.get('company')!==kioskDevice.companyId)fail('This kiosk is assigned to another location.',403);
        if(!kioskPolicy.allowed(kioskStaff.feature,req.url,req.method))fail('This action is not available on this kiosk.',403);
      }
      let session=kioskCookie?kioskStaff?.actor||null:req.url==='/kiosk'?null:await companyStore.context(await locationStore.sessionContext(await auth.session(req),req.headers['x-location-id']));
      const setupTask=requestUrl.searchParams.get('__opstack_setup');
      if(req.url==='/location-setup-step'&&!setupTask)fail('Open this editor from the location setup popup.',400);
      if(setupTask){if(!session)fail('Sign-in required.',401);if(req.method!=='GET'||!embeddedContent)fail('Open this editor from the setup popup.',400);const target=requestUrl.searchParams.get('setupLocation');if(kioskCookie&&target!==kioskDevice.locationId)fail('This kiosk is assigned to another location.',403);session=await companyStore.context(await locationStore.sessionContext(session,target));await locationSetupStore.editor(session,target,setupTask,req.url);}
      const customisationRoutes=['/logo','/sidebar-logo','/appearance','/interface-text','/element-overrides','/font-library','/api/logo','/api/sidebar-logo','/api/settings','/api/fonts','/api/interface-text','/api/element-overrides','/layouts','/api/layout','/api/home-dashboard','/api/home-greeting'];
      const authPage=['/login','/setup','/accept-invite','/admin/appearance/signin','/admin/appearance/setup'].includes(req.url),fontAsset=req.url.startsWith('/uploaded-fonts/'),settingsPage=['/admin/settings','/settings'].includes(req.url);
      const platformAppearance=authPage||((customisationRoutes.includes(req.url)||fontAsset||settingsPage)&&(req.headers['x-app-appearance']==='platform'||requestUrl.searchParams.get('platform')==='1'));
      const sharedAppearance=platformAppearance&&(settingsPage||req.url.startsWith('/admin/appearance/')||requestUrl.searchParams.get('console')==='1'||req.headers['x-opstack-shared-appearance']==='1');
      const platformWrite=platformAppearance&&((req.url.startsWith('/api/')&&customisationRoutes.includes(req.url))||settingsPage||req.url.startsWith('/admin/appearance/'));
      if(platformWrite&&await platformStore?.enabled()&&(!isSupport(session)||session[supportIdentity].platformRole!=='owner'))fail('Manage shared sign-in appearance from the Opstack owner console.',403);
      if(platformWrite){if(!session){if(req.url.startsWith('/api/'))fail('Sign-in required.',401);res.writeHead(303,{Location:'/login'});return res.end();}if(!can(session,'network.access')||!can(session,'appearance.manage')){if(req.url.startsWith('/api/'))fail('Head Office platform appearance permission required.',403);res.writeHead(303,{Location:'/'});return res.end();}}
      if(await platformStore?.enabled()&&!platformAppearance&&(customisationRoutes.includes(req.url)||fontAsset)&&!session)fail('Sign-in required.',401);
      const requestedCompany=!platformAppearance&&(customisationRoutes.includes(req.url)||fontAsset||settingsPage)?(req.headers['x-company-id']||requestUrl.searchParams.get('company')):undefined;
      const appearanceCompany=await companyStore.get(requestedCompany||session?.companyId||kioskDevice?.companyId||companies.defaultCompanyId);
      if(session&&requestedCompany&&!can(session,'network.access')&&!(await companyStore.accessible(session)).some(company=>company.id===appearanceCompany.id))fail('You do not have access to this company.',403);
      if(session&&requestedCompany&&(settingsPage||req.url.startsWith('/admin/appearance/')||(req.url.startsWith('/api/')&&customisationRoutes.includes(req.url)))&&session.companyId!==appearanceCompany.id){const target=await companyStore.switchLocation(session,appearanceCompany.id);session=await companyStore.context(await locationStore.sessionContext(session,target.id));}
      const customisationDir=platformAppearance?platformDir:customisations.folder(dataDir,appearanceCompany.id),scopedAsset=url=>platformAppearance?url+(url.includes('?')?'&':'?')+'platform=1':customisations.assetUrl(url,appearanceCompany.id),fontEntry=font=>({...font,url:scopedAsset('/uploaded-fonts/'+font.id.slice(7)+'.'+font.extension)}),readFontLibrary=async()=>(await uploadedFonts.list(customisationDir)).map(fontEntry);
      if(req.method==='GET'&&['/logo','/sidebar-logo'].includes(req.url)){
        try{const logo=await readLogo(customisationDir,req.url==='/sidebar-logo');res.writeHead(200,{'Content-Type':logo.type,'X-Content-Type-Options':'nosniff','X-Branding-Scope':logo.scope});return res.end(Buffer.from(logo.data,'base64'));}catch(error){if(error.code==='ENOENT')return json(404,{error:'No logo uploaded.'});throw error;}
      }
      if(req.method==='GET'&&req.url==='/appearance'){
        return json(200,await currentAppearance(customisationDir,platformAppearance&&!sharedAppearance));
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
      if(req.method==='GET'&&req.url==='/api/session')return json(200,session?{networkId:network.id,networkName:req.opstackNetwork?.name||network.name,homeGreeting:(await homeGreeting.read(customisations.folder(dataDir,session.companyId),(await newNetworkDefaults.companySnapshot(dataDir,session.companyId))?.greeting||'Hello {user}')).text,opstackManaged:Boolean(await platformStore?.enabled()),opstackSupport:isSupport(session),role:session.role,roleName:session.roleName,homeDashboard:session.homeDashboard||'manager',roleLevel:session.roleLevel,permissions:session.permissions,networkPermissions:session.networkPermissions,permissionRevision:session.permissionRevision,username:session.username,id:session.id,photoUrl:(await photoStore.describe(session.id)).photoUrl,csrf:session.csrf,locationId:session.locationId,locationName:session.locationName,companyId:session.companyId,companyName:session.companyName,companies:kioskCookie?[{id:session.companyId,name:session.companyName}]:await companyStore.accessible(session),locations:kioskCookie?[{id:session.locationId,name:session.locationName}]:(await locationSetupStore.decorate(await locationStore.accessible(session))).map(({id,name,setupPending})=>({id,name,...(setupPending?{setupPending:true}:{})})),dataScope:session.dataScope,canMigrateBrowserData:kioskCookie?false:session.canMigrateBrowserData,...(kioskStaff?{kiosk:{deviceId:kioskDevice.id,deviceName:kioskDevice.name,sessionId:kioskStaff.sessionId,expiresAt:kioskStaff.expiresAt}}:{})}:{role:'user'});
      if(req.method==='POST'&&req.url==='/api/login'){
        if(req.headers.origin&&req.headers.origin!==requestOrigin(req))fail('Invalid request origin.',403);
        const input=await body(req),loggedIn=await auth.login(req,input);
        res.setHeader('Set-Cookie',[...(res.getHeader('Set-Cookie')||[]),`admin_session=${loggedIn.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie(req)?'; Secure':''}`]);
        return json(200,{role:loggedIn.role});
      }
      const privatePages=['/location-setup-step','/order-history','/','/home','/cart','/stock-count','/stock-transfers','/sales','/reporting','/email-settings','/admin','/admin/accounts','/admin/settings','/settings','/settings/devices','/settings/awards','/rostering','/communications','/knowledge-library','/learning-centre','/ops-management','/labels','/admin/appearance/signin','/admin/appearance/setup'];
      let requiredReading;
      const setupStepRoute=req.url.match(/^\/api\/location-setup\/steps\/([a-zA-Z0-9-]+)\/(team|par|devices)$/);
      if(setupStepRoute){
        if(!session)fail('Sign-in required.',401);const[,id,task]=setupStepRoute;
        if(session.locationId!==id)fail('The setup location changed. Reopen this step.',409);
        const step=await locationSetupStore.editor(session,id,task,'/location-setup-step');
        if(!isSupport(session)){const required=await communicationStore.required(session);if(required.due.length)return json(428,{error:'Read or snooze the required posts before continuing.',code:'REQUIRED_POSTS',required});}
        const base={locationId:id,locationName:session.locationName,companyId:session.companyId};
        if(req.method==='GET'){
          if(task==='team'){const[users,roles,state]=await Promise.all([auth.list(session),auth.permissionLevels(session),locationSetupStore.status(session,id)]);return json(200,{...base,selectedUserId:state.locations.find(l=>l.id===id)?.firstUserId||null,users:users.filter(u=>!u.invitation).map(u=>({id:u.id,username:u.username})),roles:roles.levels.filter(r=>r.assignable).map(r=>({id:r.id,name:r.name}))});}
          if(task==='par'){const[catalogue,manual]=await Promise.all([readCatalogue(),manualParStore.read(dataDir,id)]),levels=await stockUsage.parLevels(dataDir,session,catalogue.products,{reader:usageHistory,manualLevels:manual});return json(200,{...base,products:catalogue.products.filter(p=>!p.archived).map(p=>({id:p.id,name:p.name,sku:p.sku||'',unitAmount:p.unitAmount||'',supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name||'',manualLevel:levels.levels[p.id]?.manualLevel??null,automatic:levels.levels[p.id]?.source==='usage',level:levels.levels[p.id]?.level??null}))});}
          return json(200,{...base,network:network.slug||'default'});
        }
        if(req.method!=='POST'||task==='par')fail('Unsupported setup action.',405);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);
        const input=await body(req);if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter the setup details.');if(input.locationId!==undefined&&input.locationId!==id||input.companyId!==undefined&&input.companyId!==session.companyId)fail('The setup company or location changed.',409);
        if(task==='devices')return json(201,await kioskStore.create(session,{name:input.name,locationId:id,features:['app'],requestId:input.requestId}));
        let user;if(input.mode==='existing')user=await auth.addLocation(session,input.userId,id,target=>locationStore.get(target,{active:true}));
        else if(input.mode==='new')user=await auth.create(session,{username:input.username,password:input.password,phoneNumber:input.phoneNumber,role:input.role,roleScope:'company',companyId:session.companyId,locationId:id,locationIds:[id]},target=>locationStore.get(target,{active:true}));
        else fail('Choose a new or existing user.');
        await locationSetupStore.firstUser(session,id,user.id);return json(200,{saved:true,user:{id:user.id,username:user.username}});
      }
      if(req.url.startsWith('/api/location-setup')){
        if(!session)fail('Sign-in required.',401);
        if(req.method==='GET'&&req.url==='/api/location-setup')return json(200,await locationSetupStore.status(session,requestUrl.searchParams.get('location')));
        if(req.method!=='POST')fail('Unsupported setup action.',405);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);
        const action={'/api/location-setup/snooze':'snooze','/api/location-setup/review':'review','/api/location-setup/complete':'complete'}[req.url];
        if(!action)fail('Setup action not found.',404);
        if(action!=='snooze'&&!isSupport(session)){const required=await communicationStore.required(session);if(required.due.length)return json(428,{error:'Read or snooze the required posts before continuing.',code:'REQUIRED_POSTS',required});}
        const input=await body(req);return json(200,await locationSetupStore[action](session,input));
      }
      if(session&&!isSupport(session)){const exempt=['/api/session','/api/login','/api/logout','/api/communications/required'].includes(req.url)||(req.method==='GET'&&/^\/api\/communications\/media\/[a-f0-9-]+$/i.test(req.url))||/^\/api\/communications\/posts\/[a-f0-9-]+\/(read|snooze)$/i.test(req.url);if((req.url.startsWith('/api/')&&!exempt)||(req.method==='GET'&&privatePages.includes(req.url))){requiredReading=await communicationStore.required(session);if(requiredReading.due.length){if(req.url.startsWith('/api/'))return json(428,{error:'Read or snooze the required posts before continuing.',code:'REQUIRED_POSTS',required:requiredReading});if(req.url!=='/communications'){res.writeHead(303,{Location:'/communications?returnTo='+encodeURIComponent(requestUrl.pathname+requestUrl.search)+'#required'});return res.end();}}}}
      const photoRoute=req.url.match(/^\/api\/profile-photos\/([a-zA-Z0-9-]{1,100})(\/settings)?$/);
      if(photoRoute){
        if(!session)fail('Sign-in required.',401);const id=photoRoute[1],settings=Boolean(photoRoute[2]);
        if(req.method==='GET'){
          let allowed=await auth.photoAccess(session,id,settings);
          if(!allowed&&can(session,'comms.view'))allowed=(await communicationStore.threads(session)).threads.some(thread=>thread.members.some(member=>member.id===id));
          if(!allowed)fail('Profile photo not found.',404);
          if(settings)return json(200,await photoStore.describe(id));
          const bytes=await photoStore.bytes(id);res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(bytes);
        }
        if(settings||!['PUT','DELETE'].includes(req.method))fail('Unsupported profile photo action.',405);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);
        await auth.photoAccess(session,id,true);const input=await body(req,360000);return json(200,await photoStore.change(id,input,req.method==='DELETE',()=>auth.photoAccess(session,id,true)));
      }
      if(await communicationRoutes.route({req,res,url:req.url,params:requestUrl.searchParams,session,store:communicationStore,body,json,fail}))return;
      if(await prepLabels.route({req,url:req.url,params:requestUrl.searchParams,session,store:prepLabelStore,body,json}))return;
      if(await scheduledReports.route({req,url:req.url,session,store:reportStore,body,json}))return;
      if(req.url==='/api/invoices/intelligence'){
        if(!session)fail('Sign in to read invoices with intelligence.',401);
        if(req.method!=='POST')fail('Use POST to read an invoice with intelligence.',405);
        if(!can(session,'invoices.view')||!can(session,'invoices.edit'))fail('Invoice editing permission required.',403);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);
        const input=await body(req,6500000);if(!input||typeof input!=='object'||Array.isArray(input))fail('Choose an invoice scan.');
        const checkInvoice=async actor=>{if(input.invoiceId){const record=await invoices.read(dataDir,actor,input.invoiceId);if(record.revision!==input.revision)fail('This invoice changed. Reopen it before reading it again.',409);}};
        await checkInvoice(session);const result=await aiStore.generateInvoice(session,input);
        const current=kioskCookie?(await kioskStore.worker(await kioskStore.device(req)))?.actor:await companyStore.context(await locationStore.sessionContext(await auth.session(req),session.locationId));
        if(!current||current.id!==session.id||current.csrf!==session.csrf)fail('Sign in again before reading this invoice.',401);
        if(current.companyId!==session.companyId||current.locationId!==session.locationId)fail('The selected company or location changed.',409);
        if(!can(current,'invoices.view')||!can(current,'invoices.edit'))fail('Invoice editing permission required.',403);
        if(!isSupport(current)){const required=await communicationStore.required(current);if(required.due.length)return json(428,{error:'Read or snooze the required posts before continuing.',code:'REQUIRED_POSTS',required});}
        const config=await aiStore.status(current);if(!config.enabled||!config.configured)fail('OpStack intelligence is no longer enabled for this company.',503);
        await checkInvoice(current);return json(200,result);
      }
      if(await aiAssistance.route({req,url:req.url,session,store:aiStore,body,json}))return;
      if(await opsManagement.route({req,res,url:req.url,params:requestUrl.searchParams,session,store:opsStore,body,json,fail}))return;
      if(await learningCentre.route({req,res,url:req.url,params:requestUrl.searchParams,session,store:learningStore,body,json,fail}))return;
      if(await knowledgeLibraryRoutes.route({req,url:req.url,params:requestUrl.searchParams,session,store:libraryStore,body,json,fail}))return;
      if(req.url==='/api/award-source'&&req.method==='GET'){if(!can(session,'awards.manage'))fail('Award settings permission required.',403);res.writeHead(200,{'Content-Type':'application/pdf','Cache-Control':'private, no-store'});return res.end(await fs.readFile(path.join(__dirname,'docs/awards/ma000003-2026-07.pdf')));}
      if(await awardCompliance.route({req,url:req.url,session,store:awardStore,body,json,fail}))return;
      if(kioskStaff&&['/api/rostering/clock','/api/rostering/clock-unlock','/api/rostering/clock-status'].includes(req.url)){const value=await rosteringStore.clockStatus(session);if(value.entry&&value.entry.locationId!==kioskDevice.locationId)fail('You are clocked in at another location. Use that location’s time clock.',409);}
      if(await rosteringRoutes.route({req,url:req.url,params:requestUrl.searchParams,session,store:rosteringStore,body,json,fail}))return;
      if(await stockTransfers.route({req,url:req.url,params:requestUrl.searchParams,session,store:transferStore,body,json}))return;
      const required=apiPermission(req.url,req.method);
      if(required){if(!session)fail('Sign-in required.',401);if(!canAny(session,required))fail('Your permission level does not allow this action.',403);}
      const management=required&&!['/api/menu','/api/catalogue'].includes(req.url)&&(required.some(key=>key.endsWith('.manage'))||req.url.startsWith('/api/permission-levels')||req.url.startsWith('/api/companies'));
      if(management&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
      if(req.method==='POST'&&req.url==='/api/logout'){if(!session)fail('Sign-in required.',401);if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);auth.logout(session.token);res.setHeader('Set-Cookie',`admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie(req)?'; Secure':''}`);return json(200,{signedOut:true});}
      if(req.url.startsWith('/api/')&&!session)fail('Sign-in required.',401);
      if(['/api/search','/api/search/intelligence'].includes(req.url)){
        const intelligent=req.url==='/api/search/intelligence';
        if(req.method!==(intelligent?'POST':'GET'))fail('Unsupported search action.',405);
        let query=requestUrl.searchParams.get('q')||'',plan;
        if(intelligent){
          if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
          const input=await body(req,2000);query=input?.query;
          await globalSearch.search(session,query);
          if(query.trim().length<2)fail('Enter at least two characters to search with intelligence.');query=query.trim();
          const pages=globalSearch.pagesFor(session).map(({id,title,text})=>({id,title,description:text}));
          plan=(await aiStore.generateSearch(session,{query,requestId:input.requestId},pages)).draft;
          // The paid call can take time. Recheck identity, scope and gates before reading records.
          const current=kioskCookie?(await kioskStore.worker(await kioskStore.device(req)))?.actor:await companyStore.context(await locationStore.sessionContext(await auth.session(req),session.locationId));
          if(!current||current.id!==session.id||current.csrf!==session.csrf)fail('Sign in again before searching.',401);
          if(current.companyId!==session.companyId||current.locationId!==session.locationId)fail('The selected company or location changed. Search again.',409);
          session=current;
          if(!isSupport(session)){const required=await communicationStore.required(session);if(required.due.length)return json(428,{error:'Read or snooze the required posts before continuing.',code:'REQUIRED_POSTS',required});}
          const config=await aiStore.status(session);if(!config.enabled||!config.configured)fail('OpStack intelligence is no longer enabled for this company.',503);
        }
        const providers={},filtered=(docs,terms)=>docs.filter(doc=>globalSearch.matches(doc.title+' '+doc.text,terms)),link=(route,q,hash='')=>route+'?q='+encodeURIComponent(q)+hash;
        if(canAny(session,['orders.view','counts.view','stock.manage','suppliers.manage']))providers.Stock=async(q,terms)=>{const catalogue=await readCatalogue(),stockRoute=can(session,'orders.view')?'/':can(session,'stock.manage')?'/admin':'/stock-count',canStock=canAny(session,['orders.view','stock.manage','counts.view']);return filtered([...(canStock?catalogue.products:[]).map(p=>({id:'stock:'+p.id,type:'Stock',title:p.name,text:[p.sku,p.unitAmount,catalogue.suppliers.find(s=>s.id===p.supplierId)?.name,p.category].filter(Boolean).join(' · '),url:stockRoute==='/admin'?'/admin?product='+p.id+'#stock':stockRoute==='/stock-count'&&!can(session,'counts.edit')?'/api/catalogue':link(stockRoute,p.sku||p.name),...(stockRoute==='/stock-count'&&!can(session,'counts.edit')?{action:'stock'}:{})})),...catalogue.suppliers.map(s=>({id:'supplier:'+s.id,type:'Suppliers',title:s.name,text:'Supplier catalogue',url:can(session,'orders.view')?link('/',s.name):can(session,'suppliers.manage')?'/admin#suppliers':link(stockRoute,s.name)}))],terms);};
        if(can(session,'knowledge.view')){let articles;providers['Knowledge Library']=()=>articles??=libraryStore.deepSearch(session,query,intelligent?plan.queries:[]);}
        if(can(session,'comms.view'))providers.Comms=(q,terms)=>communicationStore.search(session,terms);
        if(can(session,'learning.view'))providers['Learning centre']=async(q,terms)=>{const data=await learningStore.dashboard(session);return filtered([...data.courses.map(c=>({id:'course:'+c.id,type:'Courses',title:c.title,text:[c.description,c.category].filter(Boolean).join(' · '),url:link('/learning-centre',c.title,'#courses')})),...data.myLearning.map(a=>({id:'assignment:'+a.id,type:'My learning',title:a.title,text:a.progress.status,url:'/learning-centre#learn-'+a.id}))],terms);};
        if(can(session,'ops.view'))providers.Checklists=async(q,terms)=>{const data=await opsStore.list(session,{location:session.locationId});return filtered([...data.tasks.map(t=>({id:'task:'+t.plannerId,type:'Checklists',title:t.title,text:[t.plannerName,t.locationName,t.dueDate].filter(Boolean).join(' · '),url:link('/ops-management',t.title,'#checklists')})),...(can(session,'ops.manage')?data.templates.map(t=>({id:'template:'+t.id,type:'Checklist templates',title:t.title,text:t.description||'',url:link('/ops-management',t.title,'#templates')})):[])],terms);};
        if(can(session,'prep.view'))providers.Labels=async(q,terms)=>{const data=await prepLabelStore.list(session);return filtered(data.items.filter(p=>p.active||data.canManage).map(p=>({id:'label:'+p.id,type:'Labels',title:p.name,text:[p.category,p.notes].filter(Boolean).join(' · '),url:link('/labels',p.name)})),terms);};
        if(can(session,'users.manage'))providers.Users=async(q,terms)=>{const ids=new Set((await locationStore.list()).filter(s=>s.companyId===session.companyId).map(s=>s.id));return filtered((await auth.list(session)).filter(p=>locationIds(p).some(id=>ids.has(id))).map(p=>({id:'user:'+p.id,type:'Users',title:p.username,text:p.email||'',url:link('/admin/accounts',p.username,'#accounts')})),terms);};
        if(canAny(session,['users.manage','locations.manage','email.manage','companies.manage']))providers.Locations=async(q,terms)=>filtered((await locationStore.accessible(session)).filter(s=>s.companyId===session.companyId).map(s=>({id:'location:'+s.id,type:'Locations',title:s.name,text:'Company location',url:link('/admin/accounts',s.name,'#locations')})),terms);
        if(can(session,'home.view')&&can(session,'invoices.view'))providers.Invoices=(q,terms)=>invoices.search(dataDir,session,terms);
        if(can(session,'orders.view'))providers.Orders=async(q,terms)=>filtered((await usageHistory(dataDir)).orders.filter(order=>order.requestOwnerId===session.id&&belongs(order,session,'requestOwnerId')).map(o=>({id:'order:'+o.id,type:'Orders',title:'Order '+o.id,text:[o.createdAt?.slice(0,10),o.notes,...o.items.map(p=>p.name+' '+(p.sku||'')+' '+(p.supplier||''))].filter(Boolean).join(' · '),url:'/api/orders/'+o.id,action:'order'})),terms);
        if(intelligent)return json(200,await globalSearch.intelligentSearch(session,query,plan,providers));
        const result=await globalSearch.search(session,query,providers);
        let available=false;try{const config=await aiStore.status(session);available=config.enabled&&config.configured;}catch{}
        return json(200,{...result,intelligence:{available}});
      }
      if(req.url==='/api/kiosk-devices'&&req.method==='GET')return json(200,{...await kioskStore.list(session,await locationStore.list()),network:network.slug||'default'});
      if(req.url==='/api/kiosk-devices'&&req.method==='POST'){if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);return json(201,await kioskStore.create(session,await body(req)));}
      const kioskManagement=req.url.match(/^\/api\/kiosk-devices\/([a-f0-9-]{36})(?:\/(pair|revoke))?$/i);
      if(kioskManagement&&['PUT','POST'].includes(req.method)){if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);if(kioskManagement[2]&&req.method!=='POST'||!kioskManagement[2]&&req.method!=='PUT')fail('Unsupported kiosk management action.',405);return json(200,await kioskStore.update(session,kioskManagement[1],await body(req),kioskManagement[2]||'update'));}
      if(req.url==='/api/home-greeting'){
        if(platformAppearance)fail('Home greetings belong to a company.',400);
        const seed=(await newNetworkDefaults.companySnapshot(dataDir,appearanceCompany.id))?.greeting||'Hello {user}';
        if(req.method==='GET')return json(200,await homeGreeting.read(customisationDir,seed));
        if(req.method==='PUT')return json(200,await homeGreeting.save(customisationDir,await body(req,4000),seed));
        fail('Unsupported greeting action.',405);
      }
      if(req.url==='/api/home-dashboard'){
        if(platformAppearance)fail('Home sections belong to a company.',400);
        const dashboard=requestUrl.searchParams.get('dashboard')||session.homeDashboard||'manager';if(!['staff','manager'].includes(dashboard))fail('Choose Staff or Manager Home.');if(dashboard!==(session.homeDashboard||'manager')&&(!can(session,'appearance.manage')||session.homeDashboard==='staff'))fail('This Home dashboard is not available.',403);
        if(req.method==='GET')return json(200,await homeBoard.read(customisationDir,dashboard));
        if(req.method==='PUT')return json(200,await homeBoard.save(customisationDir,await body(req,64000),dashboard));
        fail('Unsupported Home action.',405);
      }
      if(req.url==='/api/permission-levels'&&req.method==='GET')return json(200,await auth.permissionLevels(session));
      const permissionLevelRoute=req.url.match(/^\/api\/permission-levels\/([a-zA-Z0-9-]+)$/);
      if((req.url==='/api/permission-levels'&&req.method==='POST')||(permissionLevelRoute&&['PUT','DELETE'].includes(req.method))){await auth.changePermissionLevel(session,await body(req,64000),req.method,permissionLevelRoute?.[1]);return json(req.method==='POST'?201:200,await auth.permissionLevels(await auth.forCompany(session,session.companyId)));}
      if(req.url==='/api/invoices/price-review'&&req.method==='POST'){if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);return json(200,await invoicePrices.createStore(dataDir,catalogueStore).review(session,await body(req,2000000)));}
      const priceConfirmation=req.url.match(/^\/api\/invoices\/([a-f0-9-]{36})\/confirm-prices$/i);
      if(priceConfirmation&&req.method==='POST'){if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);return json(200,await invoicePrices.createStore(dataDir,catalogueStore).confirm(session,priceConfirmation[1],await body(req,160000)));}
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
        if(req.method==='PUT')return json(200,await invoices.update(dataDir,session,id,await body(req,2000000)));
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
      if(req.url==='/api/companies'&&req.method==='POST'){if(!can(session,'network.access'))fail('Network access is required to create a company.',403);return json(201,await companyStore.create(await body(req),{setupCreatorId:session.id}));}
      const companyRoute=req.url.match(/^\/api\/companies\/([a-zA-Z0-9-]+)$/);if(companyRoute&&req.method==='PUT'){if(!can(await auth.forCompany(session,companyRoute[1]),'companies.manage')||!(await companyStore.accessible(session)).some(company=>company.id===companyRoute[1]))fail('You do not have access to this company.',403);return json(200,await companyStore.update(companyRoute[1],await body(req)));}
      if(req.url==='/api/locations'&&req.method==='GET'){
        const all=requestUrl.searchParams.get('all')==='true',companyList=await companyStore.list(session),records=(await Promise.all((await locationSetupStore.decorate(await locationStore.list())).filter(record=>all||record.companyId===session.companyId).map(async record=>{const context=await auth.forCompany(session,record.companyId);return canAccessLocation(context,record)&&canAny(context,['users.manage','locations.manage','email.manage','companies.manage'])&&(!record.archived||can(context,'locations.manage'))?record:null;}))).filter(Boolean);
        return json(200,await Promise.all(records.map(async record=>{const company=companyList.find(company=>company.id===record.companyId),base={...record,tradingStatus:require('./public/location-hours-model').status(record.tradingHours,locationNow(),record.archived),companyName:company?.name||''};if(!canAny(session,['locations.manage','email.manage','companies.manage']))return all?{id:base.id,name:base.name,archived:base.archived,companyId:base.companyId,companyName:base.companyName}:{id:base.id,name:base.name,archived:base.archived};if(!can(await auth.forCompany(session,record.companyId),'email.manage'))return base;const email=deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,record.id));return {...base,senderEmail:email.values.ORDER_FROM_EMAIL,orderEmailEnabled:email.enabled.DELIVERY_EMAIL_ENABLED};})));
      }
      if(req.url==='/api/public-holidays'){
        if(req.method!=='GET'){res.setHeader('Allow','GET');fail('Public holidays are read-only.',405);}
        const value=requestUrl.searchParams.get('year')||'',year=Number(value);
        if(!/^\d{4}$/.test(value)||year<2000||year>2100)fail('Choose a holiday year from 2000 to 2100.');
        const calendars=await publicHolidays.locationCalendars(dataDir,session,[year]);
        return json(200,{locationId:session.locationId,year,dates:calendars.flatMap(calendar=>(calendar.dates||[]).map(({date,name,start,end})=>({date,name,start,end})))});
      }
      if(req.url==='/api/location-status'&&req.method==='GET'){if(!can(session,'home.view'))fail('Home viewing permission required.',403);return json(200,await locationStore.status(session.locationId,locationNow()));}
      if(req.url==='/api/home-daily-sales'){
        if(session.homeDashboard==='staff')fail('Sales entry is not shown on Staff Home. Use Daily sales if your permissions allow it.',403);
        if(!can(session,'home.view'))fail('Home viewing permission required.',403);
        if(!['GET','PUT'].includes(req.method)){res.setHeader('Allow','GET, PUT');fail('Unsupported daily sales action.',405);}
        if(req.method==='PUT'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
        const now=locationNow(),location=await locationStore.status(session.locationId,now),entry=locationHoursModel.salesEntry(location.tradingHours,now),checkedAt=new Date(now).toISOString();
        let record;
        if(req.method==='PUT'){
          const input=await body(req);
          if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter a daily sales amount.');
          if(!entry?.available||input.date!==entry.tradingDate)fail('The Home sales entry period has changed. Open Daily sales to enter another date.',409);
          record=await salesStore.saveDay(dataDir,session,input);
        }else if(entry?.available)record=await sales.read(dataDir,session,sales.currentWeek(new Date(entry.tradingDate+'T12:00:00Z')));
        return json(200,{checkedAt,locationId:location.locationId,locationName:location.name,entry:entry?{...entry,...(record?{amountCents:record.days[(new Date(entry.tradingDate+'T12:00:00Z').getUTCDay()+6)%7],revision:record.revision}:{})}:null});
      }
      const managerRoute=req.url.match(/^\/api\/locations\/([a-zA-Z0-9-]+)\/managers$/);
      if(managerRoute){const store=await locationStore.get(managerRoute[1]),context=await auth.forCompany(session,store.companyId);if(!canAccessLocation(context,store))fail('Location not found.',404);if(req.method==='GET')return json(200,await auth.locationManagers(context,store.id));if(req.method==='PUT')return json(200,await auth.assignLocationManagers(context,store.id,await body(req)));}
      if(req.url==='/api/locations'&&req.method==='POST'){const input=await body(req),companyId=input?.companyId||session.companyId;await companyStore.get(companyId);if(!can(await auth.forCompany(session,companyId),'locations.manage')||!(await companyStore.accessible(session)).some(company=>company.id===companyId))fail('You do not have access to this company.',403);return json(201,await locationStore.create({...input,companyId},{setupCreatorId:session.id}));}
      const locationRoute=req.url.match(/^\/api\/locations\/([a-zA-Z0-9-]+)$/);
      if(locationRoute&&req.method==='PUT'){const target=await locationStore.get(locationRoute[1]);if(!can(await auth.forCompany(session,target.companyId),'locations.manage')||!canAccessLocation(await auth.forCompany(session,target.companyId),target))fail('You do not have access to this location.',403);const input=await body(req),task=req.headers['x-location-setup-task'];
        if(task){const field={details:'name',state:'publicHolidayState',hours:'tradingHours'}[task];if(!field)fail('Choose a valid location setup field.');if(session.locationId!==target.id)fail('The setup location changed.',409);await locationSetupStore.editor(session,target.id,task,'/admin/accounts');if(!input||!Object.hasOwn(input,field))fail('Enter this setup field.');return json(200,await locationStore.update(target.id,{[field]:input[field]},{partial:true}));}
        return json(200,await locationStore.update(locationRoute[1],input));}
      const locationEmailRoute=req.url.match(/^\/api\/locations\/([a-zA-Z0-9-]+)\/email$/);
      if(req.url==='/api/account-email-settings'){
        if(await platformStore?.enabled())fail('Manage account setup emails in the Opstack owner console.',403);
        if(!can(session,'account-email.manage'))fail('Network account email settings permission required.',403);
        if(req.method==='GET')return json(200,accountEmailSettings.summary(await accountEmailSettings.read(platformDataDir)));
        if(req.method==='PUT')return json(200,await accountEmailSettings.save(dataDir,await body(req)));
      }
      const resendInvitation=req.url.match(/^\/api\/accounts\/([a-zA-Z0-9-]+)\/invitation$/);
      if(req.method==='POST'&&(req.url==='/api/account-invitations'||resendInvitation)){
        const env=await accountEmailSettings.read(platformDataDir);accountInvitations.sender(env);
        const origin=publicOrigin||requestOrigin(req);if(!publicOrigin&&!['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname))fail('Set APP_ORIGIN to your public app URL before sending invitations.',503);
        const invitation=resendInvitation?await auth.resendInvitation(session,resendInvitation[1]):await auth.invite(session,await body(req),id=>locationStore.get(id,{active:true}));
        const delivery=await accountInvitations.send({...invitation,origin,company:session.companyName,inviter:session.username,network:network.id==='default'?undefined:network.slug},{env,fetchImpl});
        await auth.invitationDelivered(invitation.account.id,invitation.invitationId,delivery);
        return json(resendInvitation?200:201,{account:(await auth.list(session)).find(account=>account.id===invitation.account.id),delivery});
      }
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
      if(['/api/reporting/training','/api/reporting/checklists'].includes(req.url)&&req.method==='GET'){
        const params=Object.fromEntries(requestUrl.searchParams),period=reporting.range(params,new Date(communicationsNow())),ids=reporting.selectLocations(params.locations||session.locationId,await locationStore.accessible(session,{allCompanies:true}));
        const contexts=await Promise.all(ids.map(async id=>companyStore.context(await locationStore.sessionContext(session,id))));
        if(contexts.some(actor=>!can(actor,'reporting.view')))fail('Reporting access is required in every selected company.',403);
        const kind=req.url.endsWith('/training')?'training':'checklists';
        if(session.kiosk&&(contexts.some(actor=>actor.companyId!==session.companyId)||kind==='checklists'&&ids.some(id=>id!==session.locationId)))fail('This kiosk is assigned to another location.',403);
        const result=await require('./reporting-operations')[kind](contexts,period,kind==='training'?learningStore:opsStore);
        return json(200,{period,...result});
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
            const records=await salesStore.history(dataDir,context),catalogue=catalogues.get(context.companyId),report=reporting.calculate(records,history.orders,history.counts,catalogue,context,params,{now,transfers:history.transfers});
            report.details=await reportingDetails.build(dataDir,context,report.period,{...history,catalogue,store:weeklySalesReportStore,now,weekBasis:params.weekBasis});report.capabilities={training:can(context,'learning.view')&&can(context,'learning.report'),checklists:can(context,'ops.view')};return report;
          })));
          return json(200,{period:reports[0].period,reports});
        }
        const [records,history,catalogue]=await Promise.all([salesStore.history(dataDir,session),usageHistory(dataDir),readCatalogue()]);
        const report=reporting.calculate(records,history.orders,history.counts,catalogue,session,params,{now,transfers:history.transfers});
        report.details=await reportingDetails.build(dataDir,session,report.period,{...history,catalogue,store:weeklySalesReportStore,now,weekBasis:params.weekBasis});return json(200,report);
      }
      if(req.url==='/api/home-orders'&&req.method==='GET'){
        const history=await usageHistory(dataDir),seen=new Set();
        return json(200,history.orders.filter(order=>order.requestOwnerId===session.id&&sales.allTimeTotals([],[order],session).orderCount&&!seen.has(order.id)&&seen.add(order.id)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,8).map(order=>({id:order.id,createdAt:order.createdAt,totalCents:order.total,pricePending:Boolean(order.pricePending||order.items.some(item=>item?.price===null)),units:order.items.reduce((sum,item)=>sum+(Number(item?.quantity)||0),0)})));
      }
      if(req.url==='/api/home-operations'&&req.method==='GET'){
        if(!homeOperations.canView(session))fail('Manager Home and daily sales viewing permission are required.',403);
        const now=locationNow(),location=await locationStore.status(session.locationId,now),target=homeOperations.context(location,now);
        const [projection,hourly,budget]=await Promise.all([sales.rosterProjection(dataDir,session,target.weekStart,{now:new Date(now)}),hourlySalesStore.read(session),rosteringStore.homeBudget(session)]);
        return json(200,homeOperations.calculate(session,{now,location,projection,hourly,budget}));
      }
      if(req.url==='/api/home-totals'&&req.method==='GET'){
        if(session.homeDashboard==='staff')fail('Sales totals are not shown on Staff Home.',403);
        const history=await usageHistory(dataDir);
        return json(200,await salesStore.totals(dataDir,session,{orders:history.orders,transfers:history.transfers}));
      }
      if(req.url.startsWith('/api/hourly-sales')){
        if(!can(session,'sales.view'))fail('Sales viewing permission required.',403);
        const location=await locationStore.status(session.locationId,salesNow()),hoursHash=hourlySales.hoursHash(location.tradingHours);
        if(req.url==='/api/hourly-sales'&&req.method==='GET')return json(200,{...await hourlySalesStore.report(session,requestUrl.searchParams.get('date')||new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(salesNow()))),tradingHours:location.tradingHours,hoursHash});
        if(!can(session,'sales.edit'))fail('Sales editing permission required.',403);
        if(req.method!=='POST')fail('Use POST for hourly report imports.',405);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);
        const input=await body(req,7000000);
        if(req.url==='/api/hourly-sales/prepare')return json(200,hourlySalesModel.prepare(input));
        if(req.url==='/api/hourly-sales/preview')return json(200,await hourlySalesStore.review(session,input,location.tradingHours));
        if(req.url==='/api/hourly-sales/confirm')return json(200,await hourlySalesStore.save(session,input,location.tradingHours));
        if(req.url==='/api/hourly-sales/intelligence'){
          const result=await aiStore.generateHourlySales(session,input);
          const current=kioskCookie?(await kioskStore.worker(await kioskStore.device(req)))?.actor:await companyStore.context(await locationStore.sessionContext(await auth.session(req),session.locationId));
          if(!current||current.id!==session.id||current.csrf!==session.csrf)fail('Sign in again before reviewing this report.',401);
          if(current.companyId!==session.companyId||current.locationId!==session.locationId)fail('The selected company or location changed.',409);
          if(!can(current,'sales.view')||!can(current,'sales.edit'))fail('Sales editing permission required.',403);
          if(!isSupport(current)){const required=await communicationStore.required(current);if(required.due.length)return json(428,{error:'Read or snooze the required posts before continuing.',code:'REQUIRED_POSTS',required});}
          const config=await aiStore.status(current);if(!config.enabled||!config.configured)fail('OpStack intelligence is no longer enabled for this company.',503);
          const freshLocation=await locationStore.status(current.locationId,salesNow()),state=await hourlySalesStore.read(current);
          return json(200,{...result,locationId:current.locationId,revision:state.revision,hoursHash:hourlySales.hoursHash(freshLocation.tradingHours)});
        }
        fail('Hourly sales action not found.',404);
      }
      if(req.url==='/api/sales'&&req.method==='GET'){
        const history=await usageHistory(dataDir);
        return json(200,await salesStore.report(dataDir,session,requestUrl.searchParams.get('week'),{orders:history.orders,transfers:history.transfers,now:new Date(salesNow())}));
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
        return json(200,await weeklySalesOverview.build(dataDir,session,params,{orders:history.orders,transfers:history.transfers,store:weeklySalesReportStore}));
      }
      if(['/api/weekly-sales-import/preview','/api/weekly-sales-import/confirm'].includes(req.url)){
        if(req.method!=='POST')fail('Use POST to import a weekly sales workbook.',405);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
        const input=await body(req,7000000),workbook=weeklySalesImport.upload(input,session);
        return json(200,await weeklySalesReportStore.importReports(dataDir,session,workbook,req.url.endsWith('/confirm')?{expectedRevisions:input.expectedRevisions??null,sha256:input.sha256}:{}));
      }
      if(req.url==='/api/weekly-sales-reports'&&req.method==='GET'){
        const history=await usageHistory(dataDir);
        return json(200,await weeklySalesReportStore.report(dataDir,session,requestUrl.searchParams.get('week'),{orders:history.orders,transfers:history.transfers}));
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
      if(req.url==='/api/accounts'&&req.method==='GET'){const records=await photoStore.decorate(await auth.list(session));if(requestUrl.searchParams.get('all')==='true')return json(200,records);const ids=new Set((await locationStore.list()).filter(record=>record.companyId===session.companyId).map(record=>record.id));return json(200,records.filter(account=>locationIds(account).some(id=>ids.has(id))));}
      if(req.url==='/api/accounts'&&req.method==='POST'){const account=await auth.create(session,await body(req),id=>locationStore.get(id,{active:true}));await locationStore.ensure(true);return json(201,(await auth.list()).find(saved=>saved.id===account.id));}
      const accountRoute=req.url.match(/^\/api\/accounts\/([a-zA-Z0-9-]+)$/);
      if(accountRoute&&req.method==='PUT')return json(200,await auth.update(session,accountRoute[1],await body(req),id=>locationStore.get(id,{active:true})));
      if(accountRoute&&req.method==='DELETE'){const removed=await auth.remove(session,accountRoute[1]);await photoStore.purge(accountRoute[1]);return json(200,removed);}

      if(req.method==='GET'&&['/rostering','/knowledge-library','/learning-centre','/ops-management','/labels','/communications','/','/home','/cart','/stock-count','/stock-transfers','/sales','/reporting','/email-settings','/admin','/admin/accounts','/admin/settings','/settings','/settings/awards','/admin/appearance/signin','/admin/appearance/setup'].includes(req.url)&&!session){res.writeHead(303,{Location:'/login'});return res.end();}
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
          if(automatic.levels[manualParRoute[1]].weeksRecorded>0)fail('This item uses automatic target level because completed usage history is available.');
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
        for(const [key,label,max]of [['unitAmount','unit amount',80],['sku','supplier SKU',60]])if(input[key]!==undefined&&(typeof input[key]!=='string'||input[key].length>max||/[\x00-\x1f\x7f\u2028\u2029]/.test(input[key])))fail('Enter a single-line '+label+' of up to '+max+' characters.');
        if(input.minimumOrder!==undefined&&(!Number.isInteger(input.minimumOrder)||input.minimumOrder<1||input.minimumOrder>999))fail('Minimum order quantity must be a whole number from 1 to 999.');
        if(input.orderRule!==undefined&&!['minimum','multiples','cutoff','separate'].includes(input.orderRule))fail('Choose a valid order quantity rule.');
        if(input.roundingCutoff!==undefined&&(!Number.isInteger(input.roundingCutoff)||input.roundingCutoff<0||input.roundingCutoff>999))fail('Rounding cutoff must be a whole number from 0 to 999.');
        for(const key of ['roundDownThreshold','roundUpThreshold'])if(input[key]!==undefined&&input[key]!==null&&(!Number.isInteger(input[key])||input[key]<0||input[key]>999))fail('Rounding cutoffs must be whole numbers from 0 to 999, or blank to turn off.');
        const product={id:crypto.randomUUID(),name:productName,supplierId:input.supplierId,price:input.price===null?null:Math.round(input.price*100),stock:input.stock,category:name(input.category||'General','category',60),sku:typeof input.sku==='string'?input.sku.trim().slice(0,60):'',unitAmount:input.unitAmount?.trim()||'',minimumOrder:input.minimumOrder??1,orderRule:input.orderRule??'minimum',roundingCutoff:input.roundingCutoff??1,roundDownThreshold:input.roundDownThreshold??null,roundUpThreshold:input.roundUpThreshold??null,emoji:'📦',photo:photo||null};
        return json(edit?200:201,await mutate(c=>{product.stockCountGroup=input.stockCountGroup??(edit?c.products.find(p=>p.id===edit[1])?.stockCountGroup:undefined)??stockCountGroups.resolve(product);if(!c.suppliers.some(s=>s.id===product.supplierId))fail('Choose an existing supplier.');if(edit){const index=c.products.findIndex(p=>p.id===edit[1]);if(index<0)fail('Stock not found.',404);product.id=c.products[index].id;product.emoji=c.products[index].emoji;if(input.unitAmount===undefined)product.unitAmount=c.products[index].unitAmount||'';if(input.sku===undefined)product.sku=c.products[index].sku||'';if(input.minimumOrder===undefined)product.minimumOrder=c.products[index].minimumOrder??1;if(input.orderRule===undefined)product.orderRule=c.products[index].orderRule||'minimum';if(input.roundingCutoff===undefined)product.roundingCutoff=c.products[index].roundingCutoff??1;for(const key of ['roundDownThreshold','roundUpThreshold'])if(input[key]===undefined)product[key]=c.products[index][key]??null;if(photo===undefined)product.photo=c.products[index].photo||null;if(product.orderRule==='cutoff'&&product.roundingCutoff>product.minimumOrder)fail('Rounding cutoff cannot exceed the minimum order quantity.');if(product.orderRule==='separate'){if(['roundDownThreshold','roundUpThreshold'].some(key=>product[key]!==null&&product[key]>product.minimumOrder))fail('Rounding cutoffs cannot exceed the minimum order quantity.');if(product.roundDownThreshold!==null&&product.roundUpThreshold!==null&&product.roundDownThreshold>=product.roundUpThreshold)fail('Round-down cutoff must be lower than the round-up cutoff.');}c.products[index]=product;}else{if(product.orderRule==='cutoff'&&product.roundingCutoff>product.minimumOrder)fail('Rounding cutoff cannot exceed the minimum order quantity.');if(product.orderRule==='separate'){if(['roundDownThreshold','roundUpThreshold'].some(key=>product[key]!==null&&product[key]>product.minimumOrder))fail('Rounding cutoffs cannot exceed the minimum order quantity.');if(product.roundDownThreshold!==null&&product.roundUpThreshold!==null&&product.roundDownThreshold>=product.roundUpThreshold)fail('Round-down cutoff must be lower than the round-up cutoff.');}c.products.push(product);}return product;}));
      }
      const deletion=req.url.match(/^\/api\/(products|suppliers)\/([a-zA-Z0-9-]+)$/);
      if(req.method==='DELETE' && deletion){return json(200,await mutate(c=>{
        const collection=deletion[1];const id=deletion[2];if(!c[collection].some(item=>item.id===id))fail('Item not found.',404);
        if(collection==='suppliers'&&c.products.some(p=>p.supplierId===id))fail('Remove this supplier’s stock before removing the supplier.');
        c[collection]=c[collection].filter(item=>item.id!==id);return {removed:true};
      }));}
      if(req.url==='/api/order-history'){
        if(req.method==='GET')return json(200,await orderHistory.list(dataDir,session,requestUrl.searchParams,{reader:usageHistory}));
        if(req.method!=='POST')fail('Unsupported history action.',405);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);
        const saved=await orderHistory.save(dataDir,session,await body(req,160000),await readCatalogue());return json(saved.created?201:200,saved.order);
      }
      const historyOrderRoute=req.url.match(/^\/api\/order-history\/([a-f0-9-]{36})$/i);
      if(historyOrderRoute){
        if(req.method==='GET')return json(200,await orderHistory.get(dataDir,session,historyOrderRoute[1]));
        if(req.method!=='DELETE')fail('Saved history entries cannot be edited.',405);
        if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);
        return json(200,await orderHistory.remove(dataDir,session,historyOrderRoute[1],await body(req)));
      }
      const savedOrderRoute=req.url.match(/^\/api\/orders\/([a-f0-9-]{36})$/i);
      if(req.method==='GET'&&savedOrderRoute){
        let record;try{record=JSON.parse(await fs.readFile(path.join(dataDir,savedOrderRoute[1]+'.json'),'utf8'));}catch(error){if(error.code==='ENOENT')fail('Order not found.',404);throw error;}
        if(record.status==='deleted'||record.requestOwnerId!==session.id||!belongs(record,session,'requestOwnerId'))fail('Order not found.',404);
        if(requestUrl.searchParams.get('deliverySetup')==='true'&&record.delivery?.some(result=>result.status==='not_configured')){
          const [catalogue,env]=await Promise.all([readCatalogue(),deliverySettings.deliveryEnvironment(dataDir,session.locationId)]);
          record.delivery=record.delivery.map(result=>{
            if(result.status!=='not_configured')return result;
            const supplier=catalogue.suppliers.find(supplier=>supplier.id===result.supplierId),issue=deliveryConfigurationIssue({locationName:session.locationName},supplier?.delivery,env);
            return {...result,configurationMessage:issue?'Current setup: '+issue:'Current sending settings for '+session.locationName+' are complete. This saved order was not sent and has not been retried.'};
          });
        }
        return json(200,record);
      }
      if (req.method === 'POST' && req.url === '/api/orders') {
        const input=await body(req);
        const requestId=input?.requestId;
        if(requestId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))fail('Invalid request identifier.');
        const fingerprint=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
        if(requestId){try{const previous=JSON.parse(await fs.readFile(path.join(dataDir,requestId+'.json'),'utf8'));if(previous.requestOwnerId!==session.id||!belongs(previous,session,'requestOwnerId')||previous.requestFingerprint!==fingerprint)fail('This request identifier belongs to another order.',409);if(previous.status==='deleted')fail('This order was deleted. Start a new order to place it again.',409);return json(200,previous);}catch(error){if(error.code!=='ENOENT')throw error;}}
        const catalogue=await readCatalogue();
        const products=catalogue.products.map(p=>({...p,supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name}));
        let order;try{order=validateOrder(input,products,session.username);}catch(error){fail(error.message);}
        if(requestId)order.id=requestId;order.companyId=session.companyId;order.companyName=session.companyName;order.locationId=session.locationId;order.locationName=session.locationName;order.requestOwnerId=session.id;order.requestFingerprint=fingerprint;order.confirmation={status:'pending',message:'Confirmation email is still processing or unconfirmed. Check the sending service before retrying.'};order.delivery=splitBySupplier(order).map(s=>({supplierId:s.supplierId,supplier:s.supplier,status:'pending',message:'Delivery processing is not yet confirmed.'}));
        await fs.mkdir(dataDir,{recursive:true});
        const initial=path.join(dataDir,order.id+'.json'),staged=initial+'.'+crypto.randomUUID()+'.tmp';
        try{await fs.writeFile(staged,JSON.stringify(order,null,2),{mode:0o600});try{await fs.link(staged,initial);}catch(error){if(error.code!=='EEXIST')throw error;const previous=JSON.parse(await fs.readFile(initial,'utf8'));if(previous.requestOwnerId!==session.id||!belongs(previous,session,'requestOwnerId')||previous.requestFingerprint!==fingerprint)fail('This request identifier belongs to another order.',409);if(previous.status==='deleted')fail('This order was deleted. Start a new order to place it again.',409);return json(200,previous);}}finally{await fs.rm(staged,{force:true});}
        const templateSettings=await orderEmailTemplates.read(dataDir,session.companyId);
        const env={...await deliverySettings.deliveryEnvironment(dataDir,session.locationId),...(templateSettings.revision?{ORDER_EMAIL_TEMPLATE:templateSettings.template}:{})};
        order.delivery=await dispatchOrder(order,catalogue.suppliers,{env,fetchImpl});
        const target=path.join(dataDir,`${order.id}.json`);
        const persist=async()=>{const temp=target+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(order,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}};
        // Persist supplier outcomes and the pending confirmation before any receipt call.
        await persist();order.confirmation=await orderConfirmation.send(order,{env,fetchImpl,networkId:network.id});await persist();
        return json(201,order);
      }

      if (req.method !== 'GET' || !publicFiles[req.url]) return json(404,{error:'Not found'});
      const file=publicFiles[req.url];
      const contentType=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':/\.(?:gz|pfb)$/.test(file)?'application/octet-stream':file.endsWith('.txt')||file.endsWith('.md')?'text/plain; charset=utf-8':'text/javascript';
      if(file.endsWith('.html')){
        const layoutPage=file.replace(/\.html$/,''),[rawMarkup,appearance,text,overrides,font,hasLogo,hasSidebarLogo,fontLibrary,layout,icon,aiBrand]=await Promise.all([fs.readFile(path.join(__dirname,'public',file),'utf8').then(markup=>file==='home.html'?markup.replace('<body','<body data-home-dashboard="'+(session?.homeDashboard||'manager')+'"'):markup),currentAppearance(customisationDir,platformAppearance&&!sharedAppearance),interfaceText.read(customisationDir),elementOverrides.read(customisationDir),asset('fonts/Opsilon-xRj8m.ttf'),readLogo(customisationDir).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;}),readLogo(customisationDir,true).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;}),readFontLibrary(),layouts.page(customisationDir,layoutPage),asset('assets/branding/opstack-icon.png'),session&&!platformAppearance?aiStore.brand(appearanceCompany.id):{companyId:appearanceCompany.id,revision:0,...aiBrandModel.defaults}]);
        const authPreview=req.url.startsWith('/admin/appearance/');const previewToolbar='<div id="admin-edit-controls" class="auth-preview-toolbar" data-copy-editor><strong>Page preview</strong><a href="'+scopedAsset('/admin/settings')+'#sign-in">Back to settings</a><button id="app-edit-toggle" type="button" aria-pressed="false"><span class="sidebar-edit-label">App edit</span></button><p id="app-edit-status" role="status" class="visually-hidden"></p></div>';
        const networkSeed=await newNetworkDefaults.snapshot(dataDir),companySeed=await newNetworkDefaults.companySnapshot(dataDir,appearanceCompany.id),networkAppearanceDefaults=companySeed?newNetworkDefaults.files(companySeed)['appearance.json']:null;
        const welcomeMarkup=req.url==='/login'?newNetworkDefaults.welcome(rawMarkup,networkSeed):rawMarkup;
        const sourceMarkup=req.url==='/login'&&requestUrl.searchParams.has('network')?welcomeMarkup.replace('name="network"','name="network" value="'+network.slug+'"'):welcomeMarkup;
        const pageMarkup=authPreview?sourceMarkup.replace(/<script src="\/(?:login|setup)\.js" defer><\/script>/,'<script src="/auth-preview.js" defer></script>').replace('</head>','<script src="/app-editor.js" defer></script></head>').replace('</body>',previewToolbar+'</body>'):sourceMarkup;
        const sidebarPage=pageMarkup.includes('id="app-sidebar"'),source=scopedAsset(sidebarPage?'/sidebar-logo':'/logo'),branded=(sidebarPage?hasSidebarLogo:hasLogo)?pageMarkup.replace(/(<a class="brand"[^>]*>)[\s\S]*?<\/a>/g,'$1<img src="'+source+'" alt="Opstack" class="app-logo"></a>'):pageMarkup;
        const kioskScripts=sidebarPage&&kioskStaff&&!embeddedContent?'<script>document.documentElement.classList.add("kiosk-lock-pending")</script><script src="/kiosk-session.js" defer></script><link rel="stylesheet" href="/kiosk-session.css">':'';
        const clockScripts=sidebarPage&&session&&!isSupport(session)&&can(session,'rostering.clock')?'<script src="/clock-model.js" defer></script><script src="/shift-clock.js" defer></script><link rel="stylesheet" href="/shift-clock.css">':'';
        const setupScripts=setupTask?'<script src="/location-setup-editor.js" defer></script><link rel="stylesheet" href="/location-setup-editor.css">':'';
        const arrangedScripts=branded.replace('<script src="/appearance-style.js" defer></script>','<script src="/wording-model.js" defer></script><script src="/appearance-style.js" defer></script><script src="/permission-model.js" defer></script><script src="/access.js" defer></script><script src="/formatted-text.js" defer></script><link rel="stylesheet" href="/formatted-text.css"><script src="/required-reading.js" defer></script><script src="/location-setup.js" defer></script><link rel="stylesheet" href="/location-setup.css"><script src="/message-badge.js" defer></script><link rel="stylesheet" href="/required-reading.css">'+clockScripts+'<script src="/layout-model.js" defer></script><script src="/app-layout.js" defer></script><script src="/section-resize.js" defer></script>');
        const copyMarkup=wordingModel.annotate(arrangedScripts,interfaceText.labels);
        const markup=layoutModel.renderMarkup(editParts.renderImages(editParts.renderIcons(editParts.annotate(copyMarkup,file),overrides),overrides),layout.groups);
        const bootstrap=JSON.stringify({aiBrand,locationSetup:session&&!isSupport(session)?await locationSetupStore.status(session):null,requiredReading:requiredReading||null,access:session?{role:session.role,roleName:session.roleName,homeDashboard:session.homeDashboard||'manager',roleLevel:session.roleLevel,permissions:session.permissions,networkPermissions:session.networkPermissions}:null,interfaceText:text,elementOverrides:overrides,hasLogo,hasSidebarLogo,fontLibrary,layout,layoutPage}).replace(/</g,'\\u003c');
        const fontUrl='/fonts/Opsilon-xRj8m.ttf?v='+font.etag.slice(1,-1);
        const dynamicPrefix='dynamic-'+req.url.replace(/[^a-z0-9]/gi,'_')+'-';
        const usedFonts=new Set([...Object.values(appearance.fonts||{}),...Object.entries(overrides).filter(([id,entry])=>entry.font&&(markup.includes('data-edit-id="'+id+'"')||id.startsWith(dynamicPrefix)||id.startsWith('type:'))).map(([,entry])=>entry.font)]);
        const uploadedPreloads=fontLibrary.filter(entry=>usedFonts.has(entry.id)).map(entry=>'<link rel="preload" href="'+entry.url+'" as="font" type="font/'+entry.extension+'" crossorigin>').join('');
        const iconVersion=icon.etag.slice(1,-1);
        const siteIcons='<link rel="icon" type="image/png" href="/favicon.png?v='+iconVersion+'"><link rel="apple-touch-icon" href="/apple-touch-icon.png?v='+iconVersion+'">';
        const contextScript='<script>window.appNetworkAppearanceDefaults='+JSON.stringify(platformAppearance?null:networkAppearanceDefaults).replace(/</g,'\\u003c')+';</script><script>window.appNetworkId='+JSON.stringify(network.id)+';</script><script src="/network-context.js"></script><script>window.appThemeAccount='+JSON.stringify(session?.id||'guest')+';window.appCompanyId='+JSON.stringify(appearanceCompany.id).replace(/</g,'\\u003c')+';window.appCompanyName='+JSON.stringify(platformAppearance?'Opstack':appearanceCompany.name).replace(/</g,'\\u003c')+';window.appPlatformAppearance='+JSON.stringify(platformAppearance)+';window.appSharedAppearance='+JSON.stringify(sharedAppearance)+';</script>';
        const intelligenceStyle='<style id="ai-brand-style">'+aiBrandModel.css(aiBrand)+'</style>';
        const initial='<link rel="stylesheet" href="/modern-ui.css">'+intelligenceStyle+'<script>window.appLocationId='+JSON.stringify(session?.locationId||'').replace(/</g,'\\u003c')+';document.documentElement.dataset.accountRole='+JSON.stringify(session?.role||'')+';</script>'+uploadedPreloads+'<style id="uploaded-font-faces">'+appearanceStyles.fontFaces(fontLibrary,appearanceCompany.id)+'</style><link rel="preload" href="'+fontUrl+'" as="font" type="font/ttf" crossorigin><style id="app-font">@font-face{font-family:Opsilon;src:url("'+fontUrl+'");font-weight:400;font-style:normal;font-display:block}</style><style id="appearance-style">'+appearanceStyles.build(appearance,fontLibrary)+'</style><style id="element-appearance-style">'+appearanceStyles.buildElements(overrides,markup,fontLibrary)+'</style><script id="app-bootstrap" type="application/json">'+bootstrap+'</script>';
        res.writeHead(200,{'Content-Type':contentType,'X-Content-Type-Options':'nosniff'});const rendered=markup.replace('<head>','<head>'+siteIcons+contextScript+'<script src="/theme-colours.js"></script><script src="/theme.js"></script><script src="/ai-brand-model.js" defer></script><script src="/ai-brand.js" defer></script>').replace('</head>',initial+kioskScripts+setupScripts+'<link rel="stylesheet" href="/dark-mode.css"></head>');return res.end(await publicAssets.versionMarkup(((sidebarPage&&!authPreview)||(authPreview&&embeddedContent))?persistentShell.render(rendered,embeddedContent):rendered));
      }
      return json(404,{error:'Not found'});
    } catch(error) {json(error.status||500,{error:error.status?error.message:'Unable to save changes. Please try again.'});}
  });
  server.networkServices={auth,locationStore,companyStore,reportStore};return server;
}
function createServer(dataDir=path.join(__dirname,'data'),options={}){return createPlatformServer(dataDir,{...options,publicOrigin:appOrigin(options.publicOrigin||'')},createNetworkServer);}
if(require.main===module)(async()=>{
  const config=runtimeConfig();
  await prepareDataDirectory(config.dataDir);
  if(process.env.RAILWAY_ENVIRONMENT_ID&&!config.migrationMode&&!await createAuth(config.dataDir).configured())throw Error('No accounts found in DATA_DIR. Keep MIGRATION_MODE=1 and import your existing data before opening the app.');
  const server=createServer(config.dataDir,config);
  server.on('error',error=>{console.error('Opstack could not start:',error.message);process.exitCode=1;});
  server.listen(config.port,'0.0.0.0',()=>console.log(`Opstack running on port ${config.port}${config.migrationMode?' (migration mode; app access paused)':''}`));
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
    const timeout=setTimeout(()=>process.exit(1),30000);timeout.unref();
    server.close(()=>{clearTimeout(timeout);process.exit(0);});
  });
})().catch(error=>{console.error('Opstack could not start:',error.message);process.exitCode=1;});
module.exports={createServer,validateOrder};
