// Home Quick actions: one floating button that unrolls permission-filtered shortcuts.
(()=>{
 const $=id=>document.getElementById(id);if(!$('invoice-launcher'))return;
 const svg=body=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+body+'</svg>';
 const icons={
  invoice:svg('<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4"/><g class="icon-detail"><path d="M8 7h8v10H8zM10 10h4M10 14h4"/></g>'),
  count:svg('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9z"/><g class="icon-detail"><path d="M9 12h6M9 16h6"/></g>'),
  order:svg('<path d="M5 8h14l1 13H4L5 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/><g class="icon-detail"><path d="M9 13h6"/></g>'),
  sales:svg('<path d="M4 4v16h16"/><g class="icon-detail"><path d="M8 16v-4M13 16V8M18 16V5"/></g>'),
  wastage:svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/><g class="icon-detail"><path d="M10 11v6M14 11v6"/></g>'),
  equipment:svg('<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z"/>'),
  labels:svg('<path d="M3 12V4h8l10 10-8 8L3 12Z"/><g class="icon-detail"><circle cx="7.5" cy="8.5" r="1.5"/></g>'),
  message:svg('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/><g class="icon-detail"><path d="M8 11h8M8 14h5"/></g>'),
  hourly:svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><g class="icon-detail"><circle cx="12" cy="13" r="3.5"/></g>'),
  bolt:svg('<path d="M12 5v14M5 12h14"/>')
 };
 const can=key=>window.appAccess?.can(key);
 const managerHome=()=>window.homeProfile?.profile!=='staff'&&document.body.dataset.homeDashboard!=='staff';
 // Hourly report scanning is Store Manager Home only (never Head Office or Staff Home), like the Daily sales scanner.
 let actor=null;window.addEventListener('home-dashboard-access',event=>{if(event.detail?.actor)actor=event.detail.actor;});
 const storeManager=()=>window.homeProfile?.profile==='manager';
 const actions=[
  {id:'invoice',label:'Scan invoice',detail:'Photo or upload a supplier invoice',allowed:()=>can('invoices.view'),run:()=>$('invoice-launcher').click()},
  {id:'hourly',label:'Scan hourly sales',detail:'Take a photo of the hourly sales report',allowed:()=>Boolean(actor?.csrf&&window.hourlySalesUpload)&&storeManager()&&can('hourly.import')&&can('sales.view'),run:()=>window.hourlySalesUpload.open({actor,trigger:button,available:()=>storeManager()&&can('hourly.import')&&can('sales.view'),onSaved:()=>window.dispatchEvent(new CustomEvent('home-hourly-saved'))})},
  {id:'count',label:'Stock count',detail:'Start a new count',href:'/stock-count#new',allowed:()=>can('counts.view')},
  {id:'order',label:'Place an order',detail:'Open the ordering catalogue',href:'/',allowed:()=>can('orders.view')},
  {id:'sales',label:'Daily sales',detail:'Enter today’s sales',href:'/sales#entry',allowed:()=>can('sales.edit')&&managerHome()},
  {id:'wastage',label:'Record wastage',detail:'Log stock that was thrown out',href:'/wastage',allowed:()=>can('wastage.view')},
  {id:'equipment',label:'Equipment',detail:'Report a problem or log a service',href:'/equipment',allowed:()=>can('equipment.view')},
  {id:'labels',label:'Print labels',detail:'Prep and use-by labels',href:'/labels',allowed:()=>can('prep.view')},
  {id:'message',label:'Messages',detail:'Open Comms',href:'/communications',allowed:()=>can('comms.view')}
 ];
 const wrap=document.createElement('div');wrap.className='quick-actions';wrap.dataset.layoutUi='';
 const button=document.createElement('button');button.type='button';button.id='quick-actions-button';button.className='quick-actions-button';button.setAttribute('aria-haspopup','menu');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','quick-actions-menu');button.setAttribute('aria-label','Quick actions');button.title='Quick actions';button.innerHTML=icons.bolt+'<span class="quick-actions-close" aria-hidden="true">'+svg('<path d="M6 6l12 12M18 6 6 18"/>')+'</span>';
 const menu=document.createElement('div');menu.id='quick-actions-menu';menu.className='quick-actions-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label','Quick actions');menu.hidden=true;
 const heading=document.createElement('p');heading.className='quick-actions-heading';heading.textContent='Quick actions';heading.setAttribute('aria-hidden','true');
 const backdrop=document.createElement('div');backdrop.className='quick-actions-backdrop';backdrop.hidden=true;
 wrap.append(menu,button);document.body.append(backdrop,wrap);
 let open=false,timer;
 const items=()=>[...menu.querySelectorAll('[role=menuitem]')];
 function build(){menu.replaceChildren(heading);let index=0;for(const action of actions){if(!action.allowed())continue;const item=document.createElement(action.href?'a':'button');if(action.href)item.href=action.href;else item.type='button';item.className='quick-action';item.dataset.action=action.id;item.setAttribute('role','menuitem');item.tabIndex=-1;item.style.setProperty('--i',String(index++));const icon=document.createElement('span');icon.className='quick-action-icon';icon.innerHTML=icons[action.id];const text=document.createElement('span');text.className='quick-action-text';const strong=document.createElement('strong');strong.textContent=action.label;const small=document.createElement('small');small.textContent=action.detail;text.append(strong,small);item.append(icon,text);item.addEventListener('click',event=>{if(action.run){event.preventDefault();close(false);action.run();}else close(false);});menu.append(item);}menu.style.setProperty('--count',String(index));wrap.hidden=!index;return index;}
 function show(){clearTimeout(timer);if(!build())return;open=true;menu.hidden=false;backdrop.hidden=false;button.setAttribute('aria-expanded','true');requestAnimationFrame(()=>requestAnimationFrame(()=>{wrap.classList.add('is-open');backdrop.classList.add('is-open');items()[0]?.focus({preventScroll:true});}));}
 function close(focus=true){if(!open)return;open=false;wrap.classList.remove('is-open');backdrop.classList.remove('is-open');button.setAttribute('aria-expanded','false');const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;timer=setTimeout(()=>{if(!open){menu.hidden=true;backdrop.hidden=true;}},reduce?0:260);if(focus)button.focus({preventScroll:true});}
 button.addEventListener('click',()=>open?close():show());
 backdrop.addEventListener('click',()=>close(false));
 menu.addEventListener('keydown',event=>{const list=items(),at=list.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=(at+(event.key==='ArrowDown'?1:-1)+list.length)%list.length;list[next]?.focus();}else if(event.key==='Home'||event.key==='End'){event.preventDefault();list[event.key==='Home'?0:list.length-1]?.focus();}else if(event.key==='Tab')close(false);});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&open)close();});
 window.addEventListener('pagehide',()=>close(false));
 // The invoice scanner keeps its own launcher for focus/state; return focus here when it closes.
 const scanner=$('invoice-scanner');scanner?.addEventListener('close',()=>setTimeout(()=>{if(document.activeElement===document.body||document.activeElement===$('invoice-launcher'))button.focus({preventScroll:true});}));
 (async()=>{try{actor||=await window.appAccess?.initialSession?.();}catch{}build();})();
 window.homeQuickActions={open:show,close:()=>close(false),refresh:build};
})();
