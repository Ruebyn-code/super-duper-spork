(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.supplierDeliveryDays=model;})(globalThis,()=>{
 const days=[['mon','Monday','Mon'],['tue','Tuesday','Tue'],['wed','Wednesday','Wed'],['thu','Thursday','Thu'],['fri','Friday','Fri'],['sat','Saturday','Sat'],['sun','Sunday','Sun']];
 function normalize(value){
  if(!Array.isArray(value)||value.length>2000)throw Error('Choose valid supplier delivery days.');const seen=new Set();
  return value.map(row=>{if(!row||typeof row!=='object'||typeof row.supplierId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(row.supplierId)||seen.has(row.supplierId)||!Array.isArray(row.days)||row.days.length>7||new Set(row.days).size!==row.days.length||row.days.some(day=>!days.some(([id])=>id===day)))throw Error('Choose each supplier and Monday–Sunday delivery day only once.');seen.add(row.supplierId);return{supplierId:row.supplierId,days:days.filter(([id])=>row.days.includes(id)).map(([id])=>id)};}).filter(row=>row.days.length).sort((a,b)=>a.supplierId.localeCompare(b.supplierId));
 }
 function describe(value){return days.filter(([id])=>Array.isArray(value)&&value.includes(id)).map(([,name,short])=>short).join(', ');}
 return{days,normalize,describe};
});
