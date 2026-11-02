// Learning routes: my learning, course authoring, publishing, assignment and a
// single graded attempt.
const permissions=require('./permissions');
const views=require('./views-learning');
const {companyFor}=require('./routes-comms');

async function route(ctx){
 const {url,method,viewer,actor,services,html,redirect,readBody,assertCsrf,notice}=ctx;
 const path=url.pathname;
 if(!path.startsWith('/learning'))return false;
 permissions.requirePermission(actor,'learning.view');
 const companies=await services.store.read('companies');

 if(path==='/learning'&&method==='GET'){
  const company=await companyFor(actor,companies,url.searchParams.get('companyId'));
  if(!company)return redirect('/home');
  const [mine,courses]=await Promise.all([services.learning.myLearning(actor),services.learning.courses(actor,company.id)]);
  const progress=permissions.can(actor,'learning.report')?await services.learning.progress(actor,company.id):null;
  const checklists=permissions.can(actor,'ops.view')?await services.checklists.progress(actor,company.id):null;
  return html(200,views.learning({account:viewer,company,companies,mine,courses,progress,checklists,
   canManage:permissions.can(actor,'learning.manage'),notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/learning/course'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const passPercent=Number(form.passPercent||80);
  await services.learning.saveCourse(actor,{companyId:form.companyId,title:form.title,summary:form.summary,passPercent,
   lessons:[{title:form.lessonTitle,body:form.lessonBody}],
   questions:[{prompt:form.prompt,options:[{text:form.correct,correct:true},{text:form.wrong,correct:false}]}]});
  return redirect(`/learning?companyId=${encodeURIComponent(form.companyId)}&saved=course-saved`);
 }

 if(path==='/learning/publish'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const course=await services.learning.publishCourse(actor,form.courseId);
  return redirect(`/learning?companyId=${encodeURIComponent(course.companyId)}&saved=course-published`);
 }

 if(path==='/learning/assign'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const records=await services.learning.assign(actor,{courseId:form.courseId,accountIds:form.accountIds||[actor.id]});
  return redirect(`/learning?companyId=${encodeURIComponent(records[0].companyId)}&saved=assigned`);
 }

 if(path==='/learning/attempt'&&method==='GET'){
  const assignmentId=url.searchParams.get('assignmentId');
  const {attempt,course}=await services.learning.startAttempt(actor,assignmentId);
  return html(200,views.attempt({account:viewer,course,attempt,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/learning/attempt/submit'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const answers={};
  for(const [key,value] of Object.entries(form))if(key.startsWith('answer:'))answers[key.slice('answer:'.length)]=value;
  const result=await services.learning.submitAttempt(actor,{attemptId:form.attemptId,answers});
  if(result.passed)return redirect(`/learning?companyId=${encodeURIComponent(result.attempt.companyId)}&saved=attempt-passed`);
  // A failed attempt keeps its answers; the page shows the retained result.
  const assignment=(await services.learning.myLearning(actor)).find(item=>item.id===result.attempt.assignmentId);
  const course=(await services.learning.course(actor,result.attempt.courseId));
  return html(200,views.attempt({account:viewer,course,attempt:{...result.attempt,...(assignment?.lastAttempt||{})},
   error:`Scored ${result.score}%. You need ${result.passPercent}% — your answers are saved, and you can try again.`,notice:null}));
 }

 return false;
}
module.exports={route};
