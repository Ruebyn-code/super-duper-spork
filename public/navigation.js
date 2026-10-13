(()=>{
 const sidebar=document.getElementById('app-sidebar'),toggle=document.getElementById('sidebar-toggle');
 const preference='souvlaki-sidebar-collapsed';
 const hoverPreference='souvlaki-sidebar-hover-expand',root=document.documentElement;
 let collapsed=root.classList.contains('sidebar-collapsed'),hoverEnabled=false,pointerInside=false,keyboardInside=false;
 try{hoverEnabled=localStorage.getItem(hoverPreference)==='true';}catch{}
 const wording=(text,values={})=>{
  if(typeof interfaceLabel==='function')return interfaceLabel(text,values);
  const overrides=window.appBootstrap?.interfaceText||{};return String(Object.hasOwn(overrides,text)?overrides[text]??'':text).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 };
 function updateToggle(){
  if(!toggle)return;const preview=root.classList.contains('sidebar-hover-expanded'),original=preview?'Keep sidebar expanded':collapsed?'Expand sidebar':'Collapse sidebar',text=wording(original);
  toggle.setAttribute('aria-expanded',String(!collapsed||preview));toggle.setAttribute('aria-label',text||original);toggle.title=text||original;toggle.querySelector('.sidebar-toggle-text').textContent=text;
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
 function renderSidebar(){const preview=collapsed&&hoverEnabled&&(pointerInside||keyboardInside);root.classList.toggle('sidebar-collapsed',collapsed&&!preview);root.classList.toggle('sidebar-hover-expanded',preview);updateToggle();}
 function setCollapsed(value){collapsed=value;pointerInside=false;keyboardInside=false;renderSidebar();}
 if(toggle)toggle.onclick=()=>{setCollapsed(!collapsed);try{localStorage.setItem(preference,String(collapsed));}catch{}};
 if(sidebar){
  sidebar.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&matchMedia('(hover:hover) and (pointer:fine)').matches){pointerInside=true;renderSidebar();}});
  sidebar.addEventListener('pointerleave',()=>{pointerInside=false;renderSidebar();});
  sidebar.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible')){keyboardInside=true;renderSidebar();}});
  sidebar.addEventListener('focusout',()=>{queueMicrotask(()=>{keyboardInside=Boolean(sidebar.querySelector(':focus-visible'));renderSidebar();});});
 }
 const optionsButton=document.createElement('button'),options=document.createElement('div');
 optionsButton.id='sidebar-options-toggle';optionsButton.type='button';optionsButton.dataset.copyEditor='';optionsButton.setAttribute('aria-controls','sidebar-options');optionsButton.setAttribute('aria-expanded','false');
 optionsButton.innerHTML='<svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/></svg>';
 options.id='sidebar-options';options.className='sidebar-options';options.dataset.copyEditor='';options.hidden=true;
 options.innerHTML='<div class="sidebar-options-heading"><strong id="sidebar-options-heading"></strong><button type="button" class="sidebar-options-close">×</button></div><fieldset><legend></legend><label><input type="radio" name="sidebar-hover-behavior" value="false"><span data-sidebar-option="Stay collapsed"></span></label><label><input type="radio" name="sidebar-hover-behavior" value="true"><span data-sidebar-option="Expand on hover"></span></label></fieldset>';
 function updateOptions(){const text=wording('Sidebar options'),title=text||'Sidebar options';optionsButton.title=title;optionsButton.setAttribute('aria-label',title);options.querySelector('strong').textContent=text;options.querySelector('legend').textContent=wording('When the sidebar is collapsed');options.querySelector('.sidebar-options-close').setAttribute('aria-label',wording('Close sidebar options')||'Close sidebar options');options.querySelectorAll('[data-sidebar-option]').forEach(label=>label.textContent=wording(label.dataset.sidebarOption));options.querySelectorAll('input').forEach(input=>input.checked=(input.value==='true')===hoverEnabled);}
 function closeOptions(restoreFocus=false){options.hidden=true;optionsButton.setAttribute('aria-expanded','false');if(restoreFocus)optionsButton.focus();}
 function positionOptions(){if(options.hidden)return;const anchor=optionsButton.getBoundingClientRect(),width=options.getBoundingClientRect().width;options.style.left=Math.max(8,Math.min(anchor.left,innerWidth-width-8))+'px';options.style.bottom=Math.max(8,innerHeight-anchor.top+8)+'px';}
 if(toggle){toggle.before(optionsButton);document.body.append(options);updateOptions();}
 optionsButton.onclick=event=>{options.hidden=!options.hidden;optionsButton.setAttribute('aria-expanded',String(!options.hidden));positionOptions();if(!options.hidden&&event.detail===0)options.querySelector('input:checked').focus();};
 options.querySelector('.sidebar-options-close').onclick=()=>closeOptions(true);
 options.onchange=event=>{if(event.target.name!=='sidebar-hover-behavior')return;hoverEnabled=event.target.value==='true';try{localStorage.setItem(hoverPreference,String(hoverEnabled));}catch{}renderSidebar();updateOptions();};
 document.addEventListener('pointerdown',event=>{if(!options.contains(event.target)&&!optionsButton.contains(event.target))closeOptions();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!options.hidden){event.preventDefault();closeOptions(true);}});
 window.addEventListener('resize',positionOptions);
 updateToggle();updateNavigationLabels();
 window.addEventListener('storage',event=>{if(event.key===preference)setCollapsed(event.newValue==='true');if(event.key===hoverPreference){hoverEnabled=event.newValue==='true';updateOptions();renderSidebar();}});
 window.addEventListener('interface-text-updated',()=>{updateToggle();updateNavigationLabels();updateOptions();});
 if(sidebar)new MutationObserver(updateNavigationLabels).observe(sidebar,{childList:true,characterData:true,subtree:true});
 (async()=>{
  try{
   const response=await fetch('/api/session');const session=await response.json();if(!session.csrf){location.href='/login';return;}
   document.querySelectorAll('.main-sidebar-nav a').forEach(link=>{if(new URL(link.href).pathname===location.pathname)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
   const brand=sidebar?.querySelector('.brand');
   if(session.locationName&&brand){
    let row=brand.closest('.sidebar-brand-row');if(!row){row=document.createElement('div');row.className='sidebar-brand-row';brand.before(row);row.append(brand);}
    let label=document.getElementById('sidebar-location');if(!label){label=document.createElement('p');label.id='sidebar-location';label.className='sidebar-location';label.dataset.userText='';label.dataset.editId='sidebar-location-'+location.pathname.replace(/[^a-z0-9]/gi,'_');}row.append(label);label.textContent=session.locationName;label.title=session.locationName;
   }
   const admin=document.getElementById('admin-link');if(admin)admin.hidden=session.role!=='admin';
   const editControls=document.getElementById('admin-edit-controls');if(editControls)editControls.hidden=session.role!=='admin';
   const shortcut=sidebar?.querySelector('.sidebar-admin-shortcut');if(shortcut){if(location.pathname.startsWith('/admin'))shortcut.setAttribute('aria-current','page');else shortcut.removeAttribute('aria-current');}
   const badge=document.getElementById('cart-badge');if(badge){try{const cart=JSON.parse(localStorage.getItem('souvlaki-cart-'+(session.id||session.username)+(session.locationId?'-'+session.locationId:''))||(session.canMigrateBrowserData?localStorage.getItem('souvlaki-cart-'+(session.id||session.username)):null)||'{}');badge.textContent=Object.values(cart).filter(q=>Number.isInteger(q)&&q>0&&q<=999).reduce((sum,q)=>sum+q,0);}catch{badge.textContent='0';}}
   updateNavigationLabels();
  }catch{}
 })();
})();
