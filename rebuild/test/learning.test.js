// Phase 6 gate tests (learning and checklists): a failed quiz keeps its answers
// and grade on the server, answer keys never reach a learner, and a checklist
// run only completes when every step was ticked.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createLearning}=require('../learning');
const {createChecklists}=require('../checklists');
const {seed}=require('../seed');
const permissions=require('../permissions');

const password='harbour-demo-passphrase';
const rejects=async(promise,status,message)=>assert.rejects(promise,error=>{
 assert.equal(error.status,status,`expected ${status}, got ${error.status}: ${error.message}`);
 if(message)assert.match(error.message,message);
 return true;
});

async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-learning-'));
 const store=createStore(dir);
 const data=await seed(store,{password});
 const learning=createLearning({store});
 const checklists=createChecklists({store});
 const actor=data.accounts.find(account=>account.email==='admin@harbour.test');
 const company=data.companies.find(entry=>entry.name==='Harbour Group');
 const street=data.locations.find(entry=>entry.name==='Harbour Street');
 const learner={id:'learner-1',name:'Ari Learner',email:'ari@harbour.test',role:'user',
  permissions:[...permissions.defaults.find(item=>item.id==='user').permissions],actionPermissions:{},
  companyIds:[company.id],locationIds:[street.id],version:'v1'};
 const other={id:'learner-2',name:'Sam Other',email:'sam@harbour.test',role:'user',
  permissions:[...permissions.defaults.find(item=>item.id==='user').permissions],actionPermissions:{},
  companyIds:[company.id],locationIds:[street.id],version:'v1'};
 await store.change('accounts',list=>{list.push(learner,other);});
 const course=await learning.saveCourse(actor,{companyId:company.id,title:'Allergen training',summary:'Required annually.',passPercent:80,
  lessons:[{title:'The nine allergens',body:'Milk, eggs, fish, crustacea, peanuts, tree nuts, soy, sesame, lupin.'}],
  questions:[
   {prompt:'Which is not a declared allergen?',options:[{text:'Sesame',correct:false},{text:'Rice',correct:true}]},
   {prompt:'How many allergens are declared?',options:[{text:'Nine',correct:true},{text:'Seven',correct:false}]}
  ]});
 return {dir,store,learning,checklists,actor,company,street,learner,other,course};
}

test('a published course keeps its answer key on the server',async()=>{
 const app=await fixture();
 await app.learning.publishCourse(app.actor,app.course.id);
 await app.learning.assign(app.actor,{companyId:app.company.id,courseId:app.course.id,accountIds:[app.learner.id],dueDate:'2026-12-31'});
 const mine=await app.learning.myLearning(app.learner);
 assert.equal(mine.length,1);
 const started=await app.learning.startAttempt(app.learner,mine[0].id);
 const serialised=JSON.stringify(started.course);
 assert.equal(serialised.includes('correct'),false,'the learner payload carries no answer key');
 assert.equal(started.course.questions[0].options.length,2);
});

test('a failed quiz keeps its answers and score on the server',async()=>{
 const app=await fixture();
 await app.learning.publishCourse(app.actor,app.course.id);
 await app.learning.assign(app.actor,{companyId:app.company.id,courseId:app.course.id,accountIds:[app.learner.id]});
 const assignment=(await app.learning.myLearning(app.learner))[0];
 const {attempt,course}=await app.learning.startAttempt(app.learner,assignment.id);
 const wrong={[course.questions[0].id]:course.questions[0].options[0].id,[course.questions[1].id]:course.questions[1].options[1].id};
 const result=await app.learning.submitAttempt(app.learner,{attemptId:attempt.id,answers:wrong});
 assert.equal(result.passed,false);
 assert.equal(result.score,0);

 const stored=(await app.store.read('attempts')).find(item=>item.id===attempt.id);
 assert.equal(stored.status,'failed');
 assert.deepEqual(stored.answers,wrong);
 assert.equal(stored.score,0);
 const mine=await app.learning.myLearning(app.learner);
 assert.equal(mine[0].status,'failed');
 assert.deepEqual(mine[0].lastAttempt.answers,wrong);

 // Correct answers pass, and a passed course cannot be retaken.
 const retake=await app.learning.startAttempt(app.learner,assignment.id);
 const right={[course.questions[0].id]:course.questions[0].options[1].id,[course.questions[1].id]:course.questions[1].options[0].id};
 const passed=await app.learning.submitAttempt(app.learner,{attemptId:retake.attempt.id,answers:right});
 assert.equal(passed.passed,true);
 assert.equal(passed.score,100);
 await rejects(app.learning.startAttempt(app.learner,assignment.id),409,/already passed/);
});

test('an assignment stays bound to the version it was made against',async()=>{
 const app=await fixture();
 await app.learning.publishCourse(app.actor,app.course.id);
 await app.learning.assign(app.actor,{companyId:app.company.id,courseId:app.course.id,accountIds:[app.learner.id]});
 const v2=await app.learning.saveCourse(app.actor,{courseId:app.course.id,companyId:app.company.id,title:'Allergen training',passPercent:80,
  lessons:[{title:'Updated lesson',body:'Second edition.'}],
  questions:[{prompt:'New question',options:[{text:'Yes',correct:true},{text:'No',correct:false}]}]});
 await app.learning.publishCourse(app.actor,v2.id);
 const assignment=(await app.learning.myLearning(app.learner))[0];
 const started=await app.learning.startAttempt(app.learner,assignment.id);
 assert.equal(started.course.lessons[0].title,'The nine allergens');
 assert.equal(started.attempt.courseVersion,1);
});

test('checklist runs record server-timed steps and complete only when every step is ticked',async()=>{
 const app=await fixture();
 const checklist=await app.checklists.saveChecklist(app.actor,{companyId:app.company.id,title:'Open the store',steps:[{text:'Unlock the front door'},{text:'Check the fridges'}]});
 const run=await app.checklists.startRun(app.learner,{checklistId:checklist.id,locationId:app.street.id});
 assert.equal(run.completedAt,null);
 await app.checklists.tick(app.learner,{runId:run.id,stepId:checklist.steps[0].id});
 const partial=(await app.store.read('checklistRuns')).find(item=>item.id===run.id);
 assert.equal(partial.completedSteps.length,1);
 assert.equal(partial.completedAt,null);
 await rejects(app.checklists.tick(app.other,{runId:run.id,stepId:checklist.steps[1].id}),403,/belongs to someone else/);
 const done=await app.checklists.tick(app.learner,{runId:run.id,stepId:checklist.steps[1].id});
 assert.ok(done.completedAt);
});

test('course and checklist managers are separated from learners',async()=>{
 const app=await fixture();
 await rejects(app.learning.saveCourse(app.learner,{companyId:app.company.id,title:'Self taught',lessons:[{title:'x',body:'y'}]}),403,/permission/);
 await rejects(app.checklists.saveChecklist(app.learner,{companyId:app.company.id,title:'Mine',steps:['x']}),403,/permission/);
});
