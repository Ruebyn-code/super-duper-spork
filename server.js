const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {createAuth}=require('./auth');
const {mergeSpreadsheet}=require('./catalogue-import');
const {defaults,validateSettings,saveAppearance}=require('./appearance');
const {validateDelivery,providerStatus,dispatchOrder}=require('./order-delivery');
const deliverySettings=require('./delivery-settings');
const {splitBySupplier}=require('./supplier-orders');
const interfaceText=require('./interface-text');
const elementOverrides=require('./element-overrides');
const menu = [
  {id:'paper',name:'A4 copy paper',category:'Office',price:650,emoji:'📄',description:'500 sheets · 80 gsm',sku:'OFF-001',stock:12},
  {id:'pens',name:'Black ballpoint pens',category:'Office',price:1200,emoji:'🖊️',description:'Box of 12 · medium point',sku:'OFF-002',stock:4},
  {id:'boxes',name:'Shipping boxes',category:'Packaging',price:2800,emoji:'📦',description:'Pack of 25 · 30 × 20 × 15 cm',sku:'PKG-001',stock:8},
  {id:'tape',name:'Packing tape',category:'Packaging',price:1800,emoji:'🧻',description:'Pack of 6 · 48 mm × 50 m',sku:'PKG-002',stock:3},
  {id:'gloves',name:'Nitrile gloves',category:'Safety',price:1500,emoji:'🧤',description:'Box of 100 · medium · powder free',sku:'SAF-001',stock:6},
  {id:'vest',name:'High visibility vest',category:'Safety',price:1400,emoji:'🦺',description:'Each · yellow · one size',sku:'SAF-002',stock:20}
];
function validateOrder(body, menu) {
  if (!body || typeof body.name !== 'string' || !body.name.trim() || body.name.length > 80 || typeof body.location !== 'string' || !body.location.trim() || body.location.length > 200 || typeof body.phone !== 'string' || !/^[+\d ()-]{6,30}$/.test(body.phone) || !Array.isArray(body.items) || body.items.length === 0 || body.items.length > menu.length) throw Error('Enter your name, a valid phone number, and at least one item.');
  const seen = new Set();
  const items = body.items.map(item => {
    if (!item || typeof item !== 'object') throw Error('Invalid order items.');
    const product = menu.find(p => p.id === item.id);
    if (!product || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw Error('Invalid order items.');
    seen.add(item.id);
    return {id:product.id,name:product.name,supplierId:product.supplierId,supplier:product.supplier,quantity:item.quantity,price:product.price};
  });
  return {id:crypto.randomUUID(),name:body.name.trim(),phone:body.phone.trim(),notes:typeof body.notes === 'string' ? body.notes.slice(0,500) : '',items,total:items.reduce((sum,i)=>sum+i.price*i.quantity,0),createdAt:new Date().toISOString(),pricePending:items.some(i=>i.price===null),status:'requested',location:typeof body.location === 'string' ? body.location.slice(0,200) : ''};
}
function createServer(dataDir = path.join(__dirname,'data')) {
  const auth=createAuth(dataDir);
  const catalogueFile = path.join(dataDir,'catalogue.json');
  let pending = Promise.resolve();
  let initialization;
  async function readCatalogue() {
    if(!initialization)initialization=(async()=>{
      let catalogue;
      try{catalogue=JSON.parse(await fs.readFile(catalogueFile,'utf8'));}
      catch(error){if(error.code!=='ENOENT')throw error;catalogue={suppliers:[{id:'office',name:'Office Supplies'},{id:'packaging',name:'Packaging Supplies'},{id:'safety',name:'Safety Supplies'}],products:menu.map(p=>({...p,supplierId:p.category.toLowerCase()}))};}
      if(!catalogue.imports?.includes('book2-v1')){mergeSpreadsheet(catalogue);await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(catalogueFile+'.tmp',JSON.stringify(catalogue,null,2),{mode:0o600});await fs.rename(catalogueFile+'.tmp',catalogueFile);}
    })();
    await initialization;return JSON.parse(await fs.readFile(catalogueFile,'utf8'));
  }
  function mutate(change) {
    const operation=pending.then(async()=>{
      const catalogue=await readCatalogue();const result=change(catalogue);
      await fs.mkdir(dataDir,{recursive:true});
      const temp=catalogueFile+'.tmp';await fs.writeFile(temp,JSON.stringify(catalogue,null,2),{mode:0o600});await fs.rename(temp,catalogueFile);return result;
    });pending=operation.catch(()=>{});return operation;
  }
  function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
  async function body(req,limit=16000){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)fail('Request is too large.',413);}try{return JSON.parse(raw);}catch{fail('Invalid JSON.');}}
  function name(value,label,max=100){if(typeof value !== 'string'||!value.trim()||value.length>max)fail('Enter a valid '+label+'.');return value.trim();}
  return http.createServer(async (req,res) => {
    const json = (code,body) => {res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
    try {
      const requestUrl=new URL(req.url,'http://localhost');req.url=requestUrl.pathname;
      res.setHeader('Cache-Control','no-store');
      if(req.url==='/api/setup'&&req.method==='POST'){
        if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))fail('First-time setup must be opened on the computer running the app.',403);
        if(req.headers['content-type']!=='application/json'||(req.headers.origin&&req.headers.origin!==`http${req.socket.encrypted?'s':''}://${req.headers.host}`))fail('Invalid setup request.',403);
        return json(201,await auth.setup(await body(req)));
      }
      if(req.method==='GET'&&req.url==='/login'&&!await auth.configured()){res.writeHead(303,{Location:'/setup'});return res.end();}
      if(req.method==='GET'&&req.url==='/setup'&&await auth.configured()){res.writeHead(303,{Location:'/login'});return res.end();}
      if(req.method==='GET'&&req.url==='/logo'){
        try{const logo=JSON.parse(await fs.readFile(path.join(dataDir,'logo.json'),'utf8'));res.writeHead(200,{'Content-Type':logo.type,'X-Content-Type-Options':'nosniff'});return res.end(Buffer.from(logo.data,'base64'));}catch(error){if(error.code==='ENOENT')return json(404,{error:'No logo uploaded.'});throw error;}
      }
      if(req.method==='GET'&&req.url==='/appearance'){
        try{return json(200,JSON.parse(await fs.readFile(path.join(dataDir,'appearance.json'),'utf8')));}catch(error){if(error.code==='ENOENT')return json(200,defaults);throw error;}
      }
      if(req.method==='GET'&&req.url==='/interface-text')return json(200,await interfaceText.read(dataDir));
      if(req.method==='GET'&&req.url==='/element-overrides')return json(200,await elementOverrides.read(dataDir));
      const session=await auth.session(req);
      if(req.method==='GET'&&req.url==='/api/session')return json(200,session?{role:session.role,username:session.username,id:session.id,csrf:session.csrf}:{role:'user'});
      if(req.method==='POST'&&req.url==='/api/login'){
        if(req.headers.origin&&req.headers.origin!==`http${req.socket.encrypted?'s':''}://${req.headers.host}`)fail('Invalid request origin.',403);
        const loggedIn=await auth.login(req,await body(req));
        res.setHeader('Set-Cookie',`admin_session=${loggedIn.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${req.socket.encrypted?'; Secure':''}`);
        return json(200,{role:loggedIn.role});
      }
      const management=req.url.startsWith('/api/products')||req.url.startsWith('/api/suppliers')||req.url.startsWith('/api/accounts')||req.url==='/api/logo'||req.url==='/api/settings'||req.url==='/api/delivery-status'||req.url==='/api/delivery-settings'||req.url==='/api/my-email-settings'||req.url==='/api/interface-text'||req.url==='/api/element-overrides';
      if(management){if(!session)fail('Sign-in required.',401);if(session.role!=='admin')fail('Administrator permission required.',403);if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);}
      if(req.method==='POST'&&req.url==='/api/logout'){if(!session)fail('Sign-in required.',401);if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);auth.logout(session.token);res.setHeader('Set-Cookie','admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return json(200,{signedOut:true});}
      if(req.url.startsWith('/api/')&&!session)fail('Sign-in required.',401);
      if(req.url==='/api/element-overrides'&&req.method==='PATCH'){try{return json(200,await elementOverrides.patch(dataDir,await body(req,2900000)));}catch(error){fail(error.message);}}
      if(req.url==='/api/interface-text'&&req.method==='GET')return json(200,{labels:interfaceText.labels,overrides:await interfaceText.read(dataDir)});
      if(req.url==='/api/interface-text'&&req.method==='PATCH'){try{return json(200,await interfaceText.patch(dataDir,await body(req)));}catch(error){fail(error.message);}}
      if(req.url==='/api/interface-text'&&req.method==='PUT'){try{return json(200,await interfaceText.save(dataDir,await body(req,300000)));}catch(error){fail(error.message);}}
      if(req.url==='/api/delivery-status'&&req.method==='GET')return json(200,providerStatus(await deliverySettings.deliveryEnvironment(dataDir,session.id)));
      const accountEmailRoute=req.url.match(/^\/api\/accounts\/([a-zA-Z0-9-]+)\/email$/);
      if(accountEmailRoute){const id=accountEmailRoute[1];if(!(await auth.list()).some(account=>account.id===id))fail('Account not found.',404);if(req.method==='GET')return json(200,deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,id)));if(req.method==='PUT'){try{return json(200,await deliverySettings.save(dataDir,await body(req),id));}catch(error){fail(error.message);}}}
      if(req.url==='/api/my-email-settings'){if(!session)fail('Sign-in required.',401);if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token.',403);if(req.method==='GET')return json(200,deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,session.id)));if(req.method==='PUT'){try{return json(200,await deliverySettings.save(dataDir,await body(req),session.id));}catch(error){fail(error.message);}}}
      if(req.url==='/api/delivery-settings'&&req.method==='GET')return json(200,deliverySettings.summary(await deliverySettings.deliveryEnvironment(dataDir,session.id)));
      if(req.url==='/api/delivery-settings'&&req.method==='PUT'){try{return json(200,await deliverySettings.save(dataDir,await body(req),session.id));}catch(error){fail(error.message);}}
      const supplierEdit=req.url.match(/^\/api\/suppliers\/([a-zA-Z0-9-]+)$/);
      if(req.method==='PUT'&&supplierEdit){const input=await body(req);let delivery;try{delivery=validateDelivery(input.delivery);}catch(error){fail(error.message);}return json(200,await mutate(c=>{const supplier=c.suppliers.find(s=>s.id===supplierEdit[1]);if(!supplier)fail('Supplier not found.',404);supplier.delivery=delivery;return supplier;}));}
      if(req.url==='/api/settings'&&['PUT','PATCH'].includes(req.method)){try{return json(200,await saveAppearance(dataDir,await body(req,2900000),req.method==='PATCH'));}catch(error){fail(error.message);}}
      if(req.url==='/api/logo'&&req.method==='POST'){
        const input=await body(req,2900000);if(typeof input?.data!=='string'||!input.data.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))fail('Choose a PNG or JPG image.');
        const bytes=Buffer.from(input.data,'base64');if(bytes.length>2000000)fail('Logo must be smaller than 2 MB.');
        const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
        if(!png&&!jpeg)fail('Choose a PNG or JPG image.');
        const target=path.join(dataDir,'logo.json');await fs.mkdir(dataDir,{recursive:true});await fs.writeFile(target,JSON.stringify({type:png?'image/png':'image/jpeg',data:bytes.toString('base64')}),{mode:0o600});return json(200,{saved:true});
      }
      if(req.url==='/api/accounts'&&req.method==='GET')return json(200,await auth.list());
      if(req.url==='/api/accounts'&&req.method==='POST')return json(201,await auth.create(session,await body(req)));
      const accountRoute=req.url.match(/^\/api\/accounts\/([a-zA-Z0-9-]+)$/);
      if(accountRoute&&req.method==='PUT')return json(200,await auth.update(session,accountRoute[1],await body(req)));
      if(accountRoute&&req.method==='DELETE')return json(200,await auth.remove(session,accountRoute[1]));

      if(req.method==='GET'&&['/','/cart','/email-settings','/admin','/admin/accounts','/admin/settings'].includes(req.url)&&!session){res.writeHead(303,{Location:'/login'});return res.end();}
      if(req.method==='GET'&&['/email-settings','/admin','/admin/accounts','/admin/settings'].includes(req.url)&&session.role!=='admin'){res.writeHead(303,{Location:'/'});return res.end();}
      if(req.method==='GET'&&req.url==='/email-settings'){const account=requestUrl.searchParams.get('account');res.writeHead(303,{Location:'/admin/accounts'+(account?'?account='+encodeURIComponent(account):'')+'#email'});return res.end();}
      if (req.method === 'GET' && ['/api/menu','/api/catalogue'].includes(req.url)) {
        const catalogue=await readCatalogue();
        const products=catalogue.products.map(p=>({...p,supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name}));
        return json(200,req.url==='/api/menu'?products:{...catalogue,suppliers:session.role==='admin'?catalogue.suppliers:catalogue.suppliers.map(({id,name})=>({id,name})),products});
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
        const product={id:crypto.randomUUID(),name:productName,supplierId:input.supplierId,price:input.price===null?null:Math.round(input.price*100),stock:input.stock,category:name(input.category||'General','category',60),sku:typeof input.sku==='string'?input.sku.trim().slice(0,60):'',description:typeof input.description==='string'?input.description.slice(0,300):'',emoji:'📦',photo:photo||null};
        return json(edit?200:201,await mutate(c=>{if(!c.suppliers.some(s=>s.id===product.supplierId))fail('Choose an existing supplier.');if(edit){const index=c.products.findIndex(p=>p.id===edit[1]);if(index<0)fail('Stock not found.',404);product.id=c.products[index].id;product.emoji=c.products[index].emoji;if(photo===undefined)product.photo=c.products[index].photo||null;c.products[index]=product;}else{c.products.push(product);}return product;}));
      }
      const deletion=req.url.match(/^\/api\/(products|suppliers)\/([a-zA-Z0-9-]+)$/);
      if(req.method==='DELETE' && deletion){return json(200,await mutate(c=>{
        const collection=deletion[1];const id=deletion[2];if(!c[collection].some(item=>item.id===id))fail('Item not found.',404);
        if(collection==='suppliers'&&c.products.some(p=>p.supplierId===id))fail('Remove this supplier’s stock before removing the supplier.');
        c[collection]=c[collection].filter(item=>item.id!==id);return {removed:true};
      }));}
      if (req.method === 'POST' && req.url === '/api/orders') {
        const input=await body(req);
        const requestId=input?.requestId;
        if(requestId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))fail('Invalid request identifier.');
        const fingerprint=crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
        if(requestId){try{const previous=JSON.parse(await fs.readFile(path.join(dataDir,requestId+'.json'),'utf8'));if(previous.requestOwnerId!==session.id||previous.requestFingerprint!==fingerprint)fail('This request identifier belongs to another order.',409);return json(200,previous);}catch(error){if(error.code!=='ENOENT')throw error;}}
        const catalogue=await readCatalogue();
        const products=catalogue.products.map(p=>({...p,supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name}));
        let order;try{order=validateOrder(input,products);}catch(error){fail(error.message);}
        if(requestId)order.id=requestId;order.requestOwnerId=session.id;order.requestFingerprint=fingerprint;order.delivery=splitBySupplier(order).map(s=>({supplierId:s.supplierId,supplier:s.supplier,status:'pending',message:'Delivery processing is not yet confirmed.'}));
        await fs.mkdir(dataDir,{recursive:true});
        try{await fs.writeFile(path.join(dataDir,`${order.id}.json`),JSON.stringify(order,null,2),{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;const previous=JSON.parse(await fs.readFile(path.join(dataDir,order.id+'.json'),'utf8'));if(previous.requestOwnerId!==session.id||previous.requestFingerprint!==fingerprint)fail('This request identifier belongs to another order.',409);return json(200,previous);}
        order.delivery=await dispatchOrder(order,catalogue.suppliers,{env:await deliverySettings.deliveryEnvironment(dataDir,session.id)});
        const target=path.join(dataDir,`${order.id}.json`);const temp=target+'.tmp';await fs.writeFile(temp,JSON.stringify(order,null,2),{mode:0o600});await fs.rename(temp,target);
        return json(201,order);
      }
      const files = {'/':'index.html','/cart':'cart.html','/email-settings.js':'email-settings.js','/admin':'admin.html','/admin/accounts':'accounts.html','/admin/settings':'settings.html','/settings.js':'settings.js','/admin/login':'login.html','/login':'login.html','/setup':'setup.html','/setup.js':'setup.js','/branding.js':'branding.js','/password.js':'password.js','/admin.js':'admin.js','/admin-panels.js':'admin-panels.js','/login.js':'login.js','/app.js':'app.js','/style.css':'style.css','/smooth.css':'smooth.css','/interactions.js':'interactions.js','/navigation.js':'navigation.js','/interface-text.js':'interface-text.js','/app-editor.js':'app-editor.js','/element-overrides.js':'element-overrides.js','/fonts/Opsilon-xRj8m.ttf':'fonts/Opsilon-xRj8m.ttf'};
      if (req.method !== 'GET' || !files[req.url]) return json(404,{error:'Not found'});
      const file=files[req.url];
      res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':'text/javascript','X-Content-Type-Options':'nosniff'});
      res.end(await fs.readFile(path.join(__dirname,'public',file)));
    } catch(error) {json(error.status||500,{error:error.status?error.message:'Unable to save changes. Please try again.'});}
  });
}
if(require.main===module) createServer().listen(process.env.PORT || 3000,'0.0.0.0',()=>console.log('Souvlaki Gr ordering running on port '+(process.env.PORT || 3000)));
module.exports={createServer,validateOrder};
