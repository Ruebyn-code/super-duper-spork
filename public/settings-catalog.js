// Settings page catalogue: groups every feature's settings and links to its native editor.
(()=>{
 const grid=document.getElementById('settings-options');if(!grid||!window.appAccess)return;
 const svg=body=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+body+'</svg>';
 const icons={
  palette:'<path d="M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4 2 2 0 0 1 0-4h3a4 4 0 0 0 4-4c0-3-4-6-9-6Z"/><g class="icon-detail"><circle cx="7" cy="9" r="1"/><circle cx="11" cy="6" r="1"/><circle cx="16" cy="7" r="1"/></g>',
  image:'<rect x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><path d="m3 16 5-5 5 5 4-4 4 4"/><circle cx="15" cy="8" r="2"/></g>',
  company:'<path d="M4 21V4h12v17M16 10h4v11M2 21h20"/><path class="icon-detail" d="M8 8h4M8 12h4M8 16h4"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path class="icon-detail" d="m8 12 3 3 5-6"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path class="icon-detail" d="m4 7 8 6 8-6"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle class="icon-detail" cx="12" cy="10" r="3"/>',
  device:'<rect x="6" y="2" width="12" height="20" rx="2"/><path class="icon-detail" d="M10 18h4"/>',
  stock:'<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z"/><path class="icon-detail" d="m3 8 9 5 9-5M12 13v8"/>',
  truck:'<path d="M3 7h11v11H3zM14 11h4l3 4v3h-7"/><g class="icon-detail"><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/></g>',
  chart:'<path d="M3 4v16h18"/><path class="icon-detail" d="M6 15l4-5 4 3 6-8"/>',
  wallet:'<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18"/><path class="icon-detail" d="M16 15h2"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4"/><path class="icon-detail" d="M3 11h18M8 15h3"/>',
  award:'<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/><path class="icon-detail" d="m10 9 1.5 1.5L14 8"/>',
  checklist:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9z"/><path class="icon-detail" d="m8.5 13 1.5 1.5 3-3M14 16h2"/>',
  label:'<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle class="icon-detail" cx="7.5" cy="8.5" r="1.5"/>',
  tool:'<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4Z"/>',
  training:'<path d="m2 9 10-5 10 5-10 5-10-5Z"/><path class="icon-detail" d="M6 11v5c3 2 9 2 12 0v-5"/>',
  spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
  report:'<rect x="4" y="3" width="16" height="18" rx="2"/><path class="icon-detail" d="M8 15v-3M12 15V8M16 15v-5"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell:'<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z"/><path class="icon-detail" d="M10 20a2 2 0 0 0 4 0"/>',
  moon:'<path d="M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11Z"/>'
 };
 const any=keys=>keys.some(key=>appAccess.can(key)),shell=()=>window.appEmbedded?parent:window;
 // existing: id of a static card already in the page (moved into its group, behaviour unchanged).
 const groups=[
  {id:'company',title:'Company & appearance',items:[
   {existing:'hub-appearance'},
   {title:'Logo',detail:'Company logo for the header and sign-in page.',href:'/admin/settings#logo',keys:['appearance.manage'],icon:'image'},
   {title:'Sign-in background',detail:'Background image and welcome on the sign-in page.',href:'/admin/settings#sign-in',keys:['appearance.manage'],icon:'image'},
   {title:'Companies',detail:'Company names and the companies in this network.',href:'/admin/accounts#companies',keys:['companies.manage'],icon:'company'}]},
  {id:'people',title:'People & access',items:[
   {title:'Users',detail:'Invite staff, employment, pay conditions, PINs and locations.',href:'/admin/accounts#accounts',keys:['users.manage'],icon:'people'},
   {existing:'hub-permissions'},
   {existing:'hub-account-email'}]},
  {id:'locations',title:'Locations & devices',items:[
   {title:'Locations',detail:'Trading hours, managers, order sending, delivery days and target levels.',href:'/admin/accounts#locations',keys:['locations.manage','email.manage','awards.manage'],icon:'pin'},
   {existing:'hub-devices'}]},
  {id:'ordering',title:'Ordering & stock',items:[
   {title:'Stock items',detail:'Products, packs, counting units, prices and ordering rules.',href:'/admin#stock',keys:['stock.manage'],icon:'stock'},
   {title:'Suppliers & delivery',detail:'Suppliers, contacts, ordering methods and delivery plans.',href:'/admin#suppliers',keys:['suppliers.manage'],icon:'truck'},
   {existing:'hub-order-email'}]},
  {id:'sales',title:'Sales & finance',items:[
   {title:'Projection & budget',detail:'Sales projections and the ordering budget percentage.',href:'/sales#projection',keys:['sales.view'],icon:'chart'},
   {title:'Unusual sales days',detail:'How far above or below usual a day can be before projections leave it out (default 30%).',href:'/sales#projection',keys:['sales.view'],icon:'chart'},
   {title:'Operating expenses',detail:'Recurring expenses used in weekly reports.',href:'/sales#expense-operating-expenses',keys:['finances.view'],icon:'wallet'}]},
  {id:'rostering',title:'Rostering & pay',items:[
   {title:'Labour settings',detail:'Positions, shift colours, hourly rates and labour budgets.',href:'/rostering#settings',keys:['rostering.manage'],icon:'calendar'},
   {existing:'hub-awards'}]},
  {id:'operations',title:'Operations & training',items:[
   {title:'Checklist builder',detail:'Checklists, plans, locations and assignees.',href:'/ops-management#templates',keys:['ops.manage'],icon:'checklist'},
   {title:'Label settings',detail:'Printer media size, resolution and label templates.',href:'/labels#settings',keys:['prep.manage'],feature:'labels',icon:'label'},
   {title:'Equipment',detail:'Company and network equipment lists and each location’s equipment.',href:'/equipment',keys:['equipment.manage'],icon:'tool'},
   {title:'In-store training',detail:'Training checklists, sessions and sign-offs.',href:'/learning-centre#in-store',keys:['learning.assign'],icon:'training'}]},
  {id:'intelligence',title:'Intelligence & reports',items:[
   {existing:'hub-ai'},
   {title:'AI reports',detail:'Scheduled daily, weekly and monthly OpStack intelligence reports.',href:'/reporting#ai-reports',keys:['reports.manage'],icon:'report'}]},
  {id:'account',title:'Your account',items:[
   {title:'Profile & photo',detail:'Your name, profile photo and password.',action:()=>shell().appAccountTools?.openProfile(),icon:'user'},
   {title:'Notifications',detail:'Choose which notifications you get and turn on desktop alerts.',action:()=>shell().appNotifications?.openSettings(),icon:'bell'},
   {title:'Dark mode',detail:'Switch between light and dark for this browser.',action:()=>shell().appAccountTools?.toggleTheme(),icon:'moon'}]}
 ];
 // Give the static cards stable IDs so they can be placed in their groups.
 const tag=(selector,id)=>{const link=grid.querySelector(selector);if(link&&!link.id)link.id=id;};
 tag('a[href="/settings/devices"]','hub-devices');tag('a[href="/settings/awards"]','hub-awards');tag('a[href="#order-email"]','hub-order-email');tag('a[href="#ai"]','hub-ai');tag('a[href="#account-email"]','hub-account-email');
 const existingIcons={'hub-appearance':'palette','hub-permissions':'shield','hub-account-email':'mail','hub-devices':'device','hub-order-email':'mail','hub-awards':'award','hub-ai':'spark'};
 function card(item){const article=document.createElement('article');article.className='settings-option';article.dataset.catalog='';const control=document.createElement(item.href?'a':'button');if(item.href)control.href=item.href;else{control.type='button';control.onclick=item.action;}const icon=document.createElement('span');icon.className='settings-option-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=svg(icons[item.icon]||icons.spark);const h=document.createElement('h2');h.textContent=item.title;const p=document.createElement('p');p.textContent=item.detail;control.append(icon,h,p);article.append(control);return article;}
 function build(){
  const used=new Set(),sections=[];
  for(const group of groups){const section=document.createElement('section');section.className='settings-group';section.dataset.group=group.id;const heading=document.createElement('h2');heading.className='settings-group-title';heading.textContent=group.title;const list=document.createElement('div');list.className='settings-group-grid';
   for(const item of group.items){if(item.existing){const article=document.getElementById(item.existing)?.closest('.settings-option');if(article){used.add(article);const icon=article.querySelector('.settings-option-icon');if(icon&&!icon.querySelector('svg')&&existingIcons[item.existing])icon.innerHTML=svg(icons[existingIcons[item.existing]]);list.append(article);}continue;}if(item.keys&&!any(item.keys)||item.feature&&appAccess.featureOn?.(item.feature)===false)continue;list.append(card(item));}
   section.append(heading,list);sections.push(section);}
  // Any static card not placed above stays visible in a final group.
  const rest=[...grid.querySelectorAll(':scope>.settings-option')].filter(article=>!used.has(article));if(rest.length){const section=document.createElement('section');section.className='settings-group';const heading=document.createElement('h2');heading.className='settings-group-title';heading.textContent='More settings';const list=document.createElement('div');list.className='settings-group-grid';list.append(...rest);section.append(heading,list);sections.push(section);}
  grid.classList.add('settings-catalog');grid.replaceChildren(...sections);refresh();
 }
 // Static cards are shown or hidden by their data-permission; hide groups that end up empty.
 function refresh(){for(const section of grid.querySelectorAll('.settings-group'))section.hidden=![...section.querySelectorAll('.settings-option')].some(article=>!article.hidden&&getComputedStyle(article).display!=='none');}
 const start=async()=>{try{await appAccess.initialSession();}catch{}build();setTimeout(refresh,300);};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
 new MutationObserver(()=>refresh()).observe(grid,{subtree:true,attributes:true,attributeFilter:['hidden']});
})();
