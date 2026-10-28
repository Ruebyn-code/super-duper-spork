(()=>{
 function cogsRevenue(projection,basis){return basis!=='baseline'&&projection?.salesOutlook?projection.salesOutlook.expectedSalesCents:projection?.projectedSalesCents;}
 function projectedCogsPercent(projection,cart={total:0,pricePending:false},basis='trend'){
  const revenue=cogsRevenue(projection,basis);
  if(!projection||!cart||projection.pricePending||cart.pricePending||!Number.isFinite(revenue)||revenue<=0||!Number.isFinite(projection.spentCents)||!Number.isFinite(cart.total)||cart.total<0)return null;
  return (projection.spentCents+cart.total)/revenue*100;
 }
 function projectedCogsState(projection,cart={total:0,pricePending:false},basis='trend'){const percent=projectedCogsPercent(projection,cart,basis),revenue=cogsRevenue(projection,basis);return percent===null||!Number.isFinite(projection?.budgetPercent)?'unknown':(projection.spentCents+cart.total)*100>revenue*projection.budgetPercent?'over':'within';}
 function budgetPosition(projection,cart={total:0,pricePending:false}){
  const pending=Boolean(projection?.pricePending||cart?.pricePending),known=Number.isFinite(projection?.remainingCents)&&Number.isFinite(cart?.total)&&cart.total>=0;
  const remainingCents=pending||!known?null:projection.remainingCents-cart.total;
  const usedPercent=remainingCents!==null&&Number.isFinite(projection?.budgetCents)&&projection.budgetCents>0?(projection.budgetCents-remainingCents)/projection.budgetCents*100:null;
  const state=pending?'pending':remainingCents===null?'unavailable':remainingCents<0?'over':projection.budgetCents===0?'zero':usedPercent>=90?'near':'within';
  return{remainingCents,usedPercent,state};
 }
 if(typeof module==='object'&&module.exports){module.exports={projectedCogsPercent,projectedCogsState,budgetPosition};return;}
 if(!appAccess.can('sales.view')){document.getElementById('ordering-budget')?.classList.add('access-denied');document.querySelector('.ordering-sales-budget')?.classList.add('access-denied');return;}
 const active=()=>document.body?.dataset?.homeDashboard!=='staff';
 const panel=document.getElementById('ordering-budget');if(!panel)return;
 const $=id=>document.getElementById(id),money=value=>value===null?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 let session,projection,currentProjection,loading=false,refreshAgain=false,cart={total:0,pricePending:false};
 function template(element,text,values={}){element.dataset.appTemplate=text;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(text,values);}
 const overview=panel.classList.contains('ordering-budget-overview'),reviewCart=$('ordering-budget-review-cart'),retry=$('ordering-budget-retry');
 if(reviewCart)reviewCart.onclick=()=>{const popup=$('cart-popup');$('cart-pill')?.click();if(popup?.open)popup.addEventListener('close',()=>{if(reviewCart.isConnected&&!reviewCart.disabled)reviewCart.focus({preventScroll:true});},{once:true});};
 if(retry)retry.onclick=refresh;
 function renderCart(){if(!overview)return;template($('ordering-budget-cart-total'),'{amount}{pending}',{amount:money(cart.total),pending:cart.pricePending?' + '+wording('prices pending'):''});reviewCart.disabled=!$('cart-pill')||$('cart-pill').disabled||Boolean(cart.busy);}
 function renderOverview(){
  if(!overview)return;const{remainingCents,usedPercent,state}=budgetPosition(projection,cart),badge=$('ordering-budget-state'),meter=$('ordering-budget-meter'),usage=$('ordering-budget-usage');
  panel.dataset.budgetState=state;template(badge,({pending:'Prices pending',unavailable:'Sales needed',over:'Over budget',zero:'No budget',near:'Near budget',within:'Within budget'})[state]);
  retry.hidden=true;
  meter.hidden=usedPercent===null;meter.value=Math.max(0,Math.min(100,usedPercent||0));
  if(usedPercent!==null){const percent=new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(usedPercent);template(usage,'{percent}% of budget used, including this cart',{percent});meter.setAttribute('aria-valuetext',usage.textContent);}
  else template(usage,state==='pending'?'Budget usage unavailable until all prices are known.':projection.budgetCents===0?'Projected sales give a $0 ordering budget.':'Enter four complete sales weeks to calculate the budget.');
  template($('ordering-budget-remaining').previousElementSibling,remainingCents!==null&&remainingCents<0?'Over budget after cart':'Available after cart');
 }
 function render(){
  if(!active()){projection=null;currentProjection=null;return;}renderCart();if(!projection)return;window.salesPerformanceView?.render(currentProjection);
  const homeTrack=$('home-budget-track'),homeFill=$('home-budget-progress');if(homeTrack&&homeFill){const position=budgetPosition(projection,cart);homeTrack.dataset.state=position.state;homeTrack.setAttribute('role','meter');homeTrack.setAttribute('aria-valuemin','0');homeTrack.setAttribute('aria-valuemax','100');if(position.usedPercent!==null)homeTrack.setAttribute('aria-valuenow',String(Math.min(100,Math.max(0,position.usedPercent))));else homeTrack.removeAttribute('aria-valuenow');homeTrack.setAttribute('aria-label',position.usedPercent===null?'Ordering budget unavailable':Math.round(position.usedPercent)+'% of the ordering budget used');homeFill.style.width=(position.usedPercent===null?0:Math.min(100,Math.max(0,position.usedPercent)))+'%';}
  $('ordering-projected-sales').textContent=money(projection.projectedSalesCents);$('ordering-week-budget').textContent=money(projection.budgetCents);
  $('ordering-budget-spent').textContent=money(projection.spentCents)+(projection.pricePending?' + '+wording('prices pending'):'');
  $('ordering-budget-spent').title=projection.transferCostCents?wording('Includes net stock cost transfers: {cost}',{cost:money(projection.transferCostCents)}):'';
  const upcoming=Boolean(projection.isUpcoming),cartPending=cart.pricePending;
  const baseline=$('ordering-baseline-cogs');
  if(baseline){const percent=projectedCogsPercent(projection,cart,'baseline');baseline.textContent=percent===null?'—':new Intl.NumberFormat('en-AU',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(percent/100);baseline.dataset.cogsState=projectedCogsState(projection,cart,'baseline');baseline.title=wording('COGS = (allocated order costs + this cart) ÷ original projected sales × 100. Green is within the {budget}% budget; red is over it.',{budget:projection.budgetPercent});const basis=$('ordering-cogs-projection-basis');if(basis)template(basis,'Projected sales {amount}',{amount:money(projection.projectedSalesCents)});}
  const cogs=$('ordering-projected-cogs'),cogsPercent=projectedCogsPercent(projection,cart);
  if(cogs){
   const outlook=projection.salesOutlook,revenue=outlook?outlook.expectedSalesCents:projection.projectedSalesCents,state=projectedCogsState(projection,cart),basis=$('ordering-cogs-outlook');
   cogs.textContent=cogsPercent===null?'—':new Intl.NumberFormat('en-AU',{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(cogsPercent/100);cogs.dataset.cogsState=state;
   cogs.title=wording(projection.pricePending||cartPending?'Some item prices are pending.':revenue===null?'More sales history is needed to estimate full-week sales.':revenue===0?'Projected COGS cannot be calculated when expected sales are $0.':'COGS = (allocated order costs + this cart) ÷ updated full-week sales × 100. Green is within the {budget}% budget; red is over it.',{budget:projection.budgetPercent});
   if(basis){
    const difference=outlook?.varianceCents;
    template(basis,revenue===null?'Sales outlook unavailable':outlook?.method==='actuals'?'Recorded weekly sales {amount}':outlook?.actualDays?Number.isFinite(difference)?difference>0?'Updated sales {amount} · {difference} above projection':difference<0?'Updated sales {amount} · {difference} below projection':'Updated sales {amount} · On projection':'Updated sales {amount} · Comparison unavailable':'Updated sales {amount} · Awaiting recorded sales',{amount:money(revenue),difference:money(Math.abs(difference||0))});
    basis.title=outlook?wording('Recorded sales: {actual}. Original forecast for those recorded days: {projected}. Unrecorded days keep their original forecast: {forecast}. Missing past days remain estimated.',{actual:money(outlook.actualSalesCents),projected:money(outlook.recordedProjectedSalesCents),forecast:money(outlook.forecastSalesCents)}):'';
   }
  }
  template($('ordering-projected-sales').previousElementSibling,upcoming?'Projected sales next week':'Projected sales');
  template($('ordering-budget-spent').previousElementSibling,upcoming?'Order costs next week':'Order costs this week');
  template($('ordering-budget-remaining').previousElementSibling,'Budget after this cart');
  const{remainingCents:remaining}=budgetPosition(projection,cart);
  if(remaining!==null&&remaining<0||projection.pricePending||cartPending)$('ordering-budget-status').dataset.homeError='';else delete $('ordering-budget-status').dataset.homeError;
  $('ordering-budget-remaining').textContent=money(remaining);$('ordering-budget-remaining').classList.toggle('budget-over',remaining!==null&&remaining<0);
  const dateLabel=date=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const period={start:dateLabel(projection.weekStart),end:dateLabel(projection.weekEnd)};
  if($('ordering-budget-period'))template($('ordering-budget-period'),upcoming?'Upcoming week · {start} – {end}':'Week · {start} – {end}',period);
  const label=projection.projectedSalesCents===null?'{weeks} of 4 complete sales weeks. Enter sales to calculate your budget.':projection.pricePending||cartPending?'Some items have prices pending. The remaining budget cannot be calculated yet.':remaining<0?(upcoming?'This cart would take you over the upcoming week’s budget.':'This cart would take you over this week’s budget.'):'Budget after this cart = weekly budget − allocated order costs − this cart.';
  const holidayNote=(projection.dailyProjections||[]).some(day=>day.holiday?.status==='adjusted')?' Includes public-holiday forecasts based on last year’s matching holiday, adjusted for sales growth since the previous holiday.':'';
  template($('ordering-budget-status'),(upcoming?'Upcoming week’s budget, including Sunday orders and cost transfers. Forecast uses the last four completed sales weeks. '+label:label)+holidayNote,{weeks:projection.weeksRecorded});
  renderOverview();
 }
 async function refresh(){
  if(document.hidden||!active())return;if(loading){refreshAgain=true;return;}loading=true;if(retry)retry.disabled=true;
  try{const response=await fetch('/api/sales',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(!response.ok)throw Error('Unable to load sales budget.');const report=await response.json();currentProjection=report.projection;projection=report.orderingProjection||report.projection;render();}
  catch{$('ordering-budget-status').dataset.homeError='';template($('ordering-budget-status'),'Unable to load sales budget. Open Sales to try again.');if(overview){projection=null;panel.dataset.budgetState='error';template($('ordering-budget-state'),'Unavailable');for(const id of ['ordering-projected-sales','ordering-week-budget','ordering-budget-spent','ordering-budget-remaining','ordering-projected-cogs','ordering-baseline-cogs']){const element=$(id);if(element){element.textContent='—';if(id.endsWith('cogs'))element.dataset.cogsState='unknown';}}if($('ordering-cogs-outlook'))template($('ordering-cogs-outlook'),'Sales outlook unavailable');if($('ordering-cogs-projection-basis'))template($('ordering-cogs-projection-basis'),'Projected sales unavailable');$('ordering-budget-meter').hidden=true;template($('ordering-budget-usage'),'Budget figures could not be refreshed.');retry.hidden=false;}}
  finally{loading=false;if(retry)retry.disabled=false;if(refreshAgain){refreshAgain=false;refresh();}}
 }
 window.addEventListener('home-dashboard-access',()=>{if(!active()){projection=null;currentProjection=null;}else refresh();});
 window.addEventListener('ordering-cart-updated',event=>{cart=event.detail;render();});
 window.addEventListener('sales-budget-updated',refresh);window.addEventListener('weekly-sales-imported',refresh);window.addEventListener('focus',refresh);window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('interface-text-updated',render);
 window.addEventListener('storage',event=>{if(event.key==='opstack-stock-prices-updated-'+session?.companyId||event.key==='souvlaki-sales-updated-'+(session?.dataScope||session?.id)||event.key==='souvlaki-usage-updated-'+(session?.dataScope||session?.id)||event.key==='souvlaki-weekly-report-updated-'+session?.dataScope)refresh();});
 setInterval(refresh,60000);
 (async()=>{try{session=await appAccess.initialSession();await refresh();}catch{}})();
})();
