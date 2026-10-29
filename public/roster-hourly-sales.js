(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./rostering-model'):root.rosteringModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.rosterHourlySales=api;})(globalThis,M=>{
 const amount=value=>Number.isSafeInteger(value)&&value>=0;
 // The Day timeline is a calendar day. Follow the importer’s same previous-day
 // overnight rule without changing the underlying trading-date projections.
 function hour(projection,date,index){
  M.date(date);if(!Number.isInteger(index)||index<0||index>23)throw Error('Choose an hour from 0 to 23.');
  const hourly=projection?.hourly,previousIndex=(new Date(date+'T00:00:00Z').getUTCDay()+5)%7,previous=hourly?.tradingHours?.[previousIndex];
  if(!hourly)return null;
  if(!previous)return{salesCents:null,tradingDate:null,reason:'Set the previous day’s trading hours to align overnight hourly sales.'};
  const carries=!previous.closed&&previous.close<=previous.open&&index*60<M.minutes(previous.close),tradingDate=carries?M.shiftDate(date,-1):date,forecast=hourly.days?.find(day=>day.date===tradingDate),salesCents=forecast?.hours?.[index];
  return{salesCents:amount(salesCents)?salesCents:null,tradingDate,reason:forecast?.reason||(!forecast?'Hourly projection is unavailable for trading date '+tradingDate+'.':!amount(salesCents)?'Complete the hourly sales history for this trading date.':'')};
 }
 const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100),clock=index=>(index%12||12)+(index<12?'am':'pm');
 function renderAxis(axis,{projection,date,hidden=false}={}){
  if(!axis)return;const enabled=!hidden&&Boolean(projection?.hourly),corner=axis.previousElementSibling;
  axis.classList.toggle('has-hourly-sales',enabled);axis.setAttribute('aria-label',enabled?'Hours and projected sales from midnight to midnight':'Hours from midnight to midnight');
  corner?.querySelector('.roster-hour-sales-label')?.remove();
  if(enabled&&corner){const caption=axis.ownerDocument.createElement('small');caption.className='roster-hour-sales-label';caption.textContent='Projected sales';corner.append(caption);}
  for(const tick of axis.querySelectorAll('[data-roster-hour]')){
   tick.querySelector('.roster-hour-sales')?.remove();tick.removeAttribute('title');if(!enabled)continue;
   const index=Number(tick.dataset.rosterHour),result=hour(projection,date,index),value=axis.ownerDocument.createElement('small');value.className='roster-hour-sales';value.dataset.userText='';value.dataset.hourlyDate=result.tradingDate||'';value.textContent=result.salesCents===null?'—':money(result.salesCents);value.classList.toggle('is-unavailable',result.salesCents===null);tick.append(value);
   tick.title=clock(index)+' – '+clock((index+1)%24)+' · Projected sales '+(result.salesCents===null?'unavailable':money(result.salesCents))+(result.tradingDate&&result.tradingDate!==date?' · Trading date '+result.tradingDate:'')+(result.reason?' · '+result.reason:'');
  }
 }
 return{hour,renderAxis};
});
