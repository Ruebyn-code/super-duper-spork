(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.weeklySalesReport=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const fields=['tillSales','cash','eftpos','pettyCash','uberEats','doorDash'];
 const platforms=['uberEats','doorDash'],feeFields=['feesCents','marketingCents','refundsCents'];
 const blankPlatformFees=()=>Object.fromEntries(platforms.map(platform=>[platform,Object.fromEntries(feeFields.map(field=>[field,null]))]));
 const expenseFields=['labourCents','operatingExpensesCents','roCents'];
 const blankExpenses=()=>Object.fromEntries(expenseFields.map(field=>[field,null]));
 function expenseLineTotal(entry){return entry&&Number.isSafeInteger(entry.quantityMilli)&&entry.quantityMilli>=0&&Number.isSafeInteger(entry.unitCostCents)&&entry.unitCostCents>=0?Number((BigInt(entry.quantityMilli)*BigInt(entry.unitCostCents)+500n)/1000n):null;}
 function expenseTotal(entries){if(!Array.isArray(entries))return null;const amounts=entries.map(expenseLineTotal);return amounts.some(value=>value===null)?null:amounts.reduce((sum,value)=>sum+value,0);}
 function allocationCost(allocation,weekStart){
  if(allocation.totalCents===null)return allocation.cleared?0:null;const offset=(Date.parse(weekStart+'T00:00:00Z')-Date.parse(allocation.startWeek+'T00:00:00Z'))/604800000;if(!Number.isInteger(offset)||offset<0||offset>=allocation.weeks)return 0;
  return Math.floor(allocation.totalCents/allocation.weeks)+(offset<allocation.totalCents%allocation.weeks?1:0);
 }
 function operatingCost(additionalCents,allocations,weekStart,incomplete=false){if(incomplete)return null;const amounts=allocations.map(allocation=>allocationCost(allocation,weekStart)).filter(value=>value!==null);return additionalCents===null&&!amounts.length?null:(additionalCents??0)+amounts.reduce((sum,value)=>sum+value,0);}
 function resolveOperatingAllocations(history,record,types){
  const eligible=new Set([...types.map(type=>type.id),...(record.operatingAllocations||[]).map(row=>row.typeId)]),selected=new Map(),sources=[...history.filter(source=>source.weekStart<record.weekStart),record];
  for(const source of sources)for(const row of source.operatingAllocations||[]){if(!eligible.has(row.typeId)||row.startWeek>record.weekStart||row.totalCents===null&&!row.cleared)continue;const previous=selected.get(row.typeId),origin=source.weekStart===row.startWeek;
   if(!previous||row.startWeek>previous.row.startWeek||row.startWeek===previous.row.startWeek&&(origin&&!previous.origin||origin===previous.origin&&source.weekStart<previous.weekStart))selected.set(row.typeId,{row,origin,weekStart:source.weekStart});
  }
  const merged=new Map((record.operatingAllocations||[]).map(row=>[row.typeId,row]));for(const [id,value] of selected)merged.set(id,value.row);return [...merged.values()];
 }
 function restoreOperatingDraft(allocations,drafts,week){
  const merged=new Map(allocations.map(row=>[row.typeId,{typeId:row.typeId,description:row.description,totalCost:row.totalCents===null?'':(row.totalCents/100).toFixed(2),weeks:String(row.weeks),startWeek:row.startWeek,...(row.cleared?{cleared:true}:{})}]));
  for(const row of drafts){const edited=row.startWeek===week&&(row.totalCost.trim()!==''||row.cleared);if(edited||!merged.has(row.typeId))merged.set(row.typeId,row);}return [...merged.values()];
 }
 const blank=()=>Object.fromEntries(fields.map(field=>[field,Array(7).fill(null)]));
 const sum=values=>values.some(value=>value!==null)?values.reduce((total,value)=>total+(value??0),0):null;
 function calculate(breakdown){
  const days=[],variances=[];
  for(let index=0;index<7;index++){
   const revenue=['tillSales','uberEats','doorDash'].map(field=>breakdown[field][index]);
   days.push(revenue.every(value=>value!==null)?sum(revenue):null);
   const reconciliation=['cash','eftpos','pettyCash','tillSales'].map(field=>breakdown[field][index]);
   variances.push(reconciliation.every(value=>value!==null)?reconciliation[0]+reconciliation[1]+reconciliation[2]-reconciliation[3]:null);
  }
  return {days,variances,totals:{sales:sum(days),variance:sum(variances),...Object.fromEntries(fields.map(field=>[field,sum(breakdown[field])]))},recordedDays:days.filter(value=>value!==null).length,reconciledDays:variances.filter(value=>value!==null).length};
 }
 function profit(salesCents,{stockOrdersCents,labourCents,operatingExpensesCents,roCents=0,pricePending=false}={}){
  const valid=value=>Number.isSafeInteger(value)&&value>=0;
  if(!valid(salesCents))return {amountCents:null,state:'unavailable',reason:'sales'};
  if(pricePending)return {amountCents:null,state:'unavailable',reason:'prices'};
  if(![stockOrdersCents,labourCents,operatingExpensesCents,roCents].every(valid))return {amountCents:null,state:'unavailable',reason:'costs'};
  const amountCents=salesCents-stockOrdersCents-labourCents-operatingExpensesCents-roCents;
  return {amountCents,state:amountCents>0?'profit':amountCents<0?'loss':'break-even',reason:null};
 }
 function stockSupplierCosts(orders){
  const suppliers=new Map(),seen=new Set(),namedIds=new Map(),clean=value=>typeof value==='string'?value.trim():'';
  for(const order of orders)for(const item of order.items||[]){const name=clean(item.supplier).toLowerCase(),id=clean(item.supplierId);if(name&&id){if(!namedIds.has(name))namedIds.set(name,new Set());namedIds.get(name).add(id);}}
  for(const order of orders){if(seen.has(order.id))continue;seen.add(order.id);const missingPrice=(order.items||[]).some(item=>!Number.isSafeInteger(item.unitCostCents)||item.unitCostCents<0||!Number.isSafeInteger(item.quantity)||item.quantity<0);for(const item of order.items||[]){
   const supplier=clean(item.supplier),nameKey=supplier.toLowerCase(),ids=namedIds.get(nameKey),supplierId=clean(item.supplierId)||(ids?.size===1?[...ids][0]:''),key=supplierId?'id:'+supplierId:'name:'+nameKey;
   if(!suppliers.has(key))suppliers.set(key,{key,supplier:supplier||null,totalCents:null,pricePending:false,orders:new Set(),items:new Map()});const group=suppliers.get(key);if(supplier&&!group.supplier)group.supplier=supplier;group.orders.add(order.id);
   const itemKey=clean(item.id)?'id:'+item.id:'name:'+clean(item.name).toLowerCase();if(!group.items.has(itemKey))group.items.set(itemKey,{key:itemKey,name:clean(item.name),quantity:0,totalCents:null,pricePending:false});const entry=group.items.get(itemKey),knownQuantity=Number.isSafeInteger(item.quantity)&&item.quantity>=0,knownPrice=Number.isSafeInteger(item.unitCostCents)&&item.unitCostCents>=0,total=knownQuantity&&knownPrice?item.quantity*item.unitCostCents:null;
   if(knownQuantity)entry.quantity+=item.quantity;if(total!==null&&Number.isSafeInteger(total)){entry.totalCents=(entry.totalCents??0)+total;group.totalCents=(group.totalCents??0)+total;}else{entry.pricePending=true;group.pricePending=true;}if(order.pricePending&&!missingPrice){entry.pricePending=true;group.pricePending=true;}
  }}
  return [...suppliers.values()].map(group=>({key:group.key,supplier:group.supplier,totalCents:group.totalCents,pricePending:group.pricePending,orderCount:group.orders.size,items:[...group.items.values()].sort((a,b)=>a.name.localeCompare(b.name,'en-AU'))})).sort((a,b)=>(a.supplier||'').localeCompare(b.supplier||'','en-AU')||a.key.localeCompare(b.key));
 }
 function settlement(salesCents,fees){const values=feeFields.map(field=>fees?.[field]),totalFeesCents=values.every(value=>Number.isSafeInteger(value)&&value>=0)?values.reduce((total,value)=>total+value,0):null;return {salesCents,totalFeesCents,expectedPayCents:Number.isSafeInteger(salesCents)&&salesCents>=0&&totalFeesCents!==null?salesCents-totalFeesCents:null};}
 return {fields,expenseFields,blankExpenses,expenseLineTotal,expenseTotal,allocationCost,operatingCost,resolveOperatingAllocations,restoreOperatingDraft,platforms,feeFields,blankPlatformFees,blank,calculate,profit,settlement,stockSupplierCosts};
});
