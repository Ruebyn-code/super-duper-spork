// A synthetic later edition proves the year-to-year switch without real 2027 rates.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const extra=fs.mkdtempSync(path.join(os.tmpdir(),'award-editions-'));
const current=JSON.parse(fs.readFileSync(path.join(__dirname,'award-editions','ma000003-2026-07.json'),'utf8'));
const raise=cents=>Math.round(cents*1.04);
const weeklyRates=Object.fromEntries(Object.entries(current.weeklyRates).map(([key,value])=>[key,raise(value)]));
const next={...current,id:'MA000003-2027-07-v1',label:'July 2027 (synthetic test)',effectiveFrom:'2027-07-01',reviewBy:'2028-07-01',weeklyRates,adultRates:Object.fromEntries(Object.entries(weeklyRates).map(([key,value])=>[key,Math.floor((value*100+1900)/3800)])),allowances:Object.fromEntries(Object.entries(current.allowances).map(([key,value])=>[key,raise(value)]))};
fs.writeFileSync(path.join(extra,'synthetic-2027.json'),JSON.stringify(next));
process.env.OPSTACK_TEST_AWARD_EDITIONS=extra;
const test=require('node:test'),assert=require('node:assert/strict');
const {validate}=require('./award-editions'),A=require('./fast-food-award'),planning=require('./award-roster-planning'),M=require('./public/rostering-model');
test.after(()=>fs.rmSync(extra,{recursive:true,force:true}));

const location={id:'one',publicHolidayState:'VIC'};
const config=sourceId=>({employerName:'Synthetic employer',enabled:true,localPayEnabled:true,coverageConfirmed:true,sourceId,payPeriodAnchor:'2026-06-29',payPeriodWeeks:1,holidayCalendars:[]});
const profile={userId:'u',effectiveFrom:'2026-07-01',employmentStart:'2020-01-01',dateOfBirth:'1990-01-01',employmentType:'casual',classification:'1',payBasis:'award',cycleWeeks:1};
const shift=date=>({id:date,userId:'u',locationId:'one',startAt:M.instant(date,'09:00'),endAt:M.instant(date,'12:00'),breakMinutes:0});
const price=(settings,date)=>{const item=shift(date);return A.calculate({config:planning.configFor(settings,[location],[item]),profiles:[profile],items:[item],mode:'timesheets'}).results[0];};

test('edition files are validated before the calculator can use them',()=>{
 assert.equal(validate(current,'current').id,current.id);
 for(const [change,reason] of [[{adultRates:{...current.adultRates,'1':current.adultRates['1']+1}},'adult'],[{allowances:{...current.allowances,meal:0}},'meal'],[{reviewBy:current.effectiveFrom},'reviewBy'],[{code:'MA000009'},'MA000003'],[{sha256:'x'},'SHA-256'],[{id:'2027'},'id']])
  assert.throws(()=>validate({...current,...change},'bad'),new RegExp(reason),JSON.stringify(change));
 assert.deepEqual(A.editions.map(e=>e.id),[current.id,next.id]);assert.equal(A.source.id,next.id);
});

test('each edition starts at the first full pay period on or after its effective date',()=>{
 const old=config(current.id);
 assert.equal(A.editionFor(old,'2027-07-02').edition.id,current.id,'1 July 2027 is a Thursday, so that weekly pay period keeps the old rates');
 assert.equal(A.editionFor(old,'2027-07-02').expired,false,'an older edition never expires while a newer one exists');
 assert.equal(A.editionFor(old,'2027-07-05').edition.id,next.id);
 assert.equal(A.editionFor(old,'2027-07-05').activationNeeded,true);assert.equal(A.editionFor(config(next.id),'2027-07-05').activationNeeded,false);
 assert.equal(A.editionFor(config(next.id),'2028-07-10').expired,true);
 assert.equal(A.editionReady(old,'2026-10-05','2027-07-02'),true);assert.equal(A.editionReady(old,'2027-07-05'),false);assert.equal(A.editionReady(config(next.id),'2027-07-05'),true);
 assert.equal(A.editionReady(config('unknown-edition'),'2026-10-05'),false);
});

test('new rates cost only activated later periods; earlier periods keep their original rates',()=>{
 const before=price(config(next.id),'2027-06-29'),beforeOld=price(config(current.id),'2027-06-29');
 assert.equal(before.complete,true);assert.equal(before.versionId,current.id);assert.equal(before.costCents,beforeOld.costCents,'activating new rates never reprices earlier work');
 const pending=price(config(current.id),'2027-07-06');assert.equal(pending.complete,false);assert.equal(pending.costCents,null);assert(pending.issues.some(i=>i.code==='pay-source-activation'&&/July 2027/.test(i.message)));
 const after=price(config(next.id),'2027-07-06');assert.equal(after.complete,true,JSON.stringify(after.issues));assert.equal(after.versionId,next.id);assert(after.costCents>before.costCents);
 const rates=A.hourlyRates({config:config(next.id),profile,date:'2027-07-06',locationId:'one'});assert.equal(rates.source.id,next.id);assert.equal(rates.rates.minimumBaseCents,next.adultRates['1']);
 const oldRates=A.hourlyRates({config:config(next.id),profile,date:'2027-06-29',locationId:'one'});assert.equal(oldRates.rates.minimumBaseCents,current.adultRates['1']);
 assert(A.hourlyRates({config:config(current.id),profile,date:'2027-07-06',locationId:'one'}).issues.some(i=>i.code==='award-source'));
 const expired=price(config(next.id),'2028-07-11');assert.equal(expired.complete,false);assert(expired.issues.some(i=>i.code==='pay-source-review'));
});
