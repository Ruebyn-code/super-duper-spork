const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const sales=require('./sales'),{shift}=require('./stock-usage'),{createServer}=require('./server'),{saveAdmin,saveUser}=require('./auth');
const account={id:'own-account'},now=new Date('2026-10-13T00:00:00Z');
const history=()=>[1,2,3,4].map(index=>({accountId:account.id,weekStart:shift('2026-10-12',-7*index),days:Array.from({length:7},(_,day)=>index*1000+day*100)}));
test('sales projection averages the four previous Monday–Sunday weeks and budgets exactly 28%',()=>{
 const records=history();records.push({accountId:account.id,weekStart:'2026-10-12',days:Array(7).fill(999999)},{accountId:'other-account',weekStart:'2026-10-05',days:Array(7).fill(999999)},{accountId:account.id,weekStart:'2026-09-07',days:Array(7).fill(999999)});
 const result=sales.calculate(records,[],account,{now});
 assert.equal(result.weekStart,'2026-10-12');assert.equal(result.weekEnd,'2026-10-18');assert.equal(result.weeksRecorded,4);assert.equal(result.projectedSalesCents,19600);assert.equal(result.budgetCents,5488);assert.equal(result.remainingCents,5488);
 assert.deepEqual(result.dailyProjections.map(day=>day.amountCents),[2500,2600,2700,2800,2900,3000,3100]);
});
test('blank sales days stay incomplete; zero sales are valid and monetary averages round to cents',()=>{
 const records=history();records[0].days[6]=null;let result=sales.calculate(records,[],account,{now});
 assert.equal(result.weeksRecorded,3);assert.equal(result.projectedSalesCents,null);assert.equal(result.budgetCents,null);assert.equal(result.dailyProjections[0].amountCents,null);assert.equal(result.history[0].recordedDays,6);
 for(const record of records)record.days=Array(7).fill(0);result=sales.calculate(records,[],account,{now});assert.equal(result.projectedSalesCents,0);assert.equal(result.budgetCents,0);
 records[0].days[0]=7;result=sales.calculate(records,[],account,{now});assert.equal(result.projectedSalesCents,2);assert.equal(result.budgetCents,1);
});
test('sales calendar handles Melbourne Monday boundaries, DST and years; budget counts only own weekly orders',()=>{
 assert.equal(sales.currentWeek(new Date('2026-10-11T12:59:59Z')),'2026-10-05');assert.equal(sales.currentWeek(new Date('2026-10-11T13:00:00Z')),'2026-10-12');
 assert.equal(sales.currentWeek(new Date('2026-04-05T13:59:59Z')),'2026-03-30');assert.equal(sales.currentWeek(new Date('2026-04-05T14:00:00Z')),'2026-04-06');assert.equal(sales.currentWeek(new Date('2027-01-01T00:00:00Z')),'2026-12-28');
 const order=(id,date,extra={})=>({id,createdAt:date,requestOwnerId:account.id,total:1000,items:[{id:'paper',quantity:1}],...extra});
 const orders=[order('opening','2026-10-11T13:00:00Z'),order('opening','2026-10-11T13:00:00Z'),order('closing','2026-10-18T12:59:59Z'),order('previous','2026-10-11T12:59:59Z'),order('next','2026-10-18T13:00:00Z'),order('other','2026-10-13T00:00:00Z',{requestOwnerId:'other'}),order('bad','invalid')];
 let result=sales.calculate(history(),orders,account,{now});assert.equal(result.spentCents,2000);assert.equal(result.orderCount,2);assert.equal(result.remainingCents,3488);
 result=sales.calculate(history(),[...orders,order('pending','2026-10-13T00:00:00Z',{pricePending:true,total:6000})],account,{now});assert.equal(result.spentCents,8000);assert.equal(result.pricePending,true);assert.equal(result.remainingCents,null);
 result=sales.calculate(history(),[order('over','2026-10-13T00:00:00Z',{total:6000})],account,{now});assert.equal(result.remainingCents,-512);
});
test('sales saves persist per account, support corrections and retries, and protect concurrent edits',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sales-store-'));
 try{const store=sales.createStore(),input={weekStart:'2026-10-05',days:Array(7).fill(12345),revision:0};
 const first=await store.save(dir,account,input);assert.equal(first.revision,1);assert.equal((await store.save(dir,account,input)).revision,1);
 const correction={...input,days:[100,...input.days.slice(1)],revision:1};const results=await Promise.allSettled([store.save(dir,account,correction),store.save(dir,account,{...correction,days:Array(7).fill(5)})]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.equal(results[1].reason.status,409);
 const saved=(await sales.createStore().report(dir,account,'2026-10-05',{now})).record;assert.equal(saved.revision,2);assert.equal(saved.days[0],100);
 assert.deepEqual((await store.report(dir,{id:'another'},'2026-10-05',{now})).record.days,Array(7).fill(null));
 for(const bad of [{...input,weekStart:'2026-10-11'},{...input,weekStart:'../../secrets'},{...input,weekStart:'2026-02-30'},{...input,days:[-1,...input.days.slice(1)]},{...input,days:Array(7).fill(1.5)},{...input,days:Array(7).fill('100')},{...input,days:[]},{...input,revision:-1}])await assert.rejects(store.save(dir,account,bad),error=>error.status===400);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('all signed-in users can manage their own sales; APIs require sign-in and CSRF, survive restart and recalculate corrections',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sales-api-'));await saveAdmin(dir,'admin','test-password-admin');await saveUser(dir,'staff','test-password-staff');let server;
 const start=async()=>{server=createServer(dir);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port;};let url=await start();
 const login=async(username)=>{const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-password-'+username})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],session=await(await fetch(url+'/api/session',{headers:{Cookie:cookie}})).json();return {Cookie:cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'};};
 try{let headers=await login('staff');const request=async(method='GET',input,extra={})=>{const response=await fetch(url+'/api/sales',{method,headers:{...headers,...extra},body:input===undefined?undefined:JSON.stringify(input)});return {status:response.status,data:await response.json()};};
 assert.equal((await fetch(url+'/api/sales')).status,401);assert.equal((await fetch(url+'/sales',{redirect:'manual'})).headers.get('location'),'/login');assert.equal((await fetch(url+'/sales',{headers})).status,200);
 const current=sales.currentWeek(),input={weekStart:shift(current,-7),days:Array(7).fill(100000),revision:0};assert.equal((await request('PUT',input,{'X-CSRF-Token':''})).status,403);
 for(let index=1;index<=4;index++)assert.equal((await request('PUT',{...input,weekStart:shift(current,-7*index)})).status,200);
 let report=(await request()).data;assert.equal(report.projection.projectedSalesCents,700000);assert.equal(report.projection.budgetCents,196000);
 assert.equal((await request('PUT',{...input,revision:1,days:Array(7).fill(200000)})).status,200);report=(await request()).data;assert.equal(report.projection.projectedSalesCents,875000);assert.equal(report.projection.budgetCents,245000);
 const staff=headers;headers=await login('admin');assert.equal((await request()).data.projection.projectedSalesCents,null);assert.equal((await request('PUT',input)).status,200);headers=staff;assert.equal((await request()).data.projection.projectedSalesCents,875000);
 assert.equal((await fetch(url+'/api/sales?week=../../credentials',{headers})).status,400);
 await new Promise(resolve=>server.close(resolve));url=await start();headers=await login('staff');assert.equal((await request()).data.projection.budgetCents,245000);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});

test('all-time expense uses recorded sales and placed orders once for one location, with zero sales and pending prices distinct',()=>{
 const actor={id:'member',locationId:'shop'},record=(weekStart,days,locationId='shop')=>({weekStart,days,locationId});
 const records=[record('2020-01-06',[10000,null,0,null,null,null,null]),record('2026-10-12',[30000,null,null,null,null,null,null]),record('2026-10-12',Array(7).fill(999999),'other')];
 const order=(id,total,extra={})=>({id,total,locationId:'shop',requestOwnerId:'teammate',status:'requested',items:[{id:'paper',price:650}],...extra});
 const orders=[order('old',6500,{createdAt:'2020-01-06T00:00:00Z'}),order('old',6500),order('new',3500),order('draft',99999,{status:'draft'}),order('other',999999,{locationId:'other'})];
 assert.deepEqual(sales.allTimeTotals(records,orders,actor),{salesCents:40000,recordedDays:3,placedOrdersCents:10000,orderCount:2,pricePending:false,expensePercent:25});
 let totals=sales.allTimeTotals(records,[...orders,order('pending',100,{pricePending:true})],actor);assert.equal(totals.placedOrdersCents,10100);assert.equal(totals.expensePercent,null);assert.equal(totals.pricePending,true);
 totals=sales.allTimeTotals(records,[order('unknown',0,{items:[{id:'unknown',price:null}]})],actor);assert.equal(totals.expensePercent,null);
 totals=sales.allTimeTotals([record('2026-10-12',Array(7).fill(0))],orders,actor);assert.equal(totals.salesCents,0);assert.equal(totals.expensePercent,null);
 assert.equal(sales.allTimeTotals(records,[],actor).expensePercent,0);
});

test('quarter sales keeps legacy weeks but uses location corrections once across restarts',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sales-all-time-')),actor={id:'member',locationId:'shop',legacyAccountIds:['original']};
 try{const legacy=path.join(dir,'sales','original');await fs.mkdir(legacy,{recursive:true});
 for(const weekStart of ['2020-01-06','2020-01-13'])await fs.writeFile(path.join(legacy,weekStart+'.json'),JSON.stringify({accountId:'original',weekStart,days:Array(7).fill(100),revision:1}));
 await fs.writeFile(path.join(legacy,'credentials.json'),'{}');await fs.writeFile(path.join(legacy,'2020-01-12.json'),JSON.stringify({days:Array(7).fill(999999)}));
 const store=sales.createStore();assert.equal((await store.totals(dir,actor,{now:new Date('2020-01-14T00:00:00Z')})).salesCents,1400);
 await store.save(dir,actor,{weekStart:'2020-01-06',days:[300,null,null,null,null,null,null],revision:1});
 const totals=await sales.createStore().totals(dir,actor,{now:new Date('2020-01-14T00:00:00Z')});assert.equal(totals.salesCents,1000);assert.equal(totals.recordedDays,8);
 assert.equal((await store.totals(dir,{id:'member',locationId:'another'})).salesCents,0);
 assert.equal(JSON.parse(await fs.readFile(path.join(legacy,'2020-01-06.json'),'utf8')).days[0],100);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('current calendar quarter uses Melbourne midnight across DST and year boundaries',()=>{
 const boundary=(before,after,end,start,number)=>{assert.equal(sales.currentQuarter(new Date(before)).endDate,end);const next=sales.currentQuarter(new Date(after));assert.equal(next.startDate,start);assert.equal(next.number,number);};
 boundary('2026-03-31T12:59:59Z','2026-03-31T13:00:00Z','2026-03-31','2026-04-01',2);
 boundary('2026-06-30T13:59:59Z','2026-06-30T14:00:00Z','2026-06-30','2026-07-01',3);
 boundary('2026-09-30T13:59:59Z','2026-09-30T14:00:00Z','2026-09-30','2026-10-01',4);
 boundary('2026-12-31T12:59:59Z','2026-12-31T13:00:00Z','2026-12-31','2027-01-01',1);
 assert.equal(sales.currentQuarter(new Date('2024-02-29T00:00:00Z')).endDate,'2024-03-31');
});

test('home splits sales weeks at both quarter edges and ratios quarter orders without older pending prices or other locations',()=>{
 const actor={id:'member',locationId:'shop'},record=(weekStart,days,locationId='shop')=>({weekStart,days,locationId});
 const records=[record('2026-09-28',[9000,8000,7000,100,200,300,400]),record('2026-12-28',[10,20,30,40,5000,6000,7000]),record('2026-10-12',[0,null,100,null,null,null,null]),record('2027-01-04',Array(7).fill(9999)),record('2026-10-12',Array(7).fill(9999),'other')];
 const order=(id,total,createdAt,extra={})=>({id,total,createdAt,locationId:'shop',status:'requested',items:[{price:100}],...extra});
 const orders=[order('before',4000,'2026-09-30T13:59:59Z',{pricePending:true}),order('opening',100,'2026-09-30T14:00:00Z'),order('opening',100,'2026-09-30T14:00:00Z'),order('closing',200,'2026-12-31T12:59:59Z'),order('after',1000,'2026-12-31T13:00:00Z'),order('other',9999,'2026-10-13T00:00:00Z',{locationId:'other'}),order('draft',9999,'2026-10-13T00:00:00Z',{status:'draft'})];
 const options={now:new Date('2026-10-14T00:00:00Z')};let totals=sales.homeTotals(records,orders,actor,options);
 assert.equal(totals.salesCents,1200);assert.equal(totals.recordedDays,10);assert.equal(totals.placedOrdersCents,5300);assert.equal(totals.pricePending,true);assert.equal(totals.quarterPlacedOrdersCents,300);assert.equal(totals.quarterOrderCount,2);assert.equal(totals.quarterPricePending,false);assert.equal(totals.expensePercent,25);
 totals=sales.homeTotals(records,[...orders,order('pending',50,'2026-10-13T00:00:00Z',{items:[{price:null}]})],actor,options);assert.equal(totals.quarterPricePending,true);assert.equal(totals.expensePercent,null);
 totals=sales.homeTotals([record('2026-10-12',Array(7).fill(0))],orders,actor,options);assert.equal(totals.salesCents,0);assert.equal(totals.expensePercent,null);
 const next=sales.homeTotals(records,orders,actor,{now:new Date('2026-12-31T13:00:00Z')});assert.equal(next.salesCents,87993);assert.equal(next.quarterPlacedOrdersCents,1000);assert.equal(next.quarter.number,1);assert.equal(next.quarter.year,2027);
});

test('quarter weekly averages use elapsed calendar weeks, shared location data and only placed orders through today',()=>{
 const actor={id:'member',locationId:'shop'},record=(weekStart,days,locationId='shop')=>({weekStart,days,locationId});
 const records=[record('2026-09-28',[900000,900000,900000,10000,0,null,null]),record('2026-10-12',[30000,null,10000,250000,null,null,null]),record('2026-10-12',Array(7).fill(999999),'other')];
 const order=(id,total,createdAt,extra={})=>({id,total,createdAt,locationId:'shop',requestOwnerId:'teammate',status:'requested',items:[{price:100}],...extra});
 const orders=[order('old',99999,'2026-09-30T13:59:59Z',{pricePending:true}),order('opening',5000,'2026-09-30T14:00:00Z'),order('opening',5000,'2026-09-30T14:00:00Z'),order('today',10000,'2026-10-14T00:00:00Z'),order('future',99999,'2026-10-14T13:00:00Z',{pricePending:true}),order('other',99999,'2026-10-13T00:00:00Z',{locationId:'other'}),order('draft',99999,'2026-10-13T00:00:00Z',{status:'draft'})];
 const options={now:new Date('2026-10-14T00:00:00Z')};
 assert.deepEqual(sales.homeTotals(records,orders,actor,options).averages,{throughDate:'2026-10-14',elapsedDays:14,recordedDays:4,weeklySalesCents:25000,weeklyCostCents:7500,pricePending:false,expensePercent:30});
 records[1].days[0]=40000;const corrected=sales.homeTotals(records,orders,{id:'teammate',locationId:'shop'},options).averages;
 assert.equal(corrected.weeklySalesCents,30000);assert.equal(corrected.weeklyCostCents,7500);assert.equal(corrected.expensePercent,25);
 assert.equal(sales.homeTotals(records,orders,{id:'member',locationId:'empty'},options).averages.weeklySalesCents,null);
});
test('quarter averages distinguish missing sales, recorded zero and unknown prices, and keep percentages unrounded',()=>{
 const actor={id:'member',locationId:'shop'},options={now:new Date('2026-10-03T00:00:00Z')},record={weekStart:'2026-09-28',locationId:'shop',days:[null,null,null,10001,null,null,null]};
 const order={id:'order',total:2800,createdAt:'2026-10-02T00:00:00Z',locationId:'shop',status:'requested',items:[{price:2800}]};
 let averages=sales.homeTotals([record],[order],actor,options).averages;
 assert.equal(averages.elapsedDays,3);assert.equal(averages.weeklySalesCents,23336);assert.equal(averages.weeklyCostCents,6533);assert.equal(averages.expensePercent,2800/10001*100);
 assert.notEqual(averages.expensePercent,averages.weeklyCostCents/averages.weeklySalesCents*100);
 averages=sales.homeTotals([record],[{...order,items:[{price:null}]}],actor,options).averages;assert.equal(averages.weeklySalesCents,23336);assert.equal(averages.weeklyCostCents,null);assert.equal(averages.expensePercent,null);assert.equal(averages.pricePending,true);
 averages=sales.homeTotals([],[],actor,options).averages;assert.equal(averages.weeklySalesCents,null);assert.equal(averages.weeklyCostCents,0);assert.equal(averages.expensePercent,null);
 averages=sales.homeTotals([{...record,days:Array(7).fill(0)}],[],actor,options).averages;assert.equal(averages.weeklySalesCents,0);assert.equal(averages.weeklyCostCents,0);assert.equal(averages.expensePercent,null);
});
test('quarter average elapsed days follow Melbourne dates through DST, leap days and quarter resets',()=>{
 const averages=now=>sales.homeTotals([],[],account,{now:new Date(now)}).averages;
 assert.equal(averages('2026-10-03T13:59:59Z').elapsedDays,3);assert.equal(averages('2026-10-03T14:00:00Z').elapsedDays,4);
 assert.equal(averages('2026-10-04T12:59:59Z').elapsedDays,4);assert.equal(averages('2026-10-04T13:00:00Z').elapsedDays,5);
 assert.equal(averages('2024-02-29T00:00:00Z').elapsedDays,60);
 assert.equal(averages('2026-12-31T12:59:59Z').elapsedDays,92);assert.equal(averages('2026-12-31T13:00:00Z').elapsedDays,1);
});

test('current-week performance compares matched recorded weekdays, excludes future sales and flags past gaps',()=>{
 const records=history(),current={accountId:account.id,weekStart:'2026-10-12',days:[3000,2200,null,900000,null,null,null]};records.push(current,{...current,accountId:'another',days:Array(7).fill(999999)});
 let result=sales.calculate(records,[],account,{now});
 assert.equal(result.today,'2026-10-13');assert.deepEqual(result.performance,{actualCents:5200,expectedCents:5100,differenceCents:100,differencePercent:100/5100*100,recordedDays:2,missingDays:0,dates:['2026-10-12','2026-10-13']});
 current.days=[null,0,null,null,null,null,null];result=sales.calculate(records,[],account,{now});assert.equal(result.performance.actualCents,0);assert.equal(result.performance.expectedCents,2600);assert.equal(result.performance.differenceCents,-2600);assert.equal(result.performance.differencePercent,-100);assert.equal(result.performance.missingDays,1);assert.equal(result.performance.recordedDays,1);
 current.days=[2500,2600,null,null,null,null,null];result=sales.calculate(records,[],account,{now});assert.equal(result.performance.differenceCents,0);assert.equal(result.performance.differencePercent,0);
});
test('sales progress distinguishes missing entries, missing history and zero expected sales, and uses Melbourne date boundaries',()=>{
 const records=history(),current={accountId:account.id,weekStart:'2026-10-12',days:Array(7).fill(null)};records.push(current);
 let progress=sales.calculate(records,[],account,{now}).performance;assert.equal(progress.recordedDays,0);assert.equal(progress.expectedCents,null);assert.equal(progress.differenceCents,null);assert.equal(progress.differencePercent,null);
 current.days[0]=100;records[0].days[6]=null;progress=sales.calculate(records,[],account,{now}).performance;assert.equal(progress.actualCents,100);assert.equal(progress.expectedCents,null);
 for(const record of records.slice(0,4))record.days=Array(7).fill(0);progress=sales.calculate(records,[],account,{now}).performance;assert.equal(progress.expectedCents,0);assert.equal(progress.differenceCents,100);assert.equal(progress.differencePercent,null);
 current.days[1]=250;const before=sales.calculate(records,[],account,{now:new Date('2026-10-12T12:59:59Z')}),after=sales.calculate(records,[],account,{now:new Date('2026-10-12T13:00:00Z')});assert.equal(before.today,'2026-10-12');assert.equal(before.performance.recordedDays,1);assert.equal(after.today,'2026-10-13');assert.equal(after.performance.recordedDays,2);
});
test('current-week comparison stays shared within a location when editing a historical week and recalculates historical corrections',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sales-performance-')),actor={id:'first',locationId:'shop'},teammate={id:'second',locationId:'shop'},store=sales.createStore();
 try{
 for(let index=1;index<=4;index++)await store.save(dir,actor,{weekStart:shift('2026-10-12',-index*7),days:[10000,20000,30000,40000,50000,60000,70000],revision:0});
 await store.save(dir,teammate,{weekStart:'2026-10-12',days:[12000,18000,null,null,null,null,null],revision:0});
 let report=await store.report(dir,actor,'2026-10-05',{now});assert.equal(report.record.weekStart,'2026-10-05');assert.equal(report.projection.performance.actualCents,30000);assert.equal(report.projection.performance.expectedCents,30000);
 await store.save(dir,actor,{weekStart:'2026-10-05',days:[20000,20000,30000,40000,50000,60000,70000],revision:1});
 report=await sales.createStore().report(dir,teammate,'2026-10-05',{now});assert.equal(report.projection.performance.actualCents,30000);assert.equal(report.projection.performance.expectedCents,32500);assert.equal(report.projection.performance.differenceCents,-2500);
 const other=await store.report(dir,{id:'first',locationId:'other'},undefined,{now});assert.equal(other.projection.performance.recordedDays,0);assert.equal(other.projection.performance.expectedCents,null);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
