const {belongs}=require('./location-scope');
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {defaultTimeZone,calendar,dayNumber,dateLabel}=require('./par-levels');
const {shift}=require('./stock-usage');
const {compare}=require('./public/sales-performance');
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
function calculate(records,orders,session,{now=new Date()}={}){
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
 const formatter=calendar(defaultTimeZone),seen=new Set();let spentCents=0,pricePending=false,orderCount=0;
 for(const order of orders){
  if(!order||!belongs(order,session,'requestOwnerId')||seen.has(order.id)||!Array.isArray(order.items)||!Number.isSafeInteger(order.total)||order.total<0)continue;
  const date=new Date(order.createdAt);if(!Number.isFinite(date.valueOf()))continue;
  const day=dateLabel(dayNumber(date,formatter));if(day<weekStart||day>shift(weekStart,6))continue;
  seen.add(order.id);spentCents+=order.total;orderCount++;if(order.pricePending)pricePending=true;
 }
 const currentRecord=records.find(record=>belongs(record,session)&&record.weekStart===weekStart);
 const performance=compare(currentRecord?.days||Array(7).fill(null),{dailyProjections,today});
 return {weekStart,weekEnd:shift(weekStart,6),today,performance,timeZone:defaultTimeZone,history,weeksRecorded,dailyProjections,projectedSalesCents,budgetPercent:28,budgetCents,spentCents,orderCount,pricePending,remainingCents:budgetCents===null||pricePending?null:budgetCents-spentCents};
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
function homeTotals(records,orders,session,{now=new Date()}={}){
 const quarter=currentQuarter(now),formatter=calendar(defaultTimeZone),today=dateLabel(dayNumber(now,formatter)),allOrders=allTimeTotals([],orders,session);let salesCents=0,recordedDays=0,toDateSalesCents=0,toDateRecordedDays=0;
 for(const record of records){
  if(!belongs(record,session)||!Array.isArray(record.days))continue;try{week(record.weekStart);}catch{continue;}
  for(const [index,value] of record.days.slice(0,7).entries()){
   const date=shift(record.weekStart,index);if(date<quarter.startDate||date>quarter.endDate||!Number.isSafeInteger(value)||value<0)continue;
   salesCents+=value;recordedDays++;if(date<=today){toDateSalesCents+=value;toDateRecordedDays++;}
  }
 }
 const withinQuarter=orders.filter(order=>{
  const created=new Date(order?.createdAt);if(!Number.isFinite(created.valueOf()))return false;
  const date=dateLabel(dayNumber(created,formatter));return date>=quarter.startDate&&date<=quarter.endDate;
 }),quarterOrders=allTimeTotals([],withinQuarter,session),toDateOrders=allTimeTotals([],withinQuarter.filter(order=>dateLabel(dayNumber(new Date(order.createdAt),formatter))<=today),session);
 // Calendar days avoid DST distortion and include the current partial week.
 const elapsedDays=(Date.parse(today)-Date.parse(quarter.startDate))/86400000+1;
 const averages={throughDate:today,elapsedDays,recordedDays:toDateRecordedDays,weeklySalesCents:toDateRecordedDays?Math.round(toDateSalesCents*7/elapsedDays):null,weeklyCostCents:toDateOrders.pricePending?null:Math.round(toDateOrders.placedOrdersCents*7/elapsedDays),pricePending:toDateOrders.pricePending,expensePercent:toDateSalesCents>0&&!toDateOrders.pricePending?toDateOrders.placedOrdersCents/toDateSalesCents*100:null};
 return {...allOrders,salesCents,recordedDays,quarter,averages,quarterPlacedOrdersCents:quarterOrders.placedOrdersCents,quarterOrderCount:quarterOrders.orderCount,quarterPricePending:quarterOrders.pricePending,expensePercent:salesCents>0&&!quarterOrders.pricePending?quarterOrders.placedOrdersCents/salesCents*100:null};
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
 async function report(dir,session,selectedWeek,{orders=[],now=new Date()}={}){
  const current=currentWeek(now);if(selectedWeek)week(selectedWeek);
  const starts=[...new Set([selectedWeek||current,current,...[1,2,3,4].map(index=>shift(current,-7*index))])];
  const records=await Promise.all(starts.map(start=>read(dir,session,start)));
  return {record:records.find(record=>record.weekStart===(selectedWeek||current)),projection:calculate(records,orders,session,{now})};
 }
 async function totals(dir,session,{orders=[],now=new Date()}={}){
  const folders=[accountFolder(dir,session),...(session.locationId?session.legacyAccountIds||[]:[]).filter(id=>/^[a-zA-Z0-9-]{1,100}$/.test(id)).map(id=>path.join(dir,'sales',id))];
  const weeks=new Set();
  for(const folder of folders){let files;try{files=await fs.readdir(folder);}catch(error){if(error.code==='ENOENT')continue;throw error;}for(const file of files){if(!/^\d{4}-\d{2}-\d{2}\.json$/.test(file))continue;const start=file.slice(0,-5);try{week(start);weeks.add(start);}catch{}}}
  // Use the same location-over-legacy precedence as the weekly sales editor.
  const starts=[...weeks],records=[];for(let offset=0;offset<starts.length;offset+=32)records.push(...await Promise.all(starts.slice(offset,offset+32).map(start=>read(dir,session,start))));
  return homeTotals(records,orders,session,{now});
 }
 return {save,report,totals};
}
module.exports={calculate,allTimeTotals,homeTotals,createStore,validate,maximumDailyCents,currentWeek,currentQuarter};
