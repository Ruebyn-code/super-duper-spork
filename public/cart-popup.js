(()=>{
 const pill=document.getElementById('cart-pill'),popup=document.getElementById('cart-popup');if(!pill||!popup)return;
 const close=document.getElementById('cart-popup-close');let ready=false,busy=false;
 function open(){
  if(!ready||popup.open)return;
  popup.showModal();pill.setAttribute('aria-expanded','true');document.body.classList.add('cart-popup-open');
  window.dispatchEvent(new Event('cart-opening'));
 }
 function dismiss(){if(!busy)popup.close();}
 pill.onclick=open;close.onclick=dismiss;
 popup.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 popup.addEventListener('click',event=>{
  const bounds=popup.getBoundingClientRect();
  if(event.target===popup&&(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom))dismiss();
 });
 popup.addEventListener('close',()=>{
  pill.setAttribute('aria-expanded','false');document.body.classList.remove('cart-popup-open');
  if(location.hash==='#cart'){
   const url=new URL(location.href);url.hash='';history.replaceState(history.state,'',url.href);
   if(window.appEmbedded)parent.appShell?.childRouteChanged(window);
  }
  pill.focus({preventScroll:true});
 });
 window.addEventListener('hashchange',()=>{if(location.hash==='#cart')open();else if(popup.open)dismiss();});
 window.addEventListener('ordering-cart-updated',event=>{
  const {count,total,pricePending}=event.detail;ready=true;busy=event.detail.busy;
  pill.disabled=false;close.disabled=busy;popup.setAttribute('aria-busy',String(busy));
  const amount=new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(total/100)+(pricePending?' + pending':'');
  document.getElementById('cart-pill-count').textContent=count;
  document.getElementById('cart-pill-total').textContent=amount;
  pill.setAttribute('aria-label','Open cart · '+count+' units · '+amount);
  if(location.hash==='#cart')open();
 });
})();
