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

// Date controls use the search field's compact expansion without clearing dates.
document.querySelectorAll('.date-control').forEach(control=>{
 const button=control.querySelector('.date-toggle'),field=control.querySelector('.date-field'),input=field.querySelector('input[type=date]'),label=input.labels?.[0];
 function updateLabel(){const caption=label?.textContent.trim()||'Date',action=button.getAttribute('aria-expanded')==='true'?'Close':'Edit';button.setAttribute('aria-label',action+' '+caption);button.title=action+' '+caption;}
 function setOpen(open,focus=true){
  if(open&&input.disabled)return;
  control.classList.toggle('date-open',open);button.setAttribute('aria-expanded',String(open));field.inert=!open;field.setAttribute('aria-hidden',String(!open));input.tabIndex=open?0:-1;updateLabel();
  if(focus)(open?input:button).focus({preventScroll:true});
 }
 button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
 label?.addEventListener('click',event=>{event.preventDefault();setOpen(true);});
 control.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){event.preventDefault();event.stopPropagation();setOpen(false);}});
 input.addEventListener('invalid',()=>setOpen(true));
 input.form?.addEventListener('reset',()=>setOpen(false,false));
 window.addEventListener('interface-text-updated',updateLabel);updateLabel();
});

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
