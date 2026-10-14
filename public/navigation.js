(()=>{
 const sidebar=document.getElementById('app-sidebar'),toggle=document.getElementById('sidebar-toggle'),secondary=document.getElementById('app-subsidebar'),shell=sidebar?.closest('.app-shell');
 let selectedGroup='',isAdmin=false,isUserManager=false,moreOpen=false;
 const mobile=matchMedia('(max-width:720px), (max-width:1100px) and (max-height:500px) and (pointer:coarse)'),scroll=sidebar?.querySelector('.sidebar-scroll'),footer=sidebar?.querySelector('.sidebar-footer'),page=shell?.querySelector('.app-page');
 const mobileBar=document.createElement('nav');mobileBar.id='mobile-tabbar';mobileBar.className='mobile-tabbar';mobileBar.setAttribute('aria-label','Main navigation');
 const more=document.createElement('button');more.id='mobile-more';more.type='button';more.className='mobile-nav-tab';more.setAttribute('data-copy-editor','');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','app-sidebar-menu');
 more.innerHTML='<svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><path d="M7 8h10M7 12h10M7 16h10"/></g></svg><span class="sidebar-label">More</span>';
 const menuTitle=document.createElement('div');menuTitle.className='mobile-menu-heading';menuTitle.setAttribute('data-copy-editor','');menuTitle.innerHTML='<h2>More</h2><button type="button" aria-label="Close menu" title="Close menu"><svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>';
 const backdrop=document.createElement('div');backdrop.className='mobile-nav-backdrop';backdrop.hidden=true;backdrop.setAttribute('aria-hidden','true');backdrop.setAttribute('data-copy-editor','');
 const mobileHeader=document.createElement('div');mobileHeader.className='mobile-brand-header';
 const navSlots=[...scroll?.querySelectorAll(':scope > .main-sidebar-nav')||[]].map(nav=>{const marker=document.createComment('desktop navigation position');nav.before(marker);return {nav,marker};});
 const footerSlot=document.createComment('desktop footer position');footer?.before(footerSlot);let brandSlot;
 if(sidebar&&scroll){scroll.id='app-sidebar-menu';scroll.prepend(menuTitle);sidebar.append(mobileBar);mobileBar.append(more);shell.before(backdrop);page?.prepend(mobileHeader);}
 function updateMore(){
  more.setAttribute('aria-expanded',String(moreOpen));const active=moreOpen||['stock','accounts','settings'].includes(selectedGroup||currentGroup());more.classList.toggle('active',active);
  menuTitle.querySelector('h2').textContent=wording('More');menuTitle.querySelector('button').setAttribute('aria-label',wording('Close menu')||'Close menu');menuTitle.querySelector('button').title=wording('Close menu')||'Close menu';more.querySelector('.sidebar-label').textContent=wording('More');more.title=wording('More')||'More';more.setAttribute('aria-label',more.title);
 }
 function renderMobileSheets(){shell?.classList.toggle('mobile-more-open',mobile.matches&&moreOpen);backdrop.hidden=!(mobile.matches&&(moreOpen||selectedGroup));if(mobile.matches&&scroll)scroll.inert=!moreOpen;updateMore();}
 function closeMore(restoreFocus=false){moreOpen=false;renderMobileSheets();if(restoreFocus)more.focus();}
 function openMore(focus=false){closeSubmenu();moreOpen=true;renderMobileSheets();if(focus)(scroll?.querySelector('#admin-link:not([hidden]) a')||document.getElementById('logout'))?.focus();}
 document.getElementById('app-edit-toggle')?.addEventListener('click',()=>{if(mobile.matches)closeMore();});
 more.onclick=()=>{if(moreOpen)closeMore();else openMore();};menuTitle.querySelector('button').onclick=()=>closeMore(true);backdrop.onclick=()=>{const group=selectedGroup;closeMore();closeSubmenu();(group&&['count','sales'].includes(group)?groupLink(group):more)?.focus();};
 function syncMobileLayout(){
  if(!sidebar||!scroll)return;pointerInside=false;keyboardInside=false;closeMore();closeSubmenu();
  if(mobile.matches){
   for(const {nav} of navSlots)mobileBar.insertBefore(nav,more);if(footer)scroll.append(footer);
   const brand=scroll.querySelector('.sidebar-brand-row');if(brand){if(!brandSlot){brandSlot=document.createComment('desktop brand position');brand.before(brandSlot);}mobileHeader.append(brand);}
  }else{
   for(const {nav,marker} of navSlots)marker.after(nav);if(footer)footerSlot.after(footer);const brand=mobileHeader.querySelector('.sidebar-brand-row');if(brand&&brandSlot)brandSlot.after(brand);scroll.inert=false;
   if(!matchMedia('(max-width:900px)').matches)openSubmenu(currentGroup());
  }
  renderSidebar();renderMobileSheets();
 }
 mobile.addEventListener('change',syncMobileLayout);
 const preference='souvlaki-sidebar-collapsed';
 const hoverPreference='souvlaki-sidebar-hover-expand',root=document.documentElement;
 let collapsed=root.classList.contains('sidebar-collapsed'),hoverEnabled=false,pointerInside=false,keyboardInside=false;
 try{hoverEnabled=localStorage.getItem(hoverPreference)==='true';}catch{}
 const wording=(text,values={})=>{
  if(typeof interfaceLabel==='function')return interfaceLabel(text,values);
  const overrides=window.appBootstrap?.interfaceText||{};return String(Object.hasOwn(overrides,text)?overrides[text]??'':text).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 };
 const currentGroup=()=>({'/stock-count':'count','/sales':'sales','/admin':'stock','/admin/accounts':'accounts','/admin/settings':'settings'}[location.pathname]||'');
 const groupLink=group=>sidebar?.querySelector('[data-sidebar-group="'+group+'"]');
 function updateSubmenuTitle(){const link=groupLink(selectedGroup),title=document.getElementById('subsidebar-title');if(link&&title){title.dataset.localWording=link.dataset.sidebarName;const text=link.querySelector('.sidebar-label')?.textContent||'';if(title.textContent!==text)title.textContent=text;}const close=document.getElementById('subsidebar-close');if(close){close.title=wording('Close submenu')||'Close submenu';close.setAttribute('aria-label',close.title);}}
 function closeSubmenu(restoreFocus=false){const previous=selectedGroup;selectedGroup='';if(secondary)secondary.hidden=true;shell?.classList.remove('subsidebar-open');sidebar?.querySelectorAll('[data-sidebar-group]').forEach(link=>{link.setAttribute('aria-expanded','false');delete link.dataset.submenuOpen;});renderMobileSheets();if(restoreFocus){if(mobile.matches&&['stock','accounts','settings'].includes(previous)){openMore();groupLink(previous)?.focus();}else groupLink(previous)?.focus();}}
 function openSubmenu(group,focus=false){
  if(!secondary||(!isAdmin&&['stock','settings'].includes(group))||(!isUserManager&&group==='accounts'))return;
  const menu=secondary.querySelector('[data-subsidebar-group="'+group+'"]');if(!menu)return;selectedGroup=group;if(mobile.matches)closeMore();
  secondary.querySelectorAll('[data-subsidebar-group]').forEach(nav=>nav.hidden=nav!==menu);secondary.hidden=false;shell?.classList.add('subsidebar-open');
  sidebar?.querySelectorAll('[data-sidebar-group]').forEach(link=>{const active=link.dataset.sidebarGroup===group;link.setAttribute('aria-expanded',String(active));if(active)link.dataset.submenuOpen='true';else delete link.dataset.submenuOpen;});updateSubmenuTitle();
  renderMobileSheets();if(focus||mobile.matches)menu.querySelector('a')?.focus();
 }
 sidebar?.querySelectorAll('[data-sidebar-group]').forEach(link=>link.addEventListener('click',event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();if(selectedGroup===link.dataset.sidebarGroup)closeSubmenu();else openSubmenu(link.dataset.sidebarGroup,event.detail===0);}));
 document.getElementById('subsidebar-close')?.addEventListener('click',()=>closeSubmenu(true));
 sidebar?.querySelectorAll('.main-sidebar-nav a:not([data-sidebar-group])').forEach(link=>link.addEventListener('click',()=>{if(mobile.matches){closeMore();closeSubmenu();}}));
 secondary?.addEventListener('click',event=>{if(event.target.closest('a')&&matchMedia('(max-width:900px)').matches)closeSubmenu();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selectedGroup&&!document.querySelector('dialog[open], [popover]:popover-open:not(.app-edit-indicator)')){event.preventDefault();closeSubmenu(true);}else if(event.key==='Escape'&&moreOpen&&!document.querySelector('dialog[open], [popover]:popover-open:not(.app-edit-indicator)')){event.preventDefault();closeMore(true);}});
 window.addEventListener('hashchange',()=>{if(!matchMedia('(max-width:900px)').matches)openSubmenu(currentGroup());});
 function updateToggle(){
  if(!toggle)return;const preview=root.classList.contains('sidebar-hover-expanded'),mode=!collapsed?'expanded':hoverEnabled?'hover':'collapsed',original=mode==='expanded'?'Collapse sidebar':mode==='collapsed'?'Enable hover expansion':'Keep sidebar expanded',text=wording(original),modeLabel=wording(mode==='expanded'?'Sidebar expanded':mode==='collapsed'?'Stay collapsed':'Expand on hover');
  toggle.setAttribute('aria-expanded',String(!collapsed||preview));toggle.setAttribute('aria-label',text||original);toggle.setAttribute('aria-description',wording('Sidebar mode: {mode}',{mode:modeLabel}));toggle.title=[modeLabel,text||original].filter(Boolean).join(' · ');toggle.querySelector('.sidebar-toggle-text').textContent=text;
  if(toggle.dataset.sidebarMode!==mode){toggle.dataset.sidebarMode=mode;const icon=toggle.querySelector('svg');if(icon)icon.innerHTML=mode==='expanded'?'<path d="m14 6-6 6 6 6"/>':mode==='collapsed'?'<path d="M4 12h16m-4-4 4 4-4 4M8 8l-4 4 4 4"/>':'<path d="M9 3h6M10 3v5l-3 4v2h10v-2l-3-4V3M12 14v7"/>';}
 }
 function accessibleName(element,original){return element.querySelector('.sidebar-label')?.textContent.trim()||wording(original)||original;}
 function updateNavigationLabels(){
  if(!sidebar)return;
  sidebar.querySelectorAll('[data-sidebar-name]').forEach(link=>{
   let name=accessibleName(link,link.dataset.sidebarName);
   if(link.dataset.sidebarName==='Cart'){const count=document.getElementById('cart-badge')?.textContent||'0';name+=' · '+wording('{count} units',{count});}
   link.setAttribute('aria-label',name);link.title=name;
  });
  const logout=document.getElementById('logout');if(logout){const name=accessibleName(logout,'Sign out');logout.setAttribute('aria-label',name);logout.title=name;}
 }
 function renderSidebar(){const preview=!mobile.matches&&collapsed&&hoverEnabled&&(pointerInside||keyboardInside);root.classList.toggle('sidebar-collapsed',!mobile.matches&&collapsed&&!preview);root.classList.toggle('sidebar-hover-expanded',preview);updateToggle();}
 function setMode(mode){collapsed=mode!=='expanded';hoverEnabled=mode==='hover';pointerInside=false;keyboardInside=false;renderSidebar();try{localStorage.setItem(preference,String(collapsed));localStorage.setItem(hoverPreference,String(hoverEnabled));}catch{}}
 if(toggle)toggle.onclick=()=>setMode(!collapsed?'collapsed':!hoverEnabled?'hover':'expanded');
 const inNavigation=element=>Boolean(element&&sidebar?.contains(element));
 for(const rail of [sidebar].filter(Boolean)){
  rail.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&matchMedia('(hover:hover) and (pointer:fine)').matches){pointerInside=true;renderSidebar();}});
  rail.addEventListener('pointerleave',event=>{pointerInside=inNavigation(event.relatedTarget);renderSidebar();});
  rail.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible')){keyboardInside=true;renderSidebar();}});
  rail.addEventListener('focusout',()=>{queueMicrotask(()=>{keyboardInside=Boolean(sidebar?.querySelector(':focus-visible'));renderSidebar();});});
 }
 updateToggle();updateNavigationLabels();syncMobileLayout();
 window.addEventListener('storage',event=>{if(event.key!==preference&&event.key!==hoverPreference&&event.key!==null)return;try{collapsed=localStorage.getItem(preference)==='true';hoverEnabled=localStorage.getItem(hoverPreference)==='true';}catch{}pointerInside=false;keyboardInside=false;renderSidebar();});
 window.addEventListener('interface-text-updated',()=>{updateToggle();updateNavigationLabels();updateSubmenuTitle();updateMore();});
 if(sidebar)new MutationObserver(()=>{updateNavigationLabels();updateSubmenuTitle();}).observe(sidebar,{childList:true,characterData:true,subtree:true});
 (async()=>{
  try{
   const response=await fetch('/api/session',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});const session=await response.json();if(!session.csrf){location.href='/login';return;}
   document.querySelectorAll('.main-sidebar-nav a').forEach(link=>{if(new URL(link.href).pathname===location.pathname)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
   const brand=sidebar?.querySelector('.brand');
   if(session.locationName&&brand){
    let row=brand.closest('.sidebar-brand-row');if(!row){row=document.createElement('div');row.className='sidebar-brand-row';brand.before(row);row.append(brand);}
    const control=document.createElement('div');control.id='sidebar-location';control.className='sidebar-location location-switcher';control.title=session.locationName;
    control.innerHTML='<svg class="location-pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>';
    const label=document.createElement('span');label.id='sidebar-location-name';label.className='location-name';label.dataset.userText='';label.dataset.editId='sidebar-location-'+location.pathname.replace(/[^a-z0-9]/gi,'_');label.textContent=session.locationName;
    const arrow=document.createElement('span');arrow.className='location-chevron';arrow.setAttribute('aria-hidden','true');arrow.textContent='⌄';
    const select=document.createElement('select');select.id='sidebar-location-select';select.setAttribute('aria-label',wording('Switch location'));for(const entry of session.locations||[{id:session.locationId,name:session.locationName}]){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;select.append(option);}select.value=session.locationId;select.disabled=select.options.length<2;arrow.hidden=select.disabled;
    const status=document.createElement('p');status.className='location-switch-status';status.setAttribute('role','status');status.hidden=true;
    select.onchange=async()=>{const next=select.value;if(next===session.locationId)return;
     const before=new Event('before-location-switch',{cancelable:true});if(!window.dispatchEvent(before)){select.value=session.locationId;status.hidden=false;status.textContent=wording('Wait for saving to finish before switching locations.');return;}
     select.disabled=true;status.hidden=false;status.textContent=wording('Switching location…');
     try{const response=await fetch('/api/session/location',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({locationId:next})});const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to switch location.');location.reload();}
     catch(error){select.value=session.locationId;select.disabled=false;status.textContent=error.message;}
    };
    control.append(label,arrow,select);row.append(control,status);window.locationPickers.enhance(select,{host:control,displayLabel:label,contents:[control.querySelector('.location-pin'),label,arrow],label:'Switch location',holdWhileBusy:true});syncMobileLayout();
   }
   isAdmin=session.role==='admin';isUserManager=['admin','franchisee'].includes(session.role);document.querySelectorAll('#app-sidebar a[data-head-office-only],#app-subsidebar a[data-head-office-only]').forEach(element=>element.hidden=!isAdmin);const admin=document.getElementById('admin-link');if(admin)admin.hidden=!isUserManager;
   const editControls=document.getElementById('admin-edit-controls');if(editControls)editControls.hidden=session.role!=='admin';
   if(!matchMedia('(max-width:900px)').matches)openSubmenu(currentGroup());renderMobileSheets();
   const badge=document.getElementById('cart-badge'),cartKey='souvlaki-cart-'+(session.id||session.username)+(session.locationId?'-'+session.locationId:'');function refreshBadge(){if(!badge)return;try{const cart=JSON.parse(localStorage.getItem(cartKey)||(session.canMigrateBrowserData?localStorage.getItem('souvlaki-cart-'+(session.id||session.username)):null)||'{}');badge.textContent=Object.values(cart).filter(q=>Number.isInteger(q)&&q>0&&q<=999).reduce((sum,q)=>sum+q,0);}catch{badge.textContent='0';}}refreshBadge();window.addEventListener('storage',event=>{if(event.key===cartKey)refreshBadge();});window.addEventListener('cart-updated',event=>{if(event.detail?.key===cartKey)refreshBadge();});
   updateNavigationLabels();updateMore();
  }catch{}
 })();
})();
