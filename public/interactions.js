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
