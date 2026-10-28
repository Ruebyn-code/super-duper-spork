// Read-only full-week revenue outlook for order-based projected COGS.
const valid=value=>Number.isSafeInteger(value)&&value>=0;
function outlook(target,current,revenue){
 const recorded=new Map(),sources={weeklyReport:0,dailySales:0};let comparisonActualCents=0,comparisonExpectedCents=0,comparisonComplete=true;
 for(const [index,day]of current.dailyProjections.entries()){
  const actual=revenue?.days?.[index];if(day.date>current.today||!valid(actual))continue;
  recorded.set(day.date,actual);comparisonActualCents+=actual;
  if(valid(day.amountCents))comparisonExpectedCents+=day.amountCents;else comparisonComplete=false;
  if(revenue.sources?.[index]==='weekly-report')sources.weeklyReport++;else sources.dailySales++;
 }
 comparisonComplete&&=valid(comparisonExpectedCents);
 const hasTrend=recorded.size>0&&comparisonComplete&&comparisonExpectedCents>0;
 let reason=!recorded.size?'no-current-sales':!comparisonComplete?'missing-comparison-forecast':comparisonExpectedCents===0?'zero-comparison-forecast':null;
 const actual=target.dailyProjections.filter(day=>recorded.has(day.date)),estimated=target.dailyProjections.filter(day=>!recorded.has(day.date));
 const actualSalesCents=actual.reduce((sum,day)=>sum+recorded.get(day.date),0);
 let forecastSalesCents=null,expectedSalesCents=null;
 if(estimated.every(day=>valid(day.amountCents))){
  // Preserve the original whole-week rounding when no target day is recorded.
  const baseline=actual.length===0&&valid(target.projectedSalesCents)?target.projectedSalesCents:estimated.reduce((sum,day)=>sum+day.amountCents,0);
  if(valid(baseline)){
   const numerator=BigInt(hasTrend?comparisonActualCents:1),denominator=BigInt(hasTrend?comparisonExpectedCents:1);
   forecastSalesCents=Number((2n*BigInt(baseline)*numerator+denominator)/(2n*denominator));
   expectedSalesCents=actualSalesCents+forecastSalesCents;
  }
  if(!valid(forecastSalesCents)||!valid(expectedSalesCents)){forecastSalesCents=expectedSalesCents=null;reason='forecast-too-large';}
 }else reason='missing-forecast';
 const method=expectedSalesCents===null?'unavailable':!estimated.length?'actuals':hasTrend?'trend':'baseline';
 return{weekStart:target.weekStart,weekEnd:target.weekEnd,expectedSalesCents,actualSalesCents,forecastSalesCents,actualDays:actual.length,forecastDays:estimated.length,missingElapsedDays:estimated.filter(day=>day.date<current.today).length,method,reason:method==='actuals'?null:reason,trendPercent:hasTrend?(comparisonActualCents/comparisonExpectedCents-1)*100:null,comparison:{weekStart:current.weekStart,throughDate:[...recorded.keys()].at(-1)||null,recordedDays:recorded.size,actualSalesCents:comparisonActualCents,expectedSalesCents:comparisonComplete?comparisonExpectedCents:null,sources}};
}
module.exports={outlook};
