(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.wastageModel=api;})(globalThis,()=>{
 const reasons=[['expired','Expired / out of date'],['spoiled','Spoiled / quality issue'],['preparation','Preparation waste'],['overproduction','Overproduction'],['damaged','Damaged / spilled'],['returned','Returned / incorrect item'],['other','Other']].map(([id,name])=>({id,name}));
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
 return{reasons,reasonName,summarize};
});
