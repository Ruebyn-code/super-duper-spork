const {test}=require('node:test'),assert=require('node:assert/strict');
const {projectedCogsPercent,projectedCogsState,budgetPosition}=require('./public/sales-budget'),sales=require('./sales'),{shift}=require('./stock-usage');

test('projected ordering COGS follows the Sunday cost week, scoped commitments, transfers and cart without changing records',()=>{
 const actor={id:'manager',locationId:'shop'},now=new Date('2026-10-17T13:00:00Z'),records=[1,2,3,4].map(index=>({locationId:'shop',weekStart:shift('2026-10-12',-7*index),days:Array(7).fill(100000)}));
 const order={id:'order',status:'requested',locationId:'shop',createdAt:'2026-10-17T13:00:00Z',total:140000,items:[{id:'chips',price:14000,quantity:10}]},orders=[order,order,{...order,id:'saturday',createdAt:'2026-10-17T12:59:59Z',total:999999},{...order,id:'other',locationId:'other',total:999999},{...order,id:'deleted',status:'deleted',total:999999}];
 const transfers=[{id:'move',status:'received',from:{id:'shop'},to:{id:'other'},createdAt:'2026-10-17T12:59:59Z',receivedAt:'2026-10-17T13:00:00Z',moveCosts:true,items:[{source:{id:'chips'},target:{id:'other-chips'},quantity:1,targetQuantity:1,totalCents:35000}]}];
 const original=JSON.stringify({records,orders,transfers}),current=sales.calculate(records,orders,actor,{now,transfers}),ordering=sales.orderingProjection(current,orders,actor,{transfers});
 assert.equal(ordering.weekStart,'2026-10-19');assert.equal(ordering.projectedSalesCents,700000);assert.equal(projectedCogsPercent(ordering),15);assert.equal(projectedCogsPercent(ordering,{total:35000,pricePending:false}),20);assert.equal(projectedCogsPercent(ordering,{total:70000,pricePending:false}),25);
 assert.ok(Math.abs(projectedCogsPercent({...ordering,projectedSalesCents:1000000},{total:35000,pricePending:false})-14)<1e-10,'The final adjusted forecast is the denominator');
 assert.equal(JSON.stringify({records,orders,transfers}),original);
});

test('projected COGS distinguishes zero costs, missing sales and pending prices, retaining net credits and fractional cart cents',()=>{
 const p={projectedSalesCents:100000,spentCents:0,pricePending:false};
 assert.equal(projectedCogsPercent(p),0);assert.equal(projectedCogsPercent({...p,spentCents:-5000}),-5);assert.ok(Math.abs(projectedCogsPercent(p,{total:12.345,pricePending:false})-.012345)<1e-10);
 for(const projectedSalesCents of [null,undefined,0,-1,NaN,Infinity])assert.equal(projectedCogsPercent({...p,projectedSalesCents}),null);
 assert.equal(projectedCogsPercent({...p,pricePending:true}),null);assert.equal(projectedCogsPercent(p,{total:0,pricePending:true}),null);assert.equal(projectedCogsPercent({...p,spentCents:null}),null);
 for(const total of [null,NaN,Infinity,-1])assert.equal(projectedCogsPercent(p,{total}),null);
 assert.equal(projectedCogsPercent(null),null);assert.equal(projectedCogsPercent(p,null),null);
});

test('ordering budget position includes the cart, exact overspend, transfers and the near-budget boundary',()=>{
 const p={budgetCents:100000,remainingCents:20000,pricePending:false},original=JSON.stringify(p);
 assert.deepEqual(budgetPosition(p),{remainingCents:20000,usedPercent:80,state:'within'});
 assert.deepEqual(budgetPosition(p,{total:10000,pricePending:false}),{remainingCents:10000,usedPercent:90,state:'near'});
 assert.equal(budgetPosition(p,{total:9999,pricePending:false}).state,'within');
 assert.deepEqual(budgetPosition(p,{total:20000.25,pricePending:false}),{remainingCents:-.25,usedPercent:100.00025,state:'over'});
 assert.deepEqual(budgetPosition({...p,remainingCents:105000}),{remainingCents:105000,usedPercent:-5,state:'within'});
 assert.equal(JSON.stringify(p),original);
});

test('ordering budget availability keeps pending costs and missing sales distinct from a known zero budget',()=>{
 const p={budgetCents:100000,remainingCents:50000,pricePending:false};
 assert.deepEqual(budgetPosition({...p,pricePending:true}),{remainingCents:null,usedPercent:null,state:'pending'});
 assert.deepEqual(budgetPosition(p,{total:0,pricePending:true}),{remainingCents:null,usedPercent:null,state:'pending'});
 assert.deepEqual(budgetPosition({...p,budgetCents:null,remainingCents:null}),{remainingCents:null,usedPercent:null,state:'unavailable'});
 assert.deepEqual(budgetPosition({...p,budgetCents:0,remainingCents:0}),{remainingCents:0,usedPercent:null,state:'zero'});
 assert.deepEqual(budgetPosition({...p,budgetCents:0,remainingCents:0},{total:100,pricePending:false}),{remainingCents:-100,usedPercent:null,state:'over'});
 for(const total of [null,NaN,Infinity,-1])assert.equal(budgetPosition(p,{total}).remainingCents,null);
 assert.equal(budgetPosition(null).state,'unavailable');
});

test('original and updated projection COGS use the same costs with independent denominators and budget colours',()=>{
 const p={projectedSalesCents:700000,budgetPercent:28,spentCents:210000,salesOutlook:{expectedSalesCents:840000}},cart={total:0,pricePending:false},before=JSON.stringify(p);
 assert.equal(projectedCogsPercent(p,cart,'baseline'),30);assert.equal(projectedCogsState(p,cart,'baseline'),'over');assert.equal(projectedCogsPercent(p,cart),25);assert.equal(projectedCogsState(p,cart),'within');
 assert.equal(projectedCogsPercent(p,{total:14000,pricePending:false},'baseline'),32);assert.ok(Math.abs(projectedCogsPercent(p,{total:14000,pricePending:false})-26.666666666666668)<1e-10);
 assert.equal(projectedCogsState({...p,spentCents:196000},cart,'baseline'),'within');assert.equal(JSON.stringify(p),before);
});

test('missing sales, pending prices, zeroes and credits are handled separately for both COGS bases',()=>{
 const p={projectedSalesCents:100000,budgetPercent:28,spentCents:20000,salesOutlook:{expectedSalesCents:null}},cart={total:0,pricePending:false};
 assert.equal(projectedCogsPercent(p,cart,'baseline'),20);assert.equal(projectedCogsState(p,cart,'baseline'),'within');assert.equal(projectedCogsPercent(p,cart),null);assert.equal(projectedCogsState(p,cart),'unknown');
 const actualOnly={...p,projectedSalesCents:null,salesOutlook:{expectedSalesCents:100000}};assert.equal(projectedCogsPercent(actualOnly,cart,'baseline'),null);assert.equal(projectedCogsPercent(actualOnly,cart),20);
 for(const basis of ['baseline','trend']){assert.equal(projectedCogsPercent({...p,pricePending:true},cart,basis),null);assert.equal(projectedCogsState(p,{total:1,pricePending:true},basis),'unknown');assert.equal(projectedCogsPercent({...p,projectedSalesCents:0,salesOutlook:{expectedSalesCents:0}},cart,basis),null);assert.equal(projectedCogsState({...p,spentCents:-100,salesOutlook:{expectedSalesCents:100000}},cart,basis),'within');}
});
