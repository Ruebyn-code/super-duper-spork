// Read-only promotion tags beside Daily sales dates. Promotions for each Monday–Sunday week are read once
// per location through GET /api/promotions (sales viewing); marking never writes.
(()=>{
 if(window.promotionMarkers)return;
 const cache=new Map();
 const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
 const monday=date=>shift(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));
 function week(start){const location=window.appLocationId||'',key=location+':'+start;if(!cache.has(key)){const request=fetch('/api/promotions?from='+start+'&to='+shift(start,6),{cache:'no-store',headers:location?{'X-Location-Id':location}:{}}).then(response=>response.ok?response.json():{promotions:[]}).then(value=>value.promotions||[]).catch(()=>[]);cache.set(key,request);setTimeout(()=>cache.delete(key),60000);}return cache.get(key);}
 async function mark(element,date){
  if(!element||!/^\d{4}-\d\d-\d\d$/.test(date||''))return;element.dataset.promotionDate=date;
  if(!window.appAccess?.can?.('sales.view')){element.querySelector(':scope > .promotion-marker')?.remove();return;}
  const items=(await week(monday(date))).filter(item=>item.startDate<=date&&date<=item.endDate);
  if(element.dataset.promotionDate!==date)return;
  let marker=element.querySelector(':scope > .promotion-marker');
  if(!items.length){marker?.remove();return;}
  if(!marker){marker=document.createElement('a');marker.className='promotion-marker';marker.href='/sales#promotions';marker.dataset.userText='';element.append(marker);}
  const names=items.map(item=>item.name),label=(window.interfaceLabel?interfaceLabel('Promotion'):'Promotion')+': '+names.join(' / ');
  marker.title=label;marker.setAttribute('aria-label',label);
  marker.innerHTML='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>';
  const text=document.createElement('span');text.textContent=names.length>1?names[0]+' +'+(names.length-1):names[0];marker.append(text);
 }
 const clear=()=>cache.clear();
 // After a promotion changes, re-read and re-mark the dates already on the page.
 function refresh(){clear();for(const element of document.querySelectorAll('[data-promotion-date]'))mark(element,element.dataset.promotionDate);}
 window.addEventListener('focus',clear);
 window.promotionMarkers={mark,clear,refresh};
})();
