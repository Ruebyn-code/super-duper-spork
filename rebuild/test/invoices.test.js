// Phase 4 gate tests: an invoice applies its prices once, refuses a stale
// comparison, and keeps its history when reopened.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createInvoices}=require('../invoices');
const {createCatalogue}=require('../catalogue');
const {seed}=require('../seed');

const password='harbour-demo-passphrase';
const rejects=async(promise,status,message)=>assert.rejects(promise,error=>{
 assert.equal(error.status,status,`expected ${status}, got ${error.status}: ${error.message}`);
 if(message)assert.match(error.message,message);
 return true;
});

async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-invoices-'));
 const store=createStore(dir);
 const data=await seed(store,{password});
 const invoices=createInvoices({store});
 const catalogue=createCatalogue({store});
 const actor=data.accounts.find(account=>account.email==='admin@harbour.test');
 const company=data.companies.find(entry=>entry.name==='Harbour Group');
 const location=data.locations.find(entry=>entry.name==='Harbour Street');
 const supplier=(await store.read('suppliers')).find(entry=>entry.companyId===company.id);
 const product=await catalogue.saveProduct(actor,{companyId:company.id,supplierId:supplier.id,name:'Invoice test flour',sku:'INV-FLOUR',unit:'25 kg',unitPriceCents:4200,orderRule:'minimum',minimumOrder:1});
 return {dir,store,invoices,catalogue,data,actor,company,location,supplier,product};
}

test('invoice lines match a unique SKU, then a unique name, and leave the rest unmatched',async()=>{
 const app=await fixture();
 const invoice=await app.invoices.create(app.actor,{companyId:app.company.id,locationId:app.location.id,supplierId:app.supplier.id,invoiceDate:'2026-10-21',invoiceNumber:'A-1001',lines:[
  {description:'Flour 25kg',sku:'INV-FLOUR',quantity:4,unitPriceCents:4400},
  {description:'Invoice test flour',quantity:1,unitPriceCents:4400},
  {description:'Never ordered before',quantity:2,unitPriceCents:900}
 ]});
 assert.equal(invoice.weekStart,'2026-10-19');
 assert.deepEqual(invoice.lines.map(line=>line.match),['sku','name','unknown']);
 assert.equal(invoice.lines[2].productId,null);
 assert.equal(invoice.totalCents,4*4400+4400+2*900);
 assert.equal(invoice.status,'review');
});

test('review shows only differing prices and applying writes them once with an audit',async()=>{
 const app=await fixture();
 const invoice=await app.invoices.create(app.actor,{companyId:app.company.id,locationId:app.location.id,supplierId:app.supplier.id,invoiceDate:'2026-10-21',lines:[
  {description:'Flour 25kg',sku:'INV-FLOUR',quantity:4,unitPriceCents:4400},
  {description:'Unmatched item',quantity:1,unitPriceCents:100}
 ]});
 const reviewed=await app.invoices.review(app.actor,invoice.id);
 assert.equal(reviewed.proposals.length,1);
 assert.equal(reviewed.proposals[0].currentCents,4200);
 assert.equal(reviewed.proposals[0].newCents,4400);

 const result=await app.invoices.applyPrices(app.actor,{invoiceId:invoice.id,revision:reviewed.revision});
 assert.equal(result.updates.length,1);
 const product=(await app.store.read('products')).find(item=>item.id===app.product.id);
 assert.equal(product.unitPriceCents,4400);
 await rejects(app.invoices.applyPrices(app.actor,{invoiceId:invoice.id,revision:invoice.revision}),409,/already applied/);

 const reopened=await app.invoices.history(app.actor,invoice.id);
 assert.equal(reopened.invoice.status,'applied');
 assert.equal(reopened.updates.length,1);
 assert.equal(reopened.updates[0].actorName,app.actor.name);
 assert.deepEqual(reopened.updates[0].updates.map(update=>[update.beforeCents,update.afterCents]),[[4200,4400]]);
});

test('a stale revision is refused, and so is an item repriced after the match',async()=>{
 const app=await fixture();
 const invoice=await app.invoices.create(app.actor,{companyId:app.company.id,locationId:app.location.id,supplierId:app.supplier.id,invoiceDate:'2026-10-21',lines:[
  {description:'Flour 25kg',sku:'INV-FLOUR',quantity:1,unitPriceCents:4500}
 ]});
 await rejects(app.invoices.applyPrices(app.actor,{invoiceId:invoice.id,revision:99}),409,/changed since you reviewed/);

 // A later catalogue edit makes the invoice's comparison stale.
 await new Promise(resolve=>setTimeout(resolve,5));
 await app.catalogue.saveProduct(app.actor,{companyId:app.company.id,productId:app.product.id,supplierId:app.supplier.id,name:'Invoice test flour',sku:'INV-FLOUR',unit:'25 kg',unitPriceCents:4600,orderRule:'minimum',minimumOrder:1});
 await rejects(app.invoices.applyPrices(app.actor,{invoiceId:invoice.id,revision:invoice.revision}),409,/stale/);
 const product=(await app.store.read('products')).find(item=>item.id===app.product.id);
 assert.equal(product.unitPriceCents,4600,'the newer catalogue price survives');
});

test('an applied invoice totals its week as the invoice-only cost of goods',async()=>{
 const app=await fixture();
 const invoice=await app.invoices.create(app.actor,{companyId:app.company.id,locationId:app.location.id,supplierId:app.supplier.id,invoiceDate:'2026-10-21',lines:[{description:'Flour 25kg',sku:'INV-FLOUR',quantity:2,unitPriceCents:4400}]});
 await app.invoices.applyPrices(app.actor,{invoiceId:invoice.id,revision:1});
 const bundle=await app.invoices.bundle(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:'2026-10-19'});
 assert.equal(bundle.count,1);
 assert.equal(bundle.totalCents,8800);
});

test('invoice access stays inside the actor company',async()=>{
 const app=await fixture();
 const riverside=(await app.store.read('accounts')).find(account=>account.email==='admin@riverside.test');
 await rejects(app.invoices.create(riverside,{companyId:app.company.id,locationId:app.location.id,invoiceDate:'2026-10-21',lines:[{description:'x',quantity:1,unitPriceCents:1}]}),404,/Company not found/);
});
