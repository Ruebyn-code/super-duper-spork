const {fetchWithSetupSnooze:fetch}=require('./test-support/location-setup-snooze.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const schedule=require('./operating-expense-schedule'),weekly=require('./weekly-sales-reports'),model=require('./public/weekly-sales-report');
const actor={id:'office',username:'Office',companyId:'default',locationId:'shop'},bill=(extra={})=>({id:'marketing-bill',typeId:'electricity',totalCents:120000,weeks:2,startWeek:'2026-10-05',...extra});
const record=weekStart=>({weekStart,revision:0,breakdown:model.blank(),labourCents:0,operatingExpensesCents:0,operatingAdditionalCents:0,roCents:0});
test('fixed bills reach saved and unsaved weeks, survive report saves and restart, and cannot be shifted by inherited snapshots',async()=>{
 const dir=await fs.mkdtemp('/tmp/operating-ledger-');try{const reports=weekly.createStore();await reports.save(dir,actor,record('2026-10-12'));let ledger=await schedule.change(dir,actor,{revision:0,changes:[bill()]});
  for(const [week,expected] of [['2026-09-28',null],['2026-10-05',60000],['2026-10-12',60000],['2026-10-19',0],['2026-11-02',0]])assert.equal((await reports.report(dir,actor,week)).record.operatingExpensesCents,expected,week);
  const next=(await reports.report(dir,actor,'2026-10-12')).record;next.operatingAllocations[0].totalCents=1;await reports.save(dir,actor,next);assert.equal((await schedule.read(dir,actor)).bills[0].totalCents,120000);
  ledger=await schedule.change(dir,actor,{revision:ledger.revision,changes:[bill({totalCents:80000})]});assert.equal((await weekly.createStore().report(dir,actor,'2026-10-12')).record.operatingExpensesCents,40000);assert.equal(ledger.bills[0].startWeek,'2026-10-05');
  assert.equal((await reports.report(dir,{...actor,locationId:'other'},'2026-10-12')).record.operatingExpensesCents,null);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('bill writes reject overlaps and stale edits, retry safely, preserve exact cents and allow deletion and reuse of an expense type',async()=>{
 const dir=await fs.mkdtemp('/tmp/operating-ledger-');try{const request={revision:0,changes:[bill({totalCents:10000,weeks:3})]},first=await schedule.change(dir,actor,request);assert.equal((await schedule.change(dir,actor,request)).revision,first.revision);
  assert.deepEqual(['2026-10-05','2026-10-12','2026-10-19','2026-10-26'].map(week=>schedule.cost(first.bills,week)),[3334,3333,3333,0]);
  await assert.rejects(schedule.change(dir,actor,{revision:0,changes:[bill({totalCents:9000})]}),error=>error.status===409);
  await assert.rejects(schedule.change(dir,actor,{revision:1,changes:[bill({id:'overlap',startWeek:'2026-10-12'})]}),error=>error.status===400);
  for(const change of [{weeks:0},{weeks:521},{startWeek:'2026-10-06'},{startWeek:'2026-02-30'},{totalCents:-1},{typeId:'unknown'},{typeId:undefined}])await assert.rejects(schedule.change(dir,actor,{revision:1,changes:[bill(change)]}),error=>error.status===400);
  let next=await schedule.change(dir,actor,{revision:1,changes:[{id:'marketing-bill',deleted:true}]});assert.equal(next.bills.length,0);next=await schedule.change(dir,actor,{revision:next.revision,changes:[bill({id:'next-bill',startWeek:'2026-11-02'})]});assert.equal(next.bills.length,1);assert.equal(schedule.cost(next.bills,'2026-10-12'),0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('one-time migration deduplicates inherited copies, keeps source dates, and leaves original report files intact',async()=>{
 const dir=await fs.mkdtemp('/tmp/operating-ledger-');try{const folder=path.join(dir,'weekly-sales-reports',actor.locationId);await fs.mkdir(folder,{recursive:true});const allocation={typeId:'electricity',description:'Electricity',totalCents:120000,weeks:2,startWeek:'2026-10-05'};
  const source={...record('2026-10-05'),operatingAllocations:[allocation]};await fs.writeFile(path.join(folder,'2026-10-05.json'),JSON.stringify(source));for(const week of ['2026-10-12','2026-11-02'])await fs.writeFile(path.join(folder,week+'.json'),JSON.stringify({...record(week),operatingAllocations:[allocation]}));
  const migrated=await schedule.read(dir,actor);assert.equal(migrated.bills.length,1);assert.equal(schedule.cost(migrated.bills,'2026-10-12'),60000);assert.equal(schedule.cost(migrated.bills,'2026-11-02'),0);assert.deepEqual(JSON.parse(await fs.readFile(path.join(folder,'2026-10-05.json'),'utf8')),source);
  const edited=await schedule.change(dir,actor,{revision:0,changes:[{...migrated.bills[0],totalCents:80000}]});assert.equal(schedule.cost(edited.bills,'2026-10-12'),40000);assert.throws(()=>schedule.legacyChanges(edited,[allocation],'2026-10-05'),error=>error.status===409);const cleared={...allocation,totalCents:null,cleared:true,startWeek:'2026-10-12'};assert.equal(schedule.cost(schedule.legacyChanges(edited,[cleared],'2026-10-12').bills,'2026-10-12'),40000);await schedule.change(dir,actor,{revision:edited.revision,changes:[{id:migrated.bills[0].id,deleted:true}]});assert.equal((await schedule.read(dir,actor)).bills.length,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('moving or deleting a saved bill cannot be undone by an older report snapshot',async()=>{
 const dir=await fs.mkdtemp('/tmp/operating-ledger-');try{let ledger=await schedule.change(dir,actor,{revision:0,changes:[bill()]});const stale=[{...bill(),description:'Electricity'}];
  ledger=await schedule.change(dir,actor,{revision:ledger.revision,changes:[bill({startWeek:'2026-10-12'})]});assert.equal(schedule.legacyChanges(ledger,stale,'2026-10-05').bills.length,1);assert.equal(schedule.legacyChanges(ledger,stale,'2026-10-05').bills[0].startWeek,'2026-10-12');
  ledger=await schedule.change(dir,actor,{revision:ledger.revision,changes:[{id:'marketing-bill',deleted:true}]});const prior={...stale[0],startWeek:'2026-10-12'};assert.equal(schedule.legacyChanges(ledger,[prior],'2026-10-12').bills.length,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('schedule API requires sign-in and CSRF and shares bills only within accessible locations',async()=>{
 const {createServer}=require('./server'),{saveAdmin}=require('./auth'),dir=await fs.mkdtemp('/tmp/operating-ledger-api-');await saveAdmin(dir,'Office','test-office-password');const server=createServer(dir,{fetchImpl:()=>{throw Error('Unexpected supplier sending');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 async function login(username){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-office-password'})});const cookie=response.headers.get('set-cookie').split(';')[0],session=await(await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json();return {session,headers:{Cookie:cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'}};}
 try{assert.equal((await fetch(base+'/api/operating-expense-schedule')).status,401);const office=await login('Office');for(const [username,role] of [['Owner','franchisee'],['Manager','user']])assert.equal((await fetch(base+'/api/accounts',{method:'POST',headers:office.headers,body:JSON.stringify({username,role,password:'test-office-password',locationIds:[office.session.locationId]})})).status,201);
  const manager=await login('Manager'),owner=await login('Owner'),request={revision:0,changes:[bill()]};assert.equal((await fetch(base+'/api/operating-expense-schedule',{method:'PUT',headers:{...manager.headers,'X-CSRF-Token':''},body:JSON.stringify(request)})).status,403);
  assert.equal((await fetch(base+'/api/operating-expense-schedule',{method:'PUT',headers:manager.headers,body:JSON.stringify(request)})).status,200);assert.equal((await(await fetch(base+'/api/operating-expense-schedule',{headers:owner.headers})).json()).bills.length,1);
  const other=await(await fetch(base+'/api/locations',{method:'POST',headers:office.headers,body:JSON.stringify({name:'Other'})})).json();assert.equal((await fetch(base+'/api/operating-expense-schedule',{headers:{...manager.headers,'X-Location-Id':other.id}})).status,403);assert.equal((await(await fetch(base+'/api/operating-expense-schedule',{headers:{...office.headers,'X-Location-Id':other.id}})).json()).bills.length,0);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
