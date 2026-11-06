// Equipment: a shared company/network Equipment list, and each location's own items.
// Locations choose which list items they have; every location item keeps its own status,
// details, service history and problems. One-off items can also be added to a single location.
// Changing list items needs company/network authority. Costs are visible to equipment managers only.
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
const interval=value=>{if(value===null||value===undefined||value==='')return null;if(!Number.isSafeInteger(value)||value<1||value>1825)fail('Service every must be between 1 and 1,825 days, or blank.');return value;};
// Describes the equipment itself: kept on list items, or on one-off location items.
const sharedFields=input=>({name:text(input.name,120,'Equipment name',true),category:allowed(model.categories,input.category,'category'),make:text(input.make,80,'Make'),model:text(input.model,80,'Model'),supplier:text(input.supplier,120,'Supplier'),serviceContact:text(input.serviceContact,240,'Service contact')});
// Belongs to one location's own copy.
const localFields=input=>({area:text(input.area,80,'Area'),assetTag:text(input.assetTag,60,'Asset tag'),serialNumber:text(input.serialNumber,80,'Serial number'),purchaseDate:optionalDate(input.purchaseDate,'Purchase date'),purchaseCostCents:cents(input.purchaseCostCents,'Purchase cost'),warrantyUntil:optionalDate(input.warrantyUntil,'Warranty end date'),serviceIntervalDays:interval(input.serviceIntervalDays),status:allowed(model.statuses,input.status||'operational','status'),notes:text(input.notes,2000,'Notes')});
const itemDetails=(input,linked)=>{if(!input||typeof input!=='object')fail('Enter the equipment details.');return{...(linked?{}:sharedFields(input)),...localFields(input)};};
const listDetails=input=>{if(!input||typeof input!=='object')fail('Enter the equipment details.');return{...sharedFields(input),serviceIntervalDays:interval(input.serviceIntervalDays),notes:text(input.notes,2000,'Notes')};};
const SHARED=['name','category','make','model','supplier','serviceContact'];
// Stable list IDs for items saved by the short-lived shared-item version.
const derivedId=id=>{const h=crypto.createHash('sha256').update('equipment-list:'+id).digest('hex');return[h.slice(0,8),h.slice(8,12),'5'+h.slice(13,16),'8'+h.slice(17,20),h.slice(20,32)].join('-');};
function migrate(records){
 const out=[];for(const record of records){if(record.type==='list'||!record.scope||record.scope==='location'){if(record.scope==='location'){const {scope,...rest}=record;out.push(rest);}else out.push(record);continue;}
  const listId=derivedId(record.id),{scope,...rest}=record;
  out.push({type:'list',id:listId,scope,companyId:record.companyId,...Object.fromEntries(SHARED.map(k=>[k,record[k]??''])),serviceIntervalDays:record.serviceIntervalDays??null,notes:'',archived:false,revision:1,createdAt:record.createdAt,createdBy:record.createdBy,updatedAt:record.updatedAt,updatedBy:record.updatedBy});
  out.push({...Object.fromEntries(Object.entries(rest).filter(([k])=>!SHARED.includes(k))),catalogId:listId,serviceIntervalDays:null});}
 return out;
}
function createStore(dir,{context,now=Date.now}){
 const file=path.join(dir,'equipment.json');let pending=Promise.resolve();
 const today=()=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now()));return['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');};
 const stamp=()=>new Date(now()).toISOString();
 const requireAccess=(actor,key='equipment.view')=>{if(!can(actor,'equipment.view')||!can(actor,key))fail('Your permission level does not allow this equipment action.',403);if(!actor.companyId||!actor.locationId)fail('Select a location first.',403);};
 const isList=record=>record.type==='list';
 const here=(record,actor)=>!isList(record)&&record.companyId===actor.companyId&&record.locationId===actor.locationId;
 // Network list items reach every company in this network's storage; company list items reach that company.
 const listVisible=(entry,actor)=>isList(entry)&&(entry.scope==='network'||entry.companyId===actor.companyId);
 const canList=(actor,scope)=>can(actor,'equipment.manage')&&can(actor,'locations.all')&&(scope==='company'||scope==='network'&&can(actor,'network.access'));
 const requireList=(actor,scope)=>{if(!canList(actor,scope))fail(scope==='network'?'Only network managers with access to every location can change the network equipment list.':'Only managers with access to every company location can change the company equipment list.',403);};
 const person=actor=>({id:actor.id,name:actor.username});
 async function read(){try{const records=JSON.parse(await fs.readFile(file,'utf8'));if(!Array.isArray(records))throw Error('Invalid equipment storage.');return migrate(records);}catch(error){if(error.code==='ENOENT')return[];throw error;}}
 function mutate(change){const operation=pending.then(async()=>{const records=await read(),result=await change(records);if(!result.changed)return result.record;const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temp,JSON.stringify(records,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result.record;});pending=operation.catch(()=>{});return operation;}
 async function fresh(actor,key){const current=await context(actor,actor.locationId);if(!current||current.id!==actor.id||current.companyId!==actor.companyId||current.locationId!==actor.locationId)fail('The equipment location changed. Reopen the page.',409);requireAccess(current,key);return current;}
 // Location items show the list item's current description; their own interval overrides the list default.
 function effective(record,records){const entry=record.catalogId?records.find(r=>isList(r)&&r.id===record.catalogId):null;if(!entry)return record;return{...record,...Object.fromEntries(SHARED.map(k=>[k,entry[k]])),serviceIntervalDays:record.serviceIntervalDays??entry.serviceIntervalDays??null,listScope:entry.scope,listServiceIntervalDays:entry.serviceIntervalDays??null,ownServiceIntervalDays:record.serviceIntervalDays??null};}
 function view(record,actor,records){
  const manage=can(actor,'equipment.manage'),full=effective(record,records),{requestId,fingerprint:_,...visible}=full,day=today();
  const services=(record.services||[]).map(({requestId,fingerprint,...s})=>manage?s:{...s,costCents:undefined}).sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt));
  const faults=(record.faults||[]).map(({requestId,fingerprint,resolveRequestId,...f})=>f).sort((a,b)=>(a.status==='open'?0:1)-(b.status==='open'?0:1)||b.reportedAt.localeCompare(a.reportedAt));
  const result={...visible,linked:Boolean(record.catalogId),services,faults,serviceDue:model.service(full,day),warranty:model.warranty(full,day),openFaults:model.openFaults(full).length};
  if(!manage)delete result.purchaseCostCents;return result;
 }
 function listView(entry,actor,records){const{requestId,fingerprint:_,...visible}=entry,item=records.find(r=>!isList(r)&&r.catalogId===entry.id&&r.companyId===actor.companyId&&r.locationId===actor.locationId);return{...visible,canEdit:canList(actor,entry.scope),itemId:item?.id||null,atLocation:Boolean(item&&item.status!=='retired'),locationCount:records.filter(r=>!isList(r)&&r.catalogId===entry.id&&r.status!=='retired').length};}
 async function list(actor){requireAccess(actor);await pending;const day=today(),records=await read(),items=records.filter(r=>here(r,actor)),manage=can(actor,'equipment.manage');
  const shown=items.map(r=>view(r,actor,records)).sort((a,b)=>(a.status==='retired')-(b.status==='retired')||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
  const catalog=manage?records.filter(r=>listVisible(r,actor)).map(r=>listView(r,actor,records)).sort((a,b)=>a.archived-b.archived||a.name.localeCompare(b.name)||a.id.localeCompare(b.id)):[];
  return{companyId:actor.companyId,locationId:actor.locationId,locationName:actor.locationName,today:day,canManage:manage,listScopes:model.scopes.filter(s=>s.id!=='location'&&canList(actor,s.id)),categories:model.categories,statuses:model.statuses,serviceTypes:model.serviceTypes,severities:model.severities,summary:model.summarize(items.map(r=>effective(r,records)),day),items:shown,catalog};}
 const capacity=(records,actor)=>{if(records.filter(r=>here(r,actor)).length>=2000)fail('This location already has the maximum of 2,000 equipment items.');};
 // One-off item for the selected location only.
 async function create(actor,input){
  requireAccess(actor,'equipment.manage');if(!input||!uuid(input.requestId))fail('Reload the page before adding equipment.');const values=itemDetails(input,false),print=fingerprint(values);
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),previous=records.find(r=>r.requestId===input.requestId);
   if(previous){if(!here(previous,current)||previous.createdBy.id!==current.id||previous.fingerprint!==print)fail('This equipment reference has already been used.',409);return{changed:false,record:view(previous,current,records)};}
   capacity(records,current);const record={id:crypto.randomUUID(),requestId:input.requestId,fingerprint:print,revision:1,companyId:current.companyId,locationId:current.locationId,...values,services:[],faults:[],createdAt:stamp(),createdBy:person(current),updatedAt:stamp(),updatedBy:person(current)};records.push(record);return{changed:true,record:view(record,current,records)};});
 }
 async function update(actor,id,input){
  requireAccess(actor,'equipment.manage');if(!uuid(id))fail('Equipment not found.',404);if(!input||!Number.isSafeInteger(input.revision))fail('Reload this equipment before saving.');
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),record=records.find(r=>r.id===id&&here(r,current));if(!record)fail('Equipment not found.',404);const values=itemDetails(input,Boolean(record.catalogId));
   if(record.revision!==input.revision)fail('This equipment changed since you opened it. Reload it before saving.',409);
   if(Object.keys(values).every(key=>JSON.stringify(record[key]??null)===JSON.stringify(values[key]??null)))return{changed:false,record:view(record,current,records)};
   Object.assign(record,values,{revision:record.revision+1,updatedAt:stamp(),updatedBy:person(current)});return{changed:true,record:view(record,current,records)};});
 }
 async function createListItem(actor,input){
  requireAccess(actor,'equipment.manage');if(!input||!uuid(input.requestId))fail('Reload the page before adding to the equipment list.');const scope=allowed(model.scopes.filter(s=>s.id!=='location'),input.scope,'list'),values=listDetails(input),print=fingerprint({...values,scope});
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage');requireList(current,scope);const previous=records.find(r=>r.requestId===input.requestId);
   if(previous){if(!isList(previous)||!listVisible(previous,current)||previous.createdBy.id!==current.id||previous.fingerprint!==print)fail('This equipment reference has already been used.',409);return{changed:false,record:listView(previous,current,records)};}
   if(records.filter(r=>listVisible(r,current)).length>=2000)fail('The equipment list already has the maximum of 2,000 items.');
   const entry={type:'list',id:crypto.randomUUID(),requestId:input.requestId,fingerprint:print,revision:1,scope,companyId:current.companyId,...values,archived:false,createdAt:stamp(),createdBy:person(current),updatedAt:stamp(),updatedBy:person(current)};records.push(entry);return{changed:true,record:listView(entry,current,records)};});
 }
 async function updateListItem(actor,id,input){
  requireAccess(actor,'equipment.manage');if(!uuid(id))fail('Equipment list item not found.',404);if(!input||!Number.isSafeInteger(input.revision)||typeof input.archived!=='boolean')fail('Reload the equipment list before saving.');const values={...listDetails(input),archived:input.archived};
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),entry=records.find(r=>r.id===id&&listVisible(r,current));if(!entry)fail('Equipment list item not found.',404);requireList(current,entry.scope);
   if(entry.revision!==input.revision)fail('This list item changed since you opened it. Reload it before saving.',409);
   if(Object.keys(values).every(key=>JSON.stringify(entry[key]??null)===JSON.stringify(values[key]??null)))return{changed:false,record:listView(entry,current,records)};
   Object.assign(entry,values,{revision:entry.revision+1,updatedAt:stamp(),updatedBy:person(current)});return{changed:true,record:listView(entry,current,records)};});
 }
 // Ticks a list item on or off for the selected location. Off retires that location's copy, keeping its history.
 async function setAtLocation(actor,id,input){
  requireAccess(actor,'equipment.manage');if(!uuid(id))fail('Equipment list item not found.',404);if(!input||typeof input.present!=='boolean')fail('Choose whether this equipment is at the location.');
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),entry=records.find(r=>r.id===id&&listVisible(r,current));if(!entry)fail('Equipment list item not found.',404);
   let item=records.find(r=>!isList(r)&&r.catalogId===entry.id&&here(r,current));
   if(input.present){if(item&&item.status!=='retired')return{changed:false,record:listView(entry,current,records)};if(entry.archived)fail('This list item is archived. Restore it in the equipment list first.',409);
    if(item)Object.assign(item,{status:'operational',revision:item.revision+1,updatedAt:stamp(),updatedBy:person(current)});
    else{capacity(records,current);item={id:crypto.randomUUID(),revision:1,companyId:current.companyId,locationId:current.locationId,catalogId:entry.id,...localFields({}),services:[],faults:[],createdAt:stamp(),createdBy:person(current),updatedAt:stamp(),updatedBy:person(current)};records.push(item);}
    return{changed:true,record:listView(entry,current,records)};}
   if(!item||item.status==='retired')return{changed:false,record:listView(entry,current,records)};
   Object.assign(item,{status:'retired',revision:item.revision+1,updatedAt:stamp(),updatedBy:person(current)});return{changed:true,record:listView(entry,current,records)};});
 }
 async function addService(actor,id,input){
  requireAccess(actor,'equipment.manage');if(!uuid(id))fail('Equipment not found.',404);if(!input||!uuid(input.requestId)||!validDate(input.date))fail('Choose the service date.');
  if(input.date>today())fail('Service dates cannot be in the future.');
  const values={date:input.date,type:allowed(model.serviceTypes,input.type,'service type'),notes:text(input.notes,2000,'Service notes'),provider:text(input.provider,120,'Done by'),costCents:cents(input.costCents,'Service cost'),status:input.status?allowed(model.statuses,input.status,'status'):null},print=fingerprint(values);
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),record=records.find(r=>r.id===id&&here(r,current));if(!record)fail('Equipment not found.',404);record.services||=[];
   const previous=record.services.find(s=>s.requestId===input.requestId);if(previous){if(previous.recordedBy.id!==current.id||previous.fingerprint!==print)fail('This service reference has already been used.',409);return{changed:false,record:view(record,current,records)};}
   if(record.services.length>=1000)fail('This equipment already has the maximum of 1,000 service entries.');
   const {status,...entry}=values;record.services.push({id:crypto.randomUUID(),requestId:input.requestId,fingerprint:print,...entry,recordedAt:stamp(),recordedBy:person(current)});
   if(status&&status!==record.status)record.status=status;record.revision++;record.updatedAt=stamp();record.updatedBy=person(current);return{changed:true,record:view(record,current,records)};});
 }
 async function reportFault(actor,id,input){
  requireAccess(actor);if(!uuid(id))fail('Equipment not found.',404);if(!input||!uuid(input.requestId))fail('Reload the page before reporting a problem.');
  const values={description:text(input.description,1000,'What’s wrong',true),severity:allowed(model.severities,input.severity,'severity')},print=fingerprint(values);
  return mutate(async records=>{const current=await fresh(actor,'equipment.view'),record=records.find(r=>r.id===id&&here(r,current));if(!record)fail('Equipment not found.',404);if(record.status==='retired')fail('This equipment has been retired.',409);record.faults||=[];
   const previous=record.faults.find(f=>f.requestId===input.requestId);if(previous){if(previous.reportedBy.id!==current.id||previous.fingerprint!==print)fail('This problem report has already been used.',409);return{changed:false,record:view(record,current,records)};}
   if(model.openFaults(record).length>=100)fail('This equipment already has 100 open problems. Resolve some before reporting more.');if(record.faults.length>=1000)fail('This equipment already has the maximum of 1,000 problem reports.');
   record.faults.push({id:crypto.randomUUID(),requestId:input.requestId,fingerprint:print,...values,status:'open',reportedAt:stamp(),reportedBy:person(current)});record.revision++;return{changed:true,record:view(record,current,records)};});
 }
 async function resolveFault(actor,id,faultId,input){
  requireAccess(actor,'equipment.manage');if(!uuid(id)||!uuid(faultId))fail('Problem not found.',404);if(!input||!uuid(input.requestId))fail('Reload the page before resolving this problem.');const resolution=text(input.resolution,1000,'How it was resolved',true);
  return mutate(async records=>{const current=await fresh(actor,'equipment.manage'),record=records.find(r=>r.id===id&&here(r,current)),fault=record?.faults?.find(f=>f.id===faultId);if(!fault)fail('Problem not found.',404);
   if(fault.status==='resolved'){if(fault.resolveRequestId===input.requestId&&fault.resolvedBy.id===current.id&&fault.resolution===resolution)return{changed:false,record:view(record,current,records)};fail('This problem has already been resolved.',409);}
   Object.assign(fault,{status:'resolved',resolution,resolveRequestId:input.requestId,resolvedAt:stamp(),resolvedBy:person(current)});record.revision++;return{changed:true,record:view(record,current,records)};});
 }
 async function exportCsv(actor){requireAccess(actor,'equipment.manage');const data=await list(actor),money=v=>v===null||v===undefined?'':v/100;
  const rows=[['Name','From list','Category','Area','Status','Asset tag','Make','Model','Serial number','Supplier','Service contact','Purchase date','Purchase cost AUD','Warranty until','Service every (days)','Last service','Next service','Service state','Open problems','Notes']];
  for(const i of data.items)rows.push([i.name,i.listScope?model.name(model.scopes,i.listScope):'',model.name(model.categories,i.category),i.area,model.name(model.statuses,i.status),i.assetTag,i.make,i.model,i.serialNumber,i.supplier,i.serviceContact,i.purchaseDate||'',money(i.purchaseCostCents),i.warrantyUntil||'',i.serviceIntervalDays??'',i.serviceDue.last||'',i.serviceDue.next||'',i.serviceDue.state,i.openFaults,i.notes]);
  return csv(rows);}
 return{list,create,update,createListItem,updateListItem,setAtLocation,addService,reportFault,resolveFault,exportCsv};
}
async function route({req,res,url,session,store,body,json}){
 if(!url.startsWith('/api/equipment'))return false;if(!session)fail('Sign-in required.',401);if(!can(session,'equipment.view'))fail('Equipment viewing permission required.',403);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/equipment'&&req.method==='GET'){json(200,await store.list(session));return true;}
 if(url==='/api/equipment'&&req.method==='POST'){json(201,await store.create(session,await body(req,64000)));return true;}
 if(url==='/api/equipment/export'&&req.method==='GET'){const data=await store.exportCsv(session);res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="equipment.csv"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(data);return true;}
 if(url==='/api/equipment/list'&&req.method==='POST'){json(201,await store.createListItem(session,await body(req,64000)));return true;}
 let match=url.match(/^\/api\/equipment\/list\/([a-f0-9-]{36})$/i);if(match&&req.method==='PUT'){json(200,await store.updateListItem(session,match[1],await body(req,64000)));return true;}
 match=url.match(/^\/api\/equipment\/list\/([a-f0-9-]{36})\/location$/i);if(match&&req.method==='PUT'){json(200,await store.setAtLocation(session,match[1],await body(req,4000)));return true;}
 match=url.match(/^\/api\/equipment\/([a-f0-9-]{36})$/i);if(match&&req.method==='PUT'){json(200,await store.update(session,match[1],await body(req,64000)));return true;}
 match=url.match(/^\/api\/equipment\/([a-f0-9-]{36})\/services$/i);if(match&&req.method==='POST'){json(201,await store.addService(session,match[1],await body(req,64000)));return true;}
 match=url.match(/^\/api\/equipment\/([a-f0-9-]{36})\/faults$/i);if(match&&req.method==='POST'){json(201,await store.reportFault(session,match[1],await body(req,64000)));return true;}
 match=url.match(/^\/api\/equipment\/([a-f0-9-]{36})\/faults\/([a-f0-9-]{36})\/resolve$/i);if(match&&req.method==='POST'){json(200,await store.resolveFault(session,match[1],match[2],await body(req,64000)));return true;}
 fail('Equipment endpoint not found.',404);
}
module.exports={createStore,route,migrate};
