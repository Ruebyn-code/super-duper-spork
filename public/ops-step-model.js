(function(root){
 const kinds={check:'Checkbox',media:'Photo / video',file:'File submission',text:'Short text',textarea:'Long text',number:'Number entry',selection:'Selection',signature:'Signature',datetime:'Date and time',section:'Section','timed-section':'Timed section',instruction:'Instruction','yes-no-na':'Yes / No / N/A',buttons:'Buttons',checklist:'Checklist'};
 const formats={integer:'Whole number',decimal:'Decimal',currency:'Currency',percentage:'Percentage',temperature:'Temperature',weight:'Weight',volume:'Volume',length:'Length',duration:'Duration',custom:'Custom unit'};
 const units={temperature:['°C','°F'],weight:['kg','g','mg','lb','oz'],volume:['L','mL','gal'],length:['m','cm','mm','km','ft','in'],duration:['minutes','hours','seconds']};
 // Button steps: ready-made custom Selection steps answered by tapping one button. `buttons` is the saved style id;
 // the options stay ordinary editable choices, so show-when rules, pass rules and reports work unchanged.
 const ratings=count=>Array.from({length:count},(_,index)=>String(index+1));
 const buttonSets={
  // points: what each button adds to a scored checklist's total (same order as options).
  interfere:{label:'Completed without having to interfere',icon:'list',title:'Completed without having to interfere',options:['Yes','No'],points:[1,0],pass:['Yes']},
  knows:{label:'They Know What It is',icon:'list',title:'They know what it is',options:['Yes','No'],points:[1,0],pass:['Yes']},
  'rating-5':{label:'Number rating (1 to 5)',icon:'star',options:ratings(5),points:ratings(5).map(Number)},
  'rating-10':{label:'Number rating (1 to 10)',icon:'star',options:ratings(10),points:ratings(10).map(Number)},
  'rating-20':{label:'Number rating (1 to 20)',icon:'star',options:ratings(20),points:ratings(20).map(Number)},
  'yes-no':{label:'Yes, No',icon:'list',options:['Yes','No'],points:[1,0]},
  'pass-fail':{label:'Pass, Fail',icon:'check',options:['Pass','Fail'],points:[1,0],pass:['Pass']},
  compliant:{label:'Compliant, Not Compliant',icon:'shield',options:['Compliant','Not compliant'],points:[1,0],pass:['Compliant']},
  satisfaction:{label:'Satisfaction',icon:'smile',options:['Very dissatisfied','Dissatisfied','Neutral','Satisfied','Very satisfied'],points:[1,2,3,4,5]},
  buttons:{label:'Buttons',icon:'list',options:[]}
 };
 // Button steps are their own `buttons` type (one preset per type choice); a plain custom single Selection may also show as generic buttons.
 const buttonStyle=step=>step?.type==='buttons'&&Object.hasOwn(buttonSets,step.buttons||'')&&step.buttons!=='buttons'?step.buttons:step?.type==='selection'&&(step.source||'custom')==='custom'&&!step.multiple&&Object.hasOwn(buttonSets,step.buttons||'')?step.buttons:'';
 const buttonTypeName=step=>step?.type==='buttons'&&Object.hasOwn(buttonSets,step.buttons||'')?buttonSets[step.buttons].label:'';
 const isSection=step=>['section','timed-section'].includes(step.type);
 const responseStep=step=>step.type!=='instruction'&&step.type!=='checklist'&&!isSection(step);
 const isEmbed=step=>step?.type==='checklist';
 // Steps copied from an included checklist get stable IDs derived from the including step and the original step.
 function embedId(parent,inner){const input=parent+':'+inner;let out='';for(let seed=0;seed<4;seed++){let h=(2166136261^(seed*16777619))>>>0;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}out+=h.toString(16).padStart(8,'0');}return out.slice(0,8)+'-'+out.slice(8,12)+'-4'+out.slice(13,16)+'-'+(8+(parseInt(out[16],16)&3)).toString(16)+out.slice(17,20)+'-'+out.slice(20,32);}
 // Expand "Checklist" steps into a heading plus a copy of the included checklist's current steps (up to three levels,
 // skipping loops). lookup(id) returns {title, steps} for an available checklist or null when it is unavailable.
 // Copies (and nested headings) carry embeddedIn: the top-level include's ID, so readers can show them in a popup.
 function expand(steps,lookup,limit=300){const out=[];function walk(list,parent,path,depth,root){const map=new Map();for(const step of list){const id=parent?embedId(parent,step.id):step.id,inside=root?{embeddedIn:root}:{};map.set(step.id,id);if(!isEmbed(step)){const copy={...structuredClone(step),id,...inside};if(copy.showWhen&&map.has(copy.showWhen.stepId))copy.showWhen={...copy.showWhen,stepId:map.get(copy.showWhen.stepId)};else if(copy.showWhen&&parent)delete copy.showWhen;out.push(copy);continue;}
   const ref=depth<3&&!path.includes(step.checklistId)?lookup(step.checklistId):null;
   if(!ref){out.push({id,type:'instruction',title:(step.title||'Checklist')+' — this checklist is not available.',help:step.help||'',required:false,...inside});continue;}
   out.push({id,type:'section',title:step.title||ref.title,help:step.help||'',required:false,embedded:{checklistId:step.checklistId},...inside});walk(ref.steps||[],id,[...path,step.checklistId],depth+1,root||id);}
  }walk(steps||[],'',[],0,'');if(out.length>limit)throw Object.assign(Error('This checklist is too long once its included checklists are added (up to '+limit+' steps).'),{status:400});return out;}
 function editable(value){const step={...value};if(step.type==='selection'&&(step.source||'custom')==='custom'&&!step.multiple&&step.buttons&&step.buttons!=='buttons'&&Object.hasOwn(buttonSets,step.buttons)){step.type='buttons';delete step.source;delete step.multiple;}if(step.type==='photo'){step.type='media';step.mediaKind='photo';}if(['choice','multiple','yesno'].includes(step.type)){step.multiple=step.type==='multiple';step.options=step.type==='yesno'?['Yes','No']:step.options;step.type='selection';step.source='custom';}if(['date','time'].includes(step.type)){step.dateMode=step.type;step.type='datetime';}if(step.type==='signature')step.signatureMode||='typed';return step;}
 function decimals(step){return step.format==='integer'?0:step.decimals??(step.format==='currency'?2:step.format?2:null);}
 function validNumber(step,value){const places=decimals(step);return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e12&&(step.min==null||value>=step.min)&&(step.max==null||value<=step.max)&&(places===null||Math.abs(value*10**places-Math.round(value*10**places))<=Math.max(1e-7,Math.abs(value*10**places)*Number.EPSILON*4));}
 function formatNumber(step,value){if(value===null||value===undefined||value==='')return '';const places=decimals(step),options={maximumFractionDigits:places??6,minimumFractionDigits:places??0};if(step.format==='currency'){options.style='currency';options.currency=step.currency||'AUD';}const number=new Intl.NumberFormat('en-AU',options).format(value);return number+(step.format==='percentage'?'%':step.unit?' '+step.unit:'');}
 function assetIds(step,value){if(step.type==='photo')return typeof value==='string'?[value]:[];if(['media','file'].includes(step.type))return Array.isArray(value)?value:[];return step.type==='signature'&&value&&typeof value==='object'&&typeof value.assetId==='string'?[value.assetId]:[];}
 function answered(step,value){
  if(!responseStep(step)||value==null)return false;
  const nonempty=value=>typeof value==='string'&&Boolean(value.trim()),validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value,validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if(step.type==='check')return value===true;
  if(['text','textarea'].includes(step.type))return nonempty(value)&&value.length<=(step.type==='textarea'?5000:500);
  if(step.type==='number')return validNumber(step,value);
  if(step.type==='yesno')return['yes','no'].includes(value);
  if(step.type==='yes-no-na')return['yes','no','na'].includes(value);
  if(step.type==='choice')return step.options.includes(value);
  if(step.type==='multiple')return Array.isArray(value)&&value.length>0&&new Set(value).size===value.length&&value.every(item=>step.options.includes(item));
  if(step.type==='buttons')return typeof value==='string'&&(step.options||[]).includes(value);
  if(step.type==='selection')return step.multiple?Array.isArray(value)&&value.length>0&&new Set(value).size===value.length&&value.every(nonempty):nonempty(value);
  if(step.type==='photo')return nonempty(value);
  if(['media','file'].includes(step.type))return Array.isArray(value)&&value.length>0&&value.length<=(step.maxFiles??1)&&new Set(value).size===value.length&&value.every(nonempty);
  if(step.type==='signature')return typeof value==='string'?step.signatureMode!=='drawn'&&nonempty(value)&&value.length<=500:value&&['drawn','either'].includes(step.signatureMode)&&nonempty(value.name)&&value.name.length<=500&&(nonempty(value.assetId)||value.drawn===true);
  if(step.type==='date'||step.type==='datetime'&&step.dateMode==='date')return validDate(value);
  if(step.type==='time'||step.type==='datetime'&&step.dateMode==='time')return validTime(value);
  if(step.type==='datetime')return typeof value==='string'&&value.length===16&&validDate(value.slice(0,10))&&value[10]==='T'&&validTime(value.slice(11));
  return false;
 }
 function allAnswered(list,answers){const responses=list.filter(responseStep);return responses.length>0&&responses.every(step=>answered(step,answers?.[step.id]));}
 // Moving a section carries its following steps up to the next section.
 function movingIds(steps,id){const index=steps.findIndex(step=>step.id===id);if(index<0)return[];let end=index+1;if(isSection(steps[index]))while(end<steps.length&&!isSection(steps[end]))end++;return steps.slice(index,end).map(step=>step.id);}
 function move(steps,id,beforeId){const ids=new Set(movingIds(steps,id));if(!ids.size||ids.has(beforeId))return steps;const moving=steps.filter(step=>ids.has(step.id)),remaining=steps.filter(step=>!ids.has(step.id)),at=beforeId===null?remaining.length:remaining.findIndex(step=>step.id===beforeId);if(at<0)return steps;return[...remaining.slice(0,at),...moving,...remaining.slice(at)];}
 const api={kinds,buttonSets,buttonStyle,buttonTypeName,formats,units,isSection,responseStep,isEmbed,embedId,expand,editable,decimals,validNumber,formatNumber,assetIds,answered,allAnswered,movingIds,move};if(typeof module==='object'&&module.exports)module.exports=api;else root.opsStepModel=api;
})(globalThis);
