(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./ops-planner-model'):root.opsPlannerModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.opsPlannerSummary=api;})(globalThis,model=>{
 const dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],list=new Intl.ListFormat('en-AU',{style:'long',type:'conjunction'});
 const date=value=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const time=value=>new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'UTC'}).format(new Date('2000-01-01T'+value+':00Z'));
 const instant=value=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZone:model.zone,timeZoneName:'short'}).format(new Date(value));
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 const validTime=value=>!value||typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 function validate(plan){
  if(!plan?.schedule)return 'Choose a checklist type and schedule.';if(model.type(plan)==='unscheduled')return null;
  const s=plan.schedule;if(!validDate(s.startDate))return 'Choose a valid start date to see the breakdown.';if(s.endDate&&(!validDate(s.endDate)||s.endDate<s.startDate))return 'This saved schedule has invalid dates. Update its settings to remove the saved limit.';
  if(!['hourly','daily','weekly','fortnightly','monthly','yearly','once','manual'].includes(s.kind))return 'Choose a repeat frequency.';
  if(['hourly','daily'].includes(s.kind)&&s.days&&(!s.days.length||s.days.some(day=>!Number.isInteger(day)||day<1||day>7)))return 'Choose at least one repeat day.';
  if([plan.startTime,plan.activeFrom,plan.activeUntil,plan.dueTime].some(value=>!validTime(value)))return 'Choose valid active hours and deadline times.';
  if(plan.tradingHours){for(const point of [plan.tradingHours.start,plan.tradingHours.until,plan.tradingHours.due].filter(Boolean))if(!['opening','closing'].includes(point.anchor)||!Number.isInteger(point.offsetMinutes)||Math.abs(point.offsetMinutes)>1440)return 'Finish the trading-hour offsets to see the breakdown.';if(!plan.tradingHours.start||!plan.tradingHours.until)return 'Choose both trading-hour boundaries.';}
  else if(model.activeWindow({...plan,active:true},model.period({...plan,active:true},s.startDate)||{startDate:s.startDate}).allowed===false)return 'The active hours finish before the checklist can start. Review its times.';
  return null;
 }
 function repeat(plan){
  const s=plan.schedule,type=model.type(plan),days=[...(s.days||[1,2,3,4,5,6,7])].sort(),names=list.format(days.map(n=>dayNames[n-1]));
  if(type==='unscheduled')return 'Not scheduled';if(type==='on-demand')return 'Manual start only · does not repeat automatically';if(type==='once')return 'Once only · '+date(s.startDate);
  if(s.kind==='hourly')return days.length===7?'Every hour, every day':'Every hour on '+names;
  if(s.kind==='daily')return days.length===7?'Every day':'Every '+names;
  if(s.kind==='weekly')return s.anchor==='start'?'Every week on '+dayNames[model.weekday(s.startDate)-1]:'Once per calendar week · Monday–Sunday';
  if(s.kind==='fortnightly')return 'Every 2 weeks on '+dayNames[model.weekday(s.startDate)-1];
  if(s.kind==='monthly')return 'Every month on day '+Number(s.startDate.slice(8))+' · last day in shorter months';
  return 'Every year on '+new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(s.startDate+'T12:00:00Z'))+' · last day of the month when needed';
 }
 function point(point){const anchor=point.anchor==='opening'?'opening':'closing',minutes=Math.abs(point.offsetMinutes);return minutes?minutes+' minutes '+(point.offsetMinutes<0?'before ':'after ')+anchor:'At '+anchor;}
 function describe(plan){
  const error=validate(plan);if(error)return{valid:false,message:error};const type=model.type(plan),state=type==='unscheduled'?'Unscheduled':plan.active?'Active':'Paused';
  if(type==='unscheduled')return{valid:true,state,headline:'This checklist is not scheduled and will stay off the active list.',rows:[],hasWindows:false};
  const s=plan.schedule,from=[plan.activeFrom||'00:00',plan.startTime||'00:00'].sort().at(-1),until=plan.activeUntil||'00:00',overnight=plan.activeUntil?plan.activeUntil<(plan.activeFrom||plan.startTime||'00:00'):true;
  const hours=plan.tradingHours?point(plan.tradingHours.start)+' → '+point(plan.tradingHours.until)+' · each location’s saved hours':from==='00:00'&&!plan.activeUntil?'All day · midnight to midnight':time(from)+' → '+time(until)+(overnight?' the next day':'');
  const offset=plan.dueAfterDays,day=offset===undefined?'Due date follows its repeat period':offset===0?'Same day':offset===1?'Next day':offset+' days after the period starts';
  const dueDay=day+(['weekly','fortnightly','monthly','yearly'].includes(s.kind)&&offset>0?' (capped to the repeat period)':'');
  const due=s.kind==='hourly'?'At the end of each hour, or the active finish if earlier':type==='on-demand'&&!plan.dueTime&&!plan.tradingHours?.due?'No deadline':dueDay+' · '+(plan.tradingHours?.due?point(plan.tradingHours.due):plan.dueTime?time(plan.dueTime):'end of day');
  return{valid:true,state,headline:!plan.active?'Paused · these settings will apply when activated.':type==='on-demand'?'Team members can start this checklist manually during its available windows.':'A checklist becomes available in each planned window and leaves Active when that window finishes.',rows:[['Repeats',repeat(plan)],[s.endDate?'Saved date range':'Start date',date(s.startDate)+(s.endDate?' → '+date(s.endDate)+' (saved limit; removed on edit)':type==='once'?' · once only':' onwards')],['Active hours',hours],['Deadline',due]],hasWindows:true,windowTitle:!plan.active?'Preview if activated':type==='on-demand'?'Available start windows':'Current and next runs'};
 }
 function upcoming(plan,now,hours,limit=3){
  const description=describe(plan);if(!description.valid||!description.hasWindows)return{windows:[],message:description.message||'No scheduled runs.'};
  const preview={...plan,active:true},s=preview.schedule,today=model.local(now).slice(0,10),seen=new Set(),windows=[];let day=model.shift(today,-3);if(day<s.startDate)day=s.startDate;const horizon=model.shift(day>today?day:today,1600);
  // These are possible windows, not saved or started checklist records.
  let missing=false,closed=false,invalid='';for(let n=0;n<1600&&windows.length<limit;n++){
   if(day>horizon||s.endDate&&day>s.endDate)break;const slot=model.period(preview,day);
   if(slot){const key=slot.key||slot.startDate;if(!seen.has(key)){seen.add(key);const window=model.activeWindow(preview,slot,hours);
    if(window.allowed===false){if(preview.tradingHours&&!hours?.[model.weekday(slot.startDate)-1])missing=true;else if(preview.tradingHours&&hours?.[model.weekday(slot.startDate)-1]?.closed)closed=true;else invalid=window.reason;}
    else{const slots=s.kind==='hourly'?model.hourlyPreview(preview,slot.startDate,hours,72).map(hour=>({...hour,slot:{...slot,hourStartsAt:hour.opensAt,hourEndsAt:hour.closesAt}})):[{...window,slot}];for(const item of slots){if(Date.parse(item.closesAt)<=now)continue;const due=model.due(preview,item.slot,hours);windows.push({tradingDate:slot.startDate,opensAt:item.opensAt,closesAt:item.closesAt,dueAt:due.dueAt,availableNow:Date.parse(item.opensAt)<=now,label:instant(item.opensAt)+' → '+instant(item.closesAt),dueLabel:due.dueAt?instant(due.dueAt):'No deadline'});if(windows.length>=limit)break;}}
   }}
   if(s.kind==='once')break;day=slot?.endDate&&!['hourly','daily','manual'].includes(s.kind)?model.shift(slot.endDate,1):model.shift(day,1);
   // A weekly trading-hours pattern repeats; missing/closed whole patterns need no multi-year scan.
   if(!windows.length&&['hourly','daily','manual'].includes(s.kind)&&n>=13&&(missing||closed||invalid))break;
  }
  return{windows,message:windows.length?'':invalid|| (missing?'Trading hours are missing for the selected repeat days.':closed?'The location is closed on the selected repeat days.':'No current or future windows within these dates.')};
 }
 return{describe,upcoming,repeat,point,instant};
});
