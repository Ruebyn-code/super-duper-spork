const {belongs}=require('./location-scope');
const dayMs=86400000;
const defaultTimeZone='Australia/Melbourne';
function calendar(timeZone){
 try{return new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'});}
 catch{const error=Error('Choose a valid time zone.');error.status=400;throw error;}
}
function dayNumber(date,formatter){
 const parts=Object.fromEntries(formatter.formatToParts(date).map(part=>[part.type,part.value]));
 return Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))/dayMs;
}
const dateLabel=day=>new Date(day*dayMs).toISOString().slice(0,10);
function windowFor(now=new Date(),timeZone=defaultTimeZone){
 const today=dayNumber(now,calendar(timeZone));
 const sunday=today-new Date(today*dayMs).getUTCDay();
 return {startDate:dateLabel(sunday-28),endDate:dateLabel(sunday-1),currentWeekStart:dateLabel(sunday),timeZone,weeks:4,weekStartsOn:'Sunday'};
}
function calculate(records,products,session,{now=new Date(),timeZone=defaultTimeZone,manualLevels={}}={}){
 const window=windowFor(now,timeZone),end=Date.parse(window.currentWeekStart+'T00:00:00Z')/dayMs,start=end-28;
 const totals=new Map(products.map(product=>[product.id,{thousandths:0,weeks:new Set()}]));
 for(const record of records){
  if(!record||!belongs(record,session)||record.source!=='sunday_counts_and_orders'||!Array.isArray(record.items))continue;
  const day=Date.parse(record.weekStart+'T00:00:00Z')/dayMs;
  if(!Number.isFinite(day)||day<start||day>=end||new Date(day*dayMs).getUTCDay()!==0)continue;
  for(const item of record.items){
   const total=totals.get(item?.id);if(!total||total.weeks.has(record.weekStart)||item.status!=='complete'||typeof item.quantity!=='number'||!Number.isFinite(item.quantity)||item.quantity<0)continue;
   const value=Math.round(item.quantity*1000);if(!Number.isSafeInteger(total.thousandths+value))throw Error('Usage total exceeds the supported range.');
   total.thousandths+=value;total.weeks.add(record.weekStart);
  }
 }
 return {window:{...window,scope:session.locationId?'location':'account',source:'sunday_counts_and_orders'},levels:Object.fromEntries([...totals].map(([id,total])=>{
  const weeks=total.weeks.size,manualLevel=Number.isInteger(manualLevels[id])&&manualLevels[id]>=0&&manualLevels[id]<=1000000?manualLevels[id]:null;
  const average=weeks?total.thousandths/(weeks*1000):null;
  // Counts use thousandths: flooring the mean to that precision preserves <= average.
  const orderWhenLevel=weeks?Math.floor(total.thousandths/weeks)/1000:null;
  return [id,{level:weeks?Math.ceil(total.thousandths/(weeks*1000)):manualLevel,orderWhenLevel,average,usedQuantity:total.thousandths/1000,weeksRecorded:weeks,manualLevel,source:weeks?'usage':manualLevel!==null?'manual':'unavailable'}];
 }))};
}
module.exports={windowFor,calculate,defaultTimeZone,calendar,dayNumber,dateLabel};
