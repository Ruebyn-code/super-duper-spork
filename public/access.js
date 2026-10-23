(()=>{
 let account=window.appBootstrap?.access||{role:document.documentElement.dataset.accountRole};
 const can=(key,session=account)=>permissionModel.can(session,key),any=(keys,session=account)=>keys.some(key=>can(key,session));
 const admin=['users.manage','locations.manage','companies.manage','email.manage'];
 let initialSession;
 async function loadInitialSession(){
  if(!initialSession){
   initialSession=(async()=>{const response=await fetch('/api/session',{cache:'no-store',headers:window.appLocationId?{'X-Location-Id':window.appLocationId}:{}});if(!response.ok)throw Error('Unable to load your session.');return response.json();})();
   initialSession.catch(()=>{initialSession=null;});
  }
  return structuredClone(await initialSession);
 }
 function policy(node){
  if(node.dataset.permission)return[node.dataset.permission];if(node.dataset.permissionAny)return node.dataset.permissionAny.split(' ');
  const views=(node.dataset.adminViews||'').split(' ');if(views.includes('locations'))return['locations.manage','email.manage'];if(views.includes('companies'))return['companies.manage'];if(views.includes('accounts'))return['users.manage'];if(views.includes('stock'))return['stock.manage'];if(views.includes('suppliers'))return['suppliers.manage'];
  if(node.dataset.sidebarGroup==='ordering')return['orders.view','counts.view','transfers.view','stock.manage','suppliers.manage'];if(node.dataset.sidebarGroup==='sales')return['sales.view','finances.view'];if(node.dataset.sidebarGroup==='admin'||node.id==='admin-link'||node.dataset.subsidebarGroup==='admin')return admin;
  if(node.matches('a[href]')){const url=new URL(node.href);if(url.origin!==location.origin)return null;const route=url.pathname,hash=url.hash;
   if(route==='/learning-centre')return['learning.view'];if(route==='/labels')return['prep.view'];if(route==='/ops-management')return['ops.view'];if(route==='/rostering')return['rostering.view'];if(route==='/knowledge-library')return['knowledge.view'];if(route==='/communications')return['comms.view'];if(route==='/'||route==='/cart'||route==='/order-history')return['orders.view'];if(route==='/stock-transfers')return['transfers.view'];if(route==='/stock-count')return['counts.view'];if(route==='/sales')return[hash==='#report'||hash==='#overview'||hash.startsWith('#expense-')?'finances.view':'sales.view'];if(route==='/reporting')return['reporting.view'];
   if(route==='/admin')return[hash==='#suppliers'?'suppliers.manage':'stock.manage'];if(route==='/admin/accounts')return hash==='#locations'?['locations.manage','email.manage']:hash==='#companies'?['companies.manage']:['users.manage'];if(route==='/admin/settings'||route.startsWith('/admin/appearance/'))return['appearance.manage'];if(route==='/settings/devices')return['devices.manage'];if(route==='/settings/awards')return['awards.manage'];if(route==='/settings')return['ai.manage','appearance.manage','roles.manage','awards.manage','email.manage','account-email.manage','devices.manage'];
  }
  if(node.dataset.subsidebarGroup==='stock'||node.matches('.navigation-segment[data-head-office-only]'))return['stock.manage','suppliers.manage'];if(node.dataset.subsidebarGroup==='settings')return['appearance.manage'];if(node.hasAttribute('data-user-manager-only'))return admin;
  return null;
 }
 function apply(session){if(session)account=session;if(location.pathname==='/sales'){const finance=location.hash==='#report'||location.hash==='#overview'||location.hash.startsWith('#expense-');if(!can('sales.view')&&can('finances.view')){if(!finance)location.hash='report';for(const panel of document.querySelectorAll('[data-sales-view]'))panel.hidden=panel.dataset.salesView!=='weekly';document.querySelector('.sales-page')?.classList.add('report-active');}for(const panel of document.querySelectorAll('.sales-overview,.sales-performance,[data-edit-id="sales-intro"],[data-edit-id="sales-title"],#sales-message'))panel.classList.toggle('access-denied',!can('sales.view'));for(const panel of document.querySelectorAll('[data-sales-view]'))panel.classList.toggle('access-denied',!can(panel.dataset.salesView==='weekly'?'finances.view':'sales.view'));}document.querySelectorAll('[data-permission],[data-permission-any],[data-head-office-only],[data-user-manager-only],[data-admin-views],.main-sidebar-nav a,.admin-subnav a,.home-quick-links a,.home-admin-links a,.home-actions a,#home-admin a').forEach(node=>{const keys=policy(node);if(keys)node.classList.toggle('access-denied',!any(keys));});readonly();}
 function readonly(){
  if(!can('orders.place'))document.querySelectorAll('.count-add-recommended').forEach(node=>{if(!node.disabled)node.disabled=true;});
  const forms=[['#sales-form','sales.edit'],['#weekly-report-form','finances.edit'],['#count-form','counts.edit']];
  for(const [selector,key] of forms){const form=document.querySelector(selector);if(!form||can(key))continue;form.dataset.accessReadonly=key;for(const node of form.querySelectorAll('input:not([type=date]),textarea,select,button')){if(node.matches('.date-toggle,.search-toggle,input[type=search]')||node.closest('#count-filters'))continue;if(['weekly-previous','weekly-next','weekly-current','weekly-reload','sales-previous','sales-next','sales-current','sales-reload'].includes(node.id))continue;if(!node.disabled)node.disabled=true;}}
  if(!can('orders.place'))document.querySelectorAll('#menu button,#menu input,.cart-row button,.cart-row input,#checkout #submit').forEach(node=>{if(!node.disabled)node.disabled=true;});
 }
 document.addEventListener('submit',event=>{if(event.target.dataset.accessReadonly){event.preventDefault();event.stopImmediatePropagation();}},true);
 let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;readonly();});}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
 window.appAccess={can,any,apply,policy,admin,initialSession:loadInitialSession,roleName:session=>session?.roleName||permissionModel.defaults.find(role=>role.id===(session?.role||account.role))?.name||account.roleName||account.role};
 if(location.pathname==='/sales'){if(!can('sales.view')&&can('finances.view')&&!location.hash)location.hash='report';else if(!can('finances.view')&&can('sales.view')&&(location.hash==='#report'||location.hash==='#overview'||location.hash.startsWith('#expense-')))location.hash='entry';}
 apply();document.addEventListener('DOMContentLoaded',()=>apply());window.addEventListener('hashchange',()=>apply());
})();
