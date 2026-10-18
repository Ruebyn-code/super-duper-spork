const sales=require('./sales'),weekly=require('./public/weekly-sales-report');
const {calendar,defaultTimeZone,dayNumber,dateLabel}=require('./par-levels'),{shift}=require('./stock-usage');
const orderCosts=require('./order-cost-period');
const schedules=require('./operating-expense-schedule'),types=require('./operating-expense-types');
const fields=['salesCents','costOfGoodsPercent','labourPercent','opExPercent','roPercent','profitCents','profitPercent'];
function invalid(){const error=Error('Choose Quarter or Year to date and a valid quarter (for example 2026-Q4).');error.status=400;throw error;}
function date(year,month,day){return new Date(Date.UTC(year,month,day)).toISOString().slice(0,10);}
function period(params={},now=new Date()){
 const today=dateLabel(dayNumber(now,calendar(defaultTimeZone))),current=sales.currentQuarter(now),mode=params.mode||'quarter';
 if(!['quarter','ytd'].includes(mode))invalid();
 if(mode==='ytd'){
  const year=Number(today.slice(0,4)),month=Number(today.slice(5,7))-1,day=Number(today.slice(8)),previousDay=Math.min(day,new Date(Date.UTC(year-1,month+1,0)).getUTCDate());
  return {mode,key:String(year),label:year+' · Year to date',startDate:date(year,0,1),endDate:today,previous:{label:'Last year to date',startDate:date(year-1,0,1),endDate:date(year-1,month,previousDay)},currentQuarter:current.year+'-Q'+current.number,today};
 }
 const key=params.quarter||current.year+'-Q'+current.number,match=typeof key==='string'&&key.match(/^(\d{4})-Q([1-4])$/);if(!match||Number(match[1])<1901||Number(match[1])>9998)invalid();
 const year=Number(match[1]),quarter=Number(match[2]),month=(quarter-1)*3;
 return {mode,key,label:'Q'+quarter+' '+year,startDate:date(year,month,1),endDate:date(year,month+3,0),previous:{label:'Last quarter',startDate:date(year,month-3,1),endDate:date(year,month,0)},currentQuarter:current.year+'-Q'+current.number,today};
}
// A week belongs to the quarter/year containing its Sunday. Include the current
// incomplete week in YTD, but exclude it from the completed-week averages.
function weeks(range,{includePartial=false}={}){
 const firstSunday=shift(range.startDate,(7-new Date(range.startDate+'T00:00:00Z').getUTCDay())%7),result=[];
 for(let sunday=firstSunday;sunday<=range.endDate;sunday=shift(sunday,7))result.push(shift(sunday,-6));
 if(includePartial){const lastSunday=shift(range.endDate,-new Date(range.endDate+'T00:00:00Z').getUTCDay()),nextMonday=shift(lastSunday,1);if(nextMonday<=range.endDate)result.push(nextMonday);}
 return result;
}
const percent=(cost,revenue)=>cost!==null&&revenue>0?cost/revenue*100:null;
function row(report,currentWeek,throughDate,fromDate){
 const {record}=report,weeklyOrders=report.stockCosts||report.weeklyOrders;let breakdown=record.breakdown;
 if(throughDate)breakdown=Object.fromEntries(weekly.fields.map(field=>[field,record.breakdown[field].map((value,index)=>shift(record.weekStart,index)>throughDate||shift(record.weekStart,index)<fromDate?null:value)]));
 const summary=weekly.calculate(breakdown),revenue=summary.totals.sales,goods=weeklyOrders.pricePending?null:weeklyOrders.totalCents,costs={stockOrdersCents:weeklyOrders.supplierOrdersCents??goods,stockTransferCents:weeklyOrders.transferCents||0,pricePending:weeklyOrders.pricePending,labourCents:record.labourCents,operatingExpensesCents:record.operatingExpensesCents,roCents:record.roCents},profit=weekly.profit(revenue,costs);
 return {weekStart:record.weekStart,weekEnd:shift(record.weekStart,6),recordedDays:summary.recordedDays,completed:record.weekStart<currentWeek&&summary.recordedDays===7,salesCents:revenue,costOfGoodsPercent:percent(goods,revenue),labourPercent:percent(record.labourCents,revenue),opExPercent:percent(record.operatingExpensesCents,revenue),roPercent:percent(record.roCents,revenue),profitCents:profit.amountCents,profitPercent:percent(profit.amountCents,revenue),profitState:profit.state,pricePending:weeklyOrders.pricePending};
}
function average(rows){
 const complete=rows.filter(row=>row.completed),counts={},result={completedWeeks:complete.length};
 for(const field of fields){const known=complete.filter(row=>row[field]!==null);counts[field]=known.length;result[field]=known.length?known.reduce((sum,row)=>sum+row[field],0)/known.length:null;if(field.endsWith('Cents')&&result[field]!==null)result[field]=Math.sign(result[field])*Math.round(Math.abs(result[field]))||0;}
 // Profit percentage compares total profit with the same weeks' total sales.
 const known=complete.filter(row=>row.profitCents!==null&&row.salesCents!==null),revenue=known.reduce((sum,row)=>sum+row.salesCents,0);result.profitPercent=revenue>0?known.reduce((sum,row)=>sum+row.profitCents,0)/revenue*100:null;counts.profitPercent=known.length;
 return {...result,counts};
}
async function build(dir,session,params={}, {orders=[],transfers=[],store=salesReportStore(),now=new Date()}={}){
 const selected=period(params,now),currentWeek=sales.currentWeek(now),formatter=calendar(defaultTimeZone),groups=new Map();
 for(const order of orders){const period=orderCosts.dates(order,formatter);if(!period)continue;const start=period.costWeekStart;if(!groups.has(start))groups.set(start,[]);groups.get(start).push({...order,_overviewDate:period.costDate});}
 const [schedule,catalogue]=await Promise.all([schedules.read(dir,session),types.read(dir,session)]);
 async function collect(range){const starts=weeks(range,{includePartial:selected.mode==='ytd'}),result=[];for(let offset=0;offset<starts.length;offset+=8)result.push(...await Promise.all(starts.slice(offset,offset+8).map(async start=>{
  const relevant=(groups.get(start)||[]).filter(order=>selected.mode!=='ytd'||order._overviewDate>=range.startDate&&order._overviewDate<=range.endDate),report=await store.report(dir,session,start,{orders:relevant,transfers:transfers.filter(transfer=>selected.mode!=='ytd'||orderCosts.dates({createdAt:transfer.receivedAt},formatter)?.costDate<=range.endDate&&orderCosts.dates({createdAt:transfer.receivedAt},formatter)?.costDate>=range.startDate),now,operatingScheduleSnapshot:schedule,expenseTypesSnapshot:catalogue});return row(report,currentWeek,selected.mode==='ytd'?range.endDate:null,range.startDate);
 })));return result;}
 const rows=await collect(selected),previousRows=await collect(selected.previous);
 return {period:selected,rows,average:average(rows),previousAverage:average(previousRows),currentWeek,timeZone:defaultTimeZone};
}
function salesReportStore(){return require('./weekly-sales-reports').createStore();}
module.exports={period,weeks,row,average,build};
