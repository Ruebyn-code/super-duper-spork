(function(root){
 const zone='Australia/Melbourne',formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}),deadlines=new Map();
 const shift=(day,n)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),weekday=day=>(new Date(day+'T00:00:00Z').getUTCDay()+6)%7+1,monday=day=>shift(day,1-weekday(day));
 const type=plan=>plan.type||(plan.schedule.kind==='manual'?'on-demand':plan.schedule.kind==='once'?'once':plan.schedule.kind==='unscheduled'?'unscheduled':'recurring');
 function monthDate(anchor,n){const parts=anchor.split('-').map(Number),month=parts[0]*12+parts[1]-1+n,year=Math.floor(month/12),index=month%12,day=Math.min(parts[2],new Date(Date.UTC(year,index+1,0)).getUTCDate());return String(year).padStart(4,'0')+'-'+String(index+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');}
 function period(plan,day){
  const s=plan.schedule,kind=s.kind;if(!plan.active||type(plan)==='unscheduled'||day<s.startDate||s.endDate&&day>s.endDate)return null;
  let start=day,end=day,key=day,due=day;
  if(kind==='manual'){key=null;due=plan.dueTime||plan.tradingHours?.due?day:null;}
  else if(kind==='once'){start=s.startDate;end=s.endDate||null;key='once';due=start;}
  else if(kind==='daily'||kind==='hourly'){if(s.days&&!s.days.includes(weekday(day)))return null;}
  else if(kind==='weekly'&&s.anchor!=='start'){start=monday(day);key=start;end=shift(start,6);due=shift(start,(s.weekday||7)-1);}
  else if(['weekly','fortnightly'].includes(kind)){const span=kind==='weekly'?7:14,n=Math.floor((Date.parse(day+'T00:00:00Z')-Date.parse(s.startDate+'T00:00:00Z'))/(span*86400000));start=shift(s.startDate,n*span);end=shift(start,span-1);key=start;due=end;}
  else if(kind==='monthly'||kind==='yearly'){const months=kind==='monthly'?1:12,parts=day.split('-').map(Number),first=s.startDate.split('-').map(Number);let index=Math.floor(((parts[0]-first[0])*12+parts[1]-first[1])/months);if(monthDate(s.startDate,index*months)>day)index--;start=monthDate(s.startDate,index*months);end=shift(monthDate(s.startDate,(index+1)*months),-1);key=start;due=end;}
  else return null;
  if(s.endDate&&end&&end>s.endDate)end=s.endDate;
  const actualStart=start<s.startDate?s.startDate:start;
  if(plan.dueAfterDays!==undefined&&due){due=shift(start,plan.dueAfterDays);const last=end?(kind==='weekly'&&s.anchor!=='start'?end:shift(end,1)):null;if(last&&due>last)due=last;}
  else if(end&&due&&due>end)due=end;
  if(due&&due<actualStart)due=actualStart;
  return{key,startDate:actualStart,endDate:end,dueDate:due};
 }
 function local(epoch){const parts=Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(part=>[part.type,part.value]));return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute+':'+parts.second;}
 function deadline(day,time){if(!day)return null;const key=day+'T'+(time||'23:59');if(deadlines.has(key))return deadlines.get(key);const wall=Date.parse(key+':00Z'),offsets=new Set();for(let probe=wall-36*3600000;probe<=wall+36*3600000;probe+=6*3600000)offsets.add(Date.parse(local(probe)+'Z')-Math.floor(probe/1000)*1000);let matches=[...offsets].map(offset=>wall-offset).filter(epoch=>local(epoch).slice(0,16)===key);
  // Repeated clock times use their later occurrence; skipped times move to the first real minute after them.
  if(!matches.length)for(let n=1;n<=120&&!matches.length;n++){const next=new Date(wall+n*60000).toISOString().slice(0,16);matches=[...offsets].map(offset=>wall+n*60000-offset).filter(epoch=>local(epoch).slice(0,16)===next);}
  const result=matches.length?new Date(Math.max(...matches)+(time?0:59999)).toISOString():null;if(deadlines.size>500)deadlines.clear();deadlines.set(key,result);return result;
 }
 function tradingPoint(point,day,hours){
  const entry=hours?.[weekday(day)-1];if(!point||!entry||entry.closed||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.open)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.close))return null;
  const closing=point.anchor==='closing',date=closing&&entry.close<=entry.open?shift(day,1):day,at=deadline(date,closing?entry.close:entry.open);
  return new Date(Date.parse(at)+point.offsetMinutes*60000).toISOString();
 }
 function tradingWindow(plan,day,hours){
  const entry=hours?.[weekday(day)-1];if(entry?.closed)return{allowed:false,reason:'This location is closed on this trading day.'};
  const opensAt=tradingPoint(plan.tradingHours.start,day,hours),closesAt=tradingPoint(plan.tradingHours.until,day,hours);
  if(!opensAt||!closesAt)return{allowed:false,reason:'Set this location’s opening and closing hours in Location settings.'};
  if(closesAt<=opensAt)return{allowed:false,reason:'The trading-hour window ends before it starts for this location. Adjust the planner offsets.',opensAt,closesAt};
  return{opensAt,closesAt};
 }
 function due(plan,slot,hours){
  if(!slot)return{dueDate:null,dueTime:null,dueAt:null};
  if(slot.hourEndsAt){const wall=local(Date.parse(slot.hourEndsAt));return{dueAt:slot.hourEndsAt,dueDate:wall.slice(0,10),dueTime:wall.slice(11,16)};}
  if(!plan.tradingHours?.due)return{dueDate:slot.dueDate,dueTime:plan.dueTime||null,dueAt:deadline(slot.dueDate,plan.dueTime)};
  const dueAt=tradingPoint(plan.tradingHours.due,slot.dueDate,hours),wall=dueAt?local(Date.parse(dueAt)):null;
  return{dueAt,dueDate:wall?wall.slice(0,10):slot.dueDate,dueTime:wall?wall.slice(11,16):null};
 }
 function activeWindow(plan,slot,hours){
  if(!slot)return{allowed:false,reason:'This checklist is not scheduled for this date.'};
  if(slot.hourStartsAt&&slot.hourEndsAt)return{opensAt:slot.hourStartsAt,closesAt:slot.hourEndsAt};
  if(plan.tradingHours)return tradingWindow(plan,slot.startDate,hours);
  const day=slot.startDate,from=plan.activeFrom||plan.startTime||'00:00',until=plan.activeUntil,opensAt=new Date(Math.max(Date.parse(deadline(day,from)),Date.parse(deadline(day,plan.startTime||'00:00')))).toISOString(),closesAt=until?deadline(until<from?shift(day,1):day,until):deadline(shift(day,1),'00:00');
  if(closesAt<=opensAt)return{allowed:false,reason:'The active window ends before this checklist starts.',opensAt,closesAt};
  return{opensAt,closesAt};
 }
 function visible(window,now=Date.now()){return Boolean(window&&window.allowed!==false&&window.opensAt&&window.closesAt&&now>=Date.parse(window.opensAt)&&now<Date.parse(window.closesAt));}
 function availability(plan,slot,now=Date.now(),hours){
  const window=activeWindow(plan,slot,hours);if(window.allowed===false)return window;
  return{...window,allowed:visible(window,now),reason:now<Date.parse(window.opensAt)?'This checklist has not started yet.':now>=Date.parse(window.closesAt)?'This checklist is outside its active hours.':undefined};
 }
 function hourlySlot(plan,day,now,hours){
  const candidates=[];
  for(const offset of day===local(now).slice(0,10)?[-2,-1,0,1]:[0]){
   const date=shift(day,offset),base=period(plan,date);if(!base)continue;const window=activeWindow(plan,base,hours);if(!visible(window,now))continue;
   const index=Math.floor((now-Date.parse(window.opensAt))/3600000),hourStartsAt=new Date(Date.parse(window.opensAt)+index*3600000).toISOString(),hourEndsAt=new Date(Math.min(Date.parse(hourStartsAt)+3600000,Date.parse(window.closesAt))).toISOString();
   candidates.push({...base,key:date+'@'+hourStartsAt,tradingDate:date,hourStartsAt,hourEndsAt});
  }
  return candidates.sort((a,b)=>b.hourStartsAt.localeCompare(a.hourStartsAt))[0]||null;
 }
 function nextChange(plan,day,now,hours){
  let next=null;for(const offset of [-2,-1,0,1]){const slot=period(plan,shift(day,offset));if(!slot)continue;const window=activeWindow(plan,slot,hours);if(window.allowed===false)continue;for(const at of [window.opensAt,window.closesAt])if(at&&Date.parse(at)>now&&(!next||at<next))next=at;}
  if(plan.schedule.kind==='hourly'){const slot=hourlySlot(plan,day,now,hours);if(slot&&(!next||slot.hourEndsAt<next))next=slot.hourEndsAt;}
  return next;
 }
 function hourlyPreview(plan,day,hours,limit=4){
  const slot=period({...plan,active:true},day);if(!slot)return[];const window=activeWindow(plan,slot,hours);if(window.allowed===false)return[];const result=[];
  for(let at=Date.parse(window.opensAt);at<Date.parse(window.closesAt)&&result.length<Math.min(72,limit);at+=3600000)result.push({opensAt:new Date(at).toISOString(),closesAt:new Date(Math.min(at+3600000,Date.parse(window.closesAt))).toISOString()});return result;
 }
 function occurrence(plan,day,now=Date.now(),hours){
  if(plan.schedule.kind==='hourly')return hourlySlot(plan,day,now,hours);
  if(plan.tradingHours){
   if(day===local(now).slice(0,10)){
    const candidates=[];for(const offset of [-2,-1,0,1]){const tradingDate=shift(day,offset),slot=period(plan,tradingDate);if(!slot)continue;const value={...slot,tradingDate:slot.startDate},window=availability(plan,value,now,hours);if(window.allowed)candidates.push({slot:value,opensAt:window.opensAt});}
    if(candidates.length)return candidates.sort((a,b)=>b.opensAt.localeCompare(a.opensAt))[0].slot;
   }
   const slot=period(plan,day);return slot&&!hours?.[weekday(day)-1]?.closed?{...slot,tradingDate:slot.startDate}:null;
  }
  const wall=local(now),from=plan.activeFrom||plan.startTime||'00:00';
  if(day===wall.slice(0,10)&&plan.activeUntil&&plan.activeUntil<from&&wall.slice(11,16)<plan.activeUntil){const previous=period(plan,shift(day,-1));if(previous&&availability(plan,previous,now).allowed)return previous;}
  return period(plan,day);
 }
 function timing(dueAt,reminderMinutes,now=Date.now()){if(!dueAt)return null;const left=Date.parse(dueAt)-now;return left<0?'overdue':reminderMinutes>0&&left<=reminderMinutes*60000?'soon':null;}
 function upcoming(plan,from,limit=4,hours){
  const dates=[],s=plan.schedule;if(!plan.active||['manual','unscheduled'].includes(s.kind)||type(plan)==='unscheduled')return dates;
  let day=from>s.startDate?from:s.startDate;for(let n=0;n<1600&&dates.length<limit;n++){
   const slot=period(plan,day),window=plan.tradingHours&&slot?activeWindow(plan,slot,hours):null;
   if(slot&&(!window||window.allowed!==false)&&!dates.includes(slot.startDate)&&slot.startDate>=from)dates.push(slot.startDate);
   if(s.endDate&&day>=s.endDate||s.kind==='once')break;day=slot?.endDate&&!['daily','hourly'].includes(s.kind)?shift(slot.endDate,1):shift(day,1);
  }return dates;
 }
 function pointLabel(point){if(!point)return'No time set';const minutes=Math.abs(point.offsetMinutes);return point.anchor+(minutes?' '+minutes+' min '+(point.offsetMinutes<0?'before':'after'):'');}
 const api={period,occurrence,availability,activeWindow,visible,nextChange,hourlyPreview,type,deadline,due,tradingPoint,tradingWindow,pointLabel,timing,upcoming,shift,monday,weekday,zone,local,monthDate};if(typeof module==='object'&&module.exports)module.exports=api;else root.opsPlannerModel=api;
})(globalThis);
