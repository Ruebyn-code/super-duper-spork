(function(root){
 const kinds={check:'Checkbox',media:'Photo / video',file:'File submission',text:'Short text',textarea:'Long text',number:'Number entry',selection:'Selection',signature:'Signature',datetime:'Date and time',section:'Section','timed-section':'Timed section',instruction:'Instruction'};
 const formats={integer:'Whole number',decimal:'Decimal',currency:'Currency',percentage:'Percentage',temperature:'Temperature',weight:'Weight',volume:'Volume',length:'Length',duration:'Duration',custom:'Custom unit'};
 const units={temperature:['°C','°F'],weight:['kg','g','mg','lb','oz'],volume:['L','mL','gal'],length:['m','cm','mm','km','ft','in'],duration:['minutes','hours','seconds']};
 const isSection=step=>['section','timed-section'].includes(step.type);
 const responseStep=step=>step.type!=='instruction'&&!isSection(step);
 function editable(value){const step={...value};if(step.type==='photo'){step.type='media';step.mediaKind='photo';}if(['choice','multiple','yesno'].includes(step.type)){step.multiple=step.type==='multiple';step.options=step.type==='yesno'?['Yes','No']:step.options;step.type='selection';step.source='custom';}if(['date','time'].includes(step.type)){step.dateMode=step.type;step.type='datetime';}if(step.type==='signature')step.signatureMode||='typed';return step;}
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
  if(step.type==='choice')return step.options.includes(value);
  if(step.type==='multiple')return Array.isArray(value)&&value.length>0&&new Set(value).size===value.length&&value.every(item=>step.options.includes(item));
  if(step.type==='selection')return step.multiple?Array.isArray(value)&&value.length>0&&new Set(value).size===value.length&&value.every(nonempty):nonempty(value);
  if(step.type==='photo')return nonempty(value);
  if(['media','file'].includes(step.type))return Array.isArray(value)&&value.length>0&&value.length<=(step.maxFiles??1)&&new Set(value).size===value.length&&value.every(nonempty);
  if(step.type==='signature')return typeof value==='string'?step.signatureMode!=='drawn'&&nonempty(value)&&value.length<=500:value&&['drawn','either'].includes(step.signatureMode)&&nonempty(value.name)&&value.name.length<=500&&(nonempty(value.assetId)||value.drawn===true);
  if(step.type==='date'||step.type==='datetime'&&step.dateMode==='date')return validDate(value);
  if(step.type==='time'||step.type==='datetime'&&step.dateMode==='time')return validTime(value);
  if(step.type==='datetime')return typeof value==='string'&&value.length===16&&validDate(value.slice(0,10))&&value[10]==='T'&&validTime(value.slice(11));
  return false;
 }
 // Moving a section carries its following steps up to the next section.
 function movingIds(steps,id){const index=steps.findIndex(step=>step.id===id);if(index<0)return[];let end=index+1;if(isSection(steps[index]))while(end<steps.length&&!isSection(steps[end]))end++;return steps.slice(index,end).map(step=>step.id);}
 function move(steps,id,beforeId){const ids=new Set(movingIds(steps,id));if(!ids.size||ids.has(beforeId))return steps;const moving=steps.filter(step=>ids.has(step.id)),remaining=steps.filter(step=>!ids.has(step.id)),at=beforeId===null?remaining.length:remaining.findIndex(step=>step.id===beforeId);if(at<0)return steps;return[...remaining.slice(0,at),...moving,...remaining.slice(at)];}
 const api={kinds,formats,units,isSection,responseStep,editable,decimals,validNumber,formatNumber,assetIds,answered,movingIds,move};if(typeof module==='object'&&module.exports)module.exports=api;else root.opsStepModel=api;
})(globalThis);
