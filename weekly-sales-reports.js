const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {currentWeek,allTimeTotals,maximumDailyCents}=require('./sales');
const {calendar,defaultTimeZone,dayNumber,dateLabel}=require('./par-levels');
const {shift}=require('./stock-usage');
const weeklyReport=require('./public/weekly-sales-report');
function invalid(message,status=400){const error=Error(message);error.status=status;throw error;}
function week(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))invalid('Choose a valid Monday-starting report week.');const date=new Date(value+'T00:00:00Z');if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value||date.getUTCDay()!==1)invalid('Choose a valid Monday-starting report week.');}
function file(dir,session,start){week(start);if(!/^[a-zA-Z0-9-]{1,100}$/.test(session?.locationId||''))invalid('Choose an accessible location.',403);return path.join(dir,'weekly-sales-reports',session.locationId,start+'.json');}
function validate(input){
 if(!input||typeof input!=='object')invalid('Enter a weekly sales report.');week(input.weekStart);
 if(!Number.isSafeInteger(input.revision)||input.revision<0)invalid('Reload the report before saving.');
 if(!input.breakdown||typeof input.breakdown!=='object'||Array.isArray(input.breakdown)||Object.keys(input.breakdown).some(key=>!weeklyReport.fields.includes(key)))invalid('Enter a valid weekly sales breakdown.');
 const breakdown=Object.fromEntries(weeklyReport.fields.map(field=>{const values=input.breakdown[field];if(!Array.isArray(values)||values.length!==7||values.some(value=>value!==null&&(!Number.isSafeInteger(value)||value<0||value>maximumDailyCents)))invalid('Enter non-negative amounts with up to two decimal places, or leave cells blank.');return [field,[...values]];}));
 const costs={};for(const field of ['labourCents','operatingExpensesCents']){const value=input[field]??null;if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>maximumDailyCents*7))invalid('Enter valid non-negative weekly costs.');costs[field]=value;}
 return {weekStart:input.weekStart,breakdown,...costs,revision:input.revision};
}
function createStore(){
 const pending=new Map();
 async function read(dir,session,start){try{return JSON.parse(await fs.readFile(file(dir,session,start),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return {weekStart:start,breakdown:weeklyReport.blank(),labourCents:null,operatingExpensesCents:null,revision:0,updatedAt:null};}}
 async function save(dir,session,input){const normalized=validate(input),target=file(dir,session,normalized.weekStart);
  const operation=(pending.get(target)||Promise.resolve()).then(async()=>{
   const previous=await read(dir,session,normalized.weekStart),content=record=>JSON.stringify([record.breakdown,record.labourCents,record.operatingExpensesCents]);
   if(content(previous)===content(normalized))return previous;
   if(previous.revision!==normalized.revision)invalid('This report was changed by another user or tab. Reload the saved week before saving.',409);
   const record={...normalized,revision:previous.revision+1,locationId:session.locationId,companyId:session.companyId,recordedBy:session.username,updatedAt:new Date().toISOString()},temp=target+'.'+crypto.randomUUID()+'.tmp';
   await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}return record;
  });const settled=operation.catch(()=>{});pending.set(target,settled);try{return await operation;}finally{if(pending.get(target)===settled)pending.delete(target);}
 }
 async function report(dir,session,selectedWeek,{orders=[],now=new Date()}={}){
  const start=selectedWeek||currentWeek(now),record=await read(dir,session,start),formatter=calendar(defaultTimeZone);
  const costs=allTimeTotals([],orders.filter(order=>{const created=new Date(order?.createdAt);if(!Number.isFinite(created.valueOf()))return false;const date=dateLabel(dayNumber(created,formatter));return date>=start&&date<=shift(start,6);}),session);
  return {record,summary:weeklyReport.calculate(record.breakdown),weeklyOrders:{totalCents:costs.placedOrdersCents,pricePending:costs.pricePending,orderCount:costs.orderCount},currentWeek:currentWeek(now),timeZone:defaultTimeZone};
 }
 return {save,report};
}
module.exports={createStore,validate};
