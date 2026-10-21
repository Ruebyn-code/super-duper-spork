// Date markers use the same location calendar as forecasts, independently of sales history.
(()=>{
 const cache=new Map();let generation=0;
 const scope=()=>window.appLocationId||'';
 function remove(element){element.querySelectorAll(':scope > .public-holiday-marker').forEach(marker=>marker.remove());}
 function calendar(year,locationId){
  const key=locationId+':'+year;if(cache.has(key))return cache.get(key);
  const pending=fetch('/api/public-holidays?year='+year,{cache:'no-store',headers:locationId?{'X-Location-Id':locationId}:{}}).then(async response=>{if(!response.ok)return null;const result=await response.json();return (!locationId||result.locationId===locationId)&&result.year===year&&Array.isArray(result.dates)?result.dates:null;}).catch(()=>null);
  cache.set(key,pending);return pending;
 }
 function mark(element,date){
  if(!element)return element;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')){delete element.dataset.publicHolidayDate;remove(element);return element;}
  if(element.dataset.publicHolidayDate!==date)remove(element);element.dataset.publicHolidayDate=date;
  const locationId=scope(),version=generation;
  calendar(Number(date.slice(0,4)),locationId).then(periods=>{
   if(element.dataset.publicHolidayDate!==date||scope()!==locationId||version!==generation||!periods)return;
   const names=[...new Set(periods.filter(period=>period.date===date).map(period=>period.name+(period.start==='00:00'&&period.end==='24:00'?'':' ('+period.start+'–'+period.end+')')))];
   if(!names.length){remove(element);return;}
   const label='Public holiday: '+names.join(' / ');let marker=element.querySelector(':scope > .public-holiday-marker');
   if(!marker){marker=document.createElement('span');marker.className='public-holiday-marker';marker.dataset.userText='';marker.setAttribute('role','img');marker.tabIndex=0;marker.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2Z"/></svg>';element.append(marker);}
   marker.title=label;marker.setAttribute('aria-label',label);
  });
  return element;
 }
 function refresh(){if(document.hidden)return;generation++;cache.clear();for(const element of document.querySelectorAll('[data-public-holiday-date]'))mark(element,element.dataset.publicHolidayDate);}
 window.publicHolidayMarkers={mark,refresh};
 window.addEventListener('focus',refresh);window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);
})();
