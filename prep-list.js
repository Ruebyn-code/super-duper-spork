// Prep lists: each location keeps its own prep items (name, fixed daily amount, unit, station, days, optional
// label template). Staff tick items off for the Melbourne date; ticks record who and when, and an optional
// label template lets them print food labels for what they made. Viewing/ticking follows `prep.view`
// (Labels) and managing items `prep.manage`, always at the selected location.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
const weekday=date=>(new Date(date+'T12:00:00Z').getUTCDay()+6)%7+1;
const onDay=(item,date)=>item.basis==='sales'||item.days.includes(weekday(date));
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text=(value,max,label,required=false)=>{if(value===undefined||value===null)value='';if(typeof value!=='string'||value.length>max)fail(label+' may contain up to '+max+' characters.');value=value.trim();if(required&&!value)fail('Enter the '+label.toLowerCase()+'.');return value;};
function details(input,templates){
 if(!input||typeof input!=='object')fail('Enter the prep item details.');
 const name=text(input.name,80,'Item name',true);
 if(typeof input.amount!=='number'||!Number.isFinite(input.amount)||input.amount<=0||input.amount>100000||Math.round(input.amount*1000)!==input.amount*1000)fail('Enter an amount above 0 with up to three decimal places.');
 // Sales-based items: `amount` per `salesPer` whole dollars of the day's projected sales, optionally rounded up to `roundTo`.
 const basis=input.basis===undefined||input.basis===null?'fixed':input.basis;if(!['fixed','sales'].includes(basis))fail('Choose a fixed amount or an amount per projected sales.');
 let salesPer=null,roundTo=null;if(basis==='sales'){if(!Number.isSafeInteger(input.salesPer)||input.salesPer<1||input.salesPer>1000000)fail('Enter the projected sales amount (whole dollars from $1 to $1,000,000).');salesPer=input.salesPer;if(input.roundTo!==undefined&&input.roundTo!==null&&input.roundTo!==''){if(typeof input.roundTo!=='number'||!Number.isFinite(input.roundTo)||input.roundTo<=0||input.roundTo>10000||Math.round(input.roundTo*1000)!==input.roundTo*1000)fail('Round up to a number above 0 with up to three decimal places, or leave it blank.');roundTo=input.roundTo;}}
 // Sales-based items follow the projection every day, so they have no day choice.
 const days=basis==='sales'?[1,2,3,4,5,6,7]:input.days;if(!Array.isArray(days)||!days.length||days.some(day=>!Number.isInteger(day)||day<1||day>7)||new Set(days).size!==days.length)fail('Choose at least one day.');
 let labelTemplateId=null;if(input.labelTemplateId!==null&&input.labelTemplateId!==undefined&&input.labelTemplateId!==''){if(!uuid(input.labelTemplateId)||!templates.some(item=>item.id===input.labelTemplateId))fail('Choose a label template from this company, or none.');labelTemplateId=input.labelTemplateId;}
 return{name,amount:input.amount,...(basis==='sales'?{basis,salesPer,...(roundTo?{roundTo}:{})}:{}),unit:text(input.unit,30,'Unit'),station:text(input.station,60,'Station'),days:[...days].sort(),labelTemplateId,notes:text(input.notes,300,'Notes'),active:input.active!==false};
}
// The amount to prep for a sales-based item: amount × projected dollars ÷ salesPer, rounded up to roundTo (or to 0.001). Unknown projections stay unknown.
function salesAmount(item,projectedCents){
 if(!Number.isSafeInteger(projectedCents)||projectedCents<0)return null;
 const raw=item.amount*projectedCents/(item.salesPer*100),step=item.roundTo||0.001,steps=Math.ceil(Math.round(raw/step*1e6)/1e6);
 return Math.round(steps*step*1000)/1000;
}
function createStore(dir,{now=Date.now,templates=async()=>[],projection=async()=>null}){
 const queues=new Map();
 const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now()));return['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
 const folder=actor=>{if(!/^[a-zA-Z0-9-]{1,100}$/.test(actor?.locationId||'')||!/^[a-zA-Z0-9-]{1,100}$/.test(actor?.companyId||''))fail('Select a location first.',403);return path.join(dir,'prep-lists',actor.locationId);};
 const need=(actor,key='prep.view')=>{if(!actor)fail('Sign-in required.',401);if(actor.disabledFeatures?.includes('prep'))fail('Prep lists are switched off for this network.',403);if(!can(actor,'prep.view')||!can(actor,key))fail('Prep list permission required.',403);folder(actor);};
 async function readJson(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}}
 const itemsFile=actor=>path.join(folder(actor),'items.json'),dayFile=(actor,date)=>path.join(folder(actor),'days',date+'.json');
 async function readItems(actor){const state=await readJson(itemsFile(actor),{items:[]});state.items=(state.items||[]).filter(item=>item.companyId===actor.companyId);return state;}
 function mutate(file,fallback,change){const previous=queues.get(file)||Promise.resolve(),task=previous.then(async()=>{const state=await readJson(file,fallback),result=await change(state);if(result.changed){const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(state,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}return result.value;});queues.set(file,task.catch(()=>{}));return task;}
 const person=actor=>({id:actor.id,name:actor.username||actor.name||''});
 const present=item=>{const{requestId,requestFingerprint,companyId,locationId,deleted,...rest}=item;return rest;};
 async function companyTemplates(actor){try{return(await templates(actor)).filter(item=>item&&uuid(item.id)).map(item=>({id:item.id,name:item.name,active:item.active!==false}));}catch{return[];}}
 // The list for one date: items scheduled that weekday plus anything already ticked that day.
 async function list(actor,{date}={}){
  need(actor);const current=today(),day=date||current;if(!validDate(day)||day<shift(current,-90)||day>shift(current,7))fail('Choose a date within the last 90 days or the next week.');
  const [state,record,labels]=await Promise.all([readItems(actor),readJson(dayFile(actor,day),{ticks:{}}),companyTemplates(actor)]);
  const ticks=record.ticks||{},names=new Map(labels.map(item=>[item.id,item])),manage=can(actor,'prep.manage');
  const live=state.items.filter(item=>!item.deleted);
  // A day's projected sales come from the normal daily projection (Monday–Sunday week). Only sales viewers see the figures behind it.
  const salesView=can(actor,'sales.view'),needsSales=live.some(item=>item.active&&item.basis==='sales');let projected=null;
  if(needsSales){try{const value=await projection(actor,shift(day,1-weekday(day)));projected=Number.isSafeInteger(value?.days?.[weekday(day)-1])?value.days[weekday(day)-1]:null;}catch{projected=null;}}
  const shown=item=>{const base=present(item);if(item.basis!=='sales')return base;const{salesPer,roundTo,...rest}=base,amount=salesAmount(item,projected);return{...rest,amount,basis:'sales',...(amount===null?{amountReason:'No sales projection for this day yet.'}:{}),...(salesView?{salesPer,...(roundTo?{roundTo}:{}),ratio:item.amount,projectedSalesCents:projected}:{})};};
  const rows=live.filter(item=>item.active&&onDay(item,day)).map(item=>({...shown(item),label:item.labelTemplateId&&names.get(item.labelTemplateId)?.active?{id:item.labelTemplateId,name:names.get(item.labelTemplateId).name}:null}));
  // Items ticked that day but since removed or rescheduled still show, from the tick's snapshot.
  for(const [itemId,tick] of Object.entries(ticks))if(tick.done&&!rows.some(row=>row.id===itemId))rows.push({id:itemId,...tick.snapshot,label:null,removed:true});
  rows.sort((a,b)=>(a.station||'~').localeCompare(b.station||'~')||a.name.localeCompare(b.name));
  return{date:day,today:current,locationId:actor.locationId,canTick:day===current,canManage:manage,canPrint:can(actor,'prep.print'),
   rows:rows.map(row=>({...row,done:Boolean(ticks[row.id]?.done),doneAt:ticks[row.id]?.done?ticks[row.id].doneAt:null,doneBy:ticks[row.id]?.done?ticks[row.id].doneBy:null,tickRevision:ticks[row.id]?.revision||0})),
   ...(manage?{items:live.map(present).sort((a,b)=>(a.station||'~').localeCompare(b.station||'~')||a.name.localeCompare(b.name)),labelTemplates:labels.filter(item=>item.active).map(({id,name})=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name))}:{})};
 }
 async function create(actor,input){
  need(actor,'prep.manage');if(!uuid(input?.requestId))fail('Refresh the page before adding a prep item.');
  const values=details(input,await companyTemplates(actor)),print=fingerprint(values);
  return mutate(itemsFile(actor),{items:[]},state=>{
   state.items||=[];const existing=state.items.find(item=>item.requestId===input.requestId&&item.companyId===actor.companyId);
   if(existing){if(existing.createdBy?.id!==actor.id||existing.requestFingerprint!==print)fail('This prep item was already saved with different details. Reload and try again.',409);return{changed:false,value:present(existing)};}
   if(state.items.filter(item=>!item.deleted&&item.companyId===actor.companyId).length>=300)fail('A location can have up to 300 prep items.');
   const stamp=new Date(now()).toISOString(),item={id:crypto.randomUUID(),companyId:actor.companyId,locationId:actor.locationId,...values,revision:1,requestId:input.requestId,requestFingerprint:print,createdAt:stamp,createdBy:person(actor),updatedAt:stamp,updatedBy:person(actor)};
   state.items.push(item);return{changed:true,value:present(item)};
  });
 }
 async function update(actor,id,input){
  need(actor,'prep.manage');if(!uuid(id))fail('Prep item not found.',404);if(!Number.isSafeInteger(input?.revision))fail('Reload the prep item before saving.');
  const values=details(input,await companyTemplates(actor));
  return mutate(itemsFile(actor),{items:[]},state=>{
   const item=(state.items||[]).find(entry=>entry.id===id&&!entry.deleted&&entry.companyId===actor.companyId);if(!item)fail('Prep item not found.',404);
   if(item.revision!==input.revision)fail('This prep item changed since you opened it. Reload to see the latest version.',409);
   Object.assign(item,values,{revision:item.revision+1,updatedAt:new Date(now()).toISOString(),updatedBy:person(actor)});return{changed:true,value:present(item)};
  });
 }
 async function remove(actor,id,input){
  need(actor,'prep.manage');if(!uuid(id))fail('Prep item not found.',404);if(!Number.isSafeInteger(input?.revision))fail('Reload the prep item before deleting it.');
  return mutate(itemsFile(actor),{items:[]},state=>{
   const item=(state.items||[]).find(entry=>entry.id===id&&entry.companyId===actor.companyId);
   if(item?.deleted&&item.deletedBy?.id===actor.id)return{changed:false,value:{deleted:true,id}};
   if(!item||item.deleted)fail('Prep item not found.',404);if(item.revision!==input.revision)fail('This prep item changed since you opened it. Reload to see the latest version.',409);
   // Hidden rather than erased, so past ticks keep their history.
   Object.assign(item,{deleted:true,revision:item.revision+1,deletedAt:new Date(now()).toISOString(),deletedBy:person(actor)});return{changed:true,value:{deleted:true,id}};
  });
 }
 // Tick or untick one item for today. Repeating the same tick is harmless; changing it needs the current revision.
 async function tick(actor,input){
  need(actor);const current=today();
  if(input?.date!==current)fail('Prep items can only be ticked off for today. Reload the list.',409);
  if(!uuid(input?.itemId)||typeof input.done!=='boolean'||!Number.isSafeInteger(input.revision))fail('Reload the prep list before ticking items off.');
  const item=(await readItems(actor)).items.find(entry=>entry.id===input.itemId&&!entry.deleted&&entry.active&&onDay(entry,current));
  // Sales-based items freeze the amount shown today into the tick.
  let amount=item?.amount;if(item?.basis==='sales')amount=(await list(actor,{date:current})).rows.find(row=>row.id===item.id)?.amount??null;
  return mutate(dayFile(actor,current),{ticks:{}},state=>{
   state.ticks||={};const existing=state.ticks[input.itemId];
   if(!item&&!existing)fail('This prep item is not on today\'s list.',404);
   if(existing&&existing.done===input.done)return{changed:false,value:{itemId:input.itemId,done:existing.done,doneAt:existing.done?existing.doneAt:null,doneBy:existing.done?existing.doneBy:null,tickRevision:existing.revision}};
   if((existing?.revision||0)!==input.revision)fail('Someone else just changed this item. Reload the prep list.',409);
   const stamp=new Date(now()).toISOString(),snapshot=existing?.snapshot||{name:item.name,amount,unit:item.unit,station:item.station,...(item.basis==='sales'?{basis:'sales'}:{})};
   const next={done:input.done,snapshot,revision:(existing?.revision||0)+1,doneAt:input.done?stamp:existing?.doneAt||null,doneBy:input.done?person(actor):existing?.doneBy||null,history:[...(existing?.history||[]),{done:input.done,at:stamp,by:person(actor)}].slice(-20)};
   state.ticks[input.itemId]=next;return{changed:true,value:{itemId:input.itemId,done:next.done,doneAt:next.done?next.doneAt:null,doneBy:next.done?next.doneBy:null,tickRevision:next.revision}};
  });
 }
 // Today's progress for Home: counts and the remaining items, read-only.
 async function summary(actor){const result=await list(actor);return{date:result.date,total:result.rows.length,done:result.rows.filter(row=>row.done).length,rows:result.rows.map(({id,name,amount,unit,station,done,tickRevision,label,basis})=>({id,name,amount,unit,station,done,tickRevision,label,...(basis==='sales'?{basis}:{})})),canPrint:result.canPrint};}
 // Staff activity: who finished which prep item, for recent days at this location.
 async function activity(actor,{start,end}){
  need(actor);const from=start&&validDate(start)?start:shift(today(),-31),to=end&&validDate(end)?end:today(),events=[];
  for(let date=from<shift(to,-92)?shift(to,-92):from;date<=to;date=shift(date,1)){const record=await readJson(dayFile(actor,date),null);for(const tick of Object.values(record?.ticks||{}))if(tick.done&&tick.doneAt)events.push({at:tick.doneAt,userId:tick.doneBy?.id||null,userName:tick.doneBy?.name||'',type:'prep-done',title:'Prepped '+tick.snapshot.name,detail:[tick.snapshot.amount===null||tick.snapshot.amount===undefined?'':tick.snapshot.amount+(tick.snapshot.unit?' '+tick.snapshot.unit:''),tick.snapshot.station].filter(Boolean).join(' · ')});}
  return events;
 }
 return{list,create,update,remove,tick,summary,activity};
}
async function route({req,url,params,session,store,body,json}){
 if(url!=='/api/prep-list'&&!url.startsWith('/api/prep-list/')&&url!=='/api/home-prep')return false;
 if(!session)fail('Sign-in required.',401);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/home-prep'){if(req.method!=='GET')fail('Use GET for Home prep.',405);if(!can(session,'home.view'))fail('Home viewing permission required.',403);json(200,await store.summary(session));return true;}
 if(url==='/api/prep-list'&&req.method==='GET'){json(200,await store.list(session,{date:params.get('date')||undefined}));return true;}
 if(url==='/api/prep-list/items'&&req.method==='POST'){json(201,await store.create(session,await body(req,16000)));return true;}
 if(url==='/api/prep-list/tick'&&req.method==='POST'){json(200,await store.tick(session,await body(req,4000)));return true;}
 const match=url.match(/^\/api\/prep-list\/items\/([a-f0-9-]{36})$/i);
 if(match&&req.method==='PUT'){json(200,await store.update(session,match[1],await body(req,16000)));return true;}
 if(match&&req.method==='DELETE'){json(200,await store.remove(session,match[1],await body(req,4000)));return true;}
 fail('Prep list endpoint not found.',404);
}
module.exports={createStore,route,details,salesAmount};
