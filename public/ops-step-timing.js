(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./ops-step-model'),require('./ops-planner-model'));
 else root.opsStepTiming=factory(root.opsStepModel,root.opsPlannerModel);
})(globalThis,(steps,planner)=>{
 const clock=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 function windowFor(run,section){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(run.workDate||'')||!clock(section.startTime)||!clock(section.endTime)||section.startTime===section.endTime)return null;
  const endDay=section.endTime<section.startTime?planner.shift(run.workDate,1):run.workDate,start=planner.deadline(run.workDate,section.startTime),end=planner.deadline(endDay,section.endTime);
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
 return{clock,windowFor,stateFor,evaluate,formatTime};
});
