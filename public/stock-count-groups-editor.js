// Edit groups popup for Stock count (stock.manage). Lets a manager make the company's own count groups: add, rename,
// reorder and delete groups, and choose each item's group (one at a time or every item shown by the search/filter).
// Nothing is saved until Save groups, which sends one revision-checked PUT /api/products/count-groups.
(()=>{
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 let dialog,state=null,saving=false,onSaved=null,opener=null;
 const NONE=stockCountGroups.NONE;
 const newId=name=>(name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24)||'group')+'-'+Math.random().toString(36).slice(2,7);
 const dirty=()=>state&&JSON.stringify({g:state.groups,a:state.assign})!==state.original;
 function build(){
  dialog=el('dialog',undefined,'count-groups-dialog');dialog.setAttribute('aria-labelledby','count-groups-title');
  dialog.innerHTML='<form method="dialog" class="count-groups-form"><div class="count-groups-head"><div><h2 id="count-groups-title"></h2><p class="count-groups-sub"></p></div><button type="button" class="count-groups-close"></button></div><div class="count-groups-body"><div role="region" class="count-groups-list" aria-labelledby="count-groups-list-title"><div class="count-groups-section-head"><h3 id="count-groups-list-title"></h3><button type="button" class="count-groups-add"></button></div><ol class="count-groups-rows"></ol></div><div role="region" class="count-groups-items" aria-labelledby="count-groups-items-title"><div class="count-groups-section-head"><h3 id="count-groups-items-title"></h3><span class="count-groups-shown" aria-live="polite"></span></div><div class="count-groups-tools"><input type="search" class="count-groups-search" autocomplete="off"><select class="count-groups-filter"></select></div><div class="count-groups-move"><span></span><select class="count-groups-move-to"></select><button type="button" class="count-groups-move-button"></button></div><ul class="count-groups-item-rows"></ul></div></div><div class="count-groups-foot"><p class="count-groups-status" role="status" aria-live="polite"></p><div><button type="button" class="count-groups-cancel"></button><button type="submit" class="count-groups-save"></button></div></div></form>';
  document.body.append(dialog);
  const q=selector=>dialog.querySelector(selector);
  q('#count-groups-title').textContent=word('Stock count groups');q('.count-groups-sub').textContent=word('Make your own groups and choose which items go in each. Groups are shared by every store in this company.');
  q('.count-groups-close').textContent='×';q('.count-groups-close').setAttribute('aria-label',word('Close'));q('#count-groups-list-title').textContent=word('Groups');q('.count-groups-add').textContent='+ '+word('Add group');
  q('#count-groups-items-title').textContent=word('Items');q('.count-groups-search').placeholder=word('Search items or suppliers');q('.count-groups-search').setAttribute('aria-label',word('Search items'));q('.count-groups-filter').setAttribute('aria-label',word('Show items in'));
  q('.count-groups-move span').textContent=word('Move items shown to');q('.count-groups-move-to').setAttribute('aria-label',word('Move items shown to'));q('.count-groups-move-button').textContent=word('Move');
  q('.count-groups-cancel').textContent=word('Cancel');q('.count-groups-save').textContent=word('Save groups');
  q('.count-groups-close').onclick=q('.count-groups-cancel').onclick=()=>close();
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  q('.count-groups-add').onclick=()=>{const name=uniqueName(word('New group'));state.groups.push({id:newId(name),name,icon:null});render();const inputs=dialog.querySelectorAll('.count-groups-name');inputs[inputs.length-1]?.select();inputs[inputs.length-1]?.focus();};
  q('.count-groups-search').oninput=q('.count-groups-filter').onchange=()=>renderItems();
  q('.count-groups-move-button').onclick=()=>{const target=q('.count-groups-move-to').value;if(!target)return;for(const product of shown())state.assign[product.id]=target;renderItems();renderGroups();status(word('Moved {count} items. Save groups to keep the change.',{count:shown().length}));};
  q('.count-groups-form').onsubmit=event=>{event.preventDefault();save();};
 }
 const q=selector=>dialog.querySelector(selector);
 function uniqueName(base){let name=base,n=2;while(state.groups.some(group=>group.name.trim().toLowerCase()===name.toLowerCase()))name=base+' '+n++;return name;}
 function status(text,error=false){q('.count-groups-status').textContent=text;q('.count-groups-status').classList.toggle('error',error);}
 const groupOptions=(select,extra=[])=>{const value=select.value;select.replaceChildren();for(const [id,name] of [...extra,...state.groups.map(group=>[group.id,group.name.trim()||word('Unnamed group')]),[NONE,word('Not grouped')]]){const option=el('option',name);option.value=id;select.append(option);}select.value=[...select.options].some(option=>option.value===value)?value:select.options[0]?.value||'';window.appSelects?.refresh(select);};
 function counts(){const map=new Map();for(const id of Object.values(state.assign))map.set(id,(map.get(id)||0)+1);return map;}
 function renderGroups(){
  const list=q('.count-groups-rows'),focus=document.activeElement?.closest?.('.count-groups-row')?.dataset.id,field=document.activeElement?.className;list.replaceChildren();const totals=counts();
  state.groups.forEach((group,index)=>{
   const row=el('li',undefined,'count-groups-row');row.dataset.id=group.id;
   const name=el('input',undefined,'count-groups-name');name.value=group.name;name.maxLength=40;name.required=true;name.setAttribute('aria-label',word('Group name'));name.dataset.userText='';name.oninput=()=>{group.name=name.value;groupOptions(q('.count-groups-filter'),[['all',word('All items')]]);groupOptions(q('.count-groups-move-to'));for(const select of dialog.querySelectorAll('.count-groups-item-select'))refreshSelect(select);};
   const icon=window.categoryIcons?.button({current:group.icon,label:word('Icon for {name}',{name:group.name||word('group')}),onPick(id){group.icon=id;}});
   const count=el('span',String(totals.get(group.id)||0),'count-groups-count');count.title=word('Items in this group');
   const up=el('button','↑','count-groups-icon'),down=el('button','↓','count-groups-icon'),remove=el('button','×','count-groups-icon count-groups-remove');for(const button of [up,down,remove])button.type='button';
   up.setAttribute('aria-label',word('Move {name} up',{name:group.name}));down.setAttribute('aria-label',word('Move {name} down',{name:group.name}));remove.setAttribute('aria-label',word('Delete {name}',{name:group.name}));
   up.disabled=index===0;down.disabled=index===state.groups.length-1;remove.disabled=state.groups.length===1;
   up.onclick=()=>{state.groups.splice(index-1,0,...state.groups.splice(index,1));render();dialog.querySelector('.count-groups-row[data-id="'+group.id+'"] .count-groups-icon')?.focus();};
   down.onclick=()=>{state.groups.splice(index+1,0,...state.groups.splice(index,1));render();dialog.querySelectorAll('.count-groups-row[data-id="'+group.id+'"] .count-groups-icon')[1]?.focus();};
   remove.onclick=()=>{const items=totals.get(group.id)||0;if(items&&!confirm(word('Delete {name}? Its {count} items move to Not grouped.',{name:group.name,count:items})))return;state.groups.splice(index,1);for(const [id,value] of Object.entries(state.assign))if(value===group.id)state.assign[id]=NONE;render();q('.count-groups-add').focus();};
   row.append(...[icon].filter(Boolean),name,count,up,down,remove);list.append(row);
  });
  if(focus){const target=list.querySelector('.count-groups-row[data-id="'+focus+'"] .'+(field||'').split(' ')[0]);target?.focus();}
 }
 function shown(){const query=q('.count-groups-search').value.trim().toLowerCase(),filter=q('.count-groups-filter').value;return state.products.filter(product=>(filter==='all'||state.assign[product.id]===filter)&&(!query||[product.name,product.unitAmount,product.supplier,product.sku].join(' ').toLowerCase().includes(query)));}
 function refreshSelect(select){groupOptions(select);select.value=state.assign[select.dataset.id];window.appSelects?.refresh(select);}
 function renderItems(){
  const list=q('.count-groups-item-rows'),items=shown();list.replaceChildren();
  for(const product of items){const row=el('li',undefined,'count-groups-item'),text=el('span',undefined,'count-groups-item-text'),name=el('strong',product.name);name.dataset.userText='';text.append(name);const meta=[product.unitAmount,product.supplier].filter(Boolean).join(' · ');if(meta){const small=el('small',meta);small.dataset.userText='';text.append(small);}
   const select=el('select',undefined,'count-groups-item-select');select.dataset.id=product.id;select.setAttribute('aria-label',word('Group for {name}',{name:product.name}));refreshSelect(select);select.onchange=()=>{state.assign[product.id]=select.value;renderGroups();if(q('.count-groups-filter').value!=='all')renderItems();};
   row.append(text,select);list.append(row);}
  if(!items.length)list.append(el('li',word('No items match.'),'count-groups-empty'));
  q('.count-groups-shown').textContent=word('{count} of {total} items',{count:items.length,total:state.products.length});
  q('.count-groups-move').hidden=!items.length;
 }
 function render(){groupOptions(q('.count-groups-filter'),[['all',word('All items')]]);groupOptions(q('.count-groups-move-to'));renderGroups();renderItems();}
 async function open(options={}){
  if(!dialog)build();onSaved=options.onSaved||null;opener=document.activeElement;status(word('Loading…'));q('.count-groups-save').disabled=true;dialog.showModal();
  try{const response=await fetch('/api/catalogue',{cache:'no-store',headers:window.appLocationId?{'X-Location-Id':window.appLocationId}:{}});const catalogue=await response.json();if(!response.ok)throw Error(catalogue.error||word('Unable to load stock.'));
   const list=stockCountGroups.list(catalogue);
   state={revision:catalogue.countGroupsRevision||0,groups:list.map(group=>({id:group.id,name:group.name,icon:group.icon||null})),products:[...catalogue.products].sort((a,b)=>a.name.localeCompare(b.name,'en-AU')),assign:Object.fromEntries(catalogue.products.map(product=>[product.id,stockCountGroups.resolve(product,catalogue)]))};
   state.original=JSON.stringify({g:state.groups,a:state.assign});q('.count-groups-search').value='';q('.count-groups-filter').value='all';render();status('');q('.count-groups-save').disabled=false;q('.count-groups-add').focus();
  }catch(error){status(error.message,true);}
 }
 function close(force=false){if(saving)return;if(!force&&dirty()&&!confirm(word('Close without saving your group changes?')))return;dialog.close();state=null;opener?.focus?.();}
 async function save(){
  if(saving||!state)return;const names=state.groups.map(group=>group.name.trim());
  if(names.some(name=>!name)){status(word('Give every group a name.'),true);dialog.querySelectorAll('.count-groups-name')[names.findIndex(name=>!name)]?.focus();return;}
  const seen=new Set();for(const name of names){if(seen.has(name.toLowerCase())){status(word('Two groups are called {name}. Use different names.',{name}),true);return;}seen.add(name.toLowerCase());}
  saving=true;q('.count-groups-save').disabled=true;status(word('Saving groups…'));
  try{const session=await window.appAccess?.initialSession?.();const response=await fetch('/api/products/count-groups',{method:'PUT',headers:{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||'',...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})},body:JSON.stringify({revision:state.revision,groups:state.groups.map(group=>({id:group.id,name:group.name.trim(),icon:group.icon||null})),assignments:state.assign})});const result=await response.json();
   if(!response.ok)throw Object.assign(Error(result.error||word('Unable to save groups.')),{status:response.status});
   saving=false;dialog.close();state=null;onSaved?.(result);opener?.focus?.();
  }catch(error){saving=false;q('.count-groups-save').disabled=false;status(error.status===409?word('Someone else changed the groups. Close and open Edit groups again to see the latest.'):error.message,true);}
 }
 window.stockCountGroupsEditor={open};
})();
