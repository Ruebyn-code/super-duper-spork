// "Promotions on today" line in the checklist reader, so staff on shift know which deals are running.
// Reads GET /api/promotions/today (name, offer and dates only; empty when Staff awareness is off); never writes.
(()=>{
 if(window.promotionsToday)return;
 let request=null,key='',stamp=0;
 function load(){const location=window.appLocationId||'';if(request&&key===location&&Date.now()-stamp<300000)return request;key=location;stamp=Date.now();request=fetch('/api/promotions/today',{cache:'no-store',headers:location?{'X-Location-Id':location}:{}}).then(response=>response.ok?response.json():{promotions:[]}).then(value=>value.promotions||[]).catch(()=>[]);return request;}
 async function show(){
  const anchor=document.getElementById('ops-run-planner-notes');if(!anchor)return;
  const list=await load();let banner=document.getElementById('ops-run-promotions');
  if(!list.length){banner?.remove();return;}
  if(!banner){banner=document.createElement('aside');banner.id='ops-run-promotions';banner.className='promotions-today';banner.setAttribute('aria-label',window.interfaceLabel?interfaceLabel('Promotions on today'):'Promotions on today');anchor.before(banner);}
  banner.replaceChildren();const title=document.createElement('strong');title.textContent=window.interfaceLabel?interfaceLabel('Promotions on today'):'Promotions on today';banner.append(title);
  for(const item of list){const row=document.createElement('span');row.dataset.userText='';row.textContent=item.name+' — '+item.offer;banner.append(row);}
 }
 const start=()=>{const dialog=document.getElementById('ops-run-title')?.closest('dialog');if(!dialog)return;new MutationObserver(()=>{if(dialog.open)show();}).observe(dialog,{attributes:true,attributeFilter:['open']});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 window.promotionsToday={refresh(){request=null;show();}};
})();
