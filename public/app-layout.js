/* Company page layouts. Existing nodes move together, retaining forms and handlers. */
(()=>{
 const model=window.appLayoutModel,page=window.appBootstrap?.layoutPage;if(!model?.pages.includes(page))return;
 const clone=value=>JSON.parse(JSON.stringify(value)),initial=window.appBootstrap?.layout||{revision:0,groups:{}};
 let saved=clone(initial),draft=clone(initial.groups),editing=false,csrf='',busy=false,groups=new Map(),scheduled=false,drag=null,press=null,hovered=null,suppressUntil=0,saveError=null,toastTimer;
 const defaults=new Map(),undo=[],decorated=new Map(),animations=new Map(),staticNodes=new WeakSet(document.querySelectorAll('*')),uiSelector='hr,canvas,video,audio,iframe,[data-copy-editor],[data-app-no-edit],[inert],:disabled,[readonly],[aria-disabled="true"],[contenteditable]:not([contenteditable="false"]),[data-layout-ui],.unified-app-editor,.app-edit-indicator,#admin-edit-controls,.location-picker-menu';
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
   markMovables();if(hovered&&!hovered.unit.element.isConnected)setHover(null);
  }finally{observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','open']});}
 }
 function schedule(){if(drag)return;if(scheduled||(!editing&&!Object.keys(draft).length))return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;collect();});}
 const observer=new MutationObserver(records=>{if(!drag&&records.some(record=>!record.target.parentElement?.closest(uiSelector)&&!(record.target.nodeType===1&&record.target.closest(uiSelector))))schedule();});
 const semantic='section,article,aside,details,label,.product,.count-item,.management,.user-record,.location-record,.company-record';
 function isSemantic(unit,parent){return unit.element.matches(semantic)||parent.matches('main,nav,.home-actions,.home-overview,.home-total-metrics,.ordering-budget-metrics,.sales-metrics,.sales-performance-metrics');}
 function info(element){
  if(!element||element.closest(uiSelector))return null;let fallback=null;
  for(let part=element;part&&part!==document.body;part=part.parentElement){const parent=part.parentElement;if(!parent)break;const group=groups.get(groupKey(parent)),unit=group?.units.find(unit=>unit.element===part);if(!unit||group.units.filter(visible).length<2)continue;const result={group,unit};fallback||=result;if(isSemantic(unit,parent))return result;}
  return fallback;
 }
 function itemName(unit){return (unit.element.getAttribute('aria-label')||unit.element.querySelector('h1,h2,h3,.sidebar-label,.stock-name')?.textContent.trim()||unit.element.textContent.trim().replace(/\s+/g,' ')||'Section').slice(0,80);}
 function dirty(){return JSON.stringify(draft)!==JSON.stringify(saved.groups);}
 const node=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=text;return element;};
 const gripLayer=node('div','app-layout-grips'),ghostLayer=node('div','app-layout-ghost-layer'),toast=node('div','app-layout-toast');
 for(const layer of [gripLayer,ghostLayer,toast]){layer.dataset.layoutUi='';layer.dataset.copyEditor='';layer.setAttribute('popover','manual');document.body.append(layer);}
 const grip=node('button','app-layout-grip');grip.type='button';grip.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="8" cy="5" r="1.5"/><circle cx="16" cy="5" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="19" r="1.5"/><circle cx="16" cy="19" r="1.5"/></svg>';gripLayer.append(grip);
 const notice=node('span'),undoButton=node('button',null,'Undo'),retryButton=node('button',null,'Retry'),restoreButton=node('button',null,'Restore saved');
 notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');for(const button of [undoButton,retryButton,restoreButton])button.type='button';toast.append(notice,undoButton,retryButton,restoreButton);
 function hide(layer){if(layer.matches(':popover-open'))layer.hidePopover();}
 function status(text,kind='info'){
  clearTimeout(toastTimer);notice.textContent=text;toast.dataset.state=kind;
  undoButton.hidden=!undo.length||kind==='error';retryButton.hidden=kind!=='error'||saveError?.conflict;restoreButton.hidden=kind!=='error';
  if(!toast.matches(':popover-open'))toast.showPopover();if(kind==='saved'||kind==='info')toastTimer=setTimeout(()=>hide(toast),7000);
 }
 function setHover(next){
  if(hovered?.unit!==next?.unit)hovered?.unit.element.classList.remove('app-layout-hover');hovered=next;
  if(!editing||drag||!next||!visible(next.unit)){hide(gripLayer);return;}
  next.unit.element.classList.add('app-layout-hover');const rect=next.unit.element.getBoundingClientRect();
  grip.setAttribute('aria-label','Move '+itemName(next.unit));grip.title='Hold and drag to move · Alt + arrow keys also work';
  grip.style.left=Math.max(5,Math.min(innerWidth-39,rect.right-35))+'px';grip.style.top=Math.max(5,Math.min(innerHeight-45,rect.top+5))+'px';
  if(rect.bottom<0||rect.top>innerHeight){hide(gripLayer);return;}if(!gripLayer.matches(':popover-open'))gripLayer.showPopover();
 }
 function markMovables(){
  const next=new Set();if(editing)for(const group of groups.values())if(group.units.filter(visible).length>1)for(const unit of group.units)if(visible(unit))next.add(unit.element);
  for(const [element,tabindex] of decorated)if(!next.has(element)){element.removeAttribute('data-layout-movable');if(tabindex===null)element.removeAttribute('tabindex');else element.setAttribute('tabindex',tabindex);decorated.delete(element);}
  for(const element of next){if(!decorated.has(element))decorated.set(element,element.getAttribute('tabindex'));element.dataset.layoutMovable='';if(!element.hasAttribute('tabindex')&&!element.matches('a[href],button,input,textarea,select,summary'))element.tabIndex=0;}
 }
 function changed(next){undo.push(clone(draft));draft=next;collect();window.dispatchEvent(new CustomEvent('app-layout-changed'));collect();if(saveError?.conflict){status('This layout changed elsewhere. Restore the saved layout to continue.','error');return;}saveError=null;save();}
 async function save(){
  if(busy||!dirty()||saveError?.conflict)return;busy=true;const snapshot=clone(draft);status('Saving layout…','saving');
  try{const response=await fetch('/api/layout',{method:'PUT',headers:{...companyHeaders(),'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({page,revision:saved.revision,groups:snapshot})}),result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Unable to save this move.'),{conflict:response.status===409});saved=result;if(JSON.stringify(draft)===JSON.stringify(snapshot))draft=clone(result.groups);saveError=null;status('Layout saved for '+window.appCompanyName+'.','saved');}
  catch(error){saveError=error;status(error.conflict?'This layout changed elsewhere. Restore the saved layout to continue.':'Could not save this move. Retry, or restore the saved layout.','error');}
  finally{busy=false;if(dirty()&&!saveError)save();}
 }
 async function restoreSaved(){
  if(busy||drag)return;busy=true;status('Restoring saved layout…','saving');
  try{const response=await fetch('/layouts?page='+page,{headers:companyHeaders(),cache:'no-store'});if(!response.ok)throw Error('Unable to reload layout.');saved=await response.json();draft=clone(saved.groups);undo.length=0;saveError=null;collect();window.dispatchEvent(new CustomEvent('app-layout-changed'));collect();status('Saved layout restored.','saved');}
  catch(error){saveError=error;status('Could not restore the layout. Check your connection and try again.','error');}finally{busy=false;}
 }
 undoButton.onclick=()=>{if(!undo.length||drag)return;draft=undo.pop();collect();window.dispatchEvent(new CustomEvent('app-layout-changed'));collect();saveError=null;if(dirty())save();else status('Move undone.','saved');};
 retryButton.onclick=()=>{saveError=null;save();};restoreButton.onclick=restoreSaved;
 function logicalRect(element){const rect=element.getBoundingClientRect(),animation=animations.get(element);if(!animation)return rect;const [x=0,y=0]=getComputedStyle(element).translate.split(' ').map(value=>parseFloat(value)||0);return {left:rect.left-x,right:rect.right-x,top:rect.top-y,bottom:rect.bottom-y,width:rect.width,height:rect.height};}
 function animateOrder(group,order){
  const before=new Map(group.units.filter(visible).map(unit=>[unit.element,unit.element.getBoundingClientRect()]));
  for(const unit of group.units){animations.get(unit.element)?.cancel();animations.delete(unit.element);}reorder(group,order);
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  for(const unit of group.units){if(unit===drag?.unit)continue;const start=before.get(unit.element);if(!start)continue;const end=unit.element.getBoundingClientRect(),x=start.left-end.left,y=start.top-end.top;if(Math.abs(x)+Math.abs(y)<1)continue;
   const animation=unit.element.animate([{translate:x+'px '+y+'px'},{translate:'0px 0px'}],{duration:190,easing:'cubic-bezier(.2,.8,.2,1)'});animations.set(unit.element,animation);animation.finished.then(()=>{if(animations.get(unit.element)===animation)animations.delete(unit.element);},()=>{});
  }
 }
 function clearPress(){if(press){clearTimeout(press.timer);press.selection?.unit.element.classList.remove('app-layout-pressing');}press=null;}
 function makeGhost(selection,rect){
  const ghost=node('div','app-layout-ghost'),source=selection.unit.element,style=getComputedStyle(source);ghost.setAttribute('aria-hidden','true');ghost.inert=true;
  if(source.querySelectorAll('*').length>400){ghost.classList.add('app-layout-ghost-summary');ghost.append(node('strong',null,itemName(selection.unit)));}
  else{
   // A shadow preview keeps temporary copies out of app selectors and preserves
   // their appearance without relying on their original parent or element IDs.
   const copy=source.cloneNode(true),originals=[source,...source.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')],preview=ghost.attachShadow({mode:'open'});
   copies.forEach((element,index)=>{const computed=getComputedStyle(originals[index]);for(const attribute of [...element.attributes])if(attribute.name==='id'||attribute.name==='name'||attribute.name==='for'||attribute.name==='autofocus'||attribute.name.startsWith('data-'))element.removeAttribute(attribute.name);element.removeAttribute('tabindex');element.classList.remove('app-layout-hover','app-layout-pressing','app-layout-lifted');for(const property of computed)element.style.setProperty(property,computed.getPropertyValue(property));element.style.setProperty('outline','none','important');element.style.setProperty('animation','none','important');element.style.setProperty('transition','none','important');});
   copy.style.margin='0';copy.style.width='100%';copy.style.translate='none';copy.style.transform='none';if(source.tagName==='TR'){const table=node('table'),body=node('tbody');body.append(copy);table.append(body);table.style.width='100%';preview.append(table);}else preview.append(copy);
  }
  ghost.style.width=rect.width+'px';ghost.style.height=Math.min(rect.height,innerHeight*.65)+'px';ghost.style.fontFamily=style.fontFamily;ghost.style.color=style.color;ghost.style.backgroundColor=style.backgroundColor==='rgba(0, 0, 0, 0)'?'var(--surface,white)':style.backgroundColor;ghostLayer.replaceChildren(ghost);if(!ghostLayer.matches(':popover-open'))ghostLayer.showPopover();return ghost;
 }
 function beginDrag(candidate){
  if(!editing||drag||!candidate.selection.unit.element.isConnected)return;collect();const group=groups.get(candidate.selection.group.key),unit=group?.units.find(entry=>entry.key===candidate.selection.unit.key);if(!unit||!visible(unit))return;
  clearPress();observer.disconnect();hide(gripLayer);const rect=unit.element.getBoundingClientRect(),ghost=makeGhost({group,unit},rect);
  drag={group,unit,ghost,original:group.units.map(entry=>entry.key),before:group.units.filter(visible).map(entry=>entry.key),x:candidate.x,y:candidate.y,lastX:NaN,lastY:NaN,offsetX:candidate.x-rect.left,offsetY:Math.min(candidate.y-rect.top,parseFloat(ghost.style.height)-16),pointerId:candidate.pointerId,touch:candidate.touch};
  unit.element.classList.add('app-layout-lifted');document.body.classList.add('app-layout-dragging');suppressUntil=performance.now()+1000;
  if(!candidate.touch)try{document.body.setPointerCapture(candidate.pointerId);}catch{}
  status('Release to save · Escape cancels');requestAnimationFrame(dragFrame);
 }
 function autoScroll(current){
  const candidates=[];for(let element=current.group.parent;element&&element!==document.body;element=element.parentElement){const style=getComputedStyle(element);if(/auto|scroll/.test(style.overflow+style.overflowX+style.overflowY))candidates.push(element);}candidates.push(document.scrollingElement);
  for(const element of candidates){const root=element===document.scrollingElement,rect=root?{left:0,right:innerWidth,top:0,bottom:innerHeight-(matchMedia('(max-width:720px)').matches?80:0)}:element.getBoundingClientRect(),edge=52;
   const speed=(position,start,end)=>position<start+edge?-Math.min(20,(start+edge-position)*.32):position>end-edge?Math.min(20,(position-end+edge)*.32):0;
   const x=element.scrollWidth>element.clientWidth+1?speed(current.x,rect.left,rect.right):0,y=element.scrollHeight>element.clientHeight+1?speed(current.y,rect.top,rect.bottom):0;if(!x&&!y)continue;
   const left=element.scrollLeft,top=element.scrollTop;element.scrollBy({left:x,top:y,behavior:'instant'});if(element.scrollLeft!==left||element.scrollTop!==top)return true;
  }return false;
 }
 function preview(current){
  let nearest=null,score=Infinity;const units=current.group.units.filter(visible);
  for(const unit of units){const rect=logicalRect(unit.element),dx=Math.max(rect.left-current.x,0,current.x-rect.right),dy=Math.max(rect.top-current.y,0,current.y-rect.bottom),distance=dx*dx+dy*dy+Math.hypot(current.x-(rect.left+rect.width/2),current.y-(rect.top+rect.height/2))*.001;if(distance<score){nearest={unit,rect};score=distance;}}
  if(!nearest||nearest.unit===current.unit)return;
  const multiColumn=units.some(unit=>{if(unit===nearest.unit)return false;const rect=logicalRect(unit.element);return Math.abs(rect.top-nearest.rect.top)<Math.min(rect.height,nearest.rect.height)/2&&Math.abs(rect.left-nearest.rect.left)>20;});
  const after=current.y<nearest.rect.top?false:current.y>nearest.rect.bottom?true:multiColumn?current.x>nearest.rect.left+nearest.rect.width/2:current.y>nearest.rect.top+nearest.rect.height/2;
  const order=units.map(unit=>unit.key).filter(key=>key!==current.unit.key);order.splice(order.indexOf(nearest.unit.key)+(after?1:0),0,current.unit.key);
  if(order.every((key,index)=>key===units[index]?.key))return;animateOrder(current.group,model.mergeOrder(current.group.units.map(unit=>unit.key),order));
 }
 function dragFrame(){const current=drag;if(!current)return;if(!current.unit.element.isConnected||!current.group.parent.isConnected){endDrag(true);return;}
  current.ghost.style.transform='translate3d('+(current.x-current.offsetX)+'px,'+(current.y-current.offsetY)+'px,0) scale(1.015)';
  const scrolled=autoScroll(current);if(scrolled||Math.hypot(current.x-current.lastX,current.y-current.lastY)>2||Number.isNaN(current.lastX)){preview(current);current.lastX=current.x;current.lastY=current.y;}
  requestAnimationFrame(dragFrame);
 }
 function endDrag(cancel=false){
  clearPress();const current=drag;if(!current)return;drag=null;suppressUntil=performance.now()+700;
  if(cancel&&current.group.parent.isConnected&&current.group.units.every(unit=>unit.element.isConnected))animateOrder(current.group,current.original);
  const target=current.unit.element.isConnected?current.unit.element.getBoundingClientRect():null,land=()=>{if(drag?.unit.element!==current.unit.element)current.unit.element.classList.remove('app-layout-lifted');};document.body.classList.remove('app-layout-dragging');
  if(!current.touch)try{document.body.releasePointerCapture(current.pointerId);}catch{}
  const order=current.group.units.filter(visible).map(unit=>unit.key),moved=!cancel&&order.some((key,index)=>key!==current.before[index]);
  if(target&&!matchMedia('(prefers-reduced-motion:reduce)').matches){const from=current.ghost.style.transform,currentGhost=current.ghost;const animation=currentGhost.animate([{transform:from,opacity:1},{transform:'translate3d('+target.left+'px,'+target.top+'px,0) scale(1)',opacity:0}],{duration:160,easing:'ease-out'});animation.finished.then(()=>{land();if(!drag&&ghostLayer.contains(currentGhost))hide(ghostLayer);currentGhost.remove();},()=>{land();currentGhost.remove();});}else{land();hide(ghostLayer);current.ghost.remove();}
  if(moved)changed({...draft,[current.group.key]:model.mergeOrder(draft[current.group.key]||defaults.get(current.group.key),order)});else{collect();status(cancel?'Move cancelled.':'Hold a section or card, then drag it to move.');}setHover(null);
 }
 function candidate(target){return target.closest('.app-layout-grip')?hovered:info(target);}
 function startPress(target,x,y,details){
  if(!drag&&!press)suppressUntil=0;
  if(!editing||drag||document.querySelector('dialog[open]')||target.closest(uiSelector)&&!target.closest('.app-layout-grip')||target.closest('input,textarea,select,[contenteditable=true]'))return false;
  const selection=candidate(target);if(!selection)return false;clearPress();const pending={selection,x,y,startX:x,startY:y,...details};press=pending;selection.unit.element.classList.add('app-layout-pressing');
  if(target.closest('.app-layout-grip'))beginDrag(pending);else pending.timer=setTimeout(()=>{if(press===pending)beginDrag(pending);},360);return true;
 }
 function movePointer(x,y){if(drag){drag.x=x;drag.y=y;return;}if(press&&Math.hypot(x-press.startX,y-press.startY)>9){clearPress();suppressUntil=performance.now()+500;}}
 document.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'||event.button!==0||!event.isPrimary)return;startPress(event.target,event.clientX,event.clientY,{pointerId:event.pointerId,touch:false});},true);
 document.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;if(drag||press)movePointer(event.clientX,event.clientY);else if(editing&&!event.target.closest('.app-layout-grip'))setHover(event.target.closest(uiSelector)?null:info(event.target));},true);
 document.addEventListener('pointerup',event=>{if(event.pointerType==='touch')return;if(drag){event.preventDefault();endDrag();}else clearPress();},true);
 document.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch'){if(drag)endDrag(true);else clearPress();}},true);
 const touchStart=event=>{if(event.touches.length!==1){if(drag)endDrag(true);clearPress();return;}const touch=event.touches[0];if(startPress(event.target,touch.clientX,touch.clientY,{touch:true})&&drag)event.preventDefault();};
 const touchMove=event=>{if(event.touches.length!==1){if(drag)endDrag(true);clearPress();return;}const touch=event.touches[0];if(drag)event.preventDefault();movePointer(touch.clientX,touch.clientY);};
 const touchEnd=event=>{if(drag){event.preventDefault();endDrag();}else clearPress();};
 const touchCancel=()=>{if(drag)endDrag(true);else clearPress();};
 document.addEventListener('contextmenu',event=>{if(editing&&(press||drag||info(event.target)))event.preventDefault();},true);
 document.addEventListener('dragstart',event=>{if(editing&&info(event.target))event.preventDefault();},true);
 document.addEventListener('click',event=>{if(editing&&performance.now()<suppressUntil&&!event.target.closest(uiSelector)){event.preventDefault();event.stopImmediatePropagation();}},true);
 function keyboardMove(selection,direction){if(!selection||drag||saveError?.conflict)return;const active=selection.group.units.filter(visible),index=active.indexOf(selection.unit),target=active[index+direction];if(!target)return;const order=active.map(unit=>unit.key);[order[index],order[index+direction]]=[order[index+direction],order[index]];changed({...draft,[selection.group.key]:model.mergeOrder(draft[selection.group.key]||defaults.get(selection.group.key),order)});selection.unit.element.focus({preventScroll:true});setHover(info(selection.unit.element));}
 document.addEventListener('keydown',event=>{
  if(!editing)return;if(event.key==='Escape'&&(drag||press)){event.preventDefault();event.stopImmediatePropagation();endDrag(true);return;}
  if(event.target.closest('dialog,input,textarea,select,[contenteditable=true]'))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'&&undo.length){event.preventDefault();undoButton.click();return;}
  if((event.altKey||event.target===grip)&&['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();keyboardMove(event.target===grip?hovered:info(event.target),event.key==='ArrowUp'||event.key==='ArrowLeft'?-1:1);}
 },true);
 grip.onclick=()=>hovered?.unit.element.focus({preventScroll:true});document.addEventListener('focusin',event=>{if(editing&&!drag&&!event.target.closest(uiSelector))setHover(info(event.target));});
 window.addEventListener('app-edit-mode-changed',event=>{
  editing=event.detail.enabled;csrf=event.detail.csrf;if(!editing){endDrag(true);clearPress();setHover(null);hide(toast);}collect();
  for(const [type,listener] of [['touchstart',touchStart],['touchmove',touchMove],['touchend',touchEnd],['touchcancel',touchCancel]]){if(editing)document.addEventListener(type,listener,{capture:true,passive:false});else document.removeEventListener(type,listener,true);}
 });
 window.addEventListener('beforeunload',event=>{if(dirty()||busy){event.preventDefault();event.returnValue='';}});
 window.addEventListener('before-location-switch',event=>{if(drag||busy||dirty()){event.preventDefault();status('Wait for the layout to save before switching locations or companies.',saveError?'error':'saving');}});
 window.addEventListener('blur',()=>{if(drag)endDrag(true);clearPress();});window.addEventListener('resize',()=>{if(drag)endDrag(true);schedule();});
 document.addEventListener('scroll',()=>{if(!drag&&hovered)setHover(hovered);},true);window.addEventListener('hashchange',()=>{if(drag)endDrag(true);clearPress();setHover(null);schedule();});
 window.appLayout={info,save,dirty,placeAfter(parent,key,after){collect();const group=groups.get(groupKey(parent));if(!group)return;const order=(draft[group.key]||group.units.map(unit=>unit.key)).filter(id=>id!==key),index=after===null?order.length:order.indexOf(after)+1;order.splice(index,0,key);changed({...draft,[group.key]:order});},isSaving:()=>busy,isArranging:()=>Boolean(drag)||performance.now()<suppressUntil,preventExit(){if(drag)endDrag(true);clearPress();if(busy||dirty()){status(saveError?'Retry or restore the saved layout before finishing App edit.':'Wait for your layout to finish saving.',saveError?'error':'saving');return true;}return false;},orderData(parent,data,kind='product'){const key=groupKey(parent),keys=data.map(item=>kind+':'+item.id);remember(key,keys,parent);return model.ordered(data,draft[key],item=>kind+':'+item.id);}};
 collect();document.addEventListener('DOMContentLoaded',schedule);
})();
