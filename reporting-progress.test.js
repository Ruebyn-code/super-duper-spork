const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),crypto=require('node:crypto');
const model=require('./public/reporting-progress-model'),operations=require('./reporting-operations'),fixture=require('./test-support/reporting-progress-fixture.cjs');
test('progress rates use completed work over active assignments, preserve zero and exclude cancelled work',()=>{
 const rows=[{status:'completed'},{status:'overdue'},{status:'in-progress'},{status:'not-started'},{status:'cancelled'}];assert.deepEqual(model.summary(rows),{total:4,completed:1,overdue:1,inProgress:1,notStarted:1,timedFails:0,timedFailRuns:0,ruleFails:0,rate:25});assert.equal(model.summary([]).rate,null);assert.equal(model.summary([{status:'overdue'}]).rate,0);
 const locations=[{id:'a',name:'A',companyId:'company'},{id:'b',name:'B',companyId:'company'},{id:'c',name:'C',companyId:'company'}],shared={status:'completed',companyId:'company',locationIds:['a','b']},ranked=model.progressRankings([shared],locations);assert.deepEqual(ranked.map(r=>[r.name,r.rank,r.value]),[['A',1,100],['B',1,100],['C',null,null]]);assert.equal(model.summary([shared]).total,1);
});
test('financial location rankings are weighted, handle ties and losses, and leave missing figures unranked',()=>{
 const row={salesCents:10000,profitCents:2000,recordedDays:7,expectedDays:7,reconciledDays:7,orderCount:1,completed:true,missingCosts:'',reportSaved:true};const report=(id,rows)=>({company:{id:'co',name:'Company'},location:{id,name:id},details:{finance:rows}});const reports=[report('A',[row,{...row,salesCents:30000,profitCents:18000}]),report('B',[{...row,salesCents:10000,profitCents:5000}]),report('C',[{...row,profitCents:-1000}]),report('D',[{...row,recordedDays:2}]),report('E',[])];assert.deepEqual(model.financeRankings(reports,'profitPercent').map(r=>[r.name,r.rank,r.value]),[['A',1,50],['B',1,50],['C',3,-10],['D',null,null],['E',null,null]]);assert.equal(model.financeRankings([report('Zero',[{...row,salesCents:0,profitCents:0}])],'salesCents')[0].value,0);
});
test('training dates, selected locations and permissions preserve a shared assignment without duplicate totals',async()=>{
 const row={assignmentId:'assignment',userId:'person',username:'Name',courseTitle:'Course',assignedAt:'2026-09-01T00:00:00Z',dueDate:'2026-09-10',completedAt:'2026-10-20T23:30:00Z',status:'completed',locationIds:['private'],locationNames:['Private']},contexts=['a','b'].map(id=>({role:'admin',companyId:'co',companyName:'Company',locationId:id,locationName:id})),period={start:'2026-10-21',end:'2026-10-21'},store={report:async()=>({rows:[row]})};const result=await operations.training(contexts,period,store);assert.equal(result.rows.length,1);assert.deepEqual(result.rows[0].locationIds,['a','b']);assert(!JSON.stringify(result).includes('Private'));assert.equal((await operations.training(contexts,{start:'2026-10-01',end:'2026-10-19'},store)).rows.length,0);await assert.rejects(operations.training([{...contexts[0],role:'user'}],period,store),error=>error.status===403);
});
test('progress reporting APIs enforce scopes and planner audiences, include unstarted work today, and never create records or reveal answers',async()=>{
 const app=await fixture();try{
  const query='?start=2026-10-19&end=2026-10-21&locations='+app.a+','+app.b,files=['learning-centre.json','ops-management.json'],before=await Promise.all(files.map(file=>fs.readFile(app.dir+'/'+file,'utf8')));const training=await app.api(app.leader,'/api/reporting/training'+query);assert.equal(training.rows.length,2);assert.deepEqual(training.rows.find(r=>r.username==='Alex').locationIds,[app.a,app.b]);assert.equal(model.summary(training.rows).completed,1);assert.equal(model.summary(training.rows).overdue,1);
  const checks=await app.api(app.leader,'/api/reporting/checklists'+query);assert.equal(checks.rows.length,4);assert.equal(checks.rows.filter(r=>r.status==='completed').length,1);assert.equal(checks.rows.filter(r=>r.status==='not-started').length,2);assert.equal(checks.rows.filter(r=>r.status==='in-progress').length,1);assert(!JSON.stringify(checks).includes('answers'));assert(!JSON.stringify(checks).includes('snapshot'));assert(!JSON.stringify(training).includes('quizSeed'));assert.deepEqual(await Promise.all(files.map(file=>fs.readFile(app.dir+'/'+file,'utf8'))),before);
  for(const kind of ['training','checklists']){const url='/api/reporting/'+kind;assert.equal((await app.request(null,url+query)).status,401);assert.equal((await app.request(app.alex,url+query)).status,403);assert.equal((await app.request(app.limited,url+query)).status,403);assert.equal((await app.request(app.leader,url+'?locations='+app.other.locationId)).status,403);assert.equal((await app.request(app.leader,url+'?start=2026-10-22&end=2026-10-21')).status,400);}
  const history=await app.api(app.leader,'/api/reporting/checklists?start=2026-10-19&end=2026-10-20&locations='+app.a);assert.equal(history.rows.length,0,'Historical unstarted schedules must not be fabricated');
  const dashboard=await app.api(app.office,'/api/ops-management'),plan=dashboard.planners.find(p=>p.templateId===app.template.id);await app.api(app.office,'/api/ops-management/planners/'+plan.id,'PUT',{...plan,roleIds:['user']});const restricted=await app.api(app.office,'/api/reporting/checklists'+query);assert(!restricted.rows.some(r=>r.title==='Opening checklist'),'Ops management does not bypass the planner audience');
  const snapshots=await Promise.all(files.map(file=>fs.readFile(app.dir+'/'+file,'utf8')));await app.api(app.office,'/api/reporting/checklists'+query);await app.api(app.office,'/api/reporting/training'+query);assert.deepEqual(await Promise.all(files.map(file=>fs.readFile(app.dir+'/'+file,'utf8'))),snapshots);
  const capabilities=(await app.api(app.limited,'/api/reporting?locations='+app.a+'&preset=last-week')).reports[0].capabilities;assert.deepEqual(capabilities,{training:false,checklists:false});
  await app.api(app.office,'/api/accounts/'+app.office.session.id,'PUT',{username:'Office',role:'admin',preserveRole:true,phoneNumber:'0400009876'});
  const device=await app.api(app.office,'/api/kiosk-devices','POST',{name:'Report test kiosk',locationId:app.a,features:['app']}),paired=await fetch(app.base+'/api/kiosk/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:device.code})});assert.equal(paired.status,200);const kiosk={headers:{Cookie:'opstack_kiosk='+paired.headers.get('set-cookie').match(/opstack_kiosk=([^;]+)/)[1]}};const state=await app.api(kiosk,'/api/kiosk/status');kiosk.headers['X-CSRF-Token']=state.csrf;await app.api(kiosk,'/api/kiosk/unlock','POST',{feature:'app',pin:'9876'});
  assert.equal((await app.request(kiosk,'/api/reporting/checklists?locations='+app.a)).status,200);assert.equal((await app.request(kiosk,'/api/reporting/checklists?locations='+app.b)).status,403);assert.equal((await app.request(kiosk,'/api/reporting/training?locations='+app.other.locationId)).status,403);

 }finally{await app.close();}
});

test('checklist step reports total each step across runs with timed-section on-time rates', () => {
 const steps=require('./public/reporting-checklist-steps.js');
 const step=(id,extra)=>({id,title:id,type:'check',sectionId:null,sectionTitle:'',timed:false,done:false,completedAt:null,completedBy:'',timing:null,...extra});
 const timed=extra=>step('flush',{sectionId:'s1',sectionTitle:'9:00 am – 11:00 am',timed:true,...extra});
 const run=(id,workDate,list,templateId='t1')=>({id,templateId,title:'Opening',workDate,status:'completed',locationNames:['Store'],companyName:'Co',steps:list});
 const rows=[
  run('r1','2026-11-01',[step('wipe',{done:true,completedAt:'2026-10-31T21:40:00Z',completedBy:'Sam'}),timed({done:true,completedAt:'2026-10-31T22:15:00Z',completedBy:'Sam',timing:'within'})]),
  run('r2','2026-11-02',[step('wipe',{done:true,completedAt:'2026-11-01T21:50:00Z',completedBy:'Alex'}),timed({done:true,completedAt:'2026-11-02T00:30:00Z',completedBy:'Alex',timing:'late'})]),
  run('r3','2026-11-03',[step('wipe'),timed({timing:'missed'})]),
  run('r4','2026-11-03',[step('other')],'t2')
 ];
 assert.deepEqual(steps.checklists(rows).map(item=>[item.key,item.runs]),[['t1',3],['t2',1]]);
 const summary=steps.summarise(rows,'t1');
 assert.equal(summary.runs,3);assert.equal(summary.total,6);assert.equal(summary.done,4);
 const [wipe,flush]=summary.steps;
 assert.equal(wipe.done,2);assert.equal(wipe.total,3);assert.equal(wipe.onTime,null);assert.equal(steps.clockText(wipe.usualMinute),'8:45 am');
 assert.equal(flush.timing.within,1);assert.equal(flush.timing.late,1);assert.equal(flush.timing.missed,1);assert.equal(Math.round(flush.onTime),33);
 assert.equal(summary.sections.length,2);assert.equal(summary.sections[1].timed,true);assert.equal(summary.onTime,flush.onTime);
 assert.deepEqual(flush.entries.map(entry=>entry.runId),['r3','r2','r1']);
 assert.equal(wipe.topPerson.count,1);
});

test('timed-section steps done outside their window fail and reduce the checklist completion rate', () => {
 const step=(id,extra={})=>({id,done:true,timed:false,timing:null,...extra}),locations=[{id:'a',name:'A',companyId:'co'},{id:'b',name:'B',companyId:'co'}];
 const onTime={status:'completed',companyId:'co',locationIds:['a'],steps:[step('1'),step('2',{timed:true,timing:'within'}),step('3',{timed:true,timing:'within'}),step('4')]};
 const late={status:'completed',companyId:'co',locationIds:['b'],steps:[step('1'),step('2',{timed:true,timing:'late'}),step('3',{timed:true,timing:'early'}),step('4')]};
 const missed={status:'in-progress',companyId:'co',locationIds:['b'],steps:[step('1'),step('2',{timed:true,timing:'missed',done:false}),step('3',{timed:true,timing:'pending',done:false}),step('4',{done:false})]};
 assert.equal(model.score(onTime),1);assert.equal(model.score(late),0.5);assert.equal(model.score(missed),0.25);
 assert.equal(model.timedFails(late),2);assert.equal(model.timedFails(missed),1);
 const total=model.summary([onTime,late,missed]);assert.equal(total.completed,2);assert.equal(total.timedFails,3);assert.equal(total.timedFailRuns,2);assert.equal(Math.round(total.rate*100)/100,58.33);
 assert.deepEqual(model.progressRankings([onTime,late,missed],locations).map(row=>[row.name,row.rank,row.value,row.timedFails]),[['A',1,100,0],['B',2,37.5,3]]);
 assert.equal(model.summary([{status:'completed'},{status:'overdue'}]).rate,50);
});
