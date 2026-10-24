const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const invoices=require('./invoices'),weekly=require('./weekly-sales-reports'),model=require('./public/weekly-sales-report'),overview=require('./weekly-sales-overview'),details=require('./reporting-details'),reporting=require('./reporting');
const invoice=require('./test-support/invoice-fixture.cjs'),{fixture,password}=require('./test-support/ai-assistance-fixture.cjs');
const actor={id:'office',username:'Office',role:'admin',companyId:'default',locationId:'shop'},week='2026-10-05',next='2026-10-12',now=new Date('2026-10-24T02:00:00Z');
function sales(weekStart=week){const breakdown=model.blank();for(const field of model.fields)breakdown[field]=Array(7).fill(field==='tillSales'||field==='cash'?10000:0);return {weekStart,revision:0,breakdown,labourCents:10000,operatingExpensesCents:2000,operatingAdditionalCents:2000,roCents:1000};}
test('weekly invoice expenses use saved GST-inclusive totals once in their bundle week and update on correction, move and delete without rewriting reports',async()=>{
 const dir=await fs.mkdtemp('/tmp/invoice-expenses-');try{
  const store=weekly.createStore();await store.save(dir,actor,sales());await store.save(dir,actor,sales(next));
  const file=path.join(dir,'weekly-sales-reports',actor.locationId,week+'.json'),before=await fs.readFile(file,'utf8');
  const orders=[{id:'order',status:'requested',locationId:'shop',companyId:'default',createdAt:'2026-10-06T00:00:00Z',total:99999,pricePending:true,items:[{name:'Stock',quantity:1,price:null}]}],originalOrders=JSON.stringify(orders),report=start=>store.report(dir,actor,start,{orders,now});
  let current=await report(week);assert.equal(current.stockCosts.source,'invoices');assert.equal(current.stockCosts.totalCents,0);assert.equal(current.stockCosts.invoiceCount,0);assert.equal(current.profit.amountCents,57000);assert.equal(current.weeklyOrders.pricePending,true);
  const input=invoice.input(week,11000,{subtotalCents:10000,taxCents:1000,invoiceDate:'2026-10-11'}),first=await invoices.create(dir,actor,input);await invoices.create(dir,actor,input);
  const second=await invoice.save(dir,actor,week,22000,{supplier:'Another supplier',subtotalCents:20000,taxCents:2000,invoiceDate:'2025-12-31'});await invoice.save(dir,actor,week,0);
  current=await report(week);assert.equal(current.stockCosts.invoiceCents,33000);assert.equal(current.stockCosts.invoiceCount,3);assert.equal(current.stockCosts.pricePending,false);assert.equal(current.profit.amountCents,24000);assert.equal(current.stockInvoices.length,3);assert.deepEqual(Object.keys(current.stockInvoices[0]).sort(),['id','supplier','invoiceNumber','invoiceDate','totalCents'].sort());assert.equal((await report(next)).stockCosts.invoiceCents,0,'Sunday invoice dates use the selected bundle, not order rollover');
  const corrected=await invoices.update(dir,actor,first.id,{...input,revision:first.revision,totalCents:12000});assert.equal((await report(week)).stockCosts.totalCents,34000);await assert.rejects(invoices.update(dir,actor,first.id,{...input,revision:1,totalCents:1}),e=>e.status===409);assert.equal((await report(week)).stockCosts.totalCents,34000);
  await invoices.update(dir,actor,second.id,{...await invoices.read(dir,actor,second.id),weekStart:next});assert.equal((await report(week)).stockCosts.totalCents,12000);assert.equal((await report(next)).stockCosts.totalCents,22000);
  const unknown=await invoice.save(dir,actor,next,null);const incomplete=await report(next);assert.equal(incomplete.stockCosts.invoiceCents,22000);assert.equal(incomplete.stockCosts.missingTotals,1);assert.equal(incomplete.stockCosts.pricePending,true);assert.equal(incomplete.profit.amountCents,null);
  await invoices.remove(dir,actor,unknown.id,unknown.revision);assert.equal((await report(next)).profit.amountCents,35000);
  await invoices.remove(dir,actor,first.id,corrected.revision);current=await report(week);assert.equal(current.stockCosts.totalCents,0);assert.equal(current.stockCosts.invoiceCount,1,'A real zero invoice remains distinct from no invoices');assert.equal(current.profit.amountCents,57000);
  assert.equal(await fs.readFile(file,'utf8'),before);assert.equal(JSON.stringify(orders),originalOrders);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('weekly overview and Reporting use the same invoice costs and incomplete-total rules, with private invoice fields excluded',async()=>{
 const dir=await fs.mkdtemp('/tmp/invoice-finance-');try{
  const store=weekly.createStore();for(const start of [week,next])await store.save(dir,actor,sales(start));await invoice.save(dir,actor,week,11000);await invoice.save(dir,actor,next,null);
  await invoice.save(dir,{...actor,companyId:'other',locationId:'other-location'},week,900000);
  const result=await overview.build(dir,actor,{quarter:'2026-Q4'},{store,now}),row=result.rows.find(row=>row.weekStart===week),missing=result.rows.find(row=>row.weekStart===next);assert.equal(row.costOfGoodsPercent,11000/70000*100);assert.equal(row.profitCents,46000);assert.equal(missing.profitCents,null);assert.equal(missing.costOfGoodsPercent,null);
  const financial=await details.build(dir,actor,reporting.range({start:week,end:'2026-10-18'},now),{store,now});assert.equal(financial.finance[0].costOfGoodsCents,11000);assert.equal(financial.finance[0].profitCents,row.profitCents);assert.equal(financial.finance[1].costOfGoodsCents,null);assert.equal(financial.invoices.length,2);assert(!JSON.stringify(financial.invoices).includes('ocrText'));assert.equal((await store.report(dir,{...actor,permissions:['finances.view']},week)).stockInvoices.length,0);
  const other=await store.report(dir,{...actor,locationId:'empty'},week);assert.equal(other.stockCosts.invoiceCount,0);assert.equal(other.stockCosts.totalCents,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('invoice expense API updates existing reports and enforces location, company and invoice-detail permissions without changing sales, budgets or catalogue prices',async()=>{
 const a=await fixture({fetchImpl:()=>{throw Error('No provider calls expected');}});try{
  const {office}=a;await a.api(office,'/api/weekly-sales-reports','PUT',sales());const beforeReport=await a.api(office,'/api/weekly-sales-reports?week='+week),beforeSales=await a.api(office,'/api/sales'),beforeCatalogue=await a.api(office,'/api/catalogue');
  const input=invoice.input(week,11000,{supplier:'Private invoice supplier',invoiceNumber:'PRIVATE-REFERENCE'});assert.equal((await a.request(office,'/api/invoices','POST',input,{'X-CSRF-Token':''})).status,403);await a.api(office,'/api/invoices','POST',input);
  const otherLocation=await a.api(office,'/api/locations','POST',{name:'Other location'}),otherCompany=await a.api(office,'/api/companies','POST',{name:'Other company',locationName:'Other company store'});
  for(const locationId of [otherLocation.id,otherCompany.locationId])await a.api(office,'/api/invoices','POST',invoice.input(week,900000),{'X-Location-Id':locationId});
  const after=await a.api(office,'/api/weekly-sales-reports?week='+week);assert.equal(after.stockCosts.invoiceCents,11000);assert.equal(after.profit.amountCents,46000);assert.deepEqual(after.record,beforeReport.record);assert.deepEqual(await a.api(office,'/api/sales'),beforeSales);assert.deepEqual(await a.api(office,'/api/catalogue'),beforeCatalogue);
  let roles=await a.api(office,'/api/permission-levels');roles=await a.api(office,'/api/permission-levels','POST',{revision:roles.revision,name:'Finance totals only',scope:'company',level:10,permissions:['home.view','finances.view']});const role=roles.levels.find(role=>role.name==='Finance totals only');
  await a.api(office,'/api/accounts','POST',{username:'FinanceViewer',password,role:role.id,companyId:office.session.companyId,locationId:a.location});const viewer=await a.login('FinanceViewer'),view=await a.api(viewer,'/api/weekly-sales-reports?week='+week);assert.equal(view.stockCosts.totalCents,11000);assert.equal(view.stockCosts.invoiceDetailsAvailable,false);assert.deepEqual(view.stockInvoices,[]);assert(!JSON.stringify(view).includes('PRIVATE-REFERENCE'));assert(!JSON.stringify(view).includes('Private invoice supplier'));assert.equal((await a.request(viewer,'/api/invoices/'+input.id)).status,403);assert.equal((await a.request(viewer,'/api/invoices/'+input.id+'/file')).status,403);
  for(const locationId of [otherLocation.id,otherCompany.locationId])assert.equal((await a.request(viewer,'/api/weekly-sales-reports?week='+week,'GET',undefined,{'X-Location-Id':locationId})).status,403);
  assert.equal(a.calls.length,0);
 }finally{await a.close();}
});
