const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createStore}=require('./notifications'),model=require('./public/notification-model'),{fixture}=require('./test-support/roster-hourly-fixture.cjs');
const actor=(permissions,extra={})=>({id:'u1',username:'Sam',companyId:'c1',locationId:'l1',permissions,...extra});
const empty={personal:async()=>({tasks:{items:[]},inStore:{items:[]},approvals:{locations:[]},comms:{items:[]}}),rostering:async()=>({weeks:[],today:[],myLeave:[],leaveReviews:[]}),ops:async()=>({tasks:[]}),equipment:async()=>({items:[]}),transfers:async()=>({transfers:[]}),dailySales:async()=>null,reports:async()=>({inbox:[]})};
async function temp(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-notify-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
test('the feed maps each permitted source into notifications and skips sources the account cannot use',async t=>{
 const dir=await temp(t),now=()=>Date.parse('2026-10-23T02:00:00Z'),calls=[];const spy=(name,value)=>async()=>{calls.push(name);return value;};
 const sources={...empty,
  personal:spy('personal',{tasks:{items:[{id:'agreement:d1',kind:'agreement',title:'Casual agreement',detail:'Sign',href:'/employment-documents?document=d1'},{id:'course:a1',kind:'course',title:'Food safety',dueDate:'2026-10-20',href:'/learning-centre#learn-a1'}]},inStore:{items:[]},approvals:{locations:[{locationId:'l1',locationName:'Store',count:2,href:'/rostering#timesheets'}]},comms:{items:[{id:'post:p1',kind:'post',title:'Menu change',required:true,updatedAt:'2026-10-22T00:00:00Z',href:'/communications?post=p1'},{id:'chat:t1',kind:'chat',chatKind:'direct',title:'Alex',unread:3,updatedAt:'2026-10-22T01:00:00Z',href:'/communications#chat-t1'}]}}),
  rostering:spy('rostering',{weeks:[{weekStart:'2026-10-26',publishedAt:'2026-10-22T05:00:00Z',shifts:3,first:{date:'2026-10-27',start:'11:00',end:'17:30'}}],today:[{id:'s1',date:'2026-10-23',start:'09:00',end:'13:00',position:'Front'}],myLeave:[{id:'lv1',status:'approved',startDate:'2026-11-10',endDate:'2026-11-12',updatedAt:'2026-10-22T03:00:00Z'}],leaveReviews:[]}),
  equipment:spy('equipment',{items:[{id:'e1',name:'Fryer',status:'operational',faults:[{id:'f1',status:'open',severity:'unusable',description:'Won’t heat',reportedAt:'2026-10-22T04:00:00Z',reportedBy:{name:'Jo'}}],serviceDue:{state:'overdue',next:'2026-10-01'}}]}),
  ops:spy('ops',{tasks:[{plannerId:'p',locationId:'l1',periodKey:'2026-10-23',title:'Opening',availability:{allowed:true,opensAt:'2026-10-22T20:00:00Z'},dueAt:'2026-10-23T02:10:00Z',run:null},{plannerId:'q',locationId:'l1',periodKey:'k',title:'Done',availability:{allowed:true,opensAt:'2026-10-22T20:00:00Z'},run:{status:'completed'}}]}),
  dailySales:spy('dailySales',{tradingDate:'2026-10-23',locationName:'Store'}),reports:spy('reports',{inbox:[{id:'r1',name:'Weekly summary',email:'sent',hasReport:true,createdAt:'2026-10-22T06:00:00Z'},{id:'r2',name:'Manager copy',hasReport:true}]})};
 const store=createStore(dir,{sources,now});
 const all=['home.view','comms.view','learning.view','learning.complete','rostering.view','rostering.leave','rostering.approve','ops.view','ops.complete','equipment.view','equipment.manage','sales.edit'];
 const feed=await store.list(actor(all));const titles=feed.items.map(i=>i.title);
 for(const expected of ['Agreement to sign: Casual agreement','Overdue training: Food safety','2 timesheets to approve','Required post: Menu change','3 new messages from Alex','Roster published for the week of Mon, 26 Oct','You’re working today, 9 am–1 pm','Leave request approved','Problem reported: Fryer','Service overdue: Fryer','Checklist due soon: Opening','Enter today’s sales','New report: Weekly summary'])assert(titles.includes(expected),expected+' missing from '+titles.join(' | '));
 assert(!titles.includes('Checklist ready: Done'),'completed checklists are not notified');assert(!titles.includes('New report: Manager copy'),'only report recipients are notified');
 assert.equal(feed.unread,feed.items.length);assert.equal(feed.items[0].priority,'high','high priority unread items come first');assert(!calls.includes('transfers'),'transfers need receiving permission');
 calls.length=0;const staff=await store.list(actor(['home.view','comms.view']));assert.deepEqual([...new Set(calls)].sort(),['personal','reports']);assert(staff.items.every(i=>['messages','posts','agreements','training','timesheets','reports'].includes(i.category)));
 assert(!staff.items.some(i=>i.category==='equipment'),'equipment problems are for equipment managers only');
 await assert.rejects(store.list({id:'u1',permissions:[]}),e=>e.status===403);
 await assert.rejects(fs.readFile(path.join(dir,'notification-state.json')),e=>e.code==='ENOENT','reading the feed never writes');
});
test('mark as read, preferences and failing sources stay private, bounded and per-account',async t=>{
 const dir=await temp(t);let posts=[{id:'post:p1',kind:'post',title:'One',updatedAt:'2026-10-22T00:00:00Z',href:'/communications'}];
 const sources={...empty,personal:async()=>({tasks:{items:[]},inStore:{items:[]},approvals:{locations:[]},comms:{items:posts}}),equipment:async()=>{throw Object.assign(Error('boom'),{status:500});}};
 const store=createStore(dir,{sources,now:()=>Date.parse('2026-10-23T02:00:00Z')}),me=actor(['home.view','comms.view','equipment.view','equipment.manage']),other={...me,id:'u2'};
 let feed=await store.list(me);assert.equal(feed.unread,1);assert.deepEqual(feed.errors,['Equipment'],'a failing source is reported without hiding others');
 feed=await store.markRead(me,{ids:[feed.items[0].id,'not-in-my-feed']});assert.equal(feed.unread,0);assert.equal(feed.items[0].unread,false);
 const saved=JSON.parse(await fs.readFile(path.join(dir,'notification-state.json'),'utf8'));assert.deepEqual(Object.keys(saved.users.u1.read),['post:p1:2026-10-22T00:00:00Z'],'unknown IDs are never stored');
 assert.equal((await store.list(other)).unread,1,'read state belongs to one account');
 posts=[{...posts[0],updatedAt:'2026-10-23T01:00:00Z'}];assert.equal((await store.list(me)).unread,1,'an updated post notifies again');
 feed=await store.markRead(me,{all:true});assert.equal(feed.unread,0);
 for(const bad of [{},{ids:[]},{ids:[1]},{ids:Array(201).fill('x')},{all:'yes'}])await assert.rejects(store.markRead(me,bad),e=>e.status===400);
 feed=await store.preferences(me,{muted:['posts']});assert.equal(feed.items.length,0,'muted types are hidden');assert.equal(feed.categories.find(c=>c.id==='posts').muted,true);
 for(const bad of [{muted:['nope']},{muted:'posts'},{muted:['posts','posts']}])await assert.rejects(store.preferences(me,bad),e=>e.status===400);
 assert.equal((await store.list(other)).items.length,1,'preferences belong to one account');
 assert.equal(model.badge(3),'3');assert.equal(model.badge(12),'9+');
});
test('the notification API is scoped, CSRF-protected and reflects real equipment, roster and leave records',async t=>{
 const f=await fixture({seed:false});t.after(()=>f.close());
 assert.equal((await f.request(null,'/api/notifications')).status,401);
 const item=await f.api(f.office,'/api/equipment','POST',{requestId:crypto.randomUUID(),name:'Fryer',category:'cooking',status:'operational'});
 await f.api(f.staff,'/api/equipment/'+item.id+'/faults','POST',{requestId:crypto.randomUUID(),description:'Won’t heat',severity:'unusable'});
 const office=await f.api(f.office,'/api/notifications');const problem=office.items.find(i=>i.category==='equipment');assert.equal(problem.title,'Problem reported: Fryer');assert.equal(problem.priority,'high');
 assert(!(await f.api(f.staff,'/api/notifications')).items.some(i=>i.category==='equipment'),'staff without equipment management are not notified');
 assert.equal((await f.request(f.office,'/api/notifications/read','POST',{ids:[problem.id]},{'X-CSRF-Token':''})).status,403);
 const read=await f.api(f.office,'/api/notifications/read','POST',{ids:[problem.id]});assert.equal(read.items.find(i=>i.id===problem.id).unread,false);
 const other=await f.api(f.office,'/api/locations','POST',{name:'Other store'});assert(!(await f.api(f.office,'/api/notifications','GET',undefined,{'X-Location-Id':other.id})).items.some(i=>i.category==='equipment'),'notifications follow the selected location');
 const state=JSON.parse(await fs.readFile(path.join(f.dir,'rostering.json'),'utf8').catch(()=>'{"weeks":[],"availability":[],"rates":[],"rateRevisions":[],"budgets":[],"entries":[]}'));
 state.weeks.push({locationId:f.location,companyId:f.office.session.companyId,weekStart:'2026-10-19',revision:2,draft:[],published:[{id:'s1',userId:f.staff.session.id,date:'2026-10-23',start:'11:00',end:'17:00'},{id:'s2',userId:f.staff.session.id,date:'2026-10-24',start:'11:00',end:'15:00'},{id:'s3',userId:f.office.session.id,date:'2026-10-24',start:'09:00',end:'12:00'}],publishedAt:'2026-10-20T00:00:00Z',publishedBy:'Office'});
 state.leave=[{id:'lv1',userId:f.staff.session.id,username:'Staff',companyId:f.office.session.companyId,locationId:f.location,type:'annual',startDate:'2026-11-20',endDate:'2026-11-21',status:'pending',createdAt:'2026-10-22T00:00:00Z',updatedAt:'2026-10-22T00:00:00Z'},{id:'lv2',userId:f.staff.session.id,username:'Staff',companyId:f.office.session.companyId,locationId:f.location,type:'annual',startDate:'2026-12-01',endDate:'2026-12-02',status:'rejected',createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-22T02:00:00Z'}];
 await fs.writeFile(path.join(f.dir,'rostering.json'),JSON.stringify(state));
 const staffFeed=await f.api(f.staff,'/api/notifications'),titles=staffFeed.items.map(i=>i.title);
 assert(titles.some(t=>t.startsWith('Roster published for the week of')),titles.join('|'));assert(titles.includes('You’re working today, 11 am–5 pm'));assert(titles.includes('Leave request declined'));assert(!titles.some(t=>t.startsWith('Leave request to review')),'staff do not review leave');
 const officeFeed=await f.api(f.office,'/api/notifications');assert(officeFeed.items.some(i=>i.title==='Leave request to review from Staff'));assert(!officeFeed.items.some(i=>i.title==='Leave request declined'),'leave decisions go to the requester');
 const roster=officeFeed.items.find(i=>i.category==='roster');assert.match(roster?.detail||'',/1 shift/,'each person only sees their own shifts');
 assert.equal(f.calls(),0);
});
