(()=>{
 const $=id=>document.getElementById(id);
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 const money=value=>value===null?wording('Price pending'):new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 let session,catalogue,totals,cartKey='',loading=false,refreshAgain=false;
 function template(element,text,values={}){element.dataset.appTemplate=text;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(text,values);}
 async function api(path){const response=await fetch(path,{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}if(!response.ok)throw Error('Unable to load dashboard.');return response.json();}
 function renderCart(){
  if(!session||!catalogue)return;
  try{
   const cart=JSON.parse(localStorage.getItem(cartKey)||'{}');if(!cart||typeof cart!=='object'||Array.isArray(cart))throw Error();
   let count=0,total=0,pricePending=false;
   for(const product of catalogue.products){const quantity=cart[product.id];if(!Number.isInteger(quantity)||quantity<1||quantity>999)continue;count+=quantity;if(product.price===null)pricePending=true;else total+=quantity*product.price;}
   template($('home-cart-summary'),'{count} units · {total}',{count,total:money(total)+(pricePending?' + '+wording('prices pending'):'')});
   $('cart-badge').textContent=count;
   window.dispatchEvent(new CustomEvent('ordering-cart-updated',{detail:{total,pricePending}}));
  }catch{template($('home-cart-summary'),'Open Cart to review your saved items.');window.dispatchEvent(new CustomEvent('ordering-cart-updated',{detail:{total:0,pricePending:true}}));}
 }
 function renderTotals(){
  if(typeof interfaceLabel==='function')template($('home-totals-heading'),'Location totals');
  if(session)$('home-totals-location').textContent=session.locationName||'';
  if(!totals)return;
  $('home-total-sales').textContent=money(totals.salesCents);
  $('home-total-orders').textContent=money(totals.placedOrdersCents)+(totals.pricePending?' + '+wording('prices pending'):'');
  $('home-total-expense').textContent=totals.expensePercent===null?'—':new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(totals.expensePercent)+'%';
  const quarter=totals.quarter,label=wording('Q{quarter} {year}',{quarter:quarter.number,year:quarter.year});
  template($('home-sales-period'),'Current quarter · {quarter}',{quarter:label});template($('home-expense-period'),'Quarter orders · {quarter}: {total}',{quarter:label,total:money(totals.quarterPlacedOrdersCents)+(totals.quarterPricePending?' + '+wording('prices pending'):'')});
  const hint=totals.quarterPricePending?'Some quarter order prices are pending. Expense percentage is unavailable.':totals.salesCents===0?'Add sales for this quarter to calculate your expense percentage.':'Expense = quarter placed orders ÷ quarter sales × 100.';
  template($('home-totals-status'),hint);
  const averages=totals.averages;
  if(!averages)return;
  $('home-average-sales').textContent=averages.weeklySalesCents===null?'—':money(averages.weeklySalesCents);
  $('home-average-cost').textContent=!averages.weeksRecorded?'—':money(averages.weeklyCostCents);
  $('home-average-expense').textContent=averages.expensePercent===null?'—':new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(averages.expensePercent)+'%';
  const date=value=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
  if(averages.weeksRecorded)template($('home-averages-period'),averages.weeksRecorded===1?'{start} – {end} · 1 completed week':'{start} – {end} · {weeks} completed weeks',{start:date(averages.fromDate),end:date(averages.throughDate),weeks:averages.weeksRecorded});else template($('home-averages-period'),'Completed weeks only');
  const averageHint=!averages.completedWeeks?'Averages appear after the first full Monday–Sunday week of this quarter.':!averages.weeksRecorded?'Enter all seven sales days for a completed week to calculate quarter averages.':averages.pricePending?'Some order prices are pending. Weekly cost and expense percentage are unavailable.':averages.skippedWeeks?'Completed-week totals ÷ completed weeks. {weeks} weeks with missing sales excluded. Weekly expense = cost ÷ sales × 100.':'Completed-week totals ÷ completed weeks. Weekly expense = cost ÷ sales × 100.';
  template($('home-averages-status'),averageHint,{weeks:averages.skippedWeeks});
 }
 function render(){
  if(session){$('home-user-name').textContent=session.username+'!';template($('home-location'),'You are in {location}',{location:session.locationName||''});}
  $('home-today').textContent=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  renderTotals();
  if(!catalogue)return;
  template($('home-stock-items'),'{count} stock items',{count:catalogue.products.length});
  const date=catalogue.stockTake?.countDate;
  template($('home-stock-take'),date?'Latest: {date}':'No stock take yet',{date:date?new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):''});
  renderCart();
 }
 async function refresh(){
  if(!session||document.hidden)return;if(loading){refreshAgain=true;return;}loading=true;
  try{const results=await Promise.allSettled([api('/api/catalogue'),api('/api/home-totals')]);if(results[0].status==='fulfilled')catalogue=results[0].value;if(results[1].status==='fulfilled')totals=results[1].value;render();if(results[1].status==='rejected'){template($('home-totals-status'),'Unable to load location totals. Try again shortly.');template($('home-averages-status'),'Unable to load quarter averages. Try again shortly.');}$('home-status').textContent=results[0].status==='fulfilled'?'':wording('Unable to load your dashboard. Use the navigation to open a page.');}
  catch{template($('home-status'),'Unable to load your dashboard. Use the navigation to open a page.');}
  finally{loading=false;if(refreshAgain){refreshAgain=false;refresh();}}
 }
 $('logout').onclick=async()=>{try{const response=await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':session?.csrf||''}});if(!response.ok)throw Error();location.href=companyLoginUrl();}catch{template($('home-status'),'Please sign in again.');}};
 window.addEventListener('storage',event=>{if(event.key===cartKey||event.key===null)renderCart();if(session&&(event.key==='souvlaki-usage-updated-'+(session.dataScope||session.id)||event.key==='souvlaki-sales-updated-'+(session.dataScope||session.id)))refresh();});
 window.addEventListener('focus',()=>{renderCart();refresh();});window.addEventListener('pageshow',event=>{renderCart();if(event.persisted)refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderCart();refresh();}});
 document.addEventListener('DOMContentLoaded',render);window.addEventListener('interface-text-updated',render);setInterval(refresh,60000);
 (async()=>{
  try{
   session=await api('/api/session');if(!session.csrf){location.href=companyLoginUrl();return;}
   const legacyKey='souvlaki-cart-'+(session.id||session.username);cartKey=legacyKey+(session.locationId?'-'+session.locationId:'');
   try{if(session.canMigrateBrowserData&&localStorage.getItem(cartKey)===null&&localStorage.getItem(legacyKey)!==null)localStorage.setItem(cartKey,localStorage.getItem(legacyKey));}catch{}
   $('home-admin').hidden=!['admin','franchisee'].includes(session.role);
   $('home-admin').querySelectorAll('[data-head-office-only]').forEach(link=>link.hidden=session.role!=='admin');
   render();await refresh();
  }catch{template($('home-status'),'Unable to load your dashboard. Use the navigation to open a page.');}
 })();
})();
