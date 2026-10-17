const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const weekly=require('./public/weekly-sales-report'),{createStore,validate}=require('./weekly-sales-reports'),sales=require('./sales'),{shift}=require('./stock-usage'),{createServer}=require('./server'),{saveAdmin}=require('./auth');
const platformFees=()=>({uberEats:{feesCents:109496,marketingCents:32520,refundsCents:8945},doorDash:{feesCents:25041,marketingCents:15962,refundsCents:7508}});
const actor={id:'first',username:'First',companyId:'default',locationId:'shop'};
function input(weekStart='2026-10-05'){const breakdown=weekly.blank();for(const [field,value] of Object.entries({tillSales:170584,cash:33850,eftpos:136734,pettyCash:0,uberEats:38680,doorDash:14540}))breakdown[field][0]=value;return {weekStart,revision:0,breakdown,labourCents:668467,operatingExpensesCents:0};}
test('weekly report totals Till sales plus Uber Eats and DoorDash, keeping Eftpos for variance only',()=>{
 const {breakdown}=input();let result=weekly.calculate(breakdown);assert.equal(result.days[0],223804);assert.notEqual(result.days[0],189954);assert.equal(result.variances[0],0);assert.equal(result.totals.cash,33850);assert.equal(result.recordedDays,1);assert.equal(result.reconciledDays,1);
 breakdown.tillSales[0]++;assert.equal(weekly.calculate(breakdown).variances[0],-1);breakdown.pettyCash[0]=2;assert.equal(weekly.calculate(breakdown).variances[0],1);
 breakdown.doorDash[0]=null;result=weekly.calculate(breakdown);assert.equal(result.days[0],null);assert.equal(result.totals.sales,null);assert.equal(result.recordedDays,0);assert.equal(result.reconciledDays,1);
 for(const field of weekly.fields)breakdown[field][1]=0;result=weekly.calculate(breakdown);assert.equal(result.days[1],0);assert.equal(result.variances[1],0);assert.equal(result.recordedDays,1);assert.equal(result.totals.sales,0);
 for(const field of weekly.fields)breakdown[field][6]=breakdown[field][0]??0;breakdown.doorDash[0]=14540;breakdown.doorDash[6]=14540;result=weekly.calculate(breakdown);assert.equal(result.totals.sales,447610);assert.equal(result.totals.variance,2);
 assert.deepEqual(weekly.calculate(weekly.blank()).days,Array(7).fill(null));
 const separate=input().breakdown;separate.eftpos[0]=null;assert.equal(weekly.calculate(separate).days[0],223804);assert.equal(weekly.calculate(separate).variances[0],null);
 separate.eftpos[0]=200000;assert.equal(weekly.calculate(separate).days[0],223804);assert.equal(weekly.calculate(separate).variances[0],63266);
 separate.tillSales[0]=null;assert.equal(weekly.calculate(separate).days[0],null);
});
test('report profit subtracts stock orders, labour and operating expenses in cents, and waits for known inputs',()=>{
 const costs={stockOrdersCents:20000,labourCents:30000,operatingExpensesCents:10000};
 assert.deepEqual(weekly.profit(100000,costs),{amountCents:40000,state:'profit',reason:null});
 assert.deepEqual(weekly.profit(50000,costs),{amountCents:-10000,state:'loss',reason:null});
 assert.deepEqual(weekly.profit(60000,costs),{amountCents:0,state:'break-even',reason:null});
 assert.equal(weekly.profit(60001,costs).amountCents,1);assert.equal(weekly.profit(59999,costs).amountCents,-1);
 assert.equal(weekly.profit(0,{stockOrdersCents:0,labourCents:0,operatingExpensesCents:0}).state,'break-even');
 assert.deepEqual(weekly.profit(null,costs),{amountCents:null,state:'unavailable',reason:'sales'});
 for(const field of ['stockOrdersCents','labourCents','operatingExpensesCents'])for(const value of [null,undefined,NaN,-1,1.5])assert.deepEqual(weekly.profit(100000,{...costs,[field]:value}),{amountCents:null,state:'unavailable',reason:'costs'});
 assert.deepEqual(weekly.profit(100000,{...costs,pricePending:true}),{amountCents:null,state:'unavailable',reason:'prices'});
});
test('platform fee settlements match the sample, distinguish blanks from zero and allow fees above sales',()=>{
 const fees=platformFees();assert.deepEqual(weekly.settlement(342150,fees.uberEats),{salesCents:342150,totalFeesCents:150961,expectedPayCents:191189});assert.deepEqual(weekly.settlement(121260,fees.doorDash),{salesCents:121260,totalFeesCents:48511,expectedPayCents:72749});
 assert.deepEqual(weekly.settlement(null,fees.uberEats),{salesCents:null,totalFeesCents:150961,expectedPayCents:null});
 const blank=weekly.blankPlatformFees();assert.equal(weekly.settlement(100,blank.uberEats).totalFeesCents,null);blank.uberEats.feesCents=0;blank.uberEats.marketingCents=0;blank.uberEats.refundsCents=0;assert.deepEqual(weekly.settlement(0,blank.uberEats),{salesCents:0,totalFeesCents:0,expectedPayCents:0});assert.equal(blank.doorDash.feesCents,null);
 assert.equal(weekly.settlement(100,{feesCents:100,marketingCents:1,refundsCents:0}).expectedPayCents,-1);
 for(const field of weekly.feeFields)for(const value of [null,undefined,NaN,-1,1.1])assert.equal(weekly.settlement(100,{...fees.uberEats,[field]:value}).totalFeesCents,null);
 const costs={stockOrdersCents:20000,labourCents:30000,operatingExpensesCents:10000};assert.equal(weekly.profit(100000,{...costs,roCents:40000}).state,'break-even');assert.equal(weekly.profit(100000,{...costs,roCents:40001}).amountCents,-1);assert.equal(weekly.profit(100000,{...costs,roCents:39999}).amountCents,1);assert.equal(weekly.profit(100000,{...costs,roCents:null}).reason,'costs');assert.equal(weekly.profit(100000,{...costs,platformFees:fees}).amountCents,40000);
});
test('R&O and platform fees persist independently, retain legacy reports and old-client edits, and detect fee-only conflicts',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'weekly-fees-'));try{
  let store=createStore();const legacy={...input(),revision:1,locationId:actor.locationId};const target=path.join(dir,'weekly-sales-reports',actor.locationId,legacy.weekStart+'.json');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(legacy));
  let result=await store.report(dir,actor,legacy.weekStart);assert.equal(result.record.roCents,0);assert.deepEqual(result.record.platformFees,weekly.blankPlatformFees());assert.equal(result.profit.amountCents,-444663);
  const first=await store.save(dir,actor,{...input(),revision:1,roCents:12345,platformFees:platformFees()});assert.equal(first.revision,2);store=createStore();result=await store.report(dir,actor,legacy.weekStart);assert.equal(result.profit.amountCents,-457008);assert.equal(result.platformSettlements.uberEats.totalFeesCents,150961);assert.equal(result.platformSettlements.uberEats.expectedPayCents,38680-150961);
  const feesOnly={...first,platformFees:platformFees()};feesOnly.platformFees.uberEats.feesCents++;await store.save(dir,actor,feesOnly);result=await store.report(dir,actor,legacy.weekStart);assert.equal(result.profit.amountCents,-457008);assert.equal(result.platformSettlements.uberEats.totalFeesCents,150962);assert.equal(result.record.revision,3);
  await assert.rejects(store.save(dir,actor,{...first,roCents:1}),error=>error.status===409);await assert.rejects(store.save(dir,actor,{...first,platformFees:platformFees()}),error=>error.status===409);
  const olderClient={...input(),revision:3};olderClient.breakdown.cash[0]++;const changed=await store.save(dir,actor,olderClient);assert.equal(changed.roCents,12345);assert.equal(changed.platformFees.uberEats.feesCents,109497);assert.equal(changed.revision,4);assert.equal((await store.save(dir,actor,olderClient)).revision,4);
  const blank=await store.report(dir,{...actor,locationId:'other'},legacy.weekStart);assert.equal(blank.record.roCents,0);assert.equal(blank.platformSettlements.uberEats.totalFeesCents,null);
  const cleared=await store.save(dir,actor,{...changed,roCents:0,platformFees:weekly.blankPlatformFees()});assert.equal(cleared.roCents,0);assert.equal((await store.report(dir,actor,legacy.weekStart)).platformSettlements.uberEats.expectedPayCents,null);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('new weekly expenses reject malformed, negative, fractional and excessive amounts',()=>{
 const valid={...input(),roCents:0,platformFees:platformFees()};assert.equal(validate(valid).roCents,0);
 for(const value of [-1,1.1,Infinity,NaN,'1',undefined,7000000001])assert.throws(()=>validate({...valid,roCents:value}),error=>error.status===400);
 for(const value of [null,[],{},'fees',{...platformFees(),other:{}},{uberEats:platformFees().uberEats}])assert.throws(()=>validate({...valid,platformFees:value}),error=>error.status===400);
 for(const platform of weekly.platforms)for(const field of weekly.feeFields)for(const value of [-1,1.1,Infinity,'1',undefined,7000000001]){const fees=platformFees();fees[platform][field]=value;assert.throws(()=>validate({...valid,platformFees:fees}),error=>error.status===400);}
 for(const value of [[],{...platformFees().uberEats,unexpected:0}])assert.throws(()=>validate({...valid,platformFees:{...platformFees(),uberEats:value}}),error=>error.status===400);
 assert.equal(validate({...valid,roCents:null,platformFees:weekly.blankPlatformFees()}).roCents,null);assert.equal(validate({...valid,roCents:7000000000}).roCents,7000000000);
});
test('weekly reports persist separately by location and protect concurrent detail and weekly cost edits even when sales totals match',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'weekly-sales-'));try{
  const store=createStore(),first=await store.save(dir,actor,input());assert.equal(first.revision,1);assert.equal((await store.save(dir,actor,input())).revision,1);
  const corrected={...input(),revision:1};corrected.breakdown.cash[0]++;
  const results=await Promise.allSettled([store.save(dir,actor,corrected),store.save(dir,actor,{...corrected,labourCents:1})]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'rejected');assert.equal(results[1].reason.status,409);
  const report=await createStore().report(dir,{...actor,id:'teammate'},'2026-10-05');assert.equal(report.record.revision,2);assert.equal(report.summary.days[0],223804);assert.equal(report.summary.variances[0],1);assert.equal(report.record.labourCents,668467);
  assert.deepEqual(report.profit,{amountCents:-444663,state:'loss',reason:null});
  const other=await store.report(dir,{...actor,locationId:'other'},'2026-10-05');assert.equal(other.record.revision,0);assert.equal(other.summary.totals.sales,null);
  assert.deepEqual((await sales.createStore().report(dir,actor,'2026-10-05')).record.days,Array(7).fill(null));assert.equal((await sales.createStore().history(dir,actor)).length,0);
  await assert.rejects(store.report(dir,{...actor,locationId:'../../outside'},'2026-10-05'),error=>error.status===403);
  for(const change of [{weekStart:'2026-10-11'},{weekStart:'2026-02-30'},{weekStart:'../../outside'},{revision:-1},{breakdown:[]},{breakdown:{...input().breakdown,other:[]}},{breakdown:{...input().breakdown,cash:[1]}},{breakdown:{...input().breakdown,cash:Array(7).fill(-1)}},{breakdown:{...input().breakdown,cash:Array(7).fill(1.1)}},{breakdown:{...input().breakdown,cash:Array(7).fill('1')}},{labourCents:-1},{operatingExpensesCents:Infinity}])assert.throws(()=>validate({...input(),...change}),error=>error.status===400);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('weekly overview costs use only placed orders at the selected location and Melbourne weeks with Sunday costs allocated forward',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'weekly-report-costs-'));try{
  const order=(id,createdAt,extra={})=>({id,createdAt,locationId:'shop',status:'requested',total:100,items:[{price:100}],...extra});
  const orders=[order('before','2026-10-03T13:59:59Z',{pricePending:true}),order('sunday','2026-10-04T12:59:59Z'),order('opening','2026-10-04T13:00:00Z'),order('opening','2026-10-04T13:00:00Z'),order('closing','2026-10-11T12:59:59Z'),order('next','2026-10-11T13:00:00Z'),order('draft','2026-10-06T00:00:00Z',{status:'draft'}),order('other','2026-10-06T00:00:00Z',{locationId:'other'})];
  const store=createStore();assert.deepEqual((await store.report(dir,actor,'2026-10-05',{orders})).weeklyOrders,{totalCents:200,pricePending:false,orderCount:2});
  await store.save(dir,actor,input());assert.deepEqual((await store.report(dir,actor,'2026-10-05',{orders})).profit,{amountCents:-444863,state:'loss',reason:null});
  orders.push(order('pending','2026-10-06T00:00:00Z',{items:[{price:null}]}));assert.equal((await store.report(dir,actor,'2026-10-05',{orders})).weeklyOrders.pricePending,true);
  assert.deepEqual((await store.report(dir,actor,'2026-10-05',{orders})).profit,{amountCents:null,state:'unavailable',reason:'prices'});
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
  assert.equal((await request(null,'/api/weekly-sales-overview')).status,401);assert.equal((await request(member,'/api/weekly-sales-overview?mode=invalid')).status,400);assert.equal((await request(member,'/api/weekly-sales-overview?quarter=2026-Q9')).status,400);
  assert.equal((await request(null,'/api/weekly-sales-reports')).status,401);assert.equal((await request(member,'/api/weekly-sales-reports','PUT',input(week),{'X-CSRF-Token':''})).status,403);
  for(let index=1;index<=4;index++)assert.equal((await request(member,'/api/sales','PUT',{weekStart:shift(week,-7*index),revision:0,days:Array(7).fill(100000)})).status,200);
  const before=(await request(member,'/api/sales')).data,homeBefore=(await request(member,'/api/home-totals')).data;
  for(let index=0;index<=4;index++){const record=await request(index%2?owner:member,'/api/weekly-sales-reports','PUT',{...input(shift(week,-7*index)),roCents:12345,platformFees:platformFees(),profit:123,platformSettlements:{uberEats:{totalFeesCents:0}}});assert.equal(record.status,200);assert.equal(record.data.locationId,locationId);}
  assert.deepEqual((await request(member,'/api/sales')).data,before);assert.deepEqual((await request(member,'/api/home-totals')).data,homeBefore);assert.equal(before.projection.budgetCents,196000);
  assert.equal((await request(office,'/api/weekly-sales-reports')).data.summary.days[0],223804);assert.equal((await request(owner,'/api/weekly-sales-reports')).data.record.labourCents,668467);
  const overview=(await request(member,'/api/weekly-sales-reports')).data;assert.equal(overview.record.roCents,12345);assert.equal(overview.profit.amountCents,-457008);assert.equal(overview.platformSettlements.uberEats.totalFeesCents,150961);assert.equal(overview.platformSettlements.doorDash.expectedPayCents,14540-48511);assert.equal(overview.record.profit,undefined);
  for(const user of [office,owner,member]){const result=await request(user,'/api/weekly-sales-overview?mode=ytd');assert.equal(result.status,200);assert.equal(result.data.period.mode,'ytd');assert.equal(result.data.rows.find(row=>row.weekStart===week).salesCents,week>=result.data.period.startDate?223804:null);}
  const other=(await request(office,'/api/locations','POST',{name:'Other store'})).data;assert.equal((await request(member,'/api/weekly-sales-reports','GET',undefined,{'X-Location-Id':other.id})).status,403);assert.equal((await request(member,'/api/weekly-sales-reports','PUT',{...input(week),locationId:other.id})).data.locationId,locationId);assert.equal((await request(office,'/api/weekly-sales-reports','GET',undefined,{'X-Location-Id':other.id})).data.record.revision,0);
  assert.equal((await request(member,'/api/weekly-sales-overview','GET',undefined,{'X-Location-Id':other.id})).status,403);const emptyOverview=await request(office,'/api/weekly-sales-overview','GET',undefined,{'X-Location-Id':other.id});assert.equal(emptyOverview.status,200);assert.equal(emptyOverview.data.average.salesCents,null);assert.ok(emptyOverview.data.rows.every(row=>row.salesCents===null));assert.deepEqual((await request(member,'/api/sales')).data,before);assert.deepEqual((await request(member,'/api/home-totals')).data,homeBefore);
  await new Promise(resolve=>server.close(resolve));await start();const after=await login('Member');assert.equal((await request(after,'/api/weekly-sales-reports')).data.record.revision,1);assert.equal((await request(after,'/api/sales')).data.projection.budgetCents,196000);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
