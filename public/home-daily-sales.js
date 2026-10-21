(()=>{
 const $=id=>document.getElementById(id),panel=$('home-daily-sales'),form=$('home-daily-sales-form'),input=$('home-daily-sales-amount');if(!panel)return;
 const number=cents=>new Intl.NumberFormat('en-AU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100),date=value=>new Intl.DateTimeFormat('en-AU',{weekday:'long',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const clock=value=>new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(new Date(value));
 let actor,current,latest,dirty=false,busy=false,loading=false,wake,clockOffset=0,expired=false;
 const label=(node,text)=>{node.textContent=typeof interfaceLabel==='function'?interfaceLabel(text):text;window.appWording?.label(node,text);};
 const message=text=>label($('home-daily-sales-message'),text);
 function cents(){const value=input.value.replace(/[$,\s]/g,'');if(!/^\d+(?:\.\d{1,2})?$/.test(value))return null;const parts=value.split('.'),amount=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));return Number.isSafeInteger(amount)&&amount<=1000000000?amount:null;}
 function controls(){form.setAttribute('aria-busy',String(busy));input.disabled=busy;$('home-daily-sales-save').disabled=busy||expired;$('home-daily-sales-discard').hidden=!dirty;$('home-daily-sales-discard').disabled=busy;$('home-daily-sales-reload').disabled=busy;}
 async function api(method='GET',body){const response=await fetch('/api/home-daily-sales',{method,headers:{'Content-Type':'application/json','X-CSRF-Token':actor.csrf,...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Unable to load daily sales.'),{status:response.status});return result;}
 function apply(result){
  latest=result;clockOffset=Date.parse(result.checkedAt)-Date.now();clearTimeout(wake);
  const entry=result.entry;if(entry&&!entry.available){const delay=Date.parse(entry.availableAt)-(Date.now()+clockOffset);if(delay>0)wake=setTimeout(refresh,Math.min(delay+50,2147483647));}
  if(dirty||busy||document.activeElement===input){
   expired=!entry?.available||entry.tradingDate!==current?.entry?.tradingDate;
   if(expired){message('This entry period has ended. Use Daily sales history to enter this date.');$('home-daily-sales-reload').hidden=true;}
   else if(entry.revision!==current?.entry?.revision){message('Sales have changed in another tab. Your entry is kept here; reload saved sales before making a correction.');$('home-daily-sales-reload').hidden=false;}
   controls();return;
  }
  current=result;expired=false;panel.hidden=!entry?.available;if(panel.hidden)return;
  $('home-daily-sales-date').textContent=result.locationName+' · '+date(entry.tradingDate);window.publicHolidayMarkers?.mark($('home-daily-sales-date'),entry.tradingDate);
  $('home-daily-sales-closing').textContent='Closes '+clock(entry.closesAt)+' · Melbourne';
  input.value=entry.amountCents===null?'':number(entry.amountCents);input.setCustomValidity('');$('home-daily-sales-reload').hidden=true;
  message(entry.amountCents===null?'Enter the total for this trading day. Enter 0 for no sales.':'Daily sales saved. You can update this amount.');controls();
 }
 async function refresh(){if(!actor||document.hidden||loading||busy)return;loading=true;try{apply(await api());}catch(error){if(!panel.hidden)message(error.message);}finally{loading=false;}}
 input.addEventListener('input',()=>{input.setCustomValidity('');dirty=current?.entry?.amountCents===null?input.value.trim()!=='':cents()!==current?.entry?.amountCents;controls();if(!expired)message(dirty?'Unsaved sales.':'Daily sales saved. You can update this amount.');});
 input.addEventListener('blur',()=>{const value=cents();if(value!==null)input.value=number(value);});
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||expired||!current?.entry?.available)return;const amountCents=cents();input.setCustomValidity(amountCents===null?'Enter an amount from $0 to $10,000,000 with up to two decimal places.':'');if(!form.reportValidity())return;
  busy=true;controls();message('Saving sales…');
  try{const result=await api('PUT',{date:current.entry.tradingDate,amountCents,revision:current.entry.revision});dirty=false;busy=false;input.blur();apply(result);message('Daily sales saved.');const key='souvlaki-sales-updated-'+(actor.dataScope||actor.id);try{localStorage.setItem(key,String(Date.now()));}catch{}window.dispatchEvent(new StorageEvent('storage',{key}));}
  catch(error){message(error.message);if(error.status===409)$('home-daily-sales-reload').hidden=false;}
  finally{busy=false;controls();}
 });
 $('home-daily-sales-discard').onclick=()=>{if(busy)return;dirty=false;input.blur();if(latest)apply(latest);refresh();};
 $('home-daily-sales-reload').onclick=async()=>{if(busy||loading)return;loading=true;try{const result=await api();dirty=false;input.blur();apply(result);}catch(error){message(error.message);}finally{loading=false;}};
 function guard(event){if(!busy&&!dirty)return;event.preventDefault();if(event.type==='beforeunload')event.returnValue='';message(busy?'Saving sales…':'Save daily sales or discard changes before leaving.');}
 window.addEventListener('beforeunload',guard);window.addEventListener('before-location-switch',guard);
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});
 window.addEventListener('storage',event=>{if(event.key==='souvlaki-sales-updated-'+(actor?.dataScope||actor?.id))refresh();});setInterval(refresh,30000);
 (async()=>{try{actor=await appAccess.initialSession();if(actor.csrf&&appAccess.can('home.view',actor)&&appAccess.can('sales.edit',actor))await refresh();else actor=null;}catch{actor=null;}})();
})();
