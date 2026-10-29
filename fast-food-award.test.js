const test=require('node:test'),assert=require('node:assert/strict');
const A=require('./fast-food-award'),M=require('./public/rostering-model');
const config={enabled:true,localPayEnabled:true,payPeriodAnchor:'2026-06-29',payPeriodWeeks:1,holidayCalendars:[{locationId:'one',year:2026,confirmed:true,dates:[]}]};
const profile={id:'p1',userId:'u1',effectiveFrom:'2026-01-01',dateOfBirth:'1990-01-01',employmentStart:'2020-01-01',employmentType:'casual',classification:'1',payBasis:'award',cycleWeeks:1};
test('automatic hourly rates match actual award shift lines, including casual loading and penalty rounding',()=>{
 const settings={...config,coverageConfirmed:true,sourceId:A.source.id};
 for(const employmentType of ['casual','full-time'])for(const [day,key]of [['2026-10-19','weekdayCents'],['2026-10-24','saturdayCents'],['2026-10-25','sundayCents']]){
  const employee={...profile,employmentType},hourly=A.hourlyRates({config:settings,profile:employee,date:day}),priced=A.calculate({config:settings,profiles:[employee],items:[{id:'ordinary',userId:'u1',locationId:'one',startAt:M.instant(day,'09:00'),endAt:M.instant(day,'12:00'),breakMinutes:0}]}).results[0];
  assert.equal(hourly.ready,true);assert.equal(hourly.rates[key],priced.lines.find(line=>line.kind==='ordinary').rateCents);
 }
 const p={...profile,dateOfBirth:'2008-10-20'},before=A.hourlyRates({config:settings,profile:p,date:'2026-10-19'}),birthday=A.hourlyRates({config:settings,profile:p,date:'2026-10-20'});assert.equal(before.rates.minimumBaseCents,1669);assert.equal(before.rates.weekdayCents,2086);assert.equal(birthday.rates.minimumBaseCents,1947);assert.equal(birthday.rates.weekdayCents,2434);
 assert.equal(A.hourlyRates({config:settings,profile,date:'2026-10-19'}).rates.publicHolidayCents,6953);
});
test('hourly award estimates retain agreed-above-award bases and withhold missing, disabled or uncovered calculations',()=>{
 const settings={...config,coverageConfirmed:true,sourceId:A.source.id},date='2026-10-19',read=(p=profile,c=settings,d=date)=>A.hourlyRates({config:c,profile:p,date:d});
 assert.equal(read({...profile,payBasis:'base-plus-penalties',baseRateCents:3000}).rates.weekdayCents,3750);
 for(const [p,c,d]of [[undefined,settings,date],[{...profile,payBasis:undefined},settings,date],[{...profile,classification:'3'},settings,date],[{...profile,arrangement:'needs-review'},settings,date],[{...profile,payBasis:'base-plus-penalties',baseRateCents:100},settings,date],[profile,{...settings,localPayEnabled:false},date],[profile,{...settings,sourceId:'old-edition'},date],[profile,{...settings,payPeriodAnchor:null},date],[profile,settings,'2026-07-01'],[profile,settings,'2027-07-01']]){const result=A.hourlyRates({config:c,profile:p,date:d});assert.equal(result.ready,false);assert.equal(result.rates,null);assert(result.issues.length);}
 assert.throws(()=>read(profile,settings,'2026-02-30'),{status:400});
});
const shift=(date,start,end,extra={})=>({id:date+start,locationId:'one',userId:'u1',startAt:M.instant(date,start),endAt:M.instant(end<=start?M.shiftDate(date,1):date,end),breakMinutes:0,...extra});
function price(items,profiles=[profile],settings=config,mode='roster'){return A.calculate({config:settings,profiles,items,mode}).results;}
test('uploaded Schedule A adult and junior rates use rounded junior bases before loading',()=>{
 for(const [classification,level3Band,base]of [['1',null,2781],['2',null,2945],['3','one-or-none',2991],['3','two-or-more',3027]])assert.equal(A.baseRate({...profile,classification,level3Band},'2026-10-05'),base);
 const expected=[[1112,1390,1501,1557,1668,2780],[1391,1739,1878,1947,2087,3478],[1669,2086,2253,2337,2504,4173],[1947,2434,2628,2726,2921,4868],[2225,2781,3004,3115,3338,5563],[2503,3129,3379,3504,3755,6258]];
 for(let index=0;index<6;index++){const age=15+index,p={...profile,dateOfBirth:(2026-age)+'-01-01'},base=A.baseRate(p,'2026-10-05');assert.deepEqual([base,...[125,135,140,150,250].map(n=>A.roundRate(base,n))],expected[index]);}
 assert.equal(A.roundRate(2945,110),3240);assert.equal(A.roundRate(3027,275),8324);
 assert.equal(A.baseRate({...profile,classification:'3'},'2026-10-05'),null);
});
test('weekend, evening, overnight and part-day public holidays split rates without stacking penalties',()=>{
 let [p]=price([shift('2026-10-05','21:00','01:00')]);assert.deepEqual(p.lines.map(l=>[l.seconds,l.rateCents]),[[3600,3476],[7200,3754],[3600,3893]]);assert.equal(p.costCents,14877);
 [p]=price([shift('2026-10-10','09:00','12:00')]);assert.equal(p.costCents,4172*3);
 [p]=price([shift('2026-10-11','09:00','12:00')],[{...profile,classification:'2'}]);assert.equal(p.costCents,5154*3);
 const holidays={...config,holidayCalendars:[{...config.holidayCalendars[0],dates:[{date:'2026-10-05',start:'18:00',end:'24:00'}]}]};
 [p]=price([shift('2026-10-05','16:00','20:00')],[profile],holidays);assert.deepEqual(p.lines.map(l=>l.rateCents),[3476,6953]);assert.equal(p.costCents,2*3476+2*6953);
});
test('casual daily overtime is 175% then 225%, and ordinary weekly hours stop at 38 across locations',()=>{
 let [p]=price([shift('2026-10-05','00:00','15:00')]);assert.equal(p.ordinarySeconds,39600);assert.equal(p.overtimeSeconds,14400);assert.deepEqual(p.lines.filter(l=>l.kind==='overtime').map(l=>[l.seconds,l.rateCents]),[[7200,4867],[7200,6257]]);
 const items=Array.from({length:5},(_,i)=>shift(M.shiftDate('2026-10-05',i),'09:00','17:00',{locationId:i%2?'two':'one'}));
 const all=price(items,[profile],{...config,holidayCalendars:[...config.holidayCalendars,{...config.holidayCalendars[0],locationId:'two'}]});assert.equal(all.reduce((n,p)=>n+p.ordinarySeconds,0),38*3600);assert.equal(all.at(-1).overtimeSeconds,7200);
 const precise=price([shift('2026-10-05','00:00','11:00',{startAt:'2026-10-04T13:00:31Z',endAt:'2026-10-05T00:01:01Z'})])[0];assert.equal(precise.ordinarySeconds,39600);assert.equal(precise.overtimeSeconds,30);
});
test('full-time outside published roster, sixth day, and part-time pattern changes attract overtime',()=>{
 let [p]=price([shift('2026-10-05','08:00','18:00',{ordinaryWindows:[{startAt:M.instant('2026-10-05','09:00'),endAt:M.instant('2026-10-05','17:00')}]})],[{...profile,employmentType:'full-time'}],config,'timesheets');assert.equal(p.ordinarySeconds,28800);assert.equal(p.overtimeSeconds,7200);
 const six=price(Array.from({length:6},(_,i)=>shift(M.shiftDate('2026-10-05',i),'09:00','12:00')),[{...profile,employmentType:'full-time'}]);assert.equal(six[5].overtimeSeconds,10800);
 const pt={...profile,employmentType:'part-time',agreementReference:'Written test pattern 001',agreedWeeklyMinutes:180,pattern:[{start:'09:00',end:'12:00',overnight:false,breakMinutes:0},...Array(6).fill(null)]};
 [p]=price([shift('2026-10-05','09:00','14:00')],[pt]);assert.equal(p.ordinarySeconds,10800);assert.equal(p.overtimeSeconds,7200);
 [p]=price([shift('2026-10-05','09:00','14:00',{awardFacts:{variation:{start:'09:00',end:'14:00',overnight:false,breakMinutes:0,reference:'Written variation 001',agreedAt:'2026-10-05T01:00:00Z'}}})],[pt]);assert.equal(p.ordinarySeconds,18000);assert.equal(p.overtimeSeconds,0);
});
test('minimum payments are additional entitlement and never change actual hours worked',()=>{
 let [p]=price([shift('2026-10-05','09:00','10:00')]);assert.equal(p.paidSeconds,3600);assert.equal(p.minimumPaymentSeconds,7200);assert.equal(p.costCents,3*3476);
 const pt={...profile,employmentType:'part-time',agreementReference:'Written test pattern 001',agreedWeeklyMinutes:180,pattern:[{start:'09:00',end:'12:00',overnight:false,breakMinutes:0},...Array(6).fill(null)]};
 [p]=price([shift('2026-10-11','09:00','10:00')],[pt]);assert.equal(p.minimumPaymentSeconds,10800);assert.equal(p.costCents,4*5562);
 const adjacent=price([shift('2026-10-05','09:00','11:00'),shift('2026-10-05','11:00','12:00')]);assert.equal(adjacent.reduce((sum,p)=>sum+p.minimumPaymentSeconds,0),0);assert.equal(adjacent.reduce((sum,p)=>sum+p.costCents,0),3*3476);
 const short=price([shift('2026-10-05','09:00','10:00'),shift('2026-10-05','10:00','11:00')]);assert.equal(short[0].minimumPaymentSeconds,0);assert.equal(short[1].minimumPaymentSeconds,3600);assert.equal(short.reduce((sum,p)=>sum+p.costCents,0),3*3476);
 const overnight=price([shift('2026-10-11','23:00','01:00')],[pt]);assert.equal(overnight[0].paidSeconds,7200);assert.equal(overnight[0].minimumPaymentSeconds,10800);assert.equal(overnight[0].costCents,4*5562+4172);
 const sunday=price([shift('2026-10-11','09:00','11:00'),shift('2026-10-11','11:00','12:00')],[pt]);assert.equal(sunday.reduce((sum,p)=>sum+p.costCents,0),4*5562);
});
test('breaks remain paid when marked rest; actual meal timing is required instead of guessed',()=>{
 const worked=shift('2026-10-05','09:00','15:00',{breakMinutes:30});let [p]=price([worked]);assert.equal(p.paidSeconds,19800);assert.equal(p.complete,true);assert.ok(p.issues.some(i=>i.code==='pay-break-position'));
 [p]=price([worked],[profile],config,'timesheets');assert.equal(p.costCents,null);assert.equal(p.complete,false);
 [p]=price([{...worked,breaks:[{startAt:M.instant('2026-10-05','11:00'),endAt:M.instant('2026-10-05','11:10'),paid:true},{startAt:M.instant('2026-10-05','13:00'),endAt:M.instant('2026-10-05','13:30')}]}],[profile],config,'timesheets');assert.equal(p.paidSeconds,19800);assert.equal(p.costCents,Math.round(5.5*3476));assert.ok(!p.issues.some(i=>i.code==='pay-rest-breaks'||i.code==='pay-break-position'));
});
test('dated source, employer pay period, birthdays and missing holiday/classification details are explicit',()=>{
 assert.equal(A.rateEffective(config),'2026-07-06');assert.equal(price([shift('2026-07-02','09:00','12:00')])[0].costCents,null);
 assert.equal(price([shift('2027-07-01','09:00','12:00')])[0].costCents,null);
 assert.equal(price([shift('2026-10-05','09:00','12:00')],[profile],{...config,holidayCalendars:[]})[0].costCents,null);
 const born={...profile,dateOfBirth:'2005-10-06'};const [p]=price([shift('2026-10-05','22:00','02:00')],[born]);assert.deepEqual(p.lines.map(l=>l.rateCents),[3379,3893]);
});
test('Schedule B allowances, explicit reimbursements, above-award base and separate employer estimates',()=>{
 const facts={coldMinutes:60,freezerMinutes:30,deliveryKm:10,otherKm:2,reimbursementCents:2000,reimbursementReason:'Uniform purchased'};
 let [p]=price([shift('2026-10-05','09:00','12:00',{awardFacts:facts})],[{...profile,laundersUniform:true,superEligible:true}],{...config,superBps:1200,oncostBps:100});assert.equal(p.allowanceCents,38+49+530+200+2000+128);assert.equal(p.superEstimateCents,Math.round(10428*.12));assert.equal(p.oncostEstimateCents,Math.round(p.costCents*.01));assert.equal(p.employerEstimateCents,p.costCents+p.superEstimateCents+p.oncostEstimateCents);
 const results=price([shift('2026-10-05','09:00','12:00'),shift('2026-10-06','09:00','12:00')],[{...profile,employmentType:'full-time',laundersUniform:true}],{...config,holidayCalendars:[{...config.holidayCalendars[0],brokenHill:true}]});assert.equal(results[0].allowanceCents,4790+642);assert.equal(results[1].allowanceCents,0);
 [p]=price([shift('2026-10-10','09:00','12:00')],[{...profile,payBasis:'base-plus-penalties',baseRateCents:3000}]);assert.equal(p.costCents,4500*3);
 [p]=price([shift('2026-10-05','09:00','12:00')],[{...profile,payBasis:'base-plus-penalties',baseRateCents:1000}]);assert.equal(p.costCents,null);
 assert.throws(()=>A.facts({variation:{start:'09:00',end:'12:00'}}));assert.throws(()=>A.facts({reimbursementCents:100}));assert.throws(()=>A.facts({restBreaksTaken:-1}));
});
test('meal and travelling allowances apply their own conditions and split part-day holiday travel',()=>{
 const holiday={...config,holidayCalendars:[{...config.holidayCalendars[0],dates:[{date:'2026-10-05',start:'18:30',end:'24:00'}]}]};
 const [travel]=price([shift('2026-10-05','09:00','12:00',{awardFacts:{travelMinutes:30,travelStartAt:M.instant('2026-10-05','08:00'),returnTravelMinutes:30,returnTravelStartAt:M.instant('2026-10-05','18:30')}})],[profile],holiday);
 assert.equal(travel.allowanceCents,1391+2086);
 const [meal]=price([shift('2026-10-05','09:00','23:00',{breakMinutes:60,ordinaryWindows:[{startAt:M.instant('2026-10-05','09:00'),endAt:M.instant('2026-10-05','17:00')}],awardFacts:{mealBreakStart:'13:00',mealConditionsReviewed:true,mealEligible:true,mealOvertimeMinutes:360}})],[{...profile,employmentType:'full-time'}],config,'timesheets');
 assert.equal(meal.allowanceCents,1733+1566);assert.equal(meal.costCents,7*2781+2*4172+4*5562+3299);
 const [partial]=price([shift('2026-10-05','16:00','20:00')],[profile],holiday);assert.deepEqual(partial.lines.map(l=>[l.seconds,l.rateCents]),[[9000,3476],[5400,6953]]);
 const ordinaryWindows=[{startAt:M.instant('2026-10-05','09:00'),endAt:M.instant('2026-10-05','12:00')}],overtimeFacts={mealEligible:true,mealConditionsReviewed:true};
 const split=price([shift('2026-10-05','09:00','12:00',{ordinaryWindows}),shift('2026-10-05','12:00','13:00',{ordinaryWindows,awardFacts:overtimeFacts}),shift('2026-10-05','13:00','14:00',{ordinaryWindows,awardFacts:overtimeFacts})],[{...profile,employmentType:'full-time'}],config,'timesheets');
 assert.equal(split.reduce((sum,r)=>sum+r.allowanceCents,0),1733);assert.ok(split.at(-1).issues.some(i=>i.code==='pay-meal-break'));assert.ok(split.at(-1).issues.some(i=>i.code==='pay-rest-breaks'));
 const laundry=price([shift('2026-10-05','09:00','10:00'),shift('2026-10-05','10:00','12:00')],[{...profile,laundersUniform:true}]);assert.equal(laundry.reduce((sum,r)=>sum+r.allowanceCents,0),128);
});
test('cycle averaging, millisecond clocks and unsupported arrangements never silently revert to flat wages',()=>{
 const items=Array.from({length:10},(_,i)=>shift(M.shiftDate('2026-10-05',Math.floor(i/5)*7+i%5),'09:00','17:00'));
 const averaged=price(items,[{...profile,cycleWeeks:2,cycleAnchor:'2026-10-05'}]);assert.equal(averaged.reduce((n,p)=>n+p.ordinarySeconds,0),76*3600);assert.equal(averaged.reduce((n,p)=>n+p.overtimeSeconds,0),4*3600);assert.ok(averaged[0].issues.some(i=>i.code==='pay-averaging'));
 const [precise]=price([shift('2026-10-05','00:00','11:00',{startAt:'2026-10-04T13:00:00.123Z',endAt:'2026-10-05T00:00:00.456Z'})]);assert.equal(precise.ordinarySeconds,39600);assert.ok(Math.abs(precise.overtimeSeconds-.333)<.000001);
 const [special]=price([shift('2026-10-05','09:00','12:00')],[{...profile,arrangement:'needs-review'}]);assert.equal(special.costCents,null);assert.ok(special.issues.some(i=>i.code==='pay-special-arrangement'&&i.blocking));
 assert.throws(()=>A.facts({coldMinutes:-1}),e=>e.status===400);
});
test('the bundled source is the exact uploaded PDF identified by the calculator edition',()=>{
 const fs=require('node:fs'),crypto=require('node:crypto'),pdf=fs.readFileSync(require('node:path').join(__dirname,'docs/awards/ma000003-2026-07.pdf'));
 assert.equal(crypto.createHash('sha256').update(pdf).digest('hex'),A.source.sha256);
});
test('incomplete employer-wide work context blocks otherwise priced rows in the same cycle',()=>{
 const rows=price([shift('2026-10-05','09:00','12:00',{locationId:'unknown-calendar'}),shift('2026-10-06','09:00','12:00')]);
 assert.equal(rows[0].costCents,null);assert.equal(rows[1].costCents,null);assert.ok(rows[1].issues.some(i=>i.code==='pay-incomplete-context'&&i.blocking));
 const resolved=price([shift('2026-10-05','09:00','12:00',{locationId:'unknown-calendar'}),shift('2026-10-06','09:00','12:00')],[profile],{...config,holidayCalendars:[...config.holidayCalendars,{...config.holidayCalendars[0],locationId:'unknown-calendar'}]});
 assert.equal(resolved[1].costCents,10428);assert.notEqual(resolved[1].fingerprint,rows[1].fingerprint);
});

test('overnight work rechecks new dated employment terms instead of silently costing unsupported arrangements',()=>{
 const worked=shift('2026-10-05','22:00','02:00');
 for(const changes of [{arrangement:'needs-review'},{classification:'3',level3Band:null},{payBasis:'base-plus-penalties',baseRateCents:100},{employmentType:'part-time',agreedWeeklyMinutes:180,agreementReference:'Written agreement',pattern:undefined}]){
  const later={...profile,id:'new-profile',effectiveFrom:'2026-10-06',...changes},result=price([worked],[profile,later])[0];assert.equal(result.complete,false);assert.equal(result.costCents,null);assert(result.issues.some(i=>i.blocking&&i.message.startsWith('Employment terms for 2026-10-06:')));
 }
 const valid={...profile,id:'new-profile',effectiveFrom:'2026-10-06',classification:'2'},priced=price([worked],[profile,valid])[0];assert.equal(priced.complete,true);assert.equal(priced.lines.at(-1).rateCents,4123);
 assert(A.employmentIssues({...profile,dateOfBirth:undefined},'2026-10-05').some(i=>i.code==='employment'));assert.equal(A.employmentIssues(profile,'2026-10-05').length,0);
});

test('every published Schedule A adult and junior ordinary, penalty and overtime table entry matches the calculator',()=>{
 const tables=require('./docs/awards/ma000003-2026-07-rates.json'),settings={...config,coverageConfirmed:true,sourceId:A.source.id},keys=['1','2','3-one','3-many'];assert.equal(tables.sha256,A.source.sha256);
 for(const [name,adults]of Object.entries(tables.adult)){
  const type=name.startsWith('casual')?'casual':'full-time',overtime=name.endsWith('Overtime'),rows=[...adults.map((cents,i)=>({classification:keys[i],age:30,cents})),...tables.junior[name]];
  for(const row of rows){const employee={...profile,employmentType:type,dateOfBirth:(2026-row.age)+'-01-01',classification:row.classification.startsWith('3')?'3':row.classification,level3Band:row.classification==='3-one'?'one-or-none':row.classification==='3-many'?'two-or-more':null},label=name+' '+row.classification+' age '+row.age;
   if(overtime){const base=A.baseRate(employee,'2026-10-05');assert.deepEqual([[1,false,0],[1,false,7200],[0,false,0],[1,true,0]].map(([day,holiday,seconds])=>A.roundRate(base,A.overtimePercent(type,day,holiday,seconds))),row.cents,label);}
   else{const result=A.hourlyRates({config:settings,profile:employee,date:'2026-10-05'});assert.equal(result.ready,true,label);assert.deepEqual([result.rates.weekdayCents,result.rates.eveningCents,result.rates.overnightCents,result.rates.saturdayCents,...(employee.classification==='1'?[result.rates.sundayCents,null]:[null,result.rates.sundayCents]),result.rates.publicHolidayCents],row.cents,label);}
  }
 }
});

test('draft hourly previews change employment type and allowances without inventing hourly allowance amounts or work agreements',()=>{
 const settings={...config,coverageConfirmed:true,sourceId:A.source.id},draft={...profile,laundersUniform:true},read=(p=draft,c=settings)=>A.hourlyRates({config:c,profile:p,date:'2026-10-05',preview:true});
 const casual=read(),full=read({...draft,employmentType:'full-time'}),part=read({...draft,employmentType:'part-time',pattern:undefined,agreedWeeklyMinutes:null});assert.equal(casual.rates.weekdayCents,3476);assert.equal(full.rates.weekdayCents,2781);assert.equal(part.rates.weekdayCents,2781);assert(part.setupIssues.length);assert.equal(part.preview,true);
 assert.deepEqual(casual.allowanceEstimates,[{label:'Uniform laundry',amountCents:128,unit:'shift'}]);assert.deepEqual(full.allowanceEstimates,[{label:'Uniform laundry',amountCents:642,unit:'week'}]);
 for(const changes of [{employmentType:''},{classification:''},{classification:'3',level3Band:null},{dateOfBirth:''},{dateOfBirth:'2030-01-01'},{arrangement:'needs-review'},{payBasis:'base-plus-penalties',baseRateCents:100},{payBasis:'base-plus-penalties',baseRateCents:100000001}])assert.equal(read({...draft,...changes}).rates,null);
 assert.equal(read(draft,{...settings,localPayEnabled:false}).rates,null);assert.equal(read(draft,{...settings,sourceId:'unsupported-edition'}).rates,null);
});


test('saved ordinary hourly rates remain available without regular working hours while complete part-time costs remain blocked',()=>{
 const employee={...profile,employmentType:'part-time',agreedWeeklyMinutes:null,agreementReference:''},settings={...config,coverageConfirmed:true,sourceId:A.source.id},rates=A.hourlyRates({config:settings,profile:employee,date:'2026-10-05'});
 assert.equal(rates.ready,true);assert.equal(rates.rates.weekdayCents,2781);assert(rates.setupIssues.some(i=>i.code==='employment-pattern'));assert.equal(rates.issues.length,0);
 const work=shift('2026-10-05','09:00','12:00'),unpriced=price([work],[employee])[0];assert.equal(unpriced.complete,false);assert.equal(unpriced.costCents,null);assert(unpriced.issues.some(i=>i.blocking&&i.code==='pay-pattern'));
 const agreed={...employee,agreedWeeklyMinutes:180,agreementReference:'Written regular hours agreement',pattern:[{start:'09:00',end:'12:00',overnight:false,breakMinutes:0},...Array(6).fill(null)]};
 assert.equal(price([work],[agreed])[0].costCents,8343);assert.equal(A.hourlyRates({config:settings,profile:agreed,date:'2026-10-05'}).setupIssues.length,0);
});

const workingHoursIFA={locationId:'one',employerName:'IFA test employer',reference:'Retained signed IFA 001',signedOn:'2026-10-01',startsOn:'2026-10-05',endsOn:null,terms:['work-times'],rosteredHours:true,variationSummary:'Hours follow the published agreed roster',betterOffOverall:'Signed better-off-overall assessment retained',confirmed:true};
const ifaEmployee={...profile,employmentType:'part-time',agreedWeeklyMinutes:null,flexibilityAgreements:[workingHoursIFA]},ifaConfig={...config,employerName:'IFA test employer'};
test('a current roster-hours IFA replaces fixed part-time hours while preserving exact award rates, overtime and minimum payments',()=>{
 const work=shift('2026-10-05','09:00','12:00'),read=employee=>price([work],[employee],ifaConfig)[0],rostered=read(ifaEmployee);assert.equal(rostered.complete,true);assert.equal(rostered.costCents,8343);assert.equal(rostered.ordinarySeconds,10800);assert(rostered.issues.some(i=>i.code==='pay-ifa-hours'&&!i.blocking));assert(!rostered.issues.some(i=>i.code==='pay-pattern'));
 const hourly=A.hourlyRates({config:{...ifaConfig,coverageConfirmed:true},profile:ifaEmployee,date:'2026-10-05',locationId:'one'});assert.equal(hourly.rates.weekdayCents,2781);assert.equal(hourly.setupIssues.length,0);
 const long=price([shift('2026-10-05','00:00','15:00')],[ifaEmployee],ifaConfig)[0];assert.equal(long.ordinarySeconds,39600);assert.equal(long.overtimeSeconds,14400);assert.deepEqual(long.lines.filter(l=>l.kind==='overtime').map(l=>[l.seconds,l.rateCents]),[[7200,4172],[7200,5562]]);
 const week=price(Array.from({length:6},(_,i)=>shift(M.shiftDate('2026-10-05',i),'09:00','17:00')),[ifaEmployee],ifaConfig);assert.equal(week.reduce((n,v)=>n+v.ordinarySeconds,0),38*3600);assert.equal(week[5].overtimeSeconds,8*3600);
 assert.equal(price([shift('2026-10-05','09:00','10:00')],[ifaEmployee],ifaConfig)[0].costCents,8343);
 const priorHours={...ifaEmployee,pattern:[{start:'09:00',end:'12:00',mealBreakStart:'10:00',breakMinutes:30},...Array(6).fill(null)]},later=price([shift('2026-10-05','14:00','20:00',{breakMinutes:30})],[priorHours],ifaConfig)[0];assert.equal(later.complete,true);assert(later.issues.some(i=>i.code==='pay-break-position'));assert(!later.issues.some(i=>i.code==='pay-break-invalid'));
 const actual={...shift('2026-10-05','08:00','13:00'),ordinaryWindows:[{locationId:'one',startAt:work.startAt,endAt:work.endAt}]},entry=price([actual],[ifaEmployee],ifaConfig,'timesheets')[0];assert.equal(entry.complete,true);assert.equal(entry.ordinarySeconds,10800);assert.equal(entry.overtimeSeconds,7200);assert.equal(entry.costCents,16687);
 for(const ordinaryWindows of [[],[{locationId:'two',startAt:work.startAt,endAt:work.endAt}]]){const p=price([{...actual,ordinaryWindows}],[ifaEmployee],ifaConfig,'timesheets')[0];assert.equal(p.costCents,null);assert(p.issues.some(i=>i.code==='pay-ifa-roster'&&i.blocking));}
});
test('IFA permission to use rostered hours is confined to its employer and dates, and never applies unsupported pay variations',()=>{
 const work=shift('2026-10-05','09:00','12:00'),read=(agreements,extra={})=>price([work],[{...ifaEmployee,flexibilityAgreements:agreements}],{...ifaConfig,...extra})[0];
 for(const change of [{startsOn:'2026-10-06'},{endsOn:'2026-10-04'},{locationId:'two'},{rosteredHours:false},{terms:['work-times','penalties']},{confirmed:false}])assert.equal(read([{...workingHoursIFA,...change}]).costCents,null);
 assert.equal(read([workingHoursIFA],{employerName:'Another employer'}).costCents,null);
 const ending={...workingHoursIFA,endsOn:'2026-10-05'},overnight=price([shift('2026-10-05','22:00','02:00')],[{...ifaEmployee,flexibilityAgreements:[ending]}],ifaConfig)[0];assert.equal(overnight.costCents,null);assert(overnight.issues.some(i=>i.code==='pay-pattern'&&i.blocking));
 const futureSigned={...workingHoursIFA,signedOn:'2026-10-06',startsOn:'2026-10-06'},regular={...ifaEmployee,flexibilityAgreements:[futureSigned],agreedWeeklyMinutes:180,agreementReference:'Retained regular written hours',pattern:[{start:'09:00',end:'12:00',overnight:false,breakMinutes:0},...Array(6).fill(null)]};assert.equal(A.hourlyRates({config:{...ifaConfig,coverageConfirmed:true},profile:regular,date:'2026-10-05',locationId:'one'}).ready,true);
 const pt={...regular,flexibilityAgreements:[]},noVariation=price([shift('2026-10-05','09:00','14:00')],[pt],ifaConfig)[0];assert.equal(noVariation.complete,true);assert.equal(noVariation.overtimeSeconds,7200);assert.equal(noVariation.costCents,16687);
});
