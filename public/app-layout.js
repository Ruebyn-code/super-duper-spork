/* Company page layouts. Existing nodes move together, retaining forms and handlers. */
(()=>{
 const model=window.appLayoutModel,page=window.appBootstrap?.layoutPage;if(!model?.pages.includes(page))return;
 const clone=value=>JSON.parse(JSON.stringify(value)),initial=window.appBootstrap?.layout||{revision:0,groups:{}};
 let saved=clone(initial),draft=clone(initial.groups),editing=false,arranging=false,csrf='',busy=false,selectedGroup='',selectedItem='',groups=new Map(),scheduled=false,drag=null;
 const defaults=new Map(),undo=[],staticNodes=new WeakSet(document.querySelectorAll('*')),uiSelector='[data-layout-ui],.unified-app-editor,.app-edit-indicator,#admin-edit-controls,.location-picker-menu';
 const attrs=element=>Object.fromEntries([...element.attributes].map(attribute=>[attribute.name,attribute.value]));
 function identity(element){
  let id=model.key(attrs(element));if(id)return id;
  if(typeof elementIdentity==='function'){const inherited=elementIdentity(element);if(model.validId(inherited)){element.dataset.editId=inherited;element.dataset.appPart=appEditParts.typeOf(element);return inherited;}}
  const parent=element.parentElement;if(!parent)return '';const peers=[...parent.children].filter(peer=>peer.tagName===element.tagName&&!peer.matches(uiSelector));
  id=appEditParts.childIdentity(identity(parent)||'layout-'+page,[element.tagName.toLowerCase()+':'+peers.indexOf(element)]);
  element.dataset.editId=id;element.dataset.appPart=appEditParts.typeOf(element);return id;
 }
 const containerSelector='main,section,article,nav,div,form,fieldset,details,tbody';
 function groupKey(parent){if(staticNodes.has(parent))return identity(parent);if(parent.dataset.layoutGroup)return parent.dataset.layoutGroup;let anchor=parent.parentElement;while(anchor&&!staticNodes.has(anchor))anchor=anchor.parentElement;return parent.dataset.layoutGroup=appEditParts.childIdentity(anchor?identity(anchor):page,['group:'+identity(parent)]);}
 const excluded='.app-shell,.app-page,.admin-sidebar,.secondary-sidebar,.sidebar-scroll,.sidebar-footer,.mobile-brand-header,.password-control,.quantity,.add-controls,.location-picker,.admin-record-header,.pagination,.date-control,.expanding-search';
 function canGroup(element){return element.matches(containerSelector)&&!element.matches(excluded)&&!element.closest(uiSelector);}
 function canMove(element,parent){
  if(element.closest(uiSelector)||element.matches('script,style,[role=status],.user-editor-row,.empty,.small,.description,.sku'))return false;
  if(parent.tagName==='TBODY')return element.matches('.user-record,.location-record,.company-record');
  return element.matches('section,article,nav,aside,div,form,fieldset,details,label')||(element.tagName==='A'&&parent.matches('nav,.home-admin-links'))||element.matches('img.app-logo');
 }
 function units(parent){const result=[];for(const element of parent.children){if(!canMove(element,parent))continue;const nodes=[element];if(element.tagName==='TR'&&element.nextElementSibling?.matches('.user-editor-row'))nodes.push(element.nextElementSibling);result.push({key:identity(element),element,nodes});}return result;}
 function visible(unit){return !unit.element.closest('[hidden]')&&unit.element.getClientRects().length>0&&getComputedStyle(unit.element).visibility!=='hidden';}
 function remember(groupKey,keys,parent){
  if(!defaults.has(groupKey)){let original;try{original=JSON.parse(decodeURIComponent(parent?.dataset.layoutDefault||''));}catch{}defaults.set(groupKey,Array.isArray(original)?original:keys);}
  const existing=defaults.get(groupKey),known=new Set(existing);for(const key of keys)if(!known.has(key)){existing.push(key);known.add(key);}
 }
 function reorder(group,order){
  const sorted=model.ordered(group.units,order,unit=>unit.key);if(sorted.every((unit,index)=>unit===group.units[index]))return;
  const markers=group.units.map(unit=>{const marker=document.createComment('layout');unit.element.before(marker);return marker;});
  sorted.forEach((unit,index)=>{for(const node of unit.nodes)markers[index].before(node);});markers.forEach(marker=>marker.remove());group.units=sorted;
 }
 function collect(){
  observer.disconnect();
  try{
   // Freeze existing appearance identities before moving dynamic card contents.
   if(typeof elementIdentity==='function')for(const element of document.querySelectorAll([...appEditParts.visualTags].join(','))){if(element.dataset.editId||element.closest(uiSelector))continue;const id=elementIdentity(element);if(model.validId(id)){element.dataset.editId=id;element.dataset.appPart=appEditParts.typeOf(element);}}
   const next=new Map();for(const parent of document.querySelectorAll(containerSelector)){
    if(!canGroup(parent))continue;const entries=units(parent);if(entries.length<2)continue;const key=groupKey(parent);if(new Set(entries.map(unit=>unit.key)).size!==entries.length)continue;
    const group={key,parent,units:entries};remember(key,entries.map(unit=>unit.key),parent);reorder(group,draft[key]||defaults.get(key));next.set(key,group);
   }groups=next;
   if(arranging){if(!groups.has(selectedGroup)||!groups.get(selectedGroup).units.some(visible))chooseGroup(preferredGroup()?.key);refreshControls();positionHandles();}
  }finally{observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open']});}
 }
 function schedule(){if(scheduled||(!editing&&!Object.keys(draft).length))return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;collect();});}
 const observer=new MutationObserver(records=>{if(records.some(record=>!record.target.parentElement?.closest(uiSelector)&&!(record.target.nodeType===1&&record.target.closest(uiSelector))))schedule();});
 function groupName(group){
  const names={'home-main':'Home sections','home-overview':'Greeting and quarter panels','home-actions':'Home quick links'};
  if(names[group.key])return names[group.key];const parent=group.parent;
  if(parent.id==='menu')return 'Stock cards';if(parent.id==='count-items')return 'Stock groups';if(parent.tagName==='MAIN')return 'Page sections';
  if(parent.matches('.home-total-metrics,.ordering-budget-metrics,.sales-metrics,.sales-performance-metrics'))return 'Figures · '+(parent.closest('section')?.querySelector('h2,h3')?.textContent.trim()||'Dashboard');
  if(parent.matches('nav'))return parent.getAttribute('aria-label')||'Menu';
  return (parent.querySelector(':scope>h2,:scope>h3,:scope>summary h3')?.textContent.trim()||parent.getAttribute('aria-label')||parent.id?.replace(/[-_]/g,' ')||parent.className?.split(' ')[0]?.replace(/[-_]/g,' ')||'Section').slice(0,90);
 }
 function itemName(unit){return (unit.element.getAttribute('aria-label')||unit.element.querySelector('h1,h2,h3,.sidebar-label,.stock-name')?.textContent.trim()||unit.element.textContent.trim().replace(/\s+/g,' ')||unit.element.id||'Section').slice(0,75);}
 function preferredGroup(){const available=[...groups.values()].filter(group=>group.units.filter(visible).length>1);return available.find(group=>group.parent.tagName==='MAIN')||available.find(group=>group.parent.closest('main'))||available[0];}
 function info(element){for(let part=element;part&&part!==document.body;part=part.parentElement){const group=groups.get(groupKey(part.parentElement||part));const unit=group?.units.find(unit=>unit.element===part);if(unit&&group.units.filter(visible).length>1)return {group,unit};}return null;}
 function dirty(){return JSON.stringify(draft)!==JSON.stringify(saved.groups);}
 const overlay=document.createElement('div');overlay.className='app-layout-overlay';overlay.dataset.layoutUi='';overlay.dataset.copyEditor='';overlay.setAttribute('popover','manual');
 const toolbar=document.createElement('div');toolbar.className='app-layout-toolbar';toolbar.dataset.layoutUi='';toolbar.dataset.copyEditor='';toolbar.setAttribute('popover','manual');toolbar.setAttribute('role','region');toolbar.setAttribute('aria-label','Rearrange page');
 toolbar.innerHTML='<div class="layout-toolbar-heading"><strong>Rearrange</strong><span class="layout-company"></span><button type="button" class="layout-close" aria-label="Return to styling" title="Return to styling">×</button></div><div class="layout-toolbar-selection"><label class="visually-hidden" for="layout-area">Area</label><select id="layout-area"></select><label class="visually-hidden" for="layout-item">Section or card</label><select id="layout-item" class="layout-selected-name"></select><button type="button" class="layout-earlier" aria-label="Move selected section earlier" title="Move earlier">↑</button><button type="button" class="layout-later" aria-label="Move selected section later" title="Move later">↓</button></div><p class="layout-instructions">Drag a handle, or select a card and use the arrows.</p><div class="layout-toolbar-actions"><button type="button" class="layout-undo">Undo</button><button type="button" class="layout-restore">Restore page</button><button type="button" class="layout-discard">Discard</button><button type="button" class="layout-save">Save layout</button></div><p class="layout-status" role="status" aria-live="polite"></p>';
 toolbar.querySelector('.layout-company').textContent=window.appCompanyName;document.body.append(overlay,toolbar);
 const control=selector=>toolbar.querySelector(selector),area=control('#layout-area');let handles=[];
 function status(text){control('.layout-status').textContent=text;}
 function chooseGroup(key){selectedGroup=key||'';const visibleUnits=groups.get(selectedGroup)?.units.filter(visible)||[];if(!visibleUnits.some(unit=>unit.key===selectedItem))selectedItem=visibleUnits[0]?.key||'';}
 function refreshControls(){
  const focused=overlay.contains(document.activeElement);
  const available=[...groups.values()].filter(group=>group.units.filter(visible).length>1),previous=area.value;area.replaceChildren();
  for(const group of available){const option=document.createElement('option');option.value=group.key;option.textContent=groupName(group);area.append(option);}area.value=selectedGroup||previous;
  const active=groups.get(selectedGroup)?.units.filter(visible)||[],index=active.findIndex(unit=>unit.key===selectedItem);
  document.querySelectorAll('.app-layout-current').forEach(element=>element.classList.remove('app-layout-current'));if(index>=0)active[index].element.classList.add('app-layout-current');
  const itemSelect=control('#layout-item');itemSelect.replaceChildren();for(const unit of active){const option=document.createElement('option');option.value=unit.key;option.textContent=itemName(unit);itemSelect.append(option);}itemSelect.value=selectedItem;itemSelect.disabled=busy;control('.layout-earlier').disabled=busy||index<=0;control('.layout-later').disabled=busy||index<0||index===active.length-1;
  control('.layout-undo').disabled=busy||!undo.length;control('.layout-save').disabled=busy||!dirty();control('.layout-discard').disabled=busy||!dirty();control('.layout-restore').disabled=busy;area.disabled=busy;
  if(overlay.matches(':popover-open'))overlay.hidePopover();overlay.replaceChildren();handles=[];
  for(const unit of active){
   const handle=document.createElement('button');handle.type='button';handle.className='app-layout-handle';handle.dataset.layoutItem=unit.key;handle.dataset.layoutUi='';handle.draggable=true;handle.setAttribute('aria-label','Move '+itemName(unit));handle.title='Drag to move · arrow keys also work';handle.setAttribute('aria-pressed',String(unit.key===selectedItem));
   handle.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><circle cx="8" cy="5" r="1.5"/><circle cx="16" cy="5" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/></svg>';
   handle.onclick=()=>{selectedItem=unit.key;refreshControls();positionHandles();control('.layout-earlier').focus({preventScroll:true});};
   handle.onkeydown=event=>{if(['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(event.key)){event.preventDefault();selectedItem=unit.key;move(event.key==='ArrowUp'||event.key==='ArrowLeft'?-1:1);}};
   handle.ondragstart=event=>{if(busy){event.preventDefault();return;}selectedItem=unit.key;drag={key:unit.key,target:unit.key,after:false};event.dataTransfer.setData('text/plain',unit.key);event.dataTransfer.effectAllowed='move';document.body.classList.add('app-layout-dragging');};handle.ondragend=endDrag;
   handle.onpointerdown=event=>{if(event.pointerType==='mouse'||busy)return;selectedItem=unit.key;drag={key:unit.key,target:unit.key,after:false,touch:true,x:event.clientX,y:event.clientY,started:false};try{handle.setPointerCapture(event.pointerId);}catch{};};
   handle.onpointermove=event=>{if(!drag?.touch)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>8)drag.started=true;if(drag.started){event.preventDefault();document.body.classList.add('app-layout-dragging');dragOver(event.clientX,event.clientY);}};
   handle.onpointerup=event=>{if(!drag?.touch)return;const moved=drag.started;if(moved){event.preventDefault();drop();}else endDrag();};handle.onpointercancel=endDrag;
   overlay.append(handle);handles.push({handle,unit});
  }if(arranging)overlay.showPopover();if(focused)handles.find(entry=>entry.unit.key===selectedItem)?.handle.focus({preventScroll:true});
 }
 function positionHandles(){if(!arranging)return;for(const {handle,unit} of handles){const rect=unit.element.getBoundingClientRect();handle.style.left=Math.max(5,Math.min(innerWidth-39,rect.right-35))+'px';handle.style.top=rect.top+5+'px';handle.hidden=rect.bottom<35||rect.top>innerHeight-15||rect.right<10||rect.left>innerWidth-30;}}
 function applyChange(next){undo.push(clone(draft));draft=next;collect();window.dispatchEvent(new CustomEvent('app-layout-changed'));status('Unsaved layout · applies to everyone in '+window.appCompanyName+'.');}
 function moveTo(key,target,after=false){
  const group=groups.get(selectedGroup);if(!group||busy)return;const visibleKeys=group.units.filter(visible).map(unit=>unit.key);if(key===target||!visibleKeys.includes(key)||!visibleKeys.includes(target))return;
  const next=visibleKeys.filter(id=>id!==key),position=next.indexOf(target)+(after?1:0);next.splice(position,0,key);
  const changed={...draft,[group.key]:model.mergeOrder(draft[group.key]||defaults.get(group.key),next)};selectedItem=key;applyChange(changed);
 }
 function move(direction){const active=groups.get(selectedGroup)?.units.filter(visible)||[],index=active.findIndex(unit=>unit.key===selectedItem),target=active[index+direction];if(target)moveTo(selectedItem,target.key,direction>0);}
 function dragOver(x,y){
  if(!drag)return;let nearest=null,distance=Infinity;for(const unit of groups.get(selectedGroup)?.units.filter(visible)||[]){const rect=unit.element.getBoundingClientRect(),dx=Math.max(rect.left-x,0,x-rect.right),dy=Math.max(rect.top-y,0,y-rect.bottom),score=dx*dx+dy*dy;if(score<distance){distance=score;nearest={unit,rect};}}
  if(nearest){drag.target=nearest.unit.key;const horizontal=groups.get(selectedGroup).parent.matches('.home-actions,.home-total-metrics,.ordering-budget-metrics,.sales-metrics,.sales-performance-metrics')&&getComputedStyle(groups.get(selectedGroup).parent).gridTemplateColumns.split(' ').length>1;drag.after=horizontal?x>nearest.rect.left+nearest.rect.width/2:y>nearest.rect.top+nearest.rect.height/2;overlay.querySelectorAll('[data-drop-target]').forEach(handle=>handle.removeAttribute('data-drop-target'));handles.find(entry=>entry.unit.key===drag.target)?.handle.setAttribute('data-drop-target','');}
  if(y<70)window.scrollBy(0,-18);else if(y>innerHeight-90)window.scrollBy(0,18);
 }
 function endDrag(){drag=null;document.body.classList.remove('app-layout-dragging');overlay.querySelectorAll('[data-drop-target]').forEach(handle=>handle.removeAttribute('data-drop-target'));}
 function drop(){const current=drag;endDrag();if(current)moveTo(current.key,current.target,current.after);}
 document.addEventListener('dragover',event=>{if(!arranging||!drag)return;event.preventDefault();event.dataTransfer.dropEffect='move';dragOver(event.clientX,event.clientY);});document.addEventListener('drop',event=>{if(!arranging||!drag)return;event.preventDefault();drop();});
 function begin(element){if(!editing||busy)return;collect();const selected=element?info(element):null;arranging=true;document.body.classList.add('app-layout-arranging');chooseGroup(selected?.group.key||selectedGroup||preferredGroup()?.key);if(selected)selectedItem=selected.unit.key;refreshControls();positionHandles();if(!toolbar.matches(':popover-open'))toolbar.showPopover();status(dirty()?'Unsaved layout changes.':'Changes apply to everyone in '+window.appCompanyName+'.');}
 function close(){arranging=false;endDrag();document.body.classList.remove('app-layout-arranging');if(overlay.matches(':popover-open'))overlay.hidePopover();if(toolbar.matches(':popover-open'))toolbar.hidePopover();}
 async function save(){if(busy||!dirty())return;busy=true;refreshControls();status('Saving layout…');try{
  const response=await fetch('/api/layout',{method:'PUT',headers:{...companyHeaders(),'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({page,revision:saved.revision,groups:draft})}),result=await response.json();if(!response.ok)throw Error(result.error||'Unable to save layout.');saved=result;draft=clone(result.groups);undo.length=0;status('Layout saved for '+window.appCompanyName+'.');
 }catch(error){status(error.message);}finally{busy=false;refreshControls();positionHandles();}}
 async function discard(){if(busy)return;busy=true;try{const response=await fetch('/layouts?page='+page,{headers:companyHeaders()});if(!response.ok)throw Error('Unable to reload the saved layout.');saved=await response.json();draft=clone(saved.groups);undo.length=0;collect();window.dispatchEvent(new CustomEvent('app-layout-changed'));status('Saved layout restored.');}catch(error){status(error.message);}finally{busy=false;collect();}}
 area.onchange=()=>{chooseGroup(area.value);refreshControls();positionHandles();};control('#layout-item').onchange=()=>{selectedItem=control('#layout-item').value;const unit=groups.get(selectedGroup)?.units.find(unit=>unit.key===selectedItem);refreshControls();unit?.element.scrollIntoView({block:'center',inline:'nearest',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});positionHandles();};control('.layout-earlier').onclick=()=>move(-1);control('.layout-later').onclick=()=>move(1);control('.layout-save').onclick=save;control('.layout-discard').onclick=discard;
 control('.layout-undo').onclick=()=>{if(!undo.length||busy)return;draft=undo.pop();collect();window.dispatchEvent(new CustomEvent('app-layout-changed'));status(dirty()?'Move undone · changes are not saved.':'Move undone.');};
 control('.layout-restore').onclick=()=>{if(busy)return;applyChange({});status('Default page layout restored. Save layout to keep it.');};control('.layout-close').onclick=close;
 window.addEventListener('app-edit-mode-changed',event=>{editing=event.detail.enabled;csrf=event.detail.csrf;if(editing)collect();else close();});
 window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
 window.addEventListener('resize',schedule);document.addEventListener('scroll',positionHandles,true);window.addEventListener('hashchange',schedule);
 document.addEventListener('click',event=>{if(arranging&&!event.target.closest('[data-layout-ui],.app-edit-indicator,.unified-app-editor,#admin-edit-controls')){event.preventDefault();event.stopImmediatePropagation();const selected=info(event.target);if(selected){chooseGroup(selected.group.key);selectedItem=selected.unit.key;refreshControls();positionHandles();}}},true);
 window.appLayout={info,begin,save,close,dirty,isArranging:()=>arranging,preventExit(){if(busy||dirty()){begin();status(busy?'Wait for the layout to finish saving.':'Save or discard your layout changes before finishing App edit.');return true;}return false;},orderData(parent,data,kind='product'){const key=groupKey(parent),keys=data.map(item=>kind+':'+item.id);remember(key,keys,parent);return model.ordered(data,draft[key],item=>kind+':'+item.id);}};
 collect();document.addEventListener('DOMContentLoaded',schedule);
})();
