const {test}=require('node:test');const assert=require('node:assert/strict');const {windowFor,calculate}=require('./par-levels');
test('par window uses the four complete Monday–Sunday weeks, including year and Melbourne DST boundaries',()=>{
 assert.deepEqual(windowFor(new Date('2026-01-04T12:59:59Z')),{startDate:'2025-12-01',endDate:'2025-12-28',currentWeekStart:'2025-12-29',timeZone:'Australia/Melbourne',weeks:4,weekStartsOn:'Monday'});
 assert.equal(windowFor(new Date('2026-01-04T13:00:00Z')).currentWeekStart,'2026-01-05');
 const dst=windowFor(new Date('2026-10-04T13:00:00Z'));assert.equal(dst.currentWeekStart,'2026-10-05');assert.equal(dst.startDate,'2026-09-07');assert.equal(dst.endDate,'2026-10-04');
 assert.equal(windowFor(new Date('2026-04-05T13:59:59Z')).currentWeekStart,'2026-03-30');assert.equal(windowFor(new Date('2026-04-05T14:00:00Z')).currentWeekStart,'2026-04-06');
});
test('par is a per-account usage average over exactly four recorded weeks, with zeros, decimals and unknown weeks distinct',()=>{
 const weeks=['2026-09-14','2026-09-21','2026-09-28','2026-10-05'];
 const records=weeks.map((weekStart,index)=>({accountId:'own',weekStart,items:[{id:'a',quantity:[10,0,6,5][index]},{id:'zero',quantity:0},{id:'fraction',quantity:[1.25,0.5,0.125,0][index]}]}));
 records.push({accountId:'other',weekStart:weeks[0],items:[{id:'a',quantity:999}]},{accountId:'own',weekStart:'2026-09-07',items:[{id:'a',quantity:999}]},{accountId:'own',weekStart:'2026-10-12',items:[{id:'a',quantity:999}]},records[0]);
 records[0].items.push({id:'incomplete',quantity:20});
 const result=calculate(records,['a','zero','fraction','incomplete','new'].map(id=>({id})),{id:'own'},{now:new Date('2026-10-13T00:00:00Z')});
 assert.deepEqual(result.levels.a,{level:6,average:5.25,usedQuantity:21,weeksRecorded:4});assert.equal(result.levels.zero.level,0);assert.equal(result.levels.fraction.average,0.46875);assert.equal(result.levels.fraction.level,1);assert.equal(result.levels.incomplete.level,null);assert.equal(result.levels.incomplete.weeksRecorded,1);assert.equal(result.levels.new.level,null);assert.equal(result.window.scope,'account');assert.equal(result.window.source,'usage');
});
