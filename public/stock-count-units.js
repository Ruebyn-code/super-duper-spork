(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.stockCountUnits=model;})(typeof globalThis==='object'?globalThis:this,function(){
 function valid(unit){return Boolean(unit&&typeof unit==='object'&&!Array.isArray(unit)&&typeof unit.name==='string'&&unit.name.trim()&&unit.name.length<=30&&!/[\x00-\x1f\x7f\u2028\u2029]/.test(unit.name)&&Number.isInteger(unit.perUnit)&&unit.perUnit>=1&&unit.perUnit<=1000000);}
 function normalize(unit){return valid(unit)?{name:unit.name.trim(),perUnit:unit.perUnit}:null;}
 function equal(a,b){a=normalize(a);b=normalize(b);return a===null?b===null:b!==null&&a.name===b.name&&a.perUnit===b.perUnit;}
 function quantity(value,unit){return Math.round(value/(normalize(unit)?.perUnit||1)*1000)/1000;}
 return {valid,normalize,equal,quantity};
});
