(()=>{
 const $=id=>document.getElementById(id);
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 const money=value=>value===null?wording('Price pending'):new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 let session,catalogue,cartKey='',loading=false,refreshAgain=false;
 function template(element,text,values={}){element.dataset.appTemplate=text;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(text,values);}
 async function api(path){const response=await fetch(path,{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(response.status===401){location.href='/login';throw Error('Please sign in again.');}if(!response.ok)throw Error('Unable to load dashboard.');return response.json();}
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
 function render(){
  if(session){$('home-user-name').textContent=session.username+'!';$('home-location').textContent=session.locationName||'';}
  $('home-today').textContent=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());
  if(!catalogue)return;
  template($('home-stock-items'),'{count} stock items',{count:catalogue.products.length});
  const date=catalogue.stockTake?.countDate;
  template($('home-stock-take'),date?'Latest: {date}':'No stock take yet',{date:date?new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z')):''});
  renderCart();
 }
 async function refresh(){
  if(!session||document.hidden)return;if(loading){refreshAgain=true;return;}loading=true;
  try{catalogue=await api('/api/catalogue');render();$('home-status').textContent='';}
  catch{template($('home-status'),'Unable to load your dashboard. Use the navigation to open a page.');}
  finally{loading=false;if(refreshAgain){refreshAgain=false;refresh();}}
 }
 $('logout').onclick=async()=>{try{const response=await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':session?.csrf||''}});if(!response.ok)throw Error();location.href='/login';}catch{template($('home-status'),'Please sign in again.');}};
 window.addEventListener('storage',event=>{if(event.key===cartKey||event.key===null)renderCart();if(session&&event.key==='souvlaki-usage-updated-'+(session.dataScope||session.id))refresh();});
 window.addEventListener('focus',()=>{renderCart();refresh();});window.addEventListener('pageshow',event=>{renderCart();if(event.persisted)refresh();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderCart();refresh();}});
 window.addEventListener('interface-text-updated',render);setInterval(refresh,60000);
 (async()=>{
  try{
   session=await api('/api/session');if(!session.csrf){location.href='/login';return;}
   const legacyKey='souvlaki-cart-'+(session.id||session.username);cartKey=legacyKey+(session.locationId?'-'+session.locationId:'');
   try{if(session.canMigrateBrowserData&&localStorage.getItem(cartKey)===null&&localStorage.getItem(legacyKey)!==null)localStorage.setItem(cartKey,localStorage.getItem(legacyKey));}catch{}
   $('home-admin').hidden=!['admin','franchisee'].includes(session.role);
   $('home-admin').querySelectorAll('[data-head-office-only]').forEach(link=>link.hidden=session.role!=='admin');
   render();await refresh();
  }catch{template($('home-status'),'Unable to load your dashboard. Use the navigation to open a page.');}
 })();
})();
