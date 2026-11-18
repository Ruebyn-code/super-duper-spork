// Stock count and Ordering recommendations subtract units already ordered for the current ordering week.
const{test}=require('node:test'),assert=require('node:assert/strict');
const rules=require('./public/stock-order-rules'),usage=require('./stock-usage');
const session={id:'u1',companyId:'c1',locationId:'loc'};
const order=(id,createdAt,items,extra={})=>({id,status:'requested',companyId:'c1',locationId:'loc',createdAt,items,...extra});
test('the shared rule treats already-ordered units as stock, including the order-when check',()=>{
 assert.equal(rules.recommendation({},10,3),7);assert.equal(rules.recommendation({},10,3,4),3);assert.equal(rules.recommendation({},10,3,20),0);
 assert.equal(rules.recommendation({minimumOrder:6,orderRule:'multiples'},20,3,4),18,'rounding applies after subtracting');
 assert.equal(rules.recommendation({par:{orderWhenLevel:5}},12,3),9);assert.equal(rules.recommendation({par:{orderWhenLevel:5}},12,3,3),0,'stock plus orders above order when needs no order');
 assert.equal(rules.recommendation({ordering:{deliveryPlan:{enabled:true,requiredUnits:10,incomingUnits:2}}},10,3,5),5,'delivery plans keep their own incoming rule');
 assert.equal(rules.recommendation({},10,3,-2),7);assert.equal(rules.recommendation({},10,3,NaN),7);
});
test('only this ordering week’s unreceived orders at this location count, with Sunday rolling into the next week',()=>{
 const products=[{id:'cups'},{id:'lids',unitAmount:'100 pack'}],now=new Date('2026-11-05T02:00:00Z');// Thursday in Melbourne; week starts Mon 2 Nov
 const orders=[order('a','2026-11-02T01:00:00Z',[{id:'cups',quantity:3,supplierId:'s1'},{id:'lids',quantity:2,supplierId:'s2',unitAmount:'100 pack'}]),
  order('a','2026-11-02T01:00:00Z',[{id:'cups',quantity:3,supplierId:'s1'}]),// duplicate record counted once
  order('b','2026-11-01T01:00:00Z',[{id:'cups',quantity:4,supplierId:'s1'}]),// Sunday 1 Nov funds this week
  order('c','2026-10-31T01:00:00Z',[{id:'cups',quantity:50,supplierId:'s1'}]),// Saturday: last week
  order('d','2026-11-03T01:00:00Z',[{id:'cups',quantity:5,supplierId:'s1'}],{fulfilment:{suppliers:[{supplierId:'s1',receivedAt:'2026-11-04T01:00:00Z'}]}}),// received: already in the count
  order('e','2026-11-03T01:00:00Z',[{id:'cups',quantity:7,supplierId:'s1'}],{status:'deleted'}),
  order('f','2026-11-03T01:00:00Z',[{id:'cups',quantity:9,supplierId:'s1'}],{locationId:'other'}),
  order('g','2026-11-03T01:00:00Z',[{id:'cups',quantity:9,supplierId:'s1'}],{companyId:'c2'}),
  order('h','2026-11-03T01:00:00Z',[{id:'lids',quantity:8,supplierId:'s2',unitAmount:'50 pack'}])];// different pack size
 const result=usage.orderedThisWeek(orders,products,session,now);assert.equal(result.weekStart,'2026-11-02');assert.equal(result.totals.get('cups'),7);assert.equal(result.totals.get('lids'),2);
 assert.equal(usage.orderedThisWeek(orders,products,session,new Date('2026-11-08T03:00:00Z')).weekStart,'2026-11-09','on Sunday the upcoming week is the ordering week');
 const suggestion=usage.orderingSuggestions([{id:'count',locationId:'loc',createdAt:'2026-11-05T00:00:00Z',items:[{id:'cups',quantity:2}]}],products,session,{cups:{level:12}},[],result).items.cups;
 assert.deepEqual([suggestion.stockCount,suggestion.alreadyOrdered,suggestion.recommended,suggestion.orderingWeekStart],[2,7,3,'2026-11-02']);assert.equal(Object.hasOwn(usage.orderingSuggestions([],products,session,{lids:{level:1}},[],{totals:new Map()}).items.lids,'alreadyOrdered'),false);
});

test('deliveries count as received automatically: at their expected time, or once a later stock count includes them',()=>{
 const products=[{id:'cups'}],now=new Date('2026-11-05T02:00:00Z');
 const dated=(id,expectedAt)=>order(id,'2026-11-03T01:00:00Z',[{id:'cups',quantity:4,supplierId:'s1'}],{fulfilment:{suppliers:[{supplierId:'s1',expectedAt,receivedAt:null}]}});
 assert.equal(usage.orderedThisWeek([dated('past','2026-11-04T22:00:00Z')],products,session,now).totals.get('cups'),undefined,'a passed delivery time is received');
 assert.equal(usage.orderedThisWeek([dated('soon','2026-11-06T22:00:00Z')],products,session,now).totals.get('cups'),4,'a future delivery is still on its way');
 const undated=order('u','2026-11-03T01:00:00Z',[{id:'cups',quantity:6,supplierId:'s1'}]);
 assert.equal(usage.orderedThisWeek([undated],products,session,now,[{createdAt:'2026-11-02T01:00:00Z',countDate:'2026-11-02',locationId:'loc',companyId:'c1'}]).totals.get('cups'),6,'an earlier count does not include it');
 assert.equal(usage.orderedThisWeek([undated],products,session,now,[{createdAt:'2026-11-04T01:00:00Z',countDate:'2026-11-04',locationId:'loc',companyId:'c1'}]).totals.get('cups'),undefined,'a later count already includes what arrived');
 assert.equal(usage.orderedThisWeek([undated],products,session,now,[{createdAt:'2026-11-03T05:00:00Z',countDate:'2026-11-03',locationId:'loc',companyId:'c1'}]).totals.get('cups'),6,'a same-day count was probably taken before the delivery');
 assert.equal(usage.orderedThisWeek([undated],products,session,now,[{createdAt:'2026-11-04T01:00:00Z',countDate:'2026-11-04',locationId:'other',companyId:'c1'}]).totals.get('cups'),6,'counts at other stores do not count');
});
