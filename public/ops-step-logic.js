// Checklist step logic shared by the server, the run reader, the builder preview and reports.
// showWhen: show a step only when an earlier answer matches a rule. passRule: pass/fail an answer.
// failAction: a failed answer needs a corrective note and/or photo before the checklist can be completed.
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory(require('./ops-step-model'));
 else root.opsStepLogic=factory(root.opsStepModel);
})(globalThis,model=>{
 const yesNoNa=[['yes','Yes'],['no','No'],['na','N/A']];
 const operatorNames={checked:'is ticked',unchecked:'is not ticked',is:'is',isNot:'is not',lt:'is below',gt:'is above',fails:'fails',passes:'passes'};
 const ruleTypes=['number','yes-no-na','selection','buttons'];
 const customSelection=step=>step?.type==='buttons'||step?.type==='selection'&&(step.source||'custom')==='custom';
 const canHaveRule=step=>step.type==='number'||step.type==='yes-no-na'||customSelection(step);
 const canHaveCondition=step=>!model.isSection(step)&&step.type!=='checklist';
 // In-store training steps with built-in pass rules (competency at Competent or above, enough supervised attempts,
 // a correct knowledge answer, a timed task at or under target). They can drive show-when rules in training checklists.
 const competencyLevels=[['not-yet','Not yet competent'],['developing','Developing'],['competent','Competent'],['highly-competent','Highly competent']];
 const questionAnswers=[['correct','Correct'],['incorrect','Not yet']];
 const trainingRule=step=>['competency','attempts','question','timed'].includes(step?.type);
 function builtIn(step,value){
  if(step.type==='competency'){const at=competencyLevels.findIndex(([id])=>id===value);return at<0?null:at>=2?'pass':'fail';}
  if(step.type==='question')return value==='correct'?'pass':value==='incorrect'?'fail':null;
  if(!Number.isInteger(value))return null;
  if(step.type==='attempts')return value>=step.target?'pass':'fail';
  return value<=step.targetSeconds?'pass':'fail';
 }
 const answeredValue=(source,value)=>trainingRule(source)?builtIn(source,value)!==null:model.answered(source,value);
 // Operators an earlier step offers as a source.
 function operators(source){
  if(!source||!model.responseStep(source))return[];
  if(trainingRule(source))return source.type==='competency'||source.type==='question'?['is','isNot','fails','passes']:['fails','passes'];
  const list=source.type==='check'?['checked','unchecked']:source.type==='yes-no-na'||customSelection(source)?['is','isNot']:source.type==='number'?['lt','gt']:[];
  return source.passRule?[...list,'fails','passes']:list;
 }
 const needsValue=operator=>['is','isNot','lt','gt'].includes(operator);
 function valueOptions(source){return source?.type==='competency'?competencyLevels:source?.type==='question'?questionAnswers:source?.type==='yes-no-na'?yesNoNa:customSelection(source)?(source.options||[]).map(value=>[value,value]):[];}
 // 'pass', 'fail', 'na' (Yes/No/N/A answered N/A) or null (no rule or not answered yet).
 function outcome(step,value){
  if(trainingRule(step))return builtIn(step,value);
  const rule=step?.passRule;if(!rule)return null;
  if(step.type==='yes-no-na'){if(value==='na')return'na';if(value!=='yes'&&value!=='no')return null;return value===rule.pass?'pass':'fail';}
  if(step.type==='number'){if(typeof value!=='number'||!Number.isFinite(value))return null;return(rule.min==null||value>=rule.min)&&(rule.max==null||value<=rule.max)?'pass':'fail';}
  if(customSelection(step)){const list=(Array.isArray(value)?value:[value]).filter(item=>typeof item==='string'&&item);if(!list.length)return null;return list.every(item=>(rule.options||[]).includes(item))?'pass':'fail';}
  return null;
 }
 function matches(condition,source,value){
  switch(condition.operator){
   case'checked':return value===true;
   case'unchecked':return value!==true;
   case'is':return Array.isArray(value)?value.includes(condition.value):value===condition.value;
   case'isNot':return answeredValue(source,value)&&(Array.isArray(value)?!value.includes(condition.value):value!==condition.value);
   case'lt':return typeof value==='number'&&value<condition.value;
   case'gt':return typeof value==='number'&&value>condition.value;
   case'fails':return outcome(source,value)==='fail';
   case'passes':return outcome(source,value)==='pass';
   default:return false;
  }
 }
 // Step IDs hidden by show-when rules, in order. A missing, later or hidden source hides the step.
 function hidden(steps,answers={}){
  const seen=new Map(),result=new Set();
  for(const step of steps||[]){
   if(step.showWhen){const source=seen.get(step.showWhen.stepId);if(!source||result.has(source.id)||!matches(step.showWhen,source,answers?.[source.id]))result.add(step.id);}
   seen.set(step.id,step);
  }
  // Sections stay; their steps follow their own rules.
  return result;
 }
 function actionNeed(step,value){if(!step?.failAction||outcome(step,value)!=='fail')return null;return{note:step.failAction.note===true,photo:step.failAction.photo===true};}
 const noteText=action=>typeof action?.note==='string'?action.note.trim():'';
 function actionMissing(step,value,action){const need=actionNeed(step,value);if(!need)return[];const missing=[];if(need.note&&!noteText(action))missing.push('note');if(need.photo&&!(Array.isArray(action?.photos)&&action.photos.length))missing.push('photo');return missing;}
 // Overall state for the steps a person can see.
 function evaluate(steps,answers={},actions={}){
  const off=hidden(steps,answers),visible=(steps||[]).filter(step=>!off.has(step.id)),responses=visible.filter(model.responseStep),fails=[],missing=[];
  for(const step of responses){const value=answers?.[step.id];if(outcome(step,value)==='fail')fails.push(step.id);const gaps=actionMissing(step,value,actions?.[step.id]);if(gaps.length)missing.push({id:step.id,missing:gaps});}
  return{hidden:off,visible,responses,answered:responses.filter(step=>model.answered(step,answers?.[step.id])).length,fails,missingActions:missing};
 }
 // Scored checklists: each visible button step (and Yes / No / N/A) adds its answer's points; unanswered steps add 0
 // but still count toward the maximum; N/A leaves that step out of both. Points come from the step's saved copy,
 // falling back to the shared catalogue for steps saved before points were recorded.
 function stepPoints(step){
  if(step?.type==='yes-no-na')return{options:['yes','no'],points:Array.isArray(step.points)&&step.points.length===2?step.points:[1,0],skip:['na']};
  if(step?.type!=='buttons')return null;const set=model.buttonSets[step.buttons];const options=step.options||set?.options||[],points=Array.isArray(step.points)&&step.points.length===options.length?step.points:set&&set.options.length===options.length?set.points:null;
  return points?{options,points,skip:[]}:null;
 }
 function score(steps,answers={}){
  const off=hidden(steps,answers);let points=0,max=0,scored=0,answered=0;
  for(const step of steps||[]){if(off.has(step.id))continue;const scale=stepPoints(step);if(!scale)continue;const value=answers?.[step.id];if(scale.skip.includes(value))continue;scored++;max+=Math.max(...scale.points);const at=scale.options.indexOf(value);if(at>=0){points+=scale.points[at];answered++;}}
  points=Math.round(points*100)/100;max=Math.round(max*100)/100;return{points,max,scored,answered,percent:max>0?Math.round(points/max*100):null};
 }
 // Every visible response answered and every needed corrective action recorded.
 function complete(steps,answers={},actions={}){const state=evaluate(steps,answers,actions);return state.responses.length>0&&state.answered===state.responses.length&&!state.missingActions.length;}
 // Remove rules that no longer fit the steps (source deleted, moved later or changed type). Used before saving drafts.
 function sanitize(steps){
  const before=new Map();
  return(steps||[]).map(step=>{
   let next=step;
   if(next.showWhen){const source=before.get(next.showWhen.stepId),operator=next.showWhen.operator,values=valueOptions(source).map(([value])=>value);if(!canHaveCondition(next)||!source||!operators(source).includes(operator)||(['is','isNot'].includes(operator)&&!values.includes(next.showWhen.value))||(['lt','gt'].includes(operator)&&typeof next.showWhen.value!=='number')){next={...next};delete next.showWhen;}}
   if(next.passRule&&!canHaveRule(next)){next={...next};delete next.passRule;delete next.failAction;}
   if(next.passRule&&customSelection(next)&&!(next.passRule.options||[]).some(value=>(next.options||[]).includes(value))){next={...next};delete next.passRule;delete next.failAction;}
   if(next.failAction&&!next.passRule){next={...next};delete next.failAction;}
   before.set(next.id,next);return next;
  });
 }
 const numberText=(step,value)=>model.formatNumber(step,value);
 // Plain-language rule text for the builder, preview and reader.
 function conditionText(step,steps){const condition=step.showWhen;if(!condition)return'';const source=(steps||[]).find(item=>item.id===condition.stepId),name=source?.title||'an earlier step';let value='';if(['is','isNot'].includes(condition.operator))value=' '+(['yes-no-na','competency','question'].includes(source?.type)?(valueOptions(source).find(([key])=>key===condition.value)?.[1]||condition.value):condition.value);if(['lt','gt'].includes(condition.operator))value=' '+numberText(source||{},condition.value);return'Shown when “'+name+'” '+operatorNames[condition.operator]+value;}
 function ruleText(step){const rule=step.passRule;if(!rule)return'';if(step.type==='yes-no-na')return'Passes when '+(rule.pass==='yes'?'Yes':'No')+' · N/A doesn’t count';if(step.type==='number'){if(rule.min!=null&&rule.max!=null)return'Passes from '+numberText(step,rule.min)+' to '+numberText(step,rule.max);if(rule.min!=null)return'Passes at '+numberText(step,rule.min)+' or more';return'Passes at '+numberText(step,rule.max)+' or less';}return'Passes when '+(rule.options||[]).join(', ');}
 function actionText(step){const action=step.failAction;if(!action)return'';const parts=[action.note&&'a note',action.photo&&'a photo'].filter(Boolean);return parts.length?'If it fails, add '+parts.join(' and ')+' explaining what was done':'';}
 return{score,stepPoints,competencyLevels,trainingRule,yesNoNa,operatorNames,ruleTypes,canHaveRule,canHaveCondition,customSelection,operators,needsValue,valueOptions,outcome,matches,hidden,actionNeed,actionMissing,evaluate,complete,sanitize,conditionText,ruleText,actionText};
});
