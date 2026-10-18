(()=>{
 const $=id=>document.getElementById(id),controls=$('usage-controls');if(!controls)return;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 const number=value=>value===null?'—':new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(value);
 const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
 const sunday=date=>shift(date,-new Date(date+'T00:00:00Z').getUTCDay());
 const dateLabel=date=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 let session,products=[],report=null,loading=false,initializing=false,generation=0,currentWeek='',defaultWeek='',selectedGroup='all';
 const rows=new Map(),groups=new Map();
 async function api(url){const response=await fetch(url,{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load weekly usage.');return result;}
 function thisWeek(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=kind=>parts.find(part=>part.type===kind).value;return sunday(value('year')+'-'+value('month')+'-'+value('day'));}
 function template(element,text,values={}){element.dataset.appTemplate=text;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(text,values);}
 function setBusy(){for(const control of controls.querySelectorAll('input,select,button'))control.disabled=loading||initializing;}
 function render(){
  if(!report)return;const open=new Set([...groups].filter(([,group])=>group.open).map(([id])=>id));rows.clear();groups.clear();$('usage-items').replaceChildren();
  const statuses={missing_both_counts:'Both Sunday counts are missing',missing_opening_count:'Opening Sunday count is missing',missing_closing_count:'Next Sunday count is missing',negative_usage:'Check counts or missing orders'};
  const items=new Map(report.items.map(item=>[item.id,item]));let complete=0;
  for(const storage of stockCountGroups.groups){const stock=products.filter(product=>stockCountGroups.resolve(product)===storage.id);if(!stock.length)continue;
   const group=el('details',undefined,'supplier-stock-menu');group.dataset.stockCountGroup=storage.id;group.dataset.editId='usage-group-'+storage.id;group.open=open.has(storage.id);
   const summary=el('summary'),title=el('h3',wording(storage.name)),content=el('div',undefined,'supplier-stock-content');summary.dataset.editId='usage-group-'+storage.id+'-summary';title.dataset.editId='usage-group-'+storage.id+'-name';summary.append(title);group.append(summary,content);groups.set(storage.id,group);
   for(const product of stock){const item=items.get(product.id);if(!item)continue;const row=el('div',undefined,'usage-item automatic-usage-item');row.dataset.productId=product.id;row.dataset.editId='usage-item-'+product.id;
    const details=el('div',undefined,'usage-stock-info'),name=el('h3',product.name,'stock-name');name.dataset.userText='';name.dataset.editId='usage-item-'+product.id+'-name';details.append(name);
    if(product.sku){const sku=el('p',product.sku,'small');sku.dataset.userText='';details.append(sku);}row.append(details);
    for(const [key,label] of [['opening','Sunday stock'],['ordered','Orders Sunday–Saturday'],['transferredIn','Transfers in'],['transferredOut','Transfers out'],['closing','Next Sunday stock']]){
     const stat=el('div',undefined,'usage-quantity'),caption=el('span',wording(label),'usage-stat-label'),value=el('strong',number(item[key]));stat.dataset.editId='usage-item-'+product.id+'-'+key;value.id='usage-'+key+'-'+product.id;value.dataset.userText='';stat.append(caption,value);row.append(stat);
    }
    const totals=el('div',undefined,'usage-totals'),available=el('span',undefined,'small'),used=el('strong',undefined,'usage-used');available.id='usage-available-'+product.id;template(available,'Total stock: {quantity}',{quantity:number(item.available)});used.id='usage-used-'+product.id;used.dataset.editId='usage-item-'+product.id+'-used';
    if(item.status==='complete'){complete++;template(used,'Used: {quantity}',{quantity:number(item.quantity)});}else{template(used,statuses[item.status]||'Usage is incomplete');used.classList.add('usage-warning');if(item.status==='negative_usage')used.title=wording('Calculated usage: {quantity}',{quantity:number(item.calculatedUsage)});}
    totals.append(available,used);row.append(totals);content.append(row);rows.set(product.id,row);
   }$('usage-items').append(group);
  }
  template($('usage-progress'),'{count} of {total} items calculated',{count:complete,total:products.length});
  template($('usage-week-range'),'{start} – {end} · Closing count: {closing}',{start:dateLabel(report.weekStart),end:dateLabel(report.weekEnd),closing:dateLabel(report.nextSunday)});filter();
 }
 function filter(){const query=$('usage-search').value.trim().toLowerCase(),groupId=selectedGroup;let visible=0;for(const product of products){const row=rows.get(product.id);if(!row)continue;const show=(groupId==='all'||stockCountGroups.resolve(product)===groupId)&&(product.name+' '+(product.sku||'')).toLowerCase().includes(query);row.hidden=!show;if(show)visible++;}for(const [id,group] of groups){group.hidden=!products.some(product=>stockCountGroups.resolve(product)===id&&rows.has(product.id)&&!rows.get(product.id).hidden);if(!group.hidden&&(query||groupId!=='all'))group.open=true;}$('usage-empty').hidden=visible>0;}
 function selectGroup(id){selectedGroup=id;for(const button of $('usage-supplier').children){const active=button.dataset.stockCountGroup===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}filter();}
 function buildGroupMenu(){
  $('usage-supplier').replaceChildren();
  for(const group of [{id:'all',name:'All groups'},...stockCountGroups.groups]){const button=el('button',wording(group.name));button.type='button';button.dataset.stockCountGroup=group.id;button.dataset.editId='usage-group-filter-'+group.id;button.onclick=()=>selectGroup(group.id);$('usage-supplier').append(button);}
  selectGroup(selectedGroup);setBusy();
 }
 async function loadWeek(value){
  const version=++generation;loading=true;setBusy();$('usage-message').textContent=wording('Calculating weekly usage…');
  try{const data=await api('/api/stock-usage?week='+encodeURIComponent(value));if(version!==generation)return;currentWeek=value;report=data.record;$('usage-week').value=value;$('usage-week').max=data.window.currentWeekStart;render();$('usage-message').textContent='';}
  catch(error){if(version===generation)$('usage-message').textContent=error.message;}finally{if(version===generation){loading=false;setBusy();}}
 }
 async function open(){if(location.hash!=='#usage'||initializing)return;if(session){if(!loading)await loadWeek(currentWeek||shift(thisWeek(),-7));return;}initializing=true;setBusy();
  try{session=await api('/api/session');if(!session.csrf){location.href=companyLoginUrl();return;}const catalogue=await api('/api/catalogue');products=catalogue.products;buildGroupMenu();defaultWeek=shift(thisWeek(),-7);await loadWeek(defaultWeek);}
  catch(error){session=null;$('usage-message').textContent=error.message;}finally{initializing=false;setBusy();}
 }
 $('usage-week').onchange=()=>{const value=$('usage-week').value;if(value)loadWeek(sunday(value));};$('usage-refresh').onclick=()=>loadWeek(currentWeek);$('usage-search').oninput=filter;
 async function refresh(){if(location.hash!=='#usage'||!session||loading||document.hidden)return;const nextDefault=shift(thisWeek(),-7);if(currentWeek===defaultWeek&&defaultWeek!==nextDefault)currentWeek=nextDefault;defaultWeek=nextDefault;await loadWeek(currentWeek);}
 window.addEventListener('hashchange',open);window.addEventListener('focus',refresh);window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 window.addEventListener('storage',event=>{if(event.key==='souvlaki-usage-updated-'+(session?.dataScope||session?.id))refresh();});setInterval(refresh,60000);
 window.addEventListener('interface-text-updated',()=>{render();if(session)buildGroupMenu();});setBusy();open();
})();
