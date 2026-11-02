// Invoices for the rebuilt app: a saved weekly bill, its lines matched to the
// company catalogue, and one explicit confirmation that applies prices.
//
// Matching is automatic and server-side: a unique SKU wins, then a unique
// exact name; anything unknown or ambiguous keeps no product and never proposes
// a price. Confirming writes the catalogue price and its private audit in one
// transaction, refuses a stale invoice revision or an item priced by someone
// else since matching, and an applied invoice can never apply a second time.
// No upload is trusted as extraction evidence: the caller supplies the lines it
// reviewed, and this module never invents a price, conversion or GST amount.
const crypto=require('node:crypto');
const access=require('./access');
const permissions=require('./permissions');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max=200)=>String(value??'').trim().slice(0,max);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const monday=date=>new Date(Date.parse(date+'T00:00:00Z')-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
const normal=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const cents=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000;

function createInvoices({store,now=Date.now}){
 const stamp=()=>new Date(now()).toISOString();

 async function matchLines(companyId,lines){
  const products=(await store.read('products')).filter(product=>product.companyId===companyId&&!product.archived);
  const bySku=new Map(),byName=new Map();
  for(const product of products){
   const sku=normal(product.sku);
   if(sku)bySku.set(sku,[...(bySku.get(sku)||[]),product]);
   const name=normal(product.name);
   byName.set(name,[...(byName.get(name)||[]),product]);
  }
  return lines.map(line=>{
   const sku=normal(line.sku),name=normal(line.description||line.name);
   const skuMatch=sku?bySku.get(sku)||[]:[],nameMatch=name?byName.get(name)||[]:[];
   const match=skuMatch.length===1?{product:skuMatch[0],kind:'sku'}:nameMatch.length===1?{product:nameMatch[0],kind:'name'}:null;
   const ambiguous=skuMatch.length>1||(!match&&nameMatch.length>1);
   return {
    description:text(line.description||line.name,200),sku:text(line.sku,60),
    quantity:Number(line.quantity),unitPriceCents:Number(line.unitPriceCents),gstCents:line.gstCents==null?null:Number(line.gstCents),
    productId:match?match.product.id:null,productName:match?match.product.name:null,
    match:match?match.kind:ambiguous?'ambiguous':'unknown'
   };
  });
 }

 async function create(actor,input){
  const {company,location}=await access.write({store,account:actor,permission:'invoices.edit',companyId:input?.companyId,locationId:input?.locationId});
  permissions.requirePermission(actor,'invoices.edit');
  if(!permissions.can(actor,'invoices.upload'))throw permissions.deny('You do not have permission to upload invoices.');
  const invoiceDate=input?.invoiceDate;
  if(!validDate(invoiceDate))fail('Enter the invoice date.');
  const weekStart=input?.weekStart&&validDate(input.weekStart)?input.weekStart:monday(invoiceDate);
  if(!validDate(weekStart)||new Date(weekStart+'T00:00:00Z').getUTCDay()!==1)fail('Choose the Monday of the invoice week.');
  const raw=Array.isArray(input?.lines)?input.lines:[];
  if(!raw.length)fail('Add at least one invoice line.');
  const lines=await matchLines(company.id,raw);
  if(lines.some(line=>!Number.isFinite(line.quantity)||line.quantity<=0))fail('Enter a positive quantity on every line.');
  if(lines.some(line=>!cents(line.unitPriceCents)))fail('Enter every line price in cents.');
  const suppliers=await store.read('suppliers');
  const supplier=suppliers.find(candidate=>candidate.id===input?.supplierId&&candidate.companyId===company.id&&!candidate.archived)||null;
  const at=stamp(),revision=1;
  const record={
   id:crypto.randomUUID(),companyId:company.id,locationId:location.id,locationName:location.name,
   weekStart,invoiceDate,invoiceNumber:text(input?.invoiceNumber,80),supplierId:supplier?.id||null,
   supplierName:supplier?.name||text(input?.supplierName,120)||'Unnamed supplier',
   sourceName:text(input?.sourceName,180)||'',lines,
   totalCents:lines.reduce((sum,line)=>sum+Math.round(line.quantity*line.unitPriceCents),0),
   gstCents:lines.every(line=>Number.isSafeInteger(line.gstCents))?lines.reduce((sum,line)=>sum+line.gstCents,0):null,
   status:'review',revision,matchedAt:at,createdById:actor.id,createdByName:actor.name,appliedAt:null
  };
  await store.change('invoices',list=>{list.push(record);});
  return record;
 }

 // The read-only diff shown before confirming: only matched items whose price
 // actually differs become proposals.
 async function review(actor,invoiceId){
  const invoice=(await store.read('invoices')).find(record=>record.id===invoiceId);
  if(!invoice)fail('Invoice not found.',404);
  await access.read({store,account:actor,permission:'invoices.view',companyId:invoice.companyId,locationId:invoice.locationId});
  return describe(invoice,await store.read('products'));
 }

 function describe(invoice,products){
  const proposals=[];
  for(const line of invoice.lines){
   if(!line.productId)continue;
   const product=products.find(candidate=>candidate.id===line.productId);
   if(!product)fail('Invoice is stale: an item is no longer in the catalogue.',409);
   if(product.unitPriceCents===line.unitPriceCents)continue;
   proposals.push({
    productId:product.id,name:product.name,sku:product.sku||'',
    currentCents:Number.isSafeInteger(product.unitPriceCents)?product.unitPriceCents:null,
    newCents:line.unitPriceCents,productUpdatedAt:product.updatedAt||null
   });
  }
  return {...invoice,proposals};
 }

 async function applyPrices(actor,input){
  const invoice=(await store.read('invoices')).find(record=>record.id===input?.invoiceId);
  if(!invoice)fail('Invoice not found.',404);
  const {company,location}=await access.write({store,account:actor,permission:'invoices.edit',companyId:invoice.companyId,locationId:invoice.locationId});
  permissions.requirePermission(actor,'stock.manage');
  if(invoice.status==='applied')fail('These prices were already applied. Reopen the invoice to see its history.',409);
  if(invoice.status!=='review')fail('This invoice is not waiting on a price decision.',409);
  const revision=Number(input?.revision);
  if(revision!==invoice.revision)fail('This invoice changed since you reviewed it. Reload and check the prices again.',409);
  const at=stamp();
  return store.changeMany(['invoices','invoicePriceUpdates','products'],data=>{
   const record=data.invoices.find(item=>item.id===invoice.id);
   if(record.status!=='review')fail('These prices were already applied.',409);
   if(record.revision!==revision)fail('This invoice changed since you reviewed it.',409);
   const updates=[];
   for(const line of record.lines){
    if(!line.productId)continue;
    const product=data.products.find(candidate=>candidate.id===line.productId);
    // Someone may have changed the price after this invoice was matched. That
    // is a stale comparison, not permission to overwrite the newer value.
    if(!product)fail('Invoice is stale: an item is no longer in the catalogue.',409);
    if(product.unitPriceCents===line.unitPriceCents)continue;
    if((product.updatedAt||'')>(record.matchedAt||''))fail('Invoice is stale: '+product.name+' was priced again after this invoice was matched. Reload and confirm the current prices.',409);
    updates.push({productId:product.id,name:product.name,beforeCents:product.unitPriceCents,afterCents:line.unitPriceCents});
    product.unitPriceCents=line.unitPriceCents;
    product.updatedAt=at;
   }
   record.status='applied';
   record.appliedAt=at;
   record.appliedById=actor.id;
   record.appliedByName=actor.name;
   record.revision=record.revision+1;
   const audit={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,invoiceId:record.id,invoiceNumber:record.invoiceNumber,at,actorId:actor.id,actorName:actor.name,updates};
   if(updates.length)data.invoicePriceUpdates.push(audit);
   return {invoice:record,updates,auditId:audit.id};
  });
 }

 async function history(actor,invoiceId){
  const invoice=(await store.read('invoices')).find(record=>record.id===invoiceId);
  if(!invoice)fail('Invoice not found.',404);
  await access.read({store,account:actor,permission:'invoices.view',companyId:invoice.companyId,locationId:invoice.locationId});
  const updates=(await store.read('invoicePriceUpdates')).filter(record=>record.invoiceId===invoiceId).sort((a,b)=>a.at.localeCompare(b.at));
  return {invoice,updates};
 }

 async function list(actor,input){
  const {location}=await access.read({store,account:actor,permission:'invoices.view',companyId:input?.companyId,locationId:input?.locationId});
  const [invoices,updates]=await Promise.all([store.read('invoices'),store.read('invoicePriceUpdates')]);
  return invoices.filter(record=>record.locationId===location.id)
   .sort((a,b)=>b.invoiceDate.localeCompare(a.invoiceDate)||String(a.id).localeCompare(String(b.id)))
   .map(record=>({...record,updateCount:updates.filter(update=>update.invoiceId===record.id).reduce((sum,update)=>sum+update.updates.length,0)}));
 }

 // Applied invoice totals are the week's invoice-only cost of goods. They are
 // derived on read, so an invoice edit or deletion cannot leave a stale total.
 async function bundle(actor,input){
  const {location}=await access.read({store,account:actor,permission:'invoices.view',companyId:input?.companyId,locationId:input?.locationId});
  const invoices=(await store.read('invoices')).filter(record=>record.locationId===location.id&&record.weekStart===input?.weekStart&&record.status==='applied');
  return {
   weekStart:input?.weekStart,count:invoices.length,
   totalCents:invoices.reduce((sum,record)=>sum+record.totalCents,0),
   gstCents:invoices.every(record=>Number.isSafeInteger(record.gstCents))?invoices.reduce((sum,record)=>sum+record.gstCents,0):null,
   invoices:invoices.map(record=>({id:record.id,invoiceNumber:record.invoiceNumber,supplierName:record.supplierName,totalCents:record.totalCents,invoiceDate:record.invoiceDate}))
  };
 }

 return {create,review,applyPrices,history,list,bundle};
}
module.exports={createInvoices,monday};
