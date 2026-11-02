// Learning for the rebuilt app: courses, immutable published versions,
// assignments and server-graded attempts.
//
// A learner never receives an answer key and never grades their own work. A
// published version is frozen; an assignment binds to it, and every attempt is
// scored against that frozen version. A failed attempt keeps its answers and
// its score on the server so the result is evidence, not a browser draft.
const crypto=require('node:crypto');
const permissions=require('./permissions');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max=20000)=>String(value??'').trim().slice(0,max);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

function createLearning({store,now=Date.now}){
 const stamp=()=>new Date(now()).toISOString();
 const manages=actor=>permissions.can(actor,'learning.manage');

 async function scope(actor,companyId,permission='learning.view'){
  permissions.requirePermission(actor,permission);
  return permissions.company(actor,companyId,await store.read('companies'));
 }

 function cleanCourse(input){
  const lessons=(Array.isArray(input?.lessons)?input.lessons:[]).map(lesson=>({
   id:text(lesson?.id,60)||crypto.randomUUID(),title:text(lesson?.title,140),body:text(lesson?.body,20000)
  })).filter(lesson=>lesson.title&&lesson.body);
  const questions=(Array.isArray(input?.questions)?input.questions:[]).map(question=>{
   const options=(Array.isArray(question?.options)?question.options:[]).map(option=>({
    id:text(option?.id,60)||crypto.randomUUID(),text:text(option?.text,300),correct:option?.correct===true
   })).filter(option=>option.text);
   return {id:text(question?.id,60)||crypto.randomUUID(),prompt:text(question?.prompt,600),options};
  }).filter(question=>question.prompt&&question.options.length>=2);
  for(const question of questions){
   if(question.options.filter(option=>option.correct).length!==1)fail('Each quiz question needs exactly one correct answer.');
  }
  return {lessons,questions};
 }

 async function saveCourse(actor,input){
  const company=await scope(actor,input?.companyId,'learning.manage');
  const title=text(input?.title,140);
  if(!title)fail('Give the course a title.');
  const {lessons,questions}=cleanCourse(input);
  if(!lessons.length)fail('Add at least one lesson.');
  const passPercent=Number(input?.passPercent??80);
  if(!Number.isInteger(passPercent)||passPercent<1||passPercent>100)fail('Choose a pass mark from 1% to 100%.');
  return store.change('courses',list=>{
   const existing=input?.courseId?list.find(course=>course.id===input.courseId&&course.companyId===company.id):null;
   if(input?.courseId&&!existing)fail('Course not found.',404);
   const at=stamp();
   if(existing){
    Object.assign(existing,{title,summary:text(input?.summary,600),lessons,questions,passPercent,updatedAt:at,revision:existing.revision+1});
    return existing;
   }
   const record={id:crypto.randomUUID(),companyId:company.id,title,summary:text(input?.summary,600),lessons,questions,
    passPercent,status:'draft',version:0,versions:[],published:null,authorId:actor.id,authorName:actor.name,createdAt:at,updatedAt:at,revision:1};
   list.push(record);
   return record;
  });
 }

 async function publishCourse(actor,courseId){
  const course=(await store.read('courses')).find(record=>record.id===courseId);
  if(!course)fail('Course not found.',404);
  await scope(actor,course.companyId,'learning.manage');
  if(!permissions.can(actor,'learning.publish'))throw permissions.deny('You do not have permission to publish courses.');
  if(!course.lessons.length)fail('Add a lesson before publishing.');
  return store.change('courses',list=>{
   const record=list.find(item=>item.id===courseId);
   const at=stamp();
   record.status='published';
   record.version=record.version+1;
   // Published versions are kept, because an assignment and every attempt on it
   // stay bound to the exact version they were made against.
   const snapshot={version:record.version,title:record.title,summary:record.summary,lessons:record.lessons,
    questions:record.questions,passPercent:record.passPercent,publishedAt:at,publishedByName:actor.name};
   record.versions=[...(record.versions||[]),snapshot];
   record.published=snapshot;
   record.updatedAt=at;
   return record;
  });
 }

 function learnerCourse(record,published=record.published){
  return {
   id:record.id,companyId:record.companyId,title:published.title,summary:published.summary,version:published.version,
   passPercent:published.passPercent,publishedAt:published.publishedAt,
   lessons:published.lessons.map(lesson=>({id:lesson.id,title:lesson.title,body:lesson.body})),
   // Option IDs and text only: the correct flags never leave the server.
   questions:published.questions.map(question=>({id:question.id,prompt:question.prompt,
    options:question.options.map(option=>({id:option.id,text:option.text}))}))
  };
 }

 async function courses(actor,companyId){
  const company=await scope(actor,companyId);
  const list=(await store.read('courses')).filter(course=>course.companyId===company.id);
  if(manages(actor))return list;
  return list.filter(course=>course.status==='published').map(learnerCourse);
 }

 async function course(actor,courseId){
  const record=(await store.read('courses')).find(item=>item.id===courseId);
  if(!record)fail('Course not found.',404);
  await scope(actor,record.companyId);
  if(manages(actor))return record;
  if(record.status!=='published')throw permissions.deny('Course not found.',404);
  return learnerCourse(record);
 }

 async function assign(actor,input){
  const record=(await store.read('courses')).find(item=>item.id===input?.courseId);
  if(!record)fail('Course not found.',404);
  const company=await scope(actor,record.companyId,'learning.assign');
  if(record.status!=='published'||!record.published)fail('Publish the course before assigning it.',409);
  const accounts=await store.read('accounts');
  const accountIds=[...new Set((Array.isArray(input?.accountIds)?input.accountIds:[]).filter(id=>accounts.some(account=>account.id===id&&permissions.companyIds(account).includes(company.id))))];
  if(!accountIds.length)fail('Choose at least one learner in this company.');
  const dueDate=input?.dueDate?String(input.dueDate):null;
  if(dueDate&&!validDate(dueDate))fail('Choose a valid due date.');
  const records=accountIds.map(accountId=>({
   id:crypto.randomUUID(),companyId:company.id,courseId:record.id,courseVersion:record.published.version,
   courseTitle:record.published.title,accountId,dueDate,assignedById:actor.id,assignedByName:actor.name,assignedAt:stamp(),active:true
  }));
  await store.change('assignments',list=>{list.push(...records);});
  return records;
 }

 // The learner's own view. `lastAttempt` carries the retained answers and score
 // of a failed attempt so a retake starts from what they actually submitted.
 async function myLearning(actor){
  const assignments=(await store.read('assignments')).filter(assignment=>assignment.accountId===actor.id&&assignment.active);
  const attempts=await store.read('attempts');
  return assignments.map(assignment=>{
   const own=attempts.filter(attempt=>attempt.assignmentId===assignment.id&&attempt.accountId===actor.id)
    .sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
   const passed=own.find(attempt=>attempt.status==='passed')||null;
   return {...assignment,status:passed?'passed':own[0]?.status==='failed'?'failed':'assigned',lastAttempt:own[0]||null,attempts:own.length};
  }).sort((a,b)=>String(a.dueDate||'9999').localeCompare(String(b.dueDate||'9999')));
 }

 async function startAttempt(actor,assignmentId){
  permissions.requirePermission(actor,'learning.complete');
  const assignment=(await store.read('assignments')).find(item=>item.id===assignmentId&&item.accountId===actor.id&&item.active);
  if(!assignment)fail('Assignment not found.',404);
  const courseRecord=(await store.read('courses')).find(item=>item.id===assignment.courseId);
  const bound=courseRecord?.versions?.find(version=>version.version===assignment.courseVersion)||null;
  if(!bound)fail('This assignment is bound to a course version that is no longer available.',409);
  const attempts=await store.read('attempts');
  if(attempts.some(attempt=>attempt.assignmentId===assignment.id&&attempt.accountId===actor.id&&attempt.status==='passed'))fail('You have already passed this course.',409);
  const open=attempts.find(attempt=>attempt.assignmentId===assignment.id&&attempt.accountId===actor.id&&attempt.status==='open');
  if(open)return {attempt:open,course:learnerCourse(courseRecord,bound)};
  const attempt={id:crypto.randomUUID(),companyId:assignment.companyId,courseId:assignment.courseId,
   courseVersion:assignment.courseVersion,assignmentId:assignment.id,accountId:actor.id,status:'open',
   answers:{},score:null,passPercent:bound.passPercent,startedAt:stamp(),submittedAt:null,updatedAt:stamp()};
  await store.change('attempts',list=>{list.push(attempt);});
  return {attempt,course:learnerCourse(courseRecord,bound)};
 }

 async function submitAttempt(actor,input){
  permissions.requirePermission(actor,'learning.complete');
  const attempt=(await store.read('attempts')).find(item=>item.id===input?.attemptId&&item.accountId===actor.id);
  if(!attempt)fail('Attempt not found.',404);
  if(attempt.status==='passed')fail('This attempt is already complete.',409);
  const courseRecord=(await store.read('courses')).find(item=>item.id===attempt.courseId);
  const bound=courseRecord?.versions?.find(version=>version.version===attempt.courseVersion)||null;
  if(!bound)fail('The course version for this attempt is no longer available.',409);
  const questions=bound.questions;
  const submitted=input?.answers&&typeof input.answers==='object'?input.answers:{};
  const answers={},graded=[];
  for(const question of questions){
   const chosen=String(submitted[question.id]||'');
   const correct=question.options.find(option=>option.correct);
   const picked=question.options.find(option=>option.id===chosen)||null;
   if(chosen&&!picked)fail('An answer does not belong to this question. Reload and try again.');
   answers[question.id]=chosen;
   graded.push({questionId:question.id,chosen,correct:Boolean(picked&&correct&&picked.id===correct.id)});
  }
  if(!questions.length)fail('This course has no quiz to submit.');
  const score=Math.round(graded.filter(row=>row.correct).length/questions.length*100);
  const passed=score>=bound.passPercent;
  const at=stamp();
  return store.change('attempts',list=>{
   const record=list.find(item=>item.id===attempt.id);
   // A failed attempt keeps exactly what was submitted: answers and score.
   Object.assign(record,{answers,status:passed?'passed':'failed',score,graded,submittedAt:at,updatedAt:at});
   return {attempt:record,passed,score,passPercent:bound.passPercent};
  });
 }

 async function progress(actor,companyId){
  const company=await scope(actor,companyId,'learning.report');
  const [assignments,attempts,coursesList,accounts]=await Promise.all([store.read('assignments'),store.read('attempts'),store.read('courses'),store.read('accounts')]);
  const scoped=assignments.filter(assignment=>assignment.companyId===company.id);
  const rows=scoped.map(assignment=>{
   const own=attempts.filter(attempt=>attempt.assignmentId===assignment.id).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
   const passed=own.find(attempt=>attempt.status==='passed')||null;
   return {
    assignmentId:assignment.id,accountId:assignment.accountId,
    name:accounts.find(account=>account.id===assignment.accountId)?.name||'',
    courseId:assignment.courseId,courseTitle:coursesList.find(course=>course.id===assignment.courseId)?.title||assignment.courseTitle,
    dueDate:assignment.dueDate,status:passed?'passed':own[0]?.status==='failed'?'failed':'assigned',
    score:own[0]?.score??null,attempts:own.length,completedAt:passed?.submittedAt||null
   };
  });
  return {
   rows,
   total:rows.length,
   passed:rows.filter(row=>row.status==='passed').length,
   failed:rows.filter(row=>row.status==='failed').length,
   outstanding:rows.filter(row=>row.status==='assigned').length
  };
 }

 return {saveCourse,publishCourse,courses,course,assign,myLearning,startAttempt,submitAttempt,progress};
}
module.exports={createLearning};
