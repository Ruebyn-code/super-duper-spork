const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {currentWeek,allTimeTotals,maximumDailyCents}=require('./sales');
const {calendar,defaultTimeZone,dayNumber,dateLabel}=require('./par-levels');
const {shift}=require('./stock-usage');
const weeklyReport=require('./public/weekly-sales-report'),expenseTypes=require('./operating-expense-types');
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
 if(Object.hasOwn(input,'expenseEntries')){
  const entries=input.expenseEntries,object=value=>value&&typeof value==='object'&&!Array.isArray(value);if(!object(entries)||Object.keys(entries).some(field=>!weeklyReport.expenseFields.includes(field)))invalid('Enter valid expense entries.');
  costs.expenseEntries=Object.fromEntries(weeklyReport.expenseFields.map(field=>{const rows=entries[field];if(rows===null)return [field,null];if(!Array.isArray(rows)||rows.length>100)invalid('Use up to 100 entries per expense.');const ids=new Set();let knownTotal=0;
   const normalized=rows.map(row=>{if(!object(row)||Object.keys(row).some(key=>!['id','description','quantityMilli','unitCostCents'].includes(key))||typeof row.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(row.id)||ids.has(row.id)||typeof row.description!=='string'||row.description.length>120)invalid('Enter valid expense details.');ids.add(row.id);for(const [key,maximum] of [['quantityMilli',1000000000],['unitCostCents',maximumDailyCents*7]])if(row[key]!==null&&(!Number.isSafeInteger(row[key])||row[key]<0||row[key]>maximum))invalid('Enter non-negative expense quantities and costs.');const clean={id:row.id,description:row.description.trim(),quantityMilli:row.quantityMilli,unitCostCents:row.unitCostCents};knownTotal+=weeklyReport.expenseLineTotal(clean)??0;if(knownTotal>maximumDailyCents*7)invalid('The expense total exceeds the weekly limit.');return clean;});return [field,normalized];}));
 }
 if(Object.hasOwn(input,'operatingAllocations')){
  if(!Array.isArray(input.operatingAllocations)||input.operatingAllocations.length>100)invalid('Enter valid operating expense allocations.');const ids=new Set();
  costs.operatingAllocations=input.operatingAllocations.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(key=>!['typeId','description','totalCents','weeks','startWeek'].includes(key))||typeof row.typeId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(row.typeId)||ids.has(row.typeId)||typeof row.description!=='string'||row.description.length>120||row.totalCents!==null&&(!Number.isSafeInteger(row.totalCents)||row.totalCents<0||row.totalCents>maximumDailyCents*7)||!Number.isInteger(row.weeks)||row.weeks<1||row.weeks>520)invalid('Enter an expense total and a whole number of weeks from 1 to 520.');week(row.startWeek);if(row.startWeek>input.weekStart)invalid('Expense allocations cannot start after the report week.');ids.add(row.typeId);return {...row,description:row.description.trim()};});
 }
 if(Object.hasOwn(input,'operatingAdditionalCents')){const value=input.operatingAdditionalCents;if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>maximumDailyCents*7))invalid('Enter a valid additional operating cost.');costs.operatingAdditionalCents=value;}
 return {weekStart:input.weekStart,breakdown,...costs,revision:input.revision};
}
function createStore(){
 const pending=new Map(),historyCache=new Map();
 async function inheritedAllocations(dir,session,start,types){
  const folder=path.dirname(file(dir,session,start));let stamp;try{const stat=await fs.stat(folder);stamp=stat.mtimeMs;}catch(error){if(error.code==='ENOENT')return [];throw error;}
  let history=historyCache.get(folder);if(history?.stamp!==stamp){const names=(await fs.readdir(folder)).filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort().reverse(),records=[];for(let offset=0;offset<names.length;offset+=8)records.push(...await Promise.all(names.slice(offset,offset+8).map(async name=>JSON.parse(await fs.readFile(path.join(folder,name),'utf8')))));history={stamp,records};historyCache.set(folder,history);}
  const found=new Map(),wanted=new Set(types.map(type=>type.id));for(const record of history.records){if(record.weekStart>=start)continue;for(const allocation of record.operatingAllocations||[])if(wanted.has(allocation.typeId)&&!found.has(allocation.typeId))found.set(allocation.typeId,allocation);if(found.size===wanted.size)break;}
  return [...found.values()];
 }
 async function read(dir,session,start){try{const record=JSON.parse(await fs.readFile(file(dir,session,start),'utf8'));return {...record,roCents:record.roCents===undefined?0:record.roCents,platformFees:record.platformFees??weeklyReport.blankPlatformFees(),expenseEntries:record.expenseEntries??weeklyReport.blankExpenses()};}catch(error){if(error.code!=='ENOENT')throw error;return {weekStart:start,breakdown:weeklyReport.blank(),labourCents:null,operatingExpensesCents:null,roCents:0,platformFees:weeklyReport.blankPlatformFees(),expenseEntries:weeklyReport.blankExpenses(),revision:0,updatedAt:null};}}
 async function save(dir,session,input){const normalized=validate(input),target=file(dir,session,normalized.weekStart);
  const operation=(pending.get(target)||Promise.resolve()).then(async()=>{
   const previous=await read(dir,session,normalized.weekStart),next={...normalized,roCents:Object.hasOwn(normalized,'roCents')?normalized.roCents:previous.roCents,platformFees:Object.hasOwn(normalized,'platformFees')?normalized.platformFees:previous.platformFees,expenseEntries:Object.hasOwn(normalized,'expenseEntries')?normalized.expenseEntries:previous.expenseEntries};
   for(const field of weeklyReport.expenseFields)if(next.expenseEntries[field]!==null)next[field]=weeklyReport.expenseTotal(next.expenseEntries[field]);
   if(Object.hasOwn(normalized,'operatingAllocations')||Object.hasOwn(previous,'operatingAllocations')){
    next.operatingAllocations=normalized.operatingAllocations??previous.operatingAllocations;next.operatingAdditionalCents=next.expenseEntries.operatingExpensesCents!==null?weeklyReport.expenseTotal(next.expenseEntries.operatingExpensesCents):Object.hasOwn(normalized,'operatingAdditionalCents')?normalized.operatingAdditionalCents:Object.hasOwn(previous,'operatingAdditionalCents')?previous.operatingAdditionalCents:previous.operatingExpensesCents;
    next.operatingExpensesCents=weeklyReport.operatingCost(next.operatingAdditionalCents,next.operatingAllocations,next.weekStart,next.expenseEntries.operatingExpensesCents!==null&&next.operatingAdditionalCents===null);if(next.operatingExpensesCents!==null&&next.operatingExpensesCents>maximumDailyCents*7)invalid('The expense total exceeds the weekly limit.');
   }
   const content=record=>JSON.stringify([record.breakdown,record.labourCents,record.operatingExpensesCents,record.roCents,record.platformFees,record.expenseEntries,record.operatingAllocations,record.operatingAdditionalCents]);
   if(content(previous)===content(next))return previous;
   if(previous.revision!==normalized.revision)invalid('This report was changed by another user or tab. Reload the saved week before saving.',409);
   const record={...next,revision:previous.revision+1,locationId:session.locationId,companyId:session.companyId,recordedBy:session.username,updatedAt:new Date().toISOString()},temp=target+'.'+crypto.randomUUID()+'.tmp';
   await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}return record;
  });const settled=operation.catch(()=>{});pending.set(target,settled);try{return await operation;}finally{if(pending.get(target)===settled)pending.delete(target);}
 }
 async function report(dir,session,selectedWeek,{orders=[],now=new Date()}={}){
  const start=selectedWeek||currentWeek(now),record=await read(dir,session,start),formatter=calendar(defaultTimeZone),operatingExpenseTypes=await expenseTypes.read(dir,session);
  if(record.revision===0&&!Object.hasOwn(record,'operatingAllocations')){record.operatingAllocations=await inheritedAllocations(dir,session,start,operatingExpenseTypes.types);record.operatingAdditionalCents=record.operatingExpensesCents;record.operatingExpensesCents=weeklyReport.operatingCost(record.operatingAdditionalCents,record.operatingAllocations,start);}
  const weeklyOrders=orders.filter(order=>{const created=new Date(order?.createdAt);if(!Number.isFinite(created.valueOf()))return false;const date=dateLabel(dayNumber(created,formatter));return date>=start&&date<=shift(start,6);});
  const seen=new Set(),stockOrders=[];for(const order of weeklyOrders){const own=allTimeTotals([],[order],session);if(!own.orderCount||seen.has(order.id))continue;seen.add(order.id);stockOrders.push({id:order.id,createdAt:order.createdAt,totalCents:own.placedOrdersCents,pricePending:own.pricePending,items:order.items.map(item=>({id:item.id||'',name:item.name||'',supplierId:item.supplierId||'',supplier:item.supplier||'',quantity:item.quantity??0,unitCostCents:item.price??null}))});}
  const costs=allTimeTotals([],weeklyOrders,session);
  const summary=weeklyReport.calculate(record.breakdown),profit=weeklyReport.profit(summary.totals.sales,{stockOrdersCents:costs.placedOrdersCents,pricePending:costs.pricePending,labourCents:record.labourCents,operatingExpensesCents:record.operatingExpensesCents,roCents:record.roCents}),platformSettlements=Object.fromEntries(weeklyReport.platforms.map(platform=>[platform,weeklyReport.settlement(summary.totals[platform],record.platformFees[platform])]));
  return {record,summary,profit,platformSettlements,stockOrders,operatingExpenseTypes,weeklyOrders:{totalCents:costs.placedOrdersCents,pricePending:costs.pricePending,orderCount:costs.orderCount},currentWeek:currentWeek(now),timeZone:defaultTimeZone};
 }
 return {save,report};
}
module.exports={createStore,validate};
