// Optional checklist features (see docs/checklist-extras.md), each switched on or off per company:
// issue follow-ups, missed/failed alerts, manager reviews, number logs, roster assignment, QR stations, shift handover
// notes, starter templates and score trends. Reads come from the native checklist store's permission-checked run facts
// and never write; only the explicit actions below write, to the company's private checklist-extras file.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),model=require('./public/checklist-extras-model'),stepLogic=require('./public/ops-step-logic'),planner=require('./public/ops-planner-model');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
const monday=date=>shift(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));
const text=(value,max,label,required=false)=>{if(value===undefined||value===null)value='';if(typeof value!=='string'||value.length>max)fail(label+' may contain up to '+max+' characters.');value=value.trim();if(required&&!value)fail('Enter '+label.toLowerCase()+'.');return value;};
const companyOk=id=>/^[a-zA-Z0-9-]{1,100}$/.test(id||'');
const author=actor=>({id:actor.id,name:actor.username||actor.name||''});
function createStore(dir,{ops,people=async()=>[],shifts=async()=>[],now=Date.now}){
 const queues=new Map();
 const today=()=>planner.local(now()).slice(0,10);
 const file=companyId=>{if(!companyOk(companyId))fail('Select a company first.',403);return path.join(dir,'checklist-extras',companyId+'.json');};
 const blank=()=>({settings:{revision:0,features:{}},issues:{},reviews:{},handovers:{},roster:{},stations:[],scans:[]});
 async function read(companyId){try{return{...blank(),...JSON.parse(await fs.readFile(file(companyId),'utf8'))};}catch(error){if(error.code==='ENOENT')return blank();throw error;}}
 function mutate(companyId,change){const target=file(companyId),previous=queues.get(target)||Promise.resolve(),operation=previous.then(async()=>{const state=await read(companyId),result=await change(state);if(result.changed){const temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(state),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}}return result.value;});queues.set(target,operation.catch(()=>{}));return operation;}
 const need=(actor,key='ops.view')=>{if(!actor)fail('Sign-in required.',401);if(!can(actor,'ops.view')||!can(actor,key))fail('Your permission level does not allow this checklist action.',403);if(!companyOk(actor.companyId))fail('Select a company first.',403);};
 const features=async actor=>model.featureState((await read(actor.companyId)).settings.features);
 async function requireFeature(actor,id){const on=(await features(actor))[id];if(!on)fail('This checklist feature is switched off for your company.',403);}
 const names=async()=>new Map((await people()).map(person=>[person.id,person.username||person.name||'Someone']));

 // Settings: one switch per feature. Changing them needs checklist management and access to every location.
 async function settings(actor){need(actor);const state=await read(actor.companyId);return{revision:state.settings.revision||0,features:model.featureState(state.settings.features),canEdit:can(actor,'ops.manage')&&can(actor,'locations.all')};}
 async function saveSettings(actor,input){
  need(actor,'ops.manage');if(!can(actor,'locations.all'))fail('Access to every location is needed to change checklist features.',403);
  if(!Number.isSafeInteger(input?.revision))fail('Reload checklist features before saving.');
  if(!input.features||typeof input.features!=='object'||Array.isArray(input.features)||Object.entries(input.features).some(([key,value])=>!model.featureIds.includes(key)||typeof value!=='boolean'))fail('Choose valid checklist features.');
  return mutate(actor.companyId,state=>{const current=state.settings.revision||0;if(current!==input.revision)fail('Checklist features changed since you opened them. Reload to see the latest.',409);
   const next=model.featureState({...model.featureState(state.settings.features),...input.features});if(JSON.stringify(next)===JSON.stringify(model.featureState(state.settings.features)))return{changed:false,value:{revision:current,features:next,canEdit:true}};
   state.settings={revision:current+1,features:next,updatedAt:new Date(now()).toISOString(),updatedBy:author(actor)};return{changed:true,value:{revision:current+1,features:next,canEdit:true}};});
 }

 // 1. Issue follow-ups: failed checks on completed runs from the last 60 days, with saved owner/due/resolution.
 const issueId=(runId,stepId)=>runId+':'+stepId;
 function failures(run){if(run.status!=='completed')return[];const result=stepLogic.evaluate(run.steps,run.answers,run.actions);return result.fails.map(stepId=>{const step=run.steps.find(item=>item.id===stepId);return{id:issueId(run.id,stepId),runId:run.id,stepId,title:run.title,plannerId:run.plannerId,stepTitle:step?.title||'Checklist step',answer:model.answerText(step||{},run.answers[stepId],run.selectionLabels?.[stepId]),rule:step?stepLogic.ruleText(step):'',note:run.actions?.[stepId]?.note||'',locationId:run.locationId,locationName:run.locationName,workDate:run.workDate,completedAt:run.completedAt,completedBy:run.completedBy};});}
 async function issueList(actor,{status='open',locationId}={}){
  need(actor);await requireFeature(actor,'issues');if(!['open','resolved','all'].includes(status))fail('Choose open, resolved or all issues.');
  const [runs,state,directory]=await Promise.all([ops.runFacts(actor,{from:shift(today(),-60),locationId}),read(actor.companyId),names()]);
  // Equipment named on the checklist's QR station, so a failed check can be reported against it.
  const equipment=issue=>state.stations.find(item=>!item.deleted&&item.plannerId===issue.plannerId&&item.locationId===issue.locationId&&item.equipment)?.equipment||'';
  const items=runs.flatMap(failures).map(issue=>{const saved=state.issues[issue.id]||null;return{...issue,equipment:equipment(issue),status:saved?.status||'open',owner:saved?.ownerId?{id:saved.ownerId,name:directory.get(saved.ownerId)||'Former user'}:null,dueDate:saved?.dueDate||null,resolution:saved?.status==='resolved'?{note:saved.note,by:saved.resolvedBy,at:saved.resolvedAt}:null,revision:saved?.revision||0,overdue:(saved?.status||'open')==='open'&&Boolean(saved?.dueDate)&&saved.dueDate<today()};})
   .filter(item=>status==='all'||item.status===status).sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||(b.completedAt||'').localeCompare(a.completedAt||''));
  // Owners: active people with access to a location in this company.
  let owners=[];if(can(actor,'ops.manage')){const places=new Set((await ops.list(actor,{})).locations.map(place=>place.id));owners=(await people()).filter(person=>!person.invitation&&(person.id===actor.id||(person.locationIds||[person.locationId]).some(id=>places.has(id)))).map(person=>({id:person.id,name:person.username||'Someone'})).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,500);}
  return{today:today(),issues:items.slice(0,300),canEdit:can(actor,'ops.manage'),owners};
 }
 async function saveIssue(actor,runId,stepId,input){
  need(actor,'ops.manage');await requireFeature(actor,'issues');if(!uuid(runId)||!uuid(stepId))fail('Issue not found.',404);
  if(!Number.isSafeInteger(input?.revision))fail('Reload the issue before saving.');if(!['open','resolved'].includes(input.status))fail('Choose whether the issue is open or resolved.');
  if(input.dueDate!==null&&input.dueDate!==undefined&&!validDate(input.dueDate))fail('Choose a valid due date.');
  const note=text(input.note,1000,'A resolution note',input.status==='resolved');
  if(input.ownerId!==null&&input.ownerId!==undefined){const places=new Set((await ops.list(actor,{})).locations.map(place=>place.id)),person=(await people()).find(item=>item.id===input.ownerId);if(!person||person.invitation||person.id!==actor.id&&!(person.locationIds||[person.locationId]).some(id=>places.has(id)))fail('Choose someone in this company.');}
  const [run]=await ops.runFacts(actor,{ids:[runId]});if(!run||!failures(run).some(item=>item.stepId===stepId))fail('Issue not found.',404);
  return mutate(actor.companyId,state=>{const id=issueId(runId,stepId),saved=state.issues[id];if((saved?.revision||0)!==input.revision)fail('This issue changed since you opened it. Reload to see the latest.',409);
   const stamp=new Date(now()).toISOString(),next={ownerId:input.ownerId||null,dueDate:input.dueDate||null,status:input.status,note,revision:(saved?.revision||0)+1,updatedAt:stamp,updatedBy:author(actor),...(input.status==='resolved'?{resolvedAt:saved?.status==='resolved'?saved.resolvedAt:stamp,resolvedBy:saved?.status==='resolved'?saved.resolvedBy:author(actor).name}:{})};
   state.issues[id]=next;return{changed:true,value:{id,...next}};});
 }

 // 3. Manager review of completed checklists. Runs stay immutable; a redo request asks the completer to run it again.
 async function reviews(actor,ids){
  need(actor);if(!(await features(actor)).review)return{enabled:false,reviews:{}};
  if(!Array.isArray(ids)||ids.length>100||ids.some(id=>!uuid(id)))fail('Choose up to 100 checklists.');
  const [runs,state]=await Promise.all([ops.runFacts(actor,{ids}),read(actor.companyId)]),result={};
  for(const run of runs)if(state.reviews[run.id])result[run.id]=state.reviews[run.id];
  return{enabled:true,canReview:can(actor,'ops.manage'),reviews:result};
 }
 async function saveReview(actor,runId,input){
  need(actor,'ops.manage');await requireFeature(actor,'review');if(!uuid(runId))fail('Checklist not found.',404);
  if(!Number.isSafeInteger(input?.revision))fail('Reload the checklist before reviewing it.');if(!['approved','redo'].includes(input.status))fail('Choose Approve or Ask for a redo.');
  const comment=text(input.comment,1000,'A comment',input.status==='redo');
  const [run]=await ops.runFacts(actor,{ids:[runId]});if(!run)fail('Checklist not found.',404);if(run.status!=='completed')fail('Only completed checklists can be reviewed.');
  return mutate(actor.companyId,state=>{const saved=state.reviews[runId];if((saved?.revision||0)!==input.revision)fail('This review changed since you opened it. Reload to see the latest.',409);
   if(saved&&saved.status===input.status&&saved.comment===comment)return{changed:false,value:saved};
   const next={status:input.status,comment,by:author(actor),at:new Date(now()).toISOString(),revision:(saved?.revision||0)+1,completedById:run.completedById,title:run.title,locationId:run.locationId,workDate:run.workDate};
   state.reviews[runId]=next;return{changed:true,value:next};});
 }

 // 4. Number logs (temperatures and other readings) from completed runs, newest last.
 async function logs(actor,{templateId,stepId,days=30}={}){
  need(actor);await requireFeature(actor,'foodSafety');const span=Number(days);if(![7,14,30,60,90].includes(span))fail('Choose 7, 14, 30, 60 or 90 days.');
  const runs=(await ops.runFacts(actor,{from:shift(today(),-(span-1))})).filter(run=>run.status==='completed');
  const catalogue=new Map();for(const run of runs){const key=run.templateId||run.plannerId;const entry=catalogue.get(key)||{templateId:key,title:run.title,steps:new Map()};for(const step of run.steps)if(step.type==='number')entry.steps.set(step.id,{id:step.id,title:step.title,unit:step.unit||''});catalogue.set(key,entry);}
  const checklists=[...catalogue.values()].filter(entry=>entry.steps.size).map(entry=>({templateId:entry.templateId,title:entry.title,steps:[...entry.steps.values()]})).sort((a,b)=>a.title.localeCompare(b.title));
  if(!templateId)return{days:span,checklists,points:[]};
  const points=[];let rule=null,unit='';
  for(const run of runs.filter(run=>(run.templateId||run.plannerId)===templateId).sort((a,b)=>(a.completedAt||'').localeCompare(b.completedAt||''))){const step=run.steps.find(item=>item.id===stepId),value=run.answers[stepId];if(!step||typeof value!=='number')continue;rule=step.passRule||rule;unit=step.unit||unit;points.push({runId:run.id,date:run.workDate,at:run.stepActivity?.[stepId]?.completedAt||run.completedAt,value,passed:stepLogic.outcome?stepLogic.outcome(step,value)!=='fail':true,locationName:run.locationName,by:run.stepActivity?.[stepId]?.completedBy||run.completedBy});}
  return{days:span,checklists,points,rule:rule?{min:rule.min??null,max:rule.max??null}:null,unit};
 }
 // Print: one completed run with plain-language answers (the browser saves it as a PDF).
 async function printable(actor,runId){
  need(actor);await requireFeature(actor,'foodSafety');if(!uuid(runId))fail('Checklist not found.',404);
  const [run]=await ops.runFacts(actor,{ids:[runId]});if(!run)fail('Checklist not found.',404);
  const state=await read(actor.companyId),hidden=stepLogic.evaluate(run.steps,run.answers,run.actions).hidden;
  return{id:run.id,title:run.title,locationName:run.locationName,workDate:run.workDate,status:run.status,createdAt:run.createdAt,createdBy:run.createdBy,completedAt:run.completedAt,completedBy:run.completedBy,score:run.scoring?stepLogic.score(run.steps,run.answers):null,review:(await features(actor)).review?state.reviews[run.id]||null:null,
   steps:run.steps.filter(step=>!hidden.has(step.id)).map(step=>({id:step.id,type:step.type,title:step.title,answer:model.answerText(step,run.answers[step.id],run.selectionLabels?.[step.id]),assets:stepAssets(step,run.answers[step.id]),outcome:stepLogic.outcome?stepLogic.outcome(step,run.answers[step.id]):null,rule:stepLogic.ruleText(step),note:run.actions?.[step.id]?.note||'',staffNote:run.notes?.[step.id]?.note||'',at:run.stepActivity?.[step.id]?.completedAt||null,by:run.stepActivity?.[step.id]?.completedBy||''}))};
 }
 const stepAssets=(step,value)=>{try{return require('./public/ops-step-model').assetIds(step,value).map(id=>({id,url:'/api/ops-management/media/'+id}));}catch{return[];}};

 // 5. Roster assignment: who is rostered on for each checklist at the actor's location today.
 async function rosterView(actor,{date}={}){
  need(actor);if(!(await features(actor)).roster)return{enabled:false,modes:{},assigned:{}};
  const day=date&&validDate(date)?date:today(),state=await read(actor.companyId),list=await ops.list(actor,{date:day,location:actor.locationId,whole:'1'}),published=await shifts(actor,day),directory=await names();
  const instant=(time,base)=>Date.parse(planner.deadline(base,time));
  const ranges=published.map(item=>{const start=instant(item.start,item.date);let end=instant(item.end,item.date);if(!(end>start))end=instant(item.end,shift(item.date,1));return{...item,start,end};});
  const assigned={};
  for(const task of list.tasks){const mode=state.roster[task.plannerId]?.mode;if(!mode||mode==='off')continue;
   const opens=Date.parse(task.activeWindow?.opensAt||'')||instant('00:00',task.workDate||day),closes=Date.parse(task.activeWindow?.closesAt||'')||instant('00:00',shift(task.workDate||day,1));
   let people=ranges.filter(range=>range.start<closes&&range.end>opens);
   if(mode==='opening'&&people.length){const first=Math.min(...people.map(range=>range.start));people=people.filter(range=>range.start===first);}
   if(mode==='closing'&&people.length){const last=Math.max(...people.map(range=>range.end));people=people.filter(range=>range.end===last);}
   assigned[task.plannerId+':'+task.locationId]=[...new Map(people.map(range=>[range.userId,{id:range.userId,name:directory.get(range.userId)||'Rostered staff'}])).values()];}
  return{enabled:true,date:day,modes:Object.fromEntries(Object.entries(state.roster).map(([id,value])=>[id,value.mode])),assigned,canEdit:can(actor,'ops.manage')};
 }
 async function saveRoster(actor,plannerId,input){
  need(actor,'ops.manage');await requireFeature(actor,'roster');if(!uuid(plannerId))fail('Plan not found.',404);
  if(!model.rosterModes.some(mode=>mode.id===input?.mode))fail('Choose who the roster assigns.');
  const plans=(await ops.list(actor,{})).planners,plan=plans.find(item=>item.id===plannerId);if(!plan)fail('Plan not found.',404);if(!plan.canManage)fail('Access to every location in this plan is needed to change it.',403);
  return mutate(actor.companyId,state=>{if(state.roster[plannerId]?.mode===input.mode||!state.roster[plannerId]&&input.mode==='off')return{changed:false,value:{plannerId,mode:input.mode}};if(input.mode==='off')delete state.roster[plannerId];else state.roster[plannerId]={mode:input.mode,updatedAt:new Date(now()).toISOString(),updatedBy:author(actor)};return{changed:true,value:{plannerId,mode:input.mode}};});
 }

 // 6. QR stations: a printable code per plan and location. Scanning records who scanned and when.
 async function stations(actor){
  need(actor,'ops.manage');await requireFeature(actor,'qr');const [state,list]=await Promise.all([read(actor.companyId),ops.list(actor,{})]);
  const plans=new Map(list.planners.map(plan=>[plan.id,plan])),places=new Map(list.locations.map(place=>[place.id,place.name]));
  return{stations:state.stations.filter(item=>!item.deleted&&plans.has(item.plannerId)&&places.has(item.locationId)).map(item=>({id:item.id,name:item.name,plannerId:item.plannerId,planTitle:plans.get(item.plannerId).templateTitle||plans.get(item.plannerId).title,locationId:item.locationId,locationName:places.get(item.locationId),equipment:item.equipment||'',url:'/ops-management?scan='+item.token,createdAt:item.createdAt})),
   plans:list.planners.filter(plan=>plan.canManage).map(plan=>({id:plan.id,title:plan.templateTitle||plan.title,locationIds:plan.locationIds})),locations:list.locations.map(place=>({id:place.id,name:place.name}))};
 }
 async function saveStation(actor,input){
  need(actor,'ops.manage');await requireFeature(actor,'qr');if(!uuid(input?.requestId))fail('Refresh the page before adding a QR code.');
  const name=text(input.name,80,'A station name',true),equipment=text(input.equipment,120,'Equipment');
  const list=await ops.list(actor,{}),plan=list.planners.find(item=>item.id===input.plannerId);if(!plan||!plan.canManage)fail('Choose a plan you manage.',403);if(!plan.locationIds.includes(input.locationId))fail('Choose a location in this plan.');
  return mutate(actor.companyId,state=>{const existing=state.stations.find(item=>item.requestId===input.requestId);if(existing){if(existing.createdBy.id!==actor.id||existing.plannerId!==input.plannerId||existing.locationId!==input.locationId||existing.name!==name)fail('This QR code was already saved with different details.',409);return{changed:false,value:{id:existing.id}};}
   const record={id:crypto.randomUUID(),requestId:input.requestId,token:crypto.randomBytes(18).toString('base64url'),name,equipment,plannerId:input.plannerId,locationId:input.locationId,createdAt:new Date(now()).toISOString(),createdBy:author(actor)};state.stations.push(record);return{changed:true,value:{id:record.id}};});
 }
 async function removeStation(actor,id){
  need(actor,'ops.manage');await requireFeature(actor,'qr');if(!uuid(id))fail('QR code not found.',404);const list=await ops.list(actor,{});
  return mutate(actor.companyId,state=>{const record=state.stations.find(item=>item.id===id);if(!record)fail('QR code not found.',404);if(record.deleted)return{changed:false,value:{deleted:true}};const plan=list.planners.find(item=>item.id===record.plannerId);if(!plan?.canManage)fail('Access to every location in this plan is needed.',403);record.deleted=true;record.deletedAt=new Date(now()).toISOString();return{changed:true,value:{deleted:true}};});
 }
 async function qrSvg(actor,id,origin){
  const view=await stations(actor),station=view.stations.find(item=>item.id===id);if(!station)fail('QR code not found.',404);
  const code=require('qrcode-generator')(0,'M');code.addData(origin+station.url);code.make();return code.createSvgTag({cellSize:8,margin:4,scalable:true});
 }
 async function scan(actor,input){
  need(actor);await requireFeature(actor,'qr');if(typeof input?.token!=='string'||!/^[A-Za-z0-9_-]{20,40}$/.test(input.token))fail('This QR code is not recognised.',404);
  const state=await read(actor.companyId),station=state.stations.find(item=>item.token===input.token&&!item.deleted);if(!station)fail('This QR code is not recognised.',404);
  if(actor.kiosk&&station.locationId!==actor.locationId)fail('This QR code belongs to another location.',403);
  const list=await ops.list(actor,{});if(!list.locations.some(place=>place.id===station.locationId)||!list.planners.some(plan=>plan.id===station.plannerId))fail('You cannot open this checklist.',403);
  const at=new Date(now()).toISOString();
  await mutate(actor.companyId,state=>{state.scans.push({stationId:station.id,plannerId:station.plannerId,locationId:station.locationId,date:planner.local(Date.parse(at)).slice(0,10),userId:actor.id,name:author(actor).name,at});if(state.scans.length>5000)state.scans.splice(0,state.scans.length-5000);return{changed:true,value:null};});
  return{plannerId:station.plannerId,locationId:station.locationId,station:station.name,equipment:station.equipment||'',at};
 }
 async function scans(actor,runId){
  need(actor);if(!(await features(actor)).qr)return{scans:[]};if(!uuid(runId))fail('Checklist not found.',404);
  const [run]=await ops.runFacts(actor,{ids:[runId]});if(!run)fail('Checklist not found.',404);const state=await read(actor.companyId);
  return{scans:state.scans.filter(item=>item.plannerId===run.plannerId&&item.locationId===run.locationId&&item.date===run.workDate).slice(-20).map(item=>({name:item.name,at:item.at,station:state.stations.find(station=>station.id===item.stationId)?.name||'Station'}))};
 }

 // 7. Shift handover: the latest note for a checklist at a location, shown on the next run.
 const handoverKey=run=>(run.templateId||run.plannerId)+':'+run.locationId;
 async function handover(actor,runId){
  need(actor);if(!(await features(actor)).handover)return{enabled:false};if(!uuid(runId))fail('Checklist not found.',404);
  const [run]=await ops.runFacts(actor,{ids:[runId]});if(!run)fail('Checklist not found.',404);const state=await read(actor.companyId),saved=state.handovers[handoverKey(run)]||[];
  const mine=saved.find(item=>item.runId===run.id)||null,previous=saved.filter(item=>item.runId!==run.id&&item.at<=(run.completedAt||new Date(now()).toISOString())&&Date.parse(item.at)>=Date.parse(run.createdAt)-7*86400000).at(-1)||null;
  return{enabled:true,previous,mine,canWrite:can(actor,'ops.complete')&&run.status!=='upcoming'};
 }
 async function saveHandover(actor,runId,input){
  need(actor,'ops.complete');await requireFeature(actor,'handover');if(!uuid(runId))fail('Checklist not found.',404);
  const note=text(input?.note,500,'A handover note');const [run]=await ops.runFacts(actor,{ids:[runId]});if(!run)fail('Checklist not found.',404);
  if(actor.kiosk&&run.locationId!==actor.locationId)fail('This checklist belongs to another location.',403);
  return mutate(actor.companyId,state=>{const key=handoverKey(run),list=state.handovers[key]||(state.handovers[key]=[]),existing=list.find(item=>item.runId===run.id);
   if(existing&&existing.note===note)return{changed:false,value:existing};if(existing)list.splice(list.indexOf(existing),1);if(!note)return{changed:Boolean(existing),value:null};
   const record={runId:run.id,note,by:author(actor).name,at:new Date(now()).toISOString()};list.push(record);if(list.length>30)list.splice(0,list.length-30);return{changed:true,value:record};});
 }

 // 9. Score trends: each store's average checklist score per Monday–Sunday week.
 async function trends(actor,{weeks=8}={}){
  need(actor);await requireFeature(actor,'trends');const count=Number(weeks);if(![4,8,12,26].includes(count))fail('Choose 4, 8, 12 or 26 weeks.');
  const first=shift(monday(today()),-7*(count-1)),runs=(await ops.runFacts(actor,{from:first})).filter(run=>run.status==='completed'),starts=Array.from({length:count},(_,index)=>shift(first,7*index));
  const stores=new Map();
  for(const run of runs){const score=model.runScore(run);if(score===null)continue;const entry=stores.get(run.locationId)||{locationId:run.locationId,name:run.locationName,weeks:new Map()};const week=monday(run.workDate),cell=entry.weeks.get(week)||{total:0,runs:0};cell.total+=score;cell.runs++;entry.weeks.set(week,cell);stores.set(run.locationId,entry);}
  const recent=new Set(starts.slice(-4)),rows=[...stores.values()].map(entry=>{const weekly=starts.map(start=>{const cell=entry.weeks.get(start);return{weekStart:start,score:cell?Math.round(cell.total/cell.runs*10)/10:null,runs:cell?.runs||0};});const lastFour=weekly.filter(cell=>recent.has(cell.weekStart)&&cell.runs);const runsCounted=lastFour.reduce((sum,cell)=>sum+cell.runs,0);return{locationId:entry.locationId,name:entry.name,weeks:weekly,recentScore:runsCounted?Math.round(lastFour.reduce((sum,cell)=>sum+cell.score*cell.runs,0)/runsCounted*10)/10:null,recentRuns:runsCounted};})
   .sort((a,b)=>(b.recentScore??-1)-(a.recentScore??-1)||a.name.localeCompare(b.name));
  let rank=0;rows.forEach((row,index)=>{if(row.recentScore===null){row.rank=null;return;}rank=index&&rows[index-1].recentScore===row.recentScore?rank:index+1;row.rank=rank;});
  return{weeks:starts,stores:rows};
 }

 // 2. Alerts and personal notices for the notification bell (read-only).
 async function notices(actor){
  if(!actor?.companyId||!actor.locationId||!can(actor,'ops.view'))return[];
  const switches=await features(actor),items=[],day=today(),state=await read(actor.companyId);
  if(switches.alerts&&can(actor,'ops.manage')){
   const list=await ops.list(actor,{date:day,location:actor.locationId,whole:'1'});
   for(const task of list.tasks)if(task.window==='closed'&&!task.run&&task.type!=='on-demand')items.push({id:'checklist-missed:'+task.plannerId+':'+task.locationId+':'+task.periodKey,category:'checklist-alerts',title:'Checklist missed: '+task.title,detail:task.locationName||'',href:'/ops-management#checklists',priority:'high'});
   const runs=await ops.runFacts(actor,{from:day,to:day,locationId:actor.locationId});
   for(const issue of runs.flatMap(failures))if((state.issues[issue.id]?.status||'open')==='open')items.push({id:'checklist-failed:'+issue.id,category:'checklist-alerts',title:'Check failed: '+issue.stepTitle,detail:issue.title+(issue.answer?' · '+issue.answer:''),href:switches.issues?'/ops-management#issues':'/ops-management#history',at:issue.completedAt,priority:'high'});
  }
  if(switches.review)for(const [runId,review] of Object.entries(state.reviews))if(review.status==='redo'&&review.completedById===actor.id&&review.locationId===actor.locationId&&review.workDate>=shift(day,-7))items.push({id:'checklist-redo:'+runId+':'+review.revision,category:'checklist-alerts',title:'Redo requested: '+review.title,detail:review.comment.slice(0,140)+' · '+review.by.name,href:'/ops-management#history',at:review.at,priority:'high'});
  if(switches.issues&&can(actor,'ops.view'))for(const [id,issue] of Object.entries(state.issues))if(issue.status==='open'&&issue.ownerId===actor.id)items.push({id:'checklist-issue:'+id+':'+issue.revision,category:'checklist-alerts',title:'Issue assigned to you'+(issue.dueDate?' · due '+issue.dueDate:''),detail:'Open Issues to see the failed check.',href:'/ops-management#issues',at:issue.updatedAt,priority:issue.dueDate&&issue.dueDate<day?'high':'normal'});
  if(switches.roster&&Object.keys(state.roster).length){const view=await rosterView(actor,{date:day});const list=await ops.list(actor,{date:day,location:actor.locationId,whole:'1'});for(const task of list.tasks){const people=view.assigned[task.plannerId+':'+task.locationId]||[];if(people.some(person=>person.id===actor.id)&&!(task.run&&task.run.status==='completed'))items.push({id:'checklist-rostered:'+task.plannerId+':'+task.locationId+':'+task.periodKey,category:'checklists',title:'You’re on for: '+task.title,detail:'Rostered today'+(task.locationName?' · '+task.locationName:''),href:'/ops-management#checklists',priority:'normal'});}}
  return items;
 }
 return{settings,saveSettings,issueList,saveIssue,reviews,saveReview,logs,printable,rosterView,saveRoster,stations,saveStation,removeStation,qrSvg,scan,scans,handover,saveHandover,trends,notices};
}
async function route({req,res,url,params,session,store,body,json,origin}){
 if(!url.startsWith('/api/checklist-extras/'))return false;
 if(!session)fail('Sign-in required.',401);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 res.setHeader('Cache-Control','no-store');const path=url.slice('/api/checklist-extras/'.length);let match;
 if(path==='settings')return json(200,req.method==='PUT'?await store.saveSettings(session,await body(req,4000)):await store.settings(session)),true;
 if(path==='issues'&&req.method==='GET')return json(200,await store.issueList(session,{status:params.get('status')||'open'})),true;
 if((match=path.match(/^issues\/([a-f0-9-]{36})\/([a-f0-9-]{36})$/i))&&req.method==='PUT')return json(200,await store.saveIssue(session,match[1],match[2],await body(req,6000))),true;
 if(path==='reviews'&&req.method==='GET')return json(200,await store.reviews(session,(params.get('ids')||'').split(',').filter(Boolean))),true;
 if((match=path.match(/^reviews\/([a-f0-9-]{36})$/i))&&req.method==='PUT')return json(200,await store.saveReview(session,match[1],await body(req,6000))),true;
 if(path==='logs'&&req.method==='GET')return json(200,await store.logs(session,{templateId:params.get('templateId')||undefined,stepId:params.get('stepId')||undefined,days:params.get('days')||30})),true;
 if((match=path.match(/^print\/([a-f0-9-]{36})$/i))&&req.method==='GET')return json(200,await store.printable(session,match[1])),true;
 if(path==='roster'&&req.method==='GET')return json(200,await store.rosterView(session,{date:params.get('date')||undefined})),true;
 if((match=path.match(/^roster\/([a-f0-9-]{36})$/i))&&req.method==='PUT')return json(200,await store.saveRoster(session,match[1],await body(req,2000))),true;
 if(path==='stations'&&req.method==='GET')return json(200,await store.stations(session)),true;
 if(path==='stations'&&req.method==='POST')return json(201,await store.saveStation(session,await body(req,4000))),true;
 if((match=path.match(/^stations\/([a-f0-9-]{36})$/i))&&req.method==='DELETE')return json(200,await store.removeStation(session,match[1])),true;
 if((match=path.match(/^stations\/([a-f0-9-]{36})\/qr\.svg$/i))&&req.method==='GET'){const svg=await store.qrSvg(session,match[1],String(origin||'').replace(/\/$/,''));res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"});res.end(svg);return true;}
 if(path==='scan'&&req.method==='POST')return json(200,await store.scan(session,await body(req,2000))),true;
 if((match=path.match(/^scans\/([a-f0-9-]{36})$/i))&&req.method==='GET')return json(200,await store.scans(session,match[1])),true;
 if((match=path.match(/^handover\/([a-f0-9-]{36})$/i))){if(req.method==='GET')return json(200,await store.handover(session,match[1])),true;if(req.method==='PUT')return json(200,await store.saveHandover(session,match[1],await body(req,4000))),true;}
 if(path==='trends'&&req.method==='GET')return json(200,await store.trends(session,{weeks:params.get('weeks')||8})),true;
 fail('Checklist feature not found.',404);
}
module.exports={createStore,route};
