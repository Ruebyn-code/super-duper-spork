// Keep menus predictable for pointer and keyboard users.
document.addEventListener('click',event=>{
 document.querySelectorAll('.admin-dropdown[open]').forEach(menu=>{if(!menu.contains(event.target))menu.open=false;});
});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape')return;
 document.querySelectorAll('.admin-dropdown[open]').forEach(menu=>{menu.open=false;menu.querySelector('summary')?.focus();});
});
function syncBusy(form){const busy=Boolean(form.querySelector('button[type="submit"]:disabled'));form.setAttribute('aria-busy',String(busy));}
const busyObserver=new MutationObserver(records=>{for(const record of records){const form=record.target.closest('form');if(form)syncBusy(form);}});
busyObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['disabled']});

// Animate the existing cart update signal without watching or delaying page rendering.
(()=>{
 const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
 let previousUnits=null,pulse;
 window.addEventListener('ordering-cart-updated',()=>{
  const badge=document.getElementById('cart-badge');if(!badge)return;
  const units=Number(badge.textContent),changed=previousUnits!==null&&units!==previousUnits;previousUnits=units;
  if(!changed||reducedMotion.matches||typeof badge.animate!=='function')return;
  pulse?.cancel();pulse=badge.animate([{transform:'scale(1)'},{transform:'scale(1.1)'},{transform:'scale(1)'}],{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
 });
 reducedMotion.addEventListener('change',event=>{if(event.matches)pulse?.cancel();});
})();
