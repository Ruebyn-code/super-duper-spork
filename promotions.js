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
function details(input){
 if(!input||typeof input!=='object')fail('Enter the promotion details.');
 const name=text(input.name,120,'Promotion name',true),type=model.kind(input.kind);if(!type)fail('Choose a promotion type.');
 let value=null;
 if(type.value==='percent'){if(!Number.isInteger(input.value)||input.value<1||input.value>100)fail('Enter a discount from 1% to 100%.');value=input.value;}
 if(type.value==='cents'){if(!Number.isSafeInteger(input.value)||input.value<1||input.value>100000000)fail(type.id==='price'?'Enter the special price.':'Enter the amount off.');value=input.value;}
 if(!Array.isArray(input.channels)||!input.channels.length)fail('Choose at least one sales channel.');
 const channels=model.channels.map(item=>item.id).filter(id=>input.channels.includes(id));if(channels.length!==new Set(input.channels).size)fail('Choose valid sales channels.');
 if(!validDate(input.startDate)||!validDate(input.endDate))fail('Choose valid start and end dates.');
 if(input.endDate<input.startDate)fail('The end date must be on or after the start date.');
 if(model.days(input.startDate,input.endDate)>model.maxDays)fail('A promotion can run for up to '+model.maxDays+' days.');
 if(!Array.isArray(input.locationIds)||!input.locationIds.length||input.locationIds.length>500||new Set(input.locationIds).size!==input.locationIds.length||input.locationIds.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id)))fail('Choose the locations running this promotion.');
 return{name,kind:type.id,value,channels,startDate:input.startDate,endDate:input.endDate,locationIds:[...input.locationIds],notes:text(input.notes,500,'Notes')};
}
// Cover images: JPEG, PNG or WebP up to 2 MB, kept beside the company's promotions file.
const imageTypes={jpeg:{mime:'image/jpeg',ext:'jpg',test:bytes=>bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff},png:{mime:'image/png',ext:'png',test:bytes=>bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))},webp:{mime:'image/webp',ext:'webp',test:bytes=>bytes.subarray(0,4).toString('latin1')==='RIFF'&&bytes.subarray(8,12).toString('latin1')==='WEBP'}};
const maxImageBytes=2000000;
function createStore(dir,{locations,now=Date.now,actuals,projection,salesOn=async()=>true}){
 const queues=new Map();
 const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now()));return['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');};
 const file=actor=>{if(!/^[a-zA-Z0-9-]{1,100}$/.test(actor?.companyId||''))fail('Select a company first.',403);return path.join(dir,'promotions',actor.companyId+'.json');};
 const imageFolder=companyId=>{if(!/^[a-zA-Z0-9-]{1,100}$/.test(companyId||''))fail('Select a company first.',403);return path.join(dir,'promotions',companyId+'-images');};
 const imagePath=(companyId,image)=>path.join(imageFolder(companyId),image.id+'.'+imageTypes[image.type].ext);
 const requireView=actor=>{if(!actor)fail('Sign-in required.',401);if(!can(actor,'sales.view'))fail('Sales viewing permission required.',403);if(!actor.companyId||!actor.locationId)fail('Select a location first.',403);};
 const requireEdit=actor=>{requireView(actor);if(!can(actor,'sales.edit'))fail('Sales editing permission required.',403);};
 async function read(actor){try{const value=JSON.parse(await fs.readFile(file(actor),'utf8'));return Array.isArray(value?.promotions)?value:{promotions:[]};}catch(error){if(error.code==='ENOENT')return{promotions:[]};throw error;}}
 // One write at a time per company file.
 function mutate(actor,change){const target=file(actor),previous=queues.get(target)||Promise.resolve(),operation=previous.then(async()=>{const state=await read(actor),result=await change(state);if(result.changed){const temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(state,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}}return result.value;});queues.set(target,operation.catch(()=>{}));return operation;}
 // Active locations in the actor's company that the actor can reach.
 async function reachable(actor){return(await locations()).filter(location=>!location.archived&&location.active!==false&&(location.companyId||'default')===actor.companyId&&canAccessLocation(actor,location));}
 const visible=(promotion,actor)=>!promotion.deleted&&promotion.companyId===actor.companyId&&promotion.locationIds.includes(actor.locationId);
 function editable(promotion,actor,places){const ids=new Set(places.map(location=>location.id));return can(actor,'sales.edit')&&promotion.locationIds.every(id=>ids.has(id));}
 function present(promotion,actor,places){const names=new Map(places.map(location=>[location.id,location.name]));const{requestId,requestFingerprint,companyId,deleted,image,...rest}=promotion;return{...rest,image:image?{id:image.id,url:'/api/promotions/'+promotion.id+'/image?v='+image.id}:null,locationNames:promotion.locationIds.map(id=>names.get(id)||'Another location'),status:model.status(promotion,today()),canEdit:editable(promotion,actor,places)};}
 async function checkLocations(actor,ids){const places=await reachable(actor),allowed=new Set(places.map(location=>location.id));if(ids.some(id=>!allowed.has(id)))fail('You can only choose active locations you can access.',403);return places;}
 const author=actor=>({id:actor.id,name:actor.name||actor.username||''});
 async function list(actor,{from,to}={}){
  requireView(actor);if((from&&!validDate(from))||(to&&!validDate(to)))fail('Choose valid dates.');
  const places=await reachable(actor),state=await read(actor);
  const items=state.promotions.filter(item=>visible(item,actor)&&(!from||!to||model.overlaps(item,from,to))).sort((a,b)=>b.startDate.localeCompare(a.startDate)||a.name.localeCompare(b.name)).map(item=>present(item,actor,places));
  return{today:today(),promotions:items,canEdit:can(actor,'sales.edit'),locations:can(actor,'sales.edit')?places.map(location=>({id:location.id,name:location.name})).sort((a,b)=>a.name.localeCompare(b.name)):[],locationId:actor.locationId};
 }
 async function create(actor,input){
  requireEdit(actor);if(!uuid(input?.requestId))fail('Refresh the page before adding a promotion.');
  const values=details(input),places=await checkLocations(actor,values.locationIds),print=fingerprint(values);
  return mutate(actor,state=>{
   const existing=state.promotions.find(item=>item.requestId===input.requestId);
   if(existing){if(existing.createdBy?.id!==actor.id||existing.requestFingerprint!==print)fail('This promotion was already saved with different details. Reload and try again.',409);return{changed:false,value:present(existing,actor,places)};}
   const stamp=new Date(now()).toISOString(),record={id:crypto.randomUUID(),companyId:actor.companyId,...values,revision:1,requestId:input.requestId,requestFingerprint:print,createdAt:stamp,createdBy:author(actor),updatedAt:stamp,updatedBy:author(actor)};
   state.promotions.push(record);return{changed:true,value:present(record,actor,places)};
  });
 }
 async function update(actor,id,input){
  requireEdit(actor);if(!uuid(id))fail('Promotion not found.',404);if(!Number.isSafeInteger(input?.revision))fail('Reload the promotion before saving.');
  const values=details(input),places=await checkLocations(actor,values.locationIds);
  return mutate(actor,state=>{
   const record=state.promotions.find(item=>item.id===id&&!item.deleted&&item.companyId===actor.companyId);
   if(!record||!visible(record,actor))fail('Promotion not found.',404);
   if(!editable(record,actor,places))fail('Access to every location running this promotion is needed to change it.',403);
   if(record.revision!==input.revision)fail('This promotion changed since you opened it. Reload to see the latest version.',409);
   Object.assign(record,values,{revision:record.revision+1,updatedAt:new Date(now()).toISOString(),updatedBy:author(actor)});
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
 // Saved sales versus the normal projection for each promotion day up to today, at the selected location.
 async function performance(actor,id){
  requireView(actor);if(!uuid(id))fail('Promotion not found.',404);
  const state=await read(actor),record=state.promotions.find(item=>item.id===id);
  if(!record||!visible(record,actor))fail('Promotion not found.',404);
  const current=today(),last=record.endDate<current?record.endDate:current,result={id,today:current,locationId:actor.locationId,days:[],recordedDays:0,comparedDays:0,actualCents:null,projectedCents:null,differenceCents:null,differencePercent:null};
  if(record.startDate>current)return{...result,status:'upcoming'};
  const starts=[];for(let week=monday(record.startDate);week<=last;week=shift(week,7))starts.push(week);
  const [records,forecasts]=await Promise.all([actuals(actor,starts),Promise.all(starts.map(week=>projection(actor,week)))]);
  for(let date=record.startDate;date<=last;date=shift(date,1)){
   const index=starts.indexOf(monday(date)),day=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;
   const actual=records[index]?.days?.[day],projected=forecasts[index]?.days?.[day];
   result.days.push({date,actualCents:Number.isSafeInteger(actual)?actual:null,projectedCents:Number.isSafeInteger(projected)?projected:null});
  }
  let actualCents=0,projectedCents=0;
  for(const day of result.days){if(day.actualCents!==null)result.recordedDays++;if(day.actualCents!==null&&day.projectedCents!==null){result.comparedDays++;actualCents+=day.actualCents;projectedCents+=day.projectedCents;}}
  if(result.comparedDays){result.actualCents=actualCents;result.projectedCents=projectedCents;result.differenceCents=actualCents-projectedCents;result.differencePercent=projectedCents>0?Math.round((actualCents-projectedCents)/projectedCents*1000)/10:null;}
  return{...result,status:model.status(record,current)};
 }
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
 return{list,create,update,remove,performance,setImage,showcase,imageFile};
}
function sendImage(res,image){res.writeHead(200,{'Content-Type':image.mime,'Content-Length':image.bytes.length,'Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Cross-Origin-Resource-Policy':'same-origin'});res.end(image.bytes);}
async function route({req,res,url,params,session,store,body,json}){
 if(url==='/api/home-promotions'){
  if(!session)fail('Sign-in required.',401);if(req.method!=='GET')fail('Use GET for Home promotions.',405);if(!can(session,'home.view'))fail('Home viewing permission required.',403);
  res.setHeader('Cache-Control','no-store');json(200,{promotions:await store.showcase(session,{upcomingDays:7})});return true;
 }
 if(url!=='/api/promotions'&&!url.startsWith('/api/promotions/'))return false;
 if(!session)fail('Sign-in required.',401);
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
 match=url.match(/^\/api\/promotions\/([a-f0-9-]{36})\/performance$/i);
 if(match&&req.method==='GET'){json(200,await store.performance(session,match[1]));return true;}
 fail('Promotion endpoint not found.',404);
}
module.exports={createStore,route,details,sendImage};
