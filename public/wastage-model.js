(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.wastageModel=api;})(globalThis,()=>{
 // Each reason has a fixed icon from the shared category icon list (display only).
 const reasons=[['expired','Expired / out of date','hourglass'],['spoiled','Spoiled / quality issue','biohazard'],['preparation','Preparation waste','knife'],['overproduction','Overproduction','copy-x'],['damaged','Damaged / spilled','droplet'],['returned','Returned / incorrect item','rotate-ccw'],['other','Other','question-mark']].map(([id,name,icon])=>({id,name,icon}));
 const reasonName=id=>reasons.find(r=>r.id===id)?.name||id;
 function summarize(records){
  const active=records.filter(r=>r.status==='recorded'),reasonsMap=new Map(),itemsMap=new Map();let knownCostCents=0,unpricedItems=0,lineCount=0;
  for(const record of active)for(const item of record.items){
   lineCount++;const cost=item.totalCents,missing=cost===null;knownCostCents+=cost??0;unpricedItems+=Number(missing);
   const reason=reasonsMap.get(item.reason)||{id:item.reason,name:reasonName(item.reason),lines:0,knownCostCents:0,unpricedItems:0};reason.lines++;reason.knownCostCents+=cost??0;reason.unpricedItems+=Number(missing);reasonsMap.set(item.reason,reason);
   // Pack changes must not combine unlike quantities into a misleading item total.
   const key=JSON.stringify([item.id,item.unitAmount]),product=itemsMap.get(key)||{id:item.id,name:item.name,unitAmount:item.unitAmount,quantity:0,knownCostCents:0,unpricedItems:0};product.quantity=Math.round((product.quantity+item.quantity)*1000)/1000;product.knownCostCents+=cost??0;product.unpricedItems+=Number(missing);itemsMap.set(key,product);
  }
  const sort=(a,b)=>b.knownCostCents-a.knownCostCents||a.name.localeCompare(b.name);
  return{recordCount:active.length,voidCount:records.length-active.length,lineCount,knownCostCents,unpricedItems,totalCents:unpricedItems?null:knownCostCents,reasons:[...reasonsMap.values()].sort(sort),items:[...itemsMap.values()].sort(sort)};
 }
 // Practical tip for an item wasted again and again, chosen by its most common reason (display only; never changes targets).
 const tips={expired:'Often expires — order smaller amounts or lower its target level.',spoiled:'Often spoils — check storage, stock rotation (first in, first out) and delivery quality.',preparation:'Lots of preparation waste — review trimming and portioning.',overproduction:'Often over-made — make less on quieter days or check its prep amount.',damaged:'Often damaged — check handling and how it is stored.',returned:'Often returned — check orders with the supplier.',other:'Wasted often — check the entry notes for a pattern.'};
 const tip=reason=>tips[reason]||tips.other;
 return{reasons,reasonName,summarize,tips,tip};
});
