(()=>{
 const sidebar=document.getElementById('app-sidebar'),toggle=document.getElementById('sidebar-toggle'),secondary=document.getElementById('app-subsidebar'),shell=sidebar?.closest('.app-shell');
 if(!sidebar)return;
 const root=document.documentElement,scroll=sidebar.querySelector('.sidebar-scroll'),footer=sidebar.querySelector('.sidebar-footer'),admin=document.getElementById('admin-link');
 const wording=(text,values={})=>{
  if(typeof interfaceLabel==='function')return interfaceLabel(text,values);
  const overrides=window.appBootstrap?.interfaceText||{};return String(Object.hasOwn(overrides,text)?overrides[text]??'':text).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 };
 let selectedGroup='',isAdmin=false,isUserManager=false;
 const currentGroup=()=>({'/stock-count':'count','/sales':'sales','/admin':'stock','/admin/accounts':'accounts','/admin/settings':'settings'}[location.pathname]||'');
 const groupLink=group=>sidebar.querySelector('[data-sidebar-group="'+group+'"]');
 // Keep the original elements and edit identities when arranging the common header.
 root.classList.remove('sidebar-collapsed','sidebar-hover-expanded');sidebar.classList.add('top-navigation');
 const tabs=document.createElement('nav');tabs.id='top-navigation-tabs';tabs.className='top-navigation-tabs';tabs.setAttribute('aria-label','Main navigation');
 const navs=[...scroll.querySelectorAll(':scope > .main-sidebar-nav')];navs[0]?.before(tabs);tabs.append(...navs);
 const adminButton=document.createElement('button');adminButton.id='top-admin-toggle';adminButton.type='button';adminButton.dataset.editId='top-admin-toggle-'+location.pathname.replace(/[^a-z0-9]/gi,'_');adminButton.hidden=true;adminButton.setAttribute('aria-controls','admin-link');adminButton.setAttribute('aria-expanded','false');
 adminButton.innerHTML='<svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><path d="M7 8h10M7 12h10M7 16h10"/></g></svg><span class="sidebar-label"></span><span class="top-menu-chevron" aria-hidden="true">⌄</span>';const adminHeading=admin?.querySelector('h2'),adminLabel=adminButton.querySelector('.sidebar-label');if(adminHeading){for(const attribute of adminHeading.attributes)adminLabel.setAttribute(attribute.name,attribute.value);adminLabel.classList.add('sidebar-label');adminLabel.append(...adminHeading.childNodes);adminHeading.remove();}adminLabel.dataset.appTemplate='Administration';tabs.append(adminButton);
 if(admin){admin.hidden=false;admin.setAttribute('popover','auto');admin.setAttribute('aria-label',wording('Administration'));admin.setAttribute('role','navigation');}
 const logout=document.getElementById('logout');if(logout)footer.append(logout);if(secondary)sidebar.append(secondary);
 function updateAdmin(){const label=adminButton.querySelector('.sidebar-label').textContent;adminButton.title=label;adminButton.setAttribute('aria-label',label||'Admin');admin?.setAttribute('aria-label',label||'Admin');adminButton.classList.toggle('active',Boolean(admin?.matches(':popover-open'))||['stock','accounts','settings'].includes(currentGroup())||location.pathname==='/reporting');}
 function positionAdmin(){if(!admin?.matches(':popover-open'))return;const box=adminButton.getBoundingClientRect(),viewport=window.visualViewport,edge=12,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;const menuWidth=Math.min(300,width-edge*2),y=Math.min(box.bottom+8,top+height-100);admin.style.width=menuWidth+'px';admin.style.left=Math.max(left+edge,Math.min(box.right-menuWidth,left+width-menuWidth-edge))+'px';admin.style.top=y+'px';admin.style.maxHeight=Math.max(80,top+height-y-edge)+'px';}
 function closeAdmin(restoreFocus=false){if(admin?.matches(':popover-open'))admin.hidePopover();if(restoreFocus)adminButton.focus();}
 adminButton.onclick=()=>{if(admin.matches(':popover-open'))closeAdmin();else{admin.showPopover();positionAdmin();}};
 admin?.addEventListener('toggle',()=>{adminButton.setAttribute('aria-expanded',String(admin.matches(':popover-open')));updateAdmin();});
 adminButton.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();admin.showPopover();positionAdmin();admin.querySelector('a:not([hidden])')?.focus();}});
 admin?.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeAdmin(true);}});
 window.addEventListener('resize',positionAdmin);window.addEventListener('scroll',positionAdmin,{passive:true});window.visualViewport?.addEventListener('resize',positionAdmin);
 function updateSubmenuTitle(){const link=groupLink(selectedGroup),title=document.getElementById('subsidebar-title');if(link&&title){title.dataset.localWording=link.dataset.sidebarName;const text=link.querySelector('.sidebar-label')?.textContent||'';if(title.textContent!==text)title.textContent=text;}const close=document.getElementById('subsidebar-close');if(close){close.title=wording('Close submenu')||'Close submenu';close.setAttribute('aria-label',close.title);}}
 function closeSubmenu(restoreFocus=false){const previous=selectedGroup;selectedGroup='';if(secondary)secondary.hidden=true;shell?.classList.remove('subsidebar-open');sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>{link.setAttribute('aria-expanded','false');delete link.dataset.submenuOpen;});if(restoreFocus){if(['stock','accounts','settings'].includes(previous))adminButton.focus();else groupLink(previous)?.focus();}}
 function openSubmenu(group,focus=false){
  if(!secondary||(!isAdmin&&['stock','settings'].includes(group))||(!isUserManager&&group==='accounts'))return;
  const menu=secondary.querySelector('[data-subsidebar-group="'+group+'"]');if(!menu){closeSubmenu();return;}selectedGroup=group;closeAdmin();
  secondary.querySelectorAll('[data-subsidebar-group]').forEach(nav=>nav.hidden=nav!==menu);secondary.hidden=false;shell?.classList.add('subsidebar-open');
  sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>{const active=link.dataset.sidebarGroup===group;link.setAttribute('aria-expanded',String(active));if(active)link.dataset.submenuOpen='true';else delete link.dataset.submenuOpen;});updateSubmenuTitle();if(focus)menu.querySelector('a:not([hidden])')?.focus();
 }
 sidebar.querySelectorAll('[data-sidebar-group]').forEach(link=>link.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();const group=link.dataset.sidebarGroup;openSubmenu(group,event.detail===0);if(selectedGroup!==group)return;
  const first=secondary.querySelector('[data-subsidebar-group="'+group+'"] a[href]:not([hidden])');if(first&&first.href!==location.href)location.assign(first.href);
 }));
 document.getElementById('subsidebar-close')?.addEventListener('click',()=>closeSubmenu(true));
 sidebar.querySelectorAll('.main-sidebar-nav a:not([data-sidebar-group])').forEach(link=>link.addEventListener('click',()=>{closeAdmin();closeSubmenu();}));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selectedGroup&&!document.querySelector('dialog[open], [popover]:popover-open:not(.app-edit-indicator)')){event.preventDefault();closeSubmenu(true);}});
 window.addEventListener('hashchange',()=>openSubmenu(currentGroup()));
 document.getElementById('app-edit-toggle')?.addEventListener('click',()=>closeAdmin());
 const preference=companyPreferenceKey('souvlaki-top-navigation-compact'),hoverPreference=companyPreferenceKey('souvlaki-top-navigation-hover');
 let collapsed=false,hoverEnabled=false,pointerInside=false,keyboardInside=false;
 try{collapsed=localStorage.getItem(preference)==='true';hoverEnabled=localStorage.getItem(hoverPreference)==='true';}catch{}
 function updateToggle(){
  if(!toggle)return;const mode=!collapsed?'expanded':hoverEnabled?'hover':'collapsed',original=mode==='expanded'?'Collapse sidebar':mode==='collapsed'?'Enable hover expansion':'Keep sidebar expanded',text=wording(original);
  toggle.dataset.localWording=original;toggle.setAttribute('aria-expanded',String(!collapsed||root.classList.contains('navigation-preview')));toggle.setAttribute('aria-label',text||original);toggle.title=text||original;toggle.querySelector('.sidebar-toggle-text').textContent=text;
  if(toggle.dataset.sidebarMode!==mode){toggle.dataset.sidebarMode=mode;toggle.querySelector('svg').innerHTML=mode==='expanded'?'<path d="m6 14 6-6 6 6"/>':mode==='collapsed'?'<path d="m6 10 6 6 6-6"/>':'<path d="M9 3h6M10 3v5l-3 4v2h10v-2l-3-4V3M12 14v7"/>';}
 }
 function accessibleName(element,original){return element.querySelector('.sidebar-label')?.textContent.trim()||wording(original)||original;}
 function updateNavigationLabels(){
  sidebar.querySelectorAll('[data-sidebar-name]').forEach(link=>{let name=accessibleName(link,link.dataset.sidebarName);if(link.dataset.sidebarName==='Cart'){const count=document.getElementById('cart-badge')?.textContent||'0';name+=' · '+wording('{count} units',{count});}link.setAttribute('aria-label',name);link.title=name;});
  if(logout){const name=accessibleName(logout,'Sign out');logout.setAttribute('aria-label',name);logout.title=name;}
 }
 function renderNavigation(){const preview=collapsed&&hoverEnabled&&(pointerInside||keyboardInside);root.classList.toggle('navigation-compact',collapsed&&!preview);root.classList.toggle('navigation-preview',preview);updateToggle();}
 function setMode(mode){collapsed=mode!=='expanded';hoverEnabled=mode==='hover';pointerInside=false;keyboardInside=false;renderNavigation();try{localStorage.setItem(preference,String(collapsed));localStorage.setItem(hoverPreference,String(hoverEnabled));}catch{}}
 if(toggle)toggle.onclick=()=>setMode(!collapsed?'collapsed':!hoverEnabled?'hover':'expanded');
 sidebar.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&matchMedia('(hover:hover) and (pointer:fine)').matches){pointerInside=true;renderNavigation();}});
 sidebar.addEventListener('pointerleave',()=>{pointerInside=false;renderNavigation();});
 sidebar.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible')){keyboardInside=true;renderNavigation();}});
 sidebar.addEventListener('focusout',()=>queueMicrotask(()=>{keyboardInside=Boolean(sidebar.querySelector(':focus-visible'));renderNavigation();}));
 window.addEventListener('storage',event=>{if(event.key!==preference&&event.key!==hoverPreference&&event.key!==null)return;try{collapsed=localStorage.getItem(preference)==='true';hoverEnabled=localStorage.getItem(hoverPreference)==='true';}catch{}renderNavigation();});
 window.addEventListener('interface-text-updated',()=>{updateToggle();updateNavigationLabels();updateSubmenuTitle();updateAdmin();});
 new MutationObserver(()=>{updateNavigationLabels();updateSubmenuTitle();updateAdmin();}).observe(scroll,{childList:true,characterData:true,subtree:true});
 updateNavigationLabels();updateAdmin();renderNavigation();
 (async()=>{
  try{
   const response=await fetch('/api/session',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});const session=await response.json();if(!session.csrf){location.href=companyLoginUrl();return;}
   document.querySelectorAll('.main-sidebar-nav a').forEach(link=>{if(new URL(link.href).pathname===location.pathname)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
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
    control.append(label,arrow,select);row.append(control,status);window.locationPickers.enhance(select,{host:control,displayLabel:label,contents:[control.querySelector('.location-pin'),label,arrow],label:'Switch location',holdWhileBusy:true});renderNavigation();
   }
   isAdmin=session.role==='admin';isUserManager=['admin','franchisee'].includes(session.role);document.querySelectorAll('#app-sidebar a[data-head-office-only],#app-subsidebar a[data-head-office-only]').forEach(element=>element.hidden=!isAdmin);document.querySelectorAll('[data-user-manager-only]').forEach(element=>element.hidden=!isUserManager);adminButton.hidden=!isUserManager;if(admin)admin.hidden=!isUserManager;
   const editControls=document.getElementById('admin-edit-controls');if(editControls)editControls.hidden=session.role!=='admin';
   openSubmenu(currentGroup());renderNavigation();
   const badge=document.getElementById('cart-badge'),cartKey='souvlaki-cart-'+(session.id||session.username)+(session.locationId?'-'+session.locationId:'');function refreshBadge(){if(!badge)return;try{const cart=JSON.parse(localStorage.getItem(cartKey)||(session.canMigrateBrowserData?localStorage.getItem('souvlaki-cart-'+(session.id||session.username)):null)||'{}');badge.textContent=Object.values(cart).filter(q=>Number.isInteger(q)&&q>0&&q<=999).reduce((sum,q)=>sum+q,0);}catch{badge.textContent='0';}}refreshBadge();window.addEventListener('storage',event=>{if(event.key===cartKey)refreshBadge();});window.addEventListener('cart-updated',event=>{if(event.detail?.key===cartKey)refreshBadge();});
   updateNavigationLabels();updateAdmin();
  }catch{}
 })();
})();
