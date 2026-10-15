const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises');
const overview=require('./weekly-sales-overview'),weekly=require('./weekly-sales-reports'),model=require('./public/weekly-sales-report'),schedule=require('./operating-expense-schedule');
const actor={id:'office',username:'Office',locationId:'shop',companyId:'default'},now=new Date('2026-10-15T02:00:00Z');
function report(weekStart,value=100000,extra={}){const breakdown=model.blank();for(const field of ['tillSales','uberEats','doorDash'])breakdown[field]=Array(7).fill(field==='tillSales'?value:0);return {weekStart,revision:0,breakdown,labourCents:70000,operatingExpensesCents:0,operatingAdditionalCents:0,roCents:7000,...extra};}
test('quarter weeks match Sunday ownership without duplicates; YTD uses Melbourne dates and handles leap years',()=>{
 const q4=overview.period({},now),starts=overview.weeks(q4);assert.equal(q4.key,'2026-Q4');assert.equal(starts[0],'2026-09-28');assert.equal(starts.at(-1),'2026-12-21');assert.equal(starts.length,13);
 const q1=overview.period({quarter:'2027-Q1'},now);assert.equal(overview.weeks(q1)[0],'2026-12-28');assert.ok(!overview.weeks(q1).some(week=>starts.includes(week)));assert.equal(q1.previous.startDate,'2026-10-01');
 const ytd=overview.period({mode:'ytd'},new Date('2026-10-14T14:00:00Z'));assert.equal(ytd.endDate,'2026-10-15');assert.equal(ytd.startDate,'2026-01-01');assert.equal(ytd.previous.endDate,'2025-10-15');assert.equal(overview.weeks(ytd,{includePartial:true}).at(-1),'2026-10-12');
 assert.equal(overview.period({mode:'ytd'},new Date('2024-02-29T02:00:00Z')).previous.endDate,'2023-02-28');
 for(const params of [{mode:'invalid'},{quarter:'../../bad'},{quarter:'2026-Q5'},{quarter:'0000-Q1'},{quarter:'9999-Q4'}])assert.throws(()=>overview.period(params,now),error=>error.status===400);
});
test('averages exclude incomplete weeks, preserve unknown expenses, and weight profit percentage by sales',()=>{
 const base={completed:true,salesCents:100000,costOfGoodsPercent:10,labourPercent:20,opExPercent:null,roPercent:5,profitCents:-10000,profitPercent:-10},result=overview.average([base,{...base,salesCents:300000,costOfGoodsPercent:20,opExPercent:8,profitCents:60000,profitPercent:20},{...base,completed:false,salesCents:99999999}]);
 assert.equal(result.completedWeeks,2);assert.equal(result.salesCents,200000);assert.equal(result.costOfGoodsPercent,15);assert.equal(result.opExPercent,8);assert.equal(result.counts.opExPercent,1);assert.equal(result.profitCents,25000);assert.equal(result.profitPercent,12.5);assert.equal(overview.average([]).salesCents,null);
 assert.equal(overview.average([{...base,profitCents:-1},{...base,profitCents:0}]).profitCents,-1);
});
test('overview uses saved report sales, placed orders and canonical bills at the selected location, with complete-week averages',async()=>{
 const dir=await fs.mkdtemp('/tmp/sales-overview-');try{const store=weekly.createStore();await store.save(dir,actor,report('2026-09-28'));await store.save(dir,actor,report('2026-10-05',200000));await store.save(dir,actor,report('2026-10-12',300000));await store.save(dir,actor,report('2026-09-21',50000));
  await schedule.change(dir,actor,{revision:0,changes:[{id:'power',typeId:'electricity',totalCents:120000,weeks:2,startWeek:'2026-10-05'}]});
  const order=(id,createdAt,extra={})=>({id,createdAt,locationId:'shop',status:'requested',total:70000,items:[{id:'stock',quantity:1,price:70000}],...extra}),orders=[order('first','2026-10-04T13:00:00Z'),order('first','2026-10-04T13:00:00Z'),order('second','2026-10-11T12:59:59Z'),order('draft','2026-10-06T00:00:00Z',{status:'draft'}),order('other','2026-10-06T00:00:00Z',{locationId:'other'})];
  const result=await overview.build(dir,actor,{}, {store,orders,now}),first=result.rows[0],second=result.rows[1],current=result.rows[2];assert.equal(first.salesCents,700000);assert.equal(second.salesCents,1400000);assert.equal(second.costOfGoodsPercent,10);assert.equal(second.opExPercent,60000/1400000*100);assert.equal(second.profitCents,1123000);assert.equal(current.opExPercent,60000/2100000*100);assert.equal(current.completed,false);assert.equal(result.average.completedWeeks,2);assert.equal(result.average.salesCents,1050000);assert.equal(result.previousAverage.salesCents,350000);assert.equal(result.rows[3].salesCents,null);
  const other=await overview.build(dir,{...actor,locationId:'other'},{},{store,orders,now});assert.equal(other.average.salesCents,null);assert.equal(other.rows[1].salesCents,null);
  const missing=await overview.build(dir,actor,{},{store,orders:[order('unknown','2026-10-06T00:00:00Z',{pricePending:true})],now});assert.equal(missing.rows[1].costOfGoodsPercent,null);assert.equal(missing.rows[1].profitCents,null);assert.equal(missing.average.counts.profitCents,1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('YTD excludes sales and orders outside Jan 1 through today; partial boundary weeks do not enter averages',async()=>{
 const dir=await fs.mkdtemp('/tmp/sales-ytd-');try{const store=weekly.createStore();await store.save(dir,actor,report('2025-12-29'));await store.save(dir,actor,report('2026-10-12'));
  const order=(id,date)=>({id,createdAt:date,locationId:'shop',status:'requested',total:10000,items:[{price:10000,quantity:1}]});
  const result=await overview.build(dir,actor,{mode:'ytd'},{store,now,orders:[order('before','2025-12-30T01:00:00Z'),order('jan','2026-01-01T01:00:00Z'),order('now','2026-10-15T01:00:00Z'),order('future','2026-10-16T01:00:00Z')]});assert.equal(result.rows[0].salesCents,400000);assert.equal(result.rows[0].costOfGoodsPercent,2.5);assert.equal(result.rows.at(-1).salesCents,400000);assert.equal(result.rows.at(-1).costOfGoodsPercent,2.5);assert.equal(result.rows.at(-1).recordedDays,4);assert.equal(result.average.completedWeeks,0);assert.equal(result.average.salesCents,null);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
