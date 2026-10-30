const test=require('node:test'),assert=require('node:assert/strict');
const planning=require('./award-roster-planning'),A=require('./fast-food-award'),M=require('./public/rostering-model'),holidays=require('./australian-public-holidays');
const location={id:'one',publicHolidayState:'VIC'},settings={employerName:'Synthetic employer',enabled:true,localPayEnabled:true,coverageConfirmed:true,sourceId:A.source.id,payPeriodAnchor:'2026-06-29',payPeriodWeeks:1,holidayCalendars:[]};
const profile={userId:'u',effectiveFrom:'2026-07-01',employmentStart:'2020-01-01',dateOfBirth:'1990-01-01',employmentType:'casual',classification:'1',payBasis:'award',cycleWeeks:1};
const shift=(date,start='09:00',end='12:00',extra={})=>({id:date,userId:'u',locationId:'one',startAt:M.instant(date,start),endAt:M.instant(end<=start?M.shiftDate(date,1):date,end),breakMinutes:0,...extra});
const price=(config,item,mode='roster')=>A.calculate({config,profiles:[profile],items:[item],mode}).results[0];
test('automatic state holidays immediately price roster shifts without reviewing or persisting a payroll calendar',()=>{
 for(const state of Object.keys(holidays.states)){
  const site={...location,publicHolidayState:state},item=shift('2026-12-25'),before=JSON.stringify(settings),config=planning.configFor(settings,[site],[item]),result=price(config,item);
  assert.equal(result.complete,true,state);assert.equal(result.costCents,20859);assert(result.notices.some(n=>n.code==='automatic-holidays'));assert(!result.issues.some(n=>n.code==='pay-calendar'));assert.equal(config.planningCalendars[0].confirmed,false);assert.equal(JSON.stringify(settings),before);
  const actual=price(config,item,'timesheets');assert.equal(actual.complete,false);assert.equal(actual.costCents,null);assert(actual.issues.some(i=>i.code==='pay-calendar'&&i.blocking));
 }
});
test('reviewed local exceptions take precedence; unreviewed drafts and missing state never silently certify payroll',()=>{
 const item=shift('2026-12-25'),reviewed={...settings,holidayCalendars:[{locationId:'one',year:2026,confirmed:true,dates:[]}]};assert.equal(price(planning.configFor(reviewed,[location],[item]),item).costCents,10428);
 const draft={...reviewed,holidayCalendars:[{...reviewed.holidayCalendars[0],confirmed:false}]};assert.equal(price(planning.configFor(draft,[location],[item]),item).costCents,20859);
 const unknown=planning.configFor(draft,[{id:'one'}],[item]);assert.equal(price(unknown,item).costCents,null);assert.equal(planning.readiness(draft,{id:'one'},'2026-12-25',[]).ready,false);
 assert.equal(price(planning.configFor(settings,[{id:'other',publicHolidayState:'VIC'}],[item]),item).costCents,null);
});
test('overnight years, part-day holidays and travel use the same automatic planning calendars',()=>{
 const item=shift('2026-12-31','23:00','02:00'),config=planning.configFor(settings,[location],[item]);assert.deepEqual(config.planningCalendars.map(c=>c.year),[2026,2027]);assert.equal(price(config,item).complete,true);
 const qld={...location,publicHolidayState:'QLD'},part=shift('2026-12-24','17:00','20:00'),result=price(planning.configFor(settings,[qld],[part]),part);assert(result.lines.some(l=>l.rateCents===3476));assert(result.lines.some(l=>l.rateCents===6953));
 const travel=shift('2026-12-31','09:00','12:00',{awardFacts:{travelStartAt:M.instant('2027-01-01','09:00'),travelMinutes:60}}),travelCost=price(planning.configFor(settings,[location],[travel]),travel);assert.equal(travelCost.complete,true);assert.equal(travelCost.lines.find(l=>l.label==='Extra travelling time').amountCents,4172);
});
test('setup readiness includes full employment blockers while ordinary part-time rates may still preview',()=>{
 const part={...profile,employmentType:'part-time'},date='2026-10-19',rates=A.hourlyRates({config:settings,profile:part,date,locationId:'one'});assert.equal(rates.ready,true);
 const state=planning.readiness(settings,location,date,[...rates.issues,...A.employmentIssues(part,date,'one',settings.employerName)]);assert.equal(state.ready,false);assert(state.issues.some(i=>i.code==='employment-pattern'));
 assert.equal(planning.readiness(settings,location,date,A.employmentIssues(profile,date,'one')).ready,true);
 assert(planning.readiness({...settings,employerName:''},location,date,[]).issues.some(i=>i.code==='employer-name'));
 const expired=A.hourlyRates({config:settings,profile,date:'2027-07-01',locationId:'one'});assert.equal(planning.readiness(settings,location,'2027-07-01',expired.issues).ready,false);
});
