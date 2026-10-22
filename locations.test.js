const {fetchWithSetupSnooze:fetch}=require('./test-support/location-setup-snooze.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('./server'),{saveAdmin,saveUser}=require('./auth'),sales=require('./sales'),par=require('./par-levels'),{shift}=require('./stock-usage');
async function fixture({beforeStart,fetchImpl,locationNow}={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'ordering-locations-'));await saveAdmin(dir,'admin','test-admin-password');for(const user of ['first','second','third'])await saveUser(dir,user,'test-'+user+'-password');
 const original=JSON.parse(await fs.readFile(path.join(dir,'accounts.json'),'utf8'));if(beforeStart)await beforeStart(dir,original);let server,url;
 async function start(){server=createServer(dir,{fetchImpl,locationNow});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;}
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
  await fs.writeFile(path.join(dir,orderId+'.json'),JSON.stringify({id:orderId,requestOwnerId:account.id,status:'requested',createdAt:week+'T01:00:00Z',items:[{id:'paper',quantity:1}],total:650}));
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
 await app.request(first,'/api/orders','POST',{items:[{id:'paper',quantity:2}]});await app.request(second,'/api/orders','POST',{items:[{id:'paper',quantity:3}]});const budget=(await app.request(first,'/api/sales')).data.projection;const expectedSpend=budget.orderCostWeekStart!==budget.weekStart?4550:3250;assert.equal(budget.spentCents,expectedSpend);assert.equal(budget.remainingCents,196000-expectedSpend);assert.equal((await app.request(third,'/api/sales')).data.projection.spentCents,0);
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
test('a saved unsent Mernda order can check current sending setup without resending or rewriting history',async()=>{
 const calls=[],app=await fixture({fetchImpl:async(url,options)=>{calls.push({url,...options});return {ok:true};}});
 try{
  const admin=await app.login('admin'),mernda=(await app.request(admin,'/api/locations','POST',{name:'Mernda'})).data;
  await app.assign(admin,'first',mernda.id);const actor=await app.login('first'),other=await app.login('second'),settings='/api/locations/'+mernda.id+'/email';
  assert.equal((await app.request(admin,settings,'PUT',{ORDER_FROM_EMAIL:'mernda@example.com',RESEND_API_KEY:'private-mernda-test-key',DELIVERY_EMAIL_ENABLED:true})).status,200);
  const input={requestId:crypto.randomUUID(),items:[{id:'paper',quantity:1}]},saved=await app.request(actor,'/api/orders','POST',input);assert.equal(saved.status,201);assert.match(saved.data.delivery[0].message,/No delivery method/);assert.equal(calls.length,0);
  const file=path.join(app.dir,saved.data.id+'.json'),original=await fs.readFile(file,'utf8');assert.deepEqual((await app.request(actor,'/api/orders/'+saved.data.id)).data,saved.data);
  let current=await app.request(actor,'/api/orders/'+saved.data.id+'?deliverySetup=true');assert.match(current.data.delivery[0].configurationMessage,/No delivery method/);
  await app.request(admin,'/api/suppliers/office','PUT',{delivery:{method:'email',contact:'supplier@example.com'}});
  await app.request(admin,settings,'PUT',{DELIVERY_EMAIL_ENABLED:false});
  current=await app.request(actor,'/api/orders/'+saved.data.id+'?deliverySetup=true');assert.match(current.data.delivery[0].configurationMessage,/Mernda: automatic supplier emails are switched off/);
  await app.request(admin,settings,'PUT',{DELIVERY_EMAIL_ENABLED:true});
  current=await app.request(actor,'/api/orders/'+saved.data.id+'?deliverySetup=true');assert.equal(current.status,200);assert.equal(current.data.delivery[0].status,'not_configured');assert.match(current.data.delivery[0].configurationMessage,/settings for Mernda are complete/);assert.match(current.data.delivery[0].configurationMessage,/has not been retried/);
  assert.ok(!JSON.stringify(current.data).includes('private-mernda-test-key'));assert.equal(await fs.readFile(file,'utf8'),original);assert.equal(calls.length,0);
  assert.equal((await app.request(other,'/api/orders/'+saved.data.id+'?deliverySetup=true')).status,404);assert.equal((await app.request(actor,'/api/orders','POST',input)).status,200);assert.equal(calls.length,0);
  const sent=await app.request(actor,'/api/orders','POST',{items:[{id:'paper',quantity:1}]});assert.equal(sent.data.delivery[0].status,'submitted');assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].body).from,'mernda@example.com');
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

test('one company email template serves every location, stays isolated and respects email permissions',async()=>{
 const sent=[],app=await fixture({fetchImpl:async(url,options)=>{sent.push(JSON.parse(options.body));return {ok:true};}});
 try{
  const admin=await app.login('admin'),first=await app.login('first'),second=await app.login('second'),route='/api/order-email-template',defaults=require('./public/order-email-template').defaults;
  assert.equal((await app.request(null,route)).status,401);assert.deepEqual((await app.request(admin,route)).data,{template:defaults,revision:0});
  const template={subject:'{{location}} / {{supplier}}',body:'Hello {{supplier}},\n\n{{items}}\n\n{{notes}}\nThank you, {{requested_by}}\nReference: {{order_reference}}'};
  const saved=await app.request(admin,route,'PUT',{template,revision:0});assert.equal(saved.status,200);assert.deepEqual(saved.data.template,template);assert.equal(saved.data.revision,1);
  for(const actor of [first,second]){assert.equal((await app.request(actor,route)).status,403);assert.equal((await app.request(actor,route,'PUT',{template,revision:1})).status,403);}
  assert.equal((await app.request(admin,route,'PUT',{template,revision:1},{'X-CSRF-Token':''})).status,403);
  assert.equal((await app.request(admin,route,'PUT',{template:{subject:'Order',body:'No item list'},revision:1})).status,400);assert.deepEqual((await app.request(admin,route)).data.template,template);
  const other=await app.request(admin,'/api/companies','POST',{name:'Other company',locationName:'Other store'});assert.equal(other.status,201);const otherHeader={'X-Location-Id':other.data.locationId};
  assert.deepEqual((await app.request(admin,route,'GET',undefined,otherHeader)).data,{template:defaults,revision:0});
  const otherTemplate={subject:'Other company: {{location}}',body:'Company B\n{{items}}'};assert.equal((await app.request(admin,route,'PUT',{template:otherTemplate,revision:0},otherHeader)).status,200);assert.deepEqual((await app.request(admin,route)).data.template,template);
  assert.equal((await app.request(first,route,'GET',undefined,otherHeader)).status,403);
  for(const actor of [first,second]){
   const settings={ORDER_FROM_EMAIL:actor.session.username+'@example.com',RESEND_API_KEY:'private-'+actor.session.username+'-key',DELIVERY_EMAIL_ENABLED:true};
   assert.equal((await app.request(admin,'/api/locations/'+actor.session.locationId+'/email','PUT',settings)).status,200);
   const summary=await app.request(admin,'/api/locations/'+actor.session.locationId+'/email');assert.ok(!JSON.stringify(summary).includes(settings.RESEND_API_KEY));assert.ok(!Object.hasOwn(summary.data,'template'));
  }
  await app.request(admin,'/api/suppliers/office','PUT',{delivery:{method:'email',contact:'supplier@example.com'}});
  for(const actor of [first,second]){const order=await app.request(actor,'/api/orders','POST',{items:[{id:'paper',quantity:2}],notes:'Please deliver Monday.'});assert.equal(order.status,201);}
  assert.equal(sent.length,2);assert.deepEqual(sent.map(email=>email.from),['first@example.com','second@example.com']);assert.deepEqual(sent.map(email=>email.subject),['first / Office Supplies','second / Office Supplies']);
  for(const [index,email] of sent.entries()){assert.match(email.text,/2 × A4 copy paper/);assert.match(email.text,new RegExp('Thank you, '+['first','second'][index]));assert.doesNotMatch(email.text.replace(/^Reference:.*$/m,''),/\$(?:6\.50|13\.00)\b|\b650\b/);}
  const competing=await Promise.all([app.request(admin,route,'PUT',{template:defaults,revision:1}),app.request(admin,route,'PUT',{template:defaults,revision:1})]);assert.deepEqual(competing.map(reply=>reply.status).sort(),[200,409]);
  await app.restart();const after=await app.login('admin');const record=(await app.request(after,route)).data;assert.deepEqual(record.template,defaults);assert.equal(record.revision,2);assert.deepEqual((await app.request(after,route,'GET',undefined,otherHeader)).data.template,otherTemplate);
 }finally{await app.close();}
});

test('location SMS setup stays private, sends once and restores only the owner’s location-scoped platform handoff',async()=>{
 const calls=[],app=await fixture({fetchImpl:async(url,options)=>{calls.push({url,...options});return {ok:true};}});try{
  const admin=await app.login('admin'),first=await app.login('first'),second=await app.login('second'),id=first.session.locationId,route='/api/locations/'+id+'/email',settings={ORDER_FROM_EMAIL:'first@example.com',RESEND_API_KEY:'fake-email-secret',DELIVERY_EMAIL_ENABLED:true,DELIVERY_SMS_ENABLED:true,TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'fake-sms-private-token',ORDER_SMS_FROM:'0400 111 222'};
  const response=await app.request(admin,route,'PUT',settings);assert.equal(response.status,200);assert.equal(response.data.secrets.TWILIO_AUTH_TOKEN,true);assert.equal(response.data.values.ORDER_SMS_FROM,'+61400111222');assert.ok(!JSON.stringify(response).includes(settings.TWILIO_AUTH_TOKEN));assert.ok(!JSON.stringify(response).includes(settings.RESEND_API_KEY));
  for(const method of ['GET','PUT'])assert.equal((await app.request(first,route,method,method==='PUT'?settings:undefined)).status,403);
  const before=await fs.readFile(path.join(app.dir,'location-email',id+'.json'),'utf8');assert.equal((await app.request(admin,route,'PUT',{...settings,TWILIO_ACCOUNT_SID:'invalid'})).status,400);assert.equal(await fs.readFile(path.join(app.dir,'location-email',id+'.json'),'utf8'),before);
  assert.equal((await app.request(admin,route,'PUT',{ORDER_FROM_EMAIL:'changed@example.com',DELIVERY_EMAIL_ENABLED:true})).status,200);const kept=(await app.request(admin,route)).data;assert.equal(kept.secrets.TWILIO_AUTH_TOKEN,true);assert.equal(kept.enabled.DELIVERY_SMS_ENABLED,true);
  assert.equal((await app.request(admin,'/api/suppliers/office','PUT',{delivery:{method:'sms',contact:'0400 123 456'}})).status,200);assert.equal((await app.request(admin,'/api/suppliers/packaging','PUT',{delivery:{method:'platform',platform:'albconnect',contact:'https://albconnect.com.au/storefront/'}})).status,200);
  const body={requestId:crypto.randomUUID(),items:[{id:'paper',quantity:2},{id:'boxes',quantity:1}]},saved=await app.request(first,'/api/orders','POST',body);assert.equal(saved.status,201);assert.deepEqual(saved.data.delivery.map(delivery=>delivery.status),['submitted','action_required']);assert.equal(calls.length,1);assert.equal(new URLSearchParams(calls[0].body).get('From'),'+61400111222');assert.ok(!JSON.stringify(saved).includes(settings.TWILIO_AUTH_TOKEN));
  const handoff=saved.data.delivery[1].handoff;assert.match(handoff.text,/1 × Shipping boxes/);assert.ok(!handoff.text.includes('copy paper'));assert.ok(!handoff.text.includes('2800'));assert.equal((await app.request(first,'/api/orders','POST',body)).status,200);assert.equal(calls.length,1);
  assert.equal((await app.request(first,'/api/orders/'+saved.data.id)).status,200);assert.equal((await app.request(second,'/api/orders/'+saved.data.id)).status,404);await app.assign(admin,'second',id);const teammate=await app.login('second');assert.equal((await app.request(teammate,'/api/orders/'+saved.data.id)).status,404);
  const elsewhere=(await app.request(admin,'/api/locations','POST',{name:'Another branch'})).data;assert.equal((await app.request(admin,'/api/orders/'+saved.data.id,'GET',undefined,{'X-Location-Id':elsewhere.id})).status,404);
  await app.restart();const after=await app.login('first');const restored=(await app.request(after,'/api/orders/'+saved.data.id)).data;assert.deepEqual(restored.delivery[1].handoff,handoff);assert.equal(calls.length,1);
  const office=await app.login('admin');assert.equal((await app.request(office,route)).data.secrets.TWILIO_AUTH_TOKEN,true);assert.equal((await app.request(office,'/api/locations/'+second.session.locationId+'/email')).data.secrets.TWILIO_AUTH_TOKEN,false);
 }finally{await app.close();}
});

test('home totals share quarter sales and expense with all-time placed orders within the selected location and reject unauthorized locations',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),shop=(await app.request(admin,'/api/locations','POST',{name:'Shop'})).data,other=(await app.request(admin,'/api/locations','POST',{name:'Other'})).data;
 for(const name of ['first','second'])await app.assign(admin,name,shop.id);await app.assign(admin,'third',other.id);const first=await app.login('first'),second=await app.login('second'),third=await app.login('third');
 assert.equal((await app.request(null,'/api/home-totals')).status,401);
 await app.request(first,'/api/sales','PUT',{weekStart:'2020-01-06',days:[10000,null,null,null,null,null,null],revision:0});await app.request(second,'/api/sales','PUT',{weekStart:sales.currentWeek(),days:[30000,null,null,null,null,null,null],revision:0});
 await app.request(first,'/api/orders','POST',{items:[{id:'paper',quantity:10}]});const body={requestId:crypto.randomUUID(),items:[{id:'paper',quantity:5}]};await app.request(second,'/api/orders','POST',body);await app.request(second,'/api/orders','POST',body);
 let totals=(await app.request(first,'/api/home-totals')).data;assert.equal(totals.salesCents,30000);assert.equal(totals.placedOrdersCents,9750);assert.equal(totals.orderCount,2);assert.equal(totals.expensePercent,32.5);assert.deepEqual((await app.request(second,'/api/home-totals')).data,totals);
 assert.equal((await app.request(third,'/api/home-totals')).data.salesCents,0);assert.equal((await app.request(first,'/api/home-totals','GET',undefined,{'X-Location-Id':other.id})).status,403);assert.equal((await app.request(admin,'/api/home-totals','GET',undefined,{'X-Location-Id':shop.id})).data.placedOrdersCents,9750);
 await app.restart();const after=await app.login('first');totals=(await app.request(after,'/api/home-totals')).data;assert.equal(totals.salesCents,30000);assert.equal(totals.placedOrdersCents,9750);
 }finally{await app.close();}
});

test('manual pars are Head Office-only location fallbacks, survive restarts and yield to progressive automatic usage',async()=>{
 const app=await fixture();try{let admin=await app.login('admin');const shop=(await app.request(admin,'/api/locations','POST',{name:'Shop'})).data,other=(await app.request(admin,'/api/locations','POST',{name:'Other'})).data;await app.assign(admin,'first',shop.id);let user=await app.login('first');const pin={'X-Location-Id':shop.id};
 assert.equal((await app.request(user,'/api/products/paper/par','PUT',{level:12})).status,403);assert.equal((await app.request(admin,'/api/products/paper/par','PUT',{level:12},{...pin,'X-CSRF-Token':''})).status,403);
 for(const level of [-1,1.25,1000001,'12',{},[]])assert.equal((await app.request(admin,'/api/products/paper/par','PUT',{level},pin)).status,400);
 assert.equal((await app.request(admin,'/api/products/missing/par','PUT',{level:12},pin)).status,404);
 assert.equal((await app.request(admin,'/api/products/paper/par','PUT',{level:12},pin)).status,200);assert.equal((await app.request(admin,'/api/products/paper/par','PUT',{level:40},{'X-Location-Id':other.id})).status,200);
 const paper=async()=> (await app.request(user,'/api/catalogue')).data.products.find(product=>product.id==='paper');let item=await paper();assert.equal(item.par.level,12);assert.equal(item.par.source,'manual');assert.equal(item.par.weeksRecorded,0);
 assert.equal((await app.request(admin,'/api/catalogue','GET',undefined,{'X-Location-Id':other.id})).data.products.find(product=>product.id==='paper').par.level,40);
 await app.request(user,'/api/stock-counts','POST',{countDate:'2026-10-14',items:[{id:'paper',quantity:3}]});assert.equal((await paper()).ordering.recommended,9);
 await app.restart();admin=await app.login('admin');user=await app.login('first');assert.equal((await paper()).par.level,12);
 assert.equal((await app.request(admin,'/api/products/paper/par','PUT',{level:null},pin)).status,200);assert.equal((await paper()).par.level,null);await app.request(admin,'/api/products/paper/par','PUT',{level:12},pin);
 const sunday=par.windowFor().currentWeekStart;
 await app.request(user,'/api/stock-counts','POST',{countDate:sunday,items:[{id:'paper',quantity:4}]});
 for(let weeks=1;weeks<=4;weeks++){
  const opening=shift(sunday,-7*weeks);await app.request(user,'/api/stock-counts','POST',{countDate:opening,items:[{id:'paper',quantity:10}]});const quantity=[7,8,6,4][weeks-1],order=(await app.request(user,'/api/orders','POST',{items:[{id:'paper',quantity}]})).data;order.createdAt=opening+'T00:00:00Z';await fs.writeFile(path.join(app.dir,order.id+'.json'),JSON.stringify(order));
  item=await paper();assert.equal(item.par.weeksRecorded,weeks);assert.equal(item.par.level,[13,11,9,8][weeks-1]);assert.equal(item.par.manualLevel,12);assert.equal(item.par.source,'usage');
 }
 assert.equal((await app.request(admin,'/api/products/paper/par','PUT',{level:999},pin)).status,400);
 assert.equal((await app.request(admin,'/api/catalogue','GET',undefined,{'X-Location-Id':other.id})).data.products.find(product=>product.id==='paper').par.level,40);
 const simultaneous=await Promise.all(['pens','boxes'].map(id=>app.request(admin,'/api/products/'+id+'/par','PUT',{level:0},pin)));assert.ok(simultaneous.every(response=>response.status===200));const catalogue=(await app.request(user,'/api/catalogue')).data;for(const id of ['pens','boxes'])assert.equal(catalogue.products.find(product=>product.id===id).par.level,0);
 }finally{await app.close();}
});

test('location trading hours persist overnight schedules, preserve older edits and enforce location permissions',async()=>{
 const app=await fixture();try{
  const admin=await app.login('admin'),first=await app.login('first'),blank=Array(7).fill(null),schedule=[{open:'11am',close:'4am'},{open:'11:00',close:'16:00'},{closed:true},null,null,null,null];
  const legacy=(await app.request(admin,'/api/locations')).data.find(r=>r.id===first.session.locationId);assert.deepEqual(legacy.tradingHours,blank);
  const response=await app.request(admin,'/api/locations','POST',{name:'Night trade',tradingHours:schedule});assert.equal(response.status,201);const shop=response.data;assert.deepEqual(shop.tradingHours[0],{closed:false,open:'11:00',close:'04:00'});assert.equal(shop.tradingHours[2].closed,true);assert.equal(shop.tradingHours[3],null);
  const renamed=await app.request(admin,'/api/locations/'+shop.id,'PUT',{name:'Night trade renamed'});assert.equal(renamed.status,200);assert.deepEqual(renamed.data.tradingHours,shop.tradingHours);
  for(const tradingHours of [[],[{open:'11am',close:''},...blank.slice(1)],[{open:'24:00',close:'4am'},...blank.slice(1)]])assert.equal((await app.request(admin,'/api/locations/'+shop.id,'PUT',{name:'Rejected rename',tradingHours})).status,400);
  const unchanged=(await app.request(admin,'/api/locations')).data.find(r=>r.id===shop.id);assert.equal(unchanged.name,'Night trade renamed');assert.deepEqual(unchanged.tradingHours,shop.tradingHours);
  assert.equal((await app.request(first,'/api/locations/'+first.session.locationId,'PUT',{name:'Forbidden',tradingHours:schedule})).status,403);assert.equal((await app.request(admin,'/api/locations/'+shop.id,'PUT',{name:'No CSRF',tradingHours:schedule},{'X-CSRF-Token':''})).status,403);
  const other=(await app.request(admin,'/api/companies','POST',{name:'Separate trading company',locationName:'Other store'})).data;const otherStore=(await app.request(admin,'/api/locations?all=true')).data.find(r=>r.companyId===other.id);assert.deepEqual(otherStore.tradingHours,blank);
  await app.restart();const fresh=await app.login('admin');assert.deepEqual((await app.request(fresh,'/api/locations')).data.find(r=>r.id===shop.id).tradingHours,shop.tradingHours);
  const cleared=await app.request(fresh,'/api/locations/'+shop.id,'PUT',{name:'Night trade renamed',tradingHours:null});assert.equal(cleared.status,200);assert.deepEqual(cleared.data.tradingHours,blank);assert.deepEqual((await app.request(fresh,'/api/locations?all=true')).data.find(r=>r.id===otherStore.id).tradingHours,blank);
 }finally{await app.close();}
});

test('location manager assignments grant company permission levels atomically and restore only their automatic grants',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),first=await app.login('first'),loc=first.session.locationId,route='/api/locations/'+loc+'/managers';let config=(await app.request(admin,route)).data;assert.ok(config.canManage);assert.ok(config.candidates.some(p=>p.id===first.session.id));
 const saved=await app.request(admin,route,'PUT',{userIds:[first.session.id],roleId:'franchisee',revision:config.revision});assert.equal(saved.status,200);assert.equal(saved.data.managers[0].roleName,'Franchisee');assert.equal((await app.request(first,'/api/session')).status,200);const promoted=await app.login('first');assert.equal(promoted.session.role,'franchisee');assert.ok(promoted.session.permissions.includes('rostering.manage'));assert.equal(JSON.parse(await fs.readFile(path.join(app.dir,'accounts.json'),'utf8')).find(a=>a.id===first.session.id).role,'user');
 const all=(await app.request(admin,'/api/locations')).data;assert.equal(all.find(l=>l.id===loc).managers[0].id,first.session.id);assert.deepEqual(all.find(l=>l.id!==loc).managers,[]);
 assert.equal((await app.request(admin,route,'PUT',{userIds:[],roleId:'franchisee',revision:config.revision})).status,409);config=saved.data;
 const failed=await app.request(admin,route,'PUT',{userIds:[first.session.id,'missing'],roleId:'admin',revision:config.revision});assert.equal(failed.status,400);assert.equal((await app.request(admin,route)).data.revision,config.revision);
 const removed=await app.request(admin,route,'PUT',{userIds:[],roleId:'franchisee',revision:config.revision});assert.equal(removed.status,200);assert.equal((await app.login('first')).session.role,'user');
 config=removed.data;const again=await app.request(admin,route,'PUT',{userIds:[first.session.id],roleId:'franchisee',revision:config.revision});assert.equal(again.status,200);await app.request(admin,'/api/accounts/'+first.session.id,'PUT',{username:'first',role:'franchisee',companyId:'default',locationId:loc});config=(await app.request(admin,route)).data;assert.equal((await app.request(admin,route,'PUT',{userIds:[],roleId:'franchisee',revision:config.revision})).status,200);assert.equal((await app.login('first')).session.role,'franchisee');
 const second=await app.login('second'),secondRoute='/api/locations/'+second.session.locationId+'/managers';let secondConfig=(await app.request(admin,secondRoute)).data;assert.equal((await app.request(admin,secondRoute,'PUT',{userIds:[second.session.id],roleId:'franchisee',revision:secondConfig.revision})).status,200);assert.equal((await app.request(admin,'/api/accounts/'+second.session.id,'PUT',{username:'second',role:'franchisee',locationId:second.session.locationId})).status,200);assert.equal(JSON.parse(await fs.readFile(path.join(app.dir,'accounts.json'),'utf8')).find(a=>a.id===second.session.id).managerPermissionGrants,undefined);secondConfig=(await app.request(admin,secondRoute)).data;assert.equal((await app.request(admin,secondRoute,'PUT',{userIds:[],roleId:'franchisee',revision:secondConfig.revision})).status,200);assert.equal((await app.login('second')).session.role,'franchisee');
 await app.restart();const fresh=await app.login('admin');assert.deepEqual((await app.request(fresh,route)).data.managers,[]);
 }finally{await app.close();}
});
test('manager selection preserves scope, hierarchy, memberships, recovery accounts and CSRF',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),first=await app.login('first'),second=await app.login('second'),route='/api/locations/'+first.session.locationId+'/managers';let config=(await app.request(admin,route)).data;
 assert.equal((await app.request(first,route)).status,403);assert.equal((await app.request(first,route,'PUT',{userIds:[first.session.id],roleId:'admin',revision:config.revision})).status,403);assert.equal((await app.request(admin,route,'PUT',{userIds:[first.session.id],roleId:'franchisee',revision:config.revision},{'X-CSRF-Token':''})).status,403);
 assert.equal((await app.request(admin,route,'PUT',{userIds:[second.session.id],roleId:'franchisee',revision:config.revision})).status,400);assert.equal((await app.request(admin,route,'PUT',{userIds:[first.session.id,first.session.id],roleId:'franchisee',revision:config.revision})).status,400);
 const other=(await app.request(admin,'/api/companies','POST',{name:'Another company',locationName:'Elsewhere'})).data,shop=(await app.request(admin,'/api/locations?all=true')).data.find(l=>l.companyId===other.id);assert.equal((await app.request(first,'/api/locations/'+shop.id+'/managers')).status,403);
 assert.equal((await app.login('first')).session.role,'user');assert.equal((await app.login('admin')).session.role,'admin');assert.equal((await app.request(admin,route)).data.managers.length,0);
 }finally{await app.close();}
});
test('Home trading status is read-only, scoped and consistent with the location list at a server-controlled time',async()=>{
 const instant=Date.parse('2026-10-20T03:30:00+11:00'),app=await fixture({locationNow:()=>instant});try{const admin=await app.login('admin'),first=await app.login('first'),loc=first.session.locationId;await app.request(admin,'/api/locations/'+loc,'PUT',{name:'Night Owl',tradingHours:Array.from({length:7},()=>({open:'11am',close:'4am'}))});const before=await fs.readFile(path.join(app.dir,'locations.json'),'utf8'),home=await app.request(first,'/api/location-status');assert.equal(home.status,200);assert.equal(home.data.locationId,loc);assert.equal(home.data.tradingStatus.state,'open');assert.equal(home.data.tradingStatus.checkedAt,new Date(instant).toISOString());assert.equal((await app.request(admin,'/api/locations')).data.find(l=>l.id===loc).tradingStatus.state,'open');assert.equal((await app.request(first,'/api/location-status','GET',undefined,{'X-Location-Id':admin.session.locationId})).status,403);assert.equal(await fs.readFile(path.join(app.dir,'locations.json'),'utf8'),before);assert.equal((await app.request(null,'/api/location-status')).status,401);
 }finally{await app.close();}
});
test('manager permission grants stay in their company and remain until the last managed location is removed',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),first=await app.login('first'),store1=first.session.locationId,store2=(await app.request(admin,'/api/locations','POST',{name:'Second managed location'})).data,other=(await app.request(admin,'/api/companies','POST',{name:'Separate company',locationName:'Other location'})).data,otherStore=(await app.request(admin,'/api/locations?all=true')).data.find(l=>l.companyId===other.id);
 assert.equal((await app.request(admin,'/api/accounts/'+first.session.id,'PUT',{username:'first',role:'user',companyId:'default',locationId:store1,locationIds:[store1,store2.id,otherStore.id]})).status,200);
 async function save(id,userIds){const route='/api/locations/'+id+'/managers',config=(await app.request(admin,route)).data;const reply=await app.request(admin,route,'PUT',{revision:config.revision,userIds,roleId:'franchisee'});assert.equal(reply.status,200);return reply;}
 await save(store1,[first.session.id]);await save(store2.id,[first.session.id]);let raw=JSON.parse(await fs.readFile(path.join(app.dir,'accounts.json'),'utf8')).find(a=>a.id===first.session.id);assert.equal(raw.companyRoles.default,'franchisee');assert.equal(raw.companyRoles[other.id],undefined);await save(store1,[]);assert.equal((await app.login('first')).session.role,'franchisee');await save(store2.id,[]);assert.equal((await app.login('first')).session.role,'user');
 }finally{await app.close();}
});
test('concurrent manager saves reject stale assignments without granting extra access',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),first=await app.login('first'),route='/api/locations/'+first.session.locationId+'/managers',config=(await app.request(admin,route)).data,replies=await Promise.all(['franchisee','admin'].map(roleId=>app.request(admin,route,'PUT',{revision:config.revision,userIds:[first.session.id],roleId})));assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);const saved=replies.find(r=>r.status===200);assert.equal((await app.request(admin,route)).data.managers[0].roleName,saved.data.managers[0].roleName);
 }finally{await app.close();}
});
test('location manager assignment accepts a custom company permission level without changing network roles',async()=>{
 const app=await fixture();try{const admin=await app.login('admin'),first=await app.login('first'),catalogue=(await app.request(admin,'/api/permission-levels')).data,created=await app.request(admin,'/api/permission-levels','POST',{name:'Store leader',scope:'company',level:45,permissions:catalogue.levels.find(r=>r.id==='franchisee').permissions,revision:catalogue.revision});assert.equal(created.status,201);const role=created.data.levels.find(r=>r.name==='Store leader'),route='/api/locations/'+first.session.locationId+'/managers',config=(await app.request(admin,route)).data;assert.ok(config.levels.some(r=>r.id===role.id));const saved=await app.request(admin,route,'PUT',{userIds:[first.session.id],roleId:role.id,revision:config.revision});assert.equal(saved.status,200);assert.equal(saved.data.managers[0].roleName,'Store leader');const account=JSON.parse(await fs.readFile(path.join(app.dir,'accounts.json'),'utf8')).find(a=>a.id===first.session.id);assert.equal(account.role,'user');assert.equal(account.companyRoles.default,role.id);
 }finally{await app.close();}
});

test('location state is validated, retained by older clients and survives restarts without changing other settings',async()=>{
 const app=await fixture();try{
  let admin=await app.login('admin');const first=await app.login('first'),schedule=Array.from({length:7},()=>({open:'11am',close:'4am'})),created=await app.request(admin,'/api/locations','POST',{name:'Victorian store',publicHolidayState:'VIC',tradingHours:schedule});assert.equal(created.status,201);const shop=created.data;assert.equal(shop.publicHolidayState,'VIC');
  const renamed=await app.request(admin,'/api/locations/'+shop.id,'PUT',{name:'Renamed store'});assert.equal(renamed.status,200);assert.equal(renamed.data.publicHolidayState,'VIC');assert.deepEqual(renamed.data.tradingHours,shop.tradingHours);
  for(const publicHolidayState of ['Vic','XX',null,{},0]){assert.equal((await app.request(admin,'/api/locations/'+shop.id,'PUT',{name:'Invalid edit',publicHolidayState})).status,400);assert.equal((await app.request(admin,'/api/locations','POST',{name:'Invalid new store',publicHolidayState})).status,400);}
  assert.equal((await app.request(first,'/api/locations/'+first.session.locationId,'PUT',{name:'Forbidden',publicHolidayState:'QLD'})).status,403);
  await app.restart();admin=await app.login('admin');const restored=(await app.request(admin,'/api/locations')).data.find(l=>l.id===shop.id);assert.equal(restored.name,'Renamed store');assert.equal(restored.publicHolidayState,'VIC');assert.deepEqual(restored.tradingHours,shop.tradingHours);
  assert.equal((await app.request(admin,'/api/locations/'+shop.id,'PUT',{name:restored.name,publicHolidayState:''})).data.publicHolidayState,'');assert.deepEqual((await app.request(admin,'/api/locations')).data.find(l=>l.id===shop.id).tradingHours,shop.tradingHours);
 }finally{await app.close();}
});
