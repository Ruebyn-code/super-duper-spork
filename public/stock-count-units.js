(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.stockCountUnits=model;})(typeof globalThis==='object'?globalThis:this,function(){
 // Counting units: smaller packs (a name and a whole number per ordered unit, e.g. Sleeves / 20) or a measure —
 // weight in kg or g, volume in L or mL — with up to three decimals per ordered unit (e.g. 2.5 kg per bag).
 const measures={weight:['kg','g'],volume:['L','mL']};
 const exact=value=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=1000000&&Math.abs(Math.round(value*1000)-value*1000)<1e-6;
 function valid(unit){
  if(!unit||typeof unit!=='object'||Array.isArray(unit))return false;
  if(unit.measure!==undefined&&unit.measure!==null)return Object.hasOwn(measures,unit.measure)&&measures[unit.measure].includes(unit.name)&&exact(unit.perUnit);
  return typeof unit.name==='string'&&Boolean(unit.name.trim())&&unit.name.length<=30&&!/[\x00-\x1f\x7f\u2028\u2029]/.test(unit.name)&&Number.isInteger(unit.perUnit)&&unit.perUnit>=1&&unit.perUnit<=1000000;
 }
 function normalize(unit){if(!valid(unit))return null;return unit.measure?{name:unit.name,perUnit:Math.round(unit.perUnit*1000)/1000,measure:unit.measure}:{name:unit.name.trim(),perUnit:unit.perUnit};}
 function equal(a,b){a=normalize(a);b=normalize(b);return a===null?b===null:b!==null&&a.name===b.name&&a.perUnit===b.perUnit&&(a.measure||null)===(b.measure||null);}
 function quantity(value,unit){return Math.round(value/(normalize(unit)?.perUnit||1)*1000)/1000;}
 return {measures,valid,normalize,equal,quantity};
});
