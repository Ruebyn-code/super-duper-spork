// Phase 3 gate tests: an imported week reconciles to its source sheet, the
// weekly-first rule picks one source per day, and the forecast is the current
// app's own projection maths over the same rows.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createSales}=require('../sales');
const {seed}=require('../seed');
const legacySales=require('../../sales');
const {shift}=require('../sales');

const password='harbour-demo-passphrase';
const current=()=>legacySales.currentWeek(new Date());
const rejects=async(promise,status,message)=>assert.rejects(promise,error=>{
 assert.equal(error.status,status,`expected ${status}, got ${error.status}: ${error.message}`);
 if(message)assert.match(error.message,message);
 return true;
});
const dollars=cents=>(cents/100).toFixed(2);

async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-sales-'));
 const store=createStore(dir);
 // Demo business history would already hold these sales weeks.
 const data=await seed(store,{password,business:false});
 const sales=createSales({store,dir});
 const actor=data.accounts.find(account=>account.email==='admin@harbour.test');
 const company=data.companies.find(entry=>entry.name==='Harbour Group');
 const location=data.locations.find(entry=>entry.name==='Harbour Street');
 // A clean sales ledger: the ordering seed carries no sales rows.
 const csv=weekStart=>{
  const rows=[['date','till','uber_eats','door_dash','fees','total']];
  [1200,1000,1100,900,1300,1800,1400].forEach((till,index)=>{
   const uber=100,door=50,total=till+uber+door;
   rows.push([shift(weekStart,index),dollars(till*100),dollars(uber*100),dollars(door*100),'5.00',dollars(total*100)]);
  });
  return rows.map(row=>row.join(',')).join('\n');
 };
 return {dir,store,sales,actor,company,location,csv};
}

test('a saved week keeps a revision, and a stale save is refused',async()=>{
 const app=await fixture();
 const days=[100,200,300,400,500,600,700];
 const first=await app.sales.saveWeek(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:current(),days,revision:0});
 assert.equal(first.revision,1);
 await rejects(app.sales.saveWeek(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:current(),days:days.map(value=>value+1),revision:0}),409,/changed elsewhere/);
 const second=await app.sales.saveWeek(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:current(),days:days.map(value=>value+1),revision:1});
 assert.equal(second.revision,2);
 assert.deepEqual(second.days,days.map(value=>value+1));
});

test('an imported week reconciles to its sheet, and a mismatched total is refused',async()=>{
 const app=await fixture();
 const week=shift(current(),-7);
 const {report,reconciled}=await app.sales.importReport(app.actor,{companyId:app.company.id,locationId:app.location.id,csv:app.csv(week),sourceName:'week.csv'});
 assert.equal(reconciled,true);
 assert.equal(report.weekStart,week);
 // Monday: till 1200 + Uber 100 + DoorDash 50 = 1350 dollars.
 assert.equal(report.breakdown.tillSales[0],120000);
 assert.equal(report.totalCents,[1350,1150,1250,1050,1450,1950,1550].reduce((sum,value)=>sum+Math.round(value*100),0));
 assert.equal(report.checksum.length,64);

 const broken=app.csv(shift(current(),-14)).replace(/,\d+\.00\n/,',1.00\n');
 await rejects(app.sales.importReport(app.actor,{companyId:app.company.id,locationId:app.location.id,csv:broken}),400,/does not reconcile/);
});

test('the weekly report wins over daily sales for a day, and the forecast averages four completed weeks',async()=>{
 const app=await fixture();
 const weeks=[-4,-3,-2,-1].map(offset=>shift(current(),offset*7));
 for(const week of weeks)await app.sales.importReport(app.actor,{companyId:app.company.id,locationId:app.location.id,csv:app.csv(week)});
 // Daily sales for the same Monday disagree with the report and must lose.
 const imported=await app.sales.weeklyReport(app.actor,app.location.id,weeks[3]);
 const sheet=await app.sales.forecast(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:current()});
 assert.equal(sheet.projection.weeksRecorded,4);
 assert.equal(sheet.projection.history[3].days[0],imported.breakdown.tillSales[0]+imported.breakdown.uberEats[0]+imported.breakdown.doorDash[0]);
 const dayTotals=[1350,1150,1250,1050,1450,1950,1550].map(value=>value*100);
 const weekTotal=dayTotals.reduce((sum,value)=>sum+value,0);
 assert.equal(sheet.projection.projectedSalesCents,weekTotal);
 // Tuesday's projection is the average of the same weekday in each completed week.
 assert.equal(sheet.projection.dailyProjections[1].amountCents,dayTotals[1]);

 await app.sales.saveWeek(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:weeks[3],days:Array(7).fill(99),revision:0});
 const again=await app.sales.forecast(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:current()});
 assert.equal(again.projection.history[3].days[0],imported.breakdown.tillSales[0]+imported.breakdown.uberEats[0]+imported.breakdown.doorDash[0],'the report still wins after a daily-sales edit');
});

test('hourly sales split a projected day by the same weekday pattern and sum exactly',async()=>{
 const app=await fixture();
 const weeks=[-4,-3,-2,-1].map(offset=>shift(current(),offset*7));
 for(const week of weeks)await app.sales.importReport(app.actor,{companyId:app.company.id,locationId:app.location.id,csv:app.csv(week)});
 // Complete hourly reports for the same weekday in each completed week.
 for(const week of weeks){
  const hours=Array.from({length:24},(_,hour)=>hour>=9&&hour<17?1000+hour*10:0);
  await app.sales.saveHourly(app.actor,{companyId:app.company.id,locationId:app.location.id,date:week,hours,revision:0});
 }
 const sheet=await app.sales.forecast(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:current(),date:current()});
 assert.ok(Array.isArray(sheet.hourly.forecast.hours),sheet.hourly.forecast.reason||'');
 assert.equal(sheet.hourly.forecast.hours.reduce((sum,value)=>sum+value,0),sheet.hourly.forecast.projectedSalesCents);
 assert.equal(sheet.hourly.forecast.hours[12]>sheet.hourly.forecast.hours[9],true,'the historical hourly shape is preserved');
});

test('a complete week reports profit, while a partially recorded week reports unknown profit',async()=>{
 const app=await fixture();
 const week=current();
 await app.sales.saveWeek(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:week,days:Array(7).fill(100000),revision:0});
 await app.store.change('orders',list=>{list.push({id:'order-1',companyId:app.company.id,locationId:app.location.id,status:'requested',totalCents:200000,items:[{productId:'p',quantity:2,unitPriceCents:100000}],createdAt:week+'T02:00:00.000Z'});});
 await app.sales.saveExpense(app.actor,{companyId:app.company.id,locationId:app.location.id,date:week,type:'Rent',amountCents:50000});
 await app.sales.saveBudget(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:week,salesCents:800000,labourCents:200000});
 const report=await app.sales.weekReport(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:week});
 assert.equal(report.salesCents,700000);
 assert.equal(report.orderCostCents,200000);
 assert.equal(report.expenseCents,50000);
 assert.equal(report.profitCents,450000);
 assert.equal(report.marginPct,64.29);
 assert.equal(report.complete,true);
 assert.equal(report.budget.salesCents,800000);

 const partial=await app.sales.saveWeek(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:week,days:[100000,null,null,null,null,null,null],revision:1});
 assert.equal(partial.revision,2);
 const unknown=await app.sales.weekReport(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:week});
 assert.equal(unknown.recordedDays,1);
 assert.equal(unknown.profitCents,null);
 assert.equal(unknown.marginPct,null);
});

test('sales writes stay inside the actor company and location',async()=>{
 const app=await fixture();
 const riverside=app.actor && (await app.store.read('accounts')).find(account=>account.email==='admin@riverside.test');
 await rejects(app.sales.saveWeek(riverside,{companyId:app.company.id,locationId:app.location.id,weekStart:current(),days:Array(7).fill(1),revision:0}),404,/Company not found/);
});
