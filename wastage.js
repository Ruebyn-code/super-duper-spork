const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),units=require('./public/stock-count-units'),individual=require('./public/stock-individual-units'),model=require('./public/wastage-model'),csv=require('./public/reporting-export').csv;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validDate=value=>typeof value==='string'&&/^20\d\d-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const validQuantity=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=1000000&&Math.abs(value*1000-Math.round(value*1000))<.000001;
function createStore(dir,{catalogues,context,now=Date.now}){
 const file=path.join(dir,'wastage.json');let pending=Promise.resolve();
 const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now()));return['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');};
 const requireAccess=(actor,key='wastage.view')=>{if(!can(actor,'wastage.view')||!can(actor,key))fail('Your permission level does not allow this wastage action.',403);if(!actor.companyId||!actor.locationId)fail('Select a location first.',403);};
 const belongs=(record,actor)=>record.companyId===actor.companyId&&record.locationId===actor.locationId;
 async function read(){try{const records=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(records))throw Error('Invalid wastage storage.');return records;}catch(error){if(error.code==='ENOENT')return[];throw error;}}
 function mutate(change){const operation=pending.then(async()=>{const records=await read(),result=await change(records),temp=file+'.'+crypto.randomUUID()+'.tmp';if(!result.changed)return result.record;await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temp,JSON.stringify(records,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result.record;});pending=operation.catch(()=>{});return operation;}
 function view(record,actor){const {fingerprint,requestId,voidRequestId,...visible}=record;return{...visible,canVoid:record.status==='recorded'&&can(actor,'wastage.void')};}
 async function fresh(actor,key){const current=await context(actor,actor.locationId);if(current.id!==actor.id||current.companyId!==actor.companyId||current.locationId!==actor.locationId)fail('The wastage location changed. Reopen the page.',409);requireAccess(current,key);return current;}
 async function options(actor){requireAccess(actor);const catalogue=await catalogues.read(actor.companyId);return{companyId:actor.companyId,locationId:actor.locationId,locationName:actor.locationName,today:today(),reasons:model.reasons,canRecord:can(actor,'wastage.record'),canVoid:can(actor,'wastage.void'),canExport:can(actor,'wastage.export'),products:catalogue.products.filter(p=>!p.archived).map(p=>({id:p.id,name:p.name,sku:p.sku||'',unitAmount:p.unitAmount||'',orderUnitName:p.orderUnitName||'',price:Number.isSafeInteger(p.price)&&p.price>=0?p.price:null,countUnit:units.normalize(p.countUnit),units:individual.allowed(p),individualUnit:individual.individual(p),category:p.category||'',supplier:catalogue.suppliers.find(s=>s.id===p.supplierId)?.name||''}))};}
 function range(params){const from=params.get('from'),to=params.get('to');if(!validDate(from)||!validDate(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>365)fail('Choose a valid date range of up to one year.');return{from,to};}
 async function list(actor,params){requireAccess(actor);const period=range(params);await pending;const records=(await read()).filter(r=>belongs(r,actor)&&r.wasteDate>=period.from&&r.wasteDate<=period.to).sort((a,b)=>b.wasteDate.localeCompare(a.wasteDate)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)).map(r=>view(r,actor));return{companyId:actor.companyId,locationId:actor.locationId,period,records,summary:model.summarize(records)};}
 async function create(actor,input){
  requireAccess(actor,'wastage.record');if(!input||!uuid(input.requestId)||!validDate(input.wasteDate)||input.wasteDate>today()||typeof input.notes!=='string'||input.notes.length>1000||!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Choose a past or current wastage date and 1–100 stock items. Notes may contain up to 1,000 characters.');
  const seen=new Set(),items=input.items.map(item=>{if(!item||typeof item.id!=='string'||!item.id||item.id.length>240||typeof item.unitAmount!=='string'||item.unitAmount.length>240||seen.has(item.id)||!validQuantity(item.quantity)||!model.reasons.some(r=>r.id===item.reason)||item.countUnit!==undefined&&!units.valid(item.countUnit))fail('Choose distinct stock items, a reason and a positive quantity with up to three decimal places.');seen.add(item.id);return{id:item.id,unitAmount:item.unitAmount,quantity:item.quantity,reason:item.reason,...(item.countUnit===undefined?{}:{countUnit:units.normalize(item.countUnit)})};}).sort((a,b)=>a.id.localeCompare(b.id));
  const normalized={wasteDate:input.wasteDate,notes:input.notes.trim(),items},fingerprint=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  return mutate(async records=>{
   const current=await fresh(actor,'wastage.record'),previous=records.find(r=>r.requestId===input.requestId);if(previous){if(!belongs(previous,current)||previous.createdBy.id!==current.id||previous.fingerprint!==fingerprint)fail('This wastage reference has already been used.',409);return{changed:false,record:view(previous,current)};}
   const catalogue=await catalogues.read(current.companyId),lines=items.map(item=>{
    const product=catalogue.products.find(p=>p.id===item.id&&!p.archived);if(!product)fail('A stock item is no longer available. Reload the items before saving.',409);
    if(item.unitAmount!==(product.unitAmount||'')||item.countUnit&&!individual.allowed(product).some(unit=>units.equal(unit,item.countUnit)))fail(product.name+': the pack or counting unit changed. Reload the items and enter its quantity again.',409);
    const quantity=units.quantity(item.quantity,item.countUnit);if(quantity<=0)fail(product.name+': enter enough to represent at least 0.001 of an ordered pack.');
    const unitCostCents=Number.isSafeInteger(product.price)&&product.price>=0?product.price:null,totalCents=unitCostCents===null?null:Math.round((item.countUnit?item.quantity/units.normalize(item.countUnit).perUnit:quantity)*unitCostCents);if(totalCents!==null&&(!Number.isSafeInteger(totalCents)||totalCents>7000000000))fail('The wastage cost exceeds the supported limit.');
    return{id:product.id,name:product.name,sku:product.sku||'',unitAmount:product.unitAmount||'',supplier:catalogue.suppliers.find(s=>s.id===product.supplierId)?.name||'',category:product.category||'',quantity,reason:item.reason,...(item.countUnit?{countedQuantity:item.quantity,countUnit:item.countUnit}:{}),unitCostCents,totalCents};
   });
   const knownCostCents=lines.reduce((sum,item)=>sum+(item.totalCents??0),0);if(!Number.isSafeInteger(knownCostCents)||knownCostCents>7000000000)fail('The wastage cost exceeds the supported limit.');
   const record={id:crypto.randomUUID(),requestId:input.requestId,fingerprint,revision:1,status:'recorded',companyId:current.companyId,locationId:current.locationId,locationName:current.locationName,wasteDate:normalized.wasteDate,notes:normalized.notes,items:lines,knownCostCents,totalCents:lines.some(item=>item.totalCents===null)?null:knownCostCents,createdAt:new Date(now()).toISOString(),createdBy:{id:current.id,name:current.username}};records.push(record);return{changed:true,record:view(record,current)};
  });
 }
 async function voidRecord(actor,id,input){
  requireAccess(actor,'wastage.void');if(!uuid(id))fail('Wastage not found.',404);if(!input||!uuid(input.requestId)||!Number.isSafeInteger(input.revision)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>500)fail('Enter why this wastage entry needs to be voided.');
  return mutate(async records=>{const current=await fresh(actor,'wastage.void'),record=records.find(r=>r.id===id&&belongs(r,current));if(!record)fail('Wastage not found.',404);
   if(record.status==='voided'&&record.voidRequestId===input.requestId&&record.voidedBy.id===current.id&&record.voidReason===input.reason.trim())return{changed:false,record:view(record,current)};
   if(record.status!=='recorded'||record.revision!==input.revision)fail('This entry has changed. Refresh wastage before continuing.',409);
   Object.assign(record,{status:'voided',revision:record.revision+1,voidRequestId:input.requestId,voidReason:input.reason.trim(),voidedAt:new Date(now()).toISOString(),voidedBy:{id:current.id,name:current.username}});return{changed:true,record:view(record,current)};
  });
 }
 async function exportCsv(actor,params){requireAccess(actor,'wastage.export');const report=await list(actor,params),reason=params.get('reason')||'',status=params.get('status')||'recorded',query=(params.get('q')||'').toLocaleLowerCase();const rows=[['Date','Location','Status','Recorded by','Item','SKU','Ordered pack','Quantity (ordered packs)','Counting quantity','Counting unit','Reason','Unit cost AUD','Estimated cost AUD','Notes','Voided by','Void reason']];
  for(const record of report.records){if(status!=='all'&&record.status!==status)continue;for(const item of record.items){if(reason&&reason!==item.reason||query&&![record.createdBy.name,record.notes,item.name,item.sku,item.supplier].join(' ').toLocaleLowerCase().includes(query))continue;rows.push([record.wasteDate,record.locationName,record.status,record.createdBy.name,item.name,item.sku,item.unitAmount,item.quantity,item.countedQuantity??'',item.countUnit?.name||'',model.reasonName(item.reason),item.unitCostCents===null?'':item.unitCostCents/100,item.totalCents===null?'':item.totalCents/100,record.notes,record.voidedBy?.name||'',record.voidReason||'']);}}
  return csv(rows);
 }
 // Smart insights (read-only, this location's recorded entries only): an 8-week cost trend with this week compared with the
 // same weekdays of the previous four weeks, items wasted on 3+ days in the last 28 days with a tip from their main reason,
 // waste by weekday, frequently wasted items for quick entry with each item's usual reason/quantity, and today's items.
 async function insights(actor){
  requireAccess(actor);await pending;const day=today(),dayMs=86400000,toNum=value=>Date.parse(value+'T00:00:00Z')/dayMs,label=num=>new Date(num*dayMs).toISOString().slice(0,10);
  const todayNum=toNum(day),weekday=(new Date(todayNum*dayMs).getUTCDay()+6)%7,monday=todayNum-weekday,earliest=monday-7*7;
  const records=(await read()).filter(r=>belongs(r,actor)&&r.status==='recorded'&&toNum(r.wasteDate)>=Math.min(earliest,todayNum-55)&&r.wasteDate<=day);
  const weeks=Array.from({length:8},(_,i)=>({weekStart:label(earliest+i*7),knownCostCents:0,unpricedItems:0,lines:0,sameDaysCents:0,sameDaysUnpriced:0}));
  const items=new Map(),days=Array.from({length:7},(_,i)=>({weekday:i,knownCostCents:0,lines:0})),todayItems=new Map();
  for(const record of records){const num=toNum(record.wasteDate),index=Math.floor((num-earliest)/7),dow=(new Date(num*dayMs).getUTCDay()+6)%7;
   for(const item of record.items){const cost=item.totalCents;
    if(index>=0&&index<8){const week=weeks[index];week.lines++;week.knownCostCents+=cost??0;week.unpricedItems+=cost===null?1:0;if(dow<=weekday){week.sameDaysCents+=cost??0;week.sameDaysUnpriced+=cost===null?1:0;}}
    const key=item.id+'\u0000'+item.unitAmount,entry=items.get(key)||{id:item.id,name:item.name,unitAmount:item.unitAmount,days:new Set(),recentDays:new Set(),quantity:0,knownCostCents:0,unpricedItems:0,reasons:{},quantities:[],lines:0};
    entry.quantities.push(item.quantity);entry.reasons[item.reason]=(entry.reasons[item.reason]||0)+1;
    if(num>todayNum-28){entry.recentDays.add(record.wasteDate);entry.lines++;entry.quantity=Math.round((entry.quantity+item.quantity)*1000)/1000;entry.knownCostCents+=cost??0;entry.unpricedItems+=cost===null?1:0;days[dow].knownCostCents+=cost??0;days[dow].lines++;}
    items.set(key,entry);
    if(record.wasteDate===day){const today=todayItems.get(item.id)||{id:item.id,lines:0,quantity:0,by:new Set()};today.lines++;today.quantity=Math.round((today.quantity+item.quantity)*1000)/1000;today.by.add(record.createdBy.name);todayItems.set(item.id,today);}
   }}
  const median=list=>{const sorted=[...list].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:Math.round((sorted[mid-1]+sorted[mid])/2*1000)/1000;};
  const mainReason=entry=>Object.entries(entry.reasons).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0][0];
  const current=weeks[7],previous=weeks.slice(3,7),comparable=previous,average=Math.round(comparable.reduce((sum,w)=>sum+w.sameDaysCents,0)/comparable.length),unknown=current.sameDaysUnpriced>0||comparable.some(w=>w.sameDaysUnpriced>0);
  const repeat=[...items.values()].filter(e=>e.recentDays.size>=3).sort((a,b)=>b.recentDays.size-a.recentDays.size||b.knownCostCents-a.knownCostCents||a.name.localeCompare(b.name)).slice(0,6).map(e=>{const reason=mainReason(e);return{id:e.id,name:e.name,unitAmount:e.unitAmount,days:e.recentDays.size,quantity:e.quantity,knownCostCents:e.knownCostCents,unpricedItems:e.unpricedItems,reason,tip:model.tip(reason)};});
  const usual=[...items.values()].map(e=>({id:e.id,unitAmount:e.unitAmount,name:e.name,reason:mainReason(e),quantity:median(e.quantities),lines:e.quantities.length,recentLines:e.lines}));
  const quick=[...usual].filter(e=>e.recentLines>0).sort((a,b)=>b.recentLines-a.recentLines||a.name.localeCompare(b.name)).slice(0,8);
  const busiest=[...days].sort((a,b)=>b.knownCostCents-a.knownCostCents||b.lines-a.lines)[0];
  return{companyId:actor.companyId,locationId:actor.locationId,today:day,weeks:weeks.map(({sameDaysCents,sameDaysUnpriced,...w})=>w),comparison:{weekdays:weekday+1,thisWeekCents:current.sameDaysCents,averageCents:average,changePercent:average>0?Math.round((current.sameDaysCents-average)/average*100):null,unknown},repeat,weekdays:days,busiestWeekday:busiest&&busiest.lines?busiest.weekday:null,quick,usual:usual.slice(0,300),todayItems:[...todayItems.values()].map(t=>({id:t.id,lines:t.lines,quantity:t.quantity,by:[...t.by]}))};
 }
 return{options,list,create,voidRecord,exportCsv,insights};
}
async function route({req,res,url,params,session,store,body,json}){
 if(!url.startsWith('/api/wastage'))return false;if(!session)fail('Sign-in required.',401);if(!can(session,'wastage.view'))fail('Wastage viewing permission required.',403);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/wastage/options'&&req.method==='GET'){json(200,await store.options(session));return true;}
 if(url==='/api/wastage'&&req.method==='GET'){json(200,await store.list(session,params));return true;}
 if(url==='/api/wastage/insights'&&req.method==='GET'){json(200,await store.insights(session));return true;}
 if(url==='/api/wastage/export'&&req.method==='GET'){const data=await store.exportCsv(session,params);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="wastage.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(data);return true;}
 if(url==='/api/wastage'&&req.method==='POST'){json(201,await store.create(session,await body(req,128000)));return true;}
 const match=url.match(/^\/api\/wastage\/([a-f0-9-]+)\/void$/i);if(match&&req.method==='POST'){json(200,await store.voidRecord(session,match[1],await body(req)));return true;}
 fail('Wastage endpoint not found.',404);
}
module.exports={createStore,route};
