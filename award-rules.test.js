const test=require('node:test'),assert=require('node:assert/strict'),rules=require('./award-rules'),M=require('./public/rostering-model');
// Deliberately fictional values exercise the evaluator; they are not award rates or legal thresholds.
const rule=(kind,value,extra={})=>({kind,value,clause:'Test reference only',employmentType:'all',classification:'all',minAge:0,maxAge:120,...extra});
const pack=(extra={})=>rules.pack({schemaVersion:1,awardCode:'MA000003',label:'Fictional test rules',sourceUrl:'https://awards.fairwork.gov.au/MA000003.html',effectiveFrom:'2026-01-01',effectiveTo:'2026-12-31',rules:[rule('minimum-engagement',120)],...extra});
const profile={userId:'alice',effectiveFrom:'2026-01-01',dateOfBirth:'2008-10-20',employmentStart:'2026-01-01',employmentType:'casual',classification:'1',agreedWeeklyMinutes:null};
function item(id,date,start,end,extra={}){return{id,userId:'alice',locationId:'one',...M.interval({date,start,end,overnight:end<=start,breakMinutes:0}),breakMinutes:0,rateCents:2000,...extra};}
function evaluate(items,extra={}){return rules.evaluate({company:{enabled:true},items,profiles:[profile],versions:[{...pack(),id:'v1',reviewedAt:'2026-10-01T00:00:00Z'}],locationId:'one',weekStart:'2026-10-19',...extra});}
test('award rule sets validate dates, referenced values and bands without supplying legal defaults',()=>{
 assert.equal(pack().rules.length,1);
 for(const input of [null,{}, {awardCode:'other'}, {schemaVersion:1,awardCode:'MA000003'}])assert.throws(()=>rules.pack(input));
 for(const change of [{rules:[]},{sourceUrl:'http://example.com'},{sourceUrl:'https://secret:password@example.com'},{effectiveTo:'2025-12-31'},{rules:[rule('unknown',10)]},{rules:[rule('minimum-rate',-1)]},{rules:[rule('daily-hours',4.2)]},{rules:[rule('minimum-rate',2500,{minAge:25,maxAge:18})]},{rules:[rule('unpaid-break',30)]}])assert.throws(()=>pack(change));
 assert.equal(pack({rules:[rule('unpaid-break',30,{afterMinutes:300})]}).rules[0].afterMinutes,300);
});
test('award employee profiles require valid employment details and effective dates; age changes on the birthday',()=>{
 const value=rules.profile(profile,'2026-10-19');assert.equal(value.employmentType,'casual');assert.equal(rules.age(value.dateOfBirth,'2026-10-19'),17);assert.equal(rules.age(value.dateOfBirth,'2026-10-20'),18);
 for(const change of [{dateOfBirth:'2027-01-01'},{classification:'admin'},{employmentType:'contractor'},{employmentStart:'2000-01-01'},{employmentType:'part-time',agreedWeeklyMinutes:0}])assert.throws(()=>rules.profile({...profile,...change},'2026-10-19'));
 assert.equal(rules.profile({...profile,employmentType:'part-time',agreedWeeklyMinutes:1200},'2026-10-19').agreedWeeklyMinutes,1200);
});
test('award checks remain disabled by default; missing, draft, future and expired rules never produce a clear result',()=>{
 const items=[item('a','2026-10-19','09:00','10:00')];assert.equal(evaluate(items,{company:{enabled:false}}).enabled,false);
 for(const versions of [[],[{...pack(),id:'draft'}],[{...pack({effectiveFrom:'2026-11-01'}),id:'future',reviewedAt:'2026-10-01'}],[{...pack({effectiveTo:'2026-10-18'}),id:'expired',reviewedAt:'2026-10-01'}]])assert.equal(evaluate(items,{versions}).issues[0].code,'no-rules');
 assert.equal(evaluate([],{versions:[]}).reviewRequired,true);
 const versions=[{...pack(),id:'old',reviewedAt:'2026-01-01'},{...pack({effectiveFrom:'2026-10-01',effectiveTo:'2026-10-18'}),id:'new-expired',reviewedAt:'2026-10-01'}];assert.equal(evaluate(items,{versions}).issues[0].code,'no-rules','Do not fall back to an older overlapping version after the latest one expires');
});
test('minimum engagement, missing profiles and unassigned shifts are checked; only matching configured checks are clear',()=>{
 const short=item('a','2026-10-19','09:00','10:00');assert.equal(evaluate([short]).issues[0].code,'minimum-engagement');assert.equal(evaluate([short],{profiles:[]}).issues[0].code,'no-profile');assert.equal(evaluate([{...short,userId:null}]).issues[0].code,'unassigned');
 const clear=evaluate([item('a','2026-10-19','09:00','12:00')]);assert.equal(clear.status,'configured-checks-clear');assert.ok(clear.exclusions.includes('Penalty and overtime pay'));
 const other={...short,id:'b',userId:'bob'},versions=[{...pack({rules:[rule('minimum-engagement',30,{maxAge:17})]}),id:'v',reviewedAt:'2026-01-01'}],profiles=[profile,{...profile,userId:'bob',dateOfBirth:'1990-01-01'}];assert.ok(evaluate([short,other],{versions,profiles}).issues.some(issue=>issue.subjectId==='b'&&issue.code==='no-matching-rules'));
});
test('minimum base rate bands use the employee age on each shift date, with no penalty-pay claim',()=>{
 const versions=[{...pack({rules:[rule('minimum-rate',1500,{maxAge:17}),rule('minimum-rate',2500,{minAge:18})]}),id:'v',reviewedAt:'2026-01-01'}],result=evaluate([item('a','2026-10-19','09:00','12:00'),item('b','2026-10-20','09:00','12:00')],{versions});assert.equal(result.issues.length,1);assert.equal(result.issues[0].subjectId,'b');assert.match(result.issues[0].message,/Penalties and overtime pay are not included/);
 assert.match(evaluate([item('b','2026-10-20','09:00','12:00',{rateCents:null})],{versions}).issues[0].message,/No hourly rate/);
});
test('daily, weekly, rest, break and part-time checks combine company locations without exposing other location entries',()=>{
 const versions=[{...pack({rules:[rule('daily-hours',300),rule('weekly-hours',400),rule('minimum-rest',900),rule('unpaid-break',25,{afterMinutes:180})]}),id:'v',reviewedAt:'2026-01-01'}],items=[item('a','2026-10-19','09:00','13:00'),item('b','2026-10-19','15:00','19:00',{locationId:'two'}),item('c','2026-10-20','08:00','12:00')],result=evaluate(items,{versions,profiles:[{...profile,employmentType:'part-time',agreedWeeklyMinutes:300}]});
 for(const code of ['daily-hours','weekly-hours','minimum-rest','unpaid-break','part-time-hours'])assert.ok(result.issues.some(i=>i.code===code),code);
 assert.ok(result.issues.every(i=>i.subjectId!=='b'),'Return local subjects while using employer-wide totals');assert.ok(evaluate(items,{versions,subjectId:'c'}).issues.every(i=>i.subjectId==='c'));
});
test('overnight weeks and Melbourne DST use elapsed time and flag allocation for review',()=>{
 const overnight=item('s','2026-10-25','22:00','02:00'),result=evaluate([overnight]);assert.ok(result.issues.some(i=>i.code==='week-boundary'));
 const version={...pack({rules:[rule('minimum-engagement',450)]}),id:'v',reviewedAt:'2026-01-01'},spring=item('d','2026-10-03','22:00','06:00');assert.equal(spring.paidSeconds,7*3600);assert.ok(evaluate([spring],{versions:[version],weekStart:'2026-09-28'}).issues.some(i=>i.code==='minimum-engagement'));
});
test('pending rule updates and shifts outside the selected week cannot silently produce a clear review',()=>{
 const current={...pack({rules:[rule('minimum-rest',600)]}),id:'reviewed',reviewedAt:'2026-01-01'},draft={...pack({effectiveFrom:'2026-10-19'}),id:'draft'},sunday=item('sun','2026-10-25','18:00','23:00'),monday=item('mon','2026-10-26','07:00','12:00');
 const result=evaluate([sunday,monday],{versions:[current,draft]});assert.ok(result.issues.some(i=>i.code==='unreviewed-update'));assert.ok(result.issues.some(i=>i.subjectId==='sun'&&i.code==='minimum-rest'));assert.ok(result.issues.every(i=>i.subjectId!=='mon'));assert.equal(evaluate([],{versions:[current]}).status,'no-items');
});


test('regular working hours can be omitted from staff setup but supplied agreements stay strictly validated',()=>{
 const terms={...profile,employmentType:'part-time',payBasis:'award',agreedWeeklyMinutes:null},saved=rules.profile(terms,'2026-10-19');
 assert.equal(saved.agreedWeeklyMinutes,null);assert.equal(saved.pattern,undefined);assert.equal(saved.agreementReference,undefined);
 const hours=[{start:'09:00',end:'12:00',overnight:false,breakMinutes:0},...Array(6).fill(null)],complete={...terms,pattern:hours,agreedWeeklyMinutes:180,agreementReference:'Written regular hours agreement'};
 assert.equal(rules.profile(complete,'2026-10-19').pattern[0].start,'09:00');
 for(const change of [{pattern:[]},{pattern:null},{pattern:Array(7).fill(null)},{agreedWeeklyMinutes:0},{agreedWeeklyMinutes:120},{agreementReference:''},{agreementReference:'short'},{pattern:[{...hours[0],end:'10:00'},...Array(6).fill(null)],agreedWeeklyMinutes:60},{pattern:[{...hours[0],breakMinutes:30},...Array(6).fill(null)],agreedWeeklyMinutes:150}])assert.throws(()=>rules.profile({...complete,...change},'2026-10-19'));
 const checked=evaluate([item('pt','2026-10-19','09:00','12:00')],{profiles:[{...saved,userId:profile.userId}]});assert(checked.issues.some(i=>i.code==='part-time-hours-missing'));assert(!checked.issues.some(i=>i.code==='part-time-hours'));
});
