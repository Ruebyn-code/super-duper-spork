// Location equipment register: items, service history and staff fault reports.
// Each record is shared with one location, its whole company or the whole network.
// Changing company/network items needs matching authority. Costs are visible to equipment managers only.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),model=require('./public/equipment-model'),csv=require('./public/reporting-export').csv;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&value>='1990-01-01'&&value<='2100-12-31'&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const text=(value,max,label,required=false)=>{if(value===undefined||value===null)value='';if(typeof value!=='string'||value.length>max)fail(label+' may contain up to '+max+' characters.');value=value.trim();if(required&&!value)fail('Enter '+label.toLowerCase()+'.');return value;};
const cents=(value,label)=>{if(value===null||value===undefined||value==='')return null;if(!Number.isSafeInteger(value)||value<0||value>10000000000)fail(label+' must be a whole number of cents from $0 up to $100,000,000.');return value;};
const optionalDate=(value,label)=>{if(value===null||value===undefined||value==='')return null;if(!validDate(value))fail('Choose a valid '+label.toLowerCase()+'.');return value;};
const allowed=(list,value,label)=>{if(!list.some(item=>item.id===value))fail('Choose a valid '+label+'.');return value;};
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function details(input){
 if(!input||typeof input!=='object')fail('Enter the equipment details.');
 const interval=input.serviceIntervalDays;if(interval!==null&&interval!==undefined&&interval!==''&&(!Number.isSafeInteger(interval)||interval<1||interval>1825))fail('Service every must be between 1 and 1,825 days, or blank.');
 const out={name:text(input.name,120,'Equipment name',true),category:allowed(model.categories,input.category,'category'),area:text(input.area,80,'Area'),assetTag:text(input.assetTag,60,'Asset tag'),make:text(input.make,80,'Make'),model:text(input.model,80,'Model'),serialNumber:text(input.serialNumber,80,'Serial number'),supplier:text(input.supplier,120,'Supplier'),serviceContact:text(input.serviceContact,240,'Service contact'),purchaseDate:optionalDate(input.purchaseDate,'Purchase date'),purchaseCostCents:cents(input.purchaseCostCents,'Purchase cost'),warrantyUntil:optionalDate(input.warrantyUntil,'Warranty end date'),serviceIntervalDays:interval===''||interval===undefined?null:interval,status:allowed(model.statuses,input.status||'operational','status'),notes:text(input.notes,2000,'Notes')};
 return out;
}
function createStore(dir,{context,now=Date.now}){
 const file=path.join(dir,'equipment.json');let pending=Promise.resolve();
 const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now()));return['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');};
 const stamp=()=>new Date(now()).toISOString();
 const requireAccess=(actor,key='equipment.view')=>{if(!can(actor,'equipment.view')||!can(actor,key))fail('Your permission level does not allow this equipment action.',403);if(!actor.companyId||!actor.locationId)fail('Select a location first.',403);};
 const scopeOf=record=>record.scope||'location';
 // Network items are visible to every company in this network's storage; company items to every location of that company.
 const belongs=(record,actor)=>{const scope=scopeOf(record);return scope==='network'||record.companyId===actor.companyId&&(scope==='company'||record.locationId===actor.locationId);};
 const canScope=(actor,scope)=>can(actor,'equipment.manage')&&(scope==='location'||scope==='company'&&can(actor,'locations.all')||scope==='network'&&can(actor,'network.access')&&can(actor,'locations.all'));
 const requireScope=(actor,scope)=>{if(!canScope(actor,scope))fail(scope==='network'?'Only network managers with access to every location can change network-wide equipment.':scope==='company'?'Only managers with access to every company location can change company-wide equipment.':'Your permission level does not allow this equipment action.',403);};
 const person=actor=>({id:actor.id,name:actor.username});
 async function read(){try{const records=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(records))throw Error('Invalid equipment storage.');return records;}catch(error){if(error.code==='ENOENT')return[];throw error;}}
 function mutate(change){const operation=pending.then(async()=>{const records=await read(),result=await change(records);if(!result.changed)return result.record;const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temp,JSON.stringify(records,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result.record;});pending=operation.catch(()=>{});return operation;}
 async function fresh(actor,key){const current=await context(actor,actor.locationId);if(!current||current.id!==actor.id||current.companyId!==actor.companyId||current.locationId!==actor.locationId)fail('The equipment location changed. Reopen the page.',409);requireAccess(current,key);return current;}
 function view(record,actor){
  const manage=can(actor,'equipment.manage'),{requestId,fingerprint:_,...visible}=record,day=today();
  const services=(record.services||[]).map(({requestId,fingerprint,...s})=>manage?s:{...s,costCents:undefined}).sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt));
  const faults=(record.faults||[]).map(({requestId,fingerprint,resolveRequestId,...f})=>f).sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||b.reportedAt.localeCompare(a.reportedAt));
  const scope=scopeOf(record),result={...visible,scope,canEdit:canScope(actor,scope),services,faults,serviceDue:model.service(record,day),warranty:model.warranty(record,day),openFaults:model.openFaults(record).length};
  if(!manage)delete result.purchaseCostCents;return result;
 }
 async function list(actor){requireAccess(actor);await pending;const day=today(),records=(await read()).filter(r=>belongs(r,actor));const items=records.map(r=>view(r,actor)).sort((a,b)=>(a.status==='retired')-(b.status==='retired')||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  return{companyId:actor.companyId,locationId:actor.locationId,locationName:actor.locationName,today:day,canManage:can(actor,'equipment.manage'),scopes:model.scopes.filter(s=>canScope(actor,s.id)),categories:model.categories,statuses:model.statuses,serviceTypes:model.serviceTypes,severities:model.severities,summary:model.summarize(records,day),items};}
 async function create(actor,input){
  requireAccess(actor,'equipment.manage');if(!input||!uuid(input.requestId))fail('Reload the page before adding equipment.');const scope=allowed(model.scopes,input.scope||'location','list'),values=details(input),print=fingerprint({...values,scope});
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),previous=records.find(r=>r.requestId===input.requestId);requireScope(current,scope);
   if(previous){if(!belongs(previous,current)||previous.createdBy.id!==current.id||previous.fingerprint!==print)fail('This equipment reference has already been used.',409);return{changed:false,record:view(previous,current)};}
   if(records.filter(r=>belongs(r,current)).length>=2000)fail('This location already shows the maximum of 2,000 equipment items.');
   const record={id:crypto.randomUUID(),requestId:input.requestId,fingerprint:print,revision:1,scope,companyId:current.companyId,locationId:current.locationId,...values,services:[],faults:[],createdAt:stamp(),createdBy:person(current),updatedAt:stamp(),updatedBy:person(current)};records.push(record);return{changed:true,record:view(record,current)};});
 }
 async function update(actor,id,input){
  requireAccess(actor,'equipment.manage');if(!uuid(id))fail('Equipment not found.',404);if(!input||!Number.isSafeInteger(input.revision))fail('Reload this equipment before saving.');const values=details(input),scope=input.scope===undefined?null:allowed(model.scopes,input.scope,'list');
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),record=records.find(r=>r.id===id&&belongs(r,current));if(!record)fail('Equipment not found.',404);
   requireScope(current,scopeOf(record));const nextScope=scope||scopeOf(record);requireScope(current,nextScope);
   if(record.revision!==input.revision)fail('This equipment changed since you opened it. Reload it before saving.',409);
   if(nextScope===scopeOf(record)&&Object.keys(values).every(key=>JSON.stringify(record[key])===JSON.stringify(values[key])))return{changed:false,record:view(record,current)};
   // Narrowing a shared item pins it to the editor's current company/location.
   if(nextScope!==scopeOf(record)&&nextScope!=='network')Object.assign(record,{companyId:current.companyId,...(nextScope==='location'?{locationId:current.locationId}:{})});
   Object.assign(record,values,{scope:nextScope,revision:record.revision+1,updatedAt:stamp(),updatedBy:person(current)});return{changed:true,record:view(record,current)};});
 }
 async function addService(actor,id,input){
  requireAccess(actor,'equipment.manage');if(!uuid(id))fail('Equipment not found.',404);if(!input||!uuid(input.requestId)||!validDate(input.date))fail('Choose the service date.');
  if(input.date>today())fail('Service dates cannot be in the future.');
  const values={date:input.date,type:allowed(model.serviceTypes,input.type,'service type'),notes:text(input.notes,2000,'Service notes'),provider:text(input.provider,120,'Done by'),costCents:cents(input.costCents,'Service cost'),status:input.status?allowed(model.statuses,input.status,'status'):null},print=fingerprint(values);
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),record=records.find(r=>r.id===id&&belongs(r,current));if(!record)fail('Equipment not found.',404);requireScope(current,scopeOf(record));record.services||=[];
   const previous=record.services.find(s=>s.requestId===input.requestId);if(previous){if(previous.recordedBy.id!==current.id||previous.fingerprint!==print)fail('This service reference has already been used.',409);return{changed:false,record:view(record,current)};}
   if(record.services.length>=1000)fail('This equipment already has the maximum of 1,000 service entries.');
   const {status,...entry}=values;record.services.push({id:crypto.randomUUID(),requestId:input.requestId,fingerprint:print,...entry,recordedAt:stamp(),recordedBy:person(current)});
   if(status&&status!==record.status)record.status=status;record.revision++;record.updatedAt=stamp();record.updatedBy=person(current);return{changed:true,record:view(record,current)};});
 }
 async function reportFault(actor,id,input){
  requireAccess(actor);if(!uuid(id))fail('Equipment not found.',404);if(!input||!uuid(input.requestId))fail('Reload the page before reporting a problem.');
  const values={description:text(input.description,1000,'What’s wrong',true),severity:allowed(model.severities,input.severity,'severity')},print=fingerprint(values);
  return mutate(async records=>{const current=await fresh(actor,'equipment.view'),record=records.find(r=>r.id===id&&belongs(r,current));if(!record)fail('Equipment not found.',404);if(record.status==='retired')fail('This equipment has been retired.',409);record.faults||=[];
   const previous=record.faults.find(f=>f.requestId===input.requestId);if(previous){if(previous.reportedBy.id!==current.id||previous.fingerprint!==print)fail('This problem report has already been used.',409);return{changed:false,record:view(record,current)};}
   if(model.openFaults(record).length>=100)fail('This equipment already has 100 open problems. Resolve some before reporting more.');if(record.faults.length>=1000)fail('This equipment already has the maximum of 1,000 problem reports.');
   record.faults.push({id:crypto.randomUUID(),requestId:input.requestId,fingerprint:print,...values,status:'open',reportedAt:stamp(),reportedBy:person(current)});record.revision++;return{changed:true,record:view(record,current)};});
 }
 async function resolveFault(actor,id,faultId,input){
  requireAccess(actor,'equipment.manage');if(!uuid(id)||!uuid(faultId))fail('Problem not found.',404);if(!input||!uuid(input.requestId))fail('Reload the page before resolving this problem.');const resolution=text(input.resolution,1000,'How it was resolved',true);
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),record=records.find(r=>r.id===id&&belongs(r,current)),fault=record?.faults?.find(f=>f.id===faultId);if(!fault)fail('Problem not found.',404);requireScope(current,scopeOf(record));
   if(fault.status==='resolved'){if(fault.resolveRequestId===input.requestId&&fault.resolvedBy.id===current.id&&fault.resolution===resolution)return{changed:false,record:view(record,current)};fail('This problem has already been resolved.',409);}
   Object.assign(fault,{status:'resolved',resolution,resolveRequestId:input.requestId,resolvedAt:stamp(),resolvedBy:person(current)});record.revision++;return{changed:true,record:view(record,current)};});
 }
 async function exportCsv(actor){requireAccess(actor,'equipment.manage');const data=await list(actor),money=v=>v===null||v===undefined?'':v/100;
  const rows=[['Name','Shared with','Category','Area','Status','Asset tag','Make','Model','Serial number','Supplier','Service contact','Purchase date','Purchase cost AUD','Warranty until','Service every (days)','Last service','Next service','Service state','Open problems','Notes']];
  for(const i of data.items)rows.push([i.name,model.name(model.scopes,i.scope),model.name(model.categories,i.category),i.area,model.name(model.statuses,i.status),i.assetTag,i.make,i.model,i.serialNumber,i.supplier,i.serviceContact,i.purchaseDate||'',money(i.purchaseCostCents),i.warrantyUntil||'',i.serviceIntervalDays??'',i.serviceDue.last||'',i.serviceDue.next||'',i.serviceDue.state,i.openFaults,i.notes]);
  return csv(rows);}
 return{list,create,update,addService,reportFault,resolveFault,exportCsv};
}
async function route({req,res,url,session,store,body,json}){
 if(!url.startsWith('/api/equipment'))return false;if(!session)fail('Sign-in required.',401);if(!can(session,'equipment.view'))fail('Equipment viewing permission required.',403);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/equipment'&&req.method==='GET'){json(200,await store.list(session));return true;}
 if(url==='/api/equipment'&&req.method==='POST'){json(201,await store.create(session,await body(req,64000)));return true;}
 if(url==='/api/equipment/export'&&req.method==='GET'){const data=await store.exportCsv(session);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="equipment.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(data);return true;}
 let match=url.match(/^\/api\/equipment\/([a-f0-9-]{36})$/i);if(match&&req.method==='PUT'){json(200,await store.update(session,match[1],await body(req,64000)));return true;}
 match=url.match(/^\/api\/equipment\/([a-f0-9-]{36})\/services$/i);if(match&&req.method==='POST'){json(201,await store.addService(session,match[1],await body(req,64000)));return true;}
 match=url.match(/^\/api\/equipment\/([a-f0-9-]{36})\/faults$/i);if(match&&req.method==='POST'){json(201,await store.reportFault(session,match[1],await body(req,64000)));return true;}
 match=url.match(/^\/api\/equipment\/([a-f0-9-]{36})\/faults\/([a-f0-9-]{36})\/resolve$/i);if(match&&req.method==='POST'){json(200,await store.resolveFault(session,match[1],match[2],await body(req,64000)));return true;}
 fail('Equipment endpoint not found.',404);
}
module.exports={createStore,route};
