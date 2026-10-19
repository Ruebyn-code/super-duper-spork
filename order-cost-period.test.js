const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const costs=require('./order-cost-period'),sales=require('./sales'),weekly=require('./weekly-sales-reports'),overview=require('./weekly-sales-overview'),reporting=require('./reporting'),details=require('./reporting-details'),usage=require('./stock-usage');
const model=require('./public/weekly-sales-report'),reportModel=require('./public/reporting-model'),{createServer}=require('./server'),{saveAdmin}=require('./auth');
const actor={id:'office',username:'Office',locationId:'shop',companyId:'default',locationName:'Shop',companyName:'Company'},now=new Date('2026-10-20T01:00:00Z');
const catalogue={suppliers:[{id:'supplier',name:'Supplier'}],products:[{id:'stock',name:'Stock',supplierId:'supplier',stockCountGroup:'dry'}]};
const order=(id,createdAt,total=100,extra={})=>({id,createdAt,total,status:'requested',locationId:'shop',items:[{id:'stock',name:'Stock',supplierId:'supplier',supplier:'Supplier',quantity:1,price:total}],...extra});
const saved=weekStart=>({weekStart,revision:0,breakdown:{...model.blank(),tillSales:Array(7).fill(1000),uberEats:Array(7).fill(0),doorDash:Array(7).fill(0)},labourCents:0,operatingExpensesCents:0,roCents:0});
function fixtures(){return [order('previous-sunday','2026-10-04T12:59:59Z',200),order('saturday','2026-10-10T12:59:59Z',100),order('sunday-start','2026-10-10T13:00:00Z',300),order('sunday-end','2026-10-11T12:59:59Z',400),order('monday','2026-10-11T13:00:00Z',500)];}

test('Sunday cost dates use Melbourne calendar boundaries, including both DST changes, quarter and year rollover',()=>{
 const cases=[
  ['2026-10-10T12:59:59Z','2026-10-10','2026-10-10','2026-10-05'],
  ['2026-10-10T13:00:00Z','2026-10-11','2026-10-12','2026-10-12'],
  ['2026-10-11T12:59:59Z','2026-10-11','2026-10-12','2026-10-12'],
  ['2026-10-11T13:00:00Z','2026-10-12','2026-10-12','2026-10-12'],
  ['2026-10-03T13:59:59Z','2026-10-03','2026-10-03','2026-09-28'],
  ['2026-10-03T14:00:00Z','2026-10-04','2026-10-05','2026-10-05'],
  ['2026-10-04T12:59:59Z','2026-10-04','2026-10-05','2026-10-05'],
  ['2026-04-04T13:00:00Z','2026-04-05','2026-04-06','2026-04-06'],
  ['2026-04-05T13:59:59Z','2026-04-05','2026-04-06','2026-04-06'],
  ['2026-04-05T14:00:00Z','2026-04-06','2026-04-06','2026-04-06'],
  ['2018-09-30T13:59:59Z','2018-09-30','2018-10-01','2018-10-01'],
  ['2023-12-31T12:59:59Z','2023-12-31','2024-01-01','2024-01-01']
 ];
 for(const [createdAt,placedDate,costDate,costWeekStart] of cases){const original=Object.freeze({createdAt});assert.deepEqual(costs.dates(original),{placedDate,costDate,costWeekStart},createdAt);assert.equal(original.createdAt,createdAt);}
 assert.equal(costs.dates({createdAt:'invalid'}),null);assert.equal(costs.dates({}),null);
});

test('weekly costs, supplier cards, profit, budget, quarter averages and overview allocate each placed order exactly once',async()=>{
 const dir=await fs.mkdtemp('/tmp/order-cost-weeks-');try{
  const store=weekly.createStore();for(const start of ['2026-10-05','2026-10-12'])await store.save(dir,actor,saved(start));
  const source=fixtures(),orders=[...source,source[2],order('draft',source[2].createdAt,9999,{status:'draft'}),order('hidden',source[2].createdAt,9999,{locationId:'other'})],before=JSON.stringify(orders);
  const first=await store.report(dir,actor,'2026-10-05',{orders,now}),second=await store.report(dir,actor,'2026-10-12',{orders,now});
  assert.deepEqual(first.stockOrders.map(row=>row.id),['previous-sunday','saturday']);assert.deepEqual(second.stockOrders.map(row=>row.id),['sunday-start','sunday-end','monday']);
  assert.equal(first.weeklyOrders.totalCents,300);assert.equal(second.weeklyOrders.totalCents,1200);assert.equal(first.profit.amountCents,6700);assert.equal(second.profit.amountCents,5800);
  assert.equal(model.stockSupplierCosts(first.stockOrders)[0].totalCents,300);assert.equal(model.stockSupplierCosts(second.stockOrders)[0].totalCents,1200);
  assert.equal(second.stockOrders[0].createdAt,source[2].createdAt);assert.equal(second.stockOrders[0].placedDate,'2026-10-11');assert.equal(second.stockOrders[0].costDate,'2026-10-12');
  const records=['2026-10-05','2026-10-12'].map(weekStart=>({locationId:'shop',weekStart,days:Array(7).fill(1000)}));
  // Budget history and current-week performance keep their existing sales periods.
  const projection=sales.calculate(records,source,actor,{now:new Date('2026-10-17T23:00:00Z')});assert.equal(projection.weekStart,'2026-10-12');assert.equal(projection.orderCostWeekStart,'2026-10-19');assert.equal(projection.spentCents,1200);
  const home=sales.homeTotals(records,orders,actor,{now});assert.equal(home.placedOrdersCents,1500);assert.equal(home.quarterPlacedOrdersCents,1500);assert.equal(home.averages.weeklyCostCents,750);
  const result=await overview.build(dir,actor,{quarter:'2026-Q4'},{orders,store,now});assert.equal(result.rows.find(row=>row.weekStart==='2026-10-05').costOfGoodsPercent,300/7000*100);assert.equal(result.rows.find(row=>row.weekStart==='2026-10-12').profitCents,5800);
  const pending=order('pending','2026-10-18T01:00:00Z',0,{pricePending:true,items:[{id:'stock',quantity:1,price:null}]});
  assert.equal((await store.report(dir,actor,'2026-10-12',{orders:[...orders,pending]})).weeklyOrders.pricePending,false);
  await store.save(dir,actor,saved('2026-10-19'));
  assert.equal((await store.report(dir,actor,'2026-10-19',{orders:[...orders,pending]})).profit.reason,'prices');assert.equal(JSON.stringify(orders),before);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('Reporting date filters and financial detail reconcile by cost date while exports retain original order dates',async()=>{
 const dir=await fs.mkdtemp('/tmp/order-cost-reports-');try{
  const store=weekly.createStore();for(const start of ['2026-10-05','2026-10-12'])await store.save(dir,actor,saved(start));const orders=fixtures();
  for(const [start,end,expected,ids] of [['2026-10-05','2026-10-11',300,['previous-sunday','saturday']],['2026-10-12','2026-10-18',1200,['sunday-start','sunday-end','monday']]]){
   const report=reporting.calculate([],orders,[],catalogue,actor,{start,end},{now});report.details=await details.build(dir,actor,report.period,{orders,store,now,catalogue});
   assert.equal(report.summary.orderCostCents,expected);assert.equal(report.suppliers[0].orderCostCents,expected);assert.equal(report.details.finance[0].costOfGoodsCents,expected);assert.deepEqual(report.details.orderLines.map(row=>row.orderId),ids);
   assert.deepEqual(report.details.financialOrderLines.map(row=>row.orderId),ids);assert.equal(report.details.orderLines.reduce((sum,row)=>sum+row.totalCents,0),expected);
   const columns=reportModel.views['order-lines'].columns,rows=reportModel.rows([report],'order-lines'),exportRows=[columns.map(col=>col.label),...rows.map(row=>columns.map(col=>row[col.key]))],csv=require('./public/reporting-export').csv(exportRows);
   assert.ok(csv.includes('"Cost date"'));assert.ok(csv.includes('"Order date"'));
   if(start==='2026-10-12'){const line=report.details.orderLines[0];assert.equal(line.date,'2026-10-11');assert.equal(line.costDate,'2026-10-12');assert.equal(line.weekStart,'2026-10-12');assert.equal(report.daily.find(day=>day.date==='2026-10-12').orderCostCents,1200);}
  }
  const sunday=reporting.calculate([],orders,[],catalogue,actor,{start:'2026-10-11',end:'2026-10-11'},{now});assert.equal(sunday.summary.orderCostCents,0);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('Sunday costs move across quarter and year boundaries without changing cumulative totals',async()=>{
 const dir=await fs.mkdtemp('/tmp/order-cost-boundary-');try{
  for(const [createdAt,oldNow,newNow,weekStart] of [['2018-09-30T01:00:00Z','2018-09-30T02:00:00Z','2018-10-02T01:00:00Z','2018-10-01'],['2023-12-31T01:00:00Z','2023-12-31T02:00:00Z','2024-01-02T01:00:00Z','2024-01-01']]){
   const orders=[order('boundary',createdAt,600)],old=sales.homeTotals([],orders,actor,{now:new Date(oldNow)}),next=sales.homeTotals([],orders,actor,{now:new Date(newNow)});assert.equal(old.quarterPlacedOrdersCents,0);assert.equal(next.quarterPlacedOrdersCents,600);assert.equal(old.placedOrdersCents,next.placedOrdersCents);
   const store=weekly.createStore();await store.save(dir,actor,saved(weekStart));
   const selected=await overview.build(dir,actor,{mode:'ytd'},{orders,store,now:new Date(newNow)}),selectedWeek=selected.rows.find(row=>row.weekStart===weekStart);assert.equal(selectedWeek.costOfGoodsPercent,600/2000*100);
   const report=await weekly.createStore().report(dir,actor,weekStart,{orders});assert.equal(report.weeklyOrders.totalCents,600);
   assert.equal(reporting.calculate([],orders,[],catalogue,actor,{preset:'quarter'},{now:new Date(oldNow)}).summary.orderCostCents,0);assert.equal(reporting.calculate([],orders,[],catalogue,actor,{preset:'quarter'},{now:new Date(newNow)}).summary.orderCostCents,600);
  }
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('stock usage still counts Sunday orders on their actual Sunday, once, independently of financial allocation',()=>{
 const counts=['2026-10-04','2026-10-11','2026-10-18'].map((countDate,index)=>({id:'count-'+index,countDate,createdAt:countDate+'T01:00:00Z',locationId:'shop',items:[{id:'stock',quantity:10}]})),orders=fixtures(),before=JSON.stringify(orders);
 const cycles=usage.derive(counts,[...orders,orders[2]],catalogue.products,actor,['2026-10-04','2026-10-11']);
 assert.deepEqual(cycles.map(cycle=>cycle.items[0].ordered),[2,3]);assert.deepEqual(cycles.map(cycle=>cycle.items[0].quantity),[2,3]);assert.equal(JSON.stringify(orders),before);
});

test('Sunday cart preview uses the upcoming ordering budget and preserves the current-week sales comparison',async()=>{
 const script=await fs.readFile(path.join(__dirname,'public/sales-budget.js'),'utf8');
 async function render(upcoming,cart){
  const nodes=new Map(),listeners={},comparisons=[];function node(id){if(!nodes.has(id))nodes.set(id,{dataset:{},textContent:'',classList:{add(){},toggle(){}},previousElementSibling:{dataset:{},textContent:''}});return nodes.get(id);}
  const projection={weekStart:'2026-10-12',weekEnd:'2026-10-18',orderCostWeekStart:upcoming?'2026-10-19':'2026-10-12',weeksRecorded:4,projectedSalesCents:100000,budgetCents:28000,spentCents:10000,remainingCents:18000,pricePending:false},orderingProjection={...projection,weekStart:upcoming?'2026-10-19':'2026-10-12',weekEnd:upcoming?'2026-10-25':'2026-10-18',isUpcoming:upcoming,spentCents:upcoming?2000:10000,remainingCents:upcoming?26000:18000};
  const context={appAccess:{can:()=>true,initialSession:async()=>({id:'office'})},document:{hidden:false,getElementById:node,addEventListener(){}},window:{salesPerformanceView:{render:value=>comparisons.push(value)},addEventListener:(key,handler)=>listeners[key]=handler},Intl,Date,setInterval(){},fetch:async url=>({ok:true,json:async()=>url==='/api/session'?{id:'office'}:{projection,orderingProjection}})};
  vm.runInNewContext(script,context);await new Promise(resolve=>setImmediate(resolve));listeners['ordering-cart-updated']({detail:cart});assert.equal(comparisons.at(-1).weekStart,'2026-10-12');return nodes;
 }
 const sunday=await render(true,{total:20000,pricePending:false});assert.equal(sunday.get('ordering-budget-remaining').textContent,'$60.00');assert.equal(sunday.get('ordering-budget-remaining').previousElementSibling.textContent,'Budget after this cart');assert.equal(sunday.get('ordering-budget-spent').textContent,'$20.00');assert.equal(sunday.get('ordering-budget-spent').previousElementSibling.textContent,'Order costs next week');assert.match(sunday.get('ordering-budget-period').textContent,/Upcoming week · 19 Oct 2026 – 25 Oct 2026/);
 assert.equal(sunday.get('ordering-budget-status').dataset.homeError,undefined);
 const pending=await render(true,{total:20000,pricePending:true});assert.equal(pending.get('ordering-budget-status').dataset.homeError,'');assert.equal(pending.get('ordering-budget-remaining').textContent,'—');assert.match(pending.get('ordering-budget-status').textContent,/prices pending/);
 const saturday=await render(false,{total:20000,pricePending:false});assert.equal(saturday.get('ordering-budget-status').dataset.homeError,'');assert.equal(saturday.get('ordering-budget-remaining').textContent,'-$20.00');assert.match(saturday.get('ordering-budget-status').textContent,/over this week/);
});

test('existing order files recalculate through APIs and restarts without rewriting timestamps or sending to suppliers',async()=>{
 const dir=await fs.mkdtemp('/tmp/order-cost-api-');await saveAdmin(dir,'Office','test-office-password');let server,url,sending=0;
 async function start(){server=createServer(dir,{fetchImpl:()=>{sending++;throw Error('Unexpected supplier sending');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;}
 async function login(){const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Office',password:'test-office-password'})});assert.equal(response.status,200);const headers={Cookie:response.headers.get('set-cookie').split(';')[0]};return {headers,session:await(await fetch(url+'/api/session',{headers})).json()};}
 try{await start();let account=await login();const id=crypto.randomUUID(),placed=order(id,'2026-10-11T12:59:59Z',1234,{locationId:account.session.locationId,companyId:account.session.companyId,requestOwnerId:account.session.id}),filename=path.join(dir,id+'.json'),original=JSON.stringify(placed,null,2);await fs.writeFile(filename,original);
  for(let attempt=0;attempt<2;attempt++){
   if(attempt){await new Promise(resolve=>server.close(resolve));await start();account=await login();}
   const get=async route=>{const response=await fetch(url+route,{headers:account.headers});assert.equal(response.status,200);return response.json();};
   assert.equal((await get('/api/weekly-sales-reports?week=2026-10-05')).weeklyOrders.totalCents,0);const next=await get('/api/weekly-sales-reports?week=2026-10-12');assert.equal(next.weeklyOrders.totalCents,1234);assert.equal(next.stockOrders[0].createdAt,placed.createdAt);assert.equal(next.stockOrders[0].costDate,'2026-10-12');
   const report=await get('/api/reporting?start=2026-10-12&end=2026-10-12&weekBasis=overlap');assert.equal(report.summary.orderCostCents,1234);assert.equal(report.details.orderLines[0].date,'2026-10-11');assert.equal(report.details.orderLines[0].costDate,'2026-10-12');assert.equal(await fs.readFile(filename,'utf8'),original);
  }assert.equal(sending,0);
 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
