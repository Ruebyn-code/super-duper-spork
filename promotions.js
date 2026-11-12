// Sales promotions: company-scoped records of the deals stores run (type, offer, channels, dates, locations).
// Reads show the promotions that include the selected location. Creating and editing need sales editing plus
// access to every location the promotion lists. Performance compares saved weekly-report-first sales on each
// promotion day with that day's normal projection; it is read-only and never changes sales or forecasts.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can,canAccessLocation}=require('./permissions'),model=require('./public/promotions-model');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&value>='2000-01-01'&&value<='2100-12-31'&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
const monday=date=>shift(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const text=(value,max,label,required=false)=>{if(value===undefined||value===null)value='';if(typeof value!=='string'||value.length>max)fail(label+' may contain up to '+max+' characters.');value=value.trim();if(required&&!value)fail('Enter a '+label.toLowerCase()+'.');return value;};
function details(input,previous=null,{features=model.featureState(),products=null}={}){
 if(!input||typeof input!=='object')fail('Enter the promotion details.');
 const name=text(input.name,120,'Promotion name',true),type=model.kind(input.kind);if(!type)fail('Choose a promotion type.');
 let value=null;
 if(type.value==='percent'){if(!Number.isInteger(input.value)||input.value<1||input.value>100)fail('Enter a discount from 1% to 100%.');value=input.value;}
 if(type.value==='cents'){if(!Number.isSafeInteger(input.value)||input.value<1||input.value>100000000)fail(type.id==='price'?'Enter the special price.':'Enter the amount off.');value=input.value;}
 if(!Array.isArray(input.channels)||!input.channels.length)fail('Choose at least one sales channel.');
 const channels=model.channels.map(item=>item.id).filter(id=>input.channels.includes(id));if(channels.length!==new Set(input.channels).size)fail('Choose valid sales channels.');
 if(!validDate(input.startDate)||!validDate(input.endDate))fail('Choose valid start and end dates.');
 if(input.endDate<input.startDate)fail('The end date must be on or after the start date.');
 // Optional fields: omitted (older writers or switched-off features) keeps the saved value.
 let weekdays=previous?.weekdays||null;
 if(features.repeat&&input.weekdays!==undefined){
  if(input.weekdays===null||Array.isArray(input.weekdays)&&!input.weekdays.length)weekdays=null;
  else{if(!Array.isArray(input.weekdays)||input.weekdays.some(day=>!Number.isInteger(day)||day<0||day>6)||new Set(input.weekdays).size!==input.weekdays.length)fail('Choose valid repeat days.');weekdays=input.weekdays.length===7?null:[...input.weekdays].sort((a,b)=>a-b);}
 }
 const limit=weekdays?model.maxRepeatDays:model.maxDays;
 if(model.days(input.startDate,input.endDate)>limit)fail(weekdays?'A repeating promotion can run for up to '+limit+' days.':'A promotion can run for up to '+limit+' days.');
 if(weekdays&&!Array.from({length:Math.min(7,model.days(input.startDate,input.endDate))},(_,index)=>model.weekday(shift(input.startDate,index))).some(day=>weekdays.includes(day)))fail('None of the repeat days fall within these dates.');
 if(!Array.isArray(input.locationIds)||!input.locationIds.length||input.locationIds.length>500||new Set(input.locationIds).size!==input.locationIds.length||input.locationIds.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id)))fail('Choose the locations running this promotion.');
 let expectedUplift=previous?.expectedUplift??null;
 if(features.uplift&&input.expectedUplift!==undefined){if(input.expectedUplift!==null&&(!Number.isInteger(input.expectedUplift)||input.expectedUplift<1||input.expectedUplift>300))fail('Enter an expected uplift from 1% to 300%, or leave it blank.');expectedUplift=input.expectedUplift;}
 let items=previous?.items||null;
 if(features.items&&input.itemIds!==undefined){
  if(input.itemIds===null||Array.isArray(input.itemIds)&&!input.itemIds.length)items=null;
  else{
   if(!Array.isArray(input.itemIds)||input.itemIds.length>model.maxItems||input.itemIds.some(id=>typeof id!=='string'||!id||id.length>100)||new Set(input.itemIds).size!==input.itemIds.length)fail('Choose up to '+model.maxItems+' stock items.');
   const known=new Map((products||[]).map(item=>[String(item.id),item])),saved=new Map((previous?.items||[]).map(item=>[item.id,item]));
   items=input.itemIds.map(id=>{const item=known.get(id);if(item)return{id,name:String(item.name||'').slice(0,120)};if(saved.has(id))return saved.get(id);fail('Choose stock items from this company’s catalogue.');});
  }
 }
 let redemptionCostCents=previous?.redemptionCostCents??null;
 if(features.redemptions&&input.redemptionCostCents!==undefined){if(input.redemptionCostCents!==null&&(!Number.isSafeInteger(input.redemptionCostCents)||input.redemptionCostCents<1||input.redemptionCostCents>100000000))fail('Enter the cost per redemption, or leave it blank.');redemptionCostCents=input.redemptionCostCents;}
 return{name,kind:type.id,value,channels,startDate:input.startDate,endDate:input.endDate,locationIds:[...input.locationIds],notes:text(input.notes,500,'Notes'),weekdays,expectedUplift,items,redemptionCostCents};
}
const optional=['weekdays','expectedUplift','items','redemptionCostCents'];
// Copy saved details onto a record, leaving out empty optional fields.
function assign(record,values){Object.assign(record,values);for(const key of optional)if(record[key]===null||record[key]===undefined)delete record[key];return record;}
// The cost of one redemption: the saved amount, or the $ off itself.
const redemptionCost=promotion=>Number.isSafeInteger(promotion.redemptionCostCents)?promotion.redemptionCostCents:promotion.kind==='amount'&&Number.isSafeInteger(promotion.value)?promotion.value:null;
async function readJson(target,fallback){try{return JSON.parse(await fs.readFile(target,'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}}
const companyOk=companyId=>/^[a-zA-Z0-9-]{1,100}$/.test(companyId||'');
// Saved feature switches for one company (omitted features are on).
async function readSettings(dir,companyId){if(!companyOk(companyId))return{revision:0,features:model.featureState()};const saved=await readJson(path.join(dir,'promotions',companyId+'-settings.json'),null);return{revision:Number.isSafeInteger(saved?.revision)?saved.revision:0,features:model.featureState(saved?.features),updatedAt:saved?.updatedAt||null};}
const melbourneDate=instant=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));return['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
// Expected uplift on each date at the session's location: the largest lift of the promotions covering it.
// Read-only; empty when the feature is off, the network's Sales feature is off or nothing applies.
async function upliftFor(dir,session,dates){
 if(!session?.locationId||!companyOk(session.companyId)||!dates.length)return{};
 if((await require('./network-features').read(dir)).disabled.includes('sales'))return{};
 if(!(await readSettings(dir,session.companyId)).features.uplift)return{};
 const state=await readJson(path.join(dir,'promotions',session.companyId+'.json'),{promotions:[]}),result={};
 for(const promotion of Array.isArray(state.promotions)?state.promotions:[]){
  if(promotion.deleted||promotion.companyId!==session.companyId||!promotion.locationIds?.includes(session.locationId)||!Number.isInteger(promotion.expectedUplift))continue;
  for(const date of dates)if(model.covers(promotion,date)){const entry=result[date]||(result[date]={percent:0,names:[]});entry.percent=Math.max(entry.percent,promotion.expectedUplift);entry.names.push(promotion.name);}
 }
 return result;
}
// Raise each covered day's amount by its expected uplift, keeping missing days missing and totals/budgets in step.
function applyUplift(projection,uplifts,{dailyKey='dailyProjections',amountKey='amountCents'}={}){
 const original=projection?.[dailyKey];if(!Array.isArray(original)||!original.some(day=>uplifts[day?.date]))return projection;
 let change=0;
 const daily=original.map(day=>{const uplift=uplifts[day?.date];if(!uplift)return day;const base=day[amountKey];if(!Number.isSafeInteger(base))return{...day,promotion:{percent:uplift.percent,names:uplift.names,baseCents:null}};const raised=Math.round(base*(100+uplift.percent)/100);change+=raised-base;return{...day,[amountKey]:raised,promotion:{percent:uplift.percent,names:uplift.names,baseCents:base}};});
 const result={...projection,[dailyKey]:daily};
 if(Object.hasOwn(projection,'projectedSalesCents'))result.projectedSalesCents=Number.isSafeInteger(projection.projectedSalesCents)?projection.projectedSalesCents+change:projection.projectedSalesCents;
 if(Object.hasOwn(projection,'budgetCents')&&Number.isFinite(projection.budgetPercent)){result.budgetCents=Number.isSafeInteger(result.projectedSalesCents)?Math.round(result.projectedSalesCents*projection.budgetPercent/100):null;if(Object.hasOwn(projection,'remainingCents'))result.remainingCents=result.budgetCents===null||projection.pricePending?null:result.budgetCents-projection.spentCents;}
 return result;
}
// Cover images: JPEG, PNG or WebP up to 2 MB, kept beside the company's promotions file.
const imageTypes={jpeg:{mime:'image/jpeg',ext:'jpg',test:bytes=>bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff},png:{mime:'image/png',ext:'png',test:bytes=>bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))},webp:{mime:'image/webp',ext:'webp',test:bytes=>bytes.subarray(0,4).toString('latin1')==='RIFF'&&bytes.subarray(8,12).toString('latin1')==='WEBP'}};
const maxImageBytes=2000000;
function createStore(dir,{locations,now=Date.now,actuals,projection,salesOn=async()=>true,catalogue=async()=>({products:[]})}){
 const queues=new Map();
 // One write at a time per file.
 function queued(target,change){const previous=queues.get(target)||Promise.resolve(),operation=previous.then(change);queues.set(target,operation.catch(()=>{}));return operation;}
 async function writeFile(target,value){const temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}}
 const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now()));return['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
 const file=actor=>{if(!/^[a-zA-Z0-9-]{1,100}$/.test(actor?.companyId||''))fail('Select a company first.',403);return path.join(dir,'promotions',actor.companyId+'.json');};
 const imageFolder=companyId=>{if(!/^[a-zA-Z0-9-]{1,100}$/.test(companyId||''))fail('Select a company first.',403);return path.join(dir,'promotions',companyId+'-images');};
 const imagePath=(companyId,image)=>path.join(imageFolder(companyId),image.id+'.'+imageTypes[image.type].ext);
 const requireView=actor=>{if(!actor)fail('Sign-in required.',401);if(!can(actor,'sales.view'))fail('Sales viewing permission required.',403);if(!actor.companyId||!actor.locationId)fail('Select a location first.',403);};
 const requireEdit=actor=>{requireView(actor);if(!can(actor,'sales.edit'))fail('Sales editing permission required.',403);};
 async function read(actor){try{const value=JSON.parse(await fs.readFile(file(actor),'utf8'));return Array.isArray(value?.promotions)?value:{promotions:[]};}catch(error){if(error.code==='ENOENT')return{promotions:[]};throw error;}}
 // One write at a time per company file.
 function mutate(actor,change){const target=file(actor);return queued(target,async()=>{const state=await read(actor),result=await change(state);if(result.changed)await writeFile(target,state);return result.value;});}
 const features=async actor=>(await readSettings(dir,actor.companyId)).features;
 // Company feature switches: anyone with sales viewing reads them; changing them needs sales editing and all-location access.
 async function settings(actor){requireView(actor);const saved=await readSettings(dir,actor.companyId);return{revision:saved.revision,features:saved.features,canEdit:can(actor,'sales.edit')&&can(actor,'locations.all')};}
 async function saveSettings(actor,input){
  requireEdit(actor);if(!can(actor,'locations.all'))fail('Access to every location is needed to change promotion settings.',403);
  if(!Number.isSafeInteger(input?.revision))fail('Reload promotion settings before saving.');
  if(!input.features||typeof input.features!=='object'||Array.isArray(input.features)||Object.entries(input.features).some(([key,value])=>!model.featureIds.includes(key)||typeof value!=='boolean'))fail('Choose valid promotion features.');
  const target=path.join(dir,'promotions',actor.companyId+'-settings.json');
  return queued(target,async()=>{const saved=await readSettings(dir,actor.companyId);if(saved.revision!==input.revision)fail('Promotion settings changed since you opened them. Reload to see the latest.',409);
   const next={revision:saved.revision+1,features:{...saved.features,...input.features},updatedAt:new Date(now()).toISOString(),updatedBy:author(actor)};
   if(JSON.stringify(next.features)===JSON.stringify(saved.features))return{revision:saved.revision,features:saved.features,canEdit:true};
   await writeFile(target,next);return{revision:next.revision,features:next.features,canEdit:true};});
 }
 const products=async actor=>{try{return(await catalogue(actor.companyId))?.products||[];}catch{return[];}};
 // Active locations in the actor's company that the actor can reach.
 async function reachable(actor){return(await locations()).filter(location=>!location.archived&&location.active!==false&&(location.companyId||'default')===actor.companyId&&canAccessLocation(actor,location));}
 const visible=(promotion,actor)=>!promotion.deleted&&promotion.companyId===actor.companyId&&promotion.locationIds.includes(actor.locationId);
 function editable(promotion,actor,places){const ids=new Set(places.map(location=>location.id));return can(actor,'sales.edit')&&promotion.locationIds.every(id=>ids.has(id));}
 function present(promotion,actor,places){const names=new Map(places.map(location=>[location.id,location.name]));const{requestId,requestFingerprint,companyId,deleted,image,redemptions,...rest}=promotion;return{...rest,image:image?{id:image.id,url:'/api/promotions/'+promotion.id+'/image?v='+image.id}:null,locationNames:promotion.locationIds.map(id=>names.get(id)||'Another location'),status:model.status(promotion,today()),canEdit:editable(promotion,actor,places)};}
 async function checkLocations(actor,ids){const places=await reachable(actor),allowed=new Set(places.map(location=>location.id));if(ids.some(id=>!allowed.has(id)))fail('You can only choose active locations you can access.',403);return places;}
 const author=actor=>({id:actor.id,name:actor.name||actor.username||''});
 async function list(actor,{from,to}={}){
  requireView(actor);if((from&&!validDate(from))||(to&&!validDate(to)))fail('Choose valid dates.');
  const places=await reachable(actor),state=await read(actor);
  const items=state.promotions.filter(item=>visible(item,actor)&&(!from||!to||model.overlaps(item,from,to))).sort((a,b)=>b.startDate.localeCompare(a.startDate)||a.name.localeCompare(b.name)).map(item=>present(item,actor,places));
  const switches=await features(actor);
  return{today:today(),features:switches,canEditSettings:can(actor,'sales.edit')&&can(actor,'locations.all'),comms:{post:can(actor,'comms.post.company'),require:can(actor,'comms.require')},promotions:items,canEdit:can(actor,'sales.edit'),locations:can(actor,'sales.edit')?places.map(location=>({id:location.id,name:location.name})).sort((a,b)=>a.name.localeCompare(b.name)):[],locationId:actor.locationId};
 }
 async function create(actor,input){
  requireEdit(actor);if(!uuid(input?.requestId))fail('Refresh the page before adding a promotion.');
  const switches=await features(actor),values=details(input,null,{features:switches,products:switches.items&&Array.isArray(input?.itemIds)&&input.itemIds.length?await products(actor):null}),places=await checkLocations(actor,values.locationIds),print=fingerprint(values);
  return mutate(actor,state=>{
   const existing=state.promotions.find(item=>item.requestId===input.requestId);
   if(existing){if(existing.createdBy?.id!==actor.id||existing.requestFingerprint!==print)fail('This promotion was already saved with different details. Reload and try again.',409);return{changed:false,value:present(existing,actor,places)};}
   const stamp=new Date(now()).toISOString(),record=assign({id:crypto.randomUUID(),companyId:actor.companyId},values);Object.assign(record,{revision:1,requestId:input.requestId,requestFingerprint:print,createdAt:stamp,createdBy:author(actor),updatedAt:stamp,updatedBy:author(actor)});
   state.promotions.push(record);return{changed:true,value:present(record,actor,places)};
  });
 }
 async function update(actor,id,input){
  requireEdit(actor);if(!uuid(id))fail('Promotion not found.',404);if(!Number.isSafeInteger(input?.revision))fail('Reload the promotion before saving.');
  const switches=await features(actor),catalogueItems=switches.items&&Array.isArray(input?.itemIds)&&input.itemIds.length?await products(actor):null;
  if(!Array.isArray(input.locationIds)||!input.locationIds.length||input.locationIds.some(id=>typeof id!=='string'))fail('Choose the locations running this promotion.');const places=await checkLocations(actor,input.locationIds);
  return mutate(actor,state=>{
   const record=state.promotions.find(item=>item.id===id&&!item.deleted&&item.companyId===actor.companyId);
   if(!record||!visible(record,actor))fail('Promotion not found.',404);
   const values=details(input,record,{features:switches,products:catalogueItems});
   if(!editable(record,actor,places))fail('Access to every location running this promotion is needed to change it.',403);
   if(record.revision!==input.revision)fail('This promotion changed since you opened it. Reload to see the latest version.',409);
   assign(record,values);Object.assign(record,{revision:record.revision+1,updatedAt:new Date(now()).toISOString(),updatedBy:author(actor)});
   return{changed:true,value:present(record,actor,places)};
  });
 }
 async function remove(actor,id,input){
  requireEdit(actor);if(!uuid(id))fail('Promotion not found.',404);if(!Number.isSafeInteger(input?.revision))fail('Reload the promotion before deleting it.');
  const places=await reachable(actor);
  return mutate(actor,state=>{
   const record=state.promotions.find(item=>item.id===id&&item.companyId===actor.companyId);
   if(record?.deleted&&record.deletedBy?.id===actor.id)return{changed:false,value:{deleted:true,id}};
   if(!record||!visible(record,actor))fail('Promotion not found.',404);
   if(!editable(record,actor,places))fail('Access to every location running this promotion is needed to delete it.',403);
   if(record.revision!==input.revision)fail('This promotion changed since you opened it. Reload to see the latest version.',409);
   // Kept as a hidden record so a repeated delete stays harmless.
   if(record.image){fs.rm(imagePath(record.companyId,record.image),{force:true}).catch(()=>{});delete record.image;}
   Object.assign(record,{deleted:true,revision:record.revision+1,deletedAt:new Date(now()).toISOString(),deletedBy:author(actor)});
   return{changed:true,value:{deleted:true,id}};
  });
 }
 // Saved sales versus the normal projection on each promotion day up to today at one location.
 // Repeating promotions only count their chosen weekdays.
 async function compare(place,record,current){
  const last=record.endDate<current?record.endDate:current,result={days:[],recordedDays:0,comparedDays:0,actualCents:null,projectedCents:null,differenceCents:null,differencePercent:null};
  if(record.startDate>current)return result;
  const dates=[];for(let date=record.startDate;date<=last;date=shift(date,1))if(model.covers(record,date))dates.push(date);
  const starts=[...new Set(dates.map(monday))];
  const [records,forecasts]=await Promise.all([actuals(place,starts),Promise.all(starts.map(week=>projection(place,week)))]);
  for(const date of dates){
   const index=starts.indexOf(monday(date)),day=model.weekday(date);
   const actual=records[index]?.days?.[day],projected=forecasts[index]?.days?.[day],channel=records[index]?.channels?.[day];
   result.days.push({date,actualCents:Number.isSafeInteger(actual)?actual:null,projectedCents:Number.isSafeInteger(projected)?projected:null,channels:channel||null});
  }
  let actualCents=0,projectedCents=0;
  for(const day of result.days){if(day.actualCents!==null)result.recordedDays++;if(day.actualCents!==null&&day.projectedCents!==null){result.comparedDays++;actualCents+=day.actualCents;projectedCents+=day.projectedCents;}}
  if(result.comparedDays){result.actualCents=actualCents;result.projectedCents=projectedCents;result.differenceCents=actualCents-projectedCents;result.differencePercent=projectedCents>0?Math.round((actualCents-projectedCents)/projectedCents*1000)/10:null;}
  return result;
 }
 // The same session pinned to another location (its legacy sales folders belong to the selected location only).
 const at=(actor,locationId)=>locationId===actor.locationId?actor:{...actor,locationId,legacyAccountIds:[]};
 const pick=({comparedDays,recordedDays,actualCents,projectedCents,differenceCents,differencePercent})=>({comparedDays,recordedDays,actualCents,projectedCents,differenceCents,differencePercent});
 async function performance(actor,id){
  requireView(actor);if(!uuid(id))fail('Promotion not found.',404);
  const state=await read(actor),record=state.promotions.find(item=>item.id===id);
  if(!record||!visible(record,actor))fail('Promotion not found.',404);
  const current=today(),switches=await features(actor),base={id,today:current,locationId:actor.locationId,features:switches};
  if(record.startDate>current)return{...base,days:[],recordedDays:0,comparedDays:0,actualCents:null,projectedCents:null,differenceCents:null,differencePercent:null,status:'upcoming'};
  const result={...base,...await compare(actor,record,current),status:model.status(record,current)};
  const compared=result.days.filter(day=>day.actualCents!==null&&day.projectedCents!==null);
  if(switches.redemptions){
   const saved=record.redemptions?.[actor.locationId]||{},cost=redemptionCost(record);let count=0,counted=0;
   for(const day of result.days){day.redemptions=Number.isSafeInteger(saved[day.date])?saved[day.date]:null;if(day.redemptions!==null){count+=day.redemptions;counted++;}}
   // Extra sales per redemption only use days with a sale, a projection and a count.
   const both=compared.filter(day=>day.redemptions!==null),extra=both.reduce((sum,day)=>sum+day.actualCents-day.projectedCents,0),redeemed=both.reduce((sum,day)=>sum+day.redemptions,0);
   result.redemptions={count:counted?count:null,days:counted,costPerRedemptionCents:cost,costCents:counted&&cost!==null?count*cost:null,extraPerRedemptionCents:redeemed>0?Math.round(extra/redeemed):null,netCents:both.length&&cost!==null?extra-redeemed*cost:null,comparedDays:both.length,canEdit:editable(record,actor,await reachable(actor))};
  }else for(const day of result.days)delete day.redemptions;
  if(switches.results&&compared.length){
   const ranked=[...compared].sort((a,b)=>(b.actualCents-b.projectedCents)-(a.actualCents-a.projectedCents)||a.date.localeCompare(b.date));
   result.best={date:ranked[0].date,differenceCents:ranked[0].actualCents-ranked[0].projectedCents};
   result.worst={date:ranked.at(-1).date,differenceCents:ranked.at(-1).actualCents-ranked.at(-1).projectedCents};
   // In-store (Weekly report Till) versus delivery (Uber Eats + DoorDash) on days with a complete Weekly report.
   const split=result.days.filter(day=>day.channels);
   result.channels=split.length?{days:split.length,inStoreCents:split.reduce((sum,day)=>sum+day.channels.tillSales,0),deliveryCents:split.reduce((sum,day)=>sum+day.channels.uberEats+day.channels.doorDash,0)}:null;
  }
  if(switches.results){
   const places=await reachable(actor),names=new Map(places.map(place=>[place.id,place.name]));
   const ids=record.locationIds.filter(locationId=>names.has(locationId)).slice(0,30);
   if(ids.length>1)result.stores=(await Promise.all(ids.map(async locationId=>({locationId,name:names.get(locationId),...pick(locationId===actor.locationId?result:await compare(at(actor,locationId),record,current))})))).sort((a,b)=>(b.differencePercent??-Infinity)-(a.differencePercent??-Infinity)||a.name.localeCompare(b.name));
  }
  if(switches.repeat&&model.repeats(record)){
   // One row per week the promotion repeated in.
   const weeks=new Map();for(const day of result.days){const week=monday(day.date),entry=weeks.get(week)||{weekStart:week,dates:[],actualCents:0,projectedCents:0,comparedDays:0};entry.dates.push(day.date);if(day.actualCents!==null&&day.projectedCents!==null){entry.comparedDays++;entry.actualCents+=day.actualCents;entry.projectedCents+=day.projectedCents;}weeks.set(week,entry);}
   result.occurrences=[...weeks.values()].map(entry=>entry.comparedDays?{...entry,differenceCents:entry.actualCents-entry.projectedCents,differencePercent:entry.projectedCents>0?Math.round((entry.actualCents-entry.projectedCents)/entry.projectedCents*1000)/10:null}:{...entry,actualCents:null,projectedCents:null,differenceCents:null,differencePercent:null});
  }
  if(!switches.results)for(const day of result.days)delete day.channels;
  return result;
 }
 // Promotions that have started at the selected location, ranked by their lift over the normal projection.
 async function leaderboard(actor){
  requireView(actor);const switches=await features(actor);if(!switches.reporting)return{enabled:false,rows:[]};
  const current=today(),state=await read(actor),started=state.promotions.filter(item=>visible(item,actor)&&item.startDate<=current).sort((a,b)=>b.startDate.localeCompare(a.startDate)).slice(0,40);
  const rows=await Promise.all(started.map(async item=>({id:item.id,name:item.name,offer:model.offer(item),startDate:item.startDate,endDate:item.endDate,status:model.status(item,current),weekdays:item.weekdays||null,...pick(await compare(actor,item,current))})));
  rows.sort((a,b)=>(b.differencePercent??-Infinity)-(a.differencePercent??-Infinity)||b.startDate.localeCompare(a.startDate));
  // Competition ranks; promotions without a comparable percentage stay unranked.
  let rank=0;rows.forEach((row,index)=>{if(row.differencePercent===null){row.rank=null;return;}rank=index>0&&rows[index-1].differencePercent===row.differencePercent?rank:index+1;row.rank=rank;});
  return{enabled:true,today:current,locationId:actor.locationId,rows};
 }
 // Record (or clear) one day's redemption count at the selected location.
 async function setRedemptions(actor,id,input){
  requireEdit(actor);if(!uuid(id))fail('Promotion not found.',404);if(!(await features(actor)).redemptions)fail('Redemptions are switched off for this company.',403);
  if(!validDate(input?.date))fail('Choose a promotion day.');
  if(input.count!==null&&(!Number.isSafeInteger(input.count)||input.count<0||input.count>1000000))fail('Enter a whole number of redemptions from 0 to 1,000,000.');
  if(input.previous!==null&&!Number.isSafeInteger(input.previous))fail('Reload the promotion before recording redemptions.');
  const places=await reachable(actor);if(!places.some(place=>place.id===actor.locationId))fail('Location access required.',403);
  return mutate(actor,state=>{
   const record=state.promotions.find(item=>item.id===id&&!item.deleted&&item.companyId===actor.companyId);
   if(!record||!visible(record,actor))fail('Promotion not found.',404);
   if(!editable(record,actor,places))fail('Access to every location running this promotion is needed to record redemptions.',403);
   if(!model.covers(record,input.date)||input.date>today())fail('Choose a day the promotion has already run.');
   const saved=record.redemptions?.[actor.locationId]?.[input.date],existing=Number.isSafeInteger(saved)?saved:null;
   if(existing===input.count)return{changed:false,value:{date:input.date,count:existing}};
   if(existing!==input.previous)fail('Redemptions for this day changed since you opened them. Reload to see the latest.',409);
   record.redemptions||={};const days=record.redemptions[actor.locationId]||(record.redemptions[actor.locationId]={});
   if(input.count===null)delete days[input.date];else days[input.date]=input.count;
   return{changed:true,value:{date:input.date,count:input.count}};
  });
 }
 // Promotions on today at a location (name, offer and dates only) for staff awareness notifications.
 async function todayList(place){
  if(!place?.companyId||!place?.locationId||!companyOk(place.companyId)||!(await salesOn())||!(await features(place)).staff)return[];
  const current=today(),state=await read(place);
  return state.promotions.filter(item=>!item.deleted&&item.companyId===place.companyId&&item.locationIds.includes(place.locationId)&&model.covers(item,current))
   .sort((a,b)=>a.name.localeCompare(b.name)).slice(0,12).map(item=>({id:item.id,name:item.name,offer:model.offer(item),channels:item.channels,startDate:item.startDate,endDate:item.endDate,weekdays:item.weekdays||null,date:current}));
 }
 // Stock items linked to promotions on now or within the next 7 days at a location (no sales figures).
 async function itemFlags(place){
  if(!place?.companyId||!place?.locationId||!companyOk(place.companyId)||!(await salesOn()))return{enabled:false,items:{}};
  const switches=await features(place);if(!switches.items)return{enabled:false,items:{}};
  const current=today(),state=await read(place),window=Array.from({length:8},(_,index)=>shift(current,index)),items={};
  for(const promotion of state.promotions){
   if(promotion.deleted||promotion.companyId!==place.companyId||!promotion.locationIds.includes(place.locationId)||!promotion.items?.length)continue;
   const next=window.find(date=>model.covers(promotion,date));if(!next)continue;
   for(const item of promotion.items)(items[item.id]||=[]).push({id:promotion.id,name:promotion.name,offer:model.offer(promotion),startDate:promotion.startDate,endDate:promotion.endDate,next,onToday:next===current,expectedUplift:switches.uplift&&Number.isInteger(promotion.expectedUplift)?promotion.expectedUplift:null});
  }
  return{enabled:true,today:current,items};
 }
 // Company stock items a promotion can link to (sales editors only).
 async function catalogueItems(actor){requireEdit(actor);if(!(await features(actor)).items)return{items:[]};return{items:(await products(actor)).filter(item=>item&&item.id&&item.name&&item.active!==false).map(item=>({id:String(item.id),name:String(item.name),unitAmount:item.unitAmount||'',sku:item.sku||''})).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,2000)};}
 // Replace or remove a promotion's cover image (sales editors with access to every listed location).
 async function setImage(actor,id,input){
  requireEdit(actor);if(!uuid(id))fail('Promotion not found.',404);if(!Number.isSafeInteger(input?.revision))fail('Reload the promotion before changing its image.');
  let image=null,bytes=null;
  if(input.data!==null){
   if(typeof input.data!=='string'||!input.data.length||input.data.length>Math.ceil(maxImageBytes/3)*4+4||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))fail('Choose a JPEG, PNG or WebP image up to 2 MB.');
   bytes=Buffer.from(input.data,'base64');const type=Object.keys(imageTypes).find(key=>imageTypes[key].test(bytes));
   if(!type||bytes.length>maxImageBytes)fail('Choose a JPEG, PNG or WebP image up to 2 MB.');image={id:crypto.randomUUID(),type};
  }
  const places=await reachable(actor);
  return mutate(actor,async state=>{
   const record=state.promotions.find(item=>item.id===id&&!item.deleted&&item.companyId===actor.companyId);
   if(!record||!visible(record,actor))fail('Promotion not found.',404);
   if(!editable(record,actor,places))fail('Access to every location running this promotion is needed to change it.',403);
   if(record.revision!==input.revision)fail('This promotion changed since you opened it. Reload to see the latest version.',409);
   const previous=record.image;
   if(image){const target=imagePath(actor.companyId,image),temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temp,bytes,{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}record.image={...image,updatedAt:new Date(now()).toISOString()};}
   else delete record.image;
   Object.assign(record,{revision:record.revision+1,updatedAt:new Date(now()).toISOString(),updatedBy:author(actor)});
   if(previous)fs.rm(imagePath(actor.companyId,previous),{force:true}).catch(()=>{});
   return{changed:true,value:present(record,actor,places)};
  });
 }
 // Public-facing summary for Home and the kiosk: running promotions (and, when asked, ones starting soon) at one location.
 // Never includes notes, authors or sales results.
 async function showcase(place,{upcomingDays=0,imageBase='/api/promotions/'}={}){
  if(!place?.companyId||!place?.locationId||!(await salesOn()))return[];
  const current=today(),horizon=shift(current,upcomingDays),state=await read(place);
  return state.promotions.filter(item=>!item.deleted&&item.companyId===place.companyId&&item.locationIds.includes(place.locationId)&&item.endDate>=current&&item.startDate<=horizon)
   .sort((a,b)=>(a.startDate<=current?0:1)-(b.startDate<=current?0:1)||a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name)).slice(0,12)
   .map(item=>({id:item.id,name:item.name,offer:model.offer(item),channels:item.channels,startDate:item.startDate,endDate:item.endDate,status:model.status(item,current),image:item.image?{id:item.image.id,url:imageBase+item.id+'/image?v='+item.image.id}:null}));
 }
 // The stored cover image for a promotion that includes this location (and is still running or upcoming when `current` is set).
 async function imageFile(place,id,{current=false}={}){
  if(!uuid(id)||!place?.companyId||!place?.locationId||!(await salesOn()))fail('Image not found.',404);
  const record=(await read(place)).promotions.find(item=>item.id===id&&!item.deleted&&item.companyId===place.companyId&&item.locationIds.includes(place.locationId));
  if(!record?.image||current&&record.endDate<today())fail('Image not found.',404);
  try{return{bytes:await fs.readFile(imagePath(place.companyId,record.image)),mime:imageTypes[record.image.type].mime,id:record.image.id};}catch(error){if(error.code==='ENOENT')fail('Image not found.',404);throw error;}
 }
 return{list,create,update,remove,performance,leaderboard,setRedemptions,settings,saveSettings,today:todayList,itemFlags,catalogueItems,setImage,showcase,imageFile};
}
function sendImage(res,image){res.writeHead(200,{'Content-Type':image.mime,'Content-Length':image.bytes.length,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Cross-Origin-Resource-Policy':'same-origin'});res.end(image.bytes);}
async function route({req,res,url,params,session,store,body,json}){
 if(url==='/api/home-promotions'){
  if(!session)fail('Sign-in required.',401);if(req.method!=='GET')fail('Use GET for Home promotions.',405);if(!can(session,'home.view'))fail('Home viewing permission required.',403);
  res.setHeader('Cache-Control','no-store');json(200,{promotions:await store.showcase(session,{upcomingDays:7})});return true;
 }
 if(url!=='/api/promotions'&&!url.startsWith('/api/promotions/'))return false;
 if(!session)fail('Sign-in required.',401);
 // Read-only staff and stock views that never include sales figures.
 if(url==='/api/promotions/today'){if(req.method!=='GET')fail('Use GET for today’s promotions.',405);if(!['home.view','ops.view','sales.view'].some(key=>can(session,key)))fail('Permission required.',403);res.setHeader('Cache-Control','no-store');json(200,{promotions:await store.today(session)});return true;}
 if(url==='/api/promotions/items'){if(req.method!=='GET')fail('Use GET for promotion products.',405);if(!['orders.view','counts.view','sales.view'].some(key=>can(session,key)))fail('Permission required.',403);res.setHeader('Cache-Control','no-store');json(200,await store.itemFlags(session));return true;}
 const imageRead=req.method==='GET'&&url.match(/^\/api\/promotions\/([a-f0-9-]{36})\/image$/i);
 if(imageRead){if(!can(session,'sales.view')&&!can(session,'home.view'))fail('Image not found.',404);sendImage(res,await store.imageFile(session,imageRead[1]));return true;}if(!can(session,'sales.view'))fail('Sales viewing permission required.',403);
 if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/promotions'&&req.method==='GET'){json(200,await store.list(session,{from:params.get('from')||undefined,to:params.get('to')||undefined}));return true;}
 if(url==='/api/promotions'&&req.method==='POST'){json(201,await store.create(session,await body(req,32000)));return true;}
 let match=url.match(/^\/api\/promotions\/([a-f0-9-]{36})$/i);
 if(match&&req.method==='PUT'){json(200,await store.update(session,match[1],await body(req,32000)));return true;}
 if(match&&req.method==='DELETE'){json(200,await store.remove(session,match[1],await body(req,4000)));return true;}
 match=url.match(/^\/api\/promotions\/([a-f0-9-]{36})\/image$/i);
 if(match&&req.method==='PUT'){json(200,await store.setImage(session,match[1],await body(req,3000000)));return true;}
 if(match&&req.method==='DELETE'){const input=await body(req,4000);json(200,await store.setImage(session,match[1],{...input,data:null}));return true;}
 if(url==='/api/promotions/settings'&&req.method==='GET'){json(200,await store.settings(session));return true;}
 if(url==='/api/promotions/settings'&&req.method==='PUT'){json(200,await store.saveSettings(session,await body(req,4000)));return true;}
 if(url==='/api/promotions/leaderboard'&&req.method==='GET'){json(200,await store.leaderboard(session));return true;}
 if(url==='/api/promotions/catalogue'&&req.method==='GET'){json(200,await store.catalogueItems(session));return true;}
 match=url.match(/^\/api\/promotions\/([a-f0-9-]{36})\/redemptions$/i);
 if(match&&req.method==='PUT'){json(200,await store.setRedemptions(session,match[1],await body(req,4000)));return true;}
 match=url.match(/^\/api\/promotions\/([a-f0-9-]{36})\/performance$/i);
 if(match&&req.method==='GET'){json(200,await store.performance(session,match[1]));return true;}
 fail('Promotion endpoint not found.',404);
}
module.exports={createStore,route,details,sendImage,readSettings,upliftFor,applyUplift,melbourneDate};
