const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./server'),{saveAdmin}=require('./auth'),M=require('./public/rostering-model'),availability=require('./staff-availability'),leave=require('./leave'),permissions=require('./permissions'),levels=require('./permission-levels');
const now=()=>Date.parse('2026-10-16T13:00:00Z'),days=status=>Array.from({length:7},()=>({status})),actor={id:'member',username:'Member',role:'user',companyId:'default',locationId:'store',locationIds:['store']};

test('regular availability requires fourteen Melbourne calendar days and preserves the current schedule until its effective date',()=>{
 const store=availability.create({now}),state={availability:[{userId:actor.id,locationId:actor.locationId,kind:'recurring',revision:1,days:days('unavailable'),notes:'Existing schedule'}]};
 assert.equal(store.earliest(),'2026-10-31');
 for(const input of [{kind:'recurring',effectiveFrom:'2026-10-30'},{kind:'week',weekStart:'2026-10-26'}])assert.throws(()=>store.save(state,actor,{...input,revision:input.kind==='recurring'?1:0,days:days('available')}),/14 days/);
 store.save(state,actor,{kind:'recurring',effectiveFrom:'2026-10-31',revision:1,days:days('available')});
 assert.deepEqual(store.get(state,actor,actor.id,'2026-10-26').effective.days.map(day=>day.status),['unavailable','unavailable','unavailable','unavailable','unavailable','available','available']);
 store.save(state,actor,{kind:'recurring',effectiveFrom:'2026-11-09',revision:2,days:days('unavailable')});
 assert.equal(store.get(state,actor,actor.id,'2026-11-02').effective.days[0].status,'available');assert.equal(store.get(state,actor,actor.id,'2026-11-09').effective.days[0].status,'unavailable');
 assert.throws(()=>store.save(state,actor,{kind:'week',weekStart:'2026-11-02',revision:0,days:days('available'),userId:'another'}),error=>error.status===403);
 store.save(state,actor,{kind:'week',weekStart:'2026-11-02',revision:0,days:days('unavailable')});assert.throws(()=>store.save(state,actor,{kind:'week',weekStart:'2026-11-02',revision:0,days:days('available')}),error=>error.status===409);
 const later=availability.create({now:()=>Date.parse('2026-10-25T13:00:00Z')});assert.throws(()=>later.save(state,actor,{kind:'week',weekStart:'2026-11-02',revision:1},true),/14 days/);
});

test('school-holiday schedules override weekly and recurring days without notice, expire inclusively and reject ambiguous overlaps',()=>{
 const store=availability.create({now}),state={availability:[{userId:actor.id,locationId:actor.locationId,kind:'recurring',revision:1,days:days('unavailable')},{userId:actor.id,locationId:actor.locationId,kind:'week',weekStart:'2026-10-12',revision:1,days:days('unavailable')}]};
 const holiday=store.save(state,actor,{kind:'school-holiday',revision:0,startDate:'2026-10-17',endDate:'2026-10-19',days:days('available')});
 const week=store.get(state,actor,actor.id,'2026-10-12');assert.equal(week.effective.days[4].status,'unavailable');assert.equal(week.effective.days[5].status,'available');assert.equal(week.effective.sources[5].kind,'school-holiday');assert.equal(store.get(state,actor,actor.id,'2026-10-19').effective.days[0].status,'available');assert.equal(store.get(state,actor,actor.id,'2026-10-19').effective.days[1].status,'unavailable');
 assert.throws(()=>store.save(state,actor,{kind:'school-holiday',revision:0,startDate:'2026-10-19',endDate:'2026-10-23',days:days('available')}),error=>error.status===409);
 assert.throws(()=>store.save(state,actor,{...holiday,revision:0,days:days('unavailable')}),error=>error.status===409);
 store.save(state,actor,{kind:'school-holiday',id:holiday.id,revision:1},true);assert.equal(store.get(state,actor,actor.id,'2026-10-12').effective.days[5].status,'unavailable');
});

async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-leave-'));await saveAdmin(dir,'Office','office-test-password');const server=createServer(dir,{rosteringNow:now,fetchImpl:()=>{throw Error('No external sending');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 async function request(user,route='',method='GET',body,extra={}){const response=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...user?.headers,...extra},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});return{status:response.status,data:response.headers.get('content-type')?.includes('json')?await response.json():await response.text()};}
 async function login(username,password='member-test-password'){const result=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(result.status,200);const user={headers:{Cookie:result.headers.get('set-cookie').split(';')[0]}};user.session=(await request(user,'/api/session')).data;user.headers['X-CSRF-Token']=user.session.csrf;return user;}
 const office=await login('Office','office-test-password');async function add(username,role='user',locationIds=[office.session.locationId]){const response=await request(office,'/api/accounts','POST',{username,role,password:'member-test-password',locationId:locationIds[0],locationIds});assert.equal(response.status,201,JSON.stringify(response.data));return{...await login(username),record:response.data};}
 const member=await add('Member'),manager=await add('Manager','franchisee'),other=(await request(office,'/api/companies','POST',{name:'Other',locationName:'Other store'})).data,stores=(await request(office,'/api/locations?all=true')).data,outside=await add('Outside','user',[stores.find(store=>store.companyId===other.id).id]);
 const api=(user,route,method='GET',body,extra)=>request(user,'/api/rostering/'+route,method,body,extra),dashboard=(user,week='2026-11-02')=>api(user,'dashboard?week='+week);
 return{dir,office,member,manager,outside,login,add,request,api,dashboard,close:async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}};
}
const requestLeave=(input={})=>({type:'annual',startDate:'2026-11-02',endDate:'2026-11-03',allDay:true,...input});
const shift=(userId,input={})=>({weekStart:'2026-11-02',date:'2026-11-02',start:'09:00',end:'17:00',overnight:false,breakMinutes:30,revision:0,userId,...input});

test('leave catalogue covers award/NES absences, enforces planned notice and records eligible short-notice requests for review',async()=>{
 const app=await fixture();try{
  const data=(await app.dashboard(app.member)).data;assert.equal(data.leave.earliestDate,'2026-10-31');assert.equal(data.leave.noticeDays,14);
  for(const id of ['annual','annual-advance','personal','carer-paid','carer-unpaid','compassionate','parental','parental-special','pre-adoption','jury','emergency','family-domestic-violence','long-service','toil','public-holiday','work-injury','unpaid-agreed'])assert.ok(data.leave.types.some(type=>type.id===id&&type.clause&&type.help),id);
  for(const type of ['annual','personal','compassionate','family-domestic-violence'])assert.equal((await app.api(app.member,'leave','POST',requestLeave({type,startDate:'2026-10-30',endDate:'2026-10-30'}))).status,400);
  assert.equal((await app.api(app.member,'leave','POST',requestLeave({type:'annual',startDate:'2026-10-30',endDate:'2026-10-30',shortNotice:true,noticeReason:'Holiday'}))).status,400);
  const short=await app.api(app.member,'leave','POST',requestLeave({type:'personal',startDate:'2026-10-17',endDate:'2026-10-17',shortNotice:true,noticeReason:'Unexpected illness'}));assert.equal(short.status,201);assert.equal(short.data.status,'pending');assert.equal(short.data.shortNotice,true);
  assert.equal((await app.api(app.member,'leave','POST',requestLeave({type:'invalid'}))).status,400);assert.equal((await app.api(app.member,'leave','POST',requestLeave({userId:app.manager.session.id}))).status,403);assert.equal((await app.api(app.member,'leave','POST',requestLeave(),{'X-CSRF-Token':''})).status,403);
  const boundary=await app.api(app.member,'leave','POST',requestLeave({startDate:'2026-10-31',endDate:'2026-10-31'}));assert.equal(boundary.status,201);assert.equal(boundary.data.shortNotice,false);
 }finally{await app.close();}
});

test('leave approvals block shifts and publication, cancellation stays effective until reviewed, and revisions protect decisions',async()=>{
 const app=await fixture();try{
  const leave=(await app.api(app.member,'leave','POST',requestLeave())).data,id=leave.id;
  const created=await app.api(app.office,'shifts','POST',shift(app.member.session.id));assert.equal(created.status,201);
  assert.equal((await app.api(app.member,'leave/'+id,'PUT',{action:'approve',revision:1})).status,403);
  assert.equal((await app.api(app.manager,'leave/'+id,'PUT',{action:'approve',revision:1})).status,200);
  assert.equal((await app.api(app.manager,'leave/'+id,'PUT',{action:'reject',revision:1,reason:'Stale'})).status,409);
  const roster=(await app.dashboard(app.office)).data;assert.equal(roster.roster.shifts[0].availability,'unavailable');assert.equal(roster.leave.requests.find(item=>item.id===id).conflictingShifts,1);
  assert.equal((await app.api(app.office,'publish','POST',{weekStart:'2026-11-02',revision:1})).status,409);
  assert.equal((await app.api(app.office,'shifts/'+created.data.shift.id,'PUT',shift(app.member.session.id,{revision:1,allowUnavailable:true}))).status,409);
  assert.equal((await app.api(app.member,'leave/'+id,'PUT',{action:'request-cancellation',revision:2})).data.status,'cancellation-requested');assert.equal((await app.api(app.office,'publish','POST',{weekStart:'2026-11-02',revision:1})).status,409);
  assert.equal((await app.api(app.manager,'leave/'+id,'PUT',{action:'cancel',revision:3,reason:'Cancellation agreed'})).data.status,'cancelled');assert.equal((await app.api(app.office,'publish','POST',{weekStart:'2026-11-02',revision:1})).status,200);
  assert.equal((await app.api(app.outside,'leave/'+id,'PUT',{action:'cancel',revision:4,reason:'Other company'})).status,404);
 }finally{await app.close();}
});

test('confidential leave never exposes its record, reason or notes to ordinary roster managers or other employees',async()=>{
 const app=await fixture();try{
  const secret=await app.api(app.member,'leave','POST',requestLeave({type:'family-domestic-violence',notes:'Private supporting details'}));assert.equal(secret.status,201);const id=secret.data.id;
  assert.ok(!(await app.dashboard(app.manager)).data.leave.requests.some(item=>item.id===id));assert.equal((await app.api(app.manager,'leave/'+id,'PUT',{action:'approve',revision:1})).status,404);
  assert.equal((await app.api(app.office,'leave/'+id,'PUT',{action:'approve',revision:1})).status,200);
  const manager=(await app.dashboard(app.manager)).data;assert.ok(!JSON.stringify(manager).includes('Private supporting details'));assert.ok(!JSON.stringify(manager).includes(id));assert.equal(manager.teamAvailability.find(person=>person.userId===app.member.session.id).leaveDays[0].length,1);
  assert.equal((await app.api(app.manager,'shifts','POST',shift(app.member.session.id,{allowUnavailable:true}))).status,409);
  const user=await app.add('Teammate');assert.ok(!(await app.dashboard(user)).data.leave.requests.some(item=>item.id===id));assert.equal((await app.dashboard(app.member)).data.leave.requests.find(item=>item.id===id).notes,'Private supporting details');
 }finally{await app.close();}
});

test('school-holiday availability applies immediately to roster coverage, expires, and cannot override approved leave or another company',async()=>{
 const app=await fixture();try{
  const holiday=await app.api(app.member,'availability','PUT',{kind:'school-holiday',revision:0,startDate:'2026-10-17',endDate:'2026-10-18',days:days('unavailable')});assert.equal(holiday.status,200);
  assert.equal((await app.api(app.office,'shifts','POST',shift(app.member.session.id,{weekStart:'2026-10-12',date:'2026-10-17'}))).status,409);
  assert.equal((await app.api(app.member,'availability','DELETE',{kind:'school-holiday',id:holiday.data.id,revision:1})).status,200);
  assert.equal((await app.api(app.office,'shifts','POST',shift(app.member.session.id,{weekStart:'2026-10-12',date:'2026-10-17'}))).status,201);
  assert.equal((await app.api(app.member,'availability','PUT',{kind:'recurring',revision:0,effectiveFrom:'2026-10-30',days:days('available')})).status,400);
  assert.equal((await app.api(app.member,'availability','PUT',{kind:'recurring',revision:0,effectiveFrom:'2026-10-31',days:days('available')})).status,200);
  const second=(await app.request(app.office,'/api/locations','POST',{name:'Second location'})).data;
  await app.request(app.office,'/api/accounts/'+app.member.session.id,'PUT',{username:'Member',role:'user',locationId:app.member.session.locationId,locationIds:[app.member.session.locationId,second.id]});
  // Refresh sign-in after changing memberships, then verify company-wide leave coverage.
  const member=await app.login('Member'),request=(await app.api(member,'leave','POST',requestLeave())).data;assert.equal((await app.api(app.office,'leave/'+request.id,'PUT',{action:'approve',revision:1})).status,200);
  assert.equal((await app.api(app.office,'shifts','POST',shift(member.session.id),{'X-Location-Id':second.id})).status,409);
  const overnight=days('available');overnight[4]={status:'window',start:'22:00',end:'02:00',overnight:true};
  assert.equal((await app.api(member,'availability','PUT',{kind:'recurring',effectiveFrom:'2026-11-02',revision:1,days:overnight})).status,200);
  assert.equal((await app.api(member,'availability','PUT',{kind:'school-holiday',revision:0,startDate:'2026-11-07',endDate:'2026-11-07',days:days('unavailable')})).status,200);
  assert.equal((await app.api(app.office,'shifts','POST',shift(member.session.id,{date:'2026-11-06',start:'23:00',end:'01:00',overnight:true,breakMinutes:0}))).status,409);
 }finally{await app.close();}
});

test('new leave grants upgrade exact historical defaults while preserving custom permission levels',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-leave-roles-'));try{
  const old=permissions.defaults.map(role=>({...role,permissions:role.permissions.filter(key=>!permissions.leaveKeys.includes(key))})),custom={id:'custom-reviewer',name:'Custom reviewer',scope:'network',level:40,permissions:['home.view','rostering.view','rostering.manage']};
  await fs.writeFile(path.join(dir,'permission-levels.json'),JSON.stringify({revision:8,communicationsVersion:1,knowledgeVersion:1,rosteringVersion:1,awardsVersion:1,levels:[...old,custom]}));
  const data=await levels.createStore(dir).read();assert.equal(data.leaveVersion,1);assert.equal(data.revision,8);for(const role of permissions.defaults)assert.deepEqual(data.levels.find(item=>item.id===role.id).permissions,role.permissions);assert.deepEqual(data.levels.find(item=>item.id===custom.id).permissions,custom.permissions);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
