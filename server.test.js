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
 const menu=await (await fetch(url+'/api/menu',{headers})).json();assert.equal(menu.length,6);
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
 const admin=await login(url);const management=await fetch(url+'/admin',{headers:admin});assert.equal(management.status,200);assert.match(await management.text(),/id="stock-form"/);
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
 const all=await request('/api/accounts','GET',admin);assert.equal(all.data.length,1);assert.deepEqual(Object.keys(all.data[0]).sort(),['id','role','username']);
 }finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
test('legacy sign-in accounts are preserved when account management saves changes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'souvlaki-legacy-'));const crypto=require('node:crypto');const salt='legacy-test-salt';const hash=crypto.scryptSync('legacy-password',salt,64).toString('hex');
 await fs.writeFile(path.join(dir,'admin.json'),JSON.stringify({username:'legacy',salt,hash,version:'old'}));await fs.writeFile(path.join(dir,'users.json'),JSON.stringify([{username:'worker',salt,hash,version:'old-user'}]));
 const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{const admin=await login(url,'legacy','legacy-password');await login(url,'worker','legacy-password');const response=await fetch(url+'/api/accounts',{method:'POST',headers:admin,body:JSON.stringify({username:'new',password:'new-account-password',role:'user'})});assert.equal(response.status,201);await login(url,'legacy','legacy-password');await login(url,'worker','legacy-password');const accounts=JSON.parse(await fs.readFile(path.join(dir,'accounts.json'),'utf8'));assert.equal(accounts.length,3);}finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
});
