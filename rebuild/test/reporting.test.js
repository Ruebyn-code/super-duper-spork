// Reporting reads the other phases' records and never writes: an incomplete
// location is shown without profit, margin or a rank, and totals stay unknown.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createSales}=require('../sales');
const {createLearning}=require('../learning');
const {createChecklists}=require('../checklists');
const {createReporting}=require('../reporting');
const {seed}=require('../seed');
const legacySales=require('../../sales');

const password='harbour-demo-passphrase';
const week=()=>legacySales.currentWeek(new Date());

async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-reporting-'));
 const store=createStore(dir);
 const data=await seed(store,{password});
 const sales=createSales({store,dir});
 const learning=createLearning({store});
 const checklists=createChecklists({store});
 const reporting=createReporting({store,sales,learning,checklists});
 const actor=data.accounts.find(account=>account.email==='admin@harbour.test');
 const company=data.companies.find(entry=>entry.name==='Harbour Group');
 const street=data.locations.find(entry=>entry.name==='Harbour Street');
 const central=data.locations.find(entry=>entry.name==='Harbour Central');
 return {dir,store,sales,learning,checklists,reporting,actor,company,street,central};
}

test('an incomplete location is unranked and keeps overall totals unknown',async()=>{
 const app=await fixture();
 await app.sales.saveWeek(app.actor,{companyId:app.company.id,locationId:app.street.id,weekStart:week(),days:Array(7).fill(100000),revision:0});
 await app.store.change('orders',list=>{list.push({id:'order-a',companyId:app.company.id,locationId:app.street.id,status:'requested',totalCents:200000,items:[{productId:'p',quantity:1,unitPriceCents:200000}],createdAt:week()+'T02:00:00.000Z'});});
 await app.sales.saveWeek(app.actor,{companyId:app.company.id,locationId:app.central.id,weekStart:week(),days:[50000,null,null,null,null,null,null],revision:0});

 const overview=await app.reporting.overview(app.actor,{companyId:app.company.id,weekStart:week()});
 const street=overview.rows.find(row=>row.locationId===app.street.id);
 const central=overview.rows.find(row=>row.locationId===app.central.id);
 assert.equal(street.complete,true);
 assert.equal(street.profitCents,500000);
 assert.equal(street.rank,1);
 assert.equal(central.complete,false);
 assert.equal(central.profitCents,null);
 assert.equal(central.rank,null);
 assert.equal(overview.complete,false);
 assert.equal(overview.totals,null);

 // The overview is read-only: nothing was written by reading it.
 const before=JSON.stringify(await app.store.read('salesWeeks'));
 await app.reporting.overview(app.actor,{companyId:app.company.id,weekStart:week()});
 assert.equal(JSON.stringify(await app.store.read('salesWeeks')),before);
});

test('training and checklist progress appear only for viewers with those permissions',async()=>{
 const app=await fixture();
 const permissions=require('../permissions');
 const staffAccount={id:'report-staff',name:'Ari Staff',email:'ari@harbour.test',role:'user',
  permissions:[...permissions.defaults.find(item=>item.id==='user').permissions,'reporting.view'],actionPermissions:{},
  companyIds:[app.company.id],locationIds:[app.street.id],version:'v1'};
 await app.store.change('accounts',list=>{list.push(staffAccount);});
 const course=await app.learning.saveCourse(app.actor,{companyId:app.company.id,title:'Training',lessons:[{title:'One',body:'Body'}],questions:[{prompt:'Q',options:[{text:'A',correct:true},{text:'B',correct:false}]}]});
 await app.learning.publishCourse(app.actor,course.id);
 await app.learning.assign(app.actor,{companyId:app.company.id,courseId:course.id,accountIds:[staffAccount.id]});
 const checklist=await app.checklists.saveChecklist(app.actor,{companyId:app.company.id,title:'Opening',steps:['Door']});
 const run=await app.checklists.startRun(staffAccount,{checklistId:checklist.id,locationId:app.street.id});
 await app.checklists.tick(staffAccount,{runId:run.id,stepId:checklist.steps[0].id});

 const admin=await app.reporting.overview(app.actor,{companyId:app.company.id,weekStart:week()});
 assert.equal(admin.training.total,1);
 assert.equal(admin.training.outstanding,1);
 assert.equal(admin.checklists.find(item=>item.checklistId===checklist.id).completionPct,100);

 const staff=await app.reporting.overview(staffAccount,{companyId:app.company.id,weekStart:week()});
 assert.equal(staff.training,null,'staff without learning.report see no training report');
 assert.ok(Array.isArray(staff.checklists),'ops.view still shows checklist completion');
});
