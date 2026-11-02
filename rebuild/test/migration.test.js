// Phase 7 and 8 gate tests: a dry run writes nothing, an import is idempotent
// and reconciles, orphans are listed rather than dropped, and cut-over is
// refused until the migration reconciles.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createMigration}=require('../migrate');
const {createCutover}=require('../cutover');
const {seed}=require('../seed');

const password='harbour-demo-passphrase';
const rejects=async(promise,status,message)=>assert.rejects(promise,error=>{
 assert.equal(error.status,status,`expected ${status}, got ${error.status}: ${error.message}`);
 if(message)assert.match(error.message,message);
 return true;
});

const week='2026-10-05';
async function write(file,value){
 await fs.mkdir(path.dirname(file),{recursive:true});
 await fs.writeFile(file,JSON.stringify(value));
}

async function legacySource({orphan=false}={}){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-legacy-'));
 await write(path.join(dir,'companies.json'),[{id:'c1',name:'Legacy Co',createdAt:'2024-01-01T00:00:00.000Z'}]);
 await write(path.join(dir,'locations.json'),[
  {id:'l1',companyId:'c1',name:'Legacy Store',publicHolidayState:'VIC',createdAt:'2024-01-01T00:00:00.000Z'}
 ]);
 await write(path.join(dir,'accounts.json'),[{id:'a1',username:'admin',role:'admin',locationIds:['l1'],version:'v1'}]);
 await write(path.join(dir,'catalogue.json'),{
  suppliers:[{id:'s1',companyId:'c1',name:'Supplier A'}],
  products:[{id:'p1',companyId:'c1',name:'Flour',price:1200,sku:'F1',supplierId:'s1',minimumOrder:1,orderRule:'minimum'}]
 });
 await write(path.join(dir,'location-sales','l1',week+'.json'),{weekStart:week,days:[100,200,300,400,500,600,700],revision:3,updatedAt:'2026-10-12T00:00:00.000Z'});
 await write(path.join(dir,'weekly-sales-reports','l1',week+'.json'),{weekStart:week,breakdown:{tillSales:[100,200,300,400,500,600,700],uberEats:[10,10,10,10,10,10,10],doorDash:[5,5,5,5,5,5,5]}});
 await write(path.join(dir,'stock-counts','count-1.json'),[{id:'count-1',locationId:'l1',locationName:'Legacy Store',countDate:'2026-10-04',items:[{productId:'p1',name:'Flour',quantity:12.5}],createdAt:'2026-10-04T00:00:00.000Z'}]);
 if(orphan)await write(path.join(dir,'location-sales','l9',week+'.json'),{weekStart:week,days:[1,1,1,1,1,1,1]});
 return dir;
}

async function fixture(options){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-migration-'));
 const store=createStore(dir);
 await seed(store,{password});
 const sourceDir=await legacySource(options);
 const migration=createMigration({store,sourceDir});
 const cutover=createCutover({store});
 return {dir,store,sourceDir,migration,cutover};
}

test('a dry run reports what would move, lists orphans, and writes nothing',async()=>{
 const app=await fixture({orphan:true});
 const before=JSON.stringify(await app.store.read('salesWeeks'));
 const report=await app.migration.dryRun();
 assert.equal(report.dryRun,true);
 assert.equal(report.counts.companies.source,1);
 assert.equal(report.counts.salesWeeks.source,2);
 assert.equal(report.orphans.length,1);
 assert.equal(report.orphans[0].id,'sales-l9-'+week);
 assert.equal(JSON.stringify(await app.store.read('salesWeeks')),before,'a dry run never writes');
 assert.deepEqual(await app.store.read('migrationRuns'),[]);
});

test('an import is idempotent, keeps the source ids, and reconciles its totals',async()=>{
 const app=await fixture();
 const first=await app.migration.apply();
 assert.equal(first.counts.salesWeeks.imported,1);
 assert.equal(first.counts.products.imported,1);
 assert.equal(first.reconciliation.reconciled,true);
 assert.equal(first.status,'reconciled');
 const sales=await app.store.read('salesWeeks');
 const migrated=sales.find(record=>record.locationId==='l1');
 assert.equal(migrated.companyId,'c1');
 assert.equal(migrated.legacyId,'sales-l1-'+week);
 const weekly=await app.store.read('weeklyReports');
 assert.equal(weekly.find(record=>record.locationId==='l1').totalCents,100+200+300+400+500+600+700+7*10+7*5);
 const counts=await app.store.read('counts');
 const migratedCount=counts.find(record=>record.legacyId==='count-1');
 assert.ok(migratedCount,'the legacy count is imported alongside the seeded history');
 assert.equal(migratedCount.items[0].quantity,12.5);

 const second=await app.migration.apply();
 assert.equal(second.counts.salesWeeks.imported,0);
 assert.equal(second.counts.salesWeeks.updated,1);
 assert.equal((await app.store.read('salesWeeks')).filter(record=>record.locationId==='l1').length,1,'no duplicate week');
 assert.equal((await app.store.read('migrationRuns')).length,2);
});

test('an orphan blocks sign-off instead of being dropped',async()=>{
 const app=await fixture({orphan:true});
 const report=await app.migration.apply();
 assert.equal(report.orphans.length,1);
 assert.equal(report.status,'attention');
 const state=await app.cutover.status();
 assert.equal(state.ready,false);
 assert.match(state.blockers.join(' '),/unresolved/);
 await rejects(app.cutover.retire({signedOffBy:'Hayley'}),409,/blocked/);
});

test('cut-over is refused until a reconciled run, then can be rolled back',async()=>{
 const app=await fixture();
 await rejects(app.cutover.retire({signedOffBy:'Hayley'}),409,/Run the migration before cut-over/);
 const report=await app.migration.apply();
 assert.equal(report.status,'reconciled');
 const state=await app.cutover.status();
 assert.equal(state.ready,true);
 await rejects(app.cutover.retire({signedOffBy:'Hayley',runId:'not-the-latest'}),409,/not the latest/);
 const retired=await app.cutover.retire({signedOffBy:'Hayley'});
 assert.equal(retired.phase,'read-only');
 assert.equal(retired.migrationRunId,report.id);
 await rejects(app.cutover.retire({signedOffBy:'Hayley'}),409,/already retired/);
 const rolled=await app.cutover.rollback({actor:{name:'Hayley'},reason:'Recheck counts'});
 assert.equal(rolled.phase,'rehearsal');
 assert.equal((await app.cutover.status()).phase,'rehearsal');
});
