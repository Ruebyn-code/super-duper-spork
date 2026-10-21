const {shift}=require('./stock-usage');
const publicHolidays=require('./australian-public-holidays');
const nameKey=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const monday=date=>shift(date,-(new Date(date+'T00:00:00Z').getUTCDay()+6)%7);
const valid=value=>Number.isSafeInteger(value)&&value>=0;

// Only location-scoped holiday dates and revenue aggregates enter forecasts.
async function adjustments(dir,session,{weekStarts,anchor,asOf=anchor,readRevenue}){
 if(!session.locationId||!session.companyId)return {};
 const years=weekStarts.flatMap(start=>[Number(start.slice(0,4)),Number(shift(start,6).slice(0,4))]).flatMap(year=>[year-1,year]),calendars=await publicHolidays.locationCalendars(dir,session,years);
 const holidays=[];for(const calendar of calendars)for(const item of calendar.dates||[]){if(typeof item.date==='string'&&Number(item.date.slice(0,4))===calendar.year&&nameKey(item.name)&&!holidays.some(day=>day.date===item.date&&nameKey(day.name)===nameKey(item.name)))holidays.push({date:item.date,name:item.name});}
 const dates=new Set(weekStarts.flatMap(start=>Array.from({length:7},(_,index)=>shift(start,index)))),targets=holidays.filter(day=>dates.has(day.date));if(!targets.length)return {};
 const plans=targets.map(target=>{
  const matches=holidays.filter(day=>Number(day.date.slice(0,4))===Number(target.date.slice(0,4))-1&&nameKey(day.name)===nameKey(target.name)),sameDay=targets.filter(day=>day.date===target.date),meta={name:target.name,status:'fallback'},pairs=[];
  if(sameDay.length!==1||matches.length!==1)meta.reason='A unique matching holiday is needed in last year’s public holiday calendar.';
  else{
   meta.previousDate=matches[0].date;
   if(meta.previousDate>=asOf)meta.reason='Last year’s matching holiday is not in the completed sales history yet.';
   else{
    const fromDate=shift(meta.previousDate,1),throughDate=shift(asOf<target.date?asOf:target.date,-1);
    for(let date=fromDate;date<=throughDate;date=shift(date,1)){
     const previous=(Number(date.slice(0,4))-1)+date.slice(4);if(new Date(previous+'T00:00:00Z').toISOString().slice(0,10)!==previous)continue;
     pairs.push({date,previous});
    }
    meta.comparison={kind:'since-previous-holiday',fromDate,throughDate,previousFromDate:pairs[0]?.previous||null,previousThroughDate:pairs.at(-1)?.previous||null};
   }
  }
  return{target,meta,pairs};
 });
 const needed=new Set();for(const {meta,pairs}of plans)if(!meta.reason){needed.add(monday(meta.previousDate));for(const pair of pairs){needed.add(monday(pair.date));needed.add(monday(pair.previous));}}
 const starts=[...needed],records=[];for(let offset=0;offset<starts.length;offset+=16)records.push(...await readRevenue(starts.slice(offset,offset+16)));
 const revenue=new Map();for(const record of records)for(const [index,value]of (record.days||[]).entries())if(valid(value))revenue.set(shift(record.weekStart,index),value);
 const result={};
 for(const {target,meta,pairs}of plans){
  if(!meta.reason){
   let currentTotal=0,previousTotal=0,comparisonDays=0;
   if(!revenue.has(meta.previousDate))meta.reason='Sales for last year’s matching holiday are missing.';
   for(const {date,previous}of pairs){
    if(!revenue.has(date)||!revenue.has(previous)){meta.reason||='Sales are missing from the comparison since last year’s holiday.';continue;}
    currentTotal+=revenue.get(date);previousTotal+=revenue.get(previous);comparisonDays++;
   }
   if(!meta.reason&&(!comparisonDays||previousTotal===0))meta.reason='The year-on-year sales change cannot be calculated from the available comparison sales.';
   if(!meta.reason){
    const previousSalesCents=revenue.get(meta.previousDate),amountCents=Number((2n*BigInt(previousSalesCents)*BigInt(currentTotal)+BigInt(previousTotal))/(2n*BigInt(previousTotal)));
    if(!valid(amountCents))meta.reason='The adjusted holiday sales exceed the supported forecast range.';
    else Object.assign(meta,{status:'adjusted',previousSalesCents,amountCents,growthPercent:Math.round((currentTotal/previousTotal-1)*10000)/100,comparisonDays});
   }
  }
  result[target.date]=meta;
 }
 return result;
}

function apply(projection,changes,{dailyKey='dailyProjections',amountKey='amountCents'}={}){
 const original=projection[dailyKey];if(!original.some(day=>changes[day.date]))return projection;
 let adjusted=false;const daily=original.map(day=>{const holiday=changes[day.date];if(!holiday)return day;adjusted||=holiday.status==='adjusted';return {...day,[amountKey]:holiday.status==='adjusted'?holiday.amountCents:day[amountKey],holiday};});
 const total=adjusted?(daily.every(day=>valid(day[amountKey]))?daily.reduce((sum,day)=>sum+day[amountKey],0):null):projection.projectedSalesCents,projectedSalesCents=valid(total)?total:null;
 const result={...projection,[dailyKey]:daily,projectedSalesCents};
 if(Object.hasOwn(projection,'budgetCents')){result.budgetCents=projectedSalesCents===null?null:Math.round(projectedSalesCents*projection.budgetPercent/100);result.remainingCents=result.budgetCents===null||projection.pricePending?null:result.budgetCents-projection.spentCents;}
 return result;
}
module.exports={adjustments,apply};
