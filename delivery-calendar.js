const time=require('./delivery-time'),holidays=require('./australian-public-holidays'),model=require('./public/supplier-delivery-days-model');
function plan(schedule,{now=Date.now(),timeZone='Australia/Melbourne',holidayDates=new Set(),holidayCalendarAvailable=true}={}){
 const today=time.parts(now,timeZone).date,configured=Number.isInteger(schedule?.leadDays)&&Boolean(schedule.cutoffTime&&schedule.deliveryTime),exceptions=new Map((schedule?.exceptions||[]).map(row=>[row.date,row.delivery]));
 const rule=model.holidayRule(schedule),overrides=new Map((schedule?.holidayOverrides||[]).map(row=>[row.date,row.rule]));
 const needsCalendar=rule!=='deliver'||Boolean(schedule?.cutoffHolidays)||[...overrides.values()].some(value=>value!=='deliver');
 if(schedule&&needsCalendar&&!holidayCalendarAvailable)return{timeZone,timingConfigured:configured,next:null,following:null,missedCutoff:false,reason:'Set the location state or a reviewed holiday calendar to apply public holiday settings'};
 const holiday=date=>holidayDates.has(date),regular=date=>Boolean(schedule?.days?.includes(model.days[(new Date(date+'T00:00:00Z').getUTCDay()+6)%7][0]));
 // Regular deliveries on a public holiday follow that holiday's choice (or the default): deliver, skip, or move to the nearest
 // earlier/later day that is not a holiday and not a one-off "no delivery" date. One-off changes always take priority.
 const deliveries=new Map();
 for(let index=-7;index<=187;index++){
  const date=time.shift(today,index);if(date>'2099-12-31')break;
  if(exceptions.has(date)){if(exceptions.get(date)&&!deliveries.has(date))deliveries.set(date,null);continue;}
  if(!regular(date))continue;
  if(!holiday(date)){if(!deliveries.has(date))deliveries.set(date,null);continue;}
  const choice=overrides.get(date)||rule;
  if(choice==='deliver'){if(!deliveries.has(date))deliveries.set(date,null);continue;}
  if(choice==='skip')continue;
  const step=choice==='before'?-1:1;let moved=date;
  for(let tries=0;tries<7;tries++){moved=time.shift(moved,step);if(!holiday(moved)&&exceptions.get(moved)!==false){if(!deliveries.has(moved))deliveries.set(moved,date);break;}}
 }
 const orderDate=date=>{let day=time.shift(date,-schedule.leadDays);if(schedule.cutoffHolidays)for(let tries=0;tries<14&&holiday(day);tries++)day=time.shift(day,-1);return day;};
 const candidates=[];for(const [date,movedFrom] of [...deliveries].sort((a,b)=>a[0].localeCompare(b[0]))){if(date<today||date>time.shift(today,180)||!configured&&date<=today)continue;const at=time.instant(date,configured?schedule.deliveryTime:'23:59',timeZone);if(at<=now)continue;const orderBy=configured?time.instant(orderDate(date),schedule.cutoffTime,timeZone):null;candidates.push({date,arrivesAt:new Date(at).toISOString(),orderBy:orderBy===null?null:new Date(orderBy).toISOString(),...(movedFrom?{movedFrom}:{})});}
 const next=candidates.find(row=>!configured||Date.parse(row.orderBy)>now)||null,following=next?candidates.find(row=>row.date>next.date)||null:null;
 return{timeZone,timingConfigured:configured,next,following,missedCutoff:Boolean(configured&&candidates[0]&&(!next||candidates[0].date!==next.date)),reason:!schedule?'Delivery schedule not set':!next?'No available delivery in the next 180 days':!configured?'Set lead time, cutoff and delivery time for delivery-based recommendations':!following?'A following delivery is needed to calculate stock coverage':null};
}
async function plans(dir,actor,schedules,location,{now=Date.now()}={}){const zone=time.zoneFor(location),year=Number(time.parts(now,zone).date.slice(0,4)),calendars=await holidays.locationCalendars(dir,actor,[year,year+1]),holidayDates=new Set(calendars.flatMap(c=>c.dates.map(day=>day.date)));return new Map(schedules.map(schedule=>[schedule.supplierId,plan(schedule,{now,timeZone:zone,holidayDates,holidayCalendarAvailable:calendars.length>0})]));}
module.exports={plan,plans};
