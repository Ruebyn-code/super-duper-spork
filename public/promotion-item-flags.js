// "On promotion" chips on Ordering cards and Stock count rows for stock items linked to a promotion that is on
// now or starting within a week. Reads GET /api/promotions/items once per location (no sales figures); never writes.
(()=>{
 if(window.promotionItemFlags)return;
 let request=null,key='';
 const label=text=>window.interfaceLabel?interfaceLabel(text):text;
 const date=value=>new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 function load(){const location=window.appLocationId||'';if(request&&key===location)return request;key=location;request=fetch('/api/promotions/items',{cache:'no-store',headers:location?{'X-Location-Id':location}:{}}).then(response=>response.ok?response.json():{items:{}}).catch(()=>({items:{}}));setTimeout(()=>{if(key===location)request=null;},120000);return request;}
 function chip(list){
  const element=document.createElement('p');element.className='promotion-item-flag';element.dataset.userText='';
  const first=list[0],uplift=list.find(entry=>Number.isInteger(entry.expectedUplift))?.expectedUplift;
  const icon='<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>';
  element.innerHTML=icon;const text=document.createElement('span');
  text.textContent=(first.onToday?label('On promotion'):label('Promotion')+' '+date(first.next))+': '+first.name+(list.length>1?' +'+(list.length-1):'')+(uplift?' · +'+uplift+'% '+label('expected'):'');
  element.append(text);element.title=list.map(entry=>entry.name+' ('+entry.offer+')').join(' / ')+(uplift?' — '+label('consider ordering and prepping about')+' '+uplift+'% '+label('extra'):'');return element;
 }
 async function decorate(){
  const value=await load(),items=value.items||{};
  for(const host of document.querySelectorAll('.product[data-product-id],.count-item[data-product-id]')){
   const list=items[host.dataset.productId],existing=host.querySelector('.promotion-item-flag');
   if(!list?.length){existing?.remove();continue;}
   const next=chip(list);if(existing&&existing.textContent===next.textContent)continue;existing?.remove();
   // Directly after the item's unit amount (or its name) so the row layout stays the same.
   const anchor=host.querySelector('.stock-unit-amount')||host.querySelector('h3');if(anchor)anchor.after(next);
  }
 }
 let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});};
 const observer=new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.nodeType===1&&!node.classList?.contains('promotion-item-flag'))))schedule();});
 const start=()=>{observer.observe(document.body,{childList:true,subtree:true});schedule();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 window.addEventListener('focus',()=>{request=null;schedule();});
 window.promotionItemFlags={refresh(){request=null;schedule();}};
})();
