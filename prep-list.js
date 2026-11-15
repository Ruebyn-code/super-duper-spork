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
// What is still to make once the amount already prepped is taken off: never below zero, rounded up to the item's round-up step
// (or to 0.001). Unknown targets stay unknown; no on-hand entry means the whole amount is still to make.
function remaining(amount,onHand,roundTo){
 if(typeof amount!=='number'||!Number.isFinite(amount))return null;if(typeof onHand!=='number'||!Number.isFinite(onHand))return amount;
 const left=Math.max(0,Math.round((amount-onHand)*1000)/1000);if(!left)return 0;
 if(roundTo){const steps=Math.round(roundTo*1000);return Math.ceil(Math.round(left*1000)/steps)*steps/1000;}return left;
}
// More than one to make (up to 20) splits an item into one checkbox per unit; the last box holds any part unit (2.5 → 1, 1, 0.5).
function partCount(toPrep){if(typeof toPrep!=='number'||!Number.isFinite(toPrep))return 1;const count=Math.ceil(Math.round(toPrep*1000)/1000);return count>1&&count<=20?count:1;}
function partSizes(toPrep){const count=partCount(toPrep);if(count<2)return null;return Array.from({length:count},(_,index)=>index<count-1?1:Math.round((toPrep-(count-1))*1000)/1000);}
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
  const ticks=record.ticks||{},stock=record.onHand||{},names=new Map(labels.map(item=>[item.id,item])),manage=can(actor,'prep.manage');
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
   rows:rows.map(row=>{const entry=stock[row.id],onHand=Number.isFinite(entry?.quantity)?entry.quantity:null,frozen=ticks[row.id]?.done&&ticks[row.id].snapshot&&Object.hasOwn(ticks[row.id].snapshot,'toPrep');
    const roundTo=live.find(item=>item.id===row.id)?.roundTo||null;
    return{...row,onHand,onHandRevision:entry?.revision||0,onHandBy:entry&&onHand!==null?entry.by:null,onHandAt:entry&&onHand!==null?entry.at:null,toPrep:frozen?ticks[row.id].snapshot.toPrep:remaining(row.amount,onHand,roundTo),done:Boolean(ticks[row.id]?.done),doneAt:ticks[row.id]?.done?ticks[row.id].doneAt:null,doneBy:ticks[row.id]?.done?ticks[row.id].doneBy:null,tickRevision:ticks[row.id]?.revision||0,...partsView(ticks[row.id],frozen?ticks[row.id].snapshot.toPrep:remaining(row.amount,onHand,roundTo))};}),
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
 // Split items list each box ticked so far (every box once the item is done) with who ticked it.
 function partsView(record,toPrep){const sizes=partSizes(toPrep);if(!sizes)return{};const done=record?.done?sizes.map((_,index)=>index):Object.keys(record?.parts||{}).map(Number).filter(index=>index<sizes.length).sort((a,b)=>a-b);
  return{parts:sizes.map((size,index)=>({index,size,done:done.includes(index),by:record?.parts?.[index]?.by||(record?.done?record.doneBy:null)||null,at:record?.parts?.[index]?.at||(record?.done?record.doneAt:null)||null}))};}
 const tickValue=(itemId,record,toPrep)=>({itemId,done:Boolean(record?.done),doneAt:record?.done?record.doneAt:null,doneBy:record?.done?record.doneBy:null,tickRevision:record?.revision||0,...partsView(record,toPrep)});
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
   const heldNow=Number.isFinite(state.onHand?.[input.itemId]?.quantity)?state.onHand[input.itemId].quantity:null,leftOf=record=>record?.done&&record.snapshot&&Object.hasOwn(record.snapshot,'toPrep')?record.snapshot.toPrep:remaining(amount,heldNow,item?.roundTo);
   if(existing&&existing.done===input.done&&(input.done||!Object.keys(existing.parts||{}).length))return{changed:false,value:tickValue(input.itemId,existing,leftOf(existing))};
   if((existing?.revision||0)!==input.revision)fail('Someone else just changed this item. Reload the prep list.',409);
   const stamp=new Date(now()).toISOString(),held=Number.isFinite(state.onHand?.[input.itemId]?.quantity)?state.onHand[input.itemId].quantity:null;
   // Ticking freezes what was on hand and what was left to make; unticking keeps the record of the earlier tick.
   const snapshot=input.done&&item?{name:item.name,amount,unit:item.unit,station:item.station,...(item.basis==='sales'?{basis:'sales'}:{}),onHand:held,toPrep:remaining(amount,held,item.roundTo)}:existing?.snapshot||{name:item.name,amount,unit:item.unit,station:item.station,...(item.basis==='sales'?{basis:'sales'}:{})};
   const next={done:input.done,snapshot,...(input.done?{parts:existing?.parts||{}}:{parts:{}}),revision:(existing?.revision||0)+1,doneAt:input.done?stamp:existing?.doneAt||null,doneBy:input.done?person(actor):existing?.doneBy||null,history:[...(existing?.history||[]),{done:input.done,at:stamp,by:person(actor)}].slice(-20)};
   state.ticks[input.itemId]=next;return{changed:true,value:tickValue(input.itemId,next,leftOf(next))};
  });
 }
 // Tick or untick one box of a split item. The item is done once every box is ticked; unticking a box of a done item
 // reopens it with the other boxes still ticked. Repeating the same tick is harmless; changes need the current revision.
 async function tickPart(actor,input){
  need(actor);const current=today();
  if(input?.date!==current)fail('Prep items can only be ticked off for today. Reload the list.',409);
  if(!uuid(input?.itemId)||!Number.isInteger(input.index)||input.index<0||input.index>19||typeof input.done!=='boolean'||!Number.isSafeInteger(input.revision))fail('Reload the prep list before ticking items off.');
  const item=(await readItems(actor)).items.find(entry=>entry.id===input.itemId&&!entry.deleted&&entry.active&&onDay(entry,current));
  if(!item)fail('This prep item is not on today\'s list.',404);
  let amount=item.amount;if(item.basis==='sales')amount=(await list(actor,{date:current})).rows.find(row=>row.id===item.id)?.amount??null;
  return mutate(dayFile(actor,current),{ticks:{}},state=>{
   state.ticks||={};const existing=state.ticks[input.itemId],held=Number.isFinite(state.onHand?.[input.itemId]?.quantity)?state.onHand[input.itemId].quantity:null;
   const toPrep=existing?.done&&existing.snapshot&&Object.hasOwn(existing.snapshot,'toPrep')?existing.snapshot.toPrep:remaining(amount,held,item.roundTo),count=partCount(toPrep);
   if(count<2||input.index>=count)fail('That box is no longer on this item. Reload the prep list.',409);
   const ticked=Boolean(existing?.done)||Boolean(existing?.parts?.[input.index]);
   if(ticked===input.done)return{changed:false,value:tickValue(input.itemId,existing,toPrep)};
   if((existing?.revision||0)!==input.revision)fail('Someone else just changed this item. Reload the prep list.',409);
   const stamp=new Date(now()).toISOString(),parts={};
   // A done item counts every box as ticked; keep who ticked each one where it was recorded.
   for(let index=0;index<count;index+=1)if(existing?.done||existing?.parts?.[index])parts[index]=existing?.parts?.[index]||{at:existing.doneAt,by:existing.doneBy};
   if(input.done)parts[input.index]={at:stamp,by:person(actor)};else delete parts[input.index];
   const done=Object.keys(parts).length===count;
   const snapshot=done?{name:item.name,amount,unit:item.unit,station:item.station,...(item.basis==='sales'?{basis:'sales'}:{}),onHand:held,toPrep}:existing?.snapshot||{name:item.name,amount,unit:item.unit,station:item.station,...(item.basis==='sales'?{basis:'sales'}:{})};
   const next={done,snapshot,parts,revision:(existing?.revision||0)+1,doneAt:done?stamp:existing?.doneAt||null,doneBy:done?person(actor):existing?.doneBy||null,history:[...(existing?.history||[]),{part:input.index,done:input.done,at:stamp,by:person(actor)}].slice(-20)};
   state.ticks[input.itemId]=next;return{changed:true,value:tickValue(input.itemId,next,toPrep)};
  });
 }
 // Record how much is already prepped (on hand) for one of today's items; the list then shows only the rest to make.
 // Repeating the same amount is harmless; changing it needs the current revision; null clears it. Ticked items are locked.
 async function setOnHand(actor,input){
  need(actor);const current=today();
  if(input?.date!==current)fail('Already prepped amounts can only be entered for today. Reload the list.',409);
  if(!uuid(input?.itemId)||!Number.isSafeInteger(input.revision))fail('Reload the prep list before entering what is already prepped.');
  const quantity=input.quantity;if(quantity!==null&&(typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<0||quantity>1000000||Math.round(quantity*1000)!==quantity*1000))fail('Enter the amount already prepped as a number from 0 with up to three decimal places, or leave it blank.');
  const item=(await readItems(actor)).items.find(entry=>entry.id===input.itemId&&!entry.deleted&&entry.active&&onDay(entry,current));
  return mutate(dayFile(actor,current),{ticks:{}},state=>{
   state.onHand||={};const existing=state.onHand[input.itemId],same=(existing?.quantity??null)===quantity;
   if(!item&&!existing)fail('This prep item is not on today\'s list.',404);
   const shown=entry=>({itemId:input.itemId,onHand:Number.isFinite(entry?.quantity)?entry.quantity:null,onHandRevision:entry?.revision||0,onHandBy:Number.isFinite(entry?.quantity)?entry.by:null,onHandAt:Number.isFinite(entry?.quantity)?entry.at:null});
   if(same&&(existing||quantity===null))return{changed:false,value:shown(existing)};
   if((existing?.revision||0)!==input.revision)fail('Someone else just changed this item. Reload the prep list.',409);
   if(state.ticks?.[input.itemId]?.done)fail('This item is already marked done. Untick it before changing what was already prepped.',409);
   if(Object.keys(state.ticks?.[input.itemId]?.parts||{}).length)fail('Some boxes of this item are already ticked. Untick them before changing what was already prepped.',409);
   const stamp=new Date(now()).toISOString(),next={quantity,revision:(existing?.revision||0)+1,at:stamp,by:person(actor),history:[...(existing?.history||[]),{quantity,at:stamp,by:person(actor)}].slice(-20)};
   state.onHand[input.itemId]=next;return{changed:true,value:shown(next)};
  });
 }
 // Today's progress for Home: counts and the remaining items, read-only.
 async function summary(actor){const result=await list(actor);return{date:result.date,total:result.rows.length,done:result.rows.filter(row=>row.done).length,rows:result.rows.map(({id,name,amount,onHand,toPrep,unit,station,done,tickRevision,label,basis,parts})=>({id,name,amount,onHand,toPrep,unit,station,done,tickRevision,label,...(parts?{partsDone:parts.filter(part=>part.done).length,partCount:parts.length}:{}),...(basis==='sales'?{basis}:{})})),canPrint:result.canPrint};}
 // Staff activity: who finished which prep item, for recent days at this location.
 async function activity(actor,{start,end}){
  need(actor);const from=start&&validDate(start)?start:shift(today(),-31),to=end&&validDate(end)?end:today(),events=[];
  for(let date=from<shift(to,-92)?shift(to,-92):from;date<=to;date=shift(date,1)){const record=await readJson(dayFile(actor,date),null);for(const tick of Object.values(record?.ticks||{}))if(tick.done&&tick.doneAt)events.push({at:tick.doneAt,userId:tick.doneBy?.id||null,userName:tick.doneBy?.name||'',type:'prep-done',title:'Prepped '+tick.snapshot.name,detail:[tick.snapshot.amount===null||tick.snapshot.amount===undefined?'':tick.snapshot.amount+(tick.snapshot.unit?' '+tick.snapshot.unit:''),tick.snapshot.station].filter(Boolean).join(' · ')});}
  return events;
 }
 return{list,create,update,remove,tick,tickPart,setOnHand,summary,activity};
}
async function route({req,url,params,session,store,body,json}){
 if(url!=='/api/prep-list'&&!url.startsWith('/api/prep-list/')&&url!=='/api/home-prep')return false;
 if(!session)fail('Sign-in required.',401);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/home-prep'){if(req.method!=='GET')fail('Use GET for Home prep.',405);if(!can(session,'home.view'))fail('Home viewing permission required.',403);json(200,await store.summary(session));return true;}
 if(url==='/api/prep-list'&&req.method==='GET'){json(200,await store.list(session,{date:params.get('date')||undefined}));return true;}
 if(url==='/api/prep-list/items'&&req.method==='POST'){json(201,await store.create(session,await body(req,16000)));return true;}
 if(url==='/api/prep-list/tick'&&req.method==='POST'){json(200,await store.tick(session,await body(req,4000)));return true;}
 if(url==='/api/prep-list/part'&&req.method==='POST'){json(200,await store.tickPart(session,await body(req,4000)));return true;}
 if(url==='/api/prep-list/on-hand'&&req.method==='POST'){json(200,await store.setOnHand(session,await body(req,4000)));return true;}
 const match=url.match(/^\/api\/prep-list\/items\/([a-f0-9-]{36})$/i);
 if(match&&req.method==='PUT'){json(200,await store.update(session,match[1],await body(req,16000)));return true;}
 if(match&&req.method==='DELETE'){json(200,await store.remove(session,match[1],await body(req,4000)));return true;}
 fail('Prep list endpoint not found.',404);
}
module.exports={createStore,route,details,salesAmount,remaining,partCount,partSizes};
