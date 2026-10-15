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
 if(Object.hasOwn(input,'roCents')){if(input.roCents!==null&&(!Number.isSafeInteger(input.roCents)||input.roCents<0||input.roCents>maximumDailyCents*7))invalid('Enter a valid non-negative R&O amount.');costs.roCents=input.roCents;}
 if(Object.hasOwn(input,'platformFees')){
  const object=value=>value&&typeof value==='object'&&!Array.isArray(value);if(!object(input.platformFees)||Object.keys(input.platformFees).some(platform=>!weeklyReport.platforms.includes(platform)))invalid('Enter valid platform fees.');
  costs.platformFees=Object.fromEntries(weeklyReport.platforms.map(platform=>{const fees=input.platformFees[platform];if(!object(fees)||Object.keys(fees).some(field=>!weeklyReport.feeFields.includes(field)))invalid('Enter valid platform fees.');return [platform,Object.fromEntries(weeklyReport.feeFields.map(field=>{const value=fees[field];if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>maximumDailyCents*7))invalid('Enter non-negative platform fees with up to two decimal places, or leave them blank.');return [field,value];}))];}));
 }
 return {weekStart:input.weekStart,breakdown,...costs,revision:input.revision};
}
function createStore(){
 const pending=new Map();
 async function read(dir,session,start){try{const record=JSON.parse(await fs.readFile(file(dir,session,start),'utf8'));return {...record,roCents:record.roCents===undefined?0:record.roCents,platformFees:record.platformFees??weeklyReport.blankPlatformFees()};}catch(error){if(error.code!=='ENOENT')throw error;return {weekStart:start,breakdown:weeklyReport.blank(),labourCents:null,operatingExpensesCents:null,roCents:0,platformFees:weeklyReport.blankPlatformFees(),revision:0,updatedAt:null};}}
 async function save(dir,session,input){const normalized=validate(input),target=file(dir,session,normalized.weekStart);
  const operation=(pending.get(target)||Promise.resolve()).then(async()=>{
   const previous=await read(dir,session,normalized.weekStart),next={...normalized,roCents:Object.hasOwn(normalized,'roCents')?normalized.roCents:previous.roCents,platformFees:Object.hasOwn(normalized,'platformFees')?normalized.platformFees:previous.platformFees},content=record=>JSON.stringify([record.breakdown,record.labourCents,record.operatingExpensesCents,record.roCents,record.platformFees]);
   if(content(previous)===content(next))return previous;
   if(previous.revision!==normalized.revision)invalid('This report was changed by another user or tab. Reload the saved week before saving.',409);
   const record={...next,revision:previous.revision+1,locationId:session.locationId,companyId:session.companyId,recordedBy:session.username,updatedAt:new Date().toISOString()},temp=target+'.'+crypto.randomUUID()+'.tmp';
   await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}return record;
  });const settled=operation.catch(()=>{});pending.set(target,settled);try{return await operation;}finally{if(pending.get(target)===settled)pending.delete(target);}
 }
 async function report(dir,session,selectedWeek,{orders=[],now=new Date()}={}){
  const start=selectedWeek||currentWeek(now),record=await read(dir,session,start),formatter=calendar(defaultTimeZone);
  const costs=allTimeTotals([],orders.filter(order=>{const created=new Date(order?.createdAt);if(!Number.isFinite(created.valueOf()))return false;const date=dateLabel(dayNumber(created,formatter));return date>=start&&date<=shift(start,6);}),session);
  const summary=weeklyReport.calculate(record.breakdown),profit=weeklyReport.profit(summary.totals.sales,{stockOrdersCents:costs.placedOrdersCents,pricePending:costs.pricePending,labourCents:record.labourCents,operatingExpensesCents:record.operatingExpensesCents,roCents:record.roCents}),platformSettlements=Object.fromEntries(weeklyReport.platforms.map(platform=>[platform,weeklyReport.settlement(summary.totals[platform],record.platformFees[platform])]));
  return {record,summary,profit,platformSettlements,weeklyOrders:{totalCents:costs.placedOrdersCents,pricePending:costs.pricePending,orderCount:costs.orderCount},currentWeek:currentWeek(now),timeZone:defaultTimeZone};
 }
 return {save,report};
}
module.exports={createStore,validate};
