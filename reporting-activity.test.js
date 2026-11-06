const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const operations=require('./reporting-operations'),fixture=require('./test-support/reporting-progress-fixture.cjs');
const all=['reporting.view','ops.view','rostering.approve','orders.view','counts.view','wastage.view','prep.view','learning.view','learning.report','equipment.view'];
const actor=(locationId,permissions=all)=>({id:'viewer',role:'custom',permissions,companyId:'co',companyName:'Company',locationId,locationName:'Store '+locationId});
function deps(overrides={}){return{
 directory:async()=>[{id:'u1',username:'Alex'},{id:'u2',username:'Blair'}],
 ops:{activity:async()=>[{at:'2026-10-20T21:30:00Z',userId:'u1',userName:'Alex',type:'checklist-step',title:'Check fryer',detail:'Opening checks'}]},
 rostering:{clockActivity:async()=>[{at:'2026-10-20T20:55:00Z',userId:'u2',userName:'Blair',type:'clock-in',title:'Clocked in',detail:''},{at:'2026-10-19T03:00:00Z',userId:'u2',userName:'Blair',type:'clock-out',title:'Clocked out',detail:''}]},
 orders:async()=>({orders:[{status:'requested',companyId:'co',locationId:'a',createdAt:'2026-10-21T01:00:00Z',requestOwnerId:'u1',orderNumber:'ABC-0001',items:[{supplierId:'s1'},{supplierId:'s1'}]},{status:'deleted',companyId:'co',locationId:'a',createdAt:'2026-10-21T01:00:00Z',requestOwnerId:'u1',items:[]},{status:'requested',companyId:'co',locationId:'other',createdAt:'2026-10-21T01:00:00Z',requestOwnerId:'u2',items:[]}]}),
 counts:async()=>[{locationId:'a',createdAt:'2026-10-21T05:00:00Z',counterName:'blair',itemCount:12,countDate:'2026-10-21'},{locationId:'z',createdAt:'2026-10-21T05:00:00Z',counterName:'Alex',itemCount:1,countDate:'2026-10-21'}],
 wastage:{list:async(_actor,params)=>{assert.equal(params.get('from'),'2026-10-21');return{records:[{createdAt:'2026-10-21T07:00:00Z',createdBy:{id:'u1',name:'Alex'},items:[{}],voidedAt:'2026-10-21T08:00:00Z',voidedBy:{id:'u2',name:'Blair'}}]};}},
 labels:{batchActivity:async()=>{throw Object.assign(Error('boom'),{status:500});}},
 learning:{report:async()=>({rows:[{completedAt:'2026-10-21T09:00:00Z',userId:'u2',username:'Blair',courseTitle:'Food safety',assignmentTitle:'Food safety'},{completedAt:null,userId:'u1'}]})},
 equipment:{list:async()=>({items:[{name:'Fryer',faults:[{reportedAt:'2026-10-21T02:00:00Z',reportedBy:{id:'u1',name:'Alex'},description:'Too hot',resolvedAt:'2026-10-21T04:00:00Z',resolvedBy:{id:'u2',name:'Blair'}}],services:[{recordedAt:'2026-10-21T03:00:00Z',recordedBy:{id:'u2',name:'Blair'},notes:'Serviced'}]}]})},
 ...overrides};}
test('staff activity combines permitted sources in Melbourne time, resolves people and isolates failures',async()=>{
 const result=await operations.activity([actor('a')],{start:'2026-10-21',end:'2026-10-21'},deps());
 const types=result.rows.map(row=>row.type).sort();
 assert.deepEqual(types,['checklist-step','clock-in','count','equipment-fault','equipment-resolved','equipment-service','order','training-complete','wastage','wastage-void'],'out-of-range, deleted, other-location and unfinished records are excluded');
 const step=result.rows.find(row=>row.type==='checklist-step');assert.equal(step.date,'2026-10-21');assert.equal(step.time,'08:30','UTC times convert to Melbourne daylight time');
 assert.equal(result.rows.find(row=>row.type==='order').userName,'Alex','live orders resolve the placing account by ID');assert.equal(result.rows.find(row=>row.type==='order').detail,'2 items · 1 supplier');
 assert.equal(result.rows.find(row=>row.type==='count').userKey,'u2','counts match a saved username to the account');
 assert.deepEqual(result.failed,['Labels'],'a failing source is reported without hiding the others');assert.deepEqual(result.people.map(p=>p.name),['Alex','Blair']);
 assert(result.rows.every((row,index,list)=>index===0||list[index-1].at>=row.at),'newest first');
});
test('staff activity only reads sources the viewer may see',async()=>{
 const called=[];const spy=(name,value)=>async()=>{called.push(name);return value;};
 const limited=await operations.activity([actor('a',['reporting.view','ops.view'])],{start:'2026-10-21',end:'2026-10-21'},deps({rostering:{clockActivity:spy('clock',[])},orders:spy('orders',{orders:[]}),counts:spy('counts',[]),wastage:{list:spy('wastage',{records:[]})},equipment:{list:spy('equipment',{items:[]})},learning:{report:spy('learning',{rows:[]})}}));
 assert.deepEqual(called,[],'sources without permission are never read');assert.deepEqual(limited.included,['Checklists']);assert(limited.skipped.includes('Orders')&&limited.skipped.includes('Clock in & breaks'));assert(limited.rows.every(row=>row.source==='checklists'));
});
test('the staff activity API is scoped, read-only and follows checklist audiences',async()=>{
 const app=await fixture();try{
  const query='?start=2026-10-19&end=2026-10-21&locations='+app.a+','+app.b,files=['learning-centre.json','ops-management.json','rostering.json'];const read=()=>Promise.all(files.map(file=>fs.readFile(app.dir+'/'+file,'utf8').catch(()=>'')));const before=await read();
  const result=await app.api(app.leader,'/api/reporting/activity'+query);assert(Array.isArray(result.rows));assert(result.included.includes('Checklists'));assert.equal(result.period.start,'2026-10-19');
  for(const row of result.rows){assert.match(row.date,/^\d{4}-\d\d-\d\d$/);assert.match(row.time,/^\d\d:\d\d$/);assert([app.a,app.b].includes(row.locationId));}
  assert(!JSON.stringify(result).includes('answers'));assert(!JSON.stringify(result).includes('snapshot'));assert.deepEqual(await read(),before,'reading activity never writes');
  const url='/api/reporting/activity';assert.equal((await app.request(null,url+query)).status,401);assert.equal((await app.request(app.alex,url+query)).status,403);assert.equal((await app.request(app.leader,url+'?locations='+app.other.locationId)).status,403);assert.equal((await app.request(app.leader,url+'?start=2026-10-22&end=2026-10-21')).status,400);
  const dashboard=await app.api(app.office,'/api/ops-management'),plan=dashboard.planners.find(p=>p.templateId===app.template.id);await app.api(app.office,'/api/ops-management/planners/'+plan.id,'PUT',{...plan,roleIds:['user']});const restricted=await app.api(app.office,url+query);assert(!restricted.rows.some(row=>row.source==='checklists'&&row.detail==='Opening checklist'),'ops management does not bypass the planner audience');
 }finally{await app.close();}
});
