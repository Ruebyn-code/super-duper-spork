(()=>{
 const sidebar=document.getElementById('app-sidebar'),toggle=document.getElementById('sidebar-toggle'),secondary=document.getElementById('app-subsidebar'),shell=sidebar?.closest('.app-shell');
 if(!sidebar)return;window.groupAppNavigation?.(sidebar,secondary);
 const root=document.documentElement,scroll=sidebar.querySelector('.sidebar-scroll'),footer=sidebar.querySelector('.sidebar-footer'),admin=document.getElementById('admin-link');
 const wording=(text,values={})=>{
  if(typeof interfaceLabel==='function')return interfaceLabel(text,values);
  const overrides=window.appBootstrap?.interfaceText||{};return String(Object.hasOwn(overrides,text)?overrides[text]??'':text).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 };
 let selectedGroup='',isAdmin=false,isUserManager=false,session;
 const mobile=matchMedia('(max-width:720px), (max-width:1100px) and (max-height:500px) and (pointer:coarse)'),page=shell.querySelector('.app-page');
 const currentGroup=()=>({'/':'ordering','/order-history':'ordering','/cart':'ordering','/stock-count':'ordering','/stock-transfers':'ordering','/sales':'sales','/admin':'ordering','/admin/accounts':'admin','/admin/settings':'settings'}[location.pathname]||'');
 const groupLink=group=>sidebar.querySelector('[data-sidebar-group="'+group+'"]');
 const groupFocus=group=>group==='settings'?document.getElementById('toolbar-toggle'):mobile.matches?more:groupLink(group);
 // Keep the original elements and edit identities when arranging the common header.
 root.classList.remove('sidebar-collapsed','sidebar-hover-expanded');sidebar.classList.add('top-navigation');
 const tabs=document.createElement('nav');tabs.id='top-navigation-tabs';tabs.className='top-navigation-tabs';tabs.setAttribute('aria-label','Main navigation');
 const navs=[...scroll.querySelectorAll(':scope > .main-sidebar-nav')];navs[0]?.before(tabs);tabs.append(...navs);
 if(admin)tabs.append(admin);
 const logout=document.getElementById('logout');if(footer)scroll.append(footer);if(secondary)sidebar.append(secondary);
 const controls=window.createAppControls({footer,toggle,wording,beforeOpen:()=>{window.locationPickers?.closeAll();closeMore();if(mobile.matches||selectedGroup==='ordering')closeSubmenu();}});

 // Reuse the same links on phones so cart badges, roles and App edit identities stay intact.
 const mobileBar=document.createElement('nav');mobileBar.id='mobile-tabbar';mobileBar.className='mobile-tabbar';mobileBar.setAttribute('aria-label','Main navigation');
 const more=document.createElement('button');more.id='mobile-more';more.type='button';more.className='mobile-nav-tab';more.dataset.layoutUi='';more.setAttribute('data-copy-editor','');
 more.innerHTML='<svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><path d="M7 8h10M7 12h10M7 16h10"/></g></svg><span class="sidebar-label">More</span>';
 const backdrop=document.createElement('div');backdrop.className='mobile-nav-backdrop';backdrop.hidden=true;backdrop.setAttribute('aria-hidden','true');backdrop.setAttribute('data-copy-editor','');
 const mobileHeader=document.createElement('div');mobileHeader.className='mobile-brand-header';
 const moreMenu=document.createElement('nav');moreMenu.id='mobile-navigation-menu';moreMenu.className='mobile-navigation-menu';moreMenu.setAttribute('popover','auto');moreMenu.dataset.layoutUi='';
 const moreHeading=document.createElement('div');moreHeading.className='mobile-menu-heading';const moreTitle=document.createElement('h2');moreTitle.dataset.localWording='More';moreTitle.textContent='More';
 const moreClose=document.createElement('button');moreClose.type='button';moreClose.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';moreHeading.append(moreTitle,moreClose);moreMenu.append(moreHeading);
 const navSlots=navs.map(nav=>{const marker=document.createComment('top navigation position');nav.before(marker);return {nav,marker};});
 const pinnedSlots=['/home','/rostering','/communications'].map(path=>{const link=sidebar.querySelector('.main-sidebar-nav a[href="'+path+'"]');if(!link)return null;const marker=document.createComment('main link position');link.before(marker);return {link,marker};}).filter(Boolean);
 // Phones open active checklists directly; management and history stay in More.
 const desktopOps=sidebar.querySelector('.main-sidebar-nav a[href="/ops-management"]');
 function checklistLink(view,title,permission){
  const link=document.createElement('a');link.href='/ops-management#'+view;link.dataset.mobileChecklistView=view;link.dataset.sidebarName=title;link.dataset.permission=permission;link.dataset.editId='navigation-mobile-checklists-'+view;
  const icon=desktopOps?.querySelector('svg')?.cloneNode(true);if(icon){for(const node of [icon,...icon.querySelectorAll('[data-edit-id]')])node.removeAttribute('data-edit-id');if(view==='history')icon.innerHTML='<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7"/><g class="icon-detail"><path d="M12 7v5l3 2"/></g>';link.append(icon);}
  const label=document.createElement('span');label.className='sidebar-label';label.dataset.interfaceLabel=title;label.textContent=title;link.append(label);return link;
 }
 const checklistTab=desktopOps?checklistLink('checklists','Checklists','ops.view'):null,checklistMore=document.createElement('nav');checklistMore.className='main-sidebar-nav mobile-checklist-options';checklistMore.dataset.permission='ops.view';checklistMore.setAttribute('aria-label','Checklist options');
 if(desktopOps)checklistMore.append(checklistLink('templates','Checklist builder','ops.manage'),checklistLink('history','History','ops.view'));
 function currentLink(link){if(link===desktopOps&&mobile.matches)return false;if(link.dataset.mobileChecklistView)return location.pathname==='/ops-management'&&(location.hash||'#checklists')==='#'+link.dataset.mobileChecklistView;return link.dataset.sidebarGroup?link.dataset.sidebarGroup===currentGroup():new URL(link.href).pathname===location.pathname;}
 const footerSlot=document.createComment('account control position');footer?.before(footerSlot);let brandSlot,morePointerWasOpen=false;
 scroll.id='app-sidebar-menu';sidebar.append(mobileBar,moreMenu);mobileBar.append(more);if(checklistTab)mobileBar.insertBefore(checklistTab,more);if(desktopOps)moreMenu.append(checklistMore);shell.before(backdrop);page.prepend(mobileHeader);
 function updateMore(){const label=wording('More'),span=more.querySelector('.sidebar-label'),opened=moreMenu.matches(':popover-open');if(span.textContent!==label)span.textContent=label;moreTitle.textContent=label;more.title=label||'More';more.setAttribute('aria-label',more.title);more.setAttribute('aria-haspopup','true');more.setAttribute('aria-controls',moreMenu.id);more.setAttribute('aria-expanded',String(opened));moreMenu.setAttribute('aria-label',label||'More');moreClose.title=wording('Close menu');moreClose.setAttribute('aria-label',moreClose.title);const active=Boolean(moreMenu.querySelector('a[aria-current=page],a[data-submenu-open=true]'));more.classList.toggle('active',opened||active);if(active)more.setAttribute('aria-current','true');else more.removeAttribute('aria-current');}
 function closeMore(restoreFocus=false){if(moreMenu.matches(':popover-open'))moreMenu.hidePopover();updateMore();if(restoreFocus)more.focus({preventScroll:true});}
 function openMore(focus=false){controls.close();closeSubmenu();window.locationPickers?.closeAll();moreMenu.showPopover({source:more});updateMore();if(focus)[...moreMenu.querySelectorAll('a')].find(link=>link.getClientRects().length)?.focus();}
 more.onpointerdown=()=>{morePointerWasOpen=moreMenu.matches(':popover-open');};more.onclick=event=>{if(moreMenu.matches(':popover-open')||(event.detail>0&&morePointerWasOpen))closeMore();else openMore(event.detail===0);morePointerWasOpen=false;};
 more.onkeydown=event=>{if(event.key==='ArrowDown'){event.preventDefault();openMore(true);}};moreClose.onclick=()=>closeMore(true);moreMenu.addEventListener('toggle',updateMore);moreMenu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeMore(true);}});
 function renderMobileSheets(){backdrop.hidden=!(mobile.matches&&selectedGroup);scroll.inert=mobile.matches;updateMore();}
 backdrop.onclick=()=>{const previous=selectedGroup;closeSubmenu();groupFocus(previous)?.focus();};
 function syncMobileLayout(){
  controls.sync();closeMore();closeSubmenu();window.locationPickers?.closeAll();pointerInside=false;keyboardInside=false;sidebar.classList.toggle('top-navigation',!mobile.matches);
  if(mobile.matches){
   for(const {nav} of navSlots)moreMenu.append(nav);if(desktopOps)moreMenu.append(checklistMore);if(admin)moreMenu.append(admin);for(const {link} of pinnedSlots)mobileBar.insertBefore(link,more);if(checklistTab)mobileBar.insertBefore(checklistTab,more);if(secondary)shell.insertBefore(secondary,page);
   const brand=scroll.querySelector('.sidebar-brand-row');if(brand){if(!brandSlot){brandSlot=document.createComment('top brand position');brand.before(brandSlot);}mobileHeader.append(brand);}
   if(footer)mobileHeader.append(footer);
  }else{
   for(const {link,marker} of pinnedSlots)marker.after(link);if(admin)tabs.append(admin);for(const {nav,marker} of navSlots)marker.after(nav);if(footer)footerSlot.after(footer);if(secondary)sidebar.append(secondary);const brand=mobileHeader.querySelector('.sidebar-brand-row');if(brand&&brandSlot)brandSlot.after(brand);restorePageSubmenu();
  }
  if(desktopOps)desktopOps.hidden=mobile.matches;renderNavigation();renderMobileSheets();
 }
 mobile.addEventListener('change',syncMobileLayout);
 function updateSubmenuTitle(){const link=groupLink(selectedGroup),title=document.getElementById('subsidebar-title');if(title&&(link||selectedGroup==='settings')){title.dataset.localWording=link?.dataset.sidebarName||'App settings';const text=selectedGroup==='settings'?wording('App settings'):link.querySelector('.sidebar-label')?.textContent||'';if(title.textContent!==text)title.textContent=text;}const close=document.getElementById('subsidebar-close');if(close){close.title=wording('Close submenu')||'Close submenu';close.setAttribute('aria-label',close.title);}}
 function closeSubmenu(restoreFocus=false){const previous=selectedGroup;selectedGroup='';if(secondary){secondary.hidden=true;delete secondary.dataset.activeGroup;}shell?.classList.remove('subsidebar-open');sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>{link.setAttribute('aria-expanded','false');delete link.dataset.submenuOpen;});renderMobileSheets();if(restoreFocus){groupFocus(previous)?.focus();}}
 // Ordering opens on demand so every ordering page has Home's single-row header.
 function restorePageSubmenu(){if(currentGroup()==='ordering')closeSubmenu();else openSubmenu(currentGroup(),false,true);updatePageLinks();}
 function updatePageLinks(){const defaults={'/stock-count':'#new','/sales':'#entry','/admin':'#stock','/admin/accounts':'#accounts','/admin/settings':'#colours'},hash=location.hash||defaults[location.pathname]||'';for(const link of secondary?.querySelectorAll('a[href]')||[]){const url=new URL(link.href);if(url.pathname===location.pathname&&(url.pathname==='/reporting'||url.hash===hash))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}}
 function openSubmenu(group,focus=false,preserveControls=false){
  if(!secondary||(!isUserManager&&group==='admin')||(!isAdmin&&group==='settings'))return;
  if(!preserveControls){controls.close();closeMore();}const menu=secondary.querySelector('[data-subsidebar-group="'+group+'"]');if(!menu){closeSubmenu();return;}selectedGroup=group;
  secondary.querySelectorAll('[data-subsidebar-group]').forEach(nav=>nav.hidden=nav!==menu);secondary.dataset.activeGroup=group;secondary.hidden=false;shell?.classList.add('subsidebar-open');
  sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>{const active=link.dataset.sidebarGroup===group;link.setAttribute('aria-expanded',String(active));if(active)link.dataset.submenuOpen='true';else delete link.dataset.submenuOpen;});updateSubmenuTitle();updatePageLinks();renderMobileSheets();if(focus||mobile.matches)[...menu.querySelectorAll('a')].find(link=>!link.closest('.access-denied,[hidden]'))?.focus();
 }
 sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();const group=link.dataset.sidebarGroup;if(group==='ordering'&&selectedGroup===group){closeSubmenu(true);return;}openSubmenu(group,event.detail===0);if(selectedGroup!==group||group==='ordering')return;
  const first=[...secondary.querySelectorAll('[data-subsidebar-group="'+group+'"] a[href]')].find(link=>!link.closest('.access-denied,[hidden]'));if(first&&first.href!==location.href){if(mobile.matches)try{sessionStorage.setItem('souvlaki-navigation-group',group);}catch{}if(window.appShell)appShell.navigate(first.href);else location.assign(first.href);}
 }));
 groupLink('ordering')?.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();openSubmenu('ordering',true);}});
 document.getElementById('subsidebar-close')?.addEventListener('click',()=>closeSubmenu(true));
 sidebar.querySelectorAll('.main-sidebar-nav a:not([data-sidebar-group]),.mobile-tabbar a:not([data-sidebar-group])').forEach(link=>link.addEventListener('click',()=>{controls.close();closeMore();closeSubmenu();}));
 document.addEventListener('keydown',event=>{if(event.defaultPrevented||event.key!=='Escape'||document.querySelector('dialog[open], [popover]:popover-open:not(.app-edit-indicator)'))return;if(selectedGroup){event.preventDefault();closeSubmenu(true);}});
 secondary?.addEventListener('click',event=>{if((mobile.matches||selectedGroup==='ordering')&&event.target.closest('a'))closeSubmenu();});
 window.addEventListener('hashchange',()=>{updatePageLinks();if(!mobile.matches)restorePageSubmenu();});
 function dismissOrdering(event){if(!mobile.matches&&selectedGroup==='ordering'&&!secondary.contains(event.target)&&!groupLink('ordering')?.contains(event.target))closeSubmenu();}
 document.addEventListener('pointerdown',dismissOrdering);
 document.addEventListener('focusin',dismissOrdering);
 document.getElementById('app-edit-toggle')?.addEventListener('click',()=>controls.close());
 let pointerInside=false,keyboardInside=false,touchOpen=false;
 function updateToggle(){
  if(!toggle)return;const expanded=root.classList.contains('navigation-preview'),mode=expanded?'expanded':'hover',original=expanded?'Collapse navigation':'Expand navigation',text=wording(original);
  toggle.dataset.localWording=original;toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',text||original);toggle.title=text||original;toggle.querySelector('.sidebar-toggle-text').textContent=text;
  if(toggle.dataset.sidebarMode!==mode){toggle.dataset.sidebarMode=mode;toggle.querySelector('svg').innerHTML=expanded?'<path d="m6 14 6-6 6 6"/>':'<path d="m6 10 6 6 6-6"/>';}
 }
 function accessibleName(element,original){const name=element.querySelector('.sidebar-label,.submenu-label')?.textContent.trim()||wording(original)||original;return element.classList.contains('roster-navigation-link')?name+' · '+wording('Beta'):name;}
 function updateNavigationLabels(){
  sidebar.querySelectorAll('[data-sidebar-name]').forEach(link=>{let name=accessibleName(link,link.dataset.sidebarName);if(['Cart','Ordering'].includes(link.dataset.sidebarName)){const count=document.getElementById('cart-badge')?.textContent||'0';name+=' · '+wording('{count} units',{count});}if(link.dataset.sidebarName==='Comms'&&window.appMessageBadge?.count){name+=' · '+wording(appMessageBadge.count===1?'{count} unread message':'{count} unread messages',{count:appMessageBadge.count});}link.setAttribute('aria-label',name);link.title=name;});
  if(logout){const name=accessibleName(logout,'Sign out');logout.setAttribute('aria-label',name);logout.title=name;}
 }
 function renderNavigation(){const preview=!mobile.matches&&(pointerInside||keyboardInside||touchOpen);root.classList.toggle('navigation-compact',!preview);root.classList.toggle('navigation-preview',preview);updateToggle();}
 if(toggle)toggle.onclick=()=>{touchOpen=!root.classList.contains('navigation-preview');pointerInside=false;keyboardInside=false;renderNavigation();};
 sidebar.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&matchMedia('(hover:hover) and (pointer:fine)').matches){pointerInside=true;renderNavigation();}});
 sidebar.addEventListener('pointerleave',()=>{pointerInside=false;touchOpen=false;renderNavigation();});
 sidebar.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible')){keyboardInside=true;renderNavigation();}});
 sidebar.addEventListener('focusout',()=>queueMicrotask(()=>{keyboardInside=Boolean(sidebar.querySelector(':focus-visible'));renderNavigation();}));
 document.addEventListener('pointerdown',event=>{if(!sidebar.contains(event.target)){touchOpen=false;renderNavigation();}});
 window.addEventListener('interface-text-updated',()=>{updateToggle();updateNavigationLabels();updateSubmenuTitle();updateMore();controls.refresh();});
 new MutationObserver(()=>{updateNavigationLabels();updateSubmenuTitle();}).observe(sidebar,{childList:true,characterData:true,subtree:true});
 updateNavigationLabels();syncMobileLayout();
 window.appNavigation={dismissTransient(){window.appSearch?.close();controls.close();closeMore();if(selectedGroup==='ordering')closeSubmenu();window.locationPickers?.closeAll();},refresh(value){
  if(value){
   session=value;let changed=false;
   for(const [id,entries,selected] of [['sidebar-company-select',session.companies,session.companyId],['sidebar-location-select',session.locations,session.locationId]]){
    const select=document.getElementById(id);if(!select||!entries)continue;
    if(JSON.stringify([...select.options].map(option=>[option.value,option.textContent,option.dataset.setupPending==='true']))!==JSON.stringify(entries.map(entry=>[entry.id,entry.name,Boolean(entry.setupPending)]))){
     select.replaceChildren(...entries.map(entry=>{const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;option.dataset.setupPending=String(Boolean(entry.setupPending));return option;}));select.value=selected;select.disabled=entries.length<2;window.locationPickers?.refresh(select);changed=true;
     const arrow=select.closest('.location-switcher,.company-switcher')?.querySelector('.location-chevron');if(arrow)arrow.hidden=select.disabled;
    }
   }
   const locationName=document.getElementById('sidebar-location-name');if(locationName&&locationName.textContent!==session.locationName)locationName.textContent=session.locationName;
   if(window.appCompanyName!==session.companyName){window.appCompanyName=session.companyName;changed=true;}
   if(changed)window.dispatchEvent(new Event('company-options-updated'));
  }
  if(session){appAccess.apply(session);isAdmin=appAccess.can('appearance.manage');isUserManager=appAccess.any(appAccess.admin);if(admin)admin.hidden=!isUserManager;controls.setSession(session);}
  sidebar.querySelectorAll('.main-sidebar-nav a,.mobile-tabbar a').forEach(link=>{if(currentLink(link))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  if(mobile.matches){closeMore();closeSubmenu();}else restorePageSubmenu();
  updateNavigationLabels();renderMobileSheets();
 }};
 (async()=>{
  try{
   session=await appAccess.initialSession();if(!session.csrf){location.href=companyLoginUrl();return;}
   sidebar.querySelectorAll('.main-sidebar-nav a,.mobile-tabbar a').forEach(link=>{if(currentLink(link))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
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
    const select=document.createElement('select');select.id='sidebar-location-select';select.setAttribute('aria-label',wording('Switch location'));for(const entry of session.locations||[{id:session.locationId,name:session.locationName}]){const option=document.createElement('option');option.value=entry.id;option.textContent=entry.name;option.dataset.setupPending=String(Boolean(entry.setupPending));select.append(option);}select.value=session.locationId;select.disabled=select.options.length<2;arrow.hidden=select.disabled;
    const status=document.createElement('p');status.className='location-switch-status';status.setAttribute('role','status');status.hidden=true;
    select.onchange=async()=>{const next=select.value;if(next===session.locationId)return;
     const before=new Event('before-location-switch',{cancelable:true});if(!window.dispatchEvent(before)){select.value=session.locationId;status.hidden=false;status.textContent=wording('Wait for saving to finish before switching locations.');return;}
     select.disabled=true;status.hidden=false;status.textContent=wording('Switching location…');
     try{const response=await fetch('/api/session/location',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({locationId:next})});const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to switch location.');location.reload();}
     catch(error){select.value=session.locationId;select.disabled=false;status.textContent=error.message;}
    };
    control.append(label,arrow,select);row.append(control,status);window.locationPickers.enhance(select,{host:control,displayLabel:label,contents:[control.querySelector('.location-pin'),label,arrow],label:'Switch location',holdWhileBusy:true});syncMobileLayout();
   }
   appAccess.apply(session);isAdmin=appAccess.can('appearance.manage');isUserManager=appAccess.any(appAccess.admin);if(admin)admin.hidden=!isUserManager;
   controls.setSession(session);
   if(!mobile.matches)restorePageSubmenu();else try{const pending=sessionStorage.getItem('souvlaki-navigation-group');sessionStorage.removeItem('souvlaki-navigation-group');if(pending&&pending===currentGroup())openSubmenu(pending);}catch{}renderNavigation();renderMobileSheets();
   const badge=document.getElementById('cart-badge'),cartKey='souvlaki-cart-'+(session.id||session.username)+(session.locationId?'-'+session.locationId:'');function refreshBadge(){if(!badge)return;try{const cart=JSON.parse(localStorage.getItem(cartKey)||(session.canMigrateBrowserData?localStorage.getItem('souvlaki-cart-'+(session.id||session.username)):null)||'{}');badge.textContent=Object.values(cart).filter(q=>Number.isInteger(q)&&q>0&&q<=999).reduce((sum,q)=>sum+q,0);}catch{badge.textContent='0';}}refreshBadge();window.addEventListener('storage',event=>{if(event.key===cartKey)refreshBadge();});window.addEventListener('cart-updated',event=>{if(event.detail?.key===cartKey)refreshBadge();});
   updateNavigationLabels();
  }catch{}
 })();
})();
