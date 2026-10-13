const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {defaultTimeZone,calendar,dayNumber,dateLabel}=require('./par-levels');
const {shift}=require('./stock-usage');
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
function accountFolder(dir,session){
 if(!/^[a-zA-Z0-9-]{1,100}$/.test(session?.id||''))invalid('Sign-in required.',401);
 return path.join(dir,'sales',session.id);
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
 catch(error){if(error.code==='ENOENT')return {weekStart,days:Array(7).fill(null),revision:0,updatedAt:null};throw error;}
}
function calculate(records,orders,session,{now=new Date()}={}){
 const weekStart=currentWeek(now);
 const history=[1,2,3,4].map(index=>{
  const start=shift(weekStart,-7*index),record=records.find(record=>record?.accountId===session.id&&record.weekStart===start);
  const days=record?.days||Array(7).fill(null),recordedDays=days.filter(value=>value!==null).length;
  return {weekStart:start,weekEnd:shift(start,6),days,recordedDays,totalCents:days.reduce((sum,value)=>sum+(value??0),0),complete:recordedDays===7};
 });
 const weeksRecorded=history.filter(record=>record.complete).length;
 const projectedSalesCents=weeksRecorded===4?Math.round(history.reduce((sum,record)=>sum+record.totalCents,0)/4):null;
 const dailyProjections=Array.from({length:7},(_,index)=>({date:shift(weekStart,index),amountCents:weeksRecorded===4?Math.round(history.reduce((sum,record)=>sum+record.days[index],0)/4):null}));
 const budgetCents=projectedSalesCents===null?null:Math.round(projectedSalesCents*28/100);
 const formatter=calendar(defaultTimeZone),seen=new Set();let spentCents=0,pricePending=false,orderCount=0;
 for(const order of orders){
  if(!order||order.requestOwnerId!==session.id||seen.has(order.id)||!Array.isArray(order.items)||!Number.isSafeInteger(order.total)||order.total<0)continue;
  const date=new Date(order.createdAt);if(!Number.isFinite(date.valueOf()))continue;
  const day=dateLabel(dayNumber(date,formatter));if(day<weekStart||day>shift(weekStart,6))continue;
  seen.add(order.id);spentCents+=order.total;orderCount++;if(order.pricePending)pricePending=true;
 }
 return {weekStart,weekEnd:shift(weekStart,6),timeZone:defaultTimeZone,history,weeksRecorded,dailyProjections,projectedSalesCents,budgetPercent:28,budgetCents,spentCents,orderCount,pricePending,remainingCents:budgetCents===null||pricePending?null:budgetCents-spentCents};
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
   const record={...normalized,accountId:session.id,revision:previous.revision+1,updatedAt:new Date().toISOString()};
   await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';
   try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
   return record;
  });
  const settled=operation.catch(()=>{});pending.set(file,settled);
  try{return await operation;}finally{if(pending.get(file)===settled)pending.delete(file);}
 }
 async function report(dir,session,selectedWeek,{orders=[],now=new Date()}={}){
  const current=currentWeek(now);if(selectedWeek)week(selectedWeek);
  const [record,...history]=await Promise.all([read(dir,session,selectedWeek||current),...[1,2,3,4].map(index=>read(dir,session,shift(current,-7*index)))]);
  return {record,projection:calculate(history,orders,session,{now})};
 }
 return {save,report};
}
module.exports={calculate,createStore,validate,maximumDailyCents,currentWeek};
