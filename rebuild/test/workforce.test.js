// Phase 5 gate tests: a published week costs exactly what the shared award
// calculator says for the same inputs, and published costs and approved pay
// snapshots stay frozen after later rate changes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createWorkforce}=require('../workforce');
const {seed}=require('../seed');
const award=require('../../fast-food-award');
const M=require('../../public/rostering-model');

const password='harbour-demo-passphrase';
const rejects=async(promise,status,message)=>assert.rejects(promise,error=>{
 assert.equal(error.status,status,`expected ${status}, got ${error.status}: ${error.message}`);
 if(message)assert.match(error.message,message);
 return true;
});

// The employer save stores a reviewed calendar; the calculator needs the
// calendar year of the shifts to match.
const weekStart=()=>M.monday(M.today(Date.now()));
const shiftDay=(index)=>M.shiftDate(weekStart(),index);

async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-workforce-'));
 const store=createStore(dir);
 let clock=Date.parse(M.instant(shiftDay(1),'08:00'));
 const workforce=createWorkforce({store,now:()=>clock});
 const data=await seed(store,{password});
 const actor=data.accounts.find(account=>account.email==='admin@harbour.test');
 const staff=data.accounts.find(account=>account.email==='manager@harbour.test');
 const company=data.companies.find(entry=>entry.name==='Harbour Group');
 const location=data.locations.find(entry=>entry.name==='Harbour Street');
 await workforce.saveEmployer(actor,{companyId:company.id,locationId:location.id,employerName:'Harbour Group Pty Ltd',payPeriodAnchor:weekStart(),payPeriodWeeks:1,superBps:1200,oncostBps:0});
 await workforce.saveProfile(actor,{companyId:company.id,locationId:location.id,accountId:staff.id,effectiveFrom:'2026-01-01',dateOfBirth:'2000-05-01',employmentStart:'2026-01-01',employmentType:'full-time',classification:'1',payBasis:'award',cycleWeeks:1});
 return {dir,store,workforce,actor,staff,company,location,setClock:value=>{clock=value;}};
}

test('a published week costs the same as the shared award calculator for identical inputs',async()=>{
 const app=await fixture();
 await app.workforce.saveShift(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:app.staff.id,date:shiftDay(1),start:'09:00',end:'17:00',position:'Counter'});
 await app.workforce.saveShift(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:app.staff.id,date:shiftDay(4),start:'10:00',end:'18:00',position:'Counter'});
 const publication=await app.workforce.publish(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:weekStart()});
 assert.ok(publication.totalCents>0);

 // Recompute from the frozen inputs with the current app's calculator.
 const items=publication.shifts.map(shift=>({id:shift.id,userId:shift.accountId,locationId:app.location.id,startAt:shift.startAt,endAt:shift.endAt,breakPlan:shift.breakPlan,breakMinutes:shift.breakMinutes,breaks:[]}));
 const independent=award.calculate({config:publication.employer,profiles:publication.profiles,items,mode:'roster'});
 const expected=independent.results.reduce((sum,result)=>sum+result.costCents,0);
 assert.equal(publication.totalCents,expected);
 assert.equal(publication.costSnapshot.length,2);
});

test('a published cost and an approved pay snapshot stay frozen after a rate change',async()=>{
 const app=await fixture();
 await app.workforce.saveShift(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:app.staff.id,date:shiftDay(1),start:'09:00',end:'17:00'});
 const publication=await app.workforce.publish(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:weekStart()});
 const frozenTotal=publication.totalCents;

 // A higher super estimate changes what a new calculation would cost.
 await app.workforce.saveEmployer(app.actor,{companyId:app.company.id,locationId:app.location.id,employerName:'Harbour Group Pty Ltd',payPeriodAnchor:weekStart(),payPeriodWeeks:1,superBps:1500});
 const stored=(await app.store.read('publications')).find(record=>record.id===publication.id);
 assert.equal(stored.totalCents,frozenTotal);
 assert.equal(stored.employer.superBps,1200);

 // Clock a real day, approve it, then re-approve after another rate change.
 app.setClock(Date.parse(M.instant(shiftDay(2),'09:00')));
 await app.workforce.clock(app.staff,{companyId:app.company.id,locationId:app.location.id,kind:'in'});
 app.setClock(Date.parse(M.instant(shiftDay(2),'12:00')));
 await app.workforce.clock(app.staff,{companyId:app.company.id,locationId:app.location.id,kind:'break-start'});
 app.setClock(Date.parse(M.instant(shiftDay(2),'12:30')));
 await app.workforce.clock(app.staff,{companyId:app.company.id,locationId:app.location.id,kind:'break-end'});
 app.setClock(Date.parse(M.instant(shiftDay(2),'17:00')));
 await app.workforce.clock(app.staff,{companyId:app.company.id,locationId:app.location.id,kind:'out'});

 const approved=await app.workforce.approve(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:weekStart()});
 assert.equal(approved.created,true);
 assert.ok(approved.timesheet.costCents>0);
 assert.equal(approved.timesheet.snapshot.sourceId,award.source.id);

 await app.workforce.saveProfile(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:app.staff.id,effectiveFrom:'2026-01-01',dateOfBirth:'2000-05-01',employmentStart:'2026-01-01',employmentType:'full-time',classification:'2',payBasis:'award',cycleWeeks:1});
 const again=await app.workforce.approve(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:weekStart()});
 assert.equal(again.created,false);
 assert.equal(again.timesheet.costCents,approved.timesheet.costCents);
});

test('overlapping shifts are refused and a published week must be withdrawn before editing',async()=>{
 const app=await fixture();
 const first=await app.workforce.saveShift(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:app.staff.id,date:shiftDay(1),start:'09:00',end:'17:00'});
 await rejects(app.workforce.saveShift(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:app.staff.id,date:shiftDay(1),start:'16:00',end:'20:00'}),409,/overlapping/);
 const publication=await app.workforce.publish(app.actor,{companyId:app.company.id,locationId:app.location.id,weekStart:weekStart()});
 await rejects(app.workforce.saveShift(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:app.staff.id,shiftId:first.id,date:shiftDay(1),start:'10:00',end:'17:00'}),409,/published week/);
 await app.workforce.unpublish(app.actor,{publicationId:publication.id});
 const edited=await app.workforce.saveShift(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:app.staff.id,shiftId:first.id,date:shiftDay(1),start:'10:00',end:'17:00'});
 assert.equal(edited.start,'10:00');
});

test('publishing without a reviewed calendar is refused rather than guessed',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-workforce-'));
 const store=createStore(dir);
 const workforce=createWorkforce({store});
 // The seeded employer setup would turn native calculations on, so this case
 // seeds accounts only: no employer at all.
 const data=await seed(store,{password,business:false});
 const actor=data.accounts.find(account=>account.email==='admin@harbour.test');
 const company=data.companies.find(entry=>entry.name==='Harbour Group');
 const location=data.locations.find(entry=>entry.name==='Harbour Street');
 const staff=data.accounts.find(account=>account.email==='manager@harbour.test');
 // No employer setup at all: native calculations are off.
 await workforce.saveProfile(actor,{companyId:company.id,locationId:location.id,accountId:staff.id,effectiveFrom:'2026-01-01',dateOfBirth:'2000-05-01',employmentStart:'2026-01-01',employmentType:'full-time',classification:'1',payBasis:'award',cycleWeeks:1});
 await workforce.saveShift(actor,{companyId:company.id,locationId:location.id,accountId:staff.id,date:shiftDay(1),start:'09:00',end:'17:00'});
 await rejects(workforce.publish(actor,{companyId:company.id,locationId:location.id,weekStart:weekStart()}),409,/Enable native award calculations/);
});

test('a staff account cannot publish a roster or read pay',async()=>{
 const app=await fixture();
 const {defaults}=require('../permissions');
 const staffAccount={id:'staff-account',name:'Ari Staff',email:'ari@harbour.test',role:'user',
  permissions:[...defaults.find(item=>item.id==='user').permissions],actionPermissions:{},
  companyIds:[app.company.id],locationIds:[app.location.id],version:'v1'};
 await app.store.change('accounts',list=>{list.push(staffAccount);});
 await app.workforce.saveProfile(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:staffAccount.id,effectiveFrom:'2026-01-01',dateOfBirth:'2001-02-02',employmentStart:'2026-01-01',employmentType:'full-time',classification:'1',payBasis:'award',cycleWeeks:1});
 await app.workforce.saveShift(app.actor,{companyId:app.company.id,locationId:app.location.id,accountId:staffAccount.id,date:shiftDay(1),start:'09:00',end:'17:00'});
 await rejects(app.workforce.publish(staffAccount,{companyId:app.company.id,locationId:app.location.id,weekStart:weekStart()}),403,/permission/);
 await rejects(app.workforce.payHistory(staffAccount,{companyId:app.company.id,locationId:app.location.id}),403,/permission to view pay/);
});
