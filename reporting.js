const {belongs}=require('./location-scope'),sales=require('./sales'),usage=require('./stock-usage'),par=require('./par-levels'),storage=require('./public/stock-count-groups');
const maximumDays=3660;
function invalid(message){const error=Error(message);error.status=400;throw error;}
function selectLocations(value,available){
 if(typeof value!=='string'||!value.length||value.length>20000)invalid('Choose at least one report location.');
 const ids=[...new Set(value.split(','))];if(ids.some(id=>!/^[a-zA-Z0-9-]{1,100}$/.test(id)))invalid('Choose valid report locations.');
 const allowed=new Set(available.map(location=>location.id));if(ids.some(id=>!allowed.has(id))){const error=Error('You do not have access to one or more report locations.');error.status=403;throw error;}
 return ids;
}
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value;}
const monday=date=>usage.shift(date,-(new Date(date+'T00:00:00Z').getUTCDay()+6)%7);
function range(input={},now=new Date()){
 const today=par.dateLabel(par.dayNumber(now,par.calendar(par.defaultTimeZone))),quarter=sales.currentQuarter(now),week=sales.currentWeek(now),presets={week:{start:week,end:today},'last-week':{start:usage.shift(week,-7),end:usage.shift(week,-1)},'four-weeks':{start:usage.shift(week,-28),end:usage.shift(week,-1)},quarter:{start:quarter.startDate,end:today}};
 let selected;if(input.preset===undefined&&!input.start&&!input.end)selected=presets.quarter;else if(input.preset&&input.preset!=='custom'){if(!presets[input.preset])invalid('Choose a valid report period.');selected=presets[input.preset];}else selected={start:input.start,end:input.end};
 if(!validDate(selected.start)||!validDate(selected.end)||selected.start>selected.end)invalid('Choose valid report dates, with the start before the end.');
 if(selected.end>today)invalid('Reports can include dates up to today.');const days=(Date.parse(selected.end)-Date.parse(selected.start))/86400000+1;if(days>maximumDays)invalid('Choose a report period of ten years or less.');
 return {...selected,today,days,timeZone:par.defaultTimeZone,preset:input.preset||(!input.start&&!input.end?'quarter':'custom'),presets};
}
const cents=value=>Number.isSafeInteger(value)&&value>=0;
function expense(cost,salesCents,pending){return salesCents>0&&!pending?cost/salesCents*100:null;}
function calculate(records,orders,counts,catalogue,session,input={},options={}){
 const now=options.now||new Date(),period=range(input,now),formatter=par.calendar(par.defaultTimeZone),days=new Map();
 for(let date=period.start;date<=period.end;date=usage.shift(date,1))days.set(date,{date,weekStart:monday(date),salesCents:null,orderCostCents:0,orderCount:0,pricePending:false});
 const seenWeeks=new Set();
 for(const record of records){if(!belongs(record,session)||seenWeeks.has(record.weekStart)||!validDate(record.weekStart)||monday(record.weekStart)!==record.weekStart||!Array.isArray(record.days))continue;seenWeeks.add(record.weekStart);record.days.slice(0,7).forEach((value,index)=>{const row=days.get(usage.shift(record.weekStart,index));if(row&&cents(value))row.salesCents=value;});}
 const selectedOrders=[],seenOrders=new Set();
 for(const order of orders){if(order?.status!=='requested'||!belongs(order,session,'requestOwnerId')||typeof order.id!=='string'||seenOrders.has(order.id)||!Array.isArray(order.items)||!cents(order.total))continue;const created=new Date(order.createdAt);if(!Number.isFinite(created.valueOf()))continue;const date=par.dateLabel(par.dayNumber(created,formatter)),row=days.get(date);if(!row)continue;seenOrders.add(order.id);selectedOrders.push(order);row.orderCostCents+=order.total;row.orderCount++;if(order.pricePending||order.items.some(item=>!cents(item?.price)))row.pricePending=true;}
 const daily=[...days.values()].map(row=>({...row,budgetCents:row.salesCents===null?null:Math.round(row.salesCents*.28),expensePercent:expense(row.orderCostCents,row.salesCents,row.pricePending)})),weeks=new Map();
 for(const day of daily){if(!weeks.has(day.weekStart))weeks.set(day.weekStart,{weekStart:day.weekStart,weekEnd:usage.shift(day.weekStart,6),rangeStart:day.date,rangeEnd:day.date,salesCents:0,orderCostCents:0,orderCount:0,recordedDays:0,periodDays:0,pricePending:false});const week=weeks.get(day.weekStart);week.rangeEnd=day.date;week.periodDays++;if(day.salesCents!==null){week.salesCents+=day.salesCents;week.recordedDays++;}week.orderCostCents+=day.orderCostCents;week.orderCount+=day.orderCount;week.pricePending ||= day.pricePending;}
 const weekly=[...weeks.values()].map(week=>({...week,completed:week.periodDays===7&&week.weekEnd<period.today&&week.recordedDays===7,expensePercent:expense(week.orderCostCents,week.salesCents,week.pricePending),budgetCents:Math.round(week.salesCents*.28)}));
 const summary=daily.reduce((total,day)=>({salesCents:total.salesCents+(day.salesCents??0),orderCostCents:total.orderCostCents+day.orderCostCents,orderCount:total.orderCount+day.orderCount,recordedDays:total.recordedDays+(day.salesCents!==null?1:0),pricePending:total.pricePending||day.pricePending}),{salesCents:0,orderCostCents:0,orderCount:0,recordedDays:0,pricePending:false});
 summary.periodDays=period.days;summary.expensePercent=expense(summary.orderCostCents,summary.salesCents,summary.pricePending);summary.budgetCents=Math.round(summary.salesCents*.28);summary.budgetPercent=28;
 const averages=sales.completedWeekAverages(records,selectedOrders.map(order=>({...order,pricePending:Boolean(order.pricePending)||order.items.some(item=>!cents(item?.price))})),session,{startDate:period.start,endDate:period.end},now),supplierNames=new Map(catalogue.suppliers.map(supplier=>[supplier.id,supplier.name])),supplierRows=new Map();
 for(const order of selectedOrders){const inOrder=new Set();for(const item of order.items){if(!item||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999)continue;const id=String(item.supplierId||'unassigned');if(!supplierRows.has(id))supplierRows.set(id,{id,name:item.supplier||supplierNames.get(id)||'Supplier removed',orderCount:0,quantity:0,orderCostCents:0,pricePending:false});const supplier=supplierRows.get(id);if(!inOrder.has(id)){supplier.orderCount++;inOrder.add(id);}supplier.quantity+=item.quantity;if(cents(item.price))supplier.orderCostCents+=item.price*item.quantity;else supplier.pricePending=true;supplier.pricePending ||= Boolean(order.pricePending);}}
 // Sunday–Saturday usage cycles need the following Sunday's closing count.
 const firstSunday=usage.shift(period.start,(7-new Date(period.start+'T00:00:00Z').getUTCDay())%7),usageWeeks=[];
 for(let start=firstSunday;usage.shift(start,6)<=period.end&&usage.shift(start,7)<=period.today;start=usage.shift(start,7))usageWeeks.push(start);
 const products=new Map(catalogue.products.map(product=>[product.id,product]));
 for(const record of [...counts.filter(record=>belongs(record,session)),...orders.filter(record=>belongs(record,session,'requestOwnerId'))])for(const item of record.items||[])if(item?.id&&!products.has(item.id))products.set(item.id,{id:item.id,name:item.name||'Removed stock item',sku:item.sku||'',supplierId:item.supplierId,supplier:item.supplier,stockCountGroup:storage.resolve(item)});
 const definitions=[...products.values()].map(product=>({...product,supplier:product.supplier||supplierNames.get(product.supplierId)||'Supplier removed'})),cycles=usage.derive(counts,orders,definitions,session,usageWeeks),stockRows=new Map();
 for(const cycle of cycles)for(const item of cycle.items){if(item.opening===null&&item.closing===null&&item.ordered===0)continue;if(!stockRows.has(item.id)){const product=products.get(item.id);stockRows.set(item.id,{id:item.id,name:item.name,sku:item.sku,supplier:item.supplier,group:storage.resolve(product),ordered:0,used:null,completeWeeks:0,missingWeeks:0,negativeWeeks:0,totalWeeks:usageWeeks.length});}const row=stockRows.get(item.id);row.ordered+=item.ordered;if(item.status==='complete'){row.used=(row.used??0)+item.quantity;row.completeWeeks++;}else if(item.status==='negative_usage')row.negativeWeeks++;else row.missingWeeks++;}
 for(const row of stockRows.values()){row.used=row.used===null?null:Math.round(row.used*1000)/1000;row.missingWeeks=row.totalWeeks-row.completeWeeks-row.negativeWeeks;}
 return {period,company:{id:session.companyId,name:session.companyName},location:{id:session.locationId,name:session.locationName},summary,averages,daily,weekly,suppliers:[...supplierRows.values()].sort((a,b)=>b.orderCostCents-a.orderCostCents||a.name.localeCompare(b.name)),stockUsage:{weekCount:usageWeeks.length,fromDate:usageWeeks[0]||null,throughDate:usageWeeks.length?usage.shift(usageWeeks.at(-1),6):null,items:[...stockRows.values()].sort((a,b)=>a.name.localeCompare(b.name))}};
}
module.exports={calculate,range,selectLocations,maximumDays};
