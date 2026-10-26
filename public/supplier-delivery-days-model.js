(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.supplierDeliveryDays=model;})(globalThis,()=>{
 const days=[['mon','Monday','Mon'],['tue','Tuesday','Tue'],['wed','Wednesday','Wed'],['thu','Thursday','Thu'],['fri','Friday','Fri'],['sat','Saturday','Sat'],['sun','Sunday','Sun']];
 function date(value){return typeof value==='string'&&/^20\d\d-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
 function normalize(value){
  if(!Array.isArray(value)||value.length>2000)throw Error('Choose valid supplier delivery days.');const seen=new Set();
  return value.map(row=>{
   if(!row||typeof row!=='object'||typeof row.supplierId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(row.supplierId)||seen.has(row.supplierId)||!Array.isArray(row.days)||row.days.length>7||new Set(row.days).size!==row.days.length||row.days.some(day=>!days.some(([id])=>id===day)))throw Error('Choose each supplier and Monday–Sunday delivery day only once.');seen.add(row.supplierId);
   const result={supplierId:row.supplierId,days:days.filter(([id])=>row.days.includes(id)).map(([id])=>id)};
   if(Object.hasOwn(row,'leadDays')){if(row.leadDays!==null&&(!Number.isInteger(row.leadDays)||row.leadDays<0||row.leadDays>30))throw Error('Order lead time must be 0–30 calendar days, or blank.');result.leadDays=row.leadDays;}
   for(const key of ['cutoffTime','deliveryTime'])if(Object.hasOwn(row,key)){if(row[key]!==null&&(typeof row[key]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row[key])))throw Error('Enter a valid cutoff and delivery time.');result[key]=row[key];}
   if(result.leadDays===0&&result.cutoffTime&&result.deliveryTime&&result.cutoffTime>=result.deliveryTime)throw Error('For same-day delivery, the order cutoff must be before the delivery time.');
   if(Object.hasOwn(row,'skipHolidays')){if(typeof row.skipHolidays!=='boolean')throw Error('Choose whether deliveries skip public holidays.');result.skipHolidays=row.skipHolidays;}
   if(Object.hasOwn(row,'exceptions')){if(!Array.isArray(row.exceptions)||row.exceptions.length>120)throw Error('Use up to 120 one-off delivery dates.');const dates=new Set();result.exceptions=row.exceptions.map(item=>{if(!item||!date(item.date)||dates.has(item.date)||typeof item.delivery!=='boolean')throw Error('Use unique valid dates for delivery exceptions.');dates.add(item.date);return{date:item.date,delivery:item.delivery};}).sort((a,b)=>a.date.localeCompare(b.date));}
   return result;
  }).filter(row=>row.days.length||row.leadDays!==undefined&&row.leadDays!==null||row.cutoffTime||row.deliveryTime||row.skipHolidays||row.exceptions?.length).sort((a,b)=>a.supplierId.localeCompare(b.supplierId));
 }
 function describe(value){return days.filter(([id])=>Array.isArray(value)&&value.includes(id)).map(([,name,short])=>short).join(', ');}
 function dateText(value){return value?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'';}
 function planText(plan){if(!plan)return '';const date=value=>new Intl.DateTimeFormat('en-AU',{timeZone:plan.timeZone||'Australia/Melbourne',weekday:'short',day:'numeric',month:'short',...(plan.timingConfigured?{hour:'numeric',minute:'2-digit',hour12:true}:{})}).format(new Date(value));const text=[];if(plan.next)text.push('Estimated delivery '+date(plan.next.arrivesAt));if(plan.next?.orderBy)text.push('Order by '+date(plan.next.orderBy));if(plan.missedCutoff)text.push('Earlier cutoff passed');if(plan.reason)text.push(plan.reason);return text.join(' · ');}
 return{days,normalize,describe,date,dateText,planText};
});
