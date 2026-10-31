(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./rostering-model'));else root.timesheetCardModel=factory(root.rosteringModel);})(globalThis,M=>{
 const period=e=>({startAt:e.startAt,endAt:e.endAt}),overlaps=(a,b)=>a.startAt&&a.endAt&&b.startAt&&b.endAt&&M.overlap(a,b);
 function reference(entry,published=[],entries=[]){
  // Clock-in records retain their original published timetable, even after edits.
  const linked=published.find(s=>s.id===entry.shiftId&&s.userId===entry.userId);
  if(entry.scheduledStartAt&&entry.scheduledEndAt&&Number.isFinite(entry.scheduledBreakMinutes))return{...linked,startAt:entry.scheduledStartAt,endAt:entry.scheduledEndAt,paidSeconds:Math.max(0,(Date.parse(entry.scheduledEndAt)-Date.parse(entry.scheduledStartAt))/1000-entry.scheduledBreakMinutes*60),basis:'Roster at clock-in'};
  if(entry.shiftId)return linked?{...linked,...M.interval(linked),basis:'Published roster'}:null;
  // Never guess a roster for fragmented, unmatched or ambiguous manual records.
  const candidates=published.filter(s=>s.userId===entry.userId&&overlaps(M.interval(s),period(entry)));
  if(candidates.length!==1)return null;const shift=candidates[0],interval=M.interval(shift);
  if(entries.some(e=>e.id!==entry.id&&e.userId===entry.userId&&e.status!=='rejected'&&overlaps(interval,{startAt:e.startAt,endAt:e.endAt||'2100-01-01T00:00:00Z'})))return null;
  return{...shift,...interval,basis:'Published roster'};
 }
 function describe(entry,{published=[],entries=[],check}={}){
  const roster=entry.rosterReference||reference(entry,published,entries),issues=(check?.issues||[]).filter(i=>i.subjectId===entry.id||!i.subjectId&&(!i.userId||i.userId===entry.userId)).map(i=>({...i}));
  if(!entry.endAt)issues.unshift({code:'missing-finish',message:'Clock-out time is missing. Complete or correct the timesheet.',blocking:true});
  if(entry.longShift)issues.unshift({code:'long-shift',message:'This record exceeds 24 hours. Review and correct the times.',blocking:true});
  const varianceSeconds=roster&&entry.endAt?entry.paidSeconds-roster.paidSeconds:null;
  if(varianceSeconds!==null&&Math.abs(varianceSeconds)>=60)issues.push({code:'roster-variance',message:'Paid hours differ from the published roster. Check the clock times and unpaid breaks.',blocking:false});
  if(entry.status==='pending'&&Object.hasOwn(entry,'costCents')&&entry.costCents==null&&!issues.some(i=>i.blocking))issues.push({code:'missing-cost',message:'Wage cost is unavailable. Check the saved hourly rate or employment setup before approval.',blocking:true});
  const unique=[...new Map(issues.map(i=>[[i.code,i.message].join('|'),i])).values()].sort((a,b)=>Number(Boolean(b.blocking))-Number(Boolean(a.blocking)));
  return{roster,varianceSeconds,issues:unique,blocked:unique.some(i=>i.blocking),pay:entry.pay||check?.prices?.find(p=>p.subjectId===entry.id)||null};
 }
 return{reference,describe};
});
