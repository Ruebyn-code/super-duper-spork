const {test}=require('node:test');const assert=require('node:assert/strict');const {windowFor,calculate}=require('./par-levels');
test('par window uses four complete Sunday–Saturday weeks across year and Melbourne DST boundaries',()=>{
 assert.deepEqual(windowFor(new Date('2026-01-03T12:59:59Z')),{startDate:'2025-11-30',endDate:'2025-12-27',currentWeekStart:'2025-12-28',timeZone:'Australia/Melbourne',weeks:4,weekStartsOn:'Sunday'});
 assert.equal(windowFor(new Date('2026-01-03T13:00:00Z')).currentWeekStart,'2026-01-04');
 assert.equal(windowFor(new Date('2026-10-03T13:59:59Z')).currentWeekStart,'2026-09-27');
 const dst=windowFor(new Date('2026-10-03T14:00:00Z'));assert.equal(dst.currentWeekStart,'2026-10-04');assert.equal(dst.startDate,'2026-09-06');assert.equal(dst.endDate,'2026-10-03');
 assert.equal(windowFor(new Date('2026-10-10T12:59:59Z')).currentWeekStart,'2026-10-04');assert.equal(windowFor(new Date('2026-10-10T13:00:00Z')).currentWeekStart,'2026-10-11');
 assert.equal(windowFor(new Date('2026-04-04T12:59:59Z')).currentWeekStart,'2026-03-29');assert.equal(windowFor(new Date('2026-04-04T13:00:00Z')).currentWeekStart,'2026-04-05');
 assert.equal(windowFor(new Date('2026-04-11T13:59:59Z')).currentWeekStart,'2026-04-05');assert.equal(windowFor(new Date('2026-04-11T14:00:00Z')).currentWeekStart,'2026-04-12');
});
test('par averages only the account’s four complete automatic usage cycles, with explicit zero and incomplete weeks distinct',()=>{
 const weeks=['2026-09-13','2026-09-20','2026-09-27','2026-10-04'];
 const records=weeks.map((weekStart,index)=>({accountId:'own',source:'sunday_counts_and_orders',weekStart,items:[{id:'a',status:'complete',quantity:[10,0,6,5][index]},{id:'zero',status:'complete',quantity:0},{id:'fraction',status:'complete',quantity:[1.25,0.5,0.125,0][index]}]}));
 records.push({...records[0],accountId:'other',items:[{id:'a',status:'complete',quantity:999}]},{...records[0],weekStart:'2026-09-06',items:[{id:'a',status:'complete',quantity:999}]},{...records[0],weekStart:'2026-10-11',items:[{id:'a',status:'complete',quantity:999}]},records[0],{accountId:'own',weekStart:weeks[0],items:[{id:'new',quantity:999}]});
 records[0].items.push({id:'incomplete',status:'complete',quantity:20});records[1].items.push({id:'incomplete',status:'negative_usage',quantity:-2});
 const result=calculate(records,['a','zero','fraction','incomplete','new'].map(id=>({id})),{id:'own'},{now:new Date('2026-10-14T00:00:00Z')});
 assert.deepEqual(result.levels.a,{level:6,orderWhenLevel:5.25,average:5.25,usedQuantity:21,weeksRecorded:4,manualLevel:null,source:'usage'});assert.equal(result.levels.zero.level,0);assert.equal(result.levels.fraction.average,0.46875);assert.equal(result.levels.fraction.level,1);assert.equal(result.levels.incomplete.level,20);assert.equal(result.levels.incomplete.weeksRecorded,1);assert.equal(result.levels.new.level,null);assert.equal(result.window.source,'sunday_counts_and_orders');
});

test('manual par is a zero-history fallback and automatic par progressively averages one, two, three and four usable weeks',()=>{
 const actor={id:'own'},products=[{id:'a'},{id:'zero'},{id:'blank'}],options={now:new Date('2026-10-14T00:00:00Z'),manualLevels:{a:99,zero:0}};
 let result=calculate([],products,actor,options);assert.equal(result.levels.a.level,99);assert.equal(result.levels.a.source,'manual');assert.equal(result.levels.a.average,null);assert.equal(result.levels.zero.level,0);assert.equal(result.levels.blank.level,null);
 const records=['2026-09-13','2026-09-20','2026-09-27','2026-10-04'].map((weekStart,index)=>({accountId:'own',source:'sunday_counts_and_orders',weekStart,items:[{id:'a',status:'complete',quantity:[10,20,30,40][index]},{id:'zero',status:'complete',quantity:0}]}));
 for(let weeks=1;weeks<=4;weeks++){result=calculate(records.slice(0,weeks),products,actor,options);assert.equal(result.levels.a.level,[10,15,20,25][weeks-1]);assert.equal(result.levels.a.weeksRecorded,weeks);assert.equal(result.levels.a.source,'usage');assert.equal(result.levels.a.manualLevel,99);assert.equal(result.levels.zero.source,'usage');assert.equal(result.levels.zero.level,0);}
 const invalid=[{...records[0],items:[{id:'a',status:'negative_usage',quantity:-1}]},{...records[1],items:[{id:'a',status:'missing_closing_count',quantity:null}]}];assert.equal(calculate(invalid,products,actor,options).levels.a.level,99);
 const expired=calculate(records,products,actor,{...options,now:new Date('2026-12-01T00:00:00Z')});assert.equal(expired.levels.a.level,99);assert.equal(expired.levels.a.weeksRecorded,0);
});
