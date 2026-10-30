'use strict';
// Planned breaks only: never clock events, signed agreements or actual deductions.
const M=require('./public/rostering-model');
const {entitlement}=require('./public/clock-model');
const {rosteredHoursAgreement}=require('./award-rules');
const version='MA000003-2026-07-breaks-v1',minute=60000;
const issue=(code,message)=>({code,message});
function interval(shift){return M.interval({...shift,breakMinutes:0});}
function agreementMeal(shift,profile,employerName){
 if(profile?.employmentType!=='part-time')return null;
 const regular=profile.pattern?.[(new Date(shift.date+'T12:00:00Z').getUTCDay()+6)%7],variation=shift.awardFacts?.variation;
 if(variation?.reference&&variation.mealBreakStart&&Date.parse(variation.agreedAt)<=Date.parse(interval(shift).endAt))return{start:variation.mealBreakStart,minutes:variation.breakMinutes,source:'written-variation'};
 if(rosteredHoursAgreement(profile,shift.date,shift.locationId,employerName)&&!regular?.breakMinutes)return null;
 return regular?{start:regular.mealBreakStart||null,minutes:regular.breakMinutes,source:'regular-hours'}:null;
}
function atTime(shift,time){return Date.parse(M.instant(time<shift.start?M.shiftDate(shift.date,1):shift.date,time));}
function validate({shift,breaks,agreement=null}){
 const issues=[];let range;try{range=interval(shift);}catch{return[issue('format','Check the shift’s date, start and finish times.')];}const {startAt,endAt}=range,start=Date.parse(startAt),end=Date.parse(endAt);
 if(!Array.isArray(breaks)||breaks.length>8)return[issue('format','Choose up to eight planned breaks.')];
 const rows=[];
 for(const row of breaks){
  const from=Date.parse(row?.startAt),to=Date.parse(row?.endAt),duration=(to-from)/minute;
  if(!['rest','meal'].includes(row?.kind)||!Number.isFinite(from)||!Number.isFinite(to)||!Number.isInteger(duration)||duration<=0||from%minute||to%minute){issues.push(issue('format','Check each planned break’s type, start and duration.'));continue;}
  if(row.kind==='rest'&&duration!==10||row.kind==='meal'&&(duration<30||duration>60))issues.push(issue('duration','Paid rest breaks are 10 minutes; unpaid meals must be 30–60 minutes.'));
  if(from<start+60*minute||to>end-60*minute)issues.push(issue('edge','Keep complete breaks outside the first and last hour of the shift.'));
  rows.push({...row,from,to});
 }
 rows.sort((a,b)=>a.from-b.from);for(let i=1;i<rows.length;i++){if(rows[i].from<rows[i-1].to)issues.push(issue('overlap','Planned breaks cannot overlap.'));if(rows[i].kind!==rows[i-1].kind&&rows[i].from-rows[i-1].to<minute)issues.push(issue('combined','Paid rest and unpaid meal breaks must be separate.'));}
 const meals=rows.filter(r=>r.kind==='meal'),rests=rows.filter(r=>r.kind==='rest'),paidSeconds=(end-start)/1000-meals.reduce((sum,r)=>sum+(r.to-r.from)/1000,0),required=entitlement(paidSeconds,meals.length);
 if(meals.length>2)issues.push(issue('long-shift','Review plans needing more than two unpaid meals.'));
 if(rests.length<required.restCount||meals.length<required.mealCount)issues.push(issue('entitlement','Add the paid rest and unpaid meal breaks required for the shift’s paid working hours.'));
 if(required.restCount===2){const middle=start+(end-start)/2;if(!rests.some(r=>r.to<=middle)||!rests.some(r=>r.from>=middle))issues.push(issue('halves','Plan one paid rest break in each half of this shift.'));}
 let from=start;for(const meal of meals){if(meal.from-from>300*minute)issues.push(issue('gap','No more than five hours may be worked without a meal break.'));from=meal.to;}if(end-from>300*minute)issues.push(issue('gap','No more than five hours may be worked without a meal break.'));
 if(agreement){const expected=agreement.start?atTime(shift,agreement.start):null;if(meals.reduce((sum,r)=>sum+(r.to-r.from)/minute,0)!==agreement.minutes||agreement.minutes>0&&(meals.length!==1||meals[0].from!==expected))issues.push(issue('agreement','The planned meal must match the recorded part-time agreement. Record an agreed written variation before changing its timing or duration.'));}
 return [...new Map(issues.map(i=>[i.code,i])).values()];
}
function build({shift,profile,employerName,mode='automatic',customBreaks,fixedMeal}){
 if(!['automatic','custom'].includes(mode))throw Object.assign(Error('Choose automatic or custom planned breaks.'),{status:400});
 const {startAt,endAt}=interval(shift),start=Date.parse(startAt),end=Date.parse(endAt),elapsed=(end-start)/minute,agreement=agreementMeal(shift,profile,employerName),rows=[];
 const row=(kind,from,duration)=>({kind,startAt:new Date(from).toISOString(),endAt:new Date(from+duration*minute).toISOString()});
 if(mode==='custom'&&customBreaks!==undefined){
  const issues=validate({shift,breaks:customBreaks,agreement});if(!Array.isArray(customBreaks)||customBreaks.length>8)return result([],issues);const valid=Array.isArray(customBreaks)?customBreaks.filter(r=>['rest','meal'].includes(r?.kind)&&Number.isFinite(Date.parse(r.startAt))&&Number.isFinite(Date.parse(r.endAt))).map(r=>row(r.kind,Date.parse(r.startAt),(Date.parse(r.endAt)-Date.parse(r.startAt))/minute)):[];
  return result(valid,issues);
 }
 const anchor=mode==='custom'&&fixedMeal?fixedMeal:agreement||fixedMeal;
 if(anchor){if(anchor.minutes>0&&anchor.start){try{rows.push(row('meal',atTime(shift,anchor.start),anchor.minutes));}catch{return result([],[issue('agreement','Review the agreed meal time for this shift date.')]);}}else if(anchor.minutes>0)return result([], [issue('agreement','Record the agreed meal-break time in the employee’s regular working hours or written variation.')]);}
 else{
  // Choose the minimum count of 30-minute meals keeping work stretches <=5h.
  // At the 5h boundary include a meal rather than leave 5 paid hours unbroken.
  let count=elapsed>=300?1:0;while((elapsed-count*30)/(count+1)>300)count++;
  if(count>2)return result([], [issue('long-shift','Review breaks for shifts longer than sixteen hours; automatic planning supports up to two meals.')]);
  const work=elapsed-count*30;for(let i=1;i<=count;i++)rows.push(row('meal',start+(Math.floor(i*work/(count+1))+(i-1)*30)*minute,30));
 }
 const meals=rows.filter(r=>r.kind==='meal'),unpaid=meals.reduce((sum,r)=>sum+(Date.parse(r.endAt)-Date.parse(r.startAt))/minute,0),required=entitlement((elapsed-unpaid)*60,meals.length),half=elapsed/2;
 for(let i=0;i<required.restCount;i++){
  const target=required.restCount===2?(i===0?elapsed/4:elapsed*3/4):meals.length===1?(Date.parse(meals[0].startAt)-start)/minute/2:elapsed/2,low=required.restCount===2&&i===1?Math.ceil(half):60,high=required.restCount===2&&i===0?Math.floor(half)-10:elapsed-70;
  const choices=[];for(let offset=low;offset<=high;offset++){const from=start+offset*minute,to=from+10*minute;if(rows.every(r=>to<=Date.parse(r.startAt)-(r.kind==='meal'?15*minute:0)||from>=Date.parse(r.endAt)+(r.kind==='meal'?15*minute:0)))choices.push(offset);}
  const rounded=choices.filter(value=>value%5===0);if(rounded.length)choices.splice(0,choices.length,...rounded);choices.sort((a,b)=>Math.abs(a+5-target)-Math.abs(b+5-target)||a-b);if(!choices.length)return result(rows,[issue('space','There is not enough room for the required paid rest breaks. Review the shift or agreed meal time.')]);rows.push(row('rest',start+choices[0]*minute,10));
 }
 rows.sort((a,b)=>a.startAt.localeCompare(b.startAt));return result(rows,validate({shift,breaks:rows,agreement}));
 function result(breaks,issues){const unpaidMinutes=breaks.filter(r=>r.kind==='meal').reduce((sum,r)=>sum+(Date.parse(r.endAt)-Date.parse(r.startAt))/minute,0);return{version,mode,status:issues.length?'review-required':'ready',breaks,unpaidMinutes,issues,...(agreement?{basis:agreement.source}:{basis:fixedMeal?'saved-meal':'award'})};}
}
module.exports={version,build,validate,agreementMeal};
