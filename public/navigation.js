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
 function renderSidebar(){const preview=collapsed&&hoverEnabled&&(pointerInside||keyboardInside);root.classList.toggle('sidebar-collapsed',collapsed&&!preview);root.classList.toggle('sidebar-hover-expanded',preview);updateToggle();}
 function setMode(mode){collapsed=mode!=='expanded';hoverEnabled=mode==='hover';pointerInside=false;keyboardInside=false;renderSidebar();try{localStorage.setItem(preference,String(collapsed));localStorage.setItem(hoverPreference,String(hoverEnabled));}catch{}}
 if(toggle)toggle.onclick=()=>setMode(!collapsed?'collapsed':!hoverEnabled?'hover':'expanded');
 if(sidebar){
  sidebar.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&matchMedia('(hover:hover) and (pointer:fine)').matches){pointerInside=true;renderSidebar();}});
  sidebar.addEventListener('pointerleave',()=>{pointerInside=false;renderSidebar();});
  sidebar.addEventListener('focusin',event=>{if(event.target.matches(':focus-visible')){keyboardInside=true;renderSidebar();}});
  sidebar.addEventListener('focusout',()=>{queueMicrotask(()=>{keyboardInside=Boolean(sidebar.querySelector(':focus-visible'));renderSidebar();});});
 }
 updateToggle();updateNavigationLabels();
 window.addEventListener('storage',event=>{if(event.key!==preference&&event.key!==hoverPreference&&event.key!==null)return;try{collapsed=localStorage.getItem(preference)==='true';hoverEnabled=localStorage.getItem(hoverPreference)==='true';}catch{}pointerInside=false;keyboardInside=false;renderSidebar();});
 window.addEventListener('interface-text-updated',()=>{updateToggle();updateNavigationLabels();});
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
