const money = n => n===null?'Price pending':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n/100);
let products=[], suppliers=[], cart={}, category='All', busy=false, editingId=null,csrf='',cartKey='',page=1,parWindow=null;
const itemQuantities=new Map(),itemMessages=new Map();let submissionId='',submissionBody='';
const $=id=>document.getElementById(id);
const wording=(template,values={})=>typeof interfaceLabel==='function'?interfaceLabel(template,values):template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
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
  try{savedView=localStorage.getItem('souvlaki-catalogue-view')||'menu';}catch{}
  setCatalogueView(savedView);
  for(const view of ['list','menu'])$(view+'-view').onclick=()=>{
    setCatalogueView(view);
    try{localStorage.setItem('souvlaki-catalogue-view',view);}catch{}
  };
}
function renderProductPar(product){
  const panel=el('div',undefined,'product-par'),label=el('strong',undefined,'par-value'),hint=el('span',undefined,'par-hint');
  const known=product.par&&product.par.level!==null;
  const template=known?'Par: {level}':'Par: —';label.dataset.appTemplate=template;
  const values={level:known?new Intl.NumberFormat('en-AU').format(product.par.level):''};label.dataset.appValues=JSON.stringify(values);label.textContent=wording(template,values);
  const hintTemplate=known?'Weekly target':'{weeks} of 4 weeks recorded';const hintValues={weeks:product.par?.weeksRecorded||0};hint.dataset.appTemplate=hintTemplate;hint.dataset.appValues=JSON.stringify(hintValues);hint.textContent=wording(hintTemplate,hintValues);
  if(known)panel.title=wording('Average used: {average} per week',{average:new Intl.NumberFormat('en-AU',{maximumFractionDigits:5}).format(product.par.average)});
  panel.append(label,hint);return panel;
}
function renderParPeriod(){
  if(!$('par-period')||!parWindow)return;
  const format=date=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
  const template='Par levels · {start} – {end} · Your usage';const values={start:format(parWindow.startDate),end:format(parWindow.endDate)};$('par-period').dataset.appTemplate=template;$('par-period').dataset.appValues=JSON.stringify(values);$('par-period').textContent=wording(template,values);
}
function renderMenu(){
  if(!$('menu'))return;$('menu').replaceChildren();
  const query=$('search').value.toLowerCase();
  const filtered=products.filter(p=>(category==='All'||p.supplierId===category)&&(p.name+' '+p.sku+' '+p.supplier).toLowerCase().includes(query));
  if(!filtered.length)$('menu').append(el('p','No stock matches your search.'));
  const pages=Math.max(1,Math.ceil(filtered.length/25));page=Math.min(page,pages);$('previous-page').disabled=page===1;$('next-page').disabled=page===pages;$('page-status').dataset.appValues=JSON.stringify({page,pages,count:filtered.length});$('page-status').textContent=wording('Page {page} of {pages} · {count} items',{page,pages,count:filtered.length});
  for(const p of filtered.slice((page-1)*25,page*25)){const card=el('article',undefined,'product');const art=el('div',undefined,'product-art');if(p.photo){const image=el('img');image.src=p.photo;image.alt=p.name;image.loading='lazy';art.append(image);}else art.textContent=p.emoji;card.append(art,el('p',p.supplier+' · '+(p.sku||p.category),'sku'),el('h3',p.name),el('p',p.description,'description'));const row=el('div',undefined,'product-bottom');row.append(el('strong',money(p.price)));const controls=el('div',undefined,'add-controls');const quantityLabel=el('label','Qty');const quantity=el('input');quantity.type='number';quantity.min=1;quantity.max=999;quantity.step=1;quantity.value=itemQuantities.get(p.id)||1;quantity.disabled=busy||(cart[p.id]||0)>=999;quantity.setAttribute('aria-label','Quantity to add for '+p.name);quantity.oninput=()=>itemQuantities.set(p.id,quantity.value);quantityLabel.append(quantity);const button=el('button','+ Add');button.type='button';button.disabled=busy||(cart[p.id]||0)>=999;button.setAttribute('aria-label','Add '+p.name+' to cart');const feedback=el('p',itemMessages.get(p.id)||'','add-feedback');feedback.dataset.appTemplate='Added to cart · {quantity} {unit}';if(itemQuantities.has(p.id))feedback.dataset.appValues=JSON.stringify({quantity:Number(itemQuantities.get(p.id)),unit:Number(itemQuantities.get(p.id))===1?'unit':'units'});feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');button.onclick=()=>{const amount=Number(quantity.value);const current=cart[p.id]||0;if(!Number.isInteger(amount)||amount<1||amount+current>999){feedback.textContent='Enter a whole quantity from 1 to '+(999-current)+'.';quantity.focus();return;}cart[p.id]=current+amount;itemQuantities.set(p.id,amount);itemMessages.set(p.id,wording('Added to cart · {quantity} {unit}',{quantity:amount,unit:amount===1?'unit':'units'}));feedback.dataset.appValues=JSON.stringify({quantity:amount,unit:amount===1?'unit':'units'});feedback.textContent=itemMessages.get(p.id);button.disabled=cart[p.id]>=999;quantity.disabled=cart[p.id]>=999;render(false);};controls.append(quantityLabel,button);row.append(controls);card.dataset.productId=p.id;card.append(row,feedback,renderProductPar(p));$('menu').append(card);}
}
function render(refreshMenu=true){if(refreshMenu)renderMenu();const focused=document.activeElement;const focusedLabel=focused?.getAttribute('aria-label');if(cartKey){try{localStorage.setItem(cartKey,JSON.stringify(cart));}catch{$('message').textContent='Browser storage is unavailable; your cart cannot be kept between pages.';}}$('cart-badge').textContent=products.reduce((sum,p)=>sum+(cart[p.id]||0),0);if(!$('cart'))return;$('cart').replaceChildren();let total=0,count=0,pricePending=false;
  for(const p of products){const qty=cart[p.id]||0;if(!qty)continue;total+=p.price*qty;if(p.price===null)pricePending=true;count+=qty;const row=el('div',undefined,'cart-row');row.dataset.productId=p.id;row.append(el('strong',p.name));const controls=el('div',undefined,'quantity');const minus=el('button','−');minus.type='button';minus.disabled=busy;minus.setAttribute('aria-label','Remove one '+p.name);minus.onclick=()=>{cart[p.id]--;render();};const input=el('input');input.type='number';input.min=1;input.max=999;input.value=qty;input.disabled=busy;input.setAttribute('aria-label',p.name+' quantity');input.onchange=()=>{const n=Number(input.value);if(Number.isInteger(n)&&n>=1&&n<=999)cart[p.id]=n;render();};const remove=el('button','×');remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label','Remove '+p.name);remove.onclick=()=>{delete cart[p.id];render();};controls.append(minus,input,remove,el('span',money(p.price===null?null:qty*p.price)));row.append(controls);$('cart').append(row);}
  if(!count)$('cart').append(el('div','Your request is empty. Add stock to get started.','empty'));
  $('count').dataset.appValues=JSON.stringify({count});$('count').textContent=wording('{count} units',{count});$('total').textContent=money(total)+(pricePending?' + prices pending':'');$('submit').disabled=!count||busy;$('submit').textContent=busy?'Saving request…':'Submit stock request →';if(focusedLabel&&!focused.isConnected){const replacement=[...$('cart').querySelectorAll('[aria-label]')].find(element=>element.getAttribute('aria-label')===focusedLabel);replacement?.focus({preventScroll:true});}
}
if($('search'))$('search').oninput=()=>{page=1;renderMenu();};
if($('previous-page'))$('previous-page').onclick=()=>{page--;renderMenu();$('menu').scrollIntoView({block:'start'});};
if($('next-page'))$('next-page').onclick=()=>{page++;renderMenu();$('menu').scrollIntoView({block:'start'});};
if($('checkout'))$('checkout').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;render();$('message').textContent='';const body=Object.fromEntries(new FormData(e.target));body.items=Object.entries(cart).filter(([,q])=>q>0).map(([id,quantity])=>({id,quantity}));try{const signature=JSON.stringify(body);if(signature!==submissionBody){submissionBody=signature;submissionId=crypto.randomUUID();}body.requestId=submissionId;const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const order=await response.json();if(!response.ok)throw Error(order.error);cart={};submissionId='';submissionBody='';$('message').textContent='Request '+order.id+' saved. Estimated total '+money(order.total)+(order.pricePending?' + prices pending':'')+'. '+(order.delivery||[]).map(d=>d.supplier+': '+(d.status==='submitted'?'submitted to sending service':d.status==='not_configured'?'not sent — delivery not configured':d.status==='failed'?'sending failed':'submission unconfirmed')).join('; ');e.target.reset();}catch(error){$('message').textContent=error.message||'Could not save the request. Try again.';}finally{busy=false;render();}};
async function api(url,method,body){const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href='/login';throw Error('Please sign in again.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save changes.');return data;}
async function reload(){
  const data=await api('/api/catalogue','GET');products=data.products;suppliers=data.suppliers;parWindow=data.parWindow;renderParPeriod();
  for(const id of Object.keys(cart))if(!products.some(p=>p.id===id)||!Number.isInteger(cart[id])||cart[id]<1||cart[id]>999)delete cart[id];
  if(category!=='All'&&!suppliers.some(s=>s.id===category))category='All';
  if($('filters')){$('filters').replaceChildren();
  for(const supplier of [{id:'All',name:'All suppliers'},...suppliers]){const b=el('button',supplier.name,category===supplier.id?'active':'');b.onclick=()=>{category=supplier.id;page=1;for(const child of $('filters').children)child.classList.toggle('active',child===b);renderMenu();};$('filters').append(b);}}
  render();
}
$('logout').onclick=async()=>{try{await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}});location.href='/login';}catch(error){$('message').textContent=error.message;}};
(async()=>{try{const session=await api('/api/session','GET');if(!session.csrf){location.href='/login';return;}csrf=session.csrf;cartKey='souvlaki-cart-'+(session.id||session.username);try{const stored=JSON.parse(localStorage.getItem(cartKey)||'{}');cart=stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};}catch{cart={};}if($('user-greeting'))$('user-greeting').replaceChildren(el('span','Yassou,','greeting-intro'),document.createElement('br'),el('span',session.username+'!','greeting-name'));$('admin-link').hidden=session.role!=='admin';await reload();$('load-status').textContent='';}catch(error){$('load-status').textContent=error.message;}})();

window.addEventListener('interface-text-updated',()=>{if(products.length){renderParPeriod();renderMenu();if($('cart'))render(false);}});

// Recalculate after a week boundary or after usage is saved in another tab.
if($('menu')){
 let parRefreshPending=false;
 async function refreshParIfNeeded(force=false){
  if(!parWindow||parRefreshPending||document.hidden)return;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:parWindow.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=kind=>parts.find(part=>part.type===kind).value;const date=new Date(value('year')+'-'+value('month')+'-'+value('day')+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
  if(!force&&date.toISOString().slice(0,10)===parWindow.currentWeekStart)return;
  parRefreshPending=true;try{
   const data=await api('/api/catalogue','GET');parWindow=data.parWindow;const levels=new Map(data.products.map(product=>[product.id,product.par]));
   for(const product of products)product.par=levels.get(product.id);renderParPeriod();
   for(const card of $('menu').querySelectorAll('[data-product-id]')){const product=products.find(product=>product.id===card.dataset.productId);if(product)card.querySelector('.product-par')?.replaceWith(renderProductPar(product));}
   $('load-status').textContent='';
  }catch(error){$('load-status').textContent=error.message;}finally{parRefreshPending=false;}
 }
 setInterval(()=>refreshParIfNeeded(),60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshParIfNeeded(true);});
 window.addEventListener('focus',()=>refreshParIfNeeded(true));
 window.addEventListener('storage',event=>{if(event.key===cartKey.replace('souvlaki-cart-','souvlaki-usage-updated-'))refreshParIfNeeded(true);});
 window.addEventListener('pageshow',event=>{if(event.persisted)refreshParIfNeeded(true);});
}
