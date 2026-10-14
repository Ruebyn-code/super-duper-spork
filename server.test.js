const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('./server');
const {saveAdmin,saveUser}=require('./auth');
async function login(url,username='admin',password='test-password-for-admin'){const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];const session=await(await fetch(url+'/api/session',{headers:{Cookie:cookie}})).json();return {Cookie:cookie,'X-CSRF-Token':session.csrf};}
test('catalogue, saved stock request, server pricing, and invalid quantity',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stockroom-'));await saveAdmin(dir,'admin','test-password-for-admin');const server=createServer(dir);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
 const headers=await login(url);const page=await fetch(url,{headers});assert.equal(page.status,200);assert.match(await page.text(),/Stock catalogue/);
 const cartPage=await fetch(url+'/cart',{headers});assert.equal(cartPage.status,200);const cartHtml=await cartPage.text();assert.match(cartHtml,/id="checkout"/);assert.ok(!cartHtml.includes('id="menu"'));assert.equal((await fetch(url+'/cart',{redirect:'manual'})).headers.get('location'),'/login');
 const home=await fetch(url+'/home',{headers});assert.equal(home.status,200);assert.equal(home.headers.get('cache-control'),'no-store');assert.match(await home.text(),/id="home-user-name"/);assert.equal((await fetch(url+'/home',{redirect:'manual'})).headers.get('location'),'/login');
 const menu=await (await fetch(url+'/api/menu',{headers})).json();assert.equal(menu.length,6+require('./catalogue/book2.json').products.length);
 const body={name:'Test requester',phone:'0400 123 456',location:'Warehouse',items:[{id:'paper',quantity:3,price:1}]};
 const response=await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(response.status,201);const order=await response.json();assert.equal(order.total,1950);assert.equal(order.location,'Warehouse');
 const saved=JSON.parse(await fs.readFile(path.join(dir,order.id+'.json'),'utf8'));assert.equal(saved.total,1950);
 body.items[0].quantity=-1;assert.equal((await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify(body)})).status,400);
 assert.equal((await fetch(url+'/data/'+order.id+'.json',{headers})).status,404);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('supplier stock management persists across restarts and preserves historical requests',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sk-suppliers-'));let server,headers;await saveAdmin(dir,'admin','test-password-for-admin');
 async function start(){server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;headers=await login(url);return url;}
 let url=await start();
 const request=async(route,method='GET',body)=>{const response=await fetch(url+route,{method,headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{
 const supplier=await request('/api/suppliers','POST',{name:'New Supplier'});assert.equal(supplier.status,201);
 assert.equal((await request('/api/suppliers','POST',{name:'new supplier'})).status,400);
 assert.equal((await request('/api/products','POST',{supplierId:'missing',name:'Invalid',price:1,stock:1})).status,400);
 const added=await request('/api/products','POST',{supplierId:supplier.data.id,name:'Custom stock',price:12.34,stock:7,sku:'TEST',category:'Custom'});assert.equal(added.status,201);
 assert.equal((await request('/api/suppliers/'+supplier.data.id,'DELETE')).status,400);
 await new Promise(r=>server.close(r));url=await start();
 const catalogue=await request('/api/catalogue');const product=catalogue.data.products.find(p=>p.id===added.data.id);assert.equal(product.price,1234);assert.equal(product.supplier,'New Supplier');assert.equal(product.stock,7);
 const order=await request('/api/orders','POST',{name:'Buyer',phone:'0400 123 456',location:'Office',items:[{id:product.id,quantity:2,price:1}]});assert.equal(order.status,201);assert.equal(order.data.total,2468);assert.equal(order.data.items[0].supplier,'New Supplier');
 assert.equal((await request('/api/products/'+product.id,'DELETE')).status,200);
 assert.equal((await request('/api/orders','POST',{name:'Buyer',phone:'0400 123 456',location:'Office',items:[{id:product.id,quantity:2}]})).status,400);
 const historical=JSON.parse(await fs.readFile(path.join(dir,order.data.id+'.json'),'utf8'));assert.equal(historical.items[0].name,'Custom stock');assert.equal(historical.items[0].supplier,'New Supplier');
 assert.equal((await request('/api/suppliers/'+supplier.data.id,'DELETE')).status,200);
 await new Promise(r=>server.close(r));url=await start();assert.ok(!(await request('/api/catalogue')).data.suppliers.some(s=>s.id===supplier.data.id));
 const results=await Promise.all(['Concurrent A','Concurrent B'].map(name=>request('/api/suppliers','POST',{name})));assert.ok(results.every(r=>r.status===201));const final=await request('/api/catalogue');assert.ok(final.data.suppliers.some(s=>s.name==='Concurrent A'));assert.ok(final.data.suppliers.some(s=>s.name==='Concurrent B'));
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('stock edits persist, validate input, and preserve previously saved orders',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sk-edit-'));let server,headers;await saveAdmin(dir,'admin','test-password-for-admin');
 async function start(){server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;headers=await login(url);return url;}
 let url=await start();
 async function request(route,method='GET',body){const response=await fetch(url+route,{method,headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 try{
 const added=await request('/api/products','POST',{name:'Original',supplierId:'office',price:5,stock:1});assert.equal(added.status,201);const id=added.data.id;
 const order=await request('/api/orders','POST',{name:'Buyer',phone:'0400 123 456',location:'Office',items:[{id,quantity:2}]});assert.equal(order.status,201);
 const changes={name:'Updated stock',supplierId:'safety',sku:'NEW-SKU',category:'Equipment',price:7.95,stock:22,description:'Updated description'};
 assert.equal((await request('/api/products/'+id,'PUT',{...changes,price:-1})).status,400);
 assert.equal((await request('/api/products/'+id,'PUT',{...changes,supplierId:'missing'})).status,400);
 assert.equal((await request('/api/products/missing','PUT',changes)).status,404);
 const result=await request('/api/products/'+id,'PUT',changes);assert.equal(result.status,200);assert.equal(result.data.id,id);
 await new Promise(r=>server.close(r));url=await start();
 const catalogue=(await request('/api/catalogue')).data;const product=catalogue.products.find(p=>p.id===id);assert.equal(catalogue.products.filter(p=>p.id===id).length,1);assert.equal(product.name,'Updated stock');assert.equal(product.price,795);assert.equal(product.stock,22);assert.equal(product.supplier,'Safety Supplies');assert.equal(product.description,'Updated description');assert.equal(product.sku,'NEW-SKU');assert.equal(product.category,'Equipment');
 const next=await request('/api/orders','POST',{name:'Buyer',phone:'0400 123 456',location:'Office',items:[{id,quantity:2}]});assert.equal(next.data.total,1590);
 const historical=JSON.parse(await fs.readFile(path.join(dir,order.data.id+'.json'),'utf8'));assert.equal(historical.total,1000);assert.equal(historical.items[0].name,'Original');assert.equal(historical.items[0].supplier,'Office Supplies');
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('everyone must sign in and only administrators can manage stock',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-permissions-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
 const page=await fetch(url,{redirect:'manual'});assert.equal(page.status,303);assert.equal(page.headers.get('location'),'/login');
 const adminPage=await fetch(url+'/admin',{redirect:'manual'});assert.equal(adminPage.status,303);
 for(const route of ['/api/menu','/api/catalogue'])assert.equal((await fetch(url+route)).status,401);
 for(const [route,method] of [['/api/suppliers','POST'],['/api/products','POST'],['/api/products/paper','PUT'],['/api/products/paper','DELETE'],['/api/suppliers/office','DELETE'],['/api/orders','POST']])assert.equal((await fetch(url+route,{method,body:'{}'})).status,401);
 assert.equal((await fetch(url+'/api/login',{method:'POST',body:JSON.stringify({username:'admin',password:'incorrect'})})).status,401);
 const staff=await login(url,'staff','test-password-for-staff');
 const ordering=await fetch(url,{headers:staff});assert.equal(ordering.status,200);const html=await ordering.text();assert.ok(!html.includes('id="stock-form"'));assert.ok(!html.includes('id="supplier-form"'));
 assert.equal((await fetch(url+'/admin',{headers:staff,redirect:'manual'})).headers.get('location'),'/');
 for(const [route,method] of [['/api/suppliers','POST'],['/api/products','POST'],['/api/products/paper','PUT'],['/api/products/paper','DELETE'],['/api/suppliers/office','DELETE']])assert.equal((await fetch(url+route,{method,headers:staff,body:'{}'})).status,403);
 const order=await fetch(url+'/api/orders',{method:'POST',headers:staff,body:JSON.stringify({name:'Staff',phone:'0400 123 456',location:'Office',items:[{id:'paper',quantity:1}]})});assert.equal(order.status,201);
 const admin=await login(url);const management=await fetch(url+'/admin',{headers:admin});assert.equal(management.status,200);const stockHtml=await management.text();assert.match(stockHtml,/id="stock-form"/);assert.ok(!stockHtml.includes('id="account-form"'));
 const accountPage=await fetch(url+'/admin/accounts',{headers:admin});assert.equal(accountPage.status,200);const accountHtml=await accountPage.text();assert.match(accountHtml,/id="account-form"/);assert.ok(!accountHtml.includes('id="stock-form"'));
 assert.equal((await fetch(url+'/admin/accounts',{headers:staff,redirect:'manual'})).headers.get('location'),'/');
 assert.equal((await fetch(url+'/admin/accounts',{redirect:'manual'})).headers.get('location'),'/login');
 assert.equal((await fetch(url+'/api/suppliers',{method:'POST',headers:{Cookie:admin.Cookie},body:JSON.stringify({name:'Denied'})})).status,403);
 assert.equal((await fetch(url+'/api/suppliers',{method:'POST',headers:admin,body:JSON.stringify({name:'Allowed'})})).status,201);
 assert.equal((await fetch(url+'/api/logout',{method:'POST',headers:admin})).status,200);assert.equal((await fetch(url+'/api/products/paper',{method:'DELETE',headers:admin})).status,401);
 const beforeReset=await login(url);await saveAdmin(dir,'admin','changed-password-for-admin');assert.equal((await fetch(url+'/api/catalogue',{headers:beforeReset})).status,401);
 const credentials=await fs.readFile(path.join(dir,'accounts.json'),'utf8');assert.ok(!credentials.includes('changed-password-for-admin'));
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('in-app accounts, permissions, revocation, and last administrator protection',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-accounts-'));const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 async function request(route,method,headers={},body){const response=await fetch(url+route,{method,headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 try{
 assert.equal((await fetch(url+'/login',{redirect:'manual'})).headers.get('location'),'/setup');
 assert.equal((await request('/api/setup','POST',{}, {username:'first',password:'first-admin-password'})).status,201);
 assert.equal((await request('/api/setup','POST',{}, {username:'second',password:'second-admin-password'})).status,409);
 const admin=await login(url,'first','first-admin-password');const first=(await request('/api/accounts','GET',admin)).data[0];
 assert.equal((await request('/api/accounts','POST',admin,{username:'staff',password:'staff-account-password',role:'superadmin'})).status,400);
 const staffAccount=await request('/api/accounts','POST',admin,{username:'staff',password:'staff-account-password',role:'user'});assert.equal(staffAccount.status,201);assert.ok(!('hash' in staffAccount.data));
 assert.equal((await request('/api/accounts','POST',admin,{username:'staff',password:'staff-account-password',role:'user'})).status,400);
 const staff=await login(url,'staff','staff-account-password');assert.equal((await request('/api/accounts','GET',staff)).status,403);assert.equal((await request('/api/accounts','POST',staff,{username:'evil',password:'staff-account-password',role:'admin'})).status,403);
 assert.equal((await request('/api/accounts/'+first.id,'DELETE',admin)).status,400);
 assert.equal((await request('/api/accounts/'+first.id,'PUT',admin,{username:'first',role:'user',password:''})).status,400);
 assert.equal((await request('/api/accounts/'+staffAccount.data.id,'PUT',admin,{username:'staff',role:'admin',password:''})).status,200);
 assert.equal((await fetch(url+'/api/catalogue',{headers:staff})).status,401);
 const promoted=await login(url,'staff','staff-account-password');assert.equal((await request('/api/accounts','GET',promoted)).status,200);
 assert.equal((await request('/api/accounts/'+staffAccount.data.id,'PUT',admin,{username:'staff',role:'user',password:'new-staff-password'})).status,200);assert.equal((await request('/api/accounts','GET',promoted)).status,401);
 const reset=await login(url,'staff','new-staff-password');assert.equal((await request('/api/accounts/'+staffAccount.data.id,'DELETE',admin)).status,200);assert.equal((await fetch(url+'/api/catalogue',{headers:reset})).status,401);
 const all=await request('/api/accounts','GET',admin);assert.equal(all.data.length,1);assert.deepEqual(Object.keys(all.data[0]).sort(),['id','locationId','locationIds','role','username']);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('legacy sign-in accounts are preserved when account management saves changes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-legacy-'));const crypto=require('node:crypto');const salt='legacy-test-salt';const hash=crypto.scryptSync('legacy-password',salt,64).toString('hex');
 await fs.writeFile(path.join(dir,'admin.json'),JSON.stringify({username:'legacy',salt,hash,version:'old'}));await fs.writeFile(path.join(dir,'users.json'),JSON.stringify([{username:'worker',salt,hash,version:'old-user'}]));
 const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const admin=await login(url,'legacy','legacy-password');await login(url,'worker','legacy-password');const response=await fetch(url+'/api/accounts',{method:'POST',headers:admin,body:JSON.stringify({username:'new',password:'new-account-password',role:'user'})});assert.equal(response.status,201);await login(url,'legacy','legacy-password');await login(url,'worker','legacy-password');const accounts=JSON.parse(await fs.readFile(path.join(dir,'accounts.json'),'utf8'));assert.equal(accounts.length,3);}finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('only administrators can upload a logo and sign-in uses blue background',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-logo-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=','base64');
 try{
 assert.equal((await fetch(url+'/logo')).status,404);
 const upload=headers=>fetch(url+'/api/logo',{method:'POST',headers,body:JSON.stringify({data:png.toString('base64')})});
 assert.equal((await upload({})).status,401);const staff=await login(url,'staff','test-password-for-staff');assert.equal((await upload(staff)).status,403);
 const admin=await login(url);assert.equal((await upload(admin)).status,200);
 const logo=await fetch(url+'/logo');assert.equal(logo.headers.get('content-type'),'image/png');assert.deepEqual(Buffer.from(await logo.arrayBuffer()),png);
 assert.equal((await fetch(url+'/api/logo',{method:'POST',headers:admin,body:JSON.stringify({data:Buffer.from('<svg/>').toString('base64')})})).status,400);
 const saved=JSON.parse(await fs.readFile(path.join(dir,'logo.json'),'utf8'));assert.equal(saved.data,png.toString('base64'));
 const loginPage=await(await fetch(url+'/login')).text();assert.match(loginPage,/class="authentication-page"/);assert.match(loginPage,/<img src="\/logo" alt="Souvlaki GR" class="app-logo">/);assert.equal(JSON.parse(loginPage.match(/<script id="app-bootstrap" type="application\/json">([^<]*)<\/script>/)[1]).hasLogo,true);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('sidebar logo has separate admin-only upload, persists and falls back to the app logo',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-sidebar-logo-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');let server;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=','base64'),jpg=Buffer.from([255,216,255,224,0,16]);
 async function start(){server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
 try{
 let url=await start(),admin=await login(url),staff=await login(url,'staff','test-password-for-staff');
 const upload=(headers,data=png)=>fetch(url+'/api/sidebar-logo',{method:'POST',headers,body:JSON.stringify({data:data.toString('base64')})});
 assert.equal((await fetch(url+'/sidebar-logo')).status,404);
 assert.equal((await upload({})).status,401);assert.equal((await upload(staff)).status,403);
 assert.equal((await upload({Cookie:admin.Cookie,'Content-Type':'application/json'})).status,403);
 assert.equal((await upload(admin,Buffer.from('<svg/>'))).status,400);
 assert.equal((await upload(admin)).status,200);
 assert.equal((await fetch(url+'/logo')).status,404);
 assert.deepEqual(Buffer.from(await (await fetch(url+'/sidebar-logo')).arrayBuffer()),png);
 const html=await(await fetch(url+'/',{headers:admin})).text();assert.match(html,/<img src="\/sidebar-logo" alt="Souvlaki GR" class="app-logo">/);
 await new Promise(r=>server.close(r));url=await start();admin=await login(url);staff=await login(url,'staff','test-password-for-staff');
 assert.deepEqual(Buffer.from(await (await fetch(url+'/sidebar-logo')).arrayBuffer()),png);
 assert.equal((await fetch(url+'/api/logo',{method:'POST',headers:admin,body:JSON.stringify({data:jpg.toString('base64')})})).status,200);
 assert.deepEqual(Buffer.from(await (await fetch(url+'/sidebar-logo')).arrayBuffer()),png);
 assert.deepEqual(Buffer.from(await (await fetch(url+'/logo')).arrayBuffer()),jpg);
 const loginHtml=await(await fetch(url+'/login')).text();assert.match(loginHtml,/src="\/logo"/);assert.ok(!loginHtml.includes('src="/sidebar-logo"'));
 assert.equal((await fetch(url+'/api/sidebar-logo',{method:'DELETE',headers:staff})).status,403);
 assert.equal((await fetch(url+'/api/sidebar-logo',{method:'DELETE',headers:{Cookie:admin.Cookie}})).status,403);
 assert.equal((await fetch(url+'/api/sidebar-logo',{method:'DELETE',headers:admin})).status,200);
 assert.deepEqual(Buffer.from(await (await fetch(url+'/sidebar-logo')).arrayBuffer()),jpg);
 assert.deepEqual(Buffer.from(await (await fetch(url+'/logo')).arrayBuffer()),jpg);
 }finally{if(server?.listening)await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('stock photos save, survive edits, and can be removed without on-hand input',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-photos-'));await saveAdmin(dir,'admin','test-password-for-admin');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
 const headers=await login(url);const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=';
 const body={name:'Photo item',supplierId:'office',price:3,photo};
 const create=await fetch(url+'/api/products',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(create.status,201);const product=await create.json();assert.equal(product.photo,photo);
 const catalogue=JSON.parse(await fs.readFile(path.join(dir,'catalogue.json'),'utf8'));assert.equal(catalogue.products.find(p=>p.id===product.id).photo,photo);
 const update={name:'Renamed item',supplierId:'office',price:4};
 let response=await fetch(url+'/api/products/'+product.id,{method:'PUT',headers,body:JSON.stringify(update)});assert.equal(response.status,200);assert.equal((await response.json()).photo,photo);
 response=await fetch(url+'/api/products/'+product.id,{method:'PUT',headers,body:JSON.stringify({...update,photo:'data:image/png;base64,YmFk'})});assert.equal(response.status,400);
 response=await fetch(url+'/api/products/'+product.id,{method:'PUT',headers,body:JSON.stringify({...update,photo:null})});assert.equal(response.status,200);assert.equal((await response.json()).photo,null);
 const html=await(await fetch(url+'/admin',{headers})).text();assert.ok(html.includes('id="stock-photo"'));assert.ok(!html.includes('name="stock"'));
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('spreadsheet imports all suppliers and items once while retaining edits and pending prices',async()=>{
 const {mergeSpreadsheet}=require('./catalogue-import');const imported=require('./catalogue/book2.json');
 assert.equal(imported.suppliers.length,11);assert.equal(imported.products.length,128);assert.equal(imported.products.filter(p=>p.price===null).length,22);
 const original=imported.products[0];const catalogue={suppliers:[{id:'existing',name:imported.suppliers[0].name}],products:[{...original,id:'custom',supplierId:'existing',price:999,photo:'existing-photo'}]};mergeSpreadsheet(catalogue);
 assert.equal(catalogue.suppliers.length,11);assert.equal(catalogue.products.length,128);assert.equal(catalogue.products[0].price,999);assert.equal(catalogue.products[0].photo,'existing-photo');catalogue.products.pop();mergeSpreadsheet(catalogue);assert.equal(catalogue.products.length,127);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-import-'));await saveAdmin(dir,'admin','test-password-for-admin');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const headers=await login(url);const menu=await(await fetch(url+'/api/menu',{headers})).json();const missing=menu.find(p=>p.price===null);assert.ok(missing);const response=await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify({name:'Buyer',phone:'0400 123 456',location:'Office',items:[{id:missing.id,quantity:1},{id:original.id,quantity:1}]})});assert.equal(response.status,201);const order=await response.json();assert.equal(order.pricePending,true);assert.equal(order.total,4395);assert.equal(order.items[0].price,null);
 const updated=await fetch(url+'/api/products/'+missing.id,{method:'PUT',headers,body:JSON.stringify({name:missing.name,supplierId:missing.supplierId,price:null,description:'Updated without inventing a price'})});assert.equal(updated.status,200);assert.equal((await updated.json()).price,null);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('app settings are admin-only, validated, and persistent',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-settings-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const {defaults}=require('./appearance');const settings={...defaults,primary:'#123456',secondary:'#abcdef',fonts:{...defaults.fonts,headings:'georgia',buttons:'verdana'}};
 assert.equal((await fetch(url+'/admin/settings',{redirect:'manual'})).headers.get('location'),'/login');
 const staff=await login(url,'staff','test-password-for-staff');assert.equal((await fetch(url+'/admin/settings',{headers:staff,redirect:'manual'})).headers.get('location'),'/');assert.equal((await fetch(url+'/api/settings',{method:'PUT',headers:staff,body:JSON.stringify(settings)})).status,403);
 const admin=await login(url);const page=await fetch(url+'/admin/settings',{headers:admin});assert.equal(page.status,200);const html=await page.text();assert.match(html,/id="logo-preview"/);assert.match(html,/id="appearance-form"/);
 assert.equal((await fetch(url+'/api/settings',{method:'PUT',headers:admin,body:JSON.stringify({...settings,primary:'red;'} )})).status,400);
 assert.equal((await fetch(url+'/api/settings',{method:'PUT',headers:admin,body:JSON.stringify({...settings,fonts:{...settings.fonts,buttons:'injected'}})})).status,400);
 assert.equal((await fetch(url+'/api/settings',{method:'PUT',headers:admin,body:JSON.stringify(settings)})).status,200);
 assert.deepEqual(await(await fetch(url+'/appearance')).json(),settings);assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'appearance.json'),'utf8')),settings);
 assert.equal((await fetch(url+'/api/settings',{method:'PUT',body:JSON.stringify(defaults)})).status,401);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('delivery configuration is admin-only, secrets stay private, and repeat orders do not dispatch again',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-delivery-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const admin=await login(url),staff=await login(url,'staff','test-password-for-staff');
 assert.equal((await fetch(url+'/api/delivery-settings',{headers:staff})).status,403);
 const settings={RESEND_API_KEY:'test-not-a-real-key',ORDER_FROM_EMAIL:'orders@example.com',DELIVERY_EMAIL_ENABLED:false,DELIVERY_SMS_ENABLED:false,DELIVERY_SYSTEM_ENABLED:false};
 let response=await fetch(url+'/api/delivery-settings',{method:'PUT',headers:admin,body:JSON.stringify(settings)});assert.equal(response.status,200);assert.ok(!(await response.text()).includes('test-not-a-real-key'));
 response=await fetch(url+'/api/delivery-settings',{headers:admin});assert.ok(!(await response.text()).includes('test-not-a-real-key'));
 const delivery={method:'email',contact:'supplier@example.com'};assert.equal((await fetch(url+'/api/suppliers/office',{method:'PUT',headers:staff,body:JSON.stringify({delivery})})).status,403);assert.equal((await fetch(url+'/api/suppliers/office',{method:'PUT',headers:admin,body:JSON.stringify({delivery})})).status,200);
 const catalogue=await(await fetch(url+'/api/catalogue',{headers:staff})).json();assert.ok(!('delivery' in catalogue.suppliers.find(s=>s.id==='office')));
 const body={requestId:require('node:crypto').randomUUID(),name:'Buyer',phone:'0400 123 456',location:'Office',items:[{id:'paper',quantity:2}]};
 response=await fetch(url+'/api/orders',{method:'POST',headers:staff,body:JSON.stringify(body)});assert.equal(response.status,201);const order=await response.json();assert.equal(order.delivery[0].status,'not_configured');assert.equal(order.id,body.requestId);
 response=await fetch(url+'/api/orders',{method:'POST',headers:staff,body:JSON.stringify(body)});assert.equal(response.status,200);assert.equal((await response.json()).id,order.id);
 body.items[0].quantity=3;assert.equal((await fetch(url+'/api/orders',{method:'POST',headers:staff,body:JSON.stringify(body)})).status,409);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('location email settings are edited through locations while legacy account URLs remain read-only',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-personal-email-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'first','first-account-password');await saveUser(dir,'second','second-account-password');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const first=await login(url,'first','first-account-password'),second=await login(url,'second','second-account-password'),admin=await login(url);
 const firstSession=await(await fetch(url+'/api/session',{headers:first})).json();const secondSession=await(await fetch(url+'/api/session',{headers:second})).json();
 const settings={ORDER_FROM_EMAIL:'first@example.com',RESEND_API_KEY:'first-test-key',DELIVERY_EMAIL_ENABLED:true};
 assert.equal((await fetch(url+'/api/accounts/'+firstSession.id+'/email',{method:'PUT',headers:admin,body:JSON.stringify(settings)})).status,405);assert.equal((await fetch(url+'/api/my-email-settings',{method:'PUT',headers:admin,body:JSON.stringify(settings)})).status,405);
 const saved=await fetch(url+'/api/locations/'+firstSession.locationId+'/email',{method:'PUT',headers:admin,body:JSON.stringify(settings)});assert.equal(saved.status,200);assert.ok(!(await saved.text()).includes('first-test-key'));
 const other=await(await fetch(url+'/api/accounts/'+secondSession.id+'/email',{headers:admin})).json();assert.equal(other.values.ORDER_FROM_EMAIL,'');assert.equal(other.secrets.RESEND_API_KEY,false);
 assert.equal((await fetch(url+'/api/my-email-settings',{method:'GET'})).status,401);
 assert.equal((await fetch(url+'/api/my-email-settings',{headers:{Cookie:first.Cookie}})).status,403);
 assert.equal((await fetch(url+'/api/my-email-settings',{method:'PUT',headers:first,body:JSON.stringify(settings)})).status,403);
 assert.equal((await fetch(url+'/api/accounts/'+firstSession.id+'/email',{method:'PUT',headers:first,body:JSON.stringify(settings)})).status,403);
 assert.equal((await fetch(url+'/email-settings',{headers:first,redirect:'manual'})).headers.get('location'),'/');
 const oldEmailPage=await fetch(url+'/email-settings?account='+firstSession.id,{headers:admin,redirect:'manual'});assert.equal(oldEmailPage.status,303);assert.equal(oldEmailPage.headers.get('location'),'/admin/accounts?location='+firstSession.locationId+'#locations');
 const emailPage=await fetch(url+'/admin/accounts?account='+firstSession.id,{headers:admin});assert.equal(emailPage.status,200);const emailHtml=await emailPage.text();assert.match(emailHtml,/id="location-email-editor"/);assert.match(emailHtml,/class="management users-directory locations-directory"/);assert.ok(!emailHtml.includes('href="/admin/accounts#email"'));assert.ok(!emailHtml.includes('id="email-account"'));assert.ok(!emailHtml.includes('href="/email-settings#email"'));
 const deliverySettings=require('./delivery-settings');const firstEnv=await deliverySettings.deliveryEnvironment(dir,firstSession.id);const secondEnv=await deliverySettings.deliveryEnvironment(dir,secondSession.id);assert.equal(firstEnv.RESEND_API_KEY,'first-test-key');assert.equal(secondEnv.RESEND_API_KEY,undefined);
 await deliverySettings.save(dir,{ORDER_FROM_EMAIL:'second@example.com',RESEND_API_KEY:'second-test-key',DELIVERY_EMAIL_ENABLED:true},secondSession.id);
 const {deliverSupplier}=require('./order-delivery');const calls=[];const fetchImpl=async(url,options)=>{calls.push(options);return {ok:true};};const order={orderId:'test',supplierId:'office',requester:'Buyer',phone:'0400000000',location:'Office',notes:'',items:[{name:'Paper',price:650,quantity:1}],total:650};
 await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env:firstEnv,fetchImpl});await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env:await deliverySettings.deliveryEnvironment(dir,secondSession.id),fetchImpl});assert.equal(JSON.parse(calls[0].body).from,'first@example.com');assert.equal(JSON.parse(calls[1].body).from,'second@example.com');assert.notEqual(calls[0].headers.Authorization,calls[1].headers.Authorization);
 assert.equal((await fetch(url+'/api/suppliers/office',{method:'PUT',headers:admin,body:JSON.stringify({delivery:{method:'sms',contact:'+61400000000'}})})).status,400);
 for(const [route,own,absent] of [['/admin','id="stock-form"','id="account-form"'],['/admin/accounts','id="account-form"','id="appearance-form"'],['/admin/settings','id="appearance-form"','id="stock-form"']]){const html=await(await fetch(url+route,{headers:admin})).text();assert.ok(html.includes('class="admin-sidebar"'));assert.ok(html.includes('href="'+route+'#'));assert.ok(html.includes('id="app-subsidebar"'));assert.ok(html.includes('data-sidebar-group="'));assert.ok(!html.includes('class="admin-nav-group"'));assert.ok(html.includes(own));assert.ok(!html.includes(absent));}
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('interface text is editable only by administrators and handles plain text safely',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-text-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const admin=await login(url),staff=await login(url,'staff','test-password-for-staff');const changes={Cart:'Basket','Yassou,':'Hello,','Page {page} of {pages} · {count} items':'{page}/{pages} · {count} products'};
 assert.equal((await fetch(url+'/api/interface-text',{method:'PUT',headers:staff,body:JSON.stringify(changes)})).status,403);
 assert.equal((await fetch(url+'/api/interface-text',{method:'PUT',headers:admin,body:JSON.stringify(changes)})).status,200);assert.deepEqual(await(await fetch(url+'/interface-text')).json(),changes);
 assert.equal((await fetch(url+'/api/interface-text',{method:'PATCH',headers:staff,body:JSON.stringify({original:'Cart',value:'Bag'})})).status,403);
 assert.equal((await fetch(url+'/api/interface-text',{method:'PATCH',headers:admin,body:JSON.stringify({original:'Cart',value:'Bag'})})).status,200);const patched=await(await fetch(url+'/interface-text')).json();assert.equal(patched.Cart,'Bag');assert.equal(patched['Yassou,'],'Hello,');
 assert.equal((await fetch(url+'/api/interface-text',{method:'PATCH',headers:admin,body:JSON.stringify({original:'Cart',value:null})})).status,200);assert.equal((await(await fetch(url+'/interface-text')).json()).Cart,null);
 assert.equal((await fetch(url+'/api/interface-text',{method:'PUT',headers:admin,body:JSON.stringify({'Page {page} of {pages} · {count} items':'Missing values'})})).status,400);
 assert.equal((await fetch(url+'/api/interface-text',{method:'PUT',headers:admin,body:JSON.stringify({unknown:'value'})})).status,400);
 assert.equal((await fetch(url+'/api/interface-text',{method:'PUT',headers:admin,body:JSON.stringify({Cart:''})})).status,200);assert.deepEqual(await(await fetch(url+'/interface-text')).json(),{});
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('direct appearance edits keep existing settings and support background images and removal',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-style-edit-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const admin=await login(url),staff=await login(url,'staff','test-password-for-staff');const patch=(headers,body)=>fetch(url+'/api/settings',{method:'PATCH',headers,body:JSON.stringify(body)});
 assert.equal((await patch(staff,{fonts:{buttons:'georgia'}})).status,403);
 assert.equal((await patch(admin,{fonts:{buttons:'georgia'},backgrounds:{sidebar:'#123456'},fontColours:{buttons:'#e27925'}})).status,200);
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=';
 assert.equal((await patch(admin,{backgroundImages:{sidebar:image}})).status,200);let saved=await(await fetch(url+'/appearance')).json();assert.equal(saved.fonts.buttons,'georgia');assert.equal(saved.backgrounds.sidebar,'#123456');assert.equal(saved.backgroundImages.sidebar,image);assert.equal(saved.fontColours.buttons,'#e27925');
 assert.equal((await patch(admin,{backgroundImages:{sidebar:'data:image/png;base64,YmFk'}})).status,400);assert.equal((await patch(admin,{backgrounds:{unknown:'#123456'}})).status,400);assert.equal((await patch(admin,{fontColours:{buttons:'invalid'}})).status,400);
 assert.equal((await patch(admin,{backgrounds:{sidebar:null},backgroundImages:{sidebar:null}})).status,200);saved=await(await fetch(url+'/appearance')).json();assert.equal(saved.backgrounds.sidebar,undefined);assert.equal(saved.backgroundImages.sidebar,undefined);assert.equal(saved.fonts.buttons,'georgia');
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('per-element overrides are admin-only and preserve shared styles and labels',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-elements-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const admin=await login(url),staff=await login(url,'staff','test-password-for-staff');const patch=(headers,body)=>fetch(url+'/api/element-overrides',{method:'PATCH',headers,body:JSON.stringify(body)});const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=';
 const body={id:'index-test',changes:{text:{original:'Cart',value:'Basket'},font:'georgia',fontColour:'#123456',background:'#fedcba',backgroundImage:image}};
 assert.equal((await patch(staff,body)).status,403);assert.equal((await patch(admin,body)).status,200);const saved=await(await fetch(url+'/element-overrides')).json();assert.deepEqual(saved['index-test'],body.changes);assert.deepEqual(await(await fetch(url+'/interface-text')).json(),{});assert.equal((await(await fetch(url+'/appearance')).json()).fonts.navigation,'arial');
 assert.equal((await patch(admin,{id:'other',changes:{background:'javascript:bad'}})).status,400);assert.equal((await patch(admin,{id:'other',changes:{font:'invalid'}})).status,400);
 assert.equal((await patch(admin,{id:'index-test',changes:{text:{original:'Cart',value:null},backgroundImage:''}})).status,200);let current=await(await fetch(url+'/element-overrides')).json();assert.equal(current['index-test'].text.value,null);assert.equal(current['index-test'].backgroundImage,'');assert.equal(current['index-test'].font,'georgia');
 assert.equal((await patch(admin,{id:'index-test',changes:{restoreText:true,font:null,backgroundImage:null}})).status,200);current=await(await fetch(url+'/element-overrides')).json();assert.equal(current['index-test'].text,undefined);assert.equal(current['index-test'].font,undefined);assert.equal(current['index-test'].background,'#fedcba');
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('pages include saved formatting immediately and static assets revalidate without caching private data',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-navigation-'));await saveAdmin(dir,'admin','test-password-for-admin');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  const admin=await login(url),appearance=require('./appearance');
  await appearance.saveAppearance(dir,{...appearance.defaults,fonts:{...appearance.defaults.fonts,headings:'georgia'}});
  const unsafe='Basket </script><script>window.injected=true</script>';
  await require('./interface-text').save(dir,{Cart:unsafe});
  await require('./element-overrides').patch(dir,{id:'accounts-43',changes:{font:'verdana',fontColour:'#123456'}});
  const response=await fetch(url+'/admin/accounts',{headers:admin});assert.equal(response.headers.get('cache-control'),'no-store');
  const html=await response.text();assert.match(html,/<style id="appearance-style">[^<]*Georgia,serif/);assert.match(html,/<style id="element-appearance-style">[^<]*Verdana/);
  const bootstrap=JSON.parse(html.match(/<script id="app-bootstrap" type="application\/json">([^<]*)<\/script>/)[1]);assert.equal(bootstrap.interfaceText.Cart,unsafe);assert.equal(bootstrap.elementOverrides['accounts-43'].font,'verdana');assert.ok(!html.includes('window.injected=true</script>'));
  const fontPath=html.match(/<link rel="preload" href="([^"]+)" as="font"/)[1];const font=await fetch(url+fontPath);assert.match(font.headers.get('cache-control'),/immutable/);assert.equal(font.status,200);
  assert.equal((await fetch(url+fontPath,{headers:{'If-None-Match':font.headers.get('etag')}})).status,304);
  const script=await fetch(url+'/branding.js');assert.match(script.headers.get('cache-control'),/must-revalidate/);assert.equal((await fetch(url+'/branding.js',{headers:{'If-None-Match':script.headers.get('etag')}})).status,304);
  await appearance.saveAppearance(dir,{...appearance.defaults,fonts:{...appearance.defaults.fonts,headings:'trebuchet'}});
  const updated=await(await fetch(url+'/admin/accounts',{headers:admin})).text();assert.match(updated,/<style id="appearance-style">[^<]*Trebuchet MS/);assert.equal((await fetch(url+'/api/session',{headers:admin})).headers.get('cache-control'),'no-store');
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('signed-in users can save zero and partial stock counts with private history and safe retries',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-stock-counts-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'first','first-count-password');await saveUser(dir,'second','second-count-password');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  const admin=await login(url),first=await login(url,'first','first-count-password'),second=await login(url,'second','second-count-password');
  assert.equal((await fetch(url+'/stock-count',{redirect:'manual'})).headers.get('location'),'/login');
  const page=await fetch(url+'/stock-count',{headers:first});assert.equal(page.status,200);const html=await page.text();assert.match(html,/id="count-form"/);assert.match(html,/href="\/stock-count"/);assert.match(html,/data-count-view="history"/);
  assert.equal((await fetch(url+'/api/stock-counts')).status,401);
  const before=await(await fetch(url+'/api/catalogue',{headers:first})).json();
  const body={requestId:require('node:crypto').randomUUID(),countDate:'2026-07-01',location:' Kitchen ',notes:'Morning count',accountId:'not-the-owner',counterName:'Someone else',items:[{id:'paper',name:'Wrong name',quantity:0},{id:'pens',quantity:1.25}]};
  assert.equal((await fetch(url+'/api/stock-counts',{method:'POST',headers:{Cookie:first.Cookie,'Content-Type':'application/json'},body:JSON.stringify(body)})).status,403);
  let response=await fetch(url+'/api/stock-counts',{method:'POST',headers:first,body:JSON.stringify(body)});assert.equal(response.status,201);const record=await response.json();assert.equal(record.counterName,'first');assert.equal(record.location,'Kitchen');assert.equal(record.items.find(item=>item.id==='paper').name,'A4 copy paper');assert.equal(record.items.find(item=>item.id==='paper').quantity,0);assert.equal(record.items.find(item=>item.id==='pens').quantity,1.25);
  const after=await(await fetch(url+'/api/catalogue',{headers:first})).json();
  assert.deepEqual(after.products.map(({ordering,...product})=>product),before.products.map(({ordering,...product})=>product));
  assert.equal(after.stockTake.id,record.id);assert.equal(after.products.find(product=>product.id==='paper').ordering.stockCount,0);assert.equal(after.products.find(product=>product.id==='pens').ordering.stockCount,1.25);
  const history=await(await fetch(url+'/api/stock-counts',{headers:first})).json();assert.equal(history.length,1);assert.equal(history[0].itemCount,2);assert.ok(!('items' in history[0]));assert.equal((await(await fetch(url+'/api/stock-counts',{headers:second})).json()).length,0);assert.equal((await(await fetch(url+'/api/stock-counts',{headers:admin})).json()).length,1);
  assert.equal((await fetch(url+'/api/stock-counts/'+record.id,{headers:second})).status,404);assert.equal((await fetch(url+'/api/stock-counts/'+record.id,{headers:first})).status,200);assert.equal((await fetch(url+'/api/stock-counts/'+record.id,{headers:admin})).status,200);assert.equal((await fetch(url+'/api/stock-counts/not-a-count',{headers:first})).status,404);
  response=await fetch(url+'/api/stock-counts',{method:'POST',headers:first,body:JSON.stringify(body)});assert.equal(response.status,200);assert.equal((await response.json()).id,record.id);
  assert.equal((await fetch(url+'/api/stock-counts',{method:'POST',headers:second,body:JSON.stringify(body)})).status,409);
  assert.equal((await fetch(url+'/api/stock-counts',{method:'POST',headers:first,body:JSON.stringify({...body,notes:'Different count'})})).status,409);
  const invalid=[{items:[]},{items:[{id:'paper',quantity:-1}]},{items:[{id:'paper',quantity:1.2345}]},{items:[{id:'paper',quantity:1000001}]},{items:[{id:'paper',quantity:'2'}]},{items:[{id:'paper',quantity:null}]},{items:[{id:'paper',quantity:1},{id:'paper',quantity:2}]},{items:[{id:'missing',quantity:1}]},{countDate:'2026-02-29'},{notes:'x'.repeat(1001)},{requestId:'../../other'}];
  for(const changes of invalid)assert.equal((await fetch(url+'/api/stock-counts',{method:'POST',headers:first,body:JSON.stringify({...body,requestId:require('node:crypto').randomUUID(),...changes})})).status,400);
  const concurrent={...body,requestId:require('node:crypto').randomUUID()};const replies=await Promise.all([1,2].map(()=>fetch(url+'/api/stock-counts',{method:'POST',headers:first,body:JSON.stringify(concurrent)})));assert.deepEqual(replies.map(reply=>reply.status).sort(),[200,201]);assert.equal((await fs.readdir(path.join(dir,'stock-counts'))).length,2);assert.equal((await fetch(url+'/data/stock-counts/'+record.id+'.json',{headers:first})).status,404);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('saved stock counts survive restarts and preserve removed stock names and quantities',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-count-restart-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','staff-count-password');let server;
 const start=async()=>{server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;};let url=await start();
 try{
  const staff=await login(url,'staff','staff-count-password'),admin=await login(url);const body={requestId:require('node:crypto').randomUUID(),countDate:'2026-10-14',items:[{id:'paper',quantity:2.125}]};
  const saved=await(await fetch(url+'/api/stock-counts',{method:'POST',headers:staff,body:JSON.stringify(body)})).json();
  assert.equal((await fetch(url+'/api/products/paper',{method:'DELETE',headers:admin})).status,200);
  await new Promise(r=>server.close(r));url=await start();const signedIn=await login(url,'staff','staff-count-password');const history=await(await fetch(url+'/api/stock-counts',{headers:signedIn})).json();assert.equal(history[0].id,saved.id);
  const snapshot=await(await fetch(url+'/api/stock-counts/'+saved.id,{headers:signedIn})).json();assert.equal(snapshot.items[0].name,'A4 copy paper');assert.equal(snapshot.items[0].supplier,'Office Supplies');assert.equal(snapshot.items[0].quantity,2.125);
  const retry=await fetch(url+'/api/stock-counts',{method:'POST',headers:signedIn,body:JSON.stringify(body)});assert.equal(retry.status,200);assert.equal((await retry.json()).id,saved.id);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('cart submits without requester, phone or delivery location and uses the signed-in account',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-simple-cart-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
 const headers=await login(url,'staff','test-password-for-staff');const html=await(await fetch(url+'/cart',{headers})).text();for(const field of ['name','phone','location'])assert.ok(!html.includes('name="'+field+'"'));assert.ok(html.includes('name="notes"'));
 const body={requestId:require('node:crypto').randomUUID(),notes:'Please deliver on Friday',items:[{id:'paper',quantity:2}]};
 const response=await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(response.status,201);const order=await response.json();assert.equal(order.name,'staff');assert.equal(order.phone,'');assert.equal(order.location,'');assert.equal(order.notes,body.notes);assert.equal(order.total,1300);assert.equal(order.delivery[0].status,'not_configured');
 const saved=JSON.parse(await fs.readFile(path.join(dir,order.id+'.json'),'utf8'));assert.equal(saved.name,'staff');const session=await(await fetch(url+'/api/session',{headers})).json();assert.equal(saved.requestOwnerId,session.id);
 const retry=await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify(body)});assert.equal(retry.status,200);assert.equal((await retry.json()).id,order.id);
 const invalid=await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify({items:[{id:'paper',quantity:0}]})});assert.equal(invalid.status,400);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('sign-in backgrounds and palette-linked appearance are admin-only, validated and rendered before sign-in',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-auth-theme-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
 const admin=await login(url),staff=await login(url,'staff','test-password-for-staff');const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=';
 const patch=(headers,body)=>fetch(url+'/api/settings',{method:'PATCH',headers,body:JSON.stringify(body)});
 const change={backgrounds:{signin:'secondary',cards:'primary'},backgroundImages:{signin:image},fontColours:{headings:'primary'}};
 assert.equal((await patch(staff,change)).status,403);assert.equal((await patch(admin,change)).status,200);
 assert.equal((await patch(admin,{backgrounds:{signin:'var(--bad)'}})).status,400);assert.equal((await patch(admin,{backgroundImages:{signin:'data:image/png;base64,YmFk'}})).status,400);
 const local={id:'login-7',changes:{fontColour:'secondary',background:'primary'}};assert.equal((await fetch(url+'/api/element-overrides',{method:'PATCH',headers:admin,body:JSON.stringify(local)})).status,200);
 const logo=await fetch(url+'/api/logo',{method:'POST',headers:admin,body:JSON.stringify({data:image.split(',')[1]})});assert.equal(logo.status,200);
 const html=await(await fetch(url+'/login')).text();assert.match(html,/:where\(\.authentication-page\)\{background-color:var\(--secondary\)!important/);assert.ok(html.includes(image));assert.ok(!html.slice(html.indexOf('<header>'),html.indexOf('</header>')).includes('app-logo'));assert.ok(html.slice(html.indexOf('<section class="management"')).includes('src="/logo"'));assert.match(html,/\[data-edit-id="login-7"\]\{color:var\(--secondary\)!important;background-color:var\(--primary\)!important/);
 const saved=await(await fetch(url+'/appearance')).json();assert.equal(saved.backgrounds.signin,'secondary');assert.equal(saved.fontColours.headings,'primary');assert.equal(saved.backgroundImages.signin,image);
 assert.equal((await patch(admin,{backgroundImages:{signin:null},backgrounds:{signin:null}})).status,200);const reset=await(await fetch(url+'/appearance')).json();assert.equal(reset.backgroundImages.signin,undefined);assert.equal(reset.backgrounds.signin,undefined);assert.equal(reset.backgrounds.cards,'primary');
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('automatic Sunday usage is account-scoped, recalculates counts/orders, and counts checkout retries once',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-auto-par-api-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
 const staff=await login(url,'staff','test-password-for-staff'),admin=await login(url);const session=await(await fetch(url+'/api/session',{headers:staff})).json(),window=require('./par-levels').windowFor(),shift=require('./stock-usage').shift;
 assert.equal((await fetch(url+'/api/stock-usage?week='+window.startDate)).status,401);assert.equal((await fetch(url+'/api/stock-usage',{method:'PUT',body:'{}'})).status,401);assert.equal((await fetch(url+'/api/stock-usage?week=invalid',{headers:staff})).status,400);assert.equal((await fetch(url+'/api/stock-usage',{method:'PUT',headers:staff,body:'{}'})).status,405);
 for(let index=0;index<=4;index++){const response=await fetch(url+'/api/stock-counts',{method:'POST',headers:staff,body:JSON.stringify({countDate:shift(window.currentWeekStart,-7*index),items:[{id:'paper',quantity:20},{id:'pens',quantity:0}]})});assert.equal(response.status,201);}
 for(let index=1;index<=4;index++){const response=await fetch(url+'/api/orders',{method:'POST',headers:staff,body:JSON.stringify({items:[{id:'paper',quantity:7}]})});assert.equal(response.status,201);const order=await response.json();order.createdAt=shift(window.currentWeekStart,-7*index)+'T00:00:00Z';await fs.writeFile(path.join(dir,order.id+'.json'),JSON.stringify(order));}
 let catalogue=await(await fetch(url+'/api/catalogue',{headers:staff})).json();assert.equal(catalogue.products.find(item=>item.id==='paper').par.level,7);assert.equal(catalogue.products.find(item=>item.id==='pens').par.level,0);assert.equal(catalogue.products.find(item=>item.id==='boxes').par.level,null);assert.equal(catalogue.parWindow.weekStartsOn,'Sunday');assert.equal(catalogue.parWindow.source,'sunday_counts_and_orders');
 const other=await(await fetch(url+'/api/catalogue',{headers:admin})).json();assert.equal(other.products.find(item=>item.id==='paper').par.level,null);const privateWeek=await(await fetch(url+'/api/stock-usage?week='+window.startDate,{headers:admin})).json();assert.equal(privateWeek.record.items.find(item=>item.id==='paper').opening,null);assert.equal(privateWeek.record.items.find(item=>item.id==='paper').ordered,0);
 const correction=await fetch(url+'/api/stock-counts',{method:'POST',headers:staff,body:JSON.stringify({countDate:window.currentWeekStart,items:[{id:'paper',quantity:18}]})});assert.equal(correction.status,201);catalogue=await(await fetch(url+'/api/catalogue',{headers:staff})).json();assert.equal(catalogue.products.find(item=>item.id==='paper').par.average,7.5);assert.equal(catalogue.products.find(item=>item.id==='paper').par.level,8);
 const body={requestId:require('node:crypto').randomUUID(),items:[{id:'paper',quantity:6}]};const replies=await Promise.all([1,2].map(()=>fetch(url+'/api/orders',{method:'POST',headers:staff,body:JSON.stringify(body)})));assert.deepEqual(replies.map(reply=>reply.status).sort(),[200,201]);
 const current=await(await fetch(url+'/api/stock-usage?week='+window.currentWeekStart,{headers:staff})).json();const item=current.record.items.find(item=>item.id==='paper');assert.equal(item.opening,18);assert.equal(item.ordered,6);assert.equal(item.available,24);assert.equal(item.status,'missing_closing_count');assert.equal(item.quantity,null);assert.equal((await(await fetch(url+'/api/catalogue',{headers:staff})).json()).products.find(product=>product.id==='paper').par.average,7.5);
 assert.equal((await fs.readdir(dir)).filter(file=>file.endsWith('.tmp')).length,0);assert.equal(current.record.accountId,session.id);assert.equal((await fetch(url+'/data/stock-counts',{headers:staff})).status,404);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('catalogue stock counts and recommendations use the newest own stock take without changing par history or subtracting orders',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-recommendations-'));await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
 const headers=await login(url,'staff','test-password-for-staff'),admin=await login(url);const session=await(await fetch(url+'/api/session',{headers})).json();const window=require('./par-levels').windowFor(),shift=require('./stock-usage').shift;
 for(let index=0;index<=4;index++){const response=await fetch(url+'/api/stock-counts',{method:'POST',headers,body:JSON.stringify({countDate:shift(window.currentWeekStart,-7*index),items:[{id:'paper',quantity:20},{id:'pens',quantity:0}]})});assert.equal(response.status,201);}
 for(let index=1;index<=4;index++){const id=require('node:crypto').randomUUID();await fs.writeFile(path.join(dir,id+'.json'),JSON.stringify({id,requestOwnerId:session.id,status:'requested',createdAt:shift(window.currentWeekStart,-7*index)+'T00:00:00Z',items:[{id:'paper',quantity:7}]}));}
 const today=shift(window.currentWeekStart,3);
 const countResponse=await fetch(url+'/api/stock-counts',{method:'POST',headers,body:JSON.stringify({countDate:today,items:[{id:'paper',quantity:2.625}]})});assert.equal(countResponse.status,201);const stockTake=await countResponse.json();
 let result=await(await fetch(url+'/api/catalogue',{headers})).json();assert.equal(result.stockTake.id,stockTake.id);assert.equal(result.stockTake.countDate,today);assert.equal(result.products.find(item=>item.id==='paper').par.level,7);assert.deepEqual(result.products.find(item=>item.id==='paper').ordering,{stockCount:2.625,recommended:5});assert.deepEqual(result.products.find(item=>item.id==='pens').ordering,{stockCount:null,recommended:null});
 assert.equal((await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify({items:[{id:'paper',quantity:3}]})})).status,201);result=await(await fetch(url+'/api/catalogue',{headers})).json();assert.equal(result.products.find(item=>item.id==='paper').ordering.recommended,5);
 const other=await(await fetch(url+'/api/catalogue',{headers:admin})).json();assert.equal(other.stockTake,null);assert.equal(other.products.find(item=>item.id==='paper').ordering.stockCount,null);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});

test('storage groups migrate safely, accept only Head Office edits and preserve count snapshots across restarts',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-count-groups-'));
 await saveAdmin(dir,'admin','test-password-for-admin');await saveUser(dir,'staff','test-password-for-staff');
 const original={imports:['book2-v1'],suppliers:[{id:'supplier',name:'Mixed supplier'}],products:[
  {id:'fresh',name:'Chicken (15kg box)',supplierId:'supplier',price:100,category:'General',description:'',photo:null},
  {id:'frozen',name:'Frozen chicken nuggets (1kg bag)',supplierId:'supplier',price:200,category:'General',description:''},
  {id:'container',name:'Plastic container for Greek salad',supplierId:'supplier',price:300,category:'General',description:''},
  {id:'cleaner',name:'Food surface cleaner',supplierId:'supplier',price:400,category:'General',description:''},
  {id:'rice',name:'Jasmine rice',supplierId:'supplier',price:500,category:'General',description:'',stockCountGroup:'cool-room'}
 ]};await fs.writeFile(path.join(dir,'catalogue.json'),JSON.stringify(original));
 let server,url,admin,staff;
 async function start(){server=createServer(dir);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;admin=await login(url);staff=await login(url,'staff','test-password-for-staff');}
 async function request(route,method='GET',body,headers=admin){return fetch(url+route,{method,headers:{...headers,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});}
 try{
  await start();let catalogue=await(await request('/api/catalogue')).json();
  assert.deepEqual(catalogue.products.map(product=>product.stockCountGroup),['cool-room','freezer','packaging','chemical','cool-room']);
  const stored=JSON.parse(await fs.readFile(path.join(dir,'catalogue.json'),'utf8'));
  assert.deepEqual(stored.products.map(({stockCountGroup,...product})=>product),original.products.map(({stockCountGroup,...product})=>product));assert.deepEqual(stored.suppliers,original.suppliers);
  assert.equal((await request('/stock-count-groups.js')).status,200);
  const record=await(await request('/api/stock-counts','POST',{countDate:'2026-10-11',items:[{id:'fresh',quantity:0},{id:'frozen',quantity:1.25}]},staff)).json();
  assert.equal(record.items.find(item=>item.id==='fresh').stockCountGroup,'cool-room');assert.equal(record.items.find(item=>item.id==='frozen').stockCountGroup,'freezer');
  assert.equal(record.items.find(item=>item.id==='fresh').supplier,'Mixed supplier');
  const body={name:'Changed fresh chicken',supplierId:'supplier',price:1,stockCountGroup:'dry'};
  assert.equal((await request('/api/products/fresh','PUT',body,staff)).status,403);
  for(const value of ['fridge','',null,{},['dry']])assert.equal((await request('/api/products/fresh','PUT',{...body,stockCountGroup:value})).status,400);
  let response=await request('/api/products/fresh','PUT',body);assert.equal(response.status,200);assert.equal((await response.json()).stockCountGroup,'dry');
  response=await request('/api/products/fresh','PUT',{name:'Frozen chicken renamed',supplierId:'supplier',price:1});assert.equal(response.status,200);assert.equal((await response.json()).stockCountGroup,'dry');
  response=await request('/api/products','POST',{name:'Frozen squid',supplierId:'supplier',price:2});assert.equal(response.status,201);const added=await response.json();assert.equal(added.stockCountGroup,'freezer');
  response=await request('/api/products','POST',{name:'Lettuce',supplierId:'supplier',price:2,stockCountGroup:'dry'});assert.equal(response.status,201);assert.equal((await response.json()).stockCountGroup,'dry');
  await new Promise(resolve=>server.close(resolve));await start();catalogue=await(await request('/api/catalogue')).json();assert.equal(catalogue.products.find(product=>product.id==='fresh').stockCountGroup,'dry');assert.equal(catalogue.products.find(product=>product.id==='rice').stockCountGroup,'cool-room');
  const history=await(await request('/api/stock-counts/'+record.id,'GET',undefined,staff)).json();assert.equal(history.items.find(item=>item.id==='fresh').stockCountGroup,'cool-room');assert.equal(history.items.find(item=>item.id==='fresh').name,'Chicken (15kg box)');assert.equal(history.items.find(item=>item.id==='frozen').quantity,1.25);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
