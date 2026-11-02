// Invoice routes: list, save the reviewed lines, read the comparison and apply
// the prices once.
const permissions=require('./permissions');
const views=require('./views-invoices');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const cents=value=>{
 const clean=String(value??'').replace(/[$,\s]/g,'');
 if(!clean)return null;
 const number=Number(clean);
 return Number.isFinite(number)&&number>=0?Math.round(number*100):NaN;
};

// description, sku, quantity, unit price — one item per line.
function parseLines(text){
 const rows=String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(!rows.length)fail('Add at least one invoice line.');
 return rows.map((line,index)=>{
  const cells=line.split(',').map(value=>value.trim());
  const description=cells[0],sku=cells[1]||'',quantity=Number(cells[2]),unitPriceCents=cents(cells[3]);
  if(!description)fail('Line '+(index+1)+' needs an item description.');
  if(!Number.isFinite(quantity)||quantity<=0)fail('Line '+(index+1)+' needs a positive quantity.');
  if(!Number.isSafeInteger(unitPriceCents))fail('Line '+(index+1)+' needs a unit price.');
  return {description,sku,quantity,unitPriceCents};
 });
}

async function route(ctx){
 const {url,method,viewer,actor,services,html,redirect,readBody,assertCsrf,scopeFor,notice}=ctx;
 const path=url.pathname;
 if(!path.startsWith('/invoices'))return false;
 if(!permissions.can(actor,'invoices.view'))throw permissions.deny('You do not have permission to view invoices.');

 if(path==='/invoices'&&method==='GET'){
  const scope=await scopeFor(actor,url.searchParams.get('locationId'));
  if(!scope.location)return html(200,views.list({account:viewer,location:null,locations:scope.locations,invoices:[],suppliers:[]}));
  const location=scope.location;
  const suppliers=(await services.store.read('suppliers')).filter(supplier=>supplier.companyId===location.companyId&&!supplier.archived);
  const invoices=await services.invoices.list(actor,{companyId:location.companyId,locationId:location.id});
  return html(200,views.list({account:viewer,location,locations:scope.locations,invoices,suppliers,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/invoices/view'&&method==='GET'){
  const invoiceId=url.searchParams.get('id');
  const reviewed=await services.invoices.review(actor,invoiceId);
  const history=await services.invoices.history(actor,invoiceId);
  return html(200,views.detail({account:viewer,invoice:reviewed,updates:history.updates,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/invoices'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const invoice=await services.invoices.create(actor,{companyId:form.companyId,locationId:form.locationId,
   supplierId:form.supplierId||null,supplierName:form.supplierName,invoiceDate:form.invoiceDate,invoiceNumber:form.invoiceNumber,
   lines:parseLines(form.lines)});
  return redirect(`/invoices/view?id=${encodeURIComponent(invoice.id)}&saved=invoice-saved`);
 }

 if(path==='/invoices/apply'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const result=await services.invoices.applyPrices(actor,{invoiceId:form.invoiceId,revision:Number(form.revision)});
  return redirect(`/invoices/view?id=${encodeURIComponent(result.invoice.id)}&saved=prices-applied`);
 }

 return false;
}
module.exports={route,parseLines};
