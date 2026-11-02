// Workforce for the rebuilt app: employment terms, the roster builder, its
// publication, the clock, timesheets, availability and leave.
//
// No pay rule is re-expressed here. A published week and an approved timesheet
// are both costed by `../fast-food-award.calculate()` — the current app's own
// MA000003 calculator — with the employer config, dated employment profiles
// and shift items assembled in the same shapes it already consumes. Planned
// breaks come from `../award-break-plan.build()`. A publication and an
// approval each freeze their calculator output, so a later rate or super change
// cannot rewrite a cost somebody already relied on.
const crypto=require('node:crypto');
const access=require('./access');
const permissions=require('./permissions');
const award=require('../fast-food-award');
const awardRules=require('../award-rules');
const breakPlanner=require('../award-break-plan');
const publicHolidays=require('../australian-public-holidays');
const M=require('../public/rostering-model');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max=200)=>String(value??'').trim().slice(0,max);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const monday=date=>M.monday(date);
const shiftDate=(date,days)=>M.shiftDate(date,days);
const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const sumCents=values=>values.every(value=>Number.isInteger(value))?values.reduce((sum,value)=>sum+value,0):null;

function createWorkforce({store,now=Date.now}){
 const stamp=()=>new Date(now()).toISOString();
 const today=()=>M.today(now());

 async function companyAndLocation(actor,input,permission,mode='write'){
  const guard=mode==='read'?access.read:access.write;
  return guard({store,account:actor,permission,companyId:input?.companyId,locationId:input?.locationId});
 }

 // ---------------------------------------------------------------- employment
 async function saveEmployer(actor,input){
  const {company,location}=await companyAndLocation(actor,input,'awards.manage');
  const coverageConfirmed=input?.coverageConfirmed!==false;
  const enabled=input?.enabled!==false;
  const localPayEnabled=coverageConfirmed&&enabled;
  const anchor=input?.payPeriodAnchor&&validDate(input.payPeriodAnchor)?input.payPeriodAnchor:monday(today());
  if(monday(anchor)!==anchor)fail('The pay-period anchor must be a Monday.');
  const payPeriodWeeks=[1,2].includes(Number(input?.payPeriodWeeks))?Number(input.payPeriodWeeks):1;
  const superBps=input?.superBps==null||input.superBps===''?1200:Number(input.superBps);
  const oncostBps=input?.oncostBps==null||input.oncostBps===''?0:Number(input.oncostBps);
  if(!Number.isInteger(superBps)||superBps<0||superBps>10000)fail('Enter a super estimate from 0% to 100%.');
  if(!Number.isInteger(oncostBps)||oncostBps<0||oncostBps>10000)fail('Enter an on-cost estimate from 0% to 100%.');
  // A reviewed calendar is what lets a cost be approved; it is created only by
  // this explicit employer save, never by a read. The state is the location's
  // own public-holiday setting and is chosen here when it is not set yet.
  const requested=input?.publicHolidayState||location.publicHolidayState;
  if(input?.publicHolidayState!==undefined&&!publicHolidays.validState(input.publicHolidayState))fail('Choose an Australian state or territory for public holidays.');
  const state=publicHolidays.validState(requested)?requested:null;
  const years=[Number(today().slice(0,4)),Number(today().slice(0,4))+1];
  const holidayCalendars=coverageConfirmed&&state?years.map(year=>({...publicHolidays.resolve(null,location.id,year,{state}),confirmed:true,reviewedAt:stamp(),reviewedById:actor.id})):[];
  if(input?.publicHolidayState!==undefined)await store.change('locations',list=>{
   const record=list.find(item=>item.id===location.id);
   record.publicHolidayState=input.publicHolidayState;
  });
  return store.change('employer',list=>{
   const existing=list.find(record=>record.locationId===location.id);
   const record={
    id:existing?.id||crypto.randomUUID(),companyId:company.id,locationId:location.id,locationName:location.name,
    enabled,coverageConfirmed,localPayEnabled,sourceId:award.source.id,
    employerName:text(input?.employerName,200)||company.name,
    payPeriodAnchor:anchor,payPeriodWeeks,superBps,oncostBps,holidayCalendars,
    payCondition:state?'reviewed':'missing-state',
    updatedAt:stamp(),updatedById:actor.id
   };
   if(existing)Object.assign(existing,record);else list.push(record);
   return record;
  });
 }

 async function employerFor(company,location){
  const saved=(await store.read('employer')).find(record=>record.locationId===location.id);
  return saved||{
   companyId:company.id,locationId:location.id,locationName:location.name,
   enabled:false,coverageConfirmed:false,localPayEnabled:false,sourceId:award.source.id,
   employerName:company.name,payPeriodAnchor:monday(today()),payPeriodWeeks:1,superBps:1200,oncostBps:0,holidayCalendars:[]
  };
 }

 async function saveProfile(actor,input){
  const {company}=await companyAndLocation(actor,input,'awards.manage');
  const accounts=await store.read('accounts');
  const account=accounts.find(candidate=>candidate.id===input?.accountId);
  if(!account||!permissions.accessibleCompanies(account,[company]).length)fail('Choose a user in this company.',404);
  const effectiveFrom=input?.effectiveFrom;
  if(!validDate(effectiveFrom))fail('Choose the date these employment terms start.');
  let profile;
  try{
   profile=awardRules.profile({...input,payBasis:input?.payBasis||'award',cycleWeeks:input?.cycleWeeks??1},today());
  }catch(error){fail(error.message);}
  if(!profile.payBasis)profile.payBasis='award';
  return store.change('employees',list=>{
   const existing=list.find(record=>record.accountId===account.id&&record.companyId===company.id&&record.effectiveFrom===effectiveFrom);
   const record={...profile,id:existing?.id||crypto.randomUUID(),companyId:company.id,accountId:account.id,name:account.name,updatedAt:stamp(),updatedById:actor.id};
   if(existing)Object.assign(existing,record);else list.push(record);
   return record;
  });
 }

 async function profilesFor(companyId,accountIds){
  const all=(await store.read('employees')).filter(record=>record.companyId===companyId&&(!accountIds||accountIds.includes(record.accountId)));
  return all.map(record=>({...record,userId:record.accountId})).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom));
 }

 async function workforce(actor,input){
  const {company,location}=await companyAndLocation(actor,input,'rostering.view','read');
  const [accounts,profiles,employer]=await Promise.all([store.read('accounts'),profilesFor(company.id),employerFor(company,location)]);
  const members=accounts.filter(account=>permissions.companyIds(account).includes(company.id)&&permissions.locationIds(account).includes(location.id));
  return {
   company,location,employer,
   people:members.map(account=>{
    const terms=profiles.find(profile=>profile.accountId===account.id&&profile.effectiveFrom<=today())||null;
    return {id:account.id,name:account.name,email:account.email,terms:terms?{employmentType:terms.employmentType,classification:terms.classification,payBasis:terms.payBasis,effectiveFrom:terms.effectiveFrom}:null};
   })
  };
 }

 // ------------------------------------------------------------------- roster
 function planFor(shift,profile,employer){
  const plan=breakPlanner.build({shift,profile,employerName:employer.employerName});
  return plan;
 }

 async function saveShift(actor,input){
  const {company,location}=await companyAndLocation(actor,input,'rostering.manage');
  const accounts=await store.read('accounts');
  const account=accounts.find(candidate=>candidate.id===input?.accountId);
  if(!account||!permissions.locationIds(account).includes(location.id))fail('Choose a staff member assigned to this location.',404);
  const date=input?.date;
  if(!validDate(date))fail('Choose the shift date.');
  if(!validTime(input?.start)||!validTime(input?.end))fail('Enter the shift start and finish as 24-hour times.');
  const overnight=input?.overnight===true||input?.overnight==='1';
  if(input.start===input.end&&!overnight)fail('A shift needs a start and a different finish.');
  const employer=await employerFor(company,location);
  const profiles=await profilesFor(company.id,[account.id]);
  const profile=profiles.find(record=>record.effectiveFrom<=date)||null;
  if(!profile)fail('Record employment terms for '+account.name+' before rostering them.');
  let interval;
  try{interval=M.interval({date,start:input.start,end:input.end,overnight,breakMinutes:0});}catch{fail('Check the shift times.');}
  if(Date.parse(interval.endAt)-Date.parse(interval.startAt)>24*3600000)fail('A single shift cannot run longer than 24 hours.');
  const plan=planFor({date,start:input.start,end:input.end,overnight,locationId:location.id},profile,employer);
  if(plan.status!=='ready'||plan.issues.length)fail('The planned breaks need review: '+plan.issues.map(issue=>issue.message).join(' '),409);
  const at=stamp();
  return store.change('shifts',list=>{
   const wanted=input?.shiftId;
   const existing=wanted?list.find(record=>record.id===wanted&&record.locationId===location.id):null;
   if(wanted&&!existing)fail('Shift not found.',404);
   if(existing?.publicationId)fail('That shift is in a published week. Unpublish the week before editing it.',409);
   const clash=list.find(record=>record.id!==existing?.id&&record.accountId===account.id&&record.status!=='cancelled'&&
    Date.parse(record.startAt)<Date.parse(interval.endAt)&&Date.parse(interval.startAt)<Date.parse(record.endAt));
   if(clash)fail(account.name+' already has a shift overlapping those times.',409);
   const record={
    id:existing?.id||crypto.randomUUID(),companyId:company.id,locationId:location.id,
    accountId:account.id,name:account.name,date,start:input.start,end:input.end,overnight,
    startAt:interval.startAt,endAt:interval.endAt,position:text(input?.position,60),note:text(input?.note,500),
    breakPlan:plan,breakMinutes:plan.unpaidMinutes,status:'draft',publicationId:null,publishedAt:null,
    createdAt:existing?.createdAt||at,updatedAt:at,updatedById:actor.id
   };
   if(existing)Object.assign(existing,record);else list.push(record);
   return record;
  });
 }

 async function deleteShift(actor,shiftId){
  const shift=(await store.read('shifts')).find(record=>record.id===shiftId);
  if(!shift)fail('Shift not found.',404);
  await companyAndLocation(actor,shift,'rostering.manage');
  if(shift.publicationId)fail('That shift is in a published week. Unpublish the week first.',409);
  await store.change('shifts',list=>{
   const record=list.find(item=>item.id===shiftId);
   record.status='cancelled';
   record.cancelledAt=stamp();
  });
  return {id:shiftId};
 }

 function itemsFor(shifts){
  return shifts.map(shift=>({
   id:shift.id,userId:shift.accountId,locationId:shift.locationId,startAt:shift.startAt,endAt:shift.endAt,
   breakPlan:shift.breakPlan,breakMinutes:shift.breakMinutes,breaks:shift.breaks||[]
  }));
 }

 function cost(items,profiles,employer,mode){
  if(!employer.localPayEnabled)fail('Enable native award calculations in the employer setup first.',409);
  return award.calculate({config:employer,profiles,items,mode});
 }

 async function publish(actor,input){
  const {company,location}=await companyAndLocation(actor,input,'rostering.manage');
  if(!permissions.can(actor,'rostering.publish'))throw permissions.deny('You do not have permission to publish rosters.');
  const weekStart=input?.weekStart;
  if(!validDate(weekStart)||monday(weekStart)!==weekStart)fail('Choose a valid Monday-starting roster week.');
  const [shifts,employer]=await Promise.all([store.read('shifts'),employerFor(company,location)]);
  const week=shifts.filter(shift=>shift.locationId===location.id&&shift.status==='draft'&&!shift.publicationId&&shift.date>=weekStart&&shift.date<=shiftDate(weekStart,6));
  if(!week.length)fail('There are no draft shifts in that week to publish.');
  const profiles=await profilesFor(company.id,[...new Set(week.map(shift=>shift.accountId))]);
  const costed=cost(itemsFor(week),profiles,employer,'roster');
  const blocked=costed.results.find(result=>!result.complete);
  if(blocked)fail('The week cannot be costed yet: '+(blocked.issues[0]?.message||'complete employment terms first.'),409);
  const totalCents=sumCents(costed.results.map(result=>result.costCents));
  if(totalCents===null)fail('The week cannot be costed completely. Review the highlighted shifts.',409);
  const at=stamp();
  const snapshot=costed.results.map(result=>({
   shiftId:result.subjectId,accountId:result.userId,costCents:result.costCents,wageCents:result.wageCents,
   superEstimateCents:result.superEstimateCents,annualLeaveEstimateCents:result.annualLeaveEstimateCents,
   paidSeconds:result.paidSeconds,lines:result.lines,fingerprint:result.fingerprint,benefits:result.benefits
  }));
  return store.changeMany(['shifts','publications'],data=>{
   const record={
    id:crypto.randomUUID(),companyId:company.id,locationId:location.id,weekStart,
    shifts:week.map(shift=>({id:shift.id,accountId:shift.accountId,name:shift.name,date:shift.date,start:shift.start,end:shift.end,overnight:shift.overnight,startAt:shift.startAt,endAt:shift.endAt,position:shift.position,breakPlan:shift.breakPlan,breakMinutes:shift.breakMinutes})),
    costSnapshot:snapshot,totalCents,employer:{...employer},profiles,
    publishedById:actor.id,publishedByName:actor.name,publishedAt:at,status:'published',revision:1
   };
   data.publications.push(record);
   for(const shift of data.shifts){
    const line=week.find(item=>item.id===shift.id);
    if(!line)continue;
    shift.publicationId=record.id;
    shift.publishedAt=at;
   }
   return record;
  });
 }

 async function unpublish(actor,input){
  const publication=(await store.read('publications')).find(record=>record.id===input?.publicationId);
  if(!publication)fail('Publication not found.',404);
  await companyAndLocation(actor,publication,'rostering.manage');
  if(!permissions.can(actor,'rostering.publish'))throw permissions.deny('You do not have permission to unpublish rosters.');
  return store.changeMany(['shifts','publications'],data=>{
   const record=data.publications.find(item=>item.id===publication.id);
   if(record.status!=='published')fail('That week is not published.',409);
   record.status='withdrawn';
   record.withdrawnAt=stamp();
   record.withdrawnById=actor.id;
   for(const shift of data.shifts)if(shift.publicationId===record.id){shift.publicationId=null;shift.publishedAt=null;}
   return record;
  });
 }

 async function week(actor,input){
  const {company,location}=await companyAndLocation(actor,input,'rostering.view','read');
  const weekStart=input?.weekStart&&validDate(input.weekStart)?monday(input.weekStart):monday(today());
  const [shifts,publications,employer]=await Promise.all([store.read('shifts'),store.read('publications'),employerFor(company,location)]);
  const manager=permissions.can(actor,'rostering.manage');
  const costs=permissions.can(actor,'rostering.costs');
  const publication=publications.find(record=>record.locationId===location.id&&record.weekStart===weekStart&&record.status==='published')||null;
  const rows=shifts
   .filter(shift=>shift.locationId===location.id&&shift.status!=='cancelled'&&shift.date>=weekStart&&shift.date<=shiftDate(weekStart,6))
   .filter(shift=>manager||shift.accountId===actor.id||shift.publicationId)
   .sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start))
   .map(shift=>{
    const frozen=publication?.costSnapshot.find(item=>item.shiftId===shift.id)||null;
    return {...shift,...(costs&&frozen?{costCents:frozen.costCents}:{})};
   });
  // An un-published week is costed live, only for viewers with wage authority.
  let estimate=null;
  if(costs&&!publication&&rows.length){
   const profiles=await profilesFor(company.id,[...new Set(rows.map(shift=>shift.accountId))]);
   const costed=cost(itemsFor(rows),profiles,employer,'roster');
   estimate={totalCents:sumCents(costed.results.map(result=>result.costCents)),byShift:new Map(costed.results.map(result=>[result.subjectId,result.costCents]))};
  }
  return {
   company,location,weekStart,weekEnd:shiftDate(weekStart,6),rows,publication,estimate,employer,
   canManage:manager,canSeeCosts:costs,
   days:Array.from({length:7},(_,index)=>{const date=shiftDate(weekStart,index);return {date,shifts:rows.filter(shift=>shift.date===date)};})
  };
 }

 // --------------------------------------------------------------------- clock
 async function clockState(actor,locationId){
  const events=(await store.read('clockEvents')).filter(event=>event.accountId===actor.id&&(!locationId||event.locationId===locationId)).sort((a,b)=>a.at.localeCompare(b.at));
  let open=null,onBreak=null;
  for(const event of events){
   if(event.kind==='in'){open=event;onBreak=null;}
   else if(event.kind==='break-start'&&open)onBreak=event;
   else if(event.kind==='break-end')onBreak=null;
   else if(event.kind==='out'){open=null;onBreak=null;}
  }
  return {clockedIn:Boolean(open),onBreak:Boolean(onBreak&&open),since:open?.at||null,breakSince:onBreak?.at||null};
 }

 async function clock(actor,input){
  const {company,location}=await companyAndLocation(actor,input,'rostering.clock');
  const kind=input?.kind;
  if(!['in','out','break-start','break-end'].includes(kind))fail('Choose clock in, clock out or a break.');
  const state=await clockState(actor,location.id);
  if(kind==='in'&&state.clockedIn)fail('You are already clocked in at this location.',409);
  if(kind==='out'&&!state.clockedIn)fail('You are not clocked in at this location.',409);
  if(kind==='break-start'&&(!state.clockedIn||state.onBreak))fail('You cannot start a break now.',409);
  if(kind==='break-end'&&!state.onBreak)fail('You are not on a break.',409);
  const at=stamp();
  const record={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,accountId:actor.id,name:actor.name,kind,at};
  await store.change('clockEvents',list=>{list.push(record);});
  return {...record,state:await clockState(actor,location.id)};
 }

 // ---------------------------------------------------------------- timesheets
 function weekRange(weekStart){return {from:weekStart,to:shiftDate(weekStart,6)};}

 // Clock segments for one person, with unpaid breaks subtracted. Only a real
 // in→out pair becomes a timesheet entry; an open punch stays unapprovable.
 function entriesFor(events,weekStart){
  const localDate=value=>M.localParts(value).date;
  const range=weekRange(weekStart);
  const days=new Map();
  let open=null,breakStart=null,breaks=[];
  for(const event of events.sort((a,b)=>a.at.localeCompare(b.at))){
   if(event.kind==='in'){open=event;breaks=[];breakStart=null;}
   else if(event.kind==='break-start'&&open)breakStart=event;
   else if(event.kind==='break-end'&&breakStart){breaks.push({startAt:breakStart.at,endAt:event.at,paid:false});breakStart=null;}
   else if(event.kind==='out'&&open){
    const date=localDate(open.at);
    if(date>=range.from&&date<=range.to){
     const paidSeconds=Math.round((Date.parse(event.at)-Date.parse(open.at))/1000-breakTotal(breaks));
     const existing=days.get(date)||[];
     existing.push({date,startAt:open.at,endAt:event.at,breaks:[...breaks],paidSeconds,locationId:open.locationId});
     days.set(date,existing);
    }
    open=null;breaks=[];breakStart=null;
   }
  }
  return [...days.values()].flat().sort((a,b)=>a.startAt.localeCompare(b.startAt));
 }
 function breakTotal(breaks){return breaks.reduce((sum,item)=>sum+(Date.parse(item.endAt)-Date.parse(item.startAt))/1000,0);}

 async function timesheets(actor,input){
  const {company,location}=await companyAndLocation(actor,input,'rostering.view','read');
  const weekStart=input?.weekStart&&validDate(input.weekStart)?monday(input.weekStart):monday(today());
  const [events,records,employer]=await Promise.all([store.read('clockEvents'),store.read('timesheets'),employerFor(company,location)]);
  const approved=records.find(record=>record.locationId===location.id&&record.weekStart===weekStart)||null;
  const manager=permissions.can(actor,'rostering.approve');
  const people=[...new Set(events.filter(event=>event.locationId===location.id).map(event=>event.accountId))];
  const rows=people.map(accountId=>{
   const entries=entriesFor(events.filter(event=>event.accountId===accountId&&event.locationId===location.id),weekStart);
   const frozen=approved?.snapshot?.results.find(result=>result.accountId===accountId)||null;
   return {accountId,name:events.find(event=>event.accountId===accountId)?.name||'',entries,frozen,paidSeconds:entries.reduce((sum,entry)=>sum+entry.paidSeconds,0)};
  }).filter(row=>!manager?row.accountId===actor.id:true);
  return {company,location,weekStart,weekEnd:shiftDate(weekStart,6),rows,approved,employer,canApprove:manager,wageVisible:permissions.can(actor,'rostering.costs')};
 }

 async function approve(actor,input){
  const {company,location}=await companyAndLocation(actor,input,'rostering.approve');
  const weekStart=input?.weekStart&&validDate(input.weekStart)?monday(input.weekStart):monday(today());
  const existing=(await store.read('timesheets')).find(record=>record.locationId===location.id&&record.weekStart===weekStart&&record.status==='approved');
  // An approved week is evidence. Re-approving returns it unchanged rather than
  // repricing it after a later rate change.
  if(existing)return {created:false,timesheet:existing};
  const [events,employer,accounts]=await Promise.all([store.read('clockEvents'),employerFor(company,location),store.read('accounts')]);
  const people=[...new Set(events.filter(event=>event.locationId===location.id).map(event=>event.accountId))];
  const items=[],owners=new Map();
  for(const accountId of people){
   for(const entry of entriesFor(events.filter(event=>event.accountId===accountId&&event.locationId===location.id),weekStart)){
    const id=crypto.randomUUID();
    owners.set(id,{accountId,name:accounts.find(account=>account.id===accountId)?.name||''});
    items.push({id,userId:accountId,locationId:location.id,startAt:entry.startAt,endAt:entry.endAt,breaks:entry.breaks,breakMinutes:Math.round(breakTotal(entry.breaks)/60)});
   }
  }
  if(!items.length)fail('There is no completed clocked work in that week to approve.');
  const profiles=await profilesFor(company.id,people);
  const costed=cost(items,profiles,employer,'actual');
  const blocked=costed.results.find(result=>!result.complete);
  if(blocked)fail('This week cannot be approved yet: '+(blocked.issues[0]?.message||'complete the recorded pay details.'),409);
  const snapshot=costed.results.map(result=>({
   accountId:result.userId,entryId:result.subjectId,payCents:result.wageCents,costCents:result.costCents,
   superEstimateCents:result.superEstimateCents,annualLeaveEstimateCents:result.annualLeaveEstimateCents,
   paidSeconds:result.paidSeconds,lines:result.lines,benefits:result.benefits,fingerprint:result.fingerprint,name:owners.get(result.subjectId)?.name||''
  }));
  const at=stamp();
  return store.changeMany(['timesheets','paySnapshots'],data=>{
   const record={
    id:crypto.randomUUID(),companyId:company.id,locationId:location.id,weekStart,
    status:'approved',snapshot:{sourceId:award.source.id,employer:{...employer},profiles,results:snapshot},
    payCents:sumCents(snapshot.map(row=>row.payCents)),costCents:sumCents(snapshot.map(row=>row.costCents)),
    superCents:sumCents(snapshot.map(row=>row.superEstimateCents)),leaveCents:sumCents(snapshot.map(row=>row.annualLeaveEstimateCents)),
    approvedById:actor.id,approvedByName:actor.name,approvedAt:at,revision:1
   };
   data.timesheets.push(record);
   data.paySnapshots.push({id:record.id,companyId:company.id,locationId:location.id,weekStart,kind:'timesheet',at,snapshot:record.snapshot});
   return {created:true,timesheet:record};
  });
 }

 async function payHistory(actor,input){
  const {location}=await companyAndLocation(actor,input,'rostering.view','read');
  if(!permissions.can(actor,'rostering.costs'))throw permissions.deny('You do not have permission to view pay.');
  const [records,publications]=await Promise.all([store.read('timesheets'),store.read('publications')]);
  return {
   timesheets:records.filter(record=>record.locationId===location.id).sort((a,b)=>b.weekStart.localeCompare(a.weekStart)),
   publications:publications.filter(record=>record.locationId===location.id&&record.status==='published').sort((a,b)=>b.weekStart.localeCompare(a.weekStart))
  };
 }

 // ------------------------------------------------------- availability/leave
 async function saveAvailability(actor,input){
  const self=input?.accountId===actor.id;
  const permission=self?'rostering.availability':'rostering.manage';
  const {company,location}=await companyAndLocation(actor,input,permission);
  if(self)permissions.requirePermission(actor,'rostering.availability');
  const weekday=Number(input?.weekday);
  if(!Number.isInteger(weekday)||weekday<0||weekday>6)fail('Choose a weekday from Monday to Sunday.');
  const start=input?.start?text(input.start,5):null,end=input?.end?text(input.end,5):null;
  if((start&&!validTime(start))||(end&&!validTime(end)))fail('Enter availability as 24-hour times.');
  if(Boolean(start)!==Boolean(end))fail('Enter both an availability start and finish, or mark the day unavailable.');
  const record={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,accountId:input?.accountId,name:input?.name||actor.name,weekday,start,end,available:Boolean(start),updatedAt:stamp(),updatedById:actor.id};
  return store.change('availability',list=>{
   const index=list.findIndex(item=>item.locationId===location.id&&item.accountId===record.accountId&&item.weekday===weekday);
   if(index>=0){record.id=list[index].id;list[index]=record;}else list.push(record);
   return record;
  });
 }

 async function availability(actor,input){
  const {location}=await companyAndLocation(actor,input,'rostering.view','read');
  const records=(await store.read('availability')).filter(record=>record.locationId===location.id);
  return permissions.can(actor,'rostering.manage')?records:records.filter(record=>record.accountId===actor.id);
 }

 async function requestLeave(actor,input){
  const self=input?.accountId?input.accountId===actor.id:true;
  const {company,location}=await companyAndLocation(actor,{...input,accountId:input?.accountId||actor.id},self?'rostering.leave':'rostering.leave.approve');
  const startDate=input?.startDate,endDate=input?.endDate;
  if(!validDate(startDate)||!validDate(endDate)||endDate<startDate)fail('Choose a valid leave start and end date.');
  const type=['annual','personal','unpaid'].includes(input?.type)?input.type:'annual';
  const record={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,accountId:input?.accountId||actor.id,name:input?.name||actor.name,startDate,endDate,type,note:text(input?.note,300),status:'pending',requestedAt:stamp(),decidedAt:null,decidedById:null};
  await store.change('leaveRequests',list=>{list.push(record);});
  return record;
 }

 async function decideLeave(actor,input){
  const request=(await store.read('leaveRequests')).find(record=>record.id===input?.id);
  if(!request)fail('Leave request not found.',404);
  await companyAndLocation(actor,request,'rostering.leave.approve');
  if(request.status!=='pending')fail('That request has already been decided.',409);
  const decision=input?.decision==='approve'?'approved':input?.decision==='decline'?'declined':null;
  if(!decision)fail('Choose whether to approve or decline the request.');
  return store.change('leaveRequests',list=>{
   const record=list.find(item=>item.id===request.id);
   record.status=decision;
   record.decidedAt=stamp();
   record.decidedById=actor.id;
   record.decidedByName=actor.name;
   return record;
  });
 }

 async function leave(actor,input){
  const {location}=await companyAndLocation(actor,input,'rostering.view','read');
  const records=(await store.read('leaveRequests')).filter(record=>record.locationId===location.id);
  return permissions.can(actor,'rostering.leave.approve')?records:records.filter(record=>record.accountId===actor.id);
 }

 // A compact read for Home: my next shifts, my clock state, and my own leave.
 async function summary(actor){
  const locations=await store.read('locations');
  const location=permissions.accessibleLocations(actor,locations).find(item=>permissions.locationIds(actor).includes(item.id))||null;
  if(!location)return {shifts:[],clock:{clockedIn:false,onBreak:false},leave:[]};
  const weekStart=monday(today()),shifts=await store.read('shifts'),publications=await store.read('publications');
  const publication=publications.find(record=>record.locationId===location.id&&record.weekStart===weekStart&&record.status==='published')||null;
  return {
   location,
   shifts:shifts.filter(shift=>shift.accountId===actor.id&&shift.locationId===location.id&&shift.status!=='cancelled'&&shift.date>=today()&&shift.date<=shiftDate(weekStart,6)).sort((a,b)=>a.startAt.localeCompare(b.startAt)).slice(0,5),
   published:Boolean(publication&&publication.shifts.some(shift=>shift.accountId===actor.id)),
   clock:await clockState(actor,location.id),
   leave:(await store.read('leaveRequests')).filter(record=>record.accountId===actor.id&&record.status==='pending')
  };
 }

 return {
  saveEmployer,saveProfile,workforce,saveShift,deleteShift,publish,unpublish,week,
  clock,clockState,timesheets,approve,payHistory,saveAvailability,availability,requestLeave,decideLeave,leave,summary
 };
}
module.exports={createWorkforce,monday};
