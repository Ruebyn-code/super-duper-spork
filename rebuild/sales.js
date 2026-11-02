// Sales and reporting for the rebuilt app: daily sales weeks, the weekly
// report import, hourly sales, operating expenses and budgets.
//
// The forecast itself is not re-derived here. `../sales.calculate()` — the
// current app's own projection — is called with rows shaped the same way, and
// the hourly split is `../hourly-sales.forecast()` over a
// `public/rostering-model` projection, so an imported week drives exactly the
// forecast the current app shows. Holiday adjustments reuse
// `../holiday-projections.adjustments()` against a derived location snapshot.
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
const access=require('./access');
const permissions=require('./permissions');
const M=require('../public/rostering-model');
const legacySales=require('../sales');
const hourly=require('../hourly-sales');
const holidayProjections=require('../holiday-projections');

const maximumDailyCents=legacySales.maximumDailyCents;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const dayMs=86400000;
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*dayMs).toISOString().slice(0,10);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const monday=date=>shift(date,-(new Date(date+'T00:00:00Z').getUTCDay()+6)%7);
const cents=value=>Number.isSafeInteger(value)&&value>=0&&value<=maximumDailyCents;
const text=(value,max=200)=>String(value??'').trim().slice(0,max);

function createSales({store,dir,now=Date.now}){
 const stamp=()=>new Date(now()).toISOString();

 // Today's date in Melbourne, the calendar every trading and cost week uses.
 function today(){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now())).map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
 }

 function requireSalesEdit(actor){permissions.requirePermission(actor,'sales.edit');}
 function action(actor,key){if(!permissions.can(actor,key))throw permissions.deny('You do not have permission to do that.');}

 async function saveWeek(actor,input){
  requireSalesEdit(actor);
  const {company,location}=await access.write({store,account:actor,permission:'sales.edit',companyId:input?.companyId,locationId:input?.locationId});
  const weekStart=input?.weekStart;
  if(!validDate(weekStart)||monday(weekStart)!==weekStart)fail('Choose a valid Monday-starting sales week.');
  const days=Array.isArray(input?.days)?input.days:null;
  if(!days||days.length!==7||days.some(value=>value!==null&&!cents(value)))fail('Enter non-negative daily sales for each day, or leave a day blank.');
  const revision=Number(input?.revision);
  if(!Number.isSafeInteger(revision)||revision<0)fail('Reload the saved week before saving.');
  return store.change('salesWeeks',list=>{
   const existing=list.find(record=>record.locationId===location.id&&record.weekStart===weekStart);
   if(existing&&JSON.stringify(existing.days)===JSON.stringify(days))return existing;
   if(existing){
    if(existing.revision!==revision)fail('This week was changed elsewhere. Reload before saving.',409);
    Object.assign(existing,{days,revision:existing.revision+1,updatedAt:stamp(),recordedById:actor.id});
    return existing;
   }
   if(revision!==0)fail('This week was changed elsewhere. Reload before saving.',409);
   const record={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,locationName:location.name,weekStart,days,revision:1,recordedById:actor.id,updatedAt:stamp()};
   list.push(record);
   return record;
  });
 }

 // CSV export of the weekly report sheet: date, till, Uber Eats, DoorDash and
 // optionally platform fees and the sheet's own row total. Amounts are dollars
 // and are stored as integer cents; a row total that disagrees with its
 // channels refuses the whole import, so an imported week always reconciles.
 function parseReport(text){
  const lines=String(text||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines.length<2)fail('Paste the weekly report with a header row and seven dated rows.');
  const header=lines[0].split(',').map(value=>value.trim().toLowerCase().replace(/[^a-z]/g,''));
  const column=names=>{for(const name of names){const index=header.indexOf(name);if(index>=0)return index;}return -1;};
  const columns={date:column(['date','day']),till:column(['till','tillsales']),uber:column(['uber','ubereats']),door:column(['door','doordash']),fees:column(['fees','platformfees']),total:column(['total','rowtotal','reporttotal'])};
  if([columns.date,columns.till,columns.uber,columns.door].some(index=>index<0))fail('The report needs date, till, Uber Eats and DoorDash columns.');
  const amount=(raw,label)=>{
   const clean=String(raw??'').replace(/[$,\s]/g,'');
   if(!clean)return 0;
   const value=Number(clean);
   if(!Number.isFinite(value)||value<0)fail('Enter report amounts as non-negative dollars in '+label+'.');
   const rounded=Math.round(value*100);
   if(!cents(rounded))fail('A report amount in '+label+' is outside the supported range.');
   return rounded;
  };
  const rows=lines.slice(1).map(line=>{
   const cells=line.split(',').map(value=>value.trim().replace(/^"|"$/g,''));
   const date=cells[columns.date];
   if(!validDate(date))fail('Every report row needs a YYYY-MM-DD date.');
   return {
    date, tillSales:amount(cells[columns.till],date+' till'),
    uberEats:amount(cells[columns.uber],date+' Uber Eats'), doorDash:amount(cells[columns.door],date+' DoorDash'),
    feesCents:columns.fees<0?0:amount(cells[columns.fees],date+' fees'),
    statedCents:columns.total<0?null:amount(cells[columns.total],date+' total')
   };
  });
  if(rows.length!==7)fail('A weekly report needs exactly seven rows.');
  const weekStart=rows[0].date;
  if(monday(weekStart)!==weekStart)fail('Start the report on a Monday.');
  for(const [index,row] of rows.entries())if(row.date!==shift(weekStart,index))fail('Report dates must be consecutive Monday to Sunday.');
  for(const row of rows){
   const sum=row.tillSales+row.uberEats+row.doorDash;
   if(row.statedCents!==null&&row.statedCents!==sum)fail('The report total for '+row.date+' does not equal its channels, so this week does not reconcile.');
  }
  const breakdown={
   tillSales:rows.map(row=>row.tillSales),
   uberEats:rows.map(row=>row.uberEats),
   doorDash:rows.map(row=>row.doorDash)
  };
  const totals=Array.from({length:7},(_,index)=>breakdown.tillSales[index]+breakdown.uberEats[index]+breakdown.doorDash[index]);
  return {
   weekStart,breakdown,feesCents:rows.reduce((sum,row)=>sum+row.feesCents,0),
   days:rows.map((row,index)=>({date:row.date,totalCents:totals[index],feesCents:row.feesCents})),
   totalCents:totals.reduce((sum,value)=>sum+value,0),
   checksum:crypto.createHash('sha256').update(String(text)).digest('hex')
  };
 }

 async function importReport(actor,input){
  requireSalesEdit(actor);
  action(actor,'weekly.import');
  const {company,location}=await access.write({store,account:actor,permission:'sales.edit',companyId:input?.companyId,locationId:input?.locationId});
  const parsed=parseReport(input?.csv);
  return store.change('weeklyReports',list=>{
   const existing=list.find(record=>record.locationId===location.id&&record.weekStart===parsed.weekStart);
   const record={...existing,...parsed,id:existing?.id||crypto.randomUUID(),companyId:company.id,locationId:location.id,locationName:location.name,
    revision:(existing?.revision||0)+1,importedById:actor.id,importedByName:actor.name,importedAt:stamp(),sourceName:text(input?.sourceName,180)||'Pasted report'};
   if(existing)Object.assign(existing,record);else list.push(record);
   return {report:record,reconciled:true};
  });
 }

 async function saveHourly(actor,input){
  requireSalesEdit(actor);
  action(actor,'hourly.import');
  const {company,location}=await access.write({store,account:actor,permission:'sales.edit',companyId:input?.companyId,locationId:input?.locationId});
  const date=input?.date;
  if(!validDate(date)||date>today())fail('Choose a valid report date that is not in the future.');
  const hours=Array.isArray(input?.hours)?input.hours:null;
  if(!hours||hours.length!==24||hours.some(value=>value!==null&&!cents(value)))fail('Enter hourly sales for the 24 hours, or leave an hour blank.');
  const revision=Number(input?.revision);
  if(!Number.isSafeInteger(revision)||revision<0)fail('Reload the saved day before saving.');
  return store.change('hourlySales',list=>{
   const existing=list.find(record=>record.locationId===location.id&&record.date===date);
   if(existing&&existing.revision!==revision)fail('Hourly sales changed elsewhere. Reload before saving.',409);
   const record={id:existing?.id||crypto.randomUUID(),companyId:company.id,locationId:location.id,date,hours,revision:(existing?.revision||0)+1,recordedById:actor.id,updatedAt:stamp()};
   if(existing)Object.assign(existing,record);else list.push(record);
   return record;
  });
 }

 async function saveExpense(actor,input){
  const {company,location}=await access.write({store,account:actor,permission:'finances.edit',companyId:input?.companyId,locationId:input?.locationId});
  const date=input?.date;
  if(!validDate(date))fail('Choose a valid expense date.');
  const amountCents=Number(input?.amountCents);
  if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>maximumDailyCents)fail('Enter an expense above zero in cents.');
  const type=text(input?.type,60);
  if(!type)fail('Choose an expense type.');
  const record={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,date,type,description:text(input?.description,300),amountCents,recordedById:actor.id,recordedByName:actor.name,createdAt:stamp()};
  await store.change('expenses',list=>{list.push(record);});
  return record;
 }

 async function saveBudget(actor,input){
  const {company,location}=await access.write({store,account:actor,permission:'finances.edit',companyId:input?.companyId,locationId:input?.locationId});
  const weekStart=input?.weekStart;
  if(!validDate(weekStart)||monday(weekStart)!==weekStart)fail('Choose a valid Monday-starting week for the budget.');
  const salesCents=input?.salesCents===''||input?.salesCents==null?null:Number(input.salesCents);
  const labourCents=input?.labourCents===''||input?.labourCents==null?null:Number(input.labourCents);
  if(salesCents!==null&&!cents(salesCents))fail('Enter a sales budget in cents.');
  if(labourCents!==null&&!cents(labourCents))fail('Enter a labour budget in cents.');
  return store.change('budgets',list=>{
   const existing=list.find(record=>record.locationId===location.id&&record.weekStart===weekStart);
   if(existing){Object.assign(existing,{salesCents,labourCents,updatedAt:stamp()});return existing;}
   const record={id:crypto.randomUUID(),companyId:company.id,locationId:location.id,weekStart,salesCents,labourCents,updatedAt:stamp()};
   list.push(record);
   return record;
  });
 }

 // Weekly-report-first resolution, the current app's one source per day: the
 // report's three channels when all are recorded, otherwise Daily sales.
 function weekRecord(daily,reports,weekStart,locationId){
  const dailyRecord=daily.find(record=>record.weekStart===weekStart),report=reports.find(record=>record.weekStart===weekStart);
  const sources=[];
  const days=Array.from({length:7},(_,index)=>{
   const values=report?['tillSales','uberEats','doorDash'].map(field=>report.breakdown?.[field]?.[index])?.map(value=>cents(value)?value:null):null;
   if(values&&values.every(value=>value!==null)){sources.push('weekly-report');return values.reduce((sum,value)=>sum+value,0);}
   const value=dailyRecord?.days?.[index]??null;
   sources.push(cents(value)?'daily-sales':null);
   return cents(value)?value:null;
  });
  return {weekStart,locationId,days,sources};
 }

 async function history(locationId){
  const [daily,reports,hourlyRows]=await Promise.all([store.read('salesWeeks'),store.read('weeklyReports'),store.read('hourlySales')]);
  const starts=[...new Set([...daily,...reports].filter(record=>record.locationId===locationId).map(record=>record.weekStart))].sort();
  return {
   records:starts.map(start=>weekRecord(daily,reports,start,locationId)),
   hourly:{days:Object.fromEntries(hourlyRows.filter(record=>record.locationId===locationId).map(record=>[record.date,{hours:record.hours}]))}
  };
 }

 function orderRows(orders,locationId){
  return orders.filter(order=>order.locationId===locationId&&order.status!=='deleted').map(order=>({
   ...order,status:'requested',requestOwnerId:locationId,total:order.totalCents,
   pricePending:order.items.some(item=>!Number.isSafeInteger(item.unitPriceCents))
  }));
 }

 // The location's own projection, reused verbatim from the current app, with
 // the shared public-holiday adjustment applied on top.
 async function project(location,records,orders,weekStart){
  const session={id:location.id,locationId:location.id,companyId:location.companyId};
  const asOf=today();
  const base=legacySales.calculate(records,orderRows(orders,location.id),session,{now:new Date(now())});
  const scratch=path.join(dir,'projection');
  await fs.mkdir(scratch,{recursive:true});
  const locations=await store.read('locations');
  await fs.writeFile(path.join(scratch,'locations.json'),JSON.stringify(locations.map(item=>({id:item.id,companyId:item.companyId,name:item.name,archived:item.archived,publicHolidayState:item.publicHolidayState||null}))));
  const changes=await holidayProjections.adjustments(scratch,session,{
   weekStarts:[...new Set([weekStart,base.weekStart,...base.history.map(week=>week.weekStart)])],
   anchor:base.weekStart,asOf,readRevenue:starts=>Promise.resolve(starts.map(start=>records.find(record=>record.weekStart===start)).filter(Boolean))
  });
  return {projection:holidayProjections.apply(base,changes),changes};
 }

 async function forecast(actor,input){
  const {company,location}=await access.read({store,account:actor,permission:'sales.view',companyId:input?.companyId,locationId:input?.locationId});
  const view=await history(location.id);
  const weekStart=input?.weekStart&&validDate(input.weekStart)?monday(input.weekStart):legacySales.currentWeek(new Date(now()));
  const orders=await store.read('orders');
  const {projection,changes}=await project(location,view.records,orders,weekStart);
  // Hourly: the same rostering-model projection, adjusted the same way, fed to
  // the current app's allocate-by-weekday-pattern function.
  const roster=M.project(view.records,weekStart,now());
  const daily=roster.daily.map(day=>{const holiday=changes[day.date];return {date:day.date,salesCents:holiday?.status==='adjusted'?holiday.amountCents:day.salesCents,holiday:holiday||null};});
  const hourlyProjection={...roster,daily,projectedSalesCents:daily.every(day=>cents(day.salesCents))?daily.reduce((sum,day)=>sum+day.salesCents,0):null};
  const date=input?.date&&validDate(input.date)?input.date:projection.today;
  return {
   company,location,weekStart:projection.weekStart,projection,changes,
   hourly:{date,forecast:hourly.forecast(view.hourly,date,hourlyProjection),history:Object.entries(view.hourly.days).sort(([a],[b])=>b.localeCompare(a)).slice(0,14).map(([day,value])=>({date:day,totalCents:value.hours.reduce((sum,amount)=>sum+(amount??0),0)}))}
  };
 }

 // Financial week: recorded sales against orders, transfers, invoice totals and
 // operating expenses. A week with any unrecorded day reports unknown profit
 // instead of a smaller, misleading number.
 async function weekReport(actor,input){
  const {company,location}=await access.read({store,account:actor,permission:'reporting.view',companyId:input?.companyId,locationId:input?.locationId});
  const weekStart=input?.weekStart&&validDate(input.weekStart)?monday(input.weekStart):legacySales.currentWeek(new Date(now()));
  const [view,orders,transfers,invoices,expenses,budgets]=await Promise.all([
   history(location.id),store.read('orders'),store.read('transfers'),store.read('invoices'),store.read('expenses'),store.read('budgets')
  ]);
  const record=view.records.find(item=>item.weekStart===weekStart)||weekRecord([],[],weekStart,location.id);
  const dayCosts=Array.from({length:7},(_,index)=>shift(weekStart,index));
  const inWeek=value=>dayCosts.includes(value);
  const orderCosts=orders.filter(order=>order.locationId===location.id&&order.status!=='deleted'&&inWeek(String(order.createdAt||'').slice(0,10)));
  const transferCosts=transfers.filter(record=>record.status==='received'&&inWeek(String(record.receivedAt||'').slice(0,10))&&(record.from.id===location.id||record.to.id===location.id))
   .reduce((total,record)=>total+record.items.reduce((sum,line)=>sum+(line.costCents||0),0),0);
  const invoiceCosts=invoices.filter(record=>record.locationId===location.id&&record.weekStart===weekStart&&record.status==='applied').reduce((sum,record)=>sum+(record.totalCents||0),0);
  const expenseCosts=expenses.filter(record=>record.locationId===location.id&&inWeek(record.date)).reduce((sum,record)=>sum+record.amountCents,0);
  const recorded=record.days.filter(value=>value!==null),recordedDays=recorded.length;
  const salesCents=recorded.reduce((sum,value)=>sum+value,0);
  const orderCostCents=orderCosts.reduce((sum,order)=>sum+(order.totalCents||0),0);
  const pricePending=orderCosts.some(order=>order.items.some(item=>!Number.isSafeInteger(item.unitPriceCents)));
  const costCents=orderCostCents+transferCosts+invoiceCosts+expenseCosts;
  const complete=recordedDays===7&&!pricePending;
  const budget=budgets.find(item=>item.locationId===location.id&&item.weekStart===weekStart)||null;
  return {
   company,location,weekStart,weekEnd:shift(weekStart,6),days:record.days,sources:record.sources,recordedDays,
   salesCents,costCents,orderCostCents,transferCostCents:transferCosts,invoiceCostCents:invoiceCosts,expenseCents:expenseCosts,
   profitCents:complete?salesCents-costCents:null,marginPct:complete&&salesCents>0?Math.round((salesCents-costCents)/salesCents*10000)/100:null,
   complete,pricePending,budget,
   expenses:expenses.filter(record=>record.locationId===location.id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30),
   invoices:invoices.filter(record=>record.locationId===location.id&&record.weekStart===weekStart)
  };
 }

 async function listWeeks(actor,locationId){
  const [daily,reports]=await Promise.all([store.read('salesWeeks'),store.read('weeklyReports')]);
  const starts=[...new Set([...daily,...reports].filter(record=>record.locationId===locationId).map(record=>record.weekStart))].sort().reverse().slice(0,26);
  const dailyRecord=start=>daily.find(record=>record.locationId===locationId&&record.weekStart===start);
  return starts.map(start=>{
   const resolved=weekRecord(daily,reports,start,locationId),record=dailyRecord(start);
   return {weekStart:start,days:resolved.days,sources:resolved.sources,revision:record?.revision||0,imported:Boolean(reports.find(item=>item.locationId===locationId&&item.weekStart===start))};
  });
 }

 async function weeklyReport(actor,locationId,weekStart){
  const reports=await store.read('weeklyReports');
  return reports.find(record=>record.locationId===locationId&&record.weekStart===weekStart)||null;
 }

 async function hourlyDay(actor,locationId,date){
  const rows=await store.read('hourlySales');
  return rows.find(record=>record.locationId===locationId&&record.date===date)||{locationId,date,hours:Array(24).fill(null),revision:0};
 }

 return {today,saveWeek,importReport,parseReport,saveHourly,saveExpense,saveBudget,forecast,weekReport,listWeeks,weeklyReport,hourlyDay,projection:forecast};
}
module.exports={createSales,maximumDailyCents,monday,shift};
