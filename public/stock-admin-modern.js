// Modern Stock items / Suppliers & delivery pages (display only). Adds a toolbar with search, counts and the existing
// Add new stock / Add supplier buttons (moved, same handlers), initial tiles on supplier and item rows, item-count and
// sending-method chips, and Expand/Collapse all. Searching only hides/opens rows locally; nothing is saved or sent.
(()=>{
 const page=document.querySelector('.stock-admin-page');if(!page)return;
 const stockList=document.getElementById('stock-list'),supplierList=document.getElementById('supplier-list');if(!stockList||!supplierList)return;
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const initials=name=>String(name||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
 const hue=name=>{let hash=0;for(const char of String(name||''))hash=(hash*31+char.charCodeAt(0))>>>0;return hash%360;};
 function tile(name,className){const node=el('span',initials(name),'stock-admin-tile '+(className||''));node.setAttribute('aria-hidden','true');node.style.setProperty('--tile-hue',String(hue(name)));return node;}
 const svg=path=>`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

 function toolbar(view,placeholder){
  const bar=el('div',undefined,'stock-admin-toolbar');bar.dataset.adminViews=view;
  const search=el('label',undefined,'stock-admin-search');search.innerHTML=svg('<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>');const input=el('input');input.type='search';input.placeholder=word(placeholder);input.setAttribute('aria-label',word(placeholder));input.autocomplete='off';search.append(input);
  const summary=el('span','','stock-admin-summary');summary.setAttribute('aria-live','polite');const actions=el('div',undefined,'stock-admin-actions');
  bar.append(search,summary,actions);return {bar,input,summary,actions};
 }
 const stockBar=toolbar('stock','Search stock items, SKUs or suppliers'),supplierBar=toolbar('suppliers','Search suppliers');
 stockList.before(stockBar.bar);supplierList.before(supplierBar.bar);
 const toggleAll=el('button','','stock-admin-toggle');toggleAll.type='button';stockBar.actions.append(toggleAll);
 function moveButtons(){const add=document.getElementById('add-stock-shortcut');if(add&&add.parentElement!==stockBar.actions){add.textContent='+ '+word('Add new stock');stockBar.actions.append(add);}
  const supplier=document.getElementById('add-supplier-setup');if(supplier&&supplier.parentElement!==supplierBar.actions){supplier.closest('.admin-create-section')?.classList.add('stock-admin-moved');supplier.textContent='+ '+word('Add supplier');supplierBar.actions.append(supplier);}}

 // Supplier name → { method, contact } from the native Order delivery form in each supplier panel.
 function deliveryOf(group){const form=group.querySelector('form.supplier-delivery');const method=form?.elements.method?.value||'none',contact=form?.elements.contact?.value||'',platform=form?.elements.platform?.selectedOptions?.[0]?.textContent||'';return {method,contact,platform};}
 const methodLabels={none:'Not set up',email:'Email',sms:'Text message',platform:'Ordering platform'};
 function decorateSuppliers(){
  const counts=new Map([...stockList.querySelectorAll('.supplier-stock-menu')].map(group=>[group.dataset.supplierId,group.querySelectorAll('.stock-entry').length]));
  for(const group of supplierList.querySelectorAll('.supplier-delivery-menu')){
   const header=group.querySelector(':scope > .admin-record-header'),title=header?.querySelector('h3');if(!header||!title)continue;
   if(!header.querySelector('.stock-admin-tile'))header.prepend(tile(title.textContent,'supplier'));
   let info=header.querySelector('.stock-admin-supplier-info');if(!info){info=el('div',undefined,'stock-admin-supplier-info');title.before(info);info.append(title);}
   let chips=info.querySelector('.stock-admin-chips');if(!chips){chips=el('div',undefined,'stock-admin-chips');info.append(chips);}
   const delivery=deliveryOf(group),items=counts.get(group.dataset.supplierId)||0,methodChip=el('span',word(methodLabels[delivery.method]||methodLabels.none)+(delivery.method==='platform'&&delivery.platform?' · '+delivery.platform:''),'stock-admin-chip method-'+delivery.method);
   const parts=[methodChip];if(delivery.method!=='none'&&delivery.contact&&delivery.method!=='platform'){const contact=el('span',delivery.contact,'stock-admin-chip contact');contact.dataset.userText='';parts.push(contact);}parts.push(el('span',word(items===1?'1 item':'{count} items',{count:items}),'stock-admin-chip'));
   chips.replaceChildren(...parts);
   const form=group.querySelector('form.supplier-delivery');if(form&&!form.dataset.modernWatch){form.dataset.modernWatch='1';form.addEventListener('change',()=>schedule());form.addEventListener('submit',()=>setTimeout(schedule,600));}
  }
 }
 function decorateStock(){
  for(const group of stockList.querySelectorAll('.supplier-stock-menu')){const summary=group.querySelector(':scope > summary');const name=summary?.querySelector('h3');if(summary&&name&&!summary.querySelector('.stock-admin-tile'))summary.prepend(tile(name.textContent,'supplier'));}
  for(const row of stockList.querySelectorAll('.managed-stock')){if(row.dataset.modern)continue;row.dataset.modern='1';const details=row.firstElementChild,name=details?.querySelector('.stock-name');if(!details||!name)continue;
   row.prepend(tile(name.textContent,'item'));const price=[...details.children].pop();if(price&&price!==name&&!price.className)price.className='stock-admin-price';}
 }
 function counts(){
  const groups=[...stockList.querySelectorAll('.supplier-stock-menu')],items=stockList.querySelectorAll('.stock-entry').length;
  stockBar.summary.textContent=stockBar.input.value.trim()?word('{count} matching',{count:stockList.querySelectorAll('.stock-entry:not(.stock-admin-hidden)').length}):word('{items} items · {suppliers} suppliers',{items,suppliers:groups.length});
  const open=groups.length&&groups.every(group=>group.open);toggleAll.textContent=word(open?'Collapse all':'Expand all');toggleAll.hidden=!groups.length;
  const suppliers=supplierList.querySelectorAll('.supplier-delivery-menu').length,unset=[...supplierList.querySelectorAll('.supplier-delivery-menu')].filter(group=>deliveryOf(group).method==='none').length;
  supplierBar.summary.textContent=supplierBar.input.value.trim()?word('{count} matching',{count:supplierList.querySelectorAll('.supplier-delivery-menu:not(.stock-admin-hidden)').length}):word('{count} suppliers',{count:suppliers})+(unset?' · '+word('{count} not set up for orders',{count:unset}):'');
 }
 // Local search: hide non-matching rows, open groups with matches while searching and restore their open state afterwards.
 let remembered=null;
 function filterStock(){
  const query=stockBar.input.value.trim().toLowerCase(),groups=[...stockList.querySelectorAll('.supplier-stock-menu')];
  if(query&&!remembered)remembered=new Map(groups.map(group=>[group,group.open]));
  for(const group of groups){const supplierMatch=group.querySelector('summary h3')?.textContent.toLowerCase().includes(query);let any=false;
   for(const entry of group.querySelectorAll('.stock-entry')){const match=!query||supplierMatch||entry.textContent.toLowerCase().includes(query);entry.classList.toggle('stock-admin-hidden',!match);any||=match;}
   group.classList.toggle('stock-admin-hidden',Boolean(query)&&!any&&!supplierMatch);if(query&&any)group.open=true;}
  if(!query&&remembered){for(const [group,open] of remembered)if(group.isConnected)group.open=open;remembered=null;}
  counts();
 }
 function filterSuppliers(){const query=supplierBar.input.value.trim().toLowerCase();for(const group of supplierList.querySelectorAll('.supplier-delivery-menu'))group.classList.toggle('stock-admin-hidden',Boolean(query)&&!group.querySelector('.admin-record-header')?.textContent.toLowerCase().includes(query));counts();}
 stockBar.input.addEventListener('input',filterStock);supplierBar.input.addEventListener('input',filterSuppliers);
 toggleAll.addEventListener('click',()=>{const groups=[...stockList.querySelectorAll('.supplier-stock-menu:not(.stock-admin-hidden)')],open=!groups.every(group=>group.open);for(const group of groups)group.open=open;counts();});
 stockList.addEventListener('toggle',()=>counts(),true);
 let queued=false;
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;moveButtons();decorateStock();decorateSuppliers();if(stockBar.input.value.trim())filterStock();if(supplierBar.input.value.trim())filterSuppliers();counts();});}
 new MutationObserver(schedule).observe(stockList,{childList:true});new MutationObserver(schedule).observe(supplierList,{childList:true});
 window.addEventListener('interface-text-updated',schedule);
 schedule();window.applyAdminPanels?.();
})();
