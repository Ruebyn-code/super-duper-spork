const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),files=require('./communication-media');
const stepModel=require('./public/ops-step-model');
const queues=new Map(),types=[...Object.keys(stepModel.kinds),'yesno','choice','multiple','photo','date','time'];
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const text=(value,max,label,empty=false)=>{if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))fail('Enter '+label+'.');return value.trim();};
function date(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('Choose a valid date.');return value;}
const shift=(day,offset)=>new Date(Date.parse(day+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
const monday=day=>shift(day,-((new Date(day+'T00:00:00Z').getUTCDay()+6)%7));
function period(template,day){const s=template.schedule;if(day<s.startDate||(s.endDate&&day>s.endDate)||!template.active)return null;if(s.kind==='manual')return{key:null,dueDate:null};if(s.kind==='once')return{key:'once',dueDate:s.startDate};if(s.kind==='daily')return{key:day,dueDate:day};const start=monday(day);return{key:start,dueDate:s.endDate&&s.endDate<shift(start,s.weekday-1)?s.endDate:shift(start,s.weekday-1)};}
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
function createStore(dir,{locations,people=async()=>[],now=Date.now}={}){
 const file=path.join(dir,'ops-management.json'),media=files.createStore(path.join(dir,'ops-management')),stamp=()=>new Date(now()).toISOString(),today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now()));
 async function read(){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return{templates:[],runs:[],assets:[]};}}
 function mutate(change){const task=(queues.get(file)||Promise.resolve()).then(async()=>{const state=await read(),result=await change(state);await fs.mkdir(dir,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(state),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result;});queues.set(file,task.catch(()=>{}));return task;}
 function need(actor,key='ops.view'){if(!can(actor,'ops.view')||!can(actor,key))fail('Your permission level does not allow this checklist action.',403);}
 async function access(actor){need(actor);return(await locations(actor)).filter(item=>(item.companyId||'default')===actor.companyId);}
 const company=(item,actor)=>item.companyId===actor.companyId;
 const allowed=(run,actor,stores)=>company(run,actor)&&stores.some(item=>item.id===run.locationId);
 const editable=(template,actor,stores)=>can(actor,'ops.manage')&&company(template,actor)&&template.locationIds.every(id=>stores.some(item=>item.id===id));
 function findRun(state,actor,stores,id){const run=state.runs.find(item=>item.id===id&&allowed(item,actor,stores));if(!run)fail('Checklist record not found.',404);return run;}
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
  const templates=state.templates.filter(item=>company(item,actor)&&item.locationIds.some(id=>stores.some(store=>store.id===id))).map(item=>({...item,locationIds:item.locationIds.filter(id=>stores.some(store=>store.id===id)),locationCount:item.locationIds.length,canManage:editable(item,actor,stores)}));
  const tasks=[];for(const template of templates){if(query&&!template.title.toLowerCase().includes(query))continue;const slot=period(template,day);if(!slot)continue;for(const store of selected.filter(store=>template.locationIds.includes(store.id))){const run=state.runs.findLast(run=>run.templateId===template.id&&run.locationId===store.id&&(slot.key===null?run.status==='draft':run.periodKey===slot.key));tasks.push({templateId:template.id,title:template.title,locationId:store.id,locationName:store.name,schedule:template.schedule.kind,dueDate:slot.dueDate,stepCount:template.steps.length,run:run?summary(run):null});}}
  const history=state.runs.filter(run=>allowed(run,actor,selected)&&(!query||run.snapshot.title.toLowerCase().includes(query))).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id)),page=Math.max(1,Math.min(Number(params.page)||1,Math.max(1,Math.ceil(history.length/25))));if(!Number.isInteger(page))fail('Choose a valid page.');
  return{companyName:actor.companyName,today:today(),date:day,locations:stores,templates,tasks,runs:history.slice((page-1)*25,page*25).map(summary),page,pages:Math.max(1,Math.ceil(history.length/25)),total:history.length,canManage:can(actor,'ops.manage'),canComplete:can(actor,'ops.complete'),stepTypes:Object.keys(stepModel.kinds)};
 }
 async function saveTemplate(actor,input,id){need(actor,'ops.manage');const stores=await access(actor);return mutate(state=>{const previous=id?state.templates.find(item=>item.id===id&&company(item,actor)):null;if(id&&!previous)fail('Checklist not found.',404);if(previous&&!editable(previous,actor,stores))fail('You need access to every assigned location to edit this checklist.',403);if(previous&&input?.revision!==previous.revision)fail('This checklist changed. Reload before saving.',409);const value=normalize(input||{});if(value.locationIds.some(id=>!stores.some(store=>store.id===id)))fail('Choose locations you can access in this company.',403);if(!previous&&!uuid(input.requestId))fail('Invalid request reference.');const duplicate=!previous&&state.templates.find(item=>item.requestId===input.requestId);if(duplicate){if(!company(duplicate,actor)||duplicate.createdById!==actor.id||JSON.stringify(normalize(duplicate))!==JSON.stringify(value))fail('This request reference was already used.',409);return{...duplicate,canManage:true};}const saved={...value,id:previous?.id||crypto.randomUUID(),companyId:actor.companyId,requestId:previous?.requestId||input.requestId,revision:(previous?.revision||0)+1,createdAt:previous?.createdAt||stamp(),createdById:previous?.createdById||actor.id,createdBy:previous?.createdBy||actor.username,updatedAt:stamp(),updatedBy:actor.username};if(previous)state.templates.splice(state.templates.indexOf(previous),1,saved);else state.templates.push(saved);return{...saved,canManage:true};});}
 async function start(actor,input){need(actor,'ops.complete');const stores=await access(actor);return mutate(async state=>{const template=state.templates.find(item=>item.id===input?.templateId&&company(item,actor));if(!template||!template.locationIds.includes(input.locationId)||!stores.some(item=>item.id===input.locationId))fail('Checklist not found for this location.',404);const day=date(input.date||today());if(day>today())fail('Future checklists cannot be started yet.');const slot=period(template,day);if(!slot)fail('This checklist is not scheduled for this date.');if(!uuid(input.requestId))fail('Invalid request reference.');const duplicate=state.runs.find(item=>item.requestId===input.requestId);if(duplicate){if(!allowed(duplicate,actor,stores)||duplicate.templateId!==template.id||duplicate.locationId!==input.locationId)fail('This request reference was already used.',409);return presentRun(state,actor,stores,duplicate);}const existing=slot.key!==null&&state.runs.find(item=>item.templateId===template.id&&item.locationId===input.locationId&&item.periodKey===slot.key);if(existing)return presentRun(state,actor,stores,existing);const run={id:crypto.randomUUID(),requestId:input.requestId,templateId:template.id,templateRevision:template.revision,companyId:actor.companyId,locationId:input.locationId,locationName:stores.find(item=>item.id===input.locationId).name,periodKey:slot.key,dueDate:slot.dueDate,snapshot:{title:template.title,description:template.description,steps:structuredClone(template.steps),schedule:template.schedule},answers:{},status:'draft',revision:1,createdAt:stamp(),createdBy:actor.username,updatedAt:stamp(),updatedBy:actor.username,completedAt:null,completedBy:null};state.runs.push(run);return presentRun(state,actor,stores,run);});}
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
 return{list,saveTemplate,start,get,saveRun,upload,download};
}
async function route({req,res,url,params,session,store,body,json,fail}){
 if(url!=='/api/ops-management'&&!url.startsWith('/api/ops-management/'))return false;if(!session)fail('Sign-in required.',401);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/ops-management'&&req.method==='GET'){json(200,await store.list(session,Object.fromEntries(params)));return true;}
 if(url==='/api/ops-management/templates'&&req.method==='POST'){json(201,await store.saveTemplate(session,await body(req,250000)));return true;}
 const template=url.match(/^\/api\/ops-management\/templates\/([a-f0-9-]{36})$/i);if(template&&req.method==='PUT'){json(200,await store.saveTemplate(session,await body(req,250000),template[1]));return true;}
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
module.exports={createStore,route,normalize,period,types};
