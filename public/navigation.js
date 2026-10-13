(()=>{
 const sidebar=document.getElementById('app-sidebar'),toggle=document.getElementById('sidebar-toggle');
 const preference='souvlaki-sidebar-collapsed';
 const wording=(text,values={})=>{
  if(typeof interfaceLabel==='function')return interfaceLabel(text,values);
  const overrides=window.appBootstrap?.interfaceText||{};return String(Object.hasOwn(overrides,text)?overrides[text]??'':text).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 };
 function updateToggle(){
  if(!toggle)return;const collapsed=document.documentElement.classList.contains('sidebar-collapsed');const original=collapsed?'Expand sidebar':'Collapse sidebar',text=wording(original);
  toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',text||original);toggle.title=text||original;toggle.querySelector('.sidebar-toggle-text').textContent=text;
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
 function setCollapsed(collapsed){document.documentElement.classList.toggle('sidebar-collapsed',collapsed);updateToggle();}
 if(toggle)toggle.onclick=()=>{const collapsed=!document.documentElement.classList.contains('sidebar-collapsed');setCollapsed(collapsed);try{localStorage.setItem(preference,String(collapsed));}catch{}};
 updateToggle();updateNavigationLabels();
 window.addEventListener('storage',event=>{if(event.key===preference)setCollapsed(event.newValue==='true');});
 window.addEventListener('interface-text-updated',()=>{updateToggle();updateNavigationLabels();});
 if(sidebar)new MutationObserver(updateNavigationLabels).observe(sidebar,{childList:true,characterData:true,subtree:true});
 (async()=>{
  try{
   const response=await fetch('/api/session');const session=await response.json();if(!session.csrf){location.href='/login';return;}
   document.querySelectorAll('.main-sidebar-nav a').forEach(link=>{if(new URL(link.href).pathname===location.pathname)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
   const admin=document.getElementById('admin-link');if(admin)admin.hidden=session.role!=='admin';
   const editControls=document.getElementById('admin-edit-controls');if(editControls)editControls.hidden=session.role!=='admin';
   const shortcut=sidebar?.querySelector('.sidebar-admin-shortcut');if(shortcut){if(location.pathname.startsWith('/admin'))shortcut.setAttribute('aria-current','page');else shortcut.removeAttribute('aria-current');}
   const badge=document.getElementById('cart-badge');if(badge){try{const cart=JSON.parse(localStorage.getItem('souvlaki-cart-'+(session.id||session.username))||'{}');badge.textContent=Object.values(cart).filter(q=>Number.isInteger(q)&&q>0&&q<=999).reduce((sum,q)=>sum+q,0);}catch{badge.textContent='0';}}
   updateNavigationLabels();
  }catch{}
 })();
})();
