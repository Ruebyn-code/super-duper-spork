const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can,canAccessLocation,locationIds}=require('./permissions');
const delivery=require('./delivery-settings'),holidays=require('./australian-public-holidays');
const {validateDelivery,providerStatus}=require('./order-delivery');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const reviews=[
 {id:'roster',title:'Rostering & labour',description:'Review positions, pay rates and labour budgets for this location.',permission:'rostering.manage',url:'/rostering#settings'},
 {id:'payroll',title:'Award & payroll settings',description:'Review the applicable award, employee profiles and public-holiday payroll settings.',permission:'awards.manage',url:'/settings/awards'},
 {id:'checklists',title:'Checklist planners',description:'Review the checklists, trading-hour schedules and assignees needed here.',permission:'ops.manage',url:'/ops-management#builder'},
 {id:'training',title:'Training & induction',description:'Review courses, induction and training assignments for this location.',permission:'learning.manage',url:'/learning-centre#courses'},
 {id:'devices',title:'Kiosk devices',description:'Review whether this location needs a paired kiosk and configure it if needed.',permission:'devices.manage',url:'/settings/devices'}
];
function createStore(dir,{locations,auth,catalogues,now=Date.now}){
 const file=path.join(dir,'location-setup.json');let pending=Promise.resolve();
 async function read(){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return{locations:{},snoozes:{}};throw e;}}
 function mutate(change){const operation=pending.then(async()=>{const data=await read(),result=await change(data);await fs.mkdir(dir,{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result;});pending=operation.catch(()=>{});return operation;}
 async function outstanding(actor,data){return(await locations.setupLocations()).filter(l=>(l.companyId||'default')===actor.companyId&&!l.archived&&l.setupRequired===true&&l.setupCreatorId===actor.id&&!data.locations[l.id]?.completedAt);}
 const key=actor=>actor.companyId+':'+actor.id,covers=(snooze,records)=>records.every(l=>snooze?.locationIds?.includes(l.id));
 async function gate(actor){const data=await read(),records=await outstanding(actor,data),snooze=data.snoozes[key(actor)],snoozed=records.length>0&&covers(snooze,records)&&Date.parse(snooze.until)>now();return{companyId:actor.companyId,blocked:false,reminderDue:records.length>0&&!snoozed,pendingCount:records.length,snoozedUntil:snoozed?snooze.until:null,serverTime:new Date(now()).toISOString()};}
 function supplierReady(supplier){try{return validateDelivery(supplier.delivery).method!=='none';}catch{return false;}}
 async function detail(actor,record,data){
  const context=await auth.forCompany(actor,record.companyId),access=canAccessLocation(context,record);
  if(!access)return{name:'A new company location',restricted:true,steps:[]};
  const [env,catalogue,people]=await Promise.all([delivery.deliveryEnvironment(dir,record.id),catalogues.read(record.companyId),auth.managerDirectory()]);
  const members=people.filter(p=>!p.invitation&&locationIds(p).includes(record.id)),products=catalogue.products.filter(p=>!p.archived),suppliers=catalogue.suppliers.filter(s=>products.some(p=>p.supplierId===s.id));
  const sending=providerStatus(env),sendingReady=suppliers.length>0&&suppliers.every(s=>supplierReady(s)&&(s.delivery.method==='platform'||sending[s.delivery.method]));
  const link=tab=>'/admin/accounts?location='+encodeURIComponent(record.id)+'&setupTab='+tab+'#locations';
  const steps=[
   {id:'details',title:'Location details & state',description:'Save the correct location name and Australian state or territory.',done:Boolean(record.name&&holidays.validState(record.publicHolidayState)),permission:'locations.manage',url:link('general')},
   {id:'hours',title:'All seven days of trading hours',description:'Enter opening and closing times, or mark the day closed.',done:record.tradingHours.length===7&&record.tradingHours.every(Boolean),permission:'locations.manage',url:link('hours')},
   {id:'manager',title:'Location manager',description:'Assign an existing user as this location’s manager.',done:record.managers.length>0,permission:'users.manage',url:link('managers')},
   {id:'team',title:'Team access',description:'Assign at least one active team member to this location.',done:members.length>0,permission:'users.manage',url:'/admin/accounts?location='+encodeURIComponent(record.id)+'#accounts'},
   {id:'sending',title:'Order-sending service',description:'Save and enable the sender and provider credentials used by your suppliers.',done:sendingReady,permission:'email.manage',url:link('sending')},
   {id:'suppliers',title:'Supplier delivery contacts',description:'Configure a valid order-delivery destination for every supplier with stock.',done:suppliers.length>0&&suppliers.every(supplierReady)&&products.every(p=>suppliers.some(s=>s.id===p.supplierId)),permission:'suppliers.manage',url:'/admin#suppliers'},
   {id:'stock',title:'Stock catalogue',description:'Add the stock this company orders, with a supplier and confirmed price for every item.',done:products.length>0&&products.every(p=>p.supplierId&&Number.isInteger(p.price)&&p.price>=0),permission:'stock.manage',url:'/admin#stock'},
   ...reviews.map(task=>({...task,review:true,done:Boolean(data.locations[record.id]?.reviews?.[task.id])}))
  ].map(({permission,...step})=>({...step,canEdit:can(context,permission)&&(step.id!=='manager'||can(context,'locations.manage'))}));
  const revision=crypto.createHash('sha256').update(JSON.stringify({id:record.id,steps,updated:data.locations[record.id]||null})).digest('hex');
  return{id:record.id,name:record.name,canComplete:can(context,'locations.manage'),steps,revision};
 }
 async function decorate(records){const data=await read(),stored=new Map((await locations.setupLocations()).map(l=>[l.id,l]));return records.map(record=>({...record,setupPending:stored.get(record.id)?.setupRequired===true&&!stored.get(record.id)?.archived&&!data.locations[record.id]?.completedAt}));}
 async function editor(actor,id,stepId,pathname){const{record}=await target(actor,id),data=await read();if(data.locations[id]?.completedAt)fail('Location setup is already complete.',409);const detailValue=await detail(actor,(await locations.list()).find(l=>l.id===record.id),data),step=detailValue.steps.find(step=>step.id===stepId);if(!step||new URL(step.url,'http://localhost').pathname!==pathname)fail('Choose a valid setup step.',400);if(!step.canEdit)fail('You do not have permission to edit this setup step.',403);return step;}
 async function status(actor,requestedId){const data=await read(),records=await outstanding(actor,data);if(requestedId&&!records.some(r=>r.id===requestedId)){const{record}=await target(actor,requestedId);records.push(record);}const all=records.length?await locations.list():[];return{...await gate(actor),pendingLocationIds:(await decorate(await locations.accessible(actor))).filter(l=>l.setupPending).map(l=>l.id),locations:await Promise.all(records.map(record=>data.locations[record.id]?.completedAt?{id:record.id,name:record.name,completed:true,steps:[]}:detail(actor,all.find(l=>l.id===record.id),data)))};}
 async function target(actor,id){const record=await locations.get(id),context=await auth.forCompany(actor,record.companyId||'default');if(record.companyId!==actor.companyId||!canAccessLocation(context,record))fail('Location not found.',404);if(record.archived||!record.setupRequired)fail('This location does not require setup.',409);return{record,context};}
 async function snooze(actor){await mutate(async data=>{const records=await outstanding(actor,data);if(!records.length)return;const current=data.snoozes[key(actor)];if(covers(current,records)&&Date.parse(current.until)>now())return;data.snoozes[key(actor)]={locationIds:records.map(l=>l.id),until:new Date(now()+300000).toISOString()};});return status(actor);}
 async function review(actor,input){if(!input||!reviews.some(r=>r.id===input.taskId))fail('Choose a setup review task.');await mutate(async data=>{const{record,context}=await target(actor,input.locationId),task=reviews.find(r=>r.id===input.taskId);if(!can(context,task.permission))fail('You do not have permission to review these settings.',403);if(data.locations[record.id]?.completedAt)fail('Location setup is already complete.',409);const current=await detail(actor,(await locations.list()).find(l=>l.id===record.id),data);if(current.revision!==input.revision)fail('Setup changed. Refresh the checklist before confirming.',409);data.locations[record.id]||={reviews:{}};data.locations[record.id].reviews[task.id]={at:new Date(now()).toISOString(),actorId:actor.id};});return status(actor,input.locationId);}
 async function complete(actor,input){await mutate(async data=>{const{record,context}=await target(actor,input?.locationId);if(!can(context,'locations.manage'))fail('Location management permission required.',403);if(data.locations[record.id]?.completedAt)return;const current=await detail(actor,(await locations.list()).find(l=>l.id===record.id),data);if(current.revision!==input.revision)fail('Setup changed. Refresh the checklist before finishing.',409);if(current.steps.some(step=>!step.done))fail('Complete every setup task before marking this location ready.',409);data.locations[record.id].completedAt=new Date(now()).toISOString();data.locations[record.id].completedBy=actor.id;});return status(actor,input.locationId);}
 return{gate,status,snooze,review,complete,decorate,editor};
}
module.exports={createStore};
