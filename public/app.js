const money = n => n===null?'Price pending':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n/100);
let products=[], suppliers=[], cart={}, category='All', busy=false, editingId=null,csrf='',cartKey='',scopeKey='',page=1,parWindow=null,latestStockTake=null;
let cartRuleNotice='';
const itemQuantities=new Map(),itemMessages=new Map(),itemAddedQuantities=new Map();let submissionId='',submissionBody='';
const $=id=>document.getElementById(id);
const wording=(template,values={})=>typeof interfaceLabel==='function'?interfaceLabel(template,values):template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
const addConfirmations=new Map();
function confirmCartAdd(controls,button,quantity){
  const originalNodes=[...button.childNodes],originalLabel=button.getAttribute('aria-label');
  const buttonDisabled=button.disabled,quantityDisabled=quantity.disabled;
  const ignored=button.hasAttribute('data-copy-editor');
  controls.style.setProperty('--add-control-width',controls.offsetWidth+'px');
  controls.style.setProperty('--add-control-height',controls.offsetHeight+'px');
  controls.style.setProperty('--add-button-width',button.offsetWidth+'px');
  // Keep the original text nodes so saved interface edits survive the temporary message.
  button.setAttribute('data-copy-editor','');button.disabled=true;quantity.disabled=true;
  controls.classList.add('add-confirming');
  void button.offsetWidth;
  button.textContent=wording('Added to cart');button.setAttribute('aria-label',wording('Added to cart'));
  controls.classList.add('add-expanded');
  let returnTimer,finishTimer;
  function restoreLabel(){button.replaceChildren(...originalNodes);button.setAttribute('aria-label',originalLabel);}
  function finish(){
    clearTimeout(returnTimer);clearTimeout(finishTimer);restoreLabel();
    controls.classList.remove('add-confirming','add-expanded');
    controls.style.removeProperty('--add-control-width');controls.style.removeProperty('--add-control-height');controls.style.removeProperty('--add-button-width');
    button.disabled=buttonDisabled;quantity.disabled=quantityDisabled;
    if(!ignored)button.removeAttribute('data-copy-editor');
    addConfirmations.delete(controls);
  }
  addConfirmations.set(controls,finish);
  returnTimer=setTimeout(()=>{
    restoreLabel();controls.classList.remove('add-expanded');
    finishTimer=setTimeout(finish,240);
  },1250);
}
// Change only the layout so quantities, feedback and scoped item edits stay intact.
function setCatalogueView(view){
  if(!$('menu')||!$('list-view'))return;
  const list=view==='list';
  $('menu').classList.toggle('menu-list',list);
  $('list-view').setAttribute('aria-pressed',String(list));
  $('menu-view').setAttribute('aria-pressed',String(!list));
}
if($('list-view')){
  let savedView='menu';
  try{savedView=localStorage.getItem(companyPreferenceKey('souvlaki-catalogue-view'))||'menu';}catch{}
  setCatalogueView(savedView);
  for(const view of ['list','menu'])$(view+'-view').onclick=()=>{
    setCatalogueView(view);
    try{localStorage.setItem(companyPreferenceKey('souvlaki-catalogue-view'),view);}catch{}
  };
}
// Keep this tab's cart in step with stock-count additions and other open cart tabs.
function refreshStoredCart(){if(!cartKey)return;try{const stored=JSON.parse(localStorage.getItem(cartKey)||'{}');if(stored&&typeof stored==='object'&&!Array.isArray(stored))cart=Object.fromEntries(Object.entries(stored).filter(([id,quantity])=>(!products.length||products.some(product=>product.id===id))&&Number.isInteger(quantity)&&quantity>0&&quantity<=999));}catch{}}
function syncStoredCart(){if(busy)return;refreshStoredCart();if(products.length)render();}
window.addEventListener('storage',event=>{if(event.key===cartKey)syncStoredCart();});window.addEventListener('focus',syncStoredCart);window.addEventListener('pageshow',event=>{if(event.persisted)syncStoredCart();});
function renderProductPar(product){
  const panel=el('div',undefined,'product-par'),label=el('strong',undefined,'par-value'),hint=el('span',undefined,'par-hint');
  const known=product.par&&product.par.level!==null;
  const template=known?'Par: {level}':'Par: —';label.dataset.appTemplate=template;
  const values={level:known?new Intl.NumberFormat('en-AU').format(product.par.level):''};label.dataset.appValues=JSON.stringify(values);label.textContent=wording(template,values);
  const hintTemplate=product.par?.source==='manual'?'Manual par':known?(product.par.weeksRecorded===1?'Based on 1 completed week':'Average of {weeks} completed weeks'):'Manual par or usage needed';const hintValues={weeks:product.par?.weeksRecorded||0};hint.dataset.appTemplate=hintTemplate;hint.dataset.appValues=JSON.stringify(hintValues);hint.textContent=wording(hintTemplate,hintValues);
  if(known&&product.par.source!=='manual')panel.title=wording('Average used: {average} per week',{average:new Intl.NumberFormat('en-AU',{maximumFractionDigits:5}).format(product.par.average)});
  const countPanel=el('div',undefined,'ordering-stat stock-count-stat'),countLabel=el('span',wording('Stock count'),'ordering-stat-label'),countValue=el('strong',undefined,'stock-count-value'),countHint=el('span',undefined,'ordering-stat-hint');
  const counted=product.ordering?.stockCount,hasCount=typeof counted==='number';countValue.dataset.appTemplate=hasCount?'{quantity}':'—';countValue.dataset.appValues=JSON.stringify({quantity:hasCount?new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(counted):''});countValue.textContent=hasCount?new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(counted):'—';
  const countTemplate=hasCount?'Latest stock take':latestStockTake?'Not counted':'No stock take yet';countHint.dataset.appTemplate=countTemplate;countHint.textContent=wording(countTemplate);
  if(hasCount&&latestStockTake?.countDate)countPanel.title=wording('Stock take: {date}',{date:new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(latestStockTake.countDate+'T12:00:00Z'))});
  countPanel.append(countLabel,countValue,countHint);
  const recommendedPanel=el('div',undefined,'ordering-stat recommended-order-stat'),recommendedLabel=el('span',wording('Recommended order'),'ordering-stat-label'),recommendedValue=el('strong',undefined,'recommended-order-value'),recommendedHint=el('span',undefined,'ordering-stat-hint');
  const amount=product.ordering?.recommended,hasRecommendation=typeof amount==='number';recommendedValue.dataset.appTemplate=hasRecommendation?'{quantity}':'—';recommendedValue.dataset.appValues=JSON.stringify({quantity:hasRecommendation?new Intl.NumberFormat('en-AU').format(amount):''});recommendedValue.textContent=hasRecommendation?new Intl.NumberFormat('en-AU').format(amount):'—';
  const recommendedTemplate=hasRecommendation?(amount===0?'No order needed':stockOrderRules.describe(product)?'Par − stock count · rounded to order rule':'Par − stock count'):'Par and count needed';recommendedHint.dataset.appTemplate=recommendedTemplate;recommendedHint.textContent=wording(recommendedTemplate);recommendedPanel.append(recommendedLabel,recommendedValue,recommendedHint);
  panel.append(label,hint,countPanel,recommendedPanel);return panel;
}
function renderParPeriod(){
  if(!$('par-period')||!parWindow)return;
  const format=date=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const template='Par levels · {start} – {end} · Location usage';const values={start:format(parWindow.startDate),end:format(parWindow.endDate)};$('par-period').dataset.appTemplate=template;$('par-period').dataset.appValues=JSON.stringify(values);$('par-period').textContent=wording(template,values);
  if($('stock-take-status')){const date=latestStockTake?.countDate;const countTemplate=date?'Latest stock take: {date}':'Save a stock take to see counts and recommended orders.';const countValues={date:date?format(date):''};$('stock-take-status').dataset.appTemplate=countTemplate;$('stock-take-status').dataset.appValues=JSON.stringify(countValues);$('stock-take-status').textContent=wording(countTemplate,countValues);}
}
function renderMenu(){
  if(!$('menu'))return;for(const finish of addConfirmations.values())finish();$('menu').replaceChildren();
  const query=$('search').value.toLowerCase();
  const ordered=window.appLayout?.orderData($('menu'),products)||products,filtered=ordered.filter(p=>(category==='All'||p.supplierId===category)&&(p.name+' '+(p.sku||'')+' '+(p.unitAmount||'')+' '+p.supplier).toLowerCase().includes(query));
  if(!filtered.length)$('menu').append(el('p','No stock matches your search.'));
  const pages=Math.max(1,Math.ceil(filtered.length/25));page=Math.min(page,pages);$('previous-page').disabled=page===1;$('next-page').disabled=page===pages;$('page-status').dataset.appValues=JSON.stringify({page,pages,count:filtered.length});$('page-status').textContent=wording('Page {page} of {pages} · {count} items',{page,pages,count:filtered.length});
  for(const p of filtered.slice((page-1)*25,page*25)){const card=el('article',undefined,'product');const art=el('div',undefined,'product-art');if(p.photo){const image=el('img');image.src=p.photo;image.alt=p.name;image.loading='lazy';art.append(image);}else art.textContent=p.emoji;card.append(art,el('p',p.supplier+' · '+(p.sku||p.category),'sku'),el('h3',p.name));if(p.unitAmount){const unit=el('p',p.unitAmount,'stock-unit-amount');unit.dataset.userText='';card.append(unit);}if(stockOrderRules.describe(p))card.append(el('p',stockOrderRules.describe(p),'small stock-order-rule'));const row=el('div',undefined,'product-bottom');row.append(el('strong',money(p.price)));const controls=el('div',undefined,'add-controls');const quantityLabel=el('label','Qty');const quantity=el('input');quantity.type='number';quantity.min=1;quantity.max=999;quantity.step=1;quantity.value=itemQuantities.get(p.id)||stockOrderRules.minimum(p);quantity.disabled=!appAccess.can('orders.place')||busy||(cart[p.id]||0)>=stockOrderRules.maximum(p);quantity.setAttribute('aria-label','Quantity to add for '+p.name);quantity.oninput=()=>itemQuantities.set(p.id,quantity.value);quantityLabel.append(quantity);const button=el('button','+ Add');button.type='button';button.disabled=!appAccess.can('orders.place')||busy||(cart[p.id]||0)>=stockOrderRules.maximum(p);button.setAttribute('aria-label','Add '+p.name+' to cart');const feedback=el('p',itemMessages.get(p.id)||'','add-feedback');feedback.dataset.appTemplate='Added to cart · {quantity} {unit}';if(itemAddedQuantities.has(p.id))feedback.dataset.appValues=JSON.stringify({quantity:itemAddedQuantities.get(p.id),unit:itemAddedQuantities.get(p.id)===1?'unit':'units'});feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');button.onclick=()=>{if(addConfirmations.has(controls))return;refreshStoredCart();const requested=Number(quantity.value),current=cart[p.id]||0;const rounded=stockOrderRules.round(p,current+requested);if(!Number.isInteger(requested)||requested<1||rounded===null||rounded>999){feedback.textContent='Enter a whole quantity that keeps the cart at or below '+stockOrderRules.maximum(p)+'.';quantity.focus();return;}const amount=rounded-current;if(amount<=0){feedback.textContent='Below the rounding cutoff; cart quantity stays at '+current+'.';return;}cart[p.id]=rounded;itemQuantities.set(p.id,requested);itemAddedQuantities.set(p.id,amount);itemMessages.set(p.id,wording('Added to cart · {quantity} {unit}',{quantity:amount,unit:amount===1?'unit':'units'}));feedback.dataset.appValues=JSON.stringify({quantity:amount,unit:amount===1?'unit':'units'});feedback.textContent=itemMessages.get(p.id);button.disabled=cart[p.id]>=stockOrderRules.maximum(p);quantity.disabled=cart[p.id]>=stockOrderRules.maximum(p);render(false);confirmCartAdd(controls,button,quantity);};controls.append(quantityLabel,button);row.append(controls);card.dataset.productId=p.id;card.append(row,feedback,renderProductPar(p));$('menu').append(card);}
}
const cartSupplierOpen=new Map();
function render(refreshMenu=true){
  for(const product of products){const quantity=cart[product.id];if(!quantity)continue;const rounded=stockOrderRules.round(product,quantity);if(rounded!==quantity&&rounded<=999){cart[product.id]=rounded;cartRuleNotice='Cart quantities adjusted to stock order rules. Review your cart before ordering.';}}
  if(refreshMenu)renderMenu();
  const noticeHost=$('cart')||$('menu');
  if(noticeHost){let notice=$('cart-order-rules-notice');if(!notice){notice=el('p','','small');notice.id='cart-order-rules-notice';notice.setAttribute('role','status');noticeHost.before(notice);}const invalid=products.some(product=>cart[product.id]&&!stockOrderRules.valid(product,cart[product.id]));notice.textContent=invalid?'A cart quantity exceeds the order limit after rounding. Reduce or remove the item to continue.':cartRuleNotice;notice.hidden=!notice.textContent;}

  const focused=document.activeElement,focusedLabel=focused?.getAttribute('aria-label');
  const focusedSupplier=focused?.matches('summary')?focused.parentElement.dataset.supplierId:null;
  if(cartKey){try{localStorage.setItem(cartKey,JSON.stringify(cart));}catch{$('message').textContent='Browser storage is unavailable; your cart cannot be kept between pages.';}}
  $('cart-badge').textContent=products.reduce((sum,p)=>sum+(cart[p.id]||0),0);
  window.dispatchEvent(new CustomEvent('ordering-cart-updated',{detail:{total:products.reduce((sum,p)=>sum+(p.price??0)*(cart[p.id]||0),0),pricePending:products.some(p=>p.price===null&&(cart[p.id]||0)>0)}}));
  if(!$('cart'))return;
  for(const group of $('cart').querySelectorAll('.cart-supplier-group'))cartSupplierOpen.set(group.dataset.supplierId,group.open);
  $('cart').replaceChildren();
  let total=0,count=0,pricePending=false;const grouped=new Map();
  for(const p of products){
    const qty=cart[p.id]||0;if(!qty)continue;
    total+=p.price*qty;if(p.price===null)pricePending=true;count+=qty;
    if(!grouped.has(p.supplierId))grouped.set(p.supplierId,[]);
    grouped.get(p.supplierId).push(p);
  }
  for(const [supplierId,items] of grouped){
    const group=el('details',undefined,'supplier-stock-menu cart-supplier-group');
    group.dataset.supplierId=supplierId;group.open=cartSupplierOpen.get(supplierId)??true;
    const summary=el('summary',undefined,'supplier-title'),title=el('h3',items[0].supplier),itemCount=el('span',undefined,'stock-items-count');
    title.dataset.userText='';
    const countTemplate=items.length===1?'{count} item':'{count} items';
    itemCount.dataset.appTemplate=countTemplate;itemCount.dataset.appValues=JSON.stringify({count:items.length});itemCount.textContent=wording(countTemplate,{count:items.length});
    summary.append(title,itemCount);group.append(summary);
    const content=el('div',undefined,'supplier-stock-content cart-supplier-items');
    for(const p of items){
      const qty=cart[p.id],row=el('div',undefined,'cart-row');row.dataset.productId=p.id;const title=el('strong',p.name);if(p.unitAmount)title.append(el('span',p.unitAmount,'stock-unit-amount'));if(stockOrderRules.describe(p))title.append(el('span',stockOrderRules.describe(p),'small stock-order-rule'));row.append(title);
      const controls=el('div',undefined,'quantity'),minus=el('button','−');
      minus.type='button';minus.disabled=busy;minus.setAttribute('aria-label',(stockOrderRules.multiples(p)?'Decrease quantity for ':'Remove one ')+p.name);
      minus.onclick=()=>{refreshStoredCart();cart[p.id]=stockOrderRules.decrease(p,cart[p.id]||0);render();};
      const input=el('input');input.type='number';input.min=1;input.max=stockOrderRules.maximum(p);input.step=1;input.value=qty;input.disabled=busy;input.setAttribute('aria-label',p.name+' quantity');
      input.onchange=()=>{refreshStoredCart();const n=Number(input.value);const rounded=stockOrderRules.round(p,n);if(Number.isInteger(n)&&n>=1&&rounded<=999){cart[p.id]=rounded;if(rounded!==n)cartRuleNotice='Cart quantity adjusted from '+n+' to '+rounded+' for '+p.name+'.';}else cartRuleNotice='Enter a whole quantity that rounds to no more than '+stockOrderRules.maximum(p)+' for '+p.name+'.';render();};
      const remove=el('button','×');remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label','Remove '+p.name);
      remove.onclick=()=>{refreshStoredCart();delete cart[p.id];render();};
      controls.append(minus,input,remove,el('span',money(p.price===null?null:qty*p.price)));row.append(controls);content.append(row);
    }
    group.append(content);$('cart').append(group);
  }
  if(!count)$('cart').append(el('div','Your request is empty. Add stock to get started.','empty'));
  $('count').dataset.appValues=JSON.stringify({count});$('count').textContent=wording('{count} units',{count});
  $('total').textContent=money(total)+(pricePending?' + prices pending':'');$('submit').disabled=!appAccess.can('orders.place')||!count||busy||products.some(product=>cart[product.id]&&!stockOrderRules.valid(product,cart[product.id]));$('submit').textContent=busy?'Saving request…':'Submit stock request →';
  if(focused&&!focused.isConnected){
    const replacement=focusedSupplier!==null?[...$('cart').querySelectorAll('.cart-supplier-group')].find(group=>group.dataset.supplierId===focusedSupplier)?.querySelector('summary'):focusedLabel?[...$('cart').querySelectorAll('[aria-label]')].find(element=>element.getAttribute('aria-label')===focusedLabel):null;
    replacement?.focus({preventScroll:true});
  }
}
if($('search'))$('search').oninput=()=>{page=1;renderMenu();};
if($('previous-page'))$('previous-page').onclick=()=>{page--;renderMenu();$('menu').scrollIntoView({block:'start'});};
if($('next-page'))$('next-page').onclick=()=>{page++;renderMenu();$('menu').scrollIntoView({block:'start'});};
if($('checkout'))$('checkout').onsubmit=async e=>{e.preventDefault();if(busy||!appAccess.can('orders.place'))return;refreshStoredCart();busy=true;render();$('message').textContent='';const body=Object.fromEntries(new FormData(e.target));body.items=Object.entries(cart).filter(([,q])=>q>0).map(([id,quantity])=>({id,quantity}));try{const signature=JSON.stringify(body);if(signature!==submissionBody){submissionBody=signature;submissionId=crypto.randomUUID();}body.requestId=submissionId;const response=await fetch('/api/orders',{method:'POST',headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});const order=await response.json();if(!response.ok)throw Error(order.error);try{localStorage.setItem('souvlaki-usage-updated-'+scopeKey,String(Date.now()));}catch{}refreshStoredCart();for(const item of body.items){const remaining=(cart[item.id]||0)-item.quantity;if(remaining>0)cart[item.id]=remaining;else delete cart[item.id];}window.dispatchEvent(new Event('sales-budget-updated'));submissionId='';submissionBody='';$('message').textContent='Request '+order.id+' saved. Estimated total '+money(order.total)+(order.pricePending?' + prices pending':'')+'. '+(order.delivery||[]).map(d=>d.supplier+': '+(d.status==='submitted'?'submitted to sending service':d.status==='not_configured'?'not sent — delivery not configured':d.status==='failed'?'sending failed':d.status==='action_required'?'finish in ordering platform':'submission unconfirmed')).join('; ');window.orderDeliveryResults?.show(order);e.target.reset();}catch(error){refreshStoredCart();$('message').textContent=error.message||'Could not save the request. Try again.';}finally{busy=false;render();}};
async function api(url,method,body){const response=await fetch(url,{method,headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save changes.');return data;}
async function reload(){
  const data=await api('/api/catalogue','GET');products=data.products;suppliers=data.suppliers;parWindow=data.parWindow;latestStockTake=data.stockTake;renderParPeriod();
  for(const id of Object.keys(cart))if(!products.some(p=>p.id===id)||!Number.isInteger(cart[id])||cart[id]<1||cart[id]>999)delete cart[id];
  if(category!=='All'&&!suppliers.some(s=>s.id===category))category='All';
  if($('filters')){$('filters').replaceChildren();
  for(const supplier of [{id:'All',name:wording('All suppliers')},...suppliers]){const button=el('button',supplier.name);button.type='button';button.dataset.supplierId=supplier.id;button.classList.toggle('active',category===supplier.id);button.setAttribute('aria-pressed',String(category===supplier.id));if(supplier.id!=='All')button.dataset.userText='';button.onclick=()=>{category=supplier.id;page=1;for(const child of $('filters').children){const active=child===button;child.classList.toggle('active',active);child.setAttribute('aria-pressed',String(active));}renderMenu();};$('filters').append(button);}}
  refreshStoredCart();render();
}
$('logout').onclick=async()=>{try{await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}});location.href=companyLoginUrl();}catch(error){$('message').textContent=error.message;}};
(async()=>{try{const session=await api('/api/session','GET');if(!session.csrf){location.href=companyLoginUrl();return;}csrf=session.csrf;window.orderDeliveryResults?.init(session);scopeKey=session.dataScope||session.id;const legacyCartKey='souvlaki-cart-'+(session.id||session.username);cartKey=legacyCartKey+(session.locationId?'-'+session.locationId:'');try{if(session.canMigrateBrowserData&&localStorage.getItem(cartKey)===null&&localStorage.getItem(legacyCartKey)!==null)localStorage.setItem(cartKey,localStorage.getItem(legacyCartKey));}catch{}try{const stored=JSON.parse(localStorage.getItem(cartKey)||'{}');cart=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};}catch{cart={};}$('admin-link').hidden=!appAccess.any(appAccess.admin,session);await reload();$('load-status').textContent='';}catch(error){$('load-status').textContent=error.message;}})();

window.addEventListener('interface-text-updated',()=>{if(products.length){renderParPeriod();renderMenu();if($('cart'))render(false);}});

// Recalculate after a week boundary or after usage is saved in another tab.
if($('menu')){
 let parRefreshPending=false;
 async function refreshParIfNeeded(force=false){
  if(!parWindow||parRefreshPending||document.hidden)return;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:parWindow.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=kind=>parts.find(part=>part.type===kind).value;const date=new Date(value('year')+'-'+value('month')+'-'+value('day')+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-date.getUTCDay());
  if(!force&&date.toISOString().slice(0,10)===parWindow.currentWeekStart)return;
  parRefreshPending=true;try{
   const data=await api('/api/catalogue','GET');parWindow=data.parWindow;latestStockTake=data.stockTake;const refreshed=new Map(data.products.map(product=>[product.id,product]));
   let rulesChanged=false;for(const product of products){const latest=refreshed.get(product.id);product.par=latest?.par;product.ordering=latest?.ordering;if(latest){for(const key of ['minimumOrder','orderRule','roundingCutoff']){if(product[key]!==latest[key]){product[key]=latest[key];rulesChanged=true;}}}}renderParPeriod();if(rulesChanged){refreshStoredCart();render();}
   for(const card of $('menu').querySelectorAll('[data-product-id]')){const product=products.find(product=>product.id===card.dataset.productId);if(product)card.querySelector('.product-par')?.replaceWith(renderProductPar(product));}
   $('load-status').textContent='';
  }catch(error){$('load-status').textContent=error.message;}finally{parRefreshPending=false;}
 }
 setInterval(()=>refreshParIfNeeded(true),60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshParIfNeeded(true);});
 window.addEventListener('focus',()=>refreshParIfNeeded(true));
 window.addEventListener('storage',event=>{if(event.key==='souvlaki-usage-updated-'+scopeKey)refreshParIfNeeded(true);});
 window.addEventListener('pageshow',event=>{if(event.persisted)refreshParIfNeeded(true);});
}

window.addEventListener('before-location-switch',event=>{if(busy)event.preventDefault();});

window.addEventListener('app-layout-changed',()=>renderMenu());
