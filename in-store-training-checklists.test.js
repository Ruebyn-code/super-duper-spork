// Training checklists: builder steps, embedded Learning centre courses and checklist-based practical sessions.
const{test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const{fixture,password}=require('./test-support/ai-assistance-fixture.cjs'),training=require('./in-store-training');
const base='/api/learning-centre/in-store',id=()=>crypto.randomUUID();
const courseId=id(),archivedCourse=id();
const courses=new Map([[courseId,{id:courseId,title:'Food safety basics'}]]);
function steps(){return[{id:id(),type:'section',title:'Opening'},{id:id(),type:'check',title:'Wash hands',required:true},{id:id(),type:'number',title:'Fridge temperature',required:true,format:'temperature',decimals:1,unit:'°C',min:-5,max:10},{id:id(),type:'selection',title:'Station',required:false,source:'custom',options:['Grill','Fryer'],multiple:false},{id:id(),type:'textarea',title:'Observations',required:false},{id:id(),type:'course',title:'',courseId,required:false}];}
async function setup(t){const app=await fixture();t.after(()=>app.close());await app.api(app.office,'/api/accounts','POST',{username:'Trainer',password,role:'user',locationId:app.location});app.trainer=await app.login('Trainer');
 // A published course the staff member has not yet passed.
 app.companyId=app.office.session.companyId;app.learning=async passed=>{const assignment=id(),state={courses:[{id:courseId,companyId:app.companyId,status:'published',versions:[{version:1,title:'Food safety basics'}]},{id:archivedCourse,companyId:app.companyId,status:'archived',versions:[{version:1,title:'Old course'}]}],assignments:[{id:assignment,companyId:app.companyId,courseId,courseVersion:1}],progress:passed?[{id:id(),assignmentId:assignment,companyId:app.companyId,userId:app.staff.session.id,completedAt:'2026-10-20T01:00:00.000Z',passed:true}]:[]};await fs.writeFile(path.join(app.dir,'learning-centre.json'),JSON.stringify(state));};
 await app.learning(false);return app;}
test('training checklist steps are validated and course steps need a published course',()=>{
 const valid=training.normalizeSteps(steps(),courses);assert.equal(valid.find(s=>s.type==='course').required,true,'course steps are always required');assert.equal(valid.find(s=>s.type==='course').title,'Food safety basics','an empty course title uses the course name');assert.equal(valid.find(s=>s.type==='section').required,false);
 for(const change of [s=>s[1].type='signature',s=>s.at(-1).courseId=archivedCourse,s=>s[3].source='users',s=>s[3].options=['A','a'],s=>s[2].min=20,s=>s[1].id='bad',s=>s[2].id=s[1].id,s=>s[1].title='']){const list=steps();change(list);assert.throws(()=>training.normalizeSteps(list,courses));}
 assert.throws(()=>training.normalizeSteps([{id:id(),type:'section',title:'Only a section'}],courses),/at least one step/);assert.throws(()=>training.normalizeSteps([],courses));
 const extra=steps();extra[1].mediaKind='photo';extra[1].locationIds=['x'];assert.equal(Object.hasOwn(training.normalizeSteps(extra,courses)[1],'mediaKind'),false,'unknown builder fields are dropped');
});
test('training checklists are created, retried, edited with revisions and archived by training managers only',async t=>{
 const a=await setup(t),input={requestId:id(),title:'Grill station',description:'Complete with the trainer.',steps:steps()};
 assert.equal((await a.request(a.staff,base+'/templates','POST',input)).status,403);
 const created=await a.api(a.office,base+'/templates','POST',input);assert.equal(created.revision,1);assert.equal(created.courseCount,1);assert.equal(created.steps.find(s=>s.type==='course').courseTitle,'Food safety basics');
 assert.equal((await a.api(a.office,base+'/templates','POST',input)).id,created.id,'a retried create returns the same checklist');
 assert.equal((await a.request(a.office,base+'/templates','POST',{...input,title:'Changed'})).status,409,'a reused reference with different content is refused');
 const dash=await a.api(a.office,base);assert.deepEqual(dash.templates.map(t=>t.title),['Grill station']);assert.deepEqual(dash.courses.map(c=>c.title),['Food safety basics']);assert.deepEqual((await a.api(a.staff,base)).templates,[]);
 const edited=await a.api(a.office,base+'/templates/'+created.id,'PUT',{requestId:id(),revision:1,title:'Grill station v2',description:'',steps:created.steps.map(({courseTitle,courseAvailable,...s})=>s)});assert.equal(edited.revision,2);
 assert.equal((await a.request(a.office,base+'/templates/'+created.id,'PUT',{requestId:id(),revision:1,title:'Stale',description:'',steps:steps()})).status,409);
 assert.equal((await a.api(a.office,base+'/templates/'+created.id+'/archive','POST',{requestId:id(),revision:2})).status,'archived');assert.deepEqual((await a.api(a.office,base)).templates,[]);assert.equal((await a.request(a.office,base+'/templates/'+created.id)).status,404);
});
test('checklist sessions freeze their steps, save typed answers and complete only once the embedded course is passed',async t=>{
 const a=await setup(t),template=await a.api(a.office,base+'/templates','POST',{requestId:id(),title:'Grill station',description:'',steps:steps()});
 const session=await a.api(a.office,base,'POST',{requestId:id(),title:'Grill training',description:'',locationId:a.location,trainerId:a.trainer.session.id,userIds:[a.staff.session.id],date:'2026-10-21',time:'09:00',minutes:30,templateId:template.id});
 assert.equal(session.checklist,true);assert.equal(session.templateTitle,'Grill station');assert.equal(session.steps.length,6);
 assert.equal((await a.request(a.office,base,'POST',{requestId:id(),title:'Both',locationId:a.location,trainerId:a.trainer.session.id,userIds:[a.staff.session.id],date:'2026-10-21',time:'09:00',minutes:30,templateId:template.id,skills:['x']})).status,400);
 await a.api(a.office,base+'/templates/'+template.id,'PUT',{requestId:id(),revision:1,title:'Changed later',description:'',steps:[{id:id(),type:'check',title:'Different',required:true}]});
 assert.equal((await a.api(a.office,base+'/'+session.id)).steps.length,6,'editing the checklist never rewrites a scheduled session');
 const [,check,number,selection,,course]=session.steps,url=base+'/'+session.id+'/assess/'+a.staff.session.id,save=(revision,answers)=>a.request(a.trainer,url,'POST',{revision,requestId:id(),answers,notes:'Observed.'});
 for(const bad of [{[number.id]:20},{[selection.id]:'Oven'},{[course.id]:true},{[check.id]:'yes'},{[id()]:true}])assert.equal((await save(0,bad)).status,400,JSON.stringify(bad));
 assert.equal((await a.request(a.staff,base+'/'+session.id+'/assess/'+a.staff.session.id,'POST',{revision:0,requestId:id(),answers:{[check.id]:true}})).status,403,'staff cannot sign themselves off');
 const partial=(await save(0,{[check.id]:true,[number.id]:3.5,[selection.id]:'Grill'})).data,progress=partial.participants[0].progress;
 assert.equal(progress.completedAt,null,'the unpassed course keeps the sign-off open');assert.equal(progress.courses[course.id].passed,false);assert.equal(progress.done,2);assert.equal(progress.total,3);assert.equal(progress.status,'in-progress');
 await a.learning(true);const live=(await a.api(a.trainer,base+'/'+session.id)).participants[0].progress;assert.equal(live.courses[course.id].passed,true,'course passes show live');assert.equal(live.completedAt,null,'reads never sign off');
 const done=(await save(1,{[check.id]:true,[number.id]:3.5})).data.participants[0].progress;assert(done.completedAt);assert.equal(done.percent,100);
 await a.learning(false);assert.equal((await a.api(a.trainer,base+'/'+session.id)).participants[0].progress.courses[course.id].passed,true,'the pass recorded at sign-off stays with the record');
 assert.equal((await save(2,{[check.id]:true})).status,409,'completed sign-offs are permanent');
 const staffView=await a.api(a.staff,base+'/'+session.id);assert.deepEqual(staffView.participants.map(p=>p.userId),[a.staff.session.id]);
});
