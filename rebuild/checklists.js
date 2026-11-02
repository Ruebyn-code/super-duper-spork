// Checklists for the rebuilt app: a company template, its steps, and runs that
// record when each step was actually ticked.
//
// A run is started explicitly, step times are server-stamped (`now()`), and a
// completed run is immutable evidence. Reading a checklist never starts one, and
// a run cannot be completed with steps still unticked.
const crypto=require('node:crypto');
const access=require('./access');
const permissions=require('./permissions');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max=300)=>String(value??'').trim().slice(0,max);

function createChecklists({store,now=Date.now}){
 const stamp=()=>new Date(now()).toISOString();

 async function saveChecklist(actor,input){
  permissions.requirePermission(actor,'ops.manage');
  const company=permissions.company(actor,input?.companyId,await store.read('companies'));
  const title=text(input?.title,140);
  if(!title)fail('Give the checklist a title.');
  const steps=(Array.isArray(input?.steps)?input.steps:[]).map(step=>({id:crypto.randomUUID(),text:text(step?.text??step,300)})).filter(step=>step.text);
  if(!steps.length)fail('Add at least one checklist step.');
  const role=['user','franchisee','admin'].includes(input?.audienceRole)?input.audienceRole:'user';
  return store.change('checklists',list=>{
   const existing=input?.checklistId?list.find(item=>item.id===input.checklistId&&item.companyId===company.id):null;
   if(input?.checklistId&&!existing)fail('Checklist not found.',404);
   const at=stamp();
   if(existing){Object.assign(existing,{title,steps,audienceRole:role,active:input?.active!==false,updatedAt:at});return existing;}
   const record={id:crypto.randomUUID(),companyId:company.id,title,steps,audienceRole:role,active:true,createdAt:at,updatedAt:at,createdById:actor.id};
   list.push(record);
   return record;
  });
 }

 async function lists(actor,companyId){
  permissions.requirePermission(actor,'ops.view');
  const company=permissions.company(actor,companyId,await store.read('companies'));
  const list=(await store.read('checklists')).filter(checklist=>checklist.companyId===company.id&&checklist.active);
  return list.filter(checklist=>permissions.can(actor,'ops.manage')||checklist.audienceRole===actor.role);
 }

 async function startRun(actor,input){
  const checklist=(await store.read('checklists')).find(item=>item.id===input?.checklistId);
  if(!checklist||!checklist.active)fail('Checklist not found.',404);
  const {company,location}=await access.write({store,account:actor,permission:'ops.complete',companyId:checklist.companyId,locationId:input?.locationId});
  if(checklist.audienceRole!==actor.role&&!permissions.can(actor,'ops.manage'))throw permissions.deny('This checklist is not addressed to you.');
  const at=stamp();
  return store.change('checklistRuns',list=>{
   const record={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,checklistId:checklist.id,
    title:checklist.title,steps:checklist.steps.map(step=>({id:step.id,text:step.text})),accountId:actor.id,name:actor.name,
    completedSteps:[],startedAt:at,updatedAt:at,completedAt:null};
   list.push(record);
   return record;
  });
 }

 async function tick(actor,input){
  permissions.requirePermission(actor,'ops.complete');
  const run=(await store.read('checklistRuns')).find(item=>item.id===input?.runId);
  if(!run)fail('Checklist run not found.',404);
  await access.write({store,account:actor,permission:'ops.complete',companyId:run.companyId,locationId:run.locationId});
  if(run.accountId!==actor.id)fail('That run belongs to someone else.',403);
  if(run.completedAt)fail('That run is already complete.',409);
  const stepId=String(input?.stepId||'');
  if(!run.steps.some(step=>step.id===stepId))fail('That step is not part of this checklist.',404);
  const at=stamp();
  return store.change('checklistRuns',list=>{
   const record=list.find(item=>item.id===run.id);
   if(!record.completedSteps.some(step=>step.stepId===stepId))record.completedSteps.push({stepId,at});
   record.updatedAt=at;
   if(record.completedSteps.length===record.steps.length)record.completedAt=at;
   return record;
  });
 }

 async function runs(actor,input){
  permissions.requirePermission(actor,'ops.view');
  const all=(await store.read('checklistRuns')).filter(run=>run.companyId===input?.companyId);
  const allowed=permissions.can(actor,'ops.manage')?all:all.filter(run=>run.accountId===actor.id);
  return allowed.sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,50);
 }

 // Completion rates for Reporting: completed runs over started runs, per list.
 async function progress(actor,companyId){
  permissions.requirePermission(actor,'ops.view');
  const company=permissions.company(actor,companyId,await store.read('companies'));
  const [checklistList,runList]=await Promise.all([store.read('checklists'),store.read('checklistRuns')]);
  return checklistList.filter(checklist=>checklist.companyId===company.id).map(checklist=>{
   const own=runList.filter(run=>run.checklistId===checklist.id);
   const completed=own.filter(run=>run.completedAt).length;
   return {checklistId:checklist.id,title:checklist.title,started:own.length,completed,
    completionPct:own.length?Math.round(completed/own.length*10000)/100:null};
  });
 }

 return {saveChecklist,lists,startRun,tick,runs,progress};
}
module.exports={createChecklists};
