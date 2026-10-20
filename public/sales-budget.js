(()=>{
 if(!appAccess.can('sales.view')){document.getElementById('ordering-budget')?.classList.add('access-denied');document.querySelector('.ordering-sales-budget')?.classList.add('access-denied');return;}
 const panel=document.getElementById('ordering-budget');if(!panel)return;
 const $=id=>document.getElementById(id),money=value=>value===null?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 let session,projection,currentProjection,loading=false,refreshAgain=false,cart={total:0,pricePending:false};
 function template(element,text,values={}){element.dataset.appTemplate=text;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(text,values);}
 function render(){
  if(!projection)return;window.salesPerformanceView?.render(currentProjection);
  $('ordering-projected-sales').textContent=money(projection.projectedSalesCents);$('ordering-week-budget').textContent=money(projection.budgetCents);
  $('ordering-budget-spent').textContent=money(projection.spentCents)+(projection.pricePending?' + '+wording('prices pending'):'');
  $('ordering-budget-spent').title=projection.transferCostCents?wording('Includes net stock cost transfers: {cost}',{cost:money(projection.transferCostCents)}):'';
  const upcoming=Boolean(projection.isUpcoming),cartPending=cart.pricePending;
  template($('ordering-budget-spent').previousElementSibling,upcoming?'Order costs next week':'Order costs this week');
  template($('ordering-budget-remaining').previousElementSibling,'Budget after this cart');
  const remaining=projection.remainingCents===null||cartPending?null:projection.remainingCents-cart.total;
  if(remaining!==null&&remaining<0||projection.pricePending||cartPending)$('ordering-budget-status').dataset.homeError='';else delete $('ordering-budget-status').dataset.homeError;
  $('ordering-budget-remaining').textContent=money(remaining);$('ordering-budget-remaining').classList.toggle('budget-over',remaining!==null&&remaining<0);
  const dateLabel=date=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const period={start:dateLabel(projection.weekStart),end:dateLabel(projection.weekEnd)};
  if($('ordering-budget-period'))template($('ordering-budget-period'),upcoming?'Upcoming week · {start} – {end}':'Week · {start} – {end}',period);
  const label=projection.projectedSalesCents===null?'{weeks} of 4 complete sales weeks. Enter sales to calculate your budget.':projection.pricePending||cartPending?'Some items have prices pending. The remaining budget cannot be calculated yet.':remaining<0?(upcoming?'This cart would take you over the upcoming week’s budget.':'This cart would take you over this week’s budget.'):'Budget after this cart = weekly budget − allocated order costs − this cart.';
  template($('ordering-budget-status'),upcoming?'Upcoming week’s budget, including Sunday orders and cost transfers. Forecast uses the last four completed sales weeks. '+label:label,{weeks:projection.weeksRecorded});
 }
 async function refresh(){
  if(document.hidden)return;if(loading){refreshAgain=true;return;}loading=true;
  try{const response=await fetch('/api/sales',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(!response.ok)throw Error('Unable to load sales budget.');const report=await response.json();currentProjection=report.projection;projection=report.orderingProjection||report.projection;render();}
  catch{$('ordering-budget-status').dataset.homeError='';template($('ordering-budget-status'),'Unable to load sales budget. Open Sales to try again.');}
  finally{loading=false;if(refreshAgain){refreshAgain=false;refresh();}}
 }
 window.addEventListener('ordering-cart-updated',event=>{cart=event.detail;render();});
 window.addEventListener('sales-budget-updated',refresh);window.addEventListener('weekly-sales-imported',refresh);window.addEventListener('focus',refresh);window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('interface-text-updated',render);
 window.addEventListener('storage',event=>{if(event.key==='souvlaki-sales-updated-'+(session?.dataScope||session?.id)||event.key==='souvlaki-usage-updated-'+(session?.dataScope||session?.id)||event.key==='souvlaki-weekly-report-updated-'+session?.dataScope)refresh();});
 setInterval(refresh,60000);
 (async()=>{try{session=await appAccess.initialSession();await refresh();}catch{}})();
})();
