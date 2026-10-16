const crypto=require('node:crypto'),M=require('./public/rostering-model'),{can,locationIds}=require('./permissions');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
// The award references the NES rather than creating separate leave balances.
const types=[
 ['annual','Annual leave','22','Accrued paid annual leave; eligibility, balance and loading require review.'],
 ['annual-advance','Annual leave in advance','22.3','Requires a signed agreement; under-18 employees also need a parent or guardian signature.'],
 ['personal','Personal leave (sick leave)','23 / NES','Paid personal leave for eligible full-time and part-time employees; notice/evidence may be required.'],
 ['carer-paid','Paid carer’s leave','23 / NES','For eligible employees caring for an immediate family or household member.'],
 ['carer-unpaid','Unpaid carer’s leave','23 / NES','Includes eligible casual employees; the award also addresses up to 48 hours of casual caring absence.'],
 ['compassionate','Compassionate / bereavement leave','23 / NES','Paid or unpaid depending on employment type; includes qualifying life-threatening illness, death and pregnancy loss.'],
 ['parental','Parental leave','24 / NES','NES parental leave and extensions are generally unpaid; paid parental benefits are separate.'],
 ['parental-special','Unpaid special parental leave','24 / NES','For qualifying pregnancy-related illness or pregnancy loss; assess individual eligibility.'],
 ['pre-adoption','Pre-adoption leave','24 / NES','Unpaid leave for required adoption interviews or examinations, subject to NES conditions.'],
 ['jury','Jury service','25 / NES','Community service leave; payment and make-up pay depend on employment type and applicable law.'],
 ['emergency','Voluntary emergency management','25 / NES','Community service leave for eligible emergency management activity and reasonable travel/rest.'],
 ['family-domestic-violence','Family and domestic violence leave','26 / NES','Paid NES leave, including for eligible casuals. Details are restricted to you and confidential leave reviewers.'],
 ['long-service','Long service leave','3.2(g) / NES & state law','Eligibility, service and payment depend on the applicable state or territory arrangements.'],
 ['toil','Time off in lieu (TOIL)','20.7','Requires an agreement covering overtime; the award’s timing and payment conditions still apply.'],
 ['public-holiday','Public holiday absence','27 / NES','Records a public holiday absence; this is not deducted from annual leave.'],
 ['work-injury','Work injury / workers compensation absence','19 / state law','Records an absence only; statutory compensation and any award accident pay require separate review.'],
 ['unpaid-agreed','Other agreed unpaid leave','Employer agreement','Additional unpaid leave by agreement; this is not a separate automatic award entitlement.']
].map(([id,name,clause,help])=>({id,name,clause,help,confidential:id==='family-domestic-violence',shortNotice:['personal','carer-paid','carer-unpaid','compassionate','parental','parental-special','jury','emergency','family-domestic-violence','work-injury'].includes(id)}));
const privateLeave=record=>types.find(item=>item.id===record.type)?.confidential;
const blocking=record=>['approved','cancellation-requested'].includes(record.status);
const text=(value,max=1000)=>{if(value===undefined)return'';if(typeof value!=='string'||value.length>max)fail('Enter text of up to '+max+' characters.');return value.trim();};
function interval(input){
 M.date(input.startDate);M.date(input.endDate);if(input.endDate<input.startDate)fail('Leave must end on or after its starting date.');
 if(typeof input.allDay!=='boolean')fail('Choose all-day leave or enter leave times.');
 const startAt=M.instant(input.startDate,input.allDay?'00:00':input.startTime),endAt=M.instant(input.allDay?M.shiftDate(input.endDate,1):input.endDate,input.allDay?'00:00':input.endTime);
 if(Date.parse(endAt)<=Date.parse(startAt))fail('Leave must finish after it starts.');return{startAt,endAt};
}
function create({now=Date.now,people}){
 const stamp=()=>new Date(now()).toISOString();
 function overlaps(state,actor,userId,period){return(state.leave||[]).filter(record=>record.companyId===actor.companyId&&record.userId===userId&&blocking(record)&&M.overlap(record,period));}
 function assertAvailable(state,actor,userId,period){if(userId&&overlaps(state,actor,userId,period).length)fail('This user is unavailable during approved leave. Move or reassign the shift, or have the leave cancellation reviewed.',409);}
 const canRead=(actor,record)=>actor.id===record.userId||record.locationId===actor.locationId&&can(actor,'rostering.leave.approve')&&(!privateLeave(record)||can(actor,'rostering.leave.confidential'));
 function view(actor,record){return{...record,typeName:types.find(type=>type.id===record.type)?.name||record.type,canReview:record.locationId===actor.locationId&&record.userId!==actor.id&&can(actor,'rostering.leave.approve')&&(!privateLeave(record)||can(actor,'rostering.leave.confidential'))};}
 function list(state,actor){return{types,noticeDays:14,earliestDate:M.shiftDate(M.today(now()),14),canRequest:can(actor,'rostering.leave'),canApprove:can(actor,'rostering.leave.approve'),requests:(state.leave||[]).filter(record=>record.companyId===actor.companyId&&canRead(actor,record)).map(record=>({...view(actor,record),conflictingShifts:new Set((state.weeks||[]).filter(week=>week.companyId===actor.companyId&&week.locationId===actor.locationId).flatMap(week=>can(actor,'rostering.manage')?[...week.draft,...week.published]:week.published).filter(shift=>shift.userId===record.userId&&M.overlap(M.interval(shift),record)).map(shift=>shift.id)).size})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.startDate.localeCompare(b.startDate))};}
 async function save(state,actor,input){
  if(!can(actor,'rostering.leave'))fail('Leave request permission required.',403);if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter valid leave details.');if(input.userId&&input.userId!==actor.id)fail('Submit your own leave request.',403);
  const type=types.find(type=>type.id===input.type);if(!type)fail('Choose a leave type.');const period=interval(input),earliest=M.shiftDate(M.today(now()),14),shortNotice=input.startDate<earliest,noticeReason=text(input.noticeReason,500);
  if(shortNotice&&(!type.shortNotice||input.shortNotice!==true||!noticeReason))fail('Leave needs 14 days’ notice. Choose '+earliest+' or later, or record an eligible unexpected statutory absence with its short-notice reason.');
  if((state.leave||[]).some(record=>record.userId===actor.id&&record.companyId===actor.companyId&&!['rejected','withdrawn','cancelled'].includes(record.status)&&M.overlap(record,period)))fail('These dates overlap an existing leave request. Review that request first.',409);
  const user=(await people()).find(person=>person.id===actor.id);if(!user||!locationIds(user).includes(actor.locationId))fail('Submit leave from a location you are assigned to.',403);
  const record={id:crypto.randomUUID(),userId:actor.id,username:actor.username,companyId:actor.companyId,locationId:actor.locationId,type:input.type,startDate:input.startDate,endDate:input.endDate,allDay:input.allDay,...(!input.allDay?{startTime:input.startTime,endTime:input.endTime}:{}),...period,shortNotice,...(shortNotice?{noticeReason}:{}),notes:text(input.notes),status:'pending',revision:1,createdAt:stamp(),updatedAt:stamp(),audit:[{action:'submitted',by:actor.id,at:stamp()}]};
  state.leave||=[];state.leave.push(record);return view(actor,record);
 }
 function change(state,actor,id,input){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter a valid leave action.');const record=(state.leave||[]).find(item=>item.id===id&&item.companyId===actor.companyId&&canRead(actor,item));if(!record)fail('Leave request not found.',404);if(record.revision!==input.revision)fail('This leave request changed. Reload before continuing.',409);
  const own=record.userId===actor.id,review=view(actor,record).canReview,reason=text(input.reason,500);let next;
  if(input.action==='withdraw'){if(!own||!can(actor,'rostering.leave'))fail('Withdraw your own leave request.',403);if(!['pending','rejected'].includes(record.status))fail('Only pending or rejected requests can be withdrawn.',409);next='withdrawn';}
  else if(input.action==='request-cancellation'){if(!own||!can(actor,'rostering.leave'))fail('Request cancellation of your own leave.',403);if(record.status!=='approved')fail('Only approved leave can be sent for cancellation.',409);next='cancellation-requested';}
  else{
   if(!review)fail('You cannot review this leave request or approve your own leave.',403);
   if(['approve','reject'].includes(input.action)&&record.status==='pending'){if(input.action==='reject'&&!reason)fail('Enter a reason for declining leave.');next=input.action==='approve'?'approved':'rejected';}
   else if(input.action==='cancel'&&['approved','cancellation-requested'].includes(record.status)){if(!reason)fail('Enter a reason for cancelling approved leave.');next='cancelled';}
   else if(input.action==='keep-approved'&&record.status==='cancellation-requested'){if(!reason)fail('Enter a reason for declining cancellation.');next='approved';}
   else fail('Choose an action available for this leave request.',409);
  }
  record.status=next;record.revision++;record.updatedAt=stamp();record.audit.push({action:input.action,by:actor.id,at:stamp(),reason});return view(actor,record);
 }
 return{list,save,change,overlaps,assertAvailable};
}
module.exports={create,types,interval,blocking,privateLeave};
