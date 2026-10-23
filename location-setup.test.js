const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),crypto=require('node:crypto');
const {createServer}=require('./server'),{saveAdmin}=require('./auth');
async function fixture(){
 const dir=await fs.mkdtemp('/tmp/opstack-location-setup-test-');await saveAdmin(dir,'Office','setup-test-password');let time=Date.parse('2026-10-22T22:00:00Z'),server,base;
 async function start(){server=createServer(dir,{locationNow:()=>time,fetchImpl:()=>{throw Error('No external calls during location setup tests.');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 await start();
 async function request(actor,url,method='GET',body,extra={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...actor?.headers,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});return{status:r.status,data:await r.json()};}
 async function api(...args){const r=await request(...args);assert(r.status>=200&&r.status<300,JSON.stringify(r));return r.data;}
 async function login(username){const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'setup-test-password'})});assert.equal(r.status,200);const actor={headers:{Cookie:r.headers.get('set-cookie').split(';')[0]}};actor.session=await api(actor,'/api/session');actor.headers['X-CSRF-Token']=actor.session.csrf;return actor;}
 const office=await login('Office');await api(office,'/api/accounts','POST',{username:'Other manager',password:'setup-test-password',role:'admin',locationId:office.session.locationId});await api(office,'/api/accounts','POST',{username:'Staff',password:'setup-test-password',role:'user',locationId:office.session.locationId});
 return{dir,page:async(actor,url)=>{const r=await fetch(base+url,{headers:actor.headers});return{status:r.status,text:await r.text()};},request,api,login,office,other:await login('Other manager'),staff:await login('Staff'),advance:ms=>time+=ms,restart:async()=>{await new Promise(r=>server.close(r));await start();},close:async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}};
}
test('unfinished setup preserves platform access for everyone, identifies pending locations and cannot be falsely completed',async()=>{
 const app=await fixture();try{
  assert.equal((await app.api(app.office,'/api/location-setup')).pendingCount,0);
  const store=await app.api(app.office,'/api/locations','POST',{name:'New shop',setupRequired:false,setupCreatorId:app.staff.session.id});
  const state=await app.api(app.office,'/api/location-setup');assert.equal(state.blocked,false);assert.equal(state.reminderDue,true);assert.equal(state.locations[0].steps.length,8);assert(state.pendingLocationIds.includes(store.id));
  for(const route of ['/api/sales','/api/home-totals','/api/search?q=home','/api/reporting','/api/invoices']){const r=await app.request(app.office,route);assert.equal(r.status,200,route);assert.notEqual(r.data.code,'LOCATION_SETUP');}
  assert.equal((await app.request(app.office,'/api/orders','POST',{items:[{id:'paper',quantity:1}]})).status,201);
  for(const actor of [app.other,app.staff]){assert.equal((await app.api(actor,'/api/location-setup')).blocked,false);assert.equal((await app.request(actor,'/api/sales')).status,200);}
  assert.equal((await app.request(app.office,'/api/sales','GET',undefined,{'X-Location-Id':store.id})).status,200,'unfinished setup does not restrict other locations');
  assert.equal((await app.request(app.office,'/api/locations')).status,200,'setup settings remain available');
  const attempted=await app.request(app.office,'/api/location-setup/complete','POST',{locationId:store.id,revision:state.locations[0].revision,steps:state.locations[0].steps.map(s=>({...s,done:true}))});assert.equal(attempted.status,409);
  assert.equal((await app.request(app.staff,'/api/location-setup/complete','POST',{locationId:store.id,revision:state.locations[0].revision})).status,404);
  assert.equal((await app.request(app.office,'/api/location-setup/snooze','POST',{}, {'X-CSRF-Token':''})).status,403);
  assert.equal((await app.request(null,'/api/location-setup')).status,401);
  assert.equal((await app.request(app.office,'/api/location-setup','PUT',{})).status,405);
 }finally{await app.close();}
});
test('five-minute reminders persist without restricting access before or after expiry',async()=>{
 const app=await fixture();try{
  const initial=await app.api(app.office,'/api/locations','POST',{name:'Snooze shop'});const first=await app.api(app.office,'/api/location-setup/snooze','POST',{});assert.equal(Date.parse(first.snoozedUntil)-Date.parse(first.serverTime),300000);
  app.advance(120000);assert.equal((await app.api(app.office,'/api/location-setup/snooze','POST',{})).snoozedUntil,first.snoozedUntil);
  await app.restart();const again=await app.login('Office');assert.equal((await app.api(again,'/api/location-setup')).snoozedUntil,first.snoozedUntil);assert.equal((await app.request(again,'/api/sales')).status,200);
  app.advance(180000);assert.equal((await app.request(again,'/api/sales')).status,200);assert.equal((await app.api(again,'/api/location-setup')).reminderDue,true);
  await app.api(again,'/api/location-setup/snooze','POST',{});await app.api(again,'/api/locations','POST',{name:'Another shop'});assert.equal((await app.request(again,'/api/sales')).status,200);
  const renewed=await app.api(again,'/api/location-setup/snooze','POST',{});await app.api(again,'/api/locations/'+initial.id,'PUT',{name:initial.name,archived:true});assert.equal((await app.api(again,'/api/location-setup')).snoozedUntil,renewed.snoozedUntil,'finishing or removing one pending location cannot shorten the snooze');
  assert.equal((await app.api(await app.login('Other manager'),'/api/location-setup')).pendingCount,0);
 }finally{await app.close();}
});
test('all eight saved setup tasks are required, stale settings are rechecked, and completion survives restart',async()=>{
 const app=await fixture();try{
  const store=await app.api(app.office,'/api/locations','POST',{name:'Ready shop',publicHolidayState:'VIC',tradingHours:Array.from({length:7},()=>({open:'09:00',close:'22:00'}))}),headers={'X-Location-Id':store.id};
  const person=await app.api(app.office,'/api/accounts','POST',{username:'Store manager',password:'setup-test-password',role:'user',locationId:store.id});
  const managers=await app.api(app.office,'/api/locations/'+store.id+'/managers');await app.api(app.office,'/api/locations/'+store.id+'/managers','PUT',{revision:managers.revision,userIds:[person.id],roleId:'franchisee'});
  await app.api(app.office,'/api/locations/'+store.id+'/email','PUT',{ORDER_FROM_EMAIL:'setup@example.test',RESEND_API_KEY:'fake-setup-test-provider-key',DELIVERY_EMAIL_ENABLED:true});
  const steps='/api/location-setup/steps/'+store.id;await app.api(app.office,steps+'/team','POST',{mode:'existing',userId:person.id},headers);
  let state=await app.api(app.office,'/api/location-setup'),item=state.locations[0];assert.deepEqual(item.steps.map(s=>s.title),['Location name','Location state','Trading hours','Location manager','First user','Ordering sending email','Manual par level entry','Kiosk device']);assert.equal(item.steps.filter(s=>s.done).length,6);
  assert.equal((await app.request(app.office,'/api/location-setup/complete','POST',{locationId:store.id,revision:item.revision})).status,409);
  const pars=await app.api(app.office,steps+'/par','GET',undefined,headers);for(const p of pars.products)if(!p.automatic)await app.api(app.office,'/api/products/'+p.id+'/par','PUT',{level:10},headers);
  await app.api(app.office,steps+'/devices','POST',{name:'Ready shop counter',requestId:crypto.randomUUID()},headers);
  state=await app.api(app.office,'/api/location-setup');assert(state.locations[0].steps.every(s=>s.done));assert(!JSON.stringify(state).includes('fake-setup-test-provider-key'));
  await app.api(app.office,'/api/locations/'+store.id,'PUT',{name:store.name,publicHolidayState:''});assert.equal((await app.request(app.office,'/api/location-setup/complete','POST',{locationId:store.id,revision:state.locations[0].revision})).status,409);
  await app.api(app.office,'/api/locations/'+store.id,'PUT',{name:store.name,publicHolidayState:'VIC'});state=await app.api(app.office,'/api/location-setup');const result=await app.api(app.office,'/api/location-setup/complete','POST',{locationId:store.id,revision:state.locations[0].revision});assert.equal(result.pendingCount,0);assert(!result.pendingLocationIds.includes(store.id));assert.equal((await app.api(app.office,'/api/locations')).find(l=>l.id===store.id).setupPending,false);
  await app.restart();const actor=await app.login('Office');assert.equal((await app.api(actor,'/api/location-setup')).pendingCount,0);const audit=JSON.parse(await fs.readFile(app.dir+'/location-setup.json','utf8'));assert.equal(audit.locations[store.id].completedBy,actor.session.id);assert.equal(audit.locations[store.id].firstUserId,person.id);
 }finally{await app.close();}
});
test('new companies and separate creators keep setup independent; archiving an unused new location clears only its own obligation',async()=>{
 const app=await fixture();try{
  const store=await app.api(app.office,'/api/locations','POST',{name:'First pending'}),other=await app.api(app.other,'/api/locations','POST',{name:'Other creator pending'});
  const company=await app.api(app.office,'/api/companies','POST',{name:'Separate company'});
  assert.equal((await app.api(app.office,'/api/location-setup')).pendingCount,1);
  const otherContext={'X-Location-Id':company.locationId};assert.equal((await app.request(app.office,'/api/location-setup','GET',undefined,otherContext)).data.pendingCount,1);
  assert.equal((await app.request(app.other,'/api/location-setup','GET',undefined,otherContext)).data.pendingCount,0);
  await app.api(app.office,'/api/locations/'+store.id,'PUT',{name:store.name,archived:true});assert.equal((await app.api(app.office,'/api/location-setup')).pendingCount,0);assert.equal((await app.api(app.other,'/api/location-setup')).locations[0].id,other.id);
  assert.equal((await app.request(app.office,'/api/sales')).status,200);assert.equal((await app.request(app.office,'/api/sales','GET',undefined,otherContext)).status,200);
 }finally{await app.close();}
});
test('authorised colleagues can help with setup, while inaccessible settings and manual review ticks are rejected',async()=>{
 const app=await fixture();try{
  const store=await app.api(app.office,'/api/locations','POST',{name:'Shared setup'}),route='/api/location-setup?location='+store.id,state=await app.api(app.other,route);assert.equal(state.blocked,false);assert.equal(state.pendingCount,0);assert.equal(state.locations[0].id,store.id);
  const headers={'X-Location-Id':store.id};assert.equal((await app.request(app.other,'/api/location-setup/steps/'+store.id+'/devices','GET',undefined,headers)).status,200);
  assert.equal((await app.request(app.staff,route)).status,404);assert.equal((await app.request(app.staff,'/api/location-setup/steps/'+store.id+'/devices','GET',undefined,headers)).status,403);
  assert.equal((await app.request(app.office,'/api/location-setup/review','POST',{locationId:store.id,taskId:'training',revision:state.locations[0].revision})).status,400);assert.equal((await app.request(app.office,'/api/location-setup/review','POST',{locationId:store.id,taskId:'unknown',revision:state.locations[0].revision})).status,400);
 }finally{await app.close();}
});
test('required Comms reading keeps priority over setup reviews and operational actions without implicit acknowledgement',async()=>{
 const app=await fixture();try{
  const store=await app.api(app.office,'/api/locations','POST',{name:'Reading priority'}),state=await app.api(app.office,'/api/location-setup');
  await app.api(app.other,'/api/communications/posts','POST',{title:'Required opening policy',body:'Read the opening policy.',scope:'company',requireRead:true});
  const review=await app.request(app.office,'/api/location-setup/review','POST',{locationId:store.id,taskId:'training',revision:state.locations[0].revision});assert.equal(review.status,428);assert.equal(review.data.code,'REQUIRED_POSTS');
  assert.equal((await app.request(app.office,'/api/location-setup')).status,200);
  await app.api(app.office,'/api/location-setup/snooze','POST',{});assert.equal((await app.request(app.office,'/api/sales')).data.code,'REQUIRED_POSTS');
  const required=await app.api(app.office,'/api/communications/required');assert.equal(required.due.length,1);
  await app.api(app.office,'/api/communications/posts/'+required.due[0].id+'/read','POST',{revision:required.due[0].revision});assert.equal((await app.request(app.office,'/api/sales')).status,200);
  app.advance(300000);for(const [url,body]of [['/api/orders',{}],['/api/rostering/clock',{}],['/api/ops-management/runs',{}],['/api/learning-centre/assignments/'+crypto.randomUUID()+'/attempt',{}],['/api/invoices',{}],['/api/labels/batches',{}],['/api/ai/drafts',{}]])assert.notEqual((await app.request(app.office,url,'POST',body)).data.code,'LOCATION_SETUP',url);
 }finally{await app.close();}
});
test('popup editors use the requested location without switching the main session and enforce task and location access',async()=>{
 const app=await fixture();try{
  const store=await app.api(app.office,'/api/locations','POST',{name:'Popup location'}),state=await app.api(app.office,'/api/location-setup');
  for(const step of state.locations[0].steps){const u=new URL(step.url,'http://localhost');u.searchParams.set('__opstack_setup',step.id);u.searchParams.set('setupLocation',store.id);u.searchParams.set('__opstack_content','1');const page=await app.page(app.office,u.pathname+u.search+u.hash);assert.equal(page.status,200,step.id);assert(page.text.includes('/location-setup-editor.js'));assert(page.text.includes('window.appLocationId='+JSON.stringify(store.id)));}
  assert.equal((await app.api(app.office,'/api/session')).locationId,app.office.session.locationId);
  assert.equal((await app.api(app.office,'/api/session')).locations.find(l=>l.id===store.id).setupPending,true);
  const good='/admin/accounts?__opstack_content=1&__opstack_setup=hours&setupLocation='+store.id+'&location='+store.id+'&setupTab=hours';
  assert.equal((await app.page(app.staff,good)).status,403);
  assert.equal((await app.page(app.office,good.replace('__opstack_setup=hours','__opstack_setup=unknown'))).status,400);
  assert.equal((await app.page(app.office,good.replace('/admin/accounts','/home'))).status,400);
  assert.equal((await app.page(app.office,good.replace('__opstack_content=1&',''))).status,400);
 }finally{await app.close();}
});
