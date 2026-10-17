const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./public/clock-model');
const start=Date.parse('2026-10-18T22:00:00Z'),entry=(breaks=[])=>({id:'entry',startAt:new Date(start).toISOString(),endAt:null,breaks}),at=minutes=>new Date(start+minutes*60000).toISOString(),shift={id:'shift',startAt:at(0),endAt:at(510),breakMinutes:30};
test('clause 14 break entitlements use hours worked and include both nine-hour alternatives',()=>{
 assert.equal(M.entitlement(4*3600-1).restCount,0);assert.equal(M.entitlement(4*3600).restCount,1);assert.equal(M.entitlement(5*3600-1).mealCount,0);assert.equal(M.entitlement(5*3600).mealCount,1);assert.equal(M.entitlement(9*3600-1).restCount,1);assert.equal(M.entitlement(9*3600).restCount,2);assert.equal(M.entitlement(9*3600,2).restCount,1);assert.equal(M.entitlement(9*3600,2).mealCount,2);assert.equal(M.entitlement(9*3600).alternatives,true);
 assert.equal(M.guidance(entry(),{...shift,endAt:at(540)},start).restCount,1,'nine elapsed hours less an unpaid half-hour is 8.5 worked hours');
 assert.equal(M.guidance(entry(),{...shift,endAt:at(570)},start).restCount,2,'nine worked hours needs the long-shift alternatives');
});
test('paid rest stays in worked time, meal breaks are deducted, and actual overrun increases break entitlement',()=>{
 const value=entry([{startAt:at(60),endAt:at(70),paid:true},{startAt:at(240),endAt:at(270)}]);assert.equal(M.elapsed(value,start+300*60000),270*60);const guide=M.guidance(value,shift,start+300*60000);assert.equal(guide.restTaken,1);assert.equal(guide.mealsTaken,1);assert.equal(guide.workedSeconds,270*60);assert.equal(guide.mealDueAt,at(570));assert.equal(M.guidance(value,shift,start+600*60000).restCount,2);
 const shortMeal=entry([{startAt:at(240),endAt:at(245)}]);assert.equal(M.guidance(shortMeal,shift,start+300*60000).mealDueAt,at(300));assert.equal(M.phase({entry:shortMeal,shift},start+300*60000),'meal-due','a short interrupted meal does not defer the five-hour reminder');
 const ongoing=entry([{startAt:at(60),endAt:null,paid:true}]);assert.equal(M.elapsed(ongoing,start+70*60000),70*60);assert.equal(M.phase({entry:ongoing,shift},start+70*60000),'break-ready');assert.equal(M.phase({entry:entry([{startAt:at(240),endAt:null}]),shift},start+300*60000),'meal-overdue');
});
test('clock and break phases follow exact times without recording an action',()=>{
 assert.equal(M.phase({entry:null,shift},start-1),'idle');assert.equal(M.phase({entry:null,shift,earlyStartAvailable:true},start-1),'early-start');assert.equal(M.phase({entry:null,shift,earlyStartAvailable:true},start),'clock-in');assert.equal(M.phase({entry:null,shift},start),'clock-in');assert.equal(M.phase({entry:null,shift},Date.parse(shift.endAt)),'idle');assert.equal(M.phase({entry:entry(),shift},start+300*60000),'meal-due');assert.equal(M.phase({entry:entry(),shift},Date.parse(shift.endAt)),'clock-out');
 const value=entry([{startAt:at(100),endAt:null}]);assert.equal(M.phase({entry:value,shift},start+129*60000),'on-break');assert.equal(M.phase({entry:value,shift},start+130*60000),'break-ready');assert.equal(value.breaks[0].endAt,null);
});
test('break timing warnings flag short rests, meal limits, first/last hours and combined breaks',()=>{
 assert.equal(M.warnings(entry(),shift,'break-start',true,start+30*60000).length,1);assert.equal(M.warnings(entry(),shift,'break-start',true,start+60*60000).length,0);assert.ok(M.warnings(entry(),shift,'break-start',false,start+500*60000).some(message=>message.includes('last rostered hour')));
 assert.ok(M.warnings(entry([{startAt:at(90),endAt:null,paid:true}]),shift,'break-end',false,start+99*60000).some(message=>message.includes('10 minutes')));assert.equal(M.warnings(entry([{startAt:at(90),endAt:null,paid:true}]),shift,'break-end',false,start+100*60000).length,0);
 for(const minutes of [29,61])assert.ok(M.warnings(entry([{startAt:at(90),endAt:null}]),shift,'break-end',false,start+(90+minutes)*60000).length);for(const minutes of [30,60])assert.equal(M.warnings(entry([{startAt:at(90),endAt:null}]),shift,'break-end',false,start+(90+minutes)*60000).length,0);
 assert.ok(M.warnings(entry([{startAt:at(90),endAt:at(100),paid:true}]),shift,'break-start',false,start+100*60000).some(message=>message.includes('combined')));
});
test('a fresh PIN unlock reveals only the actions and qualifying breaks remaining in this stage',()=>{
 const unlocked={clockUnlocked:true,unlockExpiresAt:at(1000)},current=entry(),short={...shift,endAt:at(180),breakMinutes:0},restOnly={...shift,endAt:at(270),breakMinutes:0};
 assert.deepEqual(M.actions({entry:null,shift},start),[]);assert.deepEqual(M.actions({entry:null,shift,...unlocked},start),[{action:'in'}]);assert.deepEqual(M.actions({entry:current,shift},start),[]);
 assert.deepEqual(M.actions({entry:current,shift:short,...unlocked},start),[{action:'out'}]);assert.deepEqual(M.actions({entry:current,shift:restOnly,...unlocked},start),[{action:'break-start',breakType:'paid'},{action:'out'}]);
 assert.deepEqual(M.actions({entry:current,shift,...unlocked},start),[{action:'break-start',breakType:'paid'},{action:'out'},{action:'break-start',breakType:'unpaid'}]);
 const afterRest=entry([{startAt:at(60),endAt:at(70),paid:true}]);assert.deepEqual(M.actions({entry:afterRest,shift,...unlocked},start+70*60000),[{action:'out'},{action:'break-start',breakType:'unpaid'}]);
 const done=entry([{startAt:at(60),endAt:at(70),paid:true},{startAt:at(240),endAt:at(270)}]);assert.deepEqual(M.actions({entry:done,shift,...unlocked},start+300*60000),[{action:'out'}]);
 assert.deepEqual(M.actions({entry:done,shift,...unlocked},start+1000*60000),[]);assert.deepEqual(M.actions({entry:entry([{startAt:at(100),endAt:null}]),shift,...unlocked},start+110*60000),[{action:'break-end'},{action:'out'}]);
 const twoMeals={...shift,endAt:at(660),breakMinutes:60},guide=M.guidance(current,twoMeals,start);assert.equal(guide.restCount,1);assert.equal(guide.mealCount,2);assert.equal(guide.remainingMeals,2);
 assert.ok(M.actions({entry:done,shift,...unlocked},start+600*60000).some(action=>action.breakType==='unpaid'),'another meal remains available after another five hours of work');
});
