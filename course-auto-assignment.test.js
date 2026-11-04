// Automatic course assignment: in-store sessions assign their linked courses, and Learning centre rules cover staff who join later.
const{test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const{fixture,password}=require('./test-support/ai-assistance-fixture.cjs');
const id=()=>crypto.randomUUID(),base='/api/learning-centre';
async function setup(t){const a=await fixture();t.after(()=>a.close());await a.api(a.office,'/api/accounts','POST',{username:'Trainer',password,role:'user',locationId:a.location});a.trainer=await a.login('Trainer');
 const course=await a.api(a.office,base+'/courses','POST',{requestId:id(),title:'Food safety basics',description:'',category:'',minutes:5,passPercent:80,lessons:[{id:id(),title:'Read this',body:'Wash your hands.',required:true}],quiz:[]});await a.api(a.office,base+'/courses/'+course.id+'/publish','POST',{revision:course.revision});a.course=course;
 a.stored=async()=>JSON.parse(await fs.readFile(path.join(a.dir,'learning-centre.json'),'utf8')).assignments;return a;}
const checklist=a=>[{id:id(),type:'check',title:'Wash hands',required:true},{id:id(),type:'course',title:'',courseId:a.course.id,required:true}];
const session=(a,template,extra={})=>({requestId:id(),title:'Grill training',description:'',locationId:a.location,trainerId:a.trainer.session.id,userIds:[a.staff.session.id],date:'2026-10-28',time:'09:00',minutes:30,templateId:template.id,...extra});
test('in-store sessions can assign their linked courses once, skipping staff who already have them',async t=>{
 const a=await setup(t),template=await a.api(a.office,base+'/in-store/templates','POST',{requestId:id(),title:'Grill station',description:'',steps:checklist(a),assignCourses:true});assert.equal(template.assignCourses,true);
 const edited=await a.api(a.office,base+'/in-store/templates/'+template.id,'PUT',{requestId:id(),revision:template.revision,title:'Grill station',description:'Edited by an older client',steps:template.steps});assert.equal(edited.assignCourses,true,'older writers keep the setting');
 assert.equal((await a.request(a.office,base+'/in-store','POST',session(a,template,{assignCourses:'yes'}))).status,400);
 const plain=await a.api(a.office,base+'/in-store','POST',session(a,template));assert.equal(plain.courseAssignments,undefined,'sessions only assign when asked');assert.equal((await a.stored()).length,0);
 const input=session(a,template,{assignCourses:true}),first=await a.api(a.office,base+'/in-store','POST',input);assert.deepEqual(first.courseAssignments,{assigned:1,skipped:0,unavailable:0});
 const [assignment]=await a.stored();assert.deepEqual([assignment.courseId,assignment.userIds,assignment.locationIds,assignment.dueDate,assignment.required,assignment.source.sessionId],[a.course.id,[a.staff.session.id],[a.location],'2026-10-28',true,first.id]);
 assert.equal((await a.api(a.office,base+'/in-store','POST',input)).id,first.id);assert.equal((await a.stored()).length,1,'a retried create does not assign twice');
 const second=await a.api(a.office,base+'/in-store','POST',session(a,template,{assignCourses:true}));assert.deepEqual(second.courseAssignments,{assigned:0,skipped:1,unavailable:0},'staff who already have the course are skipped');
 const learner=await a.api(a.staff,base);assert(learner.myLearning.some(item=>item.id===assignment.id&&item.dueDate==='2026-10-28'),'the staff member sees the course in their learning');
 const listed=(await a.api(a.office,base+'/assignments')).assignments.find(item=>item.id===assignment.id);assert.equal(listed.source.sessionTitle,'Grill training');assert.equal(Object.hasOwn(listed.source,'sessionId'),false);
});
test('automatic assignments target locations and levels, need no current match and reach staff who join later',async t=>{
 const a=await setup(t),dash=await a.api(a.office,base),level=dash.roles.find(role=>!['user',a.office.session.role].includes(role.id));assert(level,'a second permission level exists');
 const rule={courseId:a.course.id,title:'',locationIds:[a.location],roleIds:[level.id],userIds:[],dueDate:null,required:true};
 assert.equal((await a.request(a.office,base+'/assignments','POST',{...rule,requestId:id()})).status,400,'ordinary assignments still need a current match');
 assert.equal((await a.request(a.office,base+'/assignments','POST',{...rule,automatic:true,userIds:[a.staff.session.id],roleIds:[],requestId:id()})).status,400,'automatic rules do not name staff');
 assert.equal((await a.request(a.office,base+'/assignments','POST',{...rule,automatic:true,dueDate:'2026-11-30',requestId:id()})).status,400,'automatic rules have no fixed due date');
 assert.equal((await a.request(a.staff,base+'/assignments','POST',{...rule,automatic:true,requestId:id()})).status,403);
 const created=await a.api(a.office,base+'/assignments','POST',{...rule,automatic:true,requestId:id()});assert.equal(created.automatic,true);
 await a.api(a.office,'/api/accounts','POST',{username:'Newbie',password,role:level.id,locationId:a.location});const newbie=await a.login('Newbie');
 const seen=await a.request(newbie,base);assert.equal(seen.status,200);assert(seen.data.myLearning.some(item=>item.id===created.id),'a new staff member at the location and level gets the course');
 const listed=(await a.api(a.office,base+'/assignments')).assignments.find(item=>item.id===created.id);assert.equal(listed.automatic,true);assert.equal(listed.learners,1);
});
