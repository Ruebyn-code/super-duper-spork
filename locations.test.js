const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('./server'),{saveAdmin,saveUser}=require('./auth'),sales=require('./sales'),par=require('./par-levels'),{shift}=require('./stock-usage');
async function fixture({beforeStart,fetchImpl}={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ordering-locations-'));await saveAdmin(dir,'admin','test-admin-password');for(const user of ['first','second','third'])await saveUser(dir,user,'test-'+user+'-password');
 const original=JSON.parse(await fs.readFile(path.join(dir,'accounts.json'),'utf8'));if(beforeStart)await beforeStart(dir,original);let server,url;
 async function start(){server=createServer(dir,{fetchImpl});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;}
 await start();
 async function login(username){const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-'+username+'-password'})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],session=await(await fetch(url+'/api/session',{headers:{Cookie:cookie}})).json();return {session,headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':session.csrf}};}
 async function request(actor,route,method='GET',body,extra={}){const response=await fetch(url+route,{method,headers:{...actor?.headers,...extra},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 async function assign(admin,username,locationId){const account=(await request(admin,'/api/accounts')).data.find(account=>account.username===username);return request(admin,'/api/accounts/'+account.id,'PUT',{username,role:account.role,password:'',locationId});}
 return {dir,original,login,request,assign,restart:async()=>{await new Promise(resolve=>server.close(resolve));await start();},close:async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}};
}
test('existing account locations preserve roles, sender secrets and legacy history without moving it with users',async()=>{
 const week=sales.currentWeek(),countId=crypto.randomUUID(),orderId=crypto.randomUUID();
 const app=await fixture({beforeStart:async(dir,accounts)=>{
  const account=accounts.find(account=>account.username==='first');await fs.mkdir(path.join(dir,'account-email'));await fs.writeFile(path.join(dir,'account-email',account.id+'.json'),JSON.stringify({ORDER_FROM_EMAIL:'old@example.com',RESEND_API_KEY:'legacy-test-key',DELIVERY_EMAIL_ENABLED:'true'}));
  await fs.mkdir(path.join(dir,'sales',account.id),{recursive:true});for(let index=1;index<=4;index++)await fs.writeFile(path.join(dir,'sales',account.id,shift(week,-7*index)+'.json'),JSON.stringify({accountId:account.id,weekStart:shift(week,-7*index),days:Array(7).fill(100000),revision:3,updatedAt:new Date().toISOString()}));
  await fs.mkdir(path.join(dir,'stock-counts'));await fs.writeFile(path.join(dir,'stock-counts',countId+'.json'),JSON.stringify({id:countId,accountId:account.id,counterName:'first',countDate:week,createdAt:new Date().toISOString(),items:[{id:'paper',quantity:2}],location:'Kitchen'}));
  await fs.writeFile(path.join(dir,orderId+'.json'),JSON.stringify({id:orderId,requestOwnerId:account.id,status:'requested',createdAt:new Date().toISOString(),items:[{id:'paper',quantity:1}],total:650}));
 }});
 try{const admin=await app.login('admin'),first=await app.login('first'),second=await app.login('second');let locations=(await app.request(admin,'/api/locations')).data;
  assert.equal(locations.length,4);for(const original of app.original){const account=(await app.request(admin,'/api/accounts')).data.find(account=>account.id===original.id);assert.equal(account.role,original.role);assert.equal(account.locationId,original.id);}
  const originalLocation=first.session.locationId;const email=await app.request(admin,'/api/locations/'+originalLocation+'/email');assert.equal(email.data.values.ORDER_FROM_EMAIL,'old@example.com');assert.equal(email.data.secrets.RESEND_API_KEY,true);assert.ok(!JSON.stringify(email).includes('legacy-test-key'));
  assert.equal((await app.request(first,'/api/sales')).data.projection.budgetCents,196000);assert.equal((await app.request(first,'/api/stock-counts')).data.length,1);
  assert.equal((await app.assign(admin,'second',originalLocation)).status,200);assert.equal((await app.request(second,'/api/catalogue')).status,401);const teammate=await app.login('second');assert.equal((await app.request(teammate,'/api/stock-counts/'+countId)).status,200);
  const newLocation=(await app.request(admin,'/api/locations','POST',{name:'New store'})).data;assert.equal((await app.assign(admin,'first',newLocation.id)).status,200);const moved=await app.login('first');
  assert.equal((await app.request(moved,'/api/sales')).data.projection.projectedSalesCents,null);assert.equal((await app.request(moved,'/api/stock-counts/'+countId)).status,404);
  const kept=(await app.request(teammate,'/api/sales')).data;assert.equal(kept.projection.projectedSalesCents,700000);assert.equal(kept.projection.spentCents,650);
  const correction=await app.request(teammate,'/api/sales','PUT',{weekStart:shift(week,-7),days:Array(7).fill(200000),revision:3});assert.equal(correction.status,200);assert.equal(correction.data.locationId,originalLocation);assert.equal(correction.data.accountId,teammate.session.id);
  const legacy=JSON.parse(await fs.readFile(path.join(app.dir,'sales',first.session.id,shift(week,-7)+'.json'),'utf8'));assert.equal(legacy.revision,3);assert.equal(legacy.days[0],100000);
  await app.request(admin,'/api/locations/'+originalLocation,'PUT',{name:'Renamed store'});await app.request(admin,'/api/locations/'+originalLocation+'/email','PUT',{ORDER_FROM_EMAIL:'new@example.com',DELIVERY_EMAIL_ENABLED:true});await app.restart();const after=await app.login('second'),newAdmin=await app.login('admin');assert.equal(after.session.locationName,'Renamed store');assert.equal((await app.request(after,'/api/sales')).data.projection.projectedSalesCents,875000);assert.equal((await app.request(newAdmin,'/api/locations/'+originalLocation+'/email')).data.values.ORDER_FROM_EMAIL,'new@example.com');
 }finally{await app.close();}
});
test('users at one location share counts, weekly usage, sales and committed budget while other locations stay separate',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),shop=(await app.request(admin,'/api/locations','POST',{name:'Shop'})).data,other=(await app.request(admin,'/api/locations','POST',{name:'Warehouse'})).data;
 for(const name of ['first','second'])assert.equal((await app.assign(admin,name,shop.id)).status,200);await app.assign(admin,'third',other.id);const first=await app.login('first'),second=await app.login('second'),third=await app.login('third');assert.equal(first.session.role,'user');assert.equal(second.session.role,'user');assert.equal(first.session.dataScope,second.session.dataScope);
 const salesWeek=sales.currentWeek();for(let index=1;index<=4;index++)assert.equal((await app.request(index%2?first:second,'/api/sales','PUT',{weekStart:shift(salesWeek,-7*index),days:Array(7).fill(100000),revision:0})).status,200);
 assert.equal((await app.request(second,'/api/sales')).data.projection.budgetCents,196000);assert.equal((await app.request(third,'/api/sales')).data.projection.budgetCents,null);
 const usageWeek=par.windowFor().currentWeekStart;let latest;
 for(let index=4;index>=0;index--){const response=await app.request(index%2?first:second,'/api/stock-counts','POST',{countDate:shift(usageWeek,-7*index),locationId:other.id,items:[{id:'paper',quantity:20}]});assert.equal(response.status,201);latest=response.data;assert.equal(latest.locationId,shop.id);}
 for(let index=1;index<=4;index++){const response=await app.request(index%2?first:second,'/api/orders','POST',{items:[{id:'paper',quantity:7}]});const order=response.data;order.createdAt=shift(usageWeek,-7*index)+'T00:00:00Z';await fs.writeFile(path.join(app.dir,order.id+'.json'),JSON.stringify(order));}
 const catalogue=(await app.request(second,'/api/catalogue')).data;assert.equal(catalogue.products.find(product=>product.id==='paper').par.level,7);assert.equal(catalogue.products.find(product=>product.id==='paper').ordering.stockCount,20);assert.equal(catalogue.parWindow.scope,'location');assert.equal((await app.request(first,'/api/stock-counts')).data.length,5);assert.equal((await app.request(third,'/api/stock-counts/'+latest.id)).status,404);assert.equal((await app.request(third,'/api/catalogue')).data.products.find(product=>product.id==='paper').ordering.stockCount,null);
 await app.request(first,'/api/orders','POST',{items:[{id:'paper',quantity:2}]});await app.request(second,'/api/orders','POST',{items:[{id:'paper',quantity:3}]});const budget=(await app.request(first,'/api/sales')).data.projection;assert.equal(budget.spentCents,3250);assert.equal(budget.remainingCents,192750);assert.equal((await app.request(third,'/api/sales')).data.projection.spentCents,0);
 const sharedWeek={weekStart:salesWeek,days:Array(7).fill(500),revision:0},replies=await Promise.all([app.request(first,'/api/sales','PUT',sharedWeek),app.request(second,'/api/sales','PUT',{...sharedWeek,days:Array(7).fill(700)})]);assert.deepEqual(replies.map(reply=>reply.status).sort(),[200,409]);
 }finally{await app.close();}
});
test('location sender settings are admin-only and every member uses that location when an order is sent',async()=>{
 const calls=[],app=await fixture({fetchImpl:async(url,options)=>{calls.push({url,...options});return {ok:true};}});try{const admin=await app.login('admin'),shop=(await app.request(admin,'/api/locations','POST',{name:'Shop'})).data,warehouse=(await app.request(admin,'/api/locations','POST',{name:'Warehouse'})).data;
 for(const name of ['first','second'])await app.assign(admin,name,shop.id);await app.assign(admin,'third',warehouse.id);const first=await app.login('first'),second=await app.login('second'),third=await app.login('third');
 for(const [location,email] of [[shop,'shop@example.com'],[warehouse,'warehouse@example.com']]){const response=await app.request(admin,'/api/locations/'+location.id+'/email','PUT',{ORDER_FROM_EMAIL:email,RESEND_API_KEY:'test-key-'+location.id,DELIVERY_EMAIL_ENABLED:true});assert.equal(response.status,200);assert.ok(!JSON.stringify(response.data).includes('test-key'));}
 for(const actor of [first,second,third]){assert.equal((await app.request(actor,'/api/locations')).status,403);assert.equal((await app.request(actor,'/api/locations/'+shop.id+'/email')).status,403);assert.equal((await app.request(actor,'/api/locations/'+shop.id+'/email','PUT',{ORDER_FROM_EMAIL:'bad@example.com',DELIVERY_EMAIL_ENABLED:true})).status,403);}
 assert.equal((await app.request(admin,'/api/locations/'+shop.id+'/email','PUT',{DELIVERY_EMAIL_ENABLED:true},{'X-CSRF-Token':''})).status,403);
 await app.request(admin,'/api/suppliers/office','PUT',{delivery:{method:'email',contact:'supplier@example.com'}});
 const body={requestId:crypto.randomUUID(),locationId:warehouse.id,locationName:'Spoofed name',items:[{id:'paper',quantity:2}]};const firstOrder=await app.request(first,'/api/orders','POST',body);assert.equal(firstOrder.status,201);assert.equal(firstOrder.data.locationId,shop.id);assert.equal(firstOrder.data.locationName,'Shop');assert.equal(firstOrder.data.delivery[0].status,'submitted');
 assert.equal((await app.request(first,'/api/orders','POST',body)).status,200);assert.equal(calls.length,1);assert.equal((await app.request(second,'/api/orders','POST',body)).status,409);
 await app.request(second,'/api/orders','POST',{items:[{id:'paper',quantity:1}]});await app.request(third,'/api/orders','POST',{items:[{id:'paper',quantity:1}]});assert.deepEqual(calls.map(call=>JSON.parse(call.body).from),['shop@example.com','shop@example.com','warehouse@example.com']);assert.match(JSON.parse(calls[0].body).text,/Location: Shop/);assert.ok(!JSON.parse(calls[0].body).text.includes('Spoofed'));assert.equal(calls[0].headers.Authorization,calls[1].headers.Authorization);assert.notEqual(calls[0].headers.Authorization,calls[2].headers.Authorization);
 await app.assign(admin,'first',warehouse.id);const moved=await app.login('first');assert.equal((await app.request(moved,'/api/orders','POST',body)).status,409);assert.equal(calls.length,3);
 // Older account-addressed settings routes resolve to the assigned location rather than individual senders.
 assert.equal((await app.request(admin,'/api/accounts/'+second.session.id+'/email')).data.values.ORDER_FROM_EMAIL,'shop@example.com');
 }finally{await app.close();}
});
test('location assignments and archives validate safely and preserve last-admin protection',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),first=await app.login('first');const created=await app.request(admin,'/api/locations','POST',{name:'New store'});assert.equal(created.status,201);const store=created.data;
 for(const name of ['', ' '.repeat(5),'x'.repeat(101)])assert.equal((await app.request(admin,'/api/locations','POST',{name})).status,400);assert.equal((await app.request(admin,'/api/locations','POST',{name:'new STORE'})).status,400);assert.equal((await app.request(first,'/api/locations','POST',{name:'Not allowed'})).status,403);
 assert.equal((await app.request(admin,'/api/locations/'+store.id,'PUT',{name:'Archived store',archived:true})).status,200);assert.equal((await app.assign(admin,'first',store.id)).status,400);assert.equal((await app.request(admin,'/api/locations/'+store.id,'PUT',{name:'Restored store',archived:false})).status,200);assert.equal((await app.assign(admin,'first',store.id)).status,200);assert.equal((await app.request(first,'/api/session')).data.csrf,undefined);assert.equal((await app.request(admin,'/api/locations/'+store.id,'PUT',{name:'Busy',archived:true})).status,400);
 const member=await app.login('first');assert.equal(member.session.role,'user');assert.equal(member.session.locationId,store.id);assert.equal((await app.assign(admin,'first','../../outside')).status,404);
 assert.equal((await app.request(admin,'/api/accounts/'+admin.session.id,'PUT',{username:'admin',role:'user',locationId:store.id})).status,400);
 const empty=(await app.request(admin,'/api/locations','POST',{name:'Race test'})).data;
 const replies=await Promise.all([app.assign(admin,'second',empty.id),app.request(admin,'/api/locations/'+empty.id,'PUT',{name:empty.name,archived:true})]);assert.ok(replies.some(reply=>reply.status===400));const accounts=(await app.request(admin,'/api/accounts')).data,location=(await app.request(admin,'/api/locations')).data.find(location=>location.id===empty.id);assert.ok(!location.archived||!accounts.some(account=>account.locationId===location.id));
 }finally{await app.close();}
});
test('multi-location users switch securely and retain separate data and location email senders',async()=>{
 const calls=[],app=await fixture({fetchImpl:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true};}});
 try{
  const admin=await app.login('admin'),north=(await app.request(admin,'/api/locations','POST',{name:'North'})).data,south=(await app.request(admin,'/api/locations','POST',{name:'South'})).data;
  const account=(await app.request(admin,'/api/accounts')).data.find(account=>account.username==='first');
  const assigned=await app.request(admin,'/api/accounts/'+account.id,'PUT',{username:'first',role:'user',locationId:north.id,locationIds:[north.id,south.id]});assert.equal(assigned.status,200);assert.deepEqual(assigned.data.locationIds,[north.id,south.id]);
  const user=await app.login('first'),anotherSession=await app.login('first'),outsider=await app.login('third');assert.equal(user.session.locationId,north.id);assert.deepEqual(user.session.locations,[{id:north.id,name:'North'},{id:south.id,name:'South'}]);assert.equal(user.session.role,'user');assert.ok(user.session.locations.every(location=>Object.keys(location).length===2));
  assert.equal((await app.request(null,'/api/session/location','PUT',{locationId:south.id})).status,401);
  assert.equal((await app.request(user,'/api/session/location','PUT',{locationId:south.id},{'X-CSRF-Token':''})).status,403);
  assert.equal((await app.request(user,'/api/session/location','PUT',{locationId:outsider.session.locationId})).status,403);
  assert.equal((await app.request(user,'/api/catalogue','GET',undefined,{'X-Location-Id':outsider.session.locationId})).status,403);
  assert.equal((await app.request(user,'/api/accounts/'+account.id,'PUT',{username:'first',role:'admin',locationIds:[north.id,south.id]})).status,403);
  for(const shop of [north,south]){assert.equal((await app.request(admin,'/api/locations/'+shop.id+'/email','PUT',{ORDER_FROM_EMAIL:shop.name.toLowerCase()+'@example.com',RESEND_API_KEY:'test-key',DELIVERY_EMAIL_ENABLED:true})).status,200);assert.equal((await app.request(user,'/api/locations/'+shop.id+'/email')).status,403);}
  await app.request(admin,'/api/suppliers/office','PUT',{delivery:{method:'email',contact:'supplier@example.com'}});
  const week=sales.currentWeek();await app.request(user,'/api/sales','PUT',{weekStart:week,days:Array(7).fill(100),revision:0});const northCount=await app.request(user,'/api/stock-counts','POST',{countDate:week,items:[{id:'paper',quantity:11}]});
  assert.equal((await app.request(user,'/api/orders','POST',{items:[{id:'paper',quantity:1}]})).data.locationId,north.id);
  assert.equal((await app.request(user,'/api/session/location','PUT',{locationId:south.id})).status,200);
  assert.equal((await app.request(user,'/api/session')).data.locationId,south.id);assert.equal((await app.request(anotherSession,'/api/session')).data.locationId,north.id);
  assert.equal((await app.request(user,'/api/sales')).data.record.days[0],null);assert.equal((await app.request(user,'/api/stock-counts')).data.length,0);assert.equal((await app.request(user,'/api/stock-counts/'+northCount.data.id)).status,404);assert.equal((await app.request(user,'/api/catalogue')).data.products.find(product=>product.id==='paper').ordering.stockCount,null);
  await app.request(user,'/api/sales','PUT',{weekStart:week,days:Array(7).fill(900),revision:0});assert.equal((await app.request(user,'/api/orders','POST',{items:[{id:'paper',quantity:1}]})).data.locationId,south.id);
  // An already-open tab carries its displayed location, even after another tab switches.
  const oldTab={'X-Location-Id':north.id};assert.equal((await app.request(user,'/api/session','GET',undefined,oldTab)).data.locationId,north.id);assert.equal((await app.request(user,'/api/sales','GET',undefined,oldTab)).data.record.days[0],100);assert.equal((await app.request(user,'/api/sales','PUT',{weekStart:week,days:Array(7).fill(200),revision:1},oldTab)).data.locationId,north.id);
  assert.equal((await app.request(user,'/api/orders','POST',{items:[{id:'paper',quantity:2}]},oldTab)).data.locationId,north.id);assert.equal((await app.request(user,'/api/sales')).data.record.days[0],900);
  assert.deepEqual(calls.map(call=>call.from),['north@example.com','south@example.com','north@example.com']);assert.deepEqual(calls.map(call=>call.subject),['Stock order for North','Stock order for South','Stock order for North']);
  assert.equal((await app.request(user,'/api/session/location','PUT',{locationId:north.id})).status,200);assert.equal((await app.request(user,'/api/catalogue')).data.products.find(product=>product.id==='paper').ordering.stockCount,11);
 }finally{await app.close();}
});
test('all memberships count toward archive protection, validate on edits and revoke removed access',async()=>{
 const app=await fixture();try{
  const admin=await app.login('admin'),user=await app.login('first'),a=user.session.locationId,b=(await app.request(admin,'/api/locations','POST',{name:'Additional'})).data.id;
  const route='/api/accounts/'+user.session.id,input={username:'first',role:'user',locationId:a,locationIds:[a,b]};
  for(const locationIds of [[],[a,a],[a,'missing'],null,'bad',[a,23]])assert.ok([400,404].includes((await app.request(admin,route,'PUT',{...input,locationIds})).status));
  assert.equal((await app.request(admin,route,'PUT',{...input,locationId:b,locationIds:[a]})).status,400);
  assert.equal((await app.request(admin,route,'PUT',input)).status,200);assert.equal((await app.request(user,'/api/catalogue')).status,401);const member=await app.login('first');
  assert.equal((await app.request(admin,'/api/locations')).data.find(record=>record.id===b).memberCount,1);
  assert.equal((await app.request(admin,'/api/locations/'+b,'PUT',{name:'Additional',archived:true})).status,400);
  // Membership order alone does not sign users out.
  assert.equal((await app.request(admin,route,'PUT',{...input,locationIds:[b,a]})).status,200);assert.equal((await app.request(member,'/api/catalogue')).status,200);
  const created=await app.request(admin,'/api/accounts','POST',{username:'multi',password:'test-multi-password',role:'user',locationIds:[a,b]});assert.equal(created.status,201);assert.equal(created.data.locationId,a);assert.deepEqual(created.data.locationIds,[a,b]);
  assert.equal((await app.request(member,'/api/session/location','PUT',{locationId:b})).status,200);
  assert.equal((await app.request(admin,route,'PUT',{...input,locationIds:[a]})).status,200);assert.equal((await app.request(member,'/api/sales','GET',undefined,{'X-Location-Id':b})).status,401);const restricted=await app.login('first');assert.equal((await app.request(restricted,'/api/session/location','PUT',{locationId:b})).status,403);assert.deepEqual(restricted.session.locations.map(record=>record.id),[a]);
  await app.request(admin,'/api/accounts/'+created.data.id,'DELETE');assert.equal((await app.request(admin,'/api/locations/'+b,'PUT',{name:'Additional',archived:true})).status,200);assert.equal((await app.request(admin,route,'PUT',input)).status,400);
  await app.restart();const after=await app.login('first');assert.equal(after.session.locationId,a);assert.deepEqual(after.session.locations.map(record=>record.id),[a]);
 }finally{await app.close();}
});
test('single-location account upgrade preserves credentials and CLI password recovery preserves multiple memberships',async()=>{
 const app=await fixture();try{
  const admin=await app.login('admin'),first=await app.login('first');const before=JSON.parse(await fs.readFile(path.join(app.dir,'accounts.json'),'utf8'));const original=before.find(account=>account.id===first.session.id);for(const account of before)delete account.locationIds;await fs.writeFile(path.join(app.dir,'accounts.json'),JSON.stringify(before));await app.restart();
  const migrated=await app.login('first'),nextAdmin=await app.login('admin');assert.deepEqual(migrated.session.locations.map(location=>location.id),[first.session.locationId]);const saved=JSON.parse(await fs.readFile(path.join(app.dir,'accounts.json'),'utf8')).find(account=>account.id===original.id);for(const key of ['salt','hash','version','locationId'])assert.equal(saved[key],original[key]);assert.deepEqual(saved.locationIds,[original.locationId]);
  await app.request(nextAdmin,'/api/accounts/'+original.id,'PUT',{username:'first',role:'user',locationId:original.locationId,locationIds:[original.locationId,admin.session.locationId]});await saveUser(app.dir,'first','test-first-password');const recovered=await app.login('first');assert.deepEqual(recovered.session.locations.map(location=>location.id).sort(),[original.locationId,admin.session.locationId].sort());
 }finally{await app.close();}
});
test('location directory exposes only sender summaries and account-addressed email writes cannot change a store',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),user=await app.login('first'),id=user.session.locationId;const values={ORDER_FROM_EMAIL:'store@example.com',RESEND_API_KEY:'private-location-secret',DELIVERY_EMAIL_ENABLED:true};
 assert.equal((await app.request(admin,'/api/locations/'+id+'/email','PUT',values)).status,200);const before=await fs.readFile(path.join(app.dir,'location-email',id+'.json'),'utf8');
 const listing=await app.request(admin,'/api/locations');assert.equal(listing.status,200);const record=listing.data.find(record=>record.id===id);assert.equal(record.senderEmail,'store@example.com');assert.equal(record.orderEmailEnabled,true);assert.ok(!JSON.stringify(listing).includes('private-location-secret'));assert.ok(!Object.hasOwn(record,'RESEND_API_KEY'));
 for(const route of ['/api/accounts/'+user.session.id+'/email','/api/my-email-settings']){assert.equal((await app.request(admin,route,'PUT',{...values,ORDER_FROM_EMAIL:'wrong@example.com'})).status,405);assert.equal((await app.request(user,route,'PUT',values)).status,403);}
 assert.equal(await fs.readFile(path.join(app.dir,'location-email',id+'.json'),'utf8'),before);assert.equal((await app.request(user,'/api/locations')).status,403);assert.ok(!JSON.stringify(user.session.locations).includes('store@example.com'));
 }finally{await app.close();}
});
