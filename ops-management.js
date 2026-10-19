const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),files=require('./communication-media');
const stepModel=require('./public/ops-step-model'),plannerModel=require('./public/ops-planner-model');
const queues=new Map(),types=[...Object.keys(stepModel.kinds),'yesno','choice','multiple','photo','date','time'];
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const text=(value,max,label,empty=false)=>{if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))fail('Enter '+label+'.');return value.trim();};
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('Choose a valid date.');return value;}
const shift=(day,offset)=>new Date(Date.parse(day+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
const monday=day=>shift(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7));
const period=plannerModel.period;
function normalize(input){
 const title=text(input.title,160,'a checklist name'),description=text(input.description??'',2000,'checklist instructions',true);
 if(!Array.isArray(input.locationIds)||!input.locationIds.length||input.locationIds.length>500||input.locationIds.some(id=>typeof id!=='string')||new Set(input.locationIds).size!==input.locationIds.length)fail('Choose at least one location.');
 if(typeof input.active!=='boolean')fail('Choose whether this checklist is active.');
 const s=input.schedule;
 if(!s||!['manual','once','daily','weekly'].includes(s.kind))fail('Choose a checklist schedule.');
 const startDate=date(s.startDate),endDate=s.endDate?date(s.endDate):null;
 if(endDate&&endDate<startDate)fail('The end date must follow the start date.');
 if(s.kind==='weekly'&&(!Number.isInteger(s.weekday)||s.weekday<1||s.weekday>7))fail('Choose the weekly due day.');
 if(!Array.isArray(input.steps)||!input.steps.length||input.steps.length>100)fail('Add between 1 and 100 steps.');
 const ids=new Set(),steps=input.steps.map(step=>{
  if(!step||!types.includes(step.type)||!uuid(step.id)||ids.has(step.id)||typeof step.required!=='boolean')fail('Choose valid, unique checklist steps.');
  ids.add(step.id);
  const result={id:step.id,type:step.type,title:text(step.title,200,'a step title'),help:text(step.help??'',2000,'step instructions',true),required:stepModel.responseStep(step)&&step.required};
  if(['choice','multiple'].includes(step.type)||step.type==='selection'&&(step.source||'custom')==='custom'){
   const minimum=step.type==='selection'?1:2;
   if(!Array.isArray(step.options)||step.options.length<minimum||step.options.length>100)fail('Add '+minimum+'–100 choices.');
   result.options=step.options.map(option=>text(option,120,'a choice'));
   if(new Set(result.options).size!==result.options.length)fail('Choices must be different.');
  }
  if(step.type==='selection'){
   result.source=step.source||'custom';result.multiple=step.multiple??false;
   if(!['users','locations','custom'].includes(result.source)||typeof result.multiple!=='boolean')fail('Choose a valid selection source.');
  }
  if(step.type==='number'){
   if(step.format!==undefined){
    if(!Object.hasOwn(stepModel.formats,step.format))fail('Choose a valid number format.');
    result.format=step.format;result.decimals=step.format==='integer'?0:step.decimals??2;
    if(!Number.isInteger(result.decimals)||result.decimals<0||result.decimals>6)fail('Choose between 0 and 6 decimal places.');
    if(step.format==='currency'){
     result.currency=step.currency||'AUD';
     if(typeof result.currency!=='string'||!Intl.supportedValuesOf('currency').includes(result.currency))fail('Choose a valid currency.');
    }
   }
   result.unit=text(step.unit??stepModel.units[step.format]?.[0]??'',40,'a unit',true);
   if(stepModel.units[step.format]&&!stepModel.units[step.format].includes(result.unit))fail('Choose a unit for this number format.');
   for(const key of ['min','max']){
    result[key]=step[key]===null||step[key]===undefined||step[key]===''?null:step[key];
    if(result[key]!==null&&!stepModel.validNumber({...result,min:null,max:null},result[key]))fail('Enter valid number limits matching the format.');
   }
   if(result.min!==null&&result.max!==null&&result.min>result.max)fail('The minimum must not exceed the maximum.');
  }
  if(['media','file'].includes(step.type)){
   result.maxFiles=step.maxFiles??1;
   if(!Number.isInteger(result.maxFiles)||result.maxFiles<1||result.maxFiles>10)fail('Allow between 1 and 10 files.');
   if(step.type==='media'){result.mediaKind=step.mediaKind||'both';if(!['both','photo','video'].includes(result.mediaKind))fail('Choose photos, videos or both.');}
  }
  if(step.type==='datetime'){result.dateMode=step.dateMode||'datetime';if(!['date','time','datetime'].includes(result.dateMode))fail('Choose a date and time format.');}
  if(step.type==='signature'&&step.signatureMode!==undefined){result.signatureMode=step.signatureMode;if(!['typed','drawn','either'].includes(result.signatureMode))fail('Choose a signature format.');}
  return result;
 });
 return{title,description,active:input.active,locationIds:[...input.locationIds],schedule:{kind:s.kind,startDate,endDate,weekday:s.kind==='weekly'?s.weekday:null},steps};
}
function normalizeContent(input){
 const value=normalize({...input,locationIds:['content'],active:true,schedule:{kind:'manual',startDate:'2026-01-01'}});
 return{title:value.title,description:value.description,steps:value.steps};
}
function normalizePlanner(input){
 const title=text(input.title,160,'a planner name'),instructions=text(input.instructions??'',2000,'planner instructions',true);
 if(!uuid(input.templateId))fail('Choose a checklist from Checklist builder.');
 if(!Array.isArray(input.locationIds)||!input.locationIds.length||input.locationIds.length>500||input.locationIds.some(id=>typeof id!=='string')||new Set(input.locationIds).size!==input.locationIds.length)fail('Choose at least one location.');
 if(typeof input.active!=='boolean')fail('Choose whether the planner is active.');
 const s=input.schedule,frequencies=['daily','weekly','fortnightly','monthly','yearly'];if(!s||![...frequencies,'manual','once','unscheduled'].includes(s.kind))fail('Choose a planner schedule.');
 const modern=input.type!==undefined,type=input.type||plannerModel.type(input);if(!['recurring','on-demand','once','unscheduled'].includes(type)||type==='recurring'&&!frequencies.includes(s.kind)||type==='on-demand'&&s.kind!=='manual'||type==='once'&&s.kind!=='once'||type==='unscheduled'&&s.kind!=='unscheduled')fail('Choose a valid checklist type and repeat frequency.');
 const startDate=date(s.startDate),endDate=s.endDate?date(s.endDate):null;if(endDate&&endDate<startDate)fail('The end date must follow the start date.');
 const anchor=s.kind==='weekly'?(s.anchor||'calendar'):null;if(anchor&&!['calendar','start'].includes(anchor))fail('Choose a valid weekly start format.');
 const weekday=s.kind==='weekly'&&anchor==='calendar'?(s.weekday??7):null;if(weekday!==null&&(!Number.isInteger(weekday)||weekday<1||weekday>7))fail('Choose the weekly due day.');
 const days=s.kind==='daily'?(s.days??[1,2,3,4,5,6,7]):null;if(days&&(!Array.isArray(days)||!days.length||days.some(day=>!Number.isInteger(day)||day<1||day>7)||new Set(days).size!==days.length))fail('Choose at least one valid repeat day.');
 function time(key){const value=input[key]===undefined||input[key]===null||input[key]===''?null:input[key];if(value!==null&&(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)))fail('Choose valid start, due and active times.');return value;}
 const dueTime=time('dueTime'),startTime=time('startTime'),activeFrom=time('activeFrom'),activeUntil=time('activeUntil');
 if(activeUntil&&activeUntil===(activeFrom||startTime||'00:00'))fail('The active opening and closing times must be different. Leave them blank for all-day access.');
 const reminderMinutes=input.reminderMinutes??0;if(!Number.isInteger(reminderMinutes)||reminderMinutes<0||reminderMinutes>1440||reminderMinutes&&!dueTime)fail('Choose a due time and a reminder of up to 24 hours.');
 if(!modern&&s.kind==='manual'&&(dueTime||reminderMinutes))fail('Manual planners do not have a due time or reminder.');
 const dueAfterDays=input.dueAfterDays??(modern?0:undefined),maxDays={daily:1,weekly:7,fortnightly:14,monthly:31,yearly:366,manual:1,once:366,unscheduled:366}[s.kind];if(dueAfterDays!==undefined&&(!Number.isInteger(dueAfterDays)||dueAfterDays<0||dueAfterDays>maxDays))fail('Choose a due day within this checklist format.');
 if(startTime&&dueTime&&dueAfterDays===0&&dueTime<startTime)fail('Choose a later due time or a later due day.');
 const roleIds=input.roleIds??null;if(roleIds!==null&&(!Array.isArray(roleIds)||!roleIds.length||roleIds.length>100||roleIds.some(id=>typeof id!=='string'||!id||id.length>80)||new Set(roleIds).size!==roleIds.length))fail('Choose at least one permission level or allow all permission levels.');
 const priority=input.priority||'normal';if(!['normal','high','urgent'].includes(priority))fail('Choose a valid priority.');
 const frequency=s.frequency??(frequencies.includes(s.kind)?s.kind:'daily');if(!frequencies.includes(frequency))fail('Choose a valid repeat frequency.');
 return{title,templateId:input.templateId,locationIds:[...input.locationIds],active:input.active,...(modern?{type}:{}),schedule:{kind:s.kind,startDate,endDate,weekday,...(anchor?{anchor}:{}),...(modern?{frequency}:{}),...(days?{days:[...days].sort()}: {})},dueTime,startTime,activeFrom,activeUntil,roleIds:roleIds===null?null:[...roleIds],...(dueAfterDays===undefined?{}:{dueAfterDays}),reminderMinutes,priority,instructions};
}
function upgrade(state){
 state.planners||=[];
 if(!state.plannersVersion){for(const item of state.templates)if(item.locationIds?.length&&!state.planners.some(plan=>plan.id===item.id))state.planners.push({id:item.id,legacy:true,templateId:item.id,title:item.title,companyId:item.companyId,locationIds:[...item.locationIds],active:item.active,schedule:structuredClone(item.schedule),dueTime:null,reminderMinutes:0,priority:'normal',instructions:'',revision:1,requestId:'migrated:'+item.id,createdAt:item.createdAt,createdById:item.createdById,createdBy:item.createdBy,updatedAt:item.updatedAt,updatedBy:item.updatedBy});state.plannersVersion=1;}
 return state;
}
function createStore(dir,{locations,people=async()=>[],roleLevels=async()=>require('./permissions').defaults,now=Date.now}={}){
 const file=path.join(dir,'ops-management.json'),media=files.createStore(path.join(dir,'ops-management')),stamp=()=>new Date(now()).toISOString(),today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now()));
 async function read(){try{return upgrade(JSON.parse(await fs.readFile(file,'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;return{templates:[],planners:[],plannersVersion:1,runs:[],assets:[]};}}
 function mutate(change){const task=(queues.get(file)||Promise.resolve()).then(async()=>{const state=await read(),result=await change(state);await fs.mkdir(dir,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(state),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result;});queues.set(file,task.catch(()=>{}));return task;}
 function need(actor,key='ops.view'){if(!can(actor,'ops.view')||!can(actor,key))fail('Your permission level does not allow this checklist action.',403);}
 async function access(actor){need(actor);return(await locations(actor)).filter(item=>(item.companyId||'default')===actor.companyId);}
 const company=(item,actor)=>item.companyId===actor.companyId;
 const audience=(plan,actor)=>!Array.isArray(plan?.roleIds)||plan.roleIds.includes(actor.role);
 const allowed=(run,actor,stores,state)=>company(run,actor)&&stores.some(item=>item.id===run.locationId)&&audience(state.planners.find(plan=>plan.id===(run.plannerId||run.templateId)&&company(plan,actor))||run.snapshot.planner,actor);
 const levelOptions=async actor=>(await roleLevels(actor)).map(role=>({id:role.id,name:role.name,canView:(role.permissions||[]).includes('ops.view')}));
 const assignments=(state,template)=>[...new Set(state.planners.filter(plan=>plan.templateId===template.id&&plan.companyId===template.companyId).flatMap(plan=>plan.locationIds))];
 const editable=(template,actor,stores,state)=>can(actor,'ops.manage')&&company(template,actor)&&assignments(state,template).every(id=>stores.some(item=>item.id===id));
 const visibleTemplate=(state,item,actor,stores)=>company(item,actor)&&(can(actor,'ops.manage')&&(!assignments(state,item).length||assignments(state,item).some(id=>stores.some(store=>store.id===id)))||state.planners.some(plan=>plan.templateId===item.id&&company(plan,actor)&&audience(plan,actor)&&plan.locationIds.some(id=>stores.some(store=>store.id===id))));
 const editablePlan=(plan,actor,stores)=>can(actor,'ops.manage')&&company(plan,actor)&&plan.locationIds.every(id=>stores.some(store=>store.id===id));
 const runPlanner=run=>run.plannerId||run.templateId;
 function findRun(state,actor,stores,id){const run=state.runs.find(item=>item.id===id&&allowed(item,actor,stores,state));if(!run)fail('Checklist record not found.',404);return run;}
 async function selectionOptions(actor,stores,run){
  const options={};let directory;
  for(const step of run.snapshot.steps.filter(step=>step.type==='selection')){
   if(step.source==='users'){
    directory||=await people();
    options[step.id]=directory.filter(person=>!person.invitation&&(person.locationIds||[person.locationId]).includes(run.locationId)).map(person=>({value:person.id,label:person.username}));
   }else if(step.source==='locations')options[step.id]=stores.map(store=>({value:store.id,label:store.name}));
   else options[step.id]=(step.options||[]).map(value=>({value,label:value}));
  }
  return options;
 }
 async function presentRun(state,actor,stores,run){
  const attached=new Set(run.snapshot.steps.flatMap(step=>stepModel.assetIds(step,run.answers[step.id]))),resources={};
  for(const asset of state.assets.filter(asset=>asset.runId===run.id&&(run.status==='draft'||attached.has(asset.id)))){
   const record=asset.name?asset:await media.info(asset.id);
   resources[asset.id]={id:asset.id,name:record.name,mime:record.mime,size:record.size,url:'/api/ops-management/media/'+asset.id};
  }
  return{...structuredClone(run),selectionOptions:await selectionOptions(actor,stores,run),resources};
 }
 const summary=run=>{const{answers,snapshot,requestId,...result}=run;return{...result,title:snapshot.title,stepCount:snapshot.steps.filter(stepModel.responseStep).length,answered:snapshot.steps.filter(step=>stepModel.responseStep(step)&&answers[step.id]!==undefined&&answers[step.id]!==''&&answers[step.id]!==null&&answers[step.id]!==false&&(!Array.isArray(answers[step.id])||answers[step.id].length)).length};};
 async function list(actor,params={}){
  const stores=await access(actor),state=await read(),day=date(params.date||today());if(day>today())fail('Choose today or an earlier date.');const location=params.location||'all';if(location!=='all'&&!stores.some(item=>item.id===location))fail('Location access required.',403);const query=text(params.q||'',180,'a search',true).toLowerCase(),selected=stores.filter(item=>location==='all'||item.id===location);
  const templates=state.templates.filter(item=>visibleTemplate(state,item,actor,stores)).map(item=>({...item,locationIds:assignments(state,item).filter(id=>stores.some(store=>store.id===id)),locationCount:assignments(state,item).length,plannerCount:state.planners.filter(plan=>plan.templateId===item.id&&company(plan,actor)&&plan.locationIds.some(id=>stores.some(store=>store.id===id))).length,canManage:editable(item,actor,stores,state)}));
  const planners=state.planners.filter(plan=>company(plan,actor)&&(can(actor,'ops.manage')||audience(plan,actor))&&plan.locationIds.some(id=>stores.some(store=>store.id===id))).map(plan=>({...plan,templateTitle:state.templates.find(item=>item.id===plan.templateId&&company(item,actor))?.title||'',locationCount:plan.locationIds.length,locationIds:plan.locationIds.filter(id=>stores.some(store=>store.id===id)),canManage:editablePlan(plan,actor,stores)}));
  const tasks=[];for(const plan of planners){const template=state.templates.find(item=>item.id===plan.templateId&&company(item,actor));if(!template||!audience(plan,actor)||query&&!(template.title+' '+plan.title).toLowerCase().includes(query))continue;const slot=plannerModel.occurrence(plan,day,now());if(!slot)continue;for(const store of selected.filter(store=>plan.locationIds.includes(store.id))){const run=state.runs.findLast(run=>runPlanner(run)===plan.id&&run.locationId===store.id&&(slot.key===null?run.status==='draft':run.periodKey===slot.key)),dueDate=run?run.dueDate:slot.dueDate,dueAt=run?(run.dueAt??plannerModel.deadline(dueDate,run.snapshot.planner?.dueTime)):plannerModel.deadline(dueDate,plan.dueTime),reminderMinutes=run?(run.snapshot.planner?.reminderMinutes||0):plan.reminderMinutes;tasks.push({plannerId:plan.id,plannerName:run?.plannerName||plan.title,templateId:template.id,title:run?.snapshot.title||template.title,locationId:store.id,locationName:store.name,type:plannerModel.type(plan),schedule:plan.schedule.kind,dueDate,dueAt,availability:plannerModel.availability(plan,slot,now()),startWindow:{plan:{schedule:{endDate:plan.schedule.endDate||null},startTime:plan.startTime||null,activeFrom:plan.activeFrom||null,activeUntil:plan.activeUntil||null},slot},dueTime:run?(run.snapshot.planner?.dueTime||null):plan.dueTime,reminderMinutes,priority:run?(run.snapshot.planner?.priority||'normal'):plan.priority,timing:run?.status==='completed'?null:plannerModel.timing(dueAt,reminderMinutes,now()),stepCount:run?run.snapshot.steps.length:template.steps.length,run:run?summary(run):null});}}
  const priority={urgent:0,high:1,normal:2};tasks.sort((a,b)=>(priority[a.priority]-priority[b.priority])||(a.dueAt||'z').localeCompare(b.dueAt||'z')||a.title.localeCompare(b.title));
  const history=state.runs.filter(run=>allowed(run,actor,selected,state)&&(!query||(run.snapshot.title+' '+(run.plannerName||'')).toLowerCase().includes(query))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id)),page=Math.max(1,Math.min(Number(params.page)||1,Math.max(1,Math.ceil(history.length/25))));if(!Number.isInteger(page))fail('Choose a valid page.');
  return{companyName:actor.companyName,today:today(),date:day,now:stamp(),locations:stores,permissionLevels:can(actor,'ops.manage')?await levelOptions(actor):[],templates,planners,tasks,runs:history.slice((page-1)*25,page*25).map(summary),page,pages:Math.max(1,Math.ceil(history.length/25)),total:history.length,canManage:can(actor,'ops.manage'),canComplete:can(actor,'ops.complete'),stepTypes:Object.keys(stepModel.kinds)};
 }
 function templateResult(state,item,actor,stores){const ids=assignments(state,item);return{...item,locationIds:ids.filter(id=>stores.some(store=>store.id===id)),locationCount:ids.length,canManage:editable(item,actor,stores,state)};}
 async function saveTemplate(actor,input,id){
  need(actor,'ops.manage');const stores=await access(actor);return mutate(state=>{
   const previous=id?state.templates.find(item=>item.id===id&&company(item,actor)):null;if(id&&!previous)fail('Checklist not found.',404);
   if(previous&&!editable(previous,actor,stores,state))fail('You need access to every assigned location to edit this checklist.',403);
   if(previous&&input?.revision!==previous.revision)fail('This checklist changed. Reload before saving.',409);
   const contentOnly=input?.contentOnly===true,value=contentOnly?normalizeContent(input):normalize(input||{});
   if(!contentOnly&&value.locationIds.some(id=>!stores.some(store=>store.id===id)))fail('Choose locations you can access in this company.',403);
   if(!previous&&!uuid(input.requestId))fail('Invalid request reference.');
   const duplicate=!previous&&state.templates.find(item=>item.requestId===input.requestId);
   if(duplicate){if(!company(duplicate,actor)||duplicate.createdById!==actor.id||JSON.stringify(contentOnly?normalizeContent(duplicate):normalize(duplicate))!==JSON.stringify(value))fail('This request reference was already used.',409);return templateResult(state,duplicate,actor,stores);}
   const saved={...previous,...value,contentOnly,id:previous?.id||crypto.randomUUID(),companyId:actor.companyId,requestId:previous?.requestId||input.requestId,revision:(previous?.revision||0)+1,createdAt:previous?.createdAt||stamp(),createdById:previous?.createdById||actor.id,createdBy:previous?.createdBy||actor.username,updatedAt:stamp(),updatedBy:actor.username};
   if(previous)state.templates.splice(state.templates.indexOf(previous),1,saved);else state.templates.push(saved);
   // Compatibility for older clients. The builder itself never edits location or scheduling data.
   if(!contentOnly){const old=state.planners.find(plan=>plan.id===saved.id&&plan.legacy);const plan={...old,id:saved.id,legacy:true,templateId:saved.id,companyId:saved.companyId,title:old?.title||saved.title,locationIds:value.locationIds,active:value.active,schedule:value.schedule,dueTime:old?.dueTime||null,reminderMinutes:old?.reminderMinutes||0,priority:old?.priority||'normal',instructions:old?.instructions||'',revision:(old?.revision||0)+1,requestId:old?.requestId||'migrated:'+saved.id,createdAt:old?.createdAt||saved.createdAt,createdById:old?.createdById||saved.createdById,createdBy:old?.createdBy||saved.createdBy,updatedAt:stamp(),updatedBy:actor.username};if(old)state.planners.splice(state.planners.indexOf(old),1,plan);else state.planners.push(plan);}
   return templateResult(state,saved,actor,stores);
  });
 }
 async function savePlanner(actor,input,id){
  need(actor,'ops.manage');const stores=await access(actor);return mutate(async state=>{
   const previous=id?state.planners.find(plan=>plan.id===id&&company(plan,actor)):null;if(id&&!previous)fail('Planner not found.',404);
   if(previous&&!editablePlan(previous,actor,stores))fail('You need access to every assigned location to edit this planner.',403);
   if(previous&&input?.revision!==previous.revision)fail('This planner changed. Reload before saving.',409);
   const value=normalizePlanner(input||{}),levels=await levelOptions(actor);if(value.roleIds?.some(id=>!levels.some(role=>role.id===id)&&!previous?.roleIds?.includes(id)))fail('Choose permission levels in this company.',403);const template=state.templates.find(item=>item.id===value.templateId&&visibleTemplate(state,item,actor,stores));if(!template)fail('Checklist not found in this company.',404);
   if(value.locationIds.some(id=>!stores.some(store=>store.id===id)))fail('Choose locations you can access in this company.',403);
   if(previous&&previous.templateId!==value.templateId&&state.runs.some(run=>runPlanner(run)===id))fail('This planner has checklist records. Create a new planner to use another checklist.');
   if(!previous&&!uuid(input.requestId))fail('Invalid request reference.');
   const duplicate=!previous&&state.planners.find(plan=>plan.requestId===input.requestId);if(duplicate){if(!company(duplicate,actor)||duplicate.createdById!==actor.id||JSON.stringify(normalizePlanner(duplicate))!==JSON.stringify(value))fail('This request reference was already used.',409);return{...duplicate,canManage:true};}
   const saved={...value,id:previous?.id||crypto.randomUUID(),legacy:previous?.legacy||false,companyId:actor.companyId,requestId:previous?.requestId||input.requestId,revision:(previous?.revision||0)+1,createdAt:previous?.createdAt||stamp(),createdById:previous?.createdById||actor.id,createdBy:previous?.createdBy||actor.username,updatedAt:stamp(),updatedBy:actor.username};
   if(previous)state.planners.splice(state.planners.indexOf(previous),1,saved);else state.planners.push(saved);return{...saved,canManage:true};
  });
 }
 async function start(actor,input){need(actor,'ops.complete');const stores=await access(actor);return mutate(async state=>{
  const available=state.planners.filter(plan=>plan.templateId===input?.templateId&&company(plan,actor)&&plan.locationIds.includes(input.locationId));
  const plan=input?.plannerId?state.planners.find(plan=>plan.id===input.plannerId&&company(plan,actor)):available.find(plan=>plan.legacy)||available.length===1&&available[0];
  const template=plan&&state.templates.find(item=>item.id===plan.templateId&&company(item,actor));
  if(!plan||!template||!audience(plan,actor)||input.templateId&&input.templateId!==template.id||!plan.locationIds.includes(input.locationId)||!stores.some(item=>item.id===input.locationId))fail('Checklist not found for this location.',404);
  const day=date(input.date||today());if(day>today())fail('Future checklists cannot be started yet.');const slot=plannerModel.occurrence(plan,day,now());if(!slot)fail('This checklist is not scheduled for this date.');if(!uuid(input.requestId))fail('Invalid request reference.');
  const duplicate=state.runs.find(item=>item.requestId===input.requestId);if(duplicate){if(!allowed(duplicate,actor,stores,state)||runPlanner(duplicate)!==plan.id||duplicate.templateId!==template.id||duplicate.locationId!==input.locationId)fail('This request reference was already used.',409);return presentRun(state,actor,stores,duplicate);}
  const existing=slot.key!==null&&state.runs.find(item=>runPlanner(item)===plan.id&&item.locationId===input.locationId&&item.periodKey===slot.key);if(existing)return presentRun(state,actor,stores,existing);
  const availability=plannerModel.availability(plan,slot,now());if(!availability.allowed)fail(availability.reason);
  const plannerSnapshot={id:plan.id,title:plan.title,schedule:structuredClone(plan.schedule),dueTime:plan.dueTime,reminderMinutes:plan.reminderMinutes,priority:plan.priority,instructions:plan.instructions,type:plannerModel.type(plan),startTime:plan.startTime||null,activeFrom:plan.activeFrom||null,activeUntil:plan.activeUntil||null,roleIds:plan.roleIds||null,dueAfterDays:plan.dueAfterDays??null};
  const run={id:crypto.randomUUID(),requestId:input.requestId,templateId:template.id,templateRevision:template.revision,plannerId:plan.id,plannerRevision:plan.revision,plannerName:plan.title,companyId:actor.companyId,locationId:input.locationId,locationName:stores.find(item=>item.id===input.locationId).name,periodKey:slot.key,dueDate:slot.dueDate,dueAt:plannerModel.deadline(slot.dueDate,plan.dueTime),snapshot:{title:template.title,description:template.description,steps:structuredClone(template.steps),schedule:structuredClone(plan.schedule),planner:plannerSnapshot},answers:{},status:'draft',revision:1,createdAt:stamp(),createdBy:actor.username,updatedAt:stamp(),updatedBy:actor.username,completedAt:null,completedBy:null};state.runs.push(run);return presentRun(state,actor,stores,run);
 });}
 async function get(actor,id){const stores=await access(actor);const state=await read();return presentRun(state,actor,stores,findRun(state,actor,stores,id));}
 async function answers(state,run,input,complete,actor,stores){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!run.snapshot.steps.some(step=>step.id===key&&stepModel.responseStep(step))))fail('Choose valid checklist answers.');
  const result={},labels={},choices=await selectionOptions(actor,stores,run);
  for(const step of run.snapshot.steps){
   if(!stepModel.responseStep(step))continue;
   let value=input[step.id];const missing=value===undefined||value===null||value===''||Array.isArray(value)&&!value.length;
   if(complete&&step.required&&(missing||step.type==='check'&&value!==true))fail('Complete the required step: '+step.title);
   if(missing)continue;
   if(['text','textarea'].includes(step.type)){
    value=text(value,step.type==='textarea'?5000:500,'an answer',true);
    if(complete&&step.required&&!value)fail('Complete the required step: '+step.title);
   }
   if(step.type==='signature'){
    if(typeof value==='string'){
     if(step.signatureMode==='drawn')fail('Draw a signature for '+step.title+'.');
     value=text(value,500,'a signature',true);if(complete&&step.required&&!value)fail('Complete the required step: '+step.title);
    }else{
     if(!value||typeof value!=='object'||Array.isArray(value)||!['drawn','either'].includes(step.signatureMode)||!state.assets.some(asset=>asset.id===value.assetId&&asset.runId===run.id&&asset.stepId===step.id&&asset.kind==='signature'))fail('Add a valid signature for '+step.title+'.');
     value={name:text(value.name,500,'the signer’s name'),assetId:value.assetId};
    }
   }
   if(step.type==='check'&&typeof value!=='boolean')fail('Choose a valid checkbox answer.');
   if(step.type==='number'&&!stepModel.validNumber(step,value))fail('Enter a number matching the format and limits for '+step.title+'.');
   if(step.type==='yesno'&&!['yes','no'].includes(value)||step.type==='choice'&&!step.options.includes(value))fail('Choose an answer for '+step.title+'.');
   if(step.type==='multiple'&&(!Array.isArray(value)||value.length>100||new Set(value).size!==value.length||value.some(item=>!step.options.includes(item))))fail('Choose valid answers for '+step.title+'.');
   if(step.type==='selection'){
    const ids=step.multiple?value:[value],previous=Array.isArray(run.answers[step.id])?run.answers[step.id]:[run.answers[step.id]];
    if(!Array.isArray(ids)||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'))fail('Choose valid selections for '+step.title+'.');
    labels[step.id]={};
    for(const id of ids){const option=choices[step.id].find(option=>option.value===id),saved=previous.includes(id)&&run.selectionLabels?.[step.id]?.[id];if(!option&&!saved)fail('Choose a selection you can access for '+step.title+'.',403);labels[step.id][id]=option?.label||saved;}
   }
   if(step.type==='date'||step.type==='datetime'&&step.dateMode==='date')date(value);
   if(step.type==='time'||step.type==='datetime'&&step.dateMode==='time'){if(typeof value!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))fail('Enter a valid time.');}
   if(step.type==='datetime'&&step.dateMode==='datetime'){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value))fail('Enter a valid date and time.');date(value.slice(0,10));
   }
   if(step.type==='photo'&&(typeof value!=='string'||!state.assets.some(asset=>asset.id===value&&asset.runId===run.id&&asset.stepId===step.id)))fail('Upload a photo for this step.');
   if(['media','file'].includes(step.type)&&(!Array.isArray(value)||value.length>step.maxFiles||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!state.assets.some(asset=>asset.id===id&&asset.runId===run.id&&asset.stepId===step.id&&asset.kind===step.type))))fail('Upload valid files for '+step.title+'.');
   result[step.id]=value;
  }
  return{values:result,labels};
 }
 async function saveRun(actor,id,input){
  need(actor,'ops.complete');const stores=await access(actor);
  return mutate(async state=>{
   const run=findRun(state,actor,stores,id);
   if(run.status==='completed')fail('Completed checklists cannot be changed.',409);
   if(input?.revision!==run.revision)fail('Someone updated this checklist. Reload before saving.',409);
   if(typeof input.complete!=='boolean')fail('Choose a draft or completed checklist.');
   const saved=await answers(state,run,input.answers,input.complete,actor,stores);run.answers=saved.values;run.selectionLabels=saved.labels;
   run.revision++;run.updatedAt=stamp();run.updatedBy=actor.username;
   if(input.complete){run.status='completed';run.completedAt=stamp();run.completedBy=actor.username;run.completedById=actor.id;}
   return presentRun(state,actor,stores,run);
  });
 }
 async function upload(actor,id,input){
  need(actor,'ops.complete');const stores=await access(actor);
  return mutate(async state=>{
   const run=findRun(state,actor,stores,id);
   if(run.status!=='draft')fail('Completed checklists cannot be changed.',409);
   if(typeof input?.name!=='string')fail('Choose a supported file.');
   const step=run.snapshot.steps.find(step=>step.id===input?.stepId),mime=files.formats[path.extname(input?.name||'').toLowerCase()],category=mime?files.category(mime):null;
   if(!step||!['photo','media','file','signature'].includes(step.type))fail('Choose a file submission step.');
   if(step.type==='photo'&&category!=='image'||step.type==='media'&&(!['image','video'].includes(category)||step.mediaKind==='photo'&&category!=='image'||step.mediaKind==='video'&&category!=='video'))fail('Choose a photo or video matching this step.');
   if(step.type==='signature'&&(!['drawn','either'].includes(step.signatureMode)||mime!=='image/png'))fail('Choose a drawn signature step.');
   const saved=await media.save(actor,input);state.assets.push({...saved,runId:id,stepId:step.id,kind:step.type});
   return{...saved,url:'/api/ops-management/media/'+saved.id};
  });
 }
 async function download(actor,id){
  const stores=await access(actor),state=await read(),asset=state.assets.find(item=>item.id===id);
  if(!asset)fail('File not found.',404);
  const run=findRun(state,actor,stores,asset.runId),attached=run.snapshot.steps.some(step=>stepModel.assetIds(step,run.answers[step.id]).includes(id));
  if(run.status==='completed'&&!attached)fail('File not found.',404);
  return{record:await media.info(id),bytes:await media.bytes(id)};
 }
 return{list,saveTemplate,savePlanner,start,get,saveRun,upload,download};
}
async function route({req,res,url,params,session,store,body,json,fail}){
 if(url!=='/api/ops-management'&&!url.startsWith('/api/ops-management/'))return false;if(!session)fail('Sign-in required.',401);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/ops-management'&&req.method==='GET'){json(200,await store.list(session,Object.fromEntries(params)));return true;}
 if(url==='/api/ops-management/templates'&&req.method==='POST'){json(201,await store.saveTemplate(session,await body(req,250000)));return true;}
 const template=url.match(/^\/api\/ops-management\/templates\/([a-f0-9-]{36})$/i);if(template&&req.method==='PUT'){json(200,await store.saveTemplate(session,await body(req,250000),template[1]));return true;}
 if(url==='/api/ops-management/planners'&&req.method==='POST'){json(201,await store.savePlanner(session,await body(req,30000)));return true;}
 const planner=url.match(/^\/api\/ops-management\/planners\/([a-f0-9-]{36})$/i);if(planner&&req.method==='PUT'){json(200,await store.savePlanner(session,await body(req,30000),planner[1]));return true;}
 if(url==='/api/ops-management/runs'&&req.method==='POST'){json(201,await store.start(session,await body(req)));return true;}
 const run=url.match(/^\/api\/ops-management\/runs\/([a-f0-9-]{36})(\/media)?$/i);if(run){if(run[2]&&req.method==='POST')json(201,await store.upload(session,run[1],await body(req,35000000)));else if(!run[2]&&req.method==='GET')json(200,await store.get(session,run[1]));else if(!run[2]&&req.method==='PUT')json(200,await store.saveRun(session,run[1],await body(req,600000)));else fail('Unsupported checklist action.',405);return true;}
 const media=url.match(/^\/api\/ops-management\/media\/([a-f0-9-]{36})$/i);
 if(media&&req.method==='GET'){
  const result=await store.download(session,media[1]),inline=/^(image|video|audio)\//.test(result.record.mime),headers={'Content-Type':result.record.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':(inline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(result.record.name).replace(/'/g,'%27'),'Accept-Ranges':'bytes'};
  let start=0,end=result.bytes.length-1;
  if(req.headers.range){
   const match=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);
   if(!match||!match[1]&&!match[2])fail('Invalid file range.',416);
   if(!match[1])start=Math.max(0,result.bytes.length-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
   if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=result.bytes.length)fail('Invalid file range.',416);
   headers['Content-Range']='bytes '+start+'-'+end+'/'+result.bytes.length;
  }
  headers['Content-Length']=end-start+1;res.writeHead(req.headers.range?206:200,headers);res.end(result.bytes.subarray(start,end+1));return true;
 }
 fail('Checklist action not found.',404);
}
module.exports={createStore,route,normalize,normalizeContent,normalizePlanner,period,types};
