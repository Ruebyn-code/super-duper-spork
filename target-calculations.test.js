const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const model=require('./target-calculations'),sales=require('./sales'),{shift}=require('./stock-usage'),{fixture,password}=require('./test-support/delivery-planning-fixture.cjs');
const url='/api/products/paper/target-calculation',ratio={mode:'sales',salesBaseCents:100000,quantityThousandths:500,revision:0};
async function app(t,options){const f=await fixture(options);t.after(()=>f.close());return f;}
async function seedSales(f,days=[100000,100000,100000,100000,100000,200000,300000],anchor='2026-10-26'){
 const store=sales.createStore();for(let n=1;n<=4;n++){const weekStart=shift(anchor,-n*7),previous=await sales.read(f.dir,f.office.session,weekStart);await store.save(f.dir,f.office.session,{weekStart,revision:previous.revision,days});}
}
async function product(f,actor=f.office,headers){return(await f.api(actor,'/api/catalogue','GET',undefined,headers)).products.find(p=>p.id==='paper');}

test('sales targets use exact cents and thousandths, distinguish missing from zero and never invent an oversized target',()=>{
 const base={paper:{level:9,average:8.5,orderWhenLevel:8.5,source:'usage',manualLevel:20}},settings={paper:ratio},projection={weekStart:'2026-10-26',weekEnd:'2026-11-01',projectedSalesCents:1000000};
 let result=model.apply(base,settings,projection).paper;assert.equal(result.level,5);assert.equal(result.source,'projected_sales');assert.equal(result.orderWhenLevel,8.5);assert.equal(result.average,8.5);assert.equal(base.paper.level,9);
 assert.equal(model.apply(base,settings,{...projection,projectedSalesCents:1100000}).paper.level,5.5);
 assert.equal(model.apply(base,{paper:{...ratio,salesBaseCents:125000,quantityThousandths:333}},projection).paper.level,2.664);
 assert.equal(model.apply(base,settings,{...projection,projectedSalesCents:0}).paper.level,0);
 result=model.apply(base,settings,null).paper;assert.equal(result.level,null);assert.match(result.calculationReason,/complete weekly sales projection/);
 result=model.apply(base,{paper:{...ratio,salesBaseCents:1,quantityThousandths:1000000000}},projection).paper;assert.equal(result.level,null);assert.match(result.calculationReason,/exceeds/);
 assert.deepEqual(model.apply(base,{paper:{mode:'usage'}},projection),base);
 for(const value of [{mode:'other'}, {...ratio,salesBaseCents:0},{...ratio,salesBaseCents:100.5},{...ratio,quantityThousandths:-1},{...ratio,quantityThousandths:0.5},{mode:'sales'},{...ratio,salesBaseCents:100000001}])assert.throws(()=>model.normalize(value),e=>e.status===400);
 assert.equal(model.normalize({...ratio,quantityThousandths:0}).quantityThousandths,0);
});

test('location sales targets feed Ordering and live count rules, preserve native usage triggers and keep sales and settings private',async t=>{
 const f=await app(t);await f.seed({currentStock:4});await seedSales(f);const catalogueFile=path.join(f.dir,'catalogue.json'),catalogueBefore=await fs.readFile(catalogueFile,'utf8');
 const saved=await f.api(f.office,url,'PUT',ratio);assert.equal(saved.revision,1);const p=await product(f);assert.equal(p.par.level,5);assert.equal(p.par.orderWhenLevel,70);assert.equal(p.ordering.recommended,1);assert.equal(p.par.projectionWeekStart,'2026-10-26');assert.equal(p.par.calculationSettings.mode,'sales');
 const rules=require('./public/stock-order-rules');assert.equal(rules.recommendation(p,p.par.level,3.5),2);assert.equal(rules.recommendation(p,p.par.level,5),0);
 const settingsFile=path.join(f.dir,'target-calculations',f.location+'.json'),before=await fs.readFile(settingsFile,'utf8');await product(f);assert.equal(await fs.readFile(settingsFile,'utf8'),before);assert.equal(await fs.readFile(catalogueFile,'utf8'),catalogueBefore);
 assert.deepEqual(await f.api(f.office,url,'PUT',ratio),saved);assert.equal(await fs.readFile(settingsFile,'utf8'),before);assert.equal((await f.request(f.office,url,'PUT',{...ratio,quantityThousandths:1000})).status,409);
 const staff=await product(f,f.staff);assert.equal(staff.par.level,5);assert.equal(staff.par.calculationSettings,undefined);for(const text of ['salesBaseCents','quantityThousandths','projectedSalesCents','updatedBy'])assert(!JSON.stringify(staff).includes(text),text);
 assert.equal((await f.request(f.staff,url,'PUT',ratio)).status,403);assert.equal((await f.request(f.office,url,'PUT',ratio,{'X-CSRF-Token':'wrong'})).status,403);assert.equal((await f.request(f.office,'/api/products/missing/target-calculation','PUT',ratio)).status,404);
 const other=await f.api(f.office,'/api/locations','POST',{name:'Other target store'});assert.notEqual((await product(f,f.office,{'X-Location-Id':other.id})).par.source,'projected_sales');assert.equal((await f.request(f.staff,url,'PUT',ratio,{'X-Location-Id':other.id})).status,403);assert.equal(f.calls.length,0);
});

test('switching back restores manual/usage targets, older item and manual writers preserve sales selection, and missing projections stay unavailable',async t=>{
 const f=await app(t);await f.api(f.office,'/api/products/paper/par','PUT',{level:20});await f.api(f.office,url,'PUT',ratio);let p=await product(f);assert.equal(p.par.level,null);assert.equal(p.ordering.recommended,null);assert.match(p.par.calculationReason,/projection/);
 await f.api(f.office,'/api/products/paper/par','PUT',{level:30});p=await product(f);const {par,ordering,...old}=p;await f.api(f.office,'/api/products/paper','PUT',{...old,price:p.price/100});assert.equal((await product(f)).par.source,'projected_sales');
 await seedSales(f);assert.equal((await product(f)).par.level,5);
 let config=await f.api(f.office,url,'PUT',{mode:'usage',revision:1});assert.equal(config.revision,2);p=await product(f);assert.equal(p.par.level,30);assert.equal(p.par.source,'manual');assert.equal(p.par.calculationSettings.quantityThousandths,500);
 for(let n=4;n>=0;n--)await f.count(shift('2026-10-25',-n*7),70*(n+1));p=await product(f);assert.equal(p.par.level,70);assert.equal(p.par.source,'usage');
 config=await f.api(f.office,url,'PUT',{...ratio,revision:2});await seedSales(f,Array(7).fill(0));p=await product(f);assert.equal(p.par.level,0);assert.equal(p.par.source,'projected_sales');assert.equal(p.ordering.recommended,0);assert.equal(config.revision,3);assert.equal(f.calls.length,0);
});

test('weekly sales targets follow Sunday forecast rollover and an active delivery schedule cannot override the selected weekly target',async t=>{
 const f=await app(t,{now:'2026-10-31T13:00:00Z'});await f.seed();await seedSales(f);await f.api(f.office,url,'PUT',ratio);const projection=(await f.api(f.office,'/api/sales')).orderingProjection;assert.equal(projection.weekStart,'2026-11-02');
 await f.schedule([{supplierId:'office',days:['mon','wed','fri'],leadDays:0,cutoffTime:'10:00',deliveryTime:'14:00'}]);const p=await product(f);assert.equal(p.par.level,5);assert.equal(p.par.projectionWeekStart,projection.weekStart);assert.equal(p.par.projectionWeekEnd,projection.weekEnd);assert.equal(p.ordering.deliveryPlan,undefined);assert.equal(p.par.average,70);assert.equal(f.calls.length,0);
});

test('sales targets follow weekly-report-first forecast changes and survive a fresh settings reader without exposing report data',async t=>{
 const f=await app(t);await seedSales(f);await f.count('2026-10-26',0);await f.api(f.office,url,'PUT',ratio);assert.equal((await product(f)).par.level,5);
 const folder=path.join(f.dir,'weekly-sales-reports',f.location);await fs.mkdir(folder,{recursive:true});const report={weekStart:'2026-10-19',companyId:f.office.session.companyId,locationId:f.location,breakdown:{tillSales:[500000,null,null,null,null,null,null],uberEats:[0,null,null,null,null,null,null],doorDash:[0,null,null,null,null,null,null]},privateInvoiceInformation:'never expose source reports'};const original=JSON.stringify(report);await fs.writeFile(path.join(folder,'2026-10-19.json'),original);
 const p=await product(f,f.staff);assert.equal(p.par.level,5.5);assert.equal(p.ordering.recommended,6);assert(!JSON.stringify(p).includes('privateInvoiceInformation'));assert.equal(await fs.readFile(path.join(folder,'2026-10-19.json'),'utf8'),original);assert.equal((await model.createStore().read(f.dir,f.office.session)).paper.quantityThousandths,500);assert.equal(f.calls.length,0);
});

test('target writes serialize revisions, reject denied detailed permissions and keep companies separate',async t=>{
 const f=await app(t);const outcomes=await Promise.all([f.request(f.office,url,'PUT',ratio),f.request(f.office,url,'PUT',{...ratio,quantityThousandths:1000})]);assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);
 const roles=await f.api(f.office,'/api/permission-levels'),custom=await f.api(f.office,'/api/permission-levels','POST',{revision:roles.revision,name:'Stock without targets',level:10,scope:'company',permissions:['orders.view','stock.manage'],actionPermissions:{'stock.targets':false}}),role=custom.levels.find(r=>r.name==='Stock without targets');await f.api(f.office,'/api/accounts','POST',{username:'Limited stock',password,role:role.id,companyId:f.office.session.companyId,locationId:f.location});const limited=await f.login('Limited stock');assert.equal((await f.request(limited,url,'PUT',ratio)).status,403);assert.equal((await product(f,limited)).par.calculationSettings,undefined);
 const company=await f.api(f.office,'/api/companies','POST',{name:'Separate company',locationName:'Separate target store'}),location=(await f.api(f.office,'/api/locations?all=true')).find(l=>l.companyId===company.id),headers={'X-Location-Id':location.id};const supplier=await f.api(f.office,'/api/suppliers','POST',{name:'Separate supplier'},headers),item=await f.api(f.office,'/api/products','POST',{name:'Pita',supplierId:supplier.id,unitAmount:'Box',price:5,minimumOrder:1,orderRule:'minimum'},headers),other=(await f.api(f.office,'/api/catalogue','GET',undefined,headers)).products.find(p=>p.id===item.id);assert.notEqual(other.par.source,'projected_sales');assert.equal(other.par.calculationSettings.revision,0);assert.equal((await f.request(f.office,url,'PUT',ratio,headers)).status,404);
 await f.api(f.office,'/api/communications/posts','POST',{title:'Required update',body:'Read before editing stock.',scope:'company',requireRead:true});assert.equal((await f.request(limited,url,'PUT',ratio)).status,428);assert.equal(f.calls.length,0);
});
