(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.weeklySalesReport=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const fields=['tillSales','cash','eftpos','pettyCash','uberEats','doorDash'];
 const platforms=['uberEats','doorDash'],feeFields=['feesCents','marketingCents','refundsCents'];
 const blankPlatformFees=()=>Object.fromEntries(platforms.map(platform=>[platform,Object.fromEntries(feeFields.map(field=>[field,null]))]));
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
 function settlement(salesCents,fees){const values=feeFields.map(field=>fees?.[field]),totalFeesCents=values.every(value=>Number.isSafeInteger(value)&&value>=0)?values.reduce((total,value)=>total+value,0):null;return {salesCents,totalFeesCents,expectedPayCents:Number.isSafeInteger(salesCents)&&salesCents>=0&&totalFeesCents!==null?salesCents-totalFeesCents:null};}
 return {fields,platforms,feeFields,blankPlatformFees,blank,calculate,profit,settlement};
});
