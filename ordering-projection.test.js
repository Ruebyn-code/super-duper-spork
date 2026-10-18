const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const sales=require('./sales'),{shift}=require('./stock-usage'),{createServer}=require('./server'),{saveAdmin}=require('./auth');
const actor={id:'one',locationId:'shop'},sunday=new Date('2026-10-17T13:00:00Z');
const history=()=>[1,2,3,4].map(index=>({locationId:'shop',weekStart:shift('2026-10-12',-7*index),days:Array(7).fill(index*1000)}));
const order=(id,createdAt,total,extra={})=>({id,createdAt,total,locationId:'shop',status:'requested',items:[{id:'stock',quantity:1,price:total}],...extra});
function forecast(records,orders=[],now=sunday,transfers=[]){const projection=sales.calculate(records,orders,actor,{now,transfers});return {projection,ordering:sales.orderingProjection(projection,orders,actor,{transfers})};}

test('ordering changes at Melbourne Sunday midnight, with the upcoming Monday–Sunday dates across DST, quarters and years',()=>{
 for(const [before,after,oldWeek,newWeek] of [
  ['2026-10-17T12:59:59Z','2026-10-17T13:00:00Z','2026-10-12','2026-10-19'],
  ['2026-10-03T13:59:59Z','2026-10-03T14:00:00Z','2026-09-28','2026-10-05'],
  ['2026-04-04T12:59:59Z','2026-04-04T13:00:00Z','2026-03-30','2026-04-06'],
  ['2023-12-30T12:59:59Z','2023-12-30T13:00:00Z','2023-12-25','2024-01-01']
 ]){
  const first=forecast([],[],new Date(before)),next=forecast([],[],new Date(after));assert.equal(first.ordering.weekStart,oldWeek);assert.equal(first.ordering.isUpcoming,false);assert.equal(next.ordering.weekStart,newWeek);assert.equal(next.ordering.weekEnd,shift(newWeek,6));assert.equal(next.ordering.isUpcoming,true);assert.equal(next.projection.weekStart,oldWeek);assert.deepEqual(next.ordering.dailyProjections.map(day=>day.date),Array.from({length:7},(_,index)=>shift(newWeek,index)));
 }
 const monday=forecast([],[],new Date('2026-10-18T13:00:00Z'));assert.equal(monday.ordering.weekStart,'2026-10-19');assert.equal(monday.ordering.isUpcoming,false);
});

test('Sunday upcoming forecast uses completed history and matching cost commitments without altering current-week progress',()=>{
 const records=history(),current={locationId:'shop',weekStart:'2026-10-12',days:Array(7).fill(9000)};records.push(current,{...current,locationId:'other'});
 const orders=[order('saturday','2026-10-17T12:59:59Z',10000,{pricePending:true}),order('sunday','2026-10-17T13:00:00Z',2500),order('sunday','2026-10-17T13:00:00Z',2500),order('other','2026-10-17T13:00:00Z',99999,{locationId:'other'})],original=JSON.stringify({records,orders}),result=forecast(records,orders);
 assert.equal(result.ordering.projectedSalesCents,17500);assert.equal(result.ordering.budgetCents,4900);assert.equal(result.ordering.spentCents,2500);assert.equal(result.ordering.orderCount,1);assert.equal(result.ordering.remainingCents,2400);assert.equal(result.ordering.pricePending,false);assert.deepEqual(result.ordering.history.map(week=>week.weekStart),['2026-10-05','2026-09-28','2026-09-21','2026-09-14']);
 assert.equal(result.projection.spentCents,10000);assert.equal(result.projection.pricePending,true);assert.equal(result.projection.performance.recordedDays,7);assert.equal(result.projection.performance.actualCents,63000);assert.equal(result.ordering.performance,undefined);assert.equal(JSON.stringify({records,orders}),original);
 const monday=forecast(records,orders,new Date('2026-10-18T13:00:00Z'));assert.equal(monday.ordering.weekStart,'2026-10-19');assert.equal(monday.ordering.projectedSalesCents,26250);assert.equal(monday.ordering.history[0].weekStart,'2026-10-12');assert.equal(monday.ordering.spentCents,2500);
 const corrected=history();corrected[0].days[0]=null;assert.equal(forecast(corrected).ordering.budgetCents,null);assert.equal(forecast(corrected).ordering.weeksRecorded,3);for(const record of corrected)record.days=Array(7).fill(0);assert.equal(forecast(corrected).ordering.budgetCents,0);
});

test('Sunday cost transfers and pending orders follow the upcoming budget while current-week costs stay separate',()=>{
 const transfers=[{id:'transfer',status:'received',from:{id:'shop'},to:{id:'other'},createdAt:'2026-10-17T12:59:59Z',receivedAt:'2026-10-17T13:00:00Z',moveCosts:true,items:[{source:{id:'stock'},target:{id:'other-stock'},quantity:1,targetQuantity:1,totalCents:500}]}];
 let result=forecast(history(),[],sunday,transfers);assert.equal(result.ordering.transferCostCents,-500);assert.equal(result.ordering.spentCents,-500);assert.equal(result.ordering.remainingCents,5400);assert.equal(result.projection.transferCostCents,0);
 result=forecast(history(),[order('pending','2026-10-17T13:00:00Z',0,{pricePending:true})],sunday,transfers);assert.equal(result.ordering.pricePending,true);assert.equal(result.ordering.remainingCents,null);assert.equal(result.projection.pricePending,false);
});

test('Sunday rollover appears through the sales API, survives restart and does not move daily-sales entry to next week',async()=>{
 const dir=await fs.mkdtemp('/tmp/ordering-sunday-api-');await saveAdmin(dir,'Office','test-office-password');let server,url,time=Date.parse('2026-10-17T12:59:59Z');
 async function start(){server=createServer(dir,{salesNow:()=>time,fetchImpl:()=>{throw Error('Unexpected supplier sending');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;}
 async function login(){const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Office',password:'test-office-password'})});assert.equal(response.status,200);const headers={Cookie:response.headers.get('set-cookie').split(';')[0]};return {headers,session:await(await fetch(url+'/api/session',{headers})).json()};}
 try{await start();let account=await login();const store=sales.createStore();for(const record of history())await store.save(dir,account.session,{weekStart:record.weekStart,days:record.days,revision:0});await store.save(dir,account.session,{weekStart:'2026-10-12',days:[1000,2000,null,null,null,null,null],revision:0});
  const id=crypto.randomUUID(),placed={...order(id,'2026-10-17T13:00:00Z',2500),locationId:account.session.locationId},file=path.join(dir,id+'.json'),original=JSON.stringify(placed);await fs.writeFile(file,original);
  const get=async query=>{const response=await fetch(url+'/api/sales'+(query||''),{headers:account.headers});assert.equal(response.status,200);return response.json();};
  let result=await get();assert.equal(result.orderingProjection.weekStart,'2026-10-12');time+=1000;result=await get();assert.equal(result.orderingProjection.weekStart,'2026-10-19');assert.equal(result.orderingProjection.spentCents,2500);assert.equal(result.orderingProjection.budgetCents,4900);assert.equal(result.record.weekStart,'2026-10-12');assert.equal(result.projection.performance.actualCents,3000);
  const selected=await get('?week=2026-09-28');assert.equal(selected.record.weekStart,'2026-09-28');assert.deepEqual(selected.orderingProjection,result.orderingProjection);await new Promise(resolve=>server.close(resolve));await start();account=await login();assert.deepEqual((await get()).orderingProjection,result.orderingProjection);assert.equal(await fs.readFile(file,'utf8'),original);
  time=Date.parse('2026-10-18T13:00:00Z');result=await get();assert.equal(result.record.weekStart,'2026-10-19');assert.equal(result.orderingProjection.weekStart,'2026-10-19');assert.equal(result.orderingProjection.isUpcoming,false);assert.equal(result.orderingProjection.budgetCents,null,'Missing current-week days remain unrecorded after Monday');
 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
