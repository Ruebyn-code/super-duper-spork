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

test('all-time sales keeps legacy weeks but uses location corrections once across restarts',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sales-all-time-')),actor={id:'member',locationId:'shop',legacyAccountIds:['original']};
 try{const legacy=path.join(dir,'sales','original');await fs.mkdir(legacy,{recursive:true});
 for(const weekStart of ['2020-01-06','2020-01-13'])await fs.writeFile(path.join(legacy,weekStart+'.json'),JSON.stringify({accountId:'original',weekStart,days:Array(7).fill(100),revision:1}));
 await fs.writeFile(path.join(legacy,'credentials.json'),'{}');await fs.writeFile(path.join(legacy,'2020-01-12.json'),JSON.stringify({days:Array(7).fill(999999)}));
 const store=sales.createStore();assert.equal((await store.totals(dir,actor)).salesCents,1400);
 await store.save(dir,actor,{weekStart:'2020-01-06',days:[300,null,null,null,null,null,null],revision:1});
 const totals=await sales.createStore().totals(dir,actor);assert.equal(totals.salesCents,1000);assert.equal(totals.recordedDays,8);
 assert.equal((await store.totals(dir,{id:'member',locationId:'another'})).salesCents,0);
 assert.equal(JSON.parse(await fs.readFile(path.join(legacy,'2020-01-06.json'),'utf8')).days[0],100);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
