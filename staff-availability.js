const M=require('./public/rostering-model'),crypto=require('node:crypto');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const empty=()=>Array(7).fill(null);
function validateDays(days){
 if(!Array.isArray(days)||days.length!==7)fail('Enter availability for all seven days.');
 return days.map(day=>{if(day===null)return null;if(!day||!['available','unavailable','window'].includes(day.status))fail('Choose valid daily availability.');if(day.status!=='window')return{status:day.status};const start=M.minutes(day.start),end=M.minutes(day.end);if(typeof day.overnight!=='boolean'||(!day.overnight&&end<=start)||(day.overnight&&end>start))fail('Enter an availability window of up to 24 hours.');return{status:'window',start:day.start,end:day.end,overnight:day.overnight};});
}
const notes=value=>{if(value===undefined)return'';if(typeof value!=='string'||value.length>500)fail('Enter notes of up to 500 characters.');return value.trim();};
function create({now=Date.now,stamp=()=>new Date(now()).toISOString()}={}){
 const earliest=()=>M.shiftDate(M.today(now()),14);
 function get(state,actor,userId,weekStart){
  const own=state.availability.filter(item=>item.locationId===actor.locationId&&item.userId===userId),recurring=own.find(item=>item.kind==='recurring')||{kind:'recurring',days:empty(),notes:'',revision:0,effectiveFrom:null},specific=own.find(item=>item.kind==='week'&&item.weekStart===weekStart)||{kind:'week',weekStart,days:empty(),notes:'',revision:0},holidays=own.filter(item=>item.kind==='school-holiday').sort((a,b)=>a.startDate.localeCompare(b.startDate)),schedules=recurring.schedules||[{effectiveFrom:'2000-01-01',days:recurring.days,notes:recurring.notes}];
  const sources=[],baseline=[],baselineNotes=[],activeNotes=[],days=empty().map((_,index)=>{const date=M.shiftDate(weekStart,index),holiday=holidays.find(item=>!item.removed&&item.startDate<=date&&item.endDate>=date),schedule=schedules.filter(item=>item.effectiveFrom<=date).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0],record=holiday||(specific.revision&&!specific.removed?specific:schedule);baseline.push(schedule?.days[index]||null);if(schedule?.notes)baselineNotes.push(schedule.notes);if(record?.notes)activeNotes.push(record.notes);sources.push({kind:holiday?'school-holiday':specific.revision&&!specific.removed?'week':'recurring',id:holiday?.id||null,effectiveFrom:schedule?.effectiveFrom||null});return record?.days[index]||null;});
  return{recurring,recurringForWeek:{days:baseline,notes:[...new Set(baselineNotes)].join(' · ')},week:specific,holidays,earliestDate:earliest(),noticeDays:14,effective:{days,sources,notes:[...new Set(activeNotes)].join(' · ')}};
 }
 function save(state,actor,input,remove=false){
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter valid availability details.');
  if(!['recurring','week','school-holiday'].includes(input.kind))fail('Choose recurring, weekly or school-holiday availability.');
  if(input.userId&&input.userId!==actor.id)fail('Enter your own availability.',403);
  let previous;
  if(input.kind==='school-holiday'){
   previous=input.id?state.availability.find(item=>item.id===input.id&&item.locationId===actor.locationId&&item.userId===actor.id&&item.kind==='school-holiday'):null;
   if(input.id&&!previous)fail('School-holiday availability not found.',404);
  }else{
   if(input.kind==='week'){M.date(input.weekStart);if(M.monday(input.weekStart)!==input.weekStart)fail('Choose a Monday-starting availability week.');}
   previous=get(state,actor,actor.id,input.weekStart||M.monday(M.today(now())))[input.kind==='week'?'week':'recurring'];
  }
  if(input.revision!==(previous?.revision||0))fail('Availability changed. Reload before saving.',409);
  const date=input.kind==='week'?input.weekStart:input.effectiveFrom||earliest();
  if(input.kind!=='school-holiday'){M.date(date);if(date<earliest())fail('Regular availability needs 14 days’ notice. Choose '+earliest()+' or later.');}
  if(remove){
   if(input.kind==='recurring')fail('Replace recurring availability with a new effective date.');if(!previous?.revision)fail('Availability not found.',404);
   const record={...previous,removed:true,days:empty(),notes:'',revision:previous.revision+1,updatedAt:stamp()};state.availability=state.availability.filter(item=>item!==previous);state.availability.push(record);return record;
  }
  const record={locationId:actor.locationId,userId:actor.id,kind:input.kind,weekStart:input.kind==='week'?input.weekStart:null,days:validateDays(input.days),notes:notes(input.notes),revision:(previous?.revision||0)+1,updatedAt:stamp(),removed:false};
  if(input.kind==='school-holiday'){
   M.date(input.startDate);M.date(input.endDate);if(input.endDate<input.startDate||input.endDate>M.shiftDate(input.startDate,366))fail('Choose school-holiday dates in order, up to one year apart.');
   if(state.availability.some(item=>item!==previous&&item.kind==='school-holiday'&&!item.removed&&item.userId===actor.id&&item.locationId===actor.locationId&&item.startDate<=input.endDate&&item.endDate>=input.startDate))fail('These dates overlap another school-holiday schedule. Edit that schedule instead.',409);
   Object.assign(record,{id:previous?.id||crypto.randomUUID(),startDate:input.startDate,endDate:input.endDate});
  }else if(input.kind==='recurring'){
   const schedules=previous?.schedules|| (previous?.revision?[{effectiveFrom:'2000-01-01',days:previous.days,notes:previous.notes}]:[]);
   record.effectiveFrom=date;record.schedules=[...schedules.filter(item=>item.effectiveFrom!==date),{effectiveFrom:date,days:record.days,notes:record.notes,submittedAt:stamp()}].sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
  }
  state.availability=state.availability.filter(item=>item!==previous);state.availability.push(record);return record;
 }
 return{get,save,earliest};
}
module.exports={create,validateDays};
