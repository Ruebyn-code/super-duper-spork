(()=>{
 const sidebar=document.getElementById('app-sidebar'),toggle=document.getElementById('sidebar-toggle'),secondary=document.getElementById('app-subsidebar'),shell=sidebar?.closest('.app-shell');
 if(!sidebar)return;window.groupAppNavigation?.(sidebar,secondary);
 const root=document.documentElement,scroll=sidebar.querySelector('.sidebar-scroll'),footer=sidebar.querySelector('.sidebar-footer'),admin=document.getElementById('admin-link');
 const wording=(text,values={})=>{
  if(typeof interfaceLabel==='function')return interfaceLabel(text,values);
  const overrides=window.appBootstrap?.interfaceText||{};return String(Object.hasOwn(overrides,text)?overrides[text]??'':text).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 };
 let selectedGroup='',isAdmin=false,isUserManager=false,moreOpen=false;
 const mobile=matchMedia('(max-width:720px), (max-width:1100px) and (max-height:500px) and (pointer:coarse)'),page=shell.querySelector('.app-page');
 const currentGroup=()=>({'/':'ordering','/cart':'ordering','/stock-count':'ordering','/sales':'sales','/reporting':'sales','/admin':'ordering','/admin/accounts':'admin','/admin/settings':'admin'}[location.pathname]||'');
 const groupLink=group=>sidebar.querySelector('[data-sidebar-group="'+group+'"]');
 // Keep the original elements and edit identities when arranging the common header.
 root.classList.remove('sidebar-collapsed','sidebar-hover-expanded');sidebar.classList.add('top-navigation');
 const tabs=document.createElement('nav');tabs.id='top-navigation-tabs';tabs.className='top-navigation-tabs';tabs.setAttribute('aria-label','Main navigation');
 const navs=[...scroll.querySelectorAll(':scope > .main-sidebar-nav')];navs[0]?.before(tabs);tabs.append(...navs);
 const adminSlot=document.createComment('administration links position');if(admin){admin.before(adminSlot);tabs.append(admin);}
 const settingsLink=sidebar.querySelector('[data-sidebar-group="settings"]'),settingsSlot=document.createComment('app settings position');settingsLink?.before(settingsSlot);
 const settingsOptions=secondary?.querySelector('[data-subsidebar-group="settings"]'),settingsOptionsSlot=document.createComment('settings options position');settingsOptions?.before(settingsOptionsSlot);
 const settingsMenu=document.createElement('div');settingsMenu.id='app-settings-menu';settingsMenu.className='app-settings-menu secondary-sidebar';settingsMenu.setAttribute('popover','auto');settingsMenu.setAttribute('role','navigation');settingsMenu.dataset.editId='app-settings-menu-'+location.pathname.replace(/[^a-z0-9]/gi,'_');document.body.append(settingsMenu);
 function updateSettingsTrigger(){if(!settingsLink||mobile.matches)return;const open=settingsMenu.matches(':popover-open');settingsLink.setAttribute('aria-expanded',String(open));if(open)settingsLink.dataset.submenuOpen='true';else delete settingsLink.dataset.submenuOpen;settingsMenu.setAttribute('aria-label',settingsLink.querySelector('.sidebar-label')?.textContent||wording('App settings')||'App settings');renderToolbar();}
 function positionSettingsMenu(){if(!settingsMenu.matches(':popover-open'))return;const box=footer.getBoundingClientRect(),viewport=window.visualViewport,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight,edge=12,menuWidth=Math.min(280,width-edge*2),y=Math.min(box.bottom+8,top+height-56);settingsMenu.style.width=menuWidth+'px';settingsMenu.style.left=Math.max(left+edge,Math.min(box.right-menuWidth,left+width-menuWidth-edge))+'px';settingsMenu.style.top=y+'px';settingsMenu.style.maxHeight=Math.max(44,top+height-y-edge)+'px';}
 function closeSettingsMenu(restoreFocus=false){if(settingsMenu.matches(':popover-open'))settingsMenu.hidePopover();updateSettingsTrigger();if(restoreFocus)settingsLink?.focus({preventScroll:true});}
 function openSettingsMenu(focus=false,last=false){if(mobile.matches||!isAdmin||!settingsOptions)return;settingsOptions.hidden=false;settingsMenu.showPopover({source:settingsLink});positionSettingsMenu();updateSettingsTrigger();if(focus){const links=[...settingsOptions.querySelectorAll('a:not([hidden])')];(last?links.at(-1):links[0])?.focus();}}
 settingsMenu.addEventListener('toggle',updateSettingsTrigger);
 settingsMenu.addEventListener('click',event=>{if(event.target.closest('a'))closeSettingsMenu();});
 settingsMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeSettingsMenu(true);return;}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const links=[...settingsMenu.querySelectorAll('a:not([hidden])')],current=links.indexOf(document.activeElement);if(links.length)links[event.key==='Home'?0:event.key==='End'?links.length-1:(current+(event.key==='ArrowUp'?-1:1)+links.length)%links.length]?.focus();});
 let settingsPointerOpen=false;
 // Auto popovers can dismiss on pointer-up before the trigger's click runs.
 settingsLink?.addEventListener('pointerdown',()=>{settingsPointerOpen=settingsMenu.matches(':popover-open');});
 settingsLink?.addEventListener('keydown',event=>{if(mobile.matches||!['ArrowDown','ArrowUp',' '].includes(event.key))return;event.preventDefault();openSettingsMenu(true,event.key==='ArrowUp');});
 window.addEventListener('resize',positionSettingsMenu);window.visualViewport?.addEventListener('resize',positionSettingsMenu);window.visualViewport?.addEventListener('scroll',positionSettingsMenu);document.addEventListener('scroll',positionSettingsMenu,{capture:true,passive:true});
 const logout=document.getElementById('logout');if(logout)footer.append(logout);if(footer)scroll.append(footer);if(secondary)sidebar.append(secondary);
 const toolbarActions=document.createElement('div');toolbarActions.id='toolbar-actions';toolbarActions.className='toolbar-actions';toolbarActions.dataset.editId='toolbar-actions-'+location.pathname.replace(/[^a-z0-9]/gi,'_');
 const toolbarToggle=document.createElement('button');toolbarToggle.id='toolbar-toggle';toolbarToggle.type='button';toolbarToggle.className='toolbar-toggle';toolbarToggle.dataset.editId='toolbar-toggle-'+location.pathname.replace(/[^a-z0-9]/gi,'_');toolbarToggle.setAttribute('aria-controls','toolbar-actions');toolbarToggle.setAttribute('aria-label','App controls');toolbarToggle.title='App controls';toolbarToggle.innerHTML='<svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><g class="icon-detail"><circle cx="12" cy="12" r="1.5"/></g></svg>';
 const editControls=document.getElementById('admin-edit-controls');if(editControls)toolbarActions.append(editControls);if(logout)toolbarActions.append(logout);if(toggle)footer.after(toggle);footer.append(toolbarToggle,toolbarActions);
 let toolbarHovered=false,toolbarTouchOpen=false;
 function renderToolbar(){const open=!mobile.matches&&(toolbarHovered||toolbarTouchOpen||Boolean(footer.querySelector(':focus-visible'))||settingsMenu.matches(':popover-open'));footer.classList.toggle('toolbar-open',open);toolbarToggle.setAttribute('aria-expanded',String(open));toolbarActions.inert=!mobile.matches&&!open;toolbarActions.setAttribute('aria-hidden',String(!mobile.matches&&!open));}
 footer.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'){toolbarHovered=true;renderToolbar();}});
 footer.addEventListener('pointerleave',()=>{toolbarHovered=false;renderToolbar();});
 footer.addEventListener('focusin',renderToolbar);footer.addEventListener('focusout',()=>queueMicrotask(renderToolbar));
 toolbarToggle.onclick=event=>{if(!matchMedia('(hover:hover) and (pointer:fine)').matches){toolbarTouchOpen=!toolbarTouchOpen;renderToolbar();}else if(event.detail===0){[...toolbarActions.querySelectorAll('a,button')].find(element=>!element.hidden&&element.getClientRects().length)?.focus();}};
 document.addEventListener('pointerdown',event=>{if(!footer.contains(event.target)&&!settingsMenu.contains(event.target)){toolbarTouchOpen=false;renderToolbar();}},{capture:true});

 // Reuse the same links on phones so cart badges, roles and App edit identities stay intact.
 const mobileBar=document.createElement('nav');mobileBar.id='mobile-tabbar';mobileBar.className='mobile-tabbar';mobileBar.setAttribute('aria-label','Main navigation');
 const more=document.createElement('button');more.id='mobile-more';more.type='button';more.className='mobile-nav-tab';more.setAttribute('data-copy-editor','');more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','app-sidebar-menu');
 more.innerHTML='<svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><path d="M7 8h10M7 12h10M7 16h10"/></g></svg><span class="sidebar-label">More</span>';
 const menuTitle=document.createElement('div');menuTitle.className='mobile-menu-heading';menuTitle.setAttribute('data-copy-editor','');menuTitle.innerHTML='<h2>More</h2><button type="button" aria-label="Close menu" title="Close menu"><svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>';
 const backdrop=document.createElement('div');backdrop.className='mobile-nav-backdrop';backdrop.hidden=true;backdrop.setAttribute('aria-hidden','true');backdrop.setAttribute('data-copy-editor','');
 const mobileHeader=document.createElement('div');mobileHeader.className='mobile-brand-header';
 const navSlots=navs.map(nav=>{const marker=document.createComment('top navigation position');nav.before(marker);return {nav,marker};});let brandSlot;
 scroll.id='app-sidebar-menu';scroll.prepend(menuTitle);sidebar.append(mobileBar);mobileBar.append(more);shell.before(backdrop);page.prepend(mobileHeader);
 function updateMore(){
  more.setAttribute('aria-expanded',String(moreOpen));more.classList.toggle('active',moreOpen);
  const label=wording('More'),span=more.querySelector('.sidebar-label'),heading=menuTitle.querySelector('h2');if(span.textContent!==label)span.textContent=label;if(heading.textContent!==label)heading.textContent=label;more.title=label||'More';more.setAttribute('aria-label',more.title);const close=menuTitle.querySelector('button');close.title=wording('Close menu')||'Close menu';close.setAttribute('aria-label',close.title);
 }
 function renderMobileSheets(){shell.classList.toggle('mobile-more-open',mobile.matches&&moreOpen);backdrop.hidden=!(mobile.matches&&(moreOpen||selectedGroup));scroll.inert=mobile.matches&&!moreOpen;updateMore();}
 function closeMore(restoreFocus=false){moreOpen=false;renderMobileSheets();if(restoreFocus)more.focus();}
 function openMore(focus=false){closeSubmenu();moreOpen=true;renderMobileSheets();if(focus)logout?.focus();}
 more.onclick=event=>{if(moreOpen)closeMore();else openMore(event.detail===0);};menuTitle.querySelector('button').onclick=()=>closeMore(true);backdrop.onclick=()=>{const previous=selectedGroup;closeMore();closeSubmenu();(previous?groupLink(previous):more)?.focus();};
 function syncMobileLayout(){
  toolbarHovered=false;toolbarTouchOpen=false;closeSettingsMenu();closeMore();closeSubmenu();window.locationPickers?.closeAll();pointerInside=false;keyboardInside=false;sidebar.classList.toggle('top-navigation',!mobile.matches);
  if(mobile.matches){
   if(settingsOptions){settingsOptionsSlot.after(settingsOptions);settingsOptions.hidden=true;}settingsLink?.setAttribute('aria-controls','app-subsidebar');settingsLink?.removeAttribute('role');if(settingsLink)settingsSlot.after(settingsLink);for(const {nav} of navSlots)mobileBar.insertBefore(nav,more);if(admin)mobileBar.insertBefore(admin,more);if(logout&&footer)footer.before(logout);if(secondary)shell.insertBefore(secondary,page);
   const brand=scroll.querySelector('.sidebar-brand-row');if(brand){if(!brandSlot){brandSlot=document.createComment('top brand position');brand.before(brandSlot);}mobileHeader.append(brand);}
  }else{
   if(settingsOptions){settingsMenu.append(settingsOptions);settingsOptions.hidden=true;}settingsLink?.setAttribute('aria-controls','app-settings-menu');settingsLink?.setAttribute('role','button');if(admin)tabs.append(admin);for(const {nav,marker} of navSlots)marker.after(nav);if(logout)toolbarActions.append(logout);if(settingsLink)toolbarActions.prepend(settingsLink);if(secondary)sidebar.append(secondary);const brand=mobileHeader.querySelector('.sidebar-brand-row');if(brand&&brandSlot)brandSlot.after(brand);openSubmenu(currentGroup());
  }
  renderNavigation();renderMobileSheets();renderToolbar();
 }
 mobile.addEventListener('change',syncMobileLayout);
 function updateSubmenuTitle(){const link=groupLink(selectedGroup),title=document.getElementById('subsidebar-title');if(link&&title){title.dataset.localWording=link.dataset.sidebarName;const text=link.querySelector('.sidebar-label')?.textContent||'';if(title.textContent!==text)title.textContent=text;}const close=document.getElementById('subsidebar-close');if(close){close.title=wording('Close submenu')||'Close submenu';close.setAttribute('aria-label',close.title);}}
 function closeSubmenu(restoreFocus=false){const previous=selectedGroup;selectedGroup='';if(secondary)secondary.hidden=true;shell?.classList.remove('subsidebar-open');sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>{link.setAttribute('aria-expanded','false');delete link.dataset.submenuOpen;});renderMobileSheets();updateSettingsTrigger();if(restoreFocus){groupLink(previous)?.focus();}}
 function updatePageLinks(){const defaults={'/stock-count':'#new','/sales':'#entry','/admin':'#stock','/admin/accounts':'#accounts','/admin/settings':'#colours'},hash=location.hash||defaults[location.pathname]||'';for(const link of secondary?.querySelectorAll('a[href]')||[]){const url=new URL(link.href);if(url.pathname===location.pathname&&(url.pathname==='/reporting'||url.hash===hash))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}}
 function openSubmenu(group,focus=false){
  if(!secondary||(!isUserManager&&group==='admin'))return;
  closeSettingsMenu();const menu=secondary.querySelector('[data-subsidebar-group="'+group+'"]');if(!menu){closeSubmenu();return;}selectedGroup=group;if(mobile.matches)closeMore();
  secondary.querySelectorAll('[data-subsidebar-group]').forEach(nav=>nav.hidden=nav!==menu);secondary.hidden=false;shell?.classList.add('subsidebar-open');
  sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>{const active=link.dataset.sidebarGroup===group;link.setAttribute('aria-expanded',String(active));if(active)link.dataset.submenuOpen='true';else delete link.dataset.submenuOpen;});updateSubmenuTitle();updatePageLinks();renderMobileSheets();if(focus||mobile.matches)menu.querySelector('a:not([hidden])')?.focus();
 }
 sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();const group=link.dataset.sidebarGroup;if(group==='settings'&&!mobile.matches){if(settingsMenu.matches(':popover-open')||(event.detail>0&&settingsPointerOpen))closeSettingsMenu();else openSettingsMenu(event.detail===0);settingsPointerOpen=false;return;}openSubmenu(group,event.detail===0);if(selectedGroup!==group)return;
  const first=secondary.querySelector('[data-subsidebar-group="'+group+'"] a[href]:not([hidden])');if(first&&first.href!==location.href){if(mobile.matches)try{sessionStorage.setItem('souvlaki-navigation-group',group);}catch{}location.assign(first.href);}
 }));
 document.getElementById('subsidebar-close')?.addEventListener('click',()=>closeSubmenu(true));
 sidebar.querySelectorAll('.main-sidebar-nav a:not([data-sidebar-group])').forEach(link=>link.addEventListener('click',()=>{closeSettingsMenu();closeMore();closeSubmenu();}));
 document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.key!=='Escape'||document.querySelector('dialog[open], [popover]:popover-open:not(.app-edit-indicator)'))return;if(selectedGroup){event.preventDefault();closeSubmenu(true);}else if(moreOpen){event.preventDefault();closeMore(true);}});
 secondary?.addEventListener('click',event=>{if(mobile.matches&&event.target.closest('a'))closeSubmenu();});
 window.addEventListener('hashchange',()=>{updatePageLinks();if(!mobile.matches)openSubmenu(currentGroup());});
 document.getElementById('app-edit-toggle')?.addEventListener('click',()=>{closeSettingsMenu();if(mobile.matches)closeMore();});
 let pointerInside=false,keyboardInside=false,touchOpen=false;
 function updateToggle(){
  if(!toggle)return;const expanded=root.classList.contains('navigation-preview'),mode=expanded?'expanded':'hover',original=expanded?'Collapse navigation':'Expand navigation',text=wording(original);
  toggle.dataset.localWording=original;toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',text||original);toggle.title=text||original;toggle.querySelector('.sidebar-toggle-text').textContent=text;
  if(toggle.dataset.sidebarMode!==mode){toggle.dataset.sidebarMode=mode;toggle.querySelector('svg').innerHTML=expanded?'<path d="m6 14 6-6 6 6"/>':'<path d="m6 10 6 6 6-6"/>';}
 }
 function accessibleName(element,original){return element.querySelector('.sidebar-label,.submenu-label')?.textContent.trim()||wording(original)||original;}
 function updateNavigationLabels(){
  sidebar.querySelectorAll('[data-sidebar-name]').forEach(link=>{let name=accessibleName(link,link.dataset.sidebarName);if(['Cart','Ordering'].includes(link.dataset.sidebarName)){const count=document.getElementById('cart-badge')?.textContent||'0';name+=' · '+wording('{count} units',{count});}link.setAttribute('aria-label',name);link.title=name;});
  if(logout){const name=accessibleName(logout,'Sign out');logout.setAttribute('aria-label',name);logout.title=name;}
 }
 function renderNavigation(){const preview=!mobile.matches&&(pointerInside||keyboardInside||touchOpen);root.classList.toggle('navigation-compact',!preview);root.classList.toggle('navigation-preview',preview);updateToggle();}
 if(toggle)toggle.onclick=()=>{touchOpen=!root.classList.contains('navigation-preview');pointerInside=false;keyboardInside=false;renderNavigation();};
 sidebar.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&matchMedia('(hover:hover) and (pointer:fine)').matches){pointerInside=true;renderNavigation();}});
 sidebar.addEventListener('pointerleave',()=>{pointerInside=false;touchOpen=false;renderNavigation();});
 sidebar.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible')){keyboardInside=true;renderNavigation();}});
 sidebar.addEventListener('focusout',()=>queueMicrotask(()=>{keyboardInside=Boolean(sidebar.querySelector(':focus-visible'));renderNavigation();}));
 document.addEventListener('pointerdown',event=>{if(!sidebar.contains(event.target)){touchOpen=false;renderNavigation();}});
 window.addEventListener('interface-text-updated',()=>{updateToggle();updateNavigationLabels();updateSubmenuTitle();updateMore();updateSettingsTrigger();});
 new MutationObserver(()=>{updateNavigationLabels();updateSubmenuTitle();}).observe(sidebar,{childList:true,characterData:true,subtree:true});
 updateNavigationLabels();syncMobileLayout();
 (async()=>{
  try{
   const response=await fetch('/api/session',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});const session=await response.json();if(!session.csrf){location.href=companyLoginUrl();return;}
   document.querySelectorAll('.main-sidebar-nav a').forEach(link=>{if(link.dataset.sidebarGroup?link.dataset.sidebarGroup===currentGroup():new URL(link.href).pathname===location.pathname)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
   const brand=sidebar?.querySelector('.brand');
   if(session.locationName&&brand){
    let row=brand.closest('.sidebar-brand-row');if(!row){row=document.createElement('div');row.className='sidebar-brand-row';brand.before(row);row.append(brand);}
    const companyControl=document.createElement('div');companyControl.id='sidebar-company';companyControl.className='company-switcher company-logo-switcher';companyControl.dataset.editId='sidebar-company-'+location.pathname.replace(/[^a-z0-9]/gi,'_');
    const logoVisual=document.createElement('span');logoVisual.className='company-logo-visual';logoVisual.dataset.userText='';logoVisual.append(...brand.childNodes);brand.classList.add('company-logo-trigger');brand.append(logoVisual);
    const companyLabel=document.createElement('span');companyLabel.id='sidebar-company-name';companyLabel.className='location-name visually-hidden';companyLabel.dataset.userText='';companyLabel.textContent=session.companyName;
    const companyArrow=document.createElement('span');companyArrow.className='location-chevron company-logo-chevron';companyArrow.setAttribute('aria-hidden','true');companyArrow.textContent='⌄';
    const companySelect=document.createElement('select');companySelect.id='sidebar-company-select';companySelect.dataset.editId='sidebar-company-select-'+location.pathname.replace(/[^a-z0-9]/gi,'_');for(const company of session.companies||[]){const option=document.createElement('option');option.value=company.id;option.textContent=company.name;companySelect.append(option);}companySelect.value=session.companyId;companySelect.disabled=companySelect.options.length<2;companyArrow.hidden=companySelect.disabled;
    const companyStatus=document.createElement('p');companyStatus.className='location-switch-status company-switch-status';companyStatus.setAttribute('role','status');companyStatus.hidden=true;
    companySelect.onchange=async()=>{const next=companySelect.value;if(next===session.companyId)return;const before=new Event('before-location-switch',{cancelable:true});if(!window.dispatchEvent(before)){companySelect.value=session.companyId;companyStatus.hidden=false;companyStatus.textContent=wording('Wait for saving to finish before switching companies.');return;}companySelect.disabled=true;companyStatus.hidden=false;companyStatus.textContent=wording('Switching company…');
     try{const response=await fetch('/api/session/company',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({companyId:next})});const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to switch company.');const nextPage=new URL(location.href);if(nextPage.searchParams.has('company'))nextPage.searchParams.set('company',next);location.href=nextPage.href;}catch(error){companySelect.value=session.companyId;companySelect.disabled=false;companyStatus.textContent=error.message;}
    };
    brand.before(companyControl);companyControl.append(brand,companySelect);row.append(companyStatus);
    const initials=name=>name.trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toUpperCase();
    function syncCompanyLogo(){const name=companySelect.selectedOptions[0]?.textContent||session.companyName,image=logoVisual.querySelector('img');companyControl.dataset.hasLogo=String(Boolean(image));if(image)image.alt=name;else{const full=document.createElement('span'),short=document.createElement('span');full.className='company-logo-name';full.textContent=name;short.className='company-logo-initials';short.setAttribute('aria-hidden','true');short.textContent=initials(name);logoVisual.replaceChildren(full,short);}}
    function renderCompanyLogo(option,entry){option.classList.add('company-logo-option');option.setAttribute('aria-label',entry.name);const visual=document.createElement('span'),image=document.createElement('img'),fallback=document.createElement('span');visual.className='company-option-visual';visual.dataset.userText='';image.src='/sidebar-logo?company='+encodeURIComponent(entry.value);image.alt=entry.name;image.decoding='async';image.className='company-option-logo';fallback.className='company-option-initials';fallback.textContent=initials(entry.name);fallback.hidden=true;image.onerror=()=>{image.hidden=true;fallback.hidden=false;};visual.append(image,fallback);option.prepend(visual);}
    const companyPicker=window.locationPickers.enhance(companySelect,{host:companyControl,trigger:brand,displayLabel:companyLabel,contents:[logoVisual,companyLabel,companyArrow],label:'Switch company',searchLabel:'Search companies',emptySearch:'No companies match your search.',emptyLabel:'No companies available.',optionPart:'company-option',company:true,holdWhileBusy:true,renderOption:renderCompanyLogo});companyPicker.menu.classList.add('company-logo-menu');syncCompanyLogo();
    window.addEventListener('app-logo-updated',()=>{syncCompanyLogo();companyPicker.sync();});window.addEventListener('company-options-updated',syncCompanyLogo);
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
   isAdmin=session.role==='admin';isUserManager=['admin','franchisee'].includes(session.role);document.querySelectorAll('#app-sidebar [data-head-office-only],#app-subsidebar [data-head-office-only]').forEach(element=>element.hidden=!isAdmin);document.querySelectorAll('[data-user-manager-only]').forEach(element=>element.hidden=!isUserManager);if(admin)admin.hidden=!isUserManager;
   const editControls=document.getElementById('admin-edit-controls');if(editControls)editControls.hidden=session.role!=='admin';
   if(!mobile.matches)openSubmenu(currentGroup());else try{const pending=sessionStorage.getItem('souvlaki-navigation-group');sessionStorage.removeItem('souvlaki-navigation-group');if(pending&&pending===currentGroup())openSubmenu(pending);}catch{}renderNavigation();renderMobileSheets();
   const badge=document.getElementById('cart-badge'),cartKey='souvlaki-cart-'+(session.id||session.username)+(session.locationId?'-'+session.locationId:'');function refreshBadge(){if(!badge)return;try{const cart=JSON.parse(localStorage.getItem(cartKey)||(session.canMigrateBrowserData?localStorage.getItem('souvlaki-cart-'+(session.id||session.username)):null)||'{}');badge.textContent=Object.values(cart).filter(q=>Number.isInteger(q)&&q>0&&q<=999).reduce((sum,q)=>sum+q,0);}catch{badge.textContent='0';}}refreshBadge();window.addEventListener('storage',event=>{if(event.key===cartKey)refreshBadge();});window.addEventListener('cart-updated',event=>{if(event.detail?.key===cartKey)refreshBadge();});
   updateNavigationLabels();
  }catch{}
 })();
})();
