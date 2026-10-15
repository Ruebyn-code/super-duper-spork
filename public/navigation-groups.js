// Keep related destinations in the same main navigation group on every page.
window.groupAppNavigation=(sidebar,secondary)=>{
 if(!secondary)return;
 const main=[...sidebar.querySelectorAll('.main-sidebar-nav a')],find=path=>main.find(link=>new URL(link.href).pathname===path),menus=new Map([...secondary.querySelectorAll('[data-subsidebar-group]')].map(menu=>[menu.dataset.subsidebarGroup,menu]));
 const home=find('/home'),ordering=find('/'),cart=find('/cart'),sales=find('/sales'),accounts=find('/admin/accounts'),stock=find('/admin'),count=find('/stock-count'),settings=find('/admin/settings'),reporting=find('/reporting');
 const oldAdmin=document.getElementById('admin-link'),prefix='navigation-'+location.pathname.replace(/[^a-z0-9]/gi,'_');
 const label=(link,text)=>{link.dataset.sidebarName=text;const span=link.querySelector('.sidebar-label');if(span){span.textContent=text;span.dataset.localWording=text;}};
 const fresh=(source,href,text,key)=>{const link=document.createElement('a');link.href=href;link.dataset.editId=prefix+'-'+key;const icon=source?.querySelector('svg')?.cloneNode(true);if(icon){for(const node of [icon,...icon.querySelectorAll('[data-edit-id]')])node.removeAttribute('data-edit-id');link.append(icon);}const span=document.createElement('span');span.className='submenu-label';span.dataset.localWording=text;span.dataset.editId=link.dataset.editId+'-label';span.textContent=text;link.append(span);return link;};
 const protect=menu=>{for(const link of menu?.querySelectorAll('a')||[]){if(menu.hasAttribute('data-head-office-only'))link.setAttribute('data-head-office-only','');if(menu.hasAttribute('data-user-manager-only'))link.setAttribute('data-user-manager-only','');}};
 for(const menu of menus.values())protect(menu);
 const menuFor=(group,name)=>{const menu=document.createElement('nav');menu.className='admin-subnav grouped-navigation-menu';menu.dataset.subsidebarGroup=group;menu.dataset.editId=prefix+'-'+group+'-menu';menu.setAttribute('aria-label',name);menu.hidden=true;secondary.append(menu);return menu;};
 const segment=(parent,name,key)=>{const group=document.createElement('div');group.className='navigation-segment';group.dataset.editId=prefix+'-'+key;group.setAttribute('role','group');group.setAttribute('aria-label',name);const title=document.createElement('span');title.className='navigation-segment-title';title.dataset.localWording=name;title.textContent=name;group.append(title);parent.append(group);return group;};
 const moveMenu=(parent,menu)=>{if(!menu)return;menu.removeAttribute('data-subsidebar-group');menu.removeAttribute('data-head-office-only');menu.removeAttribute('data-user-manager-only');menu.classList.add('navigation-segment-links');menu.hidden=false;parent.append(menu);};
 const communication=document.createElement('a');communication.href='/communications';communication.dataset.sidebarName='Communications';communication.dataset.editId=prefix+'-communications';communication.dataset.permission='comms.view';communication.innerHTML='<svg class="sidebar-navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1-1-5 9 9 0 0 1 18 0Z"/><g class="icon-detail"><path d="M7 10h10M7 14h6"/></g></svg><span class="sidebar-label">Communications</span>';
 const ordersMenu=menuFor('ordering','Ordering');
 ordersMenu.append(fresh(ordering,'/','Catalogue','catalogue'));
 if(cart){cart.classList.add('navigation-cart-link');cart.querySelector('.sidebar-label')?.classList.replace('sidebar-label','submenu-label');cart.removeAttribute('aria-current');ordersMenu.append(cart);}
 moveMenu(segment(ordersMenu,'Stock','count-pages'),menus.get('count'));
 const management=segment(ordersMenu,'Manage stock','stock-management');management.setAttribute('data-head-office-only','');moveMenu(management,menus.get('stock'));
 const salesMenu=menuFor('sales','Sales');moveMenu(salesMenu,menus.get('sales'));
 if(reporting)reporting.setAttribute('data-user-manager-only','');
 const adminMenu=menuFor('admin','Admin');adminMenu.setAttribute('data-user-manager-only','');moveMenu(adminMenu,menus.get('accounts'));
 // Settings retain their own options, separate from the Admin category.
 menus.get('settings')?.removeAttribute('data-head-office-only');
 for(const [link,group,text] of [[ordering,'ordering','Ordering'],[sales,'sales','Sales'],[accounts,'admin','Admin']])if(link){link.dataset.sidebarGroup=group;link.setAttribute('aria-controls','app-subsidebar');link.setAttribute('aria-expanded','false');label(link,text);}
 if(accounts)accounts.setAttribute('data-user-manager-only','');
 const nav=document.createElement('nav');nav.className='main-sidebar-nav grouped-main-navigation';nav.dataset.editId=prefix+'-main';nav.setAttribute('aria-label','Main navigation');
 const original=sidebar.querySelector('.sidebar-scroll > .main-sidebar-nav');if(original)original.before(nav);else sidebar.querySelector('.sidebar-scroll')?.append(nav);
 for(const link of [home,ordering,sales,communication,reporting])if(link)nav.append(link);
 if(oldAdmin){const adminNav=document.createElement('nav');adminNav.className='main-sidebar-nav';adminNav.setAttribute('aria-label','Admin navigation');if(accounts)adminNav.append(accounts);oldAdmin.replaceChildren(adminNav);}
 for(const link of [stock,count,settings])link?.remove();
 for(const empty of sidebar.querySelectorAll('.sidebar-scroll > .main-sidebar-nav'))if(empty!==nav)empty.remove();
 window.appAccess?.apply();
 if(ordering&&cart){const badge=document.createElement('span');badge.id='ordering-cart-badge';badge.className='ordering-cart-badge';badge.dataset.userText='';ordering.append(badge);const source=cart.querySelector('#cart-badge'),sync=()=>{badge.textContent=source?.textContent||'0';badge.hidden=badge.textContent==='0';};if(source)new MutationObserver(sync).observe(source,{childList:true,characterData:true,subtree:true});sync();}
};
