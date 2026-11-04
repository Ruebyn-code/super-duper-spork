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
   if(!marker){marker=document.createElement('span');marker.className='public-holiday-marker';marker.dataset.userText='';marker.setAttribute('role','img');marker.tabIndex=0;marker.innerHTML='<svg class="public-holiday-calendar" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.6" width="18" height="16.8" rx="3.2" fill="#fff"/><path d="M3 9.4V7.8a3.2 3.2 0 0 1 3.2-3.2h11.6A3.2 3.2 0 0 1 21 7.8v1.6Z" fill="currentColor"/><rect x="3" y="4.6" width="18" height="16.8" rx="3.2" fill="none" stroke="#0a2e6e" stroke-width="1.7"/><path d="M3.4 9.4h17.2M8.6 12.7h6.8M8.6 18.4h6.8" stroke="#0a2e6e" stroke-width="1.4" stroke-linecap="round"/><rect x="6" y="14.4" width="12" height="2.4" rx="1.2" fill="currentColor"/><g fill="#7cc0ff" stroke="#0a2e6e" stroke-width="1.2"><rect x="6.5" y="2.4" width="2.4" height="4.4" rx="1"/><rect x="10.8" y="2.4" width="2.4" height="4.4" rx="1"/><rect x="15.1" y="2.4" width="2.4" height="4.4" rx="1"/></g></svg>';element.append(marker);}
   marker.title=label;marker.setAttribute('aria-label',label);
  });
  return element;
 }
 function refresh(){if(document.hidden)return;generation++;cache.clear();for(const element of document.querySelectorAll('[data-public-holiday-date]'))mark(element,element.dataset.publicHolidayDate);}
 window.publicHolidayMarkers={mark,refresh};
 window.addEventListener('focus',refresh);window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);
})();
