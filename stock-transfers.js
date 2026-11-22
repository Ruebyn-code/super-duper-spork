const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),effects=require('./stock-transfer-effects');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});},uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const quantity=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=1000000&&Math.abs(value*1000-Math.round(value*1000))<.000001;
function createStore(dir,{locations,companies,catalogues,context,now=Date.now}){
 const file=path.join(dir,'stock-transfers.json');let pending=Promise.resolve();
 const timestamp=()=>new Date(now()).toISOString();
 function mutate(change){const operation=pending.then(async()=>{const records=await effects.read(dir),result=await change(records),temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temp,JSON.stringify(records,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result;});pending=operation.catch(()=>{});return operation;}
 function requirePermission(actor,key){if(!can(actor,key))fail('Stock transfer permission required.',403);}
 function view(record,actor){const {fingerprint,edits,...visible}=record;const last=edits?.[edits.length-1];return {...visible,...(last?{edited:{count:edits.length,at:last.at,by:last.by.name}}:{}),canEdit:record.status==='sent'&&record.from.id===actor.locationId&&can(actor,'transfers.send'),canEditDate:record.status==='received'&&((record.from.id===actor.locationId&&can(actor,'transfers.send'))||(record.to.id===actor.locationId&&can(actor,'transfers.receive'))),canReceive:record.status==='sent'&&record.to.id===actor.locationId&&can(actor,'transfers.receive'),canCancel:record.status==='sent'&&record.from.id===actor.locationId&&can(actor,'transfers.send')};}
 async function options(actor){requirePermission(actor,'transfers.view');const choices=await locations.accessible(actor,{allCompanies:true}),result=[];for(const location of choices){const target=await context(actor,location.id);if(!can(target,'transfers.view'))continue;result.push({...location,companyName:(await companies.get(location.companyId)).name});}return {locations:result,products:(await catalogues.read(actor.companyId)).products.map(product=>productView(product))};}
 function productView(product){return {id:product.id,name:product.name,sku:product.sku||'',unitAmount:product.unitAmount||'',stockCountGroup:product.stockCountGroup,supplierId:product.supplierId||'',price:product.price??null};}
 async function destination(actor,id){requirePermission(actor,'transfers.send');const target=await context(actor,id);if(!can(target,'transfers.view'))fail('Transfer access is required at the receiving location.',403);const catalogue=await catalogues.read(target.companyId);return {location:{id:target.locationId,name:target.locationName,companyId:target.companyId,companyName:target.companyName},products:catalogue.products.map(productView)};}
 async function list(actor){requirePermission(actor,'transfers.view');return (await effects.read(dir)).filter(record=>record.from.id===actor.locationId||record.to.id===actor.locationId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)).map(record=>view(record,actor));}
 async function requireHomeManager(actor){
  for(const key of ['home.view','transfers.view','transfers.receive'])requirePermission(actor,key);
  const location=await locations.status(actor.locationId);if(!location.managers.some(manager=>manager.id===actor.id))fail('Home transfer approvals are only available to this location’s assigned managers.',403);
 }
 async function homePending(actor){
  await requireHomeManager(actor);
  const product=item=>({id:item.id,name:item.name,sku:item.sku||'',unitAmount:item.unitAmount||''});
  return {companyId:actor.companyId,locationId:actor.locationId,transfers:(await effects.read(dir)).filter(record=>record.status==='sent'&&record.to.id===actor.locationId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).map(record=>({id:record.id,revision:record.revision,from:record.from,to:record.to,createdAt:record.createdAt,transferDate:record.transferDate||null,senderName:record.createdBy.name,notes:record.notes,moveCosts:record.moveCosts,items:record.items.map(item=>({source:product(item.source),target:product(item.target),quantity:item.quantity,targetQuantity:item.targetQuantity}))}))};
 }
 function checkDate(value,today,earliest){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('Choose a valid transfer date.');if(value>today)fail('The transfer date cannot be in the future.');const floor=earliest||today;if(Date.parse(floor+'T00:00:00Z')-Date.parse(value+'T00:00:00Z')>60*86400000)fail(earliest?'The transfer date can be up to 60 days before the transfer was recorded.':'The transfer date can be up to 60 days ago.');return value;}
 function cleanItems(list){if(!Array.isArray(list)||!list.length||list.length>100)fail('Choose 1–100 stock items.');const seen=new Set();return list.map(item=>{if(!item||typeof item.sourceProductId!=='string'||typeof item.targetProductId!=='string'||seen.has(item.sourceProductId)||!quantity(item.quantity)||!quantity(item.targetQuantity))fail('Choose distinct stock items and positive quantities with up to three decimal places.');seen.add(item.sourceProductId);return {sourceProductId:item.sourceProductId,targetProductId:item.targetProductId,quantity:item.quantity,targetQuantity:item.targetQuantity};});}
 async function buildLines(sourceCompanyId,targetCompanyId,items,moveCosts){
  const [fromCatalogue,toCatalogue]=await Promise.all([catalogues.read(sourceCompanyId),catalogues.read(targetCompanyId)]);
  const snapshot=(product,catalogue)=>({...productView(product),supplier:catalogue.suppliers.find(supplier=>supplier.id===product.supplierId)?.name||''});
  const lines=items.map(item=>{const from=fromCatalogue.products.find(product=>product.id===item.sourceProductId),to=toCatalogue.products.find(product=>product.id===item.targetProductId);if(!from||!to)fail('An item is no longer in its company catalogue. Refresh the transfer.',409);
   if(sourceCompanyId===targetCompanyId&&(from.id!==to.id||item.quantity!==item.targetQuantity))fail('Locations in the same company transfer the same stock item and unit quantity.');
   if(moveCosts&&(!Number.isSafeInteger(from.price)||from.price<0))fail(from.name+' needs a stock price before its cost can be transferred. Choose quantities only or set its price in the stock editor.');
   const totalCents=moveCosts?Math.round(from.price*item.quantity):0;if(!Number.isSafeInteger(totalCents)||totalCents>7000000000)fail('The transfer cost exceeds the supported limit.');
   return {source:snapshot(from,fromCatalogue),target:snapshot(to,toCatalogue),quantity:item.quantity,targetQuantity:item.targetQuantity,unitCostCents:moveCosts?from.price:null,totalCents};
  });
  const totalCents=lines.reduce((sum,item)=>sum+item.totalCents,0);if(!Number.isSafeInteger(totalCents)||totalCents>7000000000)fail('The transfer cost exceeds the supported limit.');return {lines,totalCents};
 }
 // Editing: a transfer still awaiting receipt can be changed at the sending location (date, items, quantities, cost
 // handling, notes; the receiving location stays). After receipt (or for either side) only the transfer date can be
 // corrected; items, quantities and costs stay as received. Every edit is revision-checked, idempotent per requestId
 // and kept in a private before/after audit (record.edits, last 50).
 async function edit(actor,id,input){if(!uuid(id))fail('Transfer not found.',404);if(!input||!Number.isSafeInteger(input.revision)||!uuid(input.requestId))fail('Reload the transfer before editing it.');
  return mutate(async records=>{
   const record=records.find(row=>row.id===id);if(!record||(record.from.id!==actor.locationId&&record.to.id!==actor.locationId))fail('Transfer not found.',404);
   const fresh=await context(actor,actor.locationId),previous=(record.edits||[]).find(entry=>entry.id===input.requestId);
   if(previous){if(previous.by.id!==actor.id)fail('This edit reference has already been used.',409);return view(record,fresh);}
   if(record.revision!==input.revision)fail('The transfer has changed. Reload its current status.',409);
   if(record.status==='cancelled')fail('Cancelled transfers cannot be edited.',409);
   const sender=record.from.id===fresh.locationId&&can(fresh,'transfers.send'),receiver=record.to.id===fresh.locationId&&can(fresh,'transfers.receive');
   const pending=record.status==='sent'&&sender,full=pending&&(input.items!==undefined||input.moveCosts!==undefined||input.notes!==undefined);
   if(!pending&&!(record.status==='received'&&(sender||receiver)))fail(record.status==='sent'?'Only the sending location can edit a transfer awaiting receipt.':'Transfer editing permission required.',403);
   if(!pending&&(input.items!==undefined||input.moveCosts!==undefined||input.notes!==undefined))fail('Received transfers keep their items, quantities and costs. Only the transfer date can be corrected.',409);
   const brief=row=>({transferDate:row.transferDate||effects.melbourneDay(row.createdAt),notes:row.notes||'',moveCosts:row.moveCosts,totalCents:row.totalCents,items:row.items.map(item=>({source:item.source.name,target:item.target.name,quantity:item.quantity,targetQuantity:item.targetQuantity}))});
   const before=brief(record),next={};
   if(input.transferDate!==undefined)next.transferDate=checkDate(input.transferDate,effects.melbourneDay(now()),effects.melbourneDay(record.createdAt));
   if(full){if(input.moveCosts!==undefined&&typeof input.moveCosts!=='boolean')fail('Choose how costs are handled.');if(input.notes!==undefined&&(typeof input.notes!=='string'||input.notes.length>1000))fail('Notes can be up to 1000 characters.');
    const moveCosts=input.moveCosts??record.moveCosts,items=input.items===undefined?record.items.map(item=>({sourceProductId:item.source.id,targetProductId:item.target.id,quantity:item.quantity,targetQuantity:item.targetQuantity})):cleanItems(input.items);
    const built=await buildLines(record.from.companyId,record.to.companyId,items,moveCosts);Object.assign(next,{moveCosts,items:built.lines,totalCents:built.totalCents});if(input.notes!==undefined)next.notes=input.notes.trim();}
   const candidate={...record,...next};if(JSON.stringify(brief(candidate))===JSON.stringify(before))fail('Nothing changed in this transfer.');
   Object.assign(record,next);record.revision++;record.edits=[...(record.edits||[]),{id:input.requestId,at:timestamp(),by:{id:actor.id,name:actor.username},before,after:brief(record)}].slice(-50);
   return view(record,fresh);
  });
 }
 async function create(actor,input){requirePermission(actor,'transfers.send');
  if(!input||!uuid(input.requestId)||typeof input.destinationLocationId!=='string'||typeof input.moveCosts!=='boolean'||typeof input.notes!=='string'||input.notes.length>1000||!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Choose a destination, cost option and 1–100 stock items.');
  if(input.destinationLocationId===actor.locationId)fail('Choose a different receiving location.');
  const items=cleanItems(input.items);
  // Optional transfer date (YYYY-MM-DD, Melbourne): today by default, or up to 60 days back to record a past transfer.
  const today=effects.melbourneDay(now()),transferDate=input.transferDate===undefined||input.transferDate===null||input.transferDate===''?today:checkDate(input.transferDate,today);
  const fingerprint=JSON.stringify({destinationLocationId:input.destinationLocationId,moveCosts:input.moveCosts,notes:input.notes.trim(),items,...(input.transferDate?{transferDate}:{})});
  return mutate(async records=>{
   const existing=records.find(record=>record.requestId===input.requestId);if(existing){if(existing.createdBy.id!==actor.id||existing.from.id!==actor.locationId||existing.fingerprint!==fingerprint)fail('This transfer reference has already been used.',409);return view(existing,actor);}
   const source=await context(actor,actor.locationId);requirePermission(source,'transfers.send');const target=await context(actor,input.destinationLocationId);requirePermission(target,'transfers.view');
   const {lines,totalCents}=await buildLines(source.companyId,target.companyId,items,input.moveCosts);
   const endpoint=person=>({id:person.locationId,name:person.locationName,companyId:person.companyId,companyName:person.companyName});
   const record={id:crypto.randomUUID(),requestId:input.requestId,fingerprint,revision:1,status:'sent',from:endpoint(source),to:endpoint(target),moveCosts:input.moveCosts,notes:input.notes.trim(),items:lines,totalCents,transferDate,createdAt:timestamp(),createdBy:{id:actor.id,name:actor.username},receivedAt:null,receivedBy:null};records.push(record);return view(record,actor);
  });
 }
 async function change(actor,id,action,input,homeApproval=false){if(!uuid(id)||!['receive','cancel'].includes(action))fail('Transfer not found.',404);if(!input||!Number.isSafeInteger(input.revision)||!uuid(input.requestId))fail('Reload the transfer before continuing.');return mutate(async records=>{
  const record=records.find(record=>record.id===id);if(!record||(record.from.id!==actor.locationId&&record.to.id!==actor.locationId))fail('Transfer not found.',404);
  const fresh=await context(actor,actor.locationId),receiving=action==='receive';requirePermission(fresh,receiving?'transfers.receive':'transfers.send');if((receiving?record.to.id:record.from.id)!==fresh.locationId)fail('Switch to the '+(receiving?'receiving':'sending')+' location to do this.',403);
  if(homeApproval)await requireHomeManager(fresh);
  if(record.actionRequestId===input.requestId&&record.status===(receiving?'received':'cancelled'))return view(record,fresh);
  if(record.status!=='sent'||record.revision!==input.revision)fail('The transfer has changed. Reload its current status.',409);
  if(receiving){const catalogue=await catalogues.read(fresh.companyId);if(record.items.some(item=>!catalogue.products.some(product=>product.id===item.target.id)))fail('A receiving item was removed. Cancel this transfer at the sending location and create a new one with the correct item.',409);record.receivedAt=timestamp();record.receivedBy={id:actor.id,name:actor.username};}
  else {record.cancelledAt=timestamp();record.cancelledBy={id:actor.id,name:actor.username};}
  record.status=receiving?'received':'cancelled';record.revision++;record.actionRequestId=input.requestId;return view(record,fresh);
 });}
 return {options,destination,list,homePending,edit,homeReceive:(actor,id,input)=>change(actor,id,'receive',input,true),create,change};
}
async function route({req,url,params,session,store,body,json}){
 if(!url.startsWith('/api/stock-transfers'))return false;if(!session)fail('Sign-in required.',401);if(!can(session,'transfers.view'))fail('Stock transfer access required.',403);
 if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url.startsWith('/api/stock-transfers/home-pending')){
  if(!can(session,'home.view')||!can(session,'transfers.receive'))fail('Home and stock receiving permissions are required.',403);
  if(url==='/api/stock-transfers/home-pending'&&req.method==='GET'){json(200,await store.homePending(session));return true;}
  const action=url.match(/^\/api\/stock-transfers\/home-pending\/([a-f0-9-]+)\/receive$/i);
  if(action&&req.method==='POST'){const record=await store.homeReceive(session,action[1],await body(req));json(200,{id:record.id,status:record.status,revision:record.revision,from:{id:record.from.id},to:{id:record.to.id}});return true;}
  fail('Transfer endpoint not found.',404);
 }
 if(url==='/api/stock-transfers'&&req.method==='GET'){json(200,await store.list(session));return true;}
 {const match=url.match(/^\/api\/stock-transfers\/([a-f0-9-]+)\/edit$/i);if(match&&req.method==='POST'){json(200,await store.edit(session,match[1],await body(req)));return true;}}
 if(url==='/api/stock-transfers/options'&&req.method==='GET'){json(200,await store.options(session));return true;}
 if(url==='/api/stock-transfers/destination'&&req.method==='GET'){json(200,await store.destination(session,params.get('location')));return true;}
 if(url==='/api/stock-transfers'&&req.method==='POST'){json(201,await store.create(session,await body(req,128000)));return true;}
 const match=url.match(/^\/api\/stock-transfers\/([a-f0-9-]+)\/(receive|cancel)$/i);if(match&&req.method==='POST'){json(200,await store.change(session,match[1],match[2],await body(req)));return true;}
 fail('Transfer endpoint not found.',404);
}
module.exports={createStore,route};
