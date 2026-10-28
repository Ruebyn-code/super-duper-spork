const {test}=require('node:test'),assert=require('node:assert/strict');
const {projectedCogsPercent}=require('./public/sales-budget'),sales=require('./sales'),{shift}=require('./stock-usage');

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
