const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const weekly=require('./public/weekly-sales-report'),{createStore,validate}=require('./weekly-sales-reports'),sales=require('./sales'),{shift}=require('./stock-usage'),{createServer}=require('./server'),{saveAdmin}=require('./auth');
const actor={id:'first',username:'First',companyId:'default',locationId:'shop'};
function input(weekStart='2026-10-05'){const breakdown=weekly.blank();for(const [field,value] of Object.entries({tillSales:170584,cash:33850,eftpos:136734,pettyCash:0,uberEats:38680,doorDash:14540}))breakdown[field][0]=value;return {weekStart,revision:0,breakdown,labourCents:668467,operatingExpensesCents:0};}
test('weekly report follows the written sales and variance formulas, including cents, negatives, blanks and explicit zeroes',()=>{
 const {breakdown}=input();let result=weekly.calculate(breakdown);assert.equal(result.days[0],189954);assert.notEqual(result.days[0],223804);assert.equal(result.variances[0],0);assert.equal(result.totals.cash,33850);assert.equal(result.recordedDays,1);assert.equal(result.reconciledDays,1);
 breakdown.tillSales[0]++;assert.equal(weekly.calculate(breakdown).variances[0],-1);breakdown.pettyCash[0]=2;assert.equal(weekly.calculate(breakdown).variances[0],1);
 breakdown.doorDash[0]=null;result=weekly.calculate(breakdown);assert.equal(result.days[0],null);assert.equal(result.totals.sales,null);assert.equal(result.recordedDays,0);assert.equal(result.reconciledDays,1);
 for(const field of weekly.fields)breakdown[field][1]=0;result=weekly.calculate(breakdown);assert.equal(result.days[1],0);assert.equal(result.variances[1],0);assert.equal(result.recordedDays,1);assert.equal(result.totals.sales,0);
 for(const field of weekly.fields)breakdown[field][6]=breakdown[field][0]??0;breakdown.doorDash[0]=14540;breakdown.doorDash[6]=14540;result=weekly.calculate(breakdown);assert.equal(result.totals.sales,379908);assert.equal(result.totals.variance,2);
 assert.deepEqual(weekly.calculate(weekly.blank()).days,Array(7).fill(null));
});
test('weekly reports persist separately by location and protect concurrent detail and weekly cost edits even when sales totals match',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'weekly-sales-'));try{
  const store=createStore(),first=await store.save(dir,actor,input());assert.equal(first.revision,1);assert.equal((await store.save(dir,actor,input())).revision,1);
  const corrected={...input(),revision:1};corrected.breakdown.cash[0]++;
  const results=await Promise.allSettled([store.save(dir,actor,corrected),store.save(dir,actor,{...corrected,labourCents:1})]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.equal(results[1].reason.status,409);
  const report=await createStore().report(dir,{...actor,id:'teammate'},'2026-10-05');assert.equal(report.record.revision,2);assert.equal(report.summary.days[0],189954);assert.equal(report.summary.variances[0],1);assert.equal(report.record.labourCents,668467);
  const other=await store.report(dir,{...actor,locationId:'other'},'2026-10-05');assert.equal(other.record.revision,0);assert.equal(other.summary.totals.sales,null);
  assert.deepEqual((await sales.createStore().report(dir,actor,'2026-10-05')).record.days,Array(7).fill(null));assert.equal((await sales.createStore().history(dir,actor)).length,0);
  await assert.rejects(store.report(dir,{...actor,locationId:'../../outside'},'2026-10-05'),error=>error.status===403);
  for(const change of [{weekStart:'2026-10-11'},{weekStart:'2026-02-30'},{weekStart:'../../outside'},{revision:-1},{breakdown:[]},{breakdown:{...input().breakdown,other:[]}},{breakdown:{...input().breakdown,cash:[1]}},{breakdown:{...input().breakdown,cash:Array(7).fill(-1)}},{breakdown:{...input().breakdown,cash:Array(7).fill(1.1)}},{breakdown:{...input().breakdown,cash:Array(7).fill('1')}},{labourCents:-1},{operatingExpensesCents:Infinity}])assert.throws(()=>validate({...input(),...change}),error=>error.status===400);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('weekly overview costs use only placed orders at the selected location and Monday–Sunday Melbourne boundaries',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'weekly-report-costs-'));try{
  const order=(id,createdAt,extra={})=>({id,createdAt,locationId:'shop',status:'requested',total:100,items:[{price:100}],...extra});
  const orders=[order('before','2026-10-04T12:59:59Z',{pricePending:true}),order('opening','2026-10-04T13:00:00Z'),order('opening','2026-10-04T13:00:00Z'),order('closing','2026-10-11T12:59:59Z'),order('next','2026-10-11T13:00:00Z'),order('draft','2026-10-06T00:00:00Z',{status:'draft'}),order('other','2026-10-06T00:00:00Z',{locationId:'other'})];
  const store=createStore();assert.deepEqual((await store.report(dir,actor,'2026-10-05',{orders})).weeklyOrders,{totalCents:200,pricePending:false,orderCount:2});
  orders.push(order('pending','2026-10-06T00:00:00Z',{items:[{price:null}]}));assert.equal((await store.report(dir,actor,'2026-10-05',{orders})).weeklyOrders.pricePending,true);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('all signed-in roles can share reports within assigned locations; report saves never alter daily sales, projections, budget or home totals',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'weekly-reports-api-'));await saveAdmin(dir,'Office','test-office-password');let server,url;
 const start=async()=>{server=createServer(dir,{fetchImpl:()=>{throw Error('Unexpected supplier sending');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;};await start();
 const login=async username=>{const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-office-password'})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],session=await(await fetch(url+'/api/session',{headers:{Cookie:cookie}})).json();return {session,headers:{Cookie:cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'}};};
 const request=async(user,route,method='GET',body,extra={})=>{const response=await fetch(url+route,{method,headers:{...user?.headers,...extra},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 try{
  const office=await login('Office'),locationId=office.session.locationId;
  for(const [username,role] of [['Member','user'],['Owner','franchisee']])assert.equal((await request(office,'/api/accounts','POST',{username,role,password:'test-office-password',locationIds:[locationId]})).status,201);
  const member=await login('Member'),owner=await login('Owner'),week=sales.currentWeek();
  assert.equal((await request(null,'/api/weekly-sales-reports')).status,401);assert.equal((await request(member,'/api/weekly-sales-reports','PUT',input(week),{'X-CSRF-Token':''})).status,403);
  for(let index=1;index<=4;index++)assert.equal((await request(member,'/api/sales','PUT',{weekStart:shift(week,-7*index),revision:0,days:Array(7).fill(100000)})).status,200);
  const before=(await request(member,'/api/sales')).data,homeBefore=(await request(member,'/api/home-totals')).data;
  for(let index=0;index<=4;index++){const record=await request(index%2?owner:member,'/api/weekly-sales-reports','PUT',input(shift(week,-7*index)));assert.equal(record.status,200);assert.equal(record.data.locationId,locationId);}
  assert.deepEqual((await request(member,'/api/sales')).data,before);assert.deepEqual((await request(member,'/api/home-totals')).data,homeBefore);assert.equal(before.projection.budgetCents,196000);
  assert.equal((await request(office,'/api/weekly-sales-reports')).data.summary.days[0],189954);assert.equal((await request(owner,'/api/weekly-sales-reports')).data.record.labourCents,668467);
  const other=(await request(office,'/api/locations','POST',{name:'Other store'})).data;assert.equal((await request(member,'/api/weekly-sales-reports','GET',undefined,{'X-Location-Id':other.id})).status,403);assert.equal((await request(member,'/api/weekly-sales-reports','PUT',{...input(week),locationId:other.id})).data.locationId,locationId);assert.equal((await request(office,'/api/weekly-sales-reports','GET',undefined,{'X-Location-Id':other.id})).data.record.revision,0);
  await new Promise(resolve=>server.close(resolve));await start();const after=await login('Member');assert.equal((await request(after,'/api/weekly-sales-reports')).data.record.revision,1);assert.equal((await request(after,'/api/sales')).data.projection.budgetCents,196000);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
