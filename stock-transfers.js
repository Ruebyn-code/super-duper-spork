const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),effects=require('./stock-transfer-effects');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});},uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const quantity=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=1000000&&Math.abs(value*1000-Math.round(value*1000))<.000001;
function createStore(dir,{locations,companies,catalogues,context,now=Date.now}){
 const file=path.join(dir,'stock-transfers.json');let pending=Promise.resolve();
 const timestamp=()=>new Date(now()).toISOString();
 function mutate(change){const operation=pending.then(async()=>{const records=await effects.read(dir),result=await change(records),temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temp,JSON.stringify(records,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result;});pending=operation.catch(()=>{});return operation;}
 function requirePermission(actor,key){if(!can(actor,key))fail('Stock transfer permission required.',403);}
 function view(record,actor){const {fingerprint,...visible}=record;return {...visible,canReceive:record.status==='sent'&&record.to.id===actor.locationId&&can(actor,'transfers.receive'),canCancel:record.status==='sent'&&record.from.id===actor.locationId&&can(actor,'transfers.send')};}
 async function options(actor){requirePermission(actor,'transfers.view');const choices=await locations.accessible(actor,{allCompanies:true}),result=[];for(const location of choices){const target=await context(actor,location.id);if(!can(target,'transfers.view'))continue;result.push({...location,companyName:(await companies.get(location.companyId)).name});}return {locations:result,products:(await catalogues.read(actor.companyId)).products.map(product=>productView(product))};}
 function productView(product){return {id:product.id,name:product.name,sku:product.sku||'',unitAmount:product.unitAmount||'',stockCountGroup:product.stockCountGroup,supplierId:product.supplierId||'',price:product.price??null};}
 async function destination(actor,id){requirePermission(actor,'transfers.send');const target=await context(actor,id);if(!can(target,'transfers.view'))fail('Transfer access is required at the receiving location.',403);const catalogue=await catalogues.read(target.companyId);return {location:{id:target.locationId,name:target.locationName,companyId:target.companyId,companyName:target.companyName},products:catalogue.products.map(productView)};}
 async function list(actor){requirePermission(actor,'transfers.view');return (await effects.read(dir)).filter(record=>record.from.id===actor.locationId||record.to.id===actor.locationId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)).map(record=>view(record,actor));}
 async function create(actor,input){requirePermission(actor,'transfers.send');
  if(!input||!uuid(input.requestId)||typeof input.destinationLocationId!=='string'||typeof input.moveCosts!=='boolean'||typeof input.notes!=='string'||input.notes.length>1000||!Array.isArray(input.items)||!input.items.length||input.items.length>100)fail('Choose a destination, cost option and 1–100 stock items.');
  if(input.destinationLocationId===actor.locationId)fail('Choose a different receiving location.');
  const seen=new Set(),items=input.items.map(item=>{if(!item||typeof item.sourceProductId!=='string'||typeof item.targetProductId!=='string'||seen.has(item.sourceProductId)||!quantity(item.quantity)||!quantity(item.targetQuantity))fail('Choose distinct stock items and positive quantities with up to three decimal places.');seen.add(item.sourceProductId);return {sourceProductId:item.sourceProductId,targetProductId:item.targetProductId,quantity:item.quantity,targetQuantity:item.targetQuantity};});
  const fingerprint=JSON.stringify({destinationLocationId:input.destinationLocationId,moveCosts:input.moveCosts,notes:input.notes.trim(),items});
  return mutate(async records=>{
   const existing=records.find(record=>record.requestId===input.requestId);if(existing){if(existing.createdBy.id!==actor.id||existing.from.id!==actor.locationId||existing.fingerprint!==fingerprint)fail('This transfer reference has already been used.',409);return view(existing,actor);}
   const source=await context(actor,actor.locationId);requirePermission(source,'transfers.send');const target=await context(actor,input.destinationLocationId);requirePermission(target,'transfers.view');
   const [fromCatalogue,toCatalogue]=await Promise.all([catalogues.read(source.companyId),catalogues.read(target.companyId)]);
   const snapshot=(product,catalogue)=>({...productView(product),supplier:catalogue.suppliers.find(supplier=>supplier.id===product.supplierId)?.name||''});
   const lines=items.map(item=>{const from=fromCatalogue.products.find(product=>product.id===item.sourceProductId),to=toCatalogue.products.find(product=>product.id===item.targetProductId);if(!from||!to)fail('An item is no longer in its company catalogue. Refresh the transfer.',409);
    if(source.companyId===target.companyId&&(from.id!==to.id||item.quantity!==item.targetQuantity))fail('Locations in the same company transfer the same stock item and unit quantity.');
    if(input.moveCosts&&(!Number.isSafeInteger(from.price)||from.price<0))fail(from.name+' needs a stock price before its cost can be transferred. Choose quantities only or set its price in the stock editor.');
    const totalCents=input.moveCosts?Math.round(from.price*item.quantity):0;if(!Number.isSafeInteger(totalCents)||totalCents>7000000000)fail('The transfer cost exceeds the supported limit.');
    return {source:snapshot(from,fromCatalogue),target:snapshot(to,toCatalogue),quantity:item.quantity,targetQuantity:item.targetQuantity,unitCostCents:input.moveCosts?from.price:null,totalCents};
   });
   const totalCents=lines.reduce((sum,item)=>sum+item.totalCents,0);if(!Number.isSafeInteger(totalCents)||totalCents>7000000000)fail('The transfer cost exceeds the supported limit.');
   const endpoint=person=>({id:person.locationId,name:person.locationName,companyId:person.companyId,companyName:person.companyName});
   const record={id:crypto.randomUUID(),requestId:input.requestId,fingerprint,revision:1,status:'sent',from:endpoint(source),to:endpoint(target),moveCosts:input.moveCosts,notes:input.notes.trim(),items:lines,totalCents,createdAt:timestamp(),createdBy:{id:actor.id,name:actor.username},receivedAt:null,receivedBy:null};records.push(record);return view(record,actor);
  });
 }
 async function change(actor,id,action,input){if(!uuid(id)||!['receive','cancel'].includes(action))fail('Transfer not found.',404);if(!input||!Number.isSafeInteger(input.revision)||!uuid(input.requestId))fail('Reload the transfer before continuing.');return mutate(async records=>{
  const record=records.find(record=>record.id===id);if(!record||(record.from.id!==actor.locationId&&record.to.id!==actor.locationId))fail('Transfer not found.',404);
  const fresh=await context(actor,actor.locationId),receiving=action==='receive';requirePermission(fresh,receiving?'transfers.receive':'transfers.send');if((receiving?record.to.id:record.from.id)!==fresh.locationId)fail('Switch to the '+(receiving?'receiving':'sending')+' location to do this.',403);
  if(record.actionRequestId===input.requestId&&record.status===(receiving?'received':'cancelled'))return view(record,fresh);
  if(record.status!=='sent'||record.revision!==input.revision)fail('The transfer has changed. Reload its current status.',409);
  if(receiving){const catalogue=await catalogues.read(fresh.companyId);if(record.items.some(item=>!catalogue.products.some(product=>product.id===item.target.id)))fail('A receiving item was removed. Cancel this transfer at the sending location and create a new one with the correct item.',409);record.receivedAt=timestamp();record.receivedBy={id:actor.id,name:actor.username};}
  else {record.cancelledAt=timestamp();record.cancelledBy={id:actor.id,name:actor.username};}
  record.status=receiving?'received':'cancelled';record.revision++;record.actionRequestId=input.requestId;return view(record,fresh);
 });}
 return {options,destination,list,create,change};
}
async function route({req,url,params,session,store,body,json}){
 if(!url.startsWith('/api/stock-transfers'))return false;if(!session)fail('Sign-in required.',401);if(!can(session,'transfers.view'))fail('Stock transfer access required.',403);
 if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/stock-transfers'&&req.method==='GET'){json(200,await store.list(session));return true;}
 if(url==='/api/stock-transfers/options'&&req.method==='GET'){json(200,await store.options(session));return true;}
 if(url==='/api/stock-transfers/destination'&&req.method==='GET'){json(200,await store.destination(session,params.get('location')));return true;}
 if(url==='/api/stock-transfers'&&req.method==='POST'){json(201,await store.create(session,await body(req,128000)));return true;}
 const match=url.match(/^\/api\/stock-transfers\/([a-f0-9-]+)\/(receive|cancel)$/i);if(match&&req.method==='POST'){json(200,await store.change(session,match[1],match[2],await body(req)));return true;}
 fail('Transfer endpoint not found.',404);
}
module.exports={createStore,route};
