(()=>{
 const panel=document.getElementById('ordering-budget');if(!panel)return;
 const $=id=>document.getElementById(id),money=value=>value===null?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 let session,projection,loading=false,refreshAgain=false,cart={total:0,pricePending:false};
 function template(element,text,values={}){element.dataset.appTemplate=text;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(text,values);}
 function render(){
  if(!projection)return;window.salesPerformanceView?.render(projection);
  $('ordering-projected-sales').textContent=money(projection.projectedSalesCents);$('ordering-week-budget').textContent=money(projection.budgetCents);
  $('ordering-budget-spent').textContent=money(projection.spentCents)+(projection.pricePending?' + '+wording('prices pending'):'');
  const remaining=projection.remainingCents===null||cart.pricePending?null:projection.remainingCents-cart.total;
  $('ordering-budget-remaining').textContent=money(remaining);$('ordering-budget-remaining').classList.toggle('budget-over',remaining!==null&&remaining<0);
  const label=projection.projectedSalesCents===null?'{weeks} of 4 complete sales weeks. Enter sales to calculate your budget.':projection.pricePending||cart.pricePending?'Some items have prices pending. The remaining budget cannot be calculated yet.':remaining<0?'This cart would take you over this week’s budget.':'Budget after this cart = weekly budget − orders placed − this cart.';
  template($('ordering-budget-status'),label,{weeks:projection.weeksRecorded});
 }
 async function refresh(){
  if(document.hidden)return;if(loading){refreshAgain=true;return;}loading=true;
  try{const response=await fetch('/api/sales',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(!response.ok)throw Error('Unable to load sales budget.');projection=(await response.json()).projection;render();}
  catch{template($('ordering-budget-status'),'Unable to load sales budget. Open Sales to try again.');}
  finally{loading=false;if(refreshAgain){refreshAgain=false;refresh();}}
 }
 window.addEventListener('ordering-cart-updated',event=>{cart=event.detail;render();});
 window.addEventListener('sales-budget-updated',refresh);window.addEventListener('focus',refresh);window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('interface-text-updated',render);
 window.addEventListener('storage',event=>{if(event.key==='souvlaki-sales-updated-'+(session?.dataScope||session?.id)||event.key==='souvlaki-usage-updated-'+(session?.dataScope||session?.id))refresh();});
 setInterval(refresh,60000);
 (async()=>{try{session=await(await fetch('/api/session',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}})).json();await refresh();}catch{}})();
})();
