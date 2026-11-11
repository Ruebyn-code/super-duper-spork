// Optional checklist features shared by the server and the Checklists page: the feature switches, starter templates,
// plain-language answers and the checklist score used by trends.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./ops-step-logic'),require('./ops-step-model'));else root.checklistExtrasModel=factory(root.opsStepLogic,root.opsStepModel);})(globalThis,(stepLogic,stepModel)=>{
 const features=[
  {id:'issues',name:'Issue follow-ups',description:'Failed checks become issues with an owner and due date that a manager resolves with a note.'},
  {id:'alerts',name:'Missed and failed alerts',description:'Notify managers when a checklist is missed or a check fails today.'},
  {id:'review',name:'Manager review',description:'Managers approve completed checklists or ask for them to be redone, with a comment.'},
  {id:'foodSafety',name:'Logs and PDF export',description:'Number checks such as temperatures as a log and chart, and print or save any completed checklist as a PDF.'},
  {id:'roster',name:'Assign from the roster',description:'Name whoever is rostered on (any, opening or closing shift) for a checklist and notify them.'},
  {id:'qr',name:'QR codes',description:'Printable QR codes that open a checklist at its station and record the scan.'},
  {id:'handover',name:'Shift handover notes',description:'Leave a note for the next shift at the end of a checklist; it shows at the top of the next one.'},
  {id:'starters',name:'Starter templates',description:'Add ready-made opening, closing, cleaning and food-safety checklists in one click.'},
  {id:'trends',name:'Score trends',description:'Each store’s weekly checklist score over time with a store leaderboard.'}
 ];
 const featureIds=features.map(item=>item.id);
 // Saved switches with every omitted feature on.
 const featureState=saved=>Object.fromEntries(featureIds.map(id=>[id,saved?.[id]!==false]));
 const rosterModes=[{id:'off',label:'Not assigned from the roster'},{id:'any',label:'Anyone rostered on during the checklist'},{id:'opening',label:'Whoever starts first (opening shift)'},{id:'closing',label:'Whoever finishes last (closing shift)'}];
 // An answer in plain words for issue lists, logs and printing.
 function answerText(step,value,labels){
  if(value===undefined||value===null||value==='')return'';
  if(step.type==='yes-no-na')return{yes:'Yes',no:'No',na:'N/A'}[value]||String(value);
  if(step.type==='check')return value===true?'Done':'Not done';
  if(step.type==='number'){if(typeof value!=='number')return String(value);return value+(step.unit?' '+step.unit:'');}
  if(Array.isArray(labels)&&labels.length)return labels.join(', ');
  if(Array.isArray(value))return value.map(String).join(', ');
  if(typeof value==='object')return value.name||value.label||'Recorded';
  return String(value);
 }
 // One run's checklist score: its points percentage when scored, otherwise the share of checks that passed.
 function runScore(run){
  const steps=run.steps||[],answers=run.answers||{};
  if(run.scoring){const score=stepLogic.score(steps,answers);if(score&&Number.isFinite(score.percent)&&score.max>0)return score.percent;}
  const result=stepLogic.evaluate(steps,answers,run.actions||{}),total=result.responses.length;
  return total?Math.round((1-result.fails.length/total)*1000)/10:null;
 }
 // Ready-made checklists. Step IDs are made fresh when one is added.
 const step=(type,title,extra={})=>({type,title,required:type!=='section'&&type!=='instruction',help:'',...extra});
 const temp=(title,max,min=null)=>step('number',title,{format:'temperature',decimals:1,unit:'°C',min:null,max:null,passRule:{min,max},failAction:{note:true,photo:false}});
 const yes=title=>step('yes-no-na',title,{passRule:{pass:'yes'},failAction:{note:true,photo:false}});
 const starters=[
  {id:'opening',title:'Opening checklist',description:'Get the store ready to trade.',steps:[step('section','Before opening'),yes('Doors, lights and music on'),yes('Floors, tables and counters clean'),yes('Tills and EFTPOS working'),temp('Cool room temperature',5),temp('Display fridge temperature',5),step('section','Ready to trade'),yes('Stock topped up and dated'),yes('Hand-wash stations stocked'),step('text','Anything to report?',{required:false})]},
  {id:'closing',title:'Closing checklist',description:'Close the store safely and set up tomorrow.',steps:[step('section','Kitchen'),yes('Cooking equipment off and cleaned'),yes('Food covered, labelled and stored'),temp('Cool room temperature',5),step('section','Front of house'),yes('Floors swept and mopped'),yes('Rubbish and recycling out'),yes('Tills counted and secured'),yes('Doors locked and alarm set'),step('text','Anything to report?',{required:false})]},
  {id:'cleaning',title:'Cleaning checklist',description:'Daily cleaning of the kitchen and dining areas.',steps:[step('section','Kitchen'),yes('Benches and boards sanitised'),yes('Fryers and grills cleaned'),yes('Sinks and drains cleaned'),step('section','Dining and toilets'),yes('Tables and chairs wiped'),yes('Toilets cleaned and stocked'),step('media','Photo of the finished kitchen',{required:false})]},
  {id:'food-safety',title:'Food safety temperatures',description:'Record fridge, freezer and cooking temperatures.',steps:[step('section','Cold storage'),temp('Cool room',5),temp('Display fridge',5),temp('Freezer',-15),step('section','Hot food'),temp('Hot holding',null,60),temp('Cooked chicken core temperature',null,75),step('signature','Checked by')]}
 ];
 return{features,featureIds,featureState,rosterModes,answerText,runScore,starters};
});
