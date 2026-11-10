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
test('training-only steps validate their settings and only sign off when each step passes',async t=>{
 const trainingSteps=()=>[{id:id(),type:'competency',title:'Grill safety',required:true},{id:id(),type:'attempts',title:'Assemble a burger',required:true,target:3},{id:id(),type:'question',title:'What temperature must chicken reach?',required:true,expectedAnswer:'75°C or above'},{id:id(),type:'timed',title:'Close the grill',required:true,targetSeconds:300},{id:id(),type:'acknowledgement',title:'I was shown the grill procedure',required:true}];
 assert.equal(training.normalizeSteps(trainingSteps(),courses).find(s=>s.type==='attempts').target,3);
 for(const change of [s=>s[1].target=0,s=>s[1].target=21,s=>s[2].expectedAnswer='',s=>s[3].targetSeconds=2,s=>s[3].targetSeconds=1.5]){const list=trainingSteps();change(list);assert.throws(()=>training.normalizeSteps(list,courses),JSON.stringify(list));}
 const a=await setup(t),template=await a.api(a.office,base+'/templates','POST',{requestId:id(),title:'Grill competency',description:'',steps:trainingSteps()});
 const session=await a.api(a.office,base,'POST',{requestId:id(),title:'Grill competency',description:'',locationId:a.location,trainerId:a.trainer.session.id,userIds:[a.staff.session.id],date:'2026-10-21',time:'09:00',minutes:30,templateId:template.id});
 const [competency,attempts,question,timed,confirm]=session.steps,url=base+'/'+session.id+'/assess/'+a.staff.session.id,name=a.staff.session.username,save=(revision,answers)=>a.request(a.trainer,url,'POST',{revision,requestId:id(),answers});
 assert.equal(question.expectedAnswer,'75°C or above','trainers see the expected answer');assert.equal((await a.api(a.staff,base+'/'+session.id)).steps.find(s=>s.type==='question').expectedAnswer,undefined,'staff never receive the expected answer');
 for(const bad of [{[competency.id]:'expert'},{[attempts.id]:-1},{[attempts.id]:2.5},{[question.id]:'maybe'},{[timed.id]:'2:00'},{[confirm.id]:5}])assert.equal((await save(0,bad)).status,400,JSON.stringify(bad));
 // Every step answered but not yet passing keeps the sign-off open.
 let result=(await save(0,{[competency.id]:'developing',[attempts.id]:2,[question.id]:'incorrect',[timed.id]:301,[confirm.id]:'Someone else'})).data.participants[0].progress;
 assert.equal(result.completedAt,null);assert.equal(result.done,0);assert.equal(result.total,5);
 result=(await save(1,{[competency.id]:'competent',[attempts.id]:3,[question.id]:'correct',[timed.id]:300,[confirm.id]:'  '+name.toUpperCase()+' '})).data.participants[0].progress;
 assert(result.completedAt,'all training steps passing signs the staff member off');assert.equal(result.done,5);assert.equal(result.answers[confirm.id],name.toUpperCase(),'the typed confirmation is kept as entered (trimmed)');
});
test('training checklist logic validates rules, hides steps and requires pass checks before sign-off',async t=>{
 const rating={id:id(),type:'competency',title:'Grill technique',required:true},retrain={id:id(),type:'check',title:'Retrain on the grill',required:true,showWhen:{stepId:rating.id,operator:'fails'}},temp={id:id(),type:'number',title:'Patty temperature',required:true,format:'temperature',decimals:1,passRule:{min:72,max:null}},station={id:id(),type:'selection',title:'Station',source:'custom',options:['Grill','Fryer'],multiple:false,required:false,showWhen:{stepId:temp.id,operator:'gt',value:80}};
 const list=()=>structuredClone([rating,retrain,temp,station]);
 const valid=training.normalizeSteps(list(),courses);assert.deepEqual(valid[1].showWhen,{stepId:rating.id,operator:'fails'});assert.deepEqual(valid[2].passRule,{min:72,max:null});assert.deepEqual(valid[3].showWhen,{stepId:temp.id,operator:'gt',value:80});
 assert.deepEqual(training.normalizeSteps([{...rating},{...retrain,showWhen:{stepId:rating.id,operator:'is',value:'developing'}}],courses)[1].showWhen.value,'developing');
 for(const change of [s=>s[1].showWhen.stepId=s[3].id,s=>s[1].showWhen.operator='lt',s=>s[0].passRule={min:1},s=>s[2].failAction={note:true,photo:false},s=>s[2].passRule={min:null,max:null},s=>s[3].passRule={options:['Oven']},s=>s[1].showWhen={stepId:rating.id,operator:'is',value:'expert'},s=>s[0].showWhen={stepId:s[1].id,operator:'checked'}]){const steps=list();change(steps);assert.throws(()=>training.normalizeSteps(steps,courses),undefined,String(change));}
 const a=await setup(t),template=await a.api(a.office,base+'/templates','POST',{requestId:id(),title:'Grill logic',description:'',steps:list()});
 assert.deepEqual(template.steps[1].showWhen,{stepId:rating.id,operator:'fails'},'templates keep their logic');
 const session=await a.api(a.office,base,'POST',{requestId:id(),title:'Grill logic session',description:'',locationId:a.location,trainerId:a.trainer.session.id,userIds:[a.staff.session.id],date:'2026-10-21',time:'09:00',minutes:30,templateId:template.id});
 assert.deepEqual(session.steps[2].passRule,{min:72,max:null},'sessions freeze the logic');
 const url=base+'/'+session.id+'/assess/'+a.staff.session.id,save=async(revision,answers)=>(await a.api(a.trainer,url,'POST',{revision,requestId:id(),answers,notes:''})).participants[0].progress;
 let progress=await save(0,{[rating.id]:'competent',[temp.id]:65});
 assert.equal(progress.total,2,'the hidden retraining step is not required');assert.equal(progress.done,1,'a failing temperature does not count');assert.equal(progress.completedAt,null);
 progress=await save(1,{[rating.id]:'developing',[temp.id]:75});
 assert.equal(progress.total,3,'a failed rating shows the retraining step');assert.equal(progress.done,1);assert.equal(progress.completedAt,null);
 progress=await save(2,{[rating.id]:'developing',[temp.id]:75,[retrain.id]:true});
 assert.equal(progress.completedAt,null,'the failed competency still blocks sign-off');
 progress=await save(3,{[rating.id]:'competent',[temp.id]:75,[retrain.id]:true});
 assert.ok(progress.completedAt,'sign-off once every visible required step passes');assert.equal(progress.answers[retrain.id],true,'answers to steps that became hidden are kept');
});
test('training checklist settings are validated, kept on older saves, frozen into sessions and applied to sign-off',async t=>{
 assert.deepEqual(training.normalizeSettings({validMonths:12}),{minutes:30,requireNotes:false,validMonths:12,collapseDone:false});
 for(const bad of [{minutes:2},{minutes:500},{validMonths:5},{requireNotes:'yes'},{collapseDone:1},{other:true}])assert.throws(()=>training.normalizeSettings(bad),undefined,JSON.stringify(bad));
 assert.equal(training.validUntil('2026-01-31T03:00:00Z',1),'2026-02-28','short months clamp to their last day');assert.equal(training.validUntil('2026-11-30T14:30:00Z',12),'2027-12-01','dates follow Melbourne time');assert.equal(training.validUntil('2026-01-01T00:00:00Z',0),null);
 const a=await setup(t),check={id:id(),type:'check',title:'Clean the slicer',required:true},settings={minutes:45,requireNotes:true,validMonths:12,collapseDone:true};
 const created=await a.api(a.office,base+'/templates','POST',{requestId:id(),title:'Slicer',description:'',steps:[check],settings});assert.deepEqual(created.settings,settings);
 assert.deepEqual((await a.api(a.office,base)).templates[0].settings,settings,'the library lists settings for the session form');
 const kept=await a.api(a.office,base+'/templates/'+created.id,'PUT',{requestId:id(),revision:1,title:'Slicer',description:'',steps:[check]});assert.deepEqual(kept.settings,settings,'older writers that omit settings keep them');
 assert.deepEqual((await a.api(a.office,base+'/templates','POST',{requestId:id(),title:'Plain',description:'',steps:[{...check,id:id()}]})).settings,{minutes:30,requireNotes:false,validMonths:0,collapseDone:false});
 assert.equal((await a.request(a.office,base+'/templates','POST',{requestId:id(),title:'Bad',description:'',steps:[{...check,id:id()}],settings:{validMonths:7}})).status,400);
 const session=await a.api(a.office,base,'POST',{requestId:id(),title:'Slicer session',description:'',locationId:a.location,trainerId:a.trainer.session.id,userIds:[a.staff.session.id],date:'2026-10-21',time:'09:00',minutes:45,templateId:created.id});
 await a.api(a.office,base+'/templates/'+created.id,'PUT',{requestId:id(),revision:2,title:'Slicer',description:'',steps:[check],settings:{...settings,requireNotes:false}});
 assert.equal((await a.api(a.office,base+'/'+session.id)).settings.requireNotes,true,'sessions keep the settings they were created with');
 const url=base+'/'+session.id+'/assess/'+a.staff.session.id,save=async(revision,notes)=>(await a.api(a.trainer,url,'POST',{revision,requestId:id(),answers:{[check.id]:true},notes})).participants[0].progress;
 let progress=await save(0,'');assert.equal(progress.completedAt,null,'sign-off waits for assessment notes');
 progress=await save(1,'Confident and careful.');assert.ok(progress.completedAt);assert.equal(progress.validUntil,training.validUntil(progress.completedAt,12));assert.equal(progress.expired,false);
 const listed=(await a.api(a.office,base)).sessions.find(s=>s.id===session.id).participants[0];assert.equal(listed.validUntil,progress.validUntil);assert.equal(listed.expired,false);
});
