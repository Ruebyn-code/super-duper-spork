// Compare actual sales with the forecast for the same recorded weekdays.
(function(root){
 function compare(days,{dailyProjections,today}){
  let actualCents=0,expectedCents=0,recordedDays=0,missingDays=0,hasProjection=true;
  const dates=[];
  for(const [index,day] of dailyProjections.entries()){
   if(day.date>today)continue;
   const actual=days[index];
   if(!Number.isSafeInteger(actual)||actual<0){if(day.date<today)missingDays++;continue;}
   actualCents+=actual;recordedDays++;dates.push(day.date);
   if(!Number.isSafeInteger(day.amountCents)||day.amountCents<0)hasProjection=false;else expectedCents+=day.amountCents;
  }
  if(!recordedDays||!hasProjection)expectedCents=null;
  const differenceCents=expectedCents===null?null:actualCents-expectedCents;
  return {actualCents,expectedCents,differenceCents,differencePercent:expectedCents>0?differenceCents/expectedCents*100:null,recordedDays,missingDays,dates};
 }
 if(typeof module==='object'&&module.exports)module.exports={compare};else root.salesPerformance={compare};
})(typeof window==='object'?window:globalThis);
