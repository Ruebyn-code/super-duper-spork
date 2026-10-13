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
 const monday=today-(new Date(today*dayMs).getUTCDay()+6)%7;
 return {startDate:dateLabel(monday-28),endDate:dateLabel(monday-1),currentWeekStart:dateLabel(monday),timeZone,weeks:4,weekStartsOn:'Monday'};
}
function calculate(records,products,session,{now=new Date(),timeZone=defaultTimeZone}={}){
 const window=windowFor(now,timeZone),end=Date.parse(window.currentWeekStart+'T00:00:00Z')/dayMs,start=end-28;
 const totals=new Map(products.map(product=>[product.id,{thousandths:0,weeks:new Set()}]));
 for(const record of records){
  if(!record||record.accountId!==session.id||!Array.isArray(record.items))continue;
  const day=Date.parse(record.weekStart+'T00:00:00Z')/dayMs;
  if(!Number.isFinite(day)||day<start||day>=end||new Date(day*dayMs).getUTCDay()!==1)continue;
  for(const item of record.items){
   const total=totals.get(item?.id);if(!total||total.weeks.has(record.weekStart)||typeof item.quantity!=='number'||!Number.isFinite(item.quantity)||item.quantity<0||item.quantity>2000000)continue;
   total.thousandths+=Math.round(item.quantity*1000);total.weeks.add(record.weekStart);
  }
 }
 return {window:{...window,scope:'account',source:'usage'},levels:Object.fromEntries([...totals].map(([id,total])=>[id,{level:total.weeks.size===4?Math.ceil(total.thousandths/4000):null,average:total.weeks.size===4?total.thousandths/4000:null,usedQuantity:total.thousandths/1000,weeksRecorded:total.weeks.size}]))};
}
module.exports={windowFor,calculate,defaultTimeZone};
