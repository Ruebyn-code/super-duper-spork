(function(root){
 const minute=60000,hour=60*minute;
 function entitlement(seconds,mealCount=0){
  const worked=seconds/3600;
  if(worked<4)return{restCount:0,mealCount:0,text:'Under 4 hours: no minimum rest or meal break under Table 2.'};
  if(worked<5)return{restCount:1,mealCount:0,text:'4–under 5 hours: one paid 10-minute rest break.'};
  if(worked<9)return{restCount:1,mealCount:1,text:'5–under 9 hours: one paid 10-minute rest break and one unpaid 30–60 minute meal break.'};
  return{restCount:mealCount>=2?1:2,mealCount:mealCount>=2?2:1,alternatives:true,text:'9+ hours: two paid 10-minute rests (one in each half) and one unpaid 30–60 minute meal, OR one paid rest and two unpaid meals.'};
 }
 function elapsed(entry,now){if(!entry)return 0;const end=entry.endAt?Date.parse(entry.endAt):now,unpaid=entry.breaks.filter(item=>!item.paid).reduce((total,item)=>total+Math.max(0,(item.endAt?Date.parse(item.endAt):end)-Date.parse(item.startAt)),0);return Math.max(0,Math.floor((end-Date.parse(entry.startAt)-unpaid)/1000));}
 function guidance(entry,shift,now){
  const breaks=entry?.breaks||[],complete=breaks.filter(item=>item.endAt),meals=complete.filter(item=>!item.paid&&Date.parse(item.endAt)-Date.parse(item.startAt)>=30*minute&&Date.parse(item.endAt)-Date.parse(item.startAt)<=hour),rests=complete.filter(item=>item.paid&&Date.parse(item.endAt)-Date.parse(item.startAt)>=10*minute),ongoing=breaks.find(item=>!item.endAt),planned=shift?Math.max(0,(Date.parse(shift.endAt)-Date.parse(shift.startAt))/1000-(shift.breakMinutes||0)*60):0,worked=elapsed(entry,now),lastMeal=complete.filter(item=>!item.paid&&Date.parse(item.endAt)-Date.parse(item.startAt)>=30*minute).at(-1),mealDueAt=entry&&!(ongoing&&!ongoing.paid)?new Date(Date.parse(lastMeal?.endAt||entry.startAt)+5*hour).toISOString():null;
  return{...entitlement(Math.max(planned,worked),meals.length),plannedSeconds:planned,workedSeconds:worked,restTaken:rests.length,mealsTaken:meals.length,mealDueAt,ongoing:ongoing?{...ongoing,minimumMinutes:ongoing.paid?10:30,maximumMinutes:ongoing.paid?10:60,readyAt:new Date(Date.parse(ongoing.startAt)+(ongoing.paid?10:30)*minute).toISOString(),overdueAt:!ongoing.paid?new Date(Date.parse(ongoing.startAt)+hour).toISOString():null}:null};
 }
 function warnings(entry,shift,action,paid,now){
  if(!entry)return[];const items=[],ongoing=entry.breaks.find(item=>!item.endAt),end=shift?.endAt&&Date.parse(shift.endAt);
  if(action==='break-start'){
   if(now<Date.parse(entry.startAt)+hour)items.push('Breaks must not be required in the first hour of work.');
   if(end&&now>=end-hour)items.push('This is within or after the last rostered hour. Review the break timing.');
   const previous=entry.breaks.filter(item=>item.endAt).at(-1);if(previous&&Boolean(previous.paid)!==paid&&now-Date.parse(previous.endAt)<minute)items.push('Paid rest and unpaid meal breaks must not be combined.');
  }
  if(ongoing&&['break-end','out'].includes(action)){
   const duration=(now-Date.parse(ongoing.startAt))/minute;if(ongoing.paid&&duration<10)items.push('This paid rest break is shorter than 10 minutes.');
   if(!ongoing.paid&&(duration<30||duration>60))items.push('This unpaid meal break is outside the 30–60 minute range.');
  }
  return items;
 }
 function phase(state,now){
  if(state.entry){if(state.shift&&now>=Date.parse(state.shift.endAt))return'clock-out';const active=state.entry.breaks.find(item=>!item.endAt);if(active){const spent=now-Date.parse(active.startAt);if(!active.paid&&spent>=hour)return'meal-overdue';if(spent>=(active.paid?10:30)*minute)return'break-ready';return'on-break';}if(guidance(state.entry,state.shift,now).mealDueAt&&now>=Date.parse(guidance(state.entry,state.shift,now).mealDueAt))return'meal-due';return'working';}
  return state.shift&&now>=Date.parse(state.shift.startAt)&&now<Date.parse(state.shift.endAt)?'clock-in':state.shift&&state.earlyStartAvailable&&now<Date.parse(state.shift.startAt)?'early-start':'idle';
 }
 const api={entitlement,elapsed,guidance,warnings,phase};if(typeof module==='object'&&module.exports)module.exports=api;else root.shiftClockModel=api;
})(globalThis);
