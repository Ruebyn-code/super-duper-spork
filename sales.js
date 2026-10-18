const {belongs}=require('./location-scope');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {defaultTimeZone,calendar,dayNumber,dateLabel}=require('./par-levels');
const {shift}=require('./stock-usage');
const {compare}=require('./public/sales-performance');
const orderCosts=require('./order-cost-period'),transferEffects=require('./stock-transfer-effects');
const maximumDailyCents=1000000000;
function invalid(message,status=400){const error=Error(message);error.status=status;throw error;}
function week(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))invalid('Choose a valid Monday-starting sales week.');
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value||date.getUTCDay()!==1)invalid('Choose a valid Monday-starting sales week.');
}
function currentWeek(now=new Date()){
 const today=dayNumber(now,calendar(defaultTimeZone));
 return dateLabel(today-(new Date(today*86400000).getUTCDay()+6)%7);
}
function currentQuarter(now=new Date()){
 const localDate=new Date(dateLabel(dayNumber(now,calendar(defaultTimeZone)))+'T00:00:00Z');
 const year=localDate.getUTCFullYear(),month=Math.floor(localDate.getUTCMonth()/3)*3;
 return {startDate:new Date(Date.UTC(year,month,1)).toISOString().slice(0,10),endDate:new Date(Date.UTC(year,month+3,0)).toISOString().slice(0,10),number:month/3+1,year,timeZone:defaultTimeZone};
}
function accountFolder(dir,session){
 if(!/^[a-zA-Z0-9-]{1,100}$/.test(session?.id||'')||(session.locationId&&!/^[a-zA-Z0-9-]{1,100}$/.test(session.locationId)))invalid('Sign-in required.',401);
 return session.locationId?path.join(dir,'location-sales',session.locationId):path.join(dir,'sales',session.id);
}
function validate(input){
 if(!input||typeof input!=='object')invalid('Enter daily sales for a week.');
 week(input.weekStart);
 if(!Number.isSafeInteger(input.revision)||input.revision<0)invalid('Refresh sales before saving.');
 if(!Array.isArray(input.days)||input.days.length!==7||input.days.some(value=>value!==null&&(!Number.isSafeInteger(value)||value<0||value>maximumDailyCents)))invalid('Enter non-negative daily sales with up to two decimal places, or leave the day blank.');
 return {weekStart:input.weekStart,days:[...input.days],revision:input.revision};
}
async function read(dir,session,weekStart){
 week(weekStart);
 try{return JSON.parse(await fs.readFile(path.join(accountFolder(dir,session),weekStart+'.json'),'utf8'));}
 catch(error){if(error.code!=='ENOENT')throw error;
  // Original account files remain attached to their initial location, even after reassignment.
  for(const accountId of session.locationId?session.legacyAccountIds||[]:[]){
   if(!/^[a-zA-Z0-9-]{1,100}$/.test(accountId))continue;
   try{return {...JSON.parse(await fs.readFile(path.join(dir,'sales',accountId,weekStart+'.json'),'utf8')),locationId:session.locationId};}catch(legacyError){if(legacyError.code!=='ENOENT')throw legacyError;}
  }
  return {weekStart,days:Array(7).fill(null),revision:0,updatedAt:null};}
}
function calculate(records,orders,session,{now=new Date(),transfers=[]}={}){
 const weekStart=currentWeek(now),today=dateLabel(dayNumber(now,calendar(defaultTimeZone)));
 const history=[1,2,3,4].map(index=>{
  const start=shift(weekStart,-7*index),record=records.find(record=>belongs(record,session)&&record.weekStart===start);
  const days=record?.days||Array(7).fill(null),recordedDays=days.filter(value=>value!==null).length;
  return {weekStart:start,weekEnd:shift(start,6),days,recordedDays,totalCents:days.reduce((sum,value)=>sum+(value??0),0),complete:recordedDays===7};
 });
 const weeksRecorded=history.filter(record=>record.complete).length;
 const projectedSalesCents=weeksRecorded===4?Math.round(history.reduce((sum,record)=>sum+record.totalCents,0)/4):null;
 const dailyProjections=Array.from({length:7},(_,index)=>({date:shift(weekStart,index),amountCents:weeksRecorded===4?Math.round(history.reduce((sum,record)=>sum+record.days[index],0)/4):null}));
 const budgetCents=projectedSalesCents===null?null:Math.round(projectedSalesCents*28/100);
 const formatter=calendar(defaultTimeZone),{spentCents,pricePending,orderCount,transferCostCents}=committedSpend(orders,session,weekStart,transfers);
 const currentRecord=records.find(record=>belongs(record,session)&&record.weekStart===weekStart);
 const performance=compare(currentRecord?.days||Array(7).fill(null),{dailyProjections,today});
 return {weekStart,weekEnd:shift(weekStart,6),orderCostWeekStart:orderCosts.dates({createdAt:now},formatter).costWeekStart,today,performance,timeZone:defaultTimeZone,history,weeksRecorded,dailyProjections,projectedSalesCents,budgetPercent:28,budgetCents,spentCents,transferCostCents,orderCount,pricePending,remainingCents:budgetCents===null||pricePending?null:budgetCents-spentCents};
}
function committedSpend(orders,session,weekStart,transfers=[]){
 const formatter=calendar(defaultTimeZone),seen=new Set();let spentCents=0,pricePending=false,orderCount=0;
 for(const order of orders){
  if(!order||!belongs(order,session,'requestOwnerId')||seen.has(order.id)||!Array.isArray(order.items)||!Number.isSafeInteger(order.total)||order.total<0)continue;
  const period=orderCosts.dates(order,formatter);if(period?.costWeekStart!==weekStart)continue;
  seen.add(order.id);spentCents+=order.total;orderCount++;if(order.pricePending)pricePending=true;
 }
 const transferCosts=transferEffects.costs(transfers,session,{weeks:new Set([weekStart])});spentCents+=transferCosts.totalCents;
 return {spentCents,pricePending,orderCount,transferCostCents:transferCosts.totalCents};
}
function orderingProjection(projection,orders,session,{transfers=[]}={}){
 // The ordering week follows cost allocation: Sunday plans for next Monday.
 // Its history still uses the four weeks completed as of today.
 const {performance,...forecast}=projection,weekStart=projection.orderCostWeekStart,isUpcoming=weekStart!==projection.weekStart;
 const committed=isUpcoming?committedSpend(orders,session,weekStart,transfers):{spentCents:projection.spentCents,pricePending:projection.pricePending,orderCount:projection.orderCount,transferCostCents:projection.transferCostCents};
 return {...forecast,...committed,weekStart,weekEnd:shift(weekStart,6),isUpcoming,dailyProjections:projection.dailyProjections.map((day,index)=>({...day,date:shift(weekStart,index)})),remainingCents:projection.budgetCents===null||committed.pricePending?null:projection.budgetCents-committed.spentCents};
}
function allTimeTotals(records,orders,session){
 let salesCents=0,recordedDays=0,placedOrdersCents=0,orderCount=0,pricePending=false;
 for(const record of records){if(!belongs(record,session)||!Array.isArray(record.days))continue;for(const value of record.days){if(Number.isSafeInteger(value)&&value>=0){salesCents+=value;recordedDays++;}}}
 const seen=new Set();
 for(const order of orders){
  if(order?.status!=='requested'||!belongs(order,session,'requestOwnerId')||typeof order.id!=='string'||seen.has(order.id)||!Array.isArray(order.items)||!Number.isSafeInteger(order.total)||order.total<0)continue;
  seen.add(order.id);placedOrdersCents+=order.total;orderCount++;if(order.pricePending||order.items.some(item=>item?.price===null))pricePending=true;
 }
 return {salesCents,recordedDays,placedOrdersCents,orderCount,pricePending,expensePercent:salesCents>0&&!pricePending?placedOrdersCents/salesCents*100:null};
}
function completedWeekAverages(records,orders,session,quarter,now,transfers=[]){
 const firstMonday=shift(quarter.startDate,(8-new Date(quarter.startDate+'T00:00:00Z').getUTCDay())%7),currentMonday=currentWeek(now),completed=[];
 for(let start=firstMonday;shift(start,6)<currentMonday&&shift(start,6)<=quarter.endDate;start=shift(start,7))completed.push(start);
 // Match sales and costs to the same full weeks; missing sales are not zero.
 const included=completed.map(start=>records.find(record=>belongs(record,session)&&record.weekStart===start)).filter(record=>Array.isArray(record?.days)&&record.days.length===7&&record.days.every(value=>Number.isSafeInteger(value)&&value>=0));
 const starts=new Set(included.map(record=>record.weekStart)),formatter=calendar(defaultTimeZone);
 const placed=allTimeTotals([],orders.filter(order=>{
  return starts.has(orderCosts.dates(order,formatter)?.costWeekStart);
 }),session),transferCents=transferEffects.costs(transfers,session,{weeks:starts}).totalCents,salesCents=included.reduce((total,record)=>total+record.days.reduce((sum,value)=>sum+value,0),0),weeksRecorded=included.length;
 return {fromDate:included[0]?.weekStart||null,throughDate:weeksRecorded?shift(included.at(-1).weekStart,6):null,completedWeeks:completed.length,weeksRecorded,skippedWeeks:completed.length-weeksRecorded,recordedDays:weeksRecorded*7,weeklySalesCents:weeksRecorded?Math.round(salesCents/weeksRecorded):null,weeklyCostCents:weeksRecorded&&!placed.pricePending?Math.round((placed.placedOrdersCents+transferCents)/weeksRecorded):null,pricePending:placed.pricePending,expensePercent:salesCents>0&&!placed.pricePending?(placed.placedOrdersCents+transferCents)/salesCents*100:null};
}
function homeTotals(records,orders,session,{now=new Date(),transfers=[]}={}){
 const quarter=currentQuarter(now),formatter=calendar(defaultTimeZone),allOrders=allTimeTotals([],orders,session);let salesCents=0,recordedDays=0;
 for(const record of records){
  if(!belongs(record,session)||!Array.isArray(record.days))continue;try{week(record.weekStart);}catch{continue;}
  for(const [index,value] of record.days.slice(0,7).entries()){
   const date=shift(record.weekStart,index);if(date<quarter.startDate||date>quarter.endDate||!Number.isSafeInteger(value)||value<0)continue;
   salesCents+=value;recordedDays++;
  }
 }
 const withinQuarter=orders.filter(order=>{
  const period=orderCosts.dates(order,formatter);return period&&period.costDate>=quarter.startDate&&period.costDate<=quarter.endDate;
 }),quarterOrders=allTimeTotals([],withinQuarter,session),averages=completedWeekAverages(records,withinQuarter,session,quarter,now,transfers),quarterTransferCostCents=transferEffects.costs(transfers,session,{startDate:quarter.startDate,endDate:quarter.endDate}).totalCents;
 return {...allOrders,salesCents,recordedDays,quarter,averages,quarterPlacedOrdersCents:quarterOrders.placedOrdersCents,quarterOrderCount:quarterOrders.orderCount,quarterPricePending:quarterOrders.pricePending,quarterTransferCostCents,quarterStockCostCents:quarterOrders.placedOrdersCents+quarterTransferCostCents,expensePercent:salesCents>0&&!quarterOrders.pricePending?(quarterOrders.placedOrdersCents+quarterTransferCostCents)/salesCents*100:null};
}
function createStore(){
 const pending=new Map();
 async function save(dir,session,input){
  const normalized=validate(input),file=path.join(accountFolder(dir,session),normalized.weekStart+'.json');
  const operation=(pending.get(file)||Promise.resolve()).then(async()=>{
   const previous=await read(dir,session,normalized.weekStart);
   // An identical retry succeeds without duplicating or advancing the revision.
   if(JSON.stringify(previous.days)===JSON.stringify(normalized.days))return previous;
   if(previous.revision!==normalized.revision)invalid('Sales were changed in another tab. Reload this week before saving.',409);
   const record={...normalized,accountId:session.id,...(session.locationId?{locationId:session.locationId,recordedBy:session.username}:{}),revision:previous.revision+1,updatedAt:new Date().toISOString()};
   await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';
   try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
   return record;
  });
  const settled=operation.catch(()=>{});pending.set(file,settled);
  try{return await operation;}finally{if(pending.get(file)===settled)pending.delete(file);}
 }
 async function report(dir,session,selectedWeek,{orders=[],now=new Date(),transfers=[]}={}){
  const current=currentWeek(now);if(selectedWeek)week(selectedWeek);
  const starts=[...new Set([selectedWeek||current,current,...[1,2,3,4].map(index=>shift(current,-7*index))])];
  const records=await Promise.all(starts.map(start=>read(dir,session,start)));
  const projection=calculate(records,orders,session,{now,transfers});
  return {record:records.find(record=>record.weekStart===(selectedWeek||current)),projection,orderingProjection:orderingProjection(projection,orders,session,{transfers})};
 }
 async function history(dir,session){
  const folders=[accountFolder(dir,session),...(session.locationId?session.legacyAccountIds||[]:[]).filter(id=>/^[a-zA-Z0-9-]{1,100}$/.test(id)).map(id=>path.join(dir,'sales',id))];
  const weeks=new Set();
  for(const folder of folders){let files;try{files=await fs.readdir(folder);}catch(error){if(error.code==='ENOENT')continue;throw error;}for(const file of files){if(!/^\d{4}-\d{2}-\d{2}\.json$/.test(file))continue;const start=file.slice(0,-5);try{week(start);weeks.add(start);}catch{}}}
  // Use the same location-over-legacy precedence as the weekly sales editor.
  const starts=[...weeks],records=[];for(let offset=0;offset<starts.length;offset+=32)records.push(...await Promise.all(starts.slice(offset,offset+32).map(start=>read(dir,session,start))));
  return records;
 }
 async function totals(dir,session,{orders=[],now=new Date(),transfers=[]}={}){return homeTotals(await history(dir,session),orders,session,{now,transfers});}
 return {save,report,totals,history};
}
module.exports={read,calculate,orderingProjection,allTimeTotals,homeTotals,completedWeekAverages,createStore,validate,maximumDailyCents,currentWeek,currentQuarter};
