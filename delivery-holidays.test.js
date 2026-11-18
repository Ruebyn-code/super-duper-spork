const {test}=require('node:test'),assert=require('node:assert/strict');
const calendar=require('./delivery-calendar'),model=require('./public/supplier-delivery-days-model');
const now=Date.parse('2026-01-20T00:00:00Z'),holidayDates=new Set(['2026-01-26']),base={supplierId:'s1',days:['mon'],leadDays:1,cutoffTime:'14:00',deliveryTime:'08:00'};
const next=schedule=>calendar.plan(schedule,{now,holidayDates}).next;

test('public holiday rules: deliver, skip, move a day earlier or later, with per-holiday overrides',()=>{
 assert.equal(next({...base,holidayRule:'deliver'}).date,'2026-01-26');
 assert.equal(next({...base,holidayRule:'skip'}).date,'2026-02-02');
 assert.equal(next({...base,skipHolidays:true}).date,'2026-02-02','older Skip public holidays switch still skips');
 const before=next({...base,holidayRule:'before'});assert.equal(before.date,'2026-01-25');assert.equal(before.movedFrom,'2026-01-26');
 const after=next({...base,holidayRule:'after'});assert.equal(after.date,'2026-01-27');assert.equal(after.movedFrom,'2026-01-26');
 assert.equal(next({...base,holidayRule:'skip',holidayOverrides:[{date:'2026-01-26',rule:'deliver'}]}).date,'2026-01-26');
 assert.equal(next({...base,holidayRule:'deliver',holidayOverrides:[{date:'2026-01-26',rule:'after'}]}).date,'2026-01-27');
 // One-off changes still win: no delivery on the 27th pushes a later move one more day.
 assert.equal(next({...base,holidayRule:'after',exceptions:[{date:'2026-01-27',delivery:false}]}).date,'2026-01-28');
 assert.match(model.planText(calendar.plan({...base,holidayRule:'after'},{now,holidayDates})),/Moved from Mon,? 26 Jan \(public holiday\)/);
});

test('order deadlines can move earlier when they land on a public holiday',()=>{
 const tuesday={...base,days:['tue']};
 assert.equal(next(tuesday).orderBy,new Date(Date.parse('2026-01-26T03:00:00Z')).toISOString());
 assert.equal(next({...tuesday,cutoffHolidays:true}).orderBy,new Date(Date.parse('2026-01-25T03:00:00Z')).toISOString());
});

test('holiday settings need a calendar and validate their values',()=>{
 assert.match(calendar.plan({...base,holidayRule:'after'},{now,holidayCalendarAvailable:false}).reason,/holiday calendar/);
 assert.equal(calendar.plan({...base,holidayRule:'deliver'},{now,holidayCalendarAvailable:false}).next.date,'2026-01-26');
 const [row]=model.normalize([{...base,holidayRule:'after',holidayOverrides:[{date:'2026-04-03',rule:'skip'},{date:'2026-01-26',rule:'deliver'}],cutoffHolidays:true}]);
 assert.equal(row.skipHolidays,true);assert.deepEqual(row.holidayOverrides.map(item=>item.date),['2026-01-26','2026-04-03']);
 assert.equal(model.holidayRule({skipHolidays:true}),'skip');assert.equal(model.holidayRule({}),'deliver');
 for(const bad of [{holidayRule:'later'},{holidayOverrides:[{date:'2026-01-26',rule:'nope'}]},{holidayOverrides:[{date:'2026-01-26',rule:'skip'},{date:'2026-01-26',rule:'after'}]},{cutoffHolidays:'yes'}])assert.throws(()=>model.normalize([{...base,...bad}]));
});
