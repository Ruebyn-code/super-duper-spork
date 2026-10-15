(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.weeklySalesReport=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const fields=['tillSales','cash','eftpos','pettyCash','uberEats','doorDash'];
 const blank=()=>Object.fromEntries(fields.map(field=>[field,Array(7).fill(null)]));
 const sum=values=>values.some(value=>value!==null)?values.reduce((total,value)=>total+(value??0),0):null;
 function calculate(breakdown){
  const days=[],variances=[];
  for(let index=0;index<7;index++){
   const revenue=['eftpos','uberEats','doorDash'].map(field=>breakdown[field][index]);
   days.push(revenue.every(value=>value!==null)?sum(revenue):null);
   const reconciliation=['cash','eftpos','pettyCash','tillSales'].map(field=>breakdown[field][index]);
   variances.push(reconciliation.every(value=>value!==null)?reconciliation[0]+reconciliation[1]+reconciliation[2]-reconciliation[3]:null);
  }
  return {days,variances,totals:{sales:sum(days),variance:sum(variances),...Object.fromEntries(fields.map(field=>[field,sum(breakdown[field])]))},recordedDays:days.filter(value=>value!==null).length,reconciledDays:variances.filter(value=>value!==null).length};
 }
 return {fields,blank,calculate};
});
