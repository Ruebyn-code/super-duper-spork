(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./ops-step-model'),require('./ops-planner-model'));
 else root.opsStepTiming=factory(root.opsStepModel,root.opsPlannerModel);
})(globalThis,(steps,planner)=>{
 const clock=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 function windowFor(run,section){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(run.workDate||'')||!clock(section.startTime)||!clock(section.endTime)||section.startTime===section.endTime)return null;
  // Trading-hour sections may start the day after the checklist date (after an overnight closing).
  const startDay=Number.isInteger(section.startDayOffset)&&section.startDayOffset?planner.shift(run.workDate,section.startDayOffset):run.workDate,endDay=section.endTime<section.startTime?planner.shift(startDay,1):startDay,start=planner.deadline(startDay,section.startTime),end=planner.deadline(endDay,section.endTime);
  return start&&end?{date:run.workDate,start,end,overnight:endDay!==run.workDate}:null;
 }
 function stateFor(run,step,window){
  if(!steps.answered(step,run.answers?.[step.id]))return 'pending';
  const completed=run.stepActivity?.[step.id]?.completedAt,at=Date.parse(completed);
  if(!window||!completed||!Number.isFinite(at))return 'unrecorded';
  return at<Date.parse(window.start)?'early':at>Date.parse(window.end)?'late':'within';
 }
 function evaluate(run){
  const byStep={},sections=[];let active=null;
  for(const step of run.snapshot?.steps||[]){
   if(steps.isSection(step)){
    active=step.type==='timed-section'?{id:step.id,window:windowFor(run,step),total:0,within:0,early:0,late:0,pending:0,unrecorded:0}:null;
    if(active)sections.push(active);continue;
   }
   if(!active||!steps.responseStep(step))continue;
   const state=stateFor(run,step,active.window);active.total++;active[state]++;byStep[step.id]={sectionId:active.id,state};
  }
  for(const section of sections)section.state=section.early||section.late?'outside':section.unrecorded||!section.window?'unrecorded':section.pending||!section.total?'pending':'within';
  return{byStep,sections};
 }
 const formatTime=value=>clock(value)?new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(new Date('2000-01-01T'+value+':00Z')):'';
 // Timed sections may follow the store's trading hours: {start,end} points of {anchor:'opening'|'closing', offsetMinutes}.
 const tradingAnchors=['opening','closing'];
 const validPoint=point=>Boolean(point)&&typeof point==='object'&&tradingAnchors.includes(point.anchor)&&Number.isInteger(point.offsetMinutes)&&Math.abs(point.offsetMinutes)<=720;
 const pointText=point=>{const minutes=Math.abs(point.offsetMinutes),span=minutes>=60&&minutes%60===0?(minutes/60)+' h':minutes+' min';return minutes?span+' '+(point.offsetMinutes<0?'before ':'after ')+point.anchor:(point.anchor==='opening'?'Opening':'Closing');};
 const tradingText=step=>{const text=pointText(step.tradingHours.start)+' – '+pointText(step.tradingHours.end);return text.charAt(0).toUpperCase()+text.slice(1);};
 // Work out one day's clock times from the location's Monday–Sunday trading hours; null when that day is closed, unset or the window would be empty.
 function tradingWindow(step,hours,day){if(!step?.tradingHours||!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return null;const date=new Date(day+'T00:00:00Z'),entry=Array.isArray(hours)?hours[(date.getUTCDay()+6)%7]:null;if(!entry||entry.closed||!clock(entry.open)||!clock(entry.close))return null;
  // Minutes from the checklist date's midnight; an overnight closing (closing at or before opening) falls on the next day.
  const minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3)),open=minutes(entry.open),close=minutes(entry.close)+(minutes(entry.close)<=minutes(entry.open)?1440:0),at=point=>(point.anchor==='opening'?open:close)+point.offsetMinutes,text=total=>{const value=(total%1440+1440)%1440;return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');};
  const start=at(step.tradingHours.start),end=at(step.tradingHours.end);if(end<=start||end-start>=1440)return null;const offset=Math.floor(start/1440);return{startTime:text(start),endTime:text(end),...(offset?{startDayOffset:offset}:{})};}
 // Freeze trading-hour sections into fixed times for a run; days without usable hours keep the section's saved fallback times.
 function resolveSteps(list,hours,day){return(list||[]).map(step=>{if(step.type!=='timed-section'||!step.tradingHours)return step;const {tradingHours,...rest}=step,window=tradingWindow(step,hours,day);const value={...rest,...(window||{}),fromTradingHours:tradingHours,...(window?{}:{tradingFallback:true})};value.title=sectionTitle(value);return value;});}
 const sectionTitle=step=>step?.tradingHours&&validPoint(step.tradingHours.start)&&validPoint(step.tradingHours.end)?tradingText(step):clock(step.startTime)&&clock(step.endTime)?formatTime(step.startTime)+' – '+formatTime(step.endTime):'Timed section';
 return{clock,windowFor,stateFor,evaluate,formatTime,sectionTitle,validPoint,pointText,tradingWindow,resolveSteps};
});
