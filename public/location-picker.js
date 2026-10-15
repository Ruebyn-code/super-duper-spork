// Shared in-app selectors preserve native form values, validation and change handlers.
(()=>{
 const widgets=new Map();let counter=0;
 const wording=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 function identity(select){
  if(select.dataset.editId)return select.dataset.editId;
  if(typeof elementIdentity==='function')return elementIdentity(select);
  if(typeof appEditParts!=='object')return '';
  const anchor=select.parentElement?.closest('[data-edit-id]');if(!anchor)return '';const path=[];
  for(let part=select;part&&part!==anchor;part=part.parentElement){const peers=[...part.parentElement.children].filter(peer=>peer.tagName===part.tagName);path.unshift(part.tagName.toLowerCase()+':'+peers.indexOf(part));}
  return appEditParts.childIdentity(anchor.dataset.editId,path);
 }
 function enhance(select,settings={}){
  if(!select||widgets.has(select))return widgets.get(select);
  const locationControl=Boolean(settings.host||settings.optionPart||select.id==='account-location'),generic=!locationControl,originalLabel=select.labels?.[0],labelText=originalLabel?[...originalLabel.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim():'';
  const fallbackLabel=settings.label||select.getAttribute('aria-label')||labelText||wording(generic?'Choose an option':'Location'),searchLabel=settings.searchLabel||(generic?'Search options':'Search locations'),optionPart=settings.optionPart||(generic?'select-option':'location-option'),ownedHost=!settings.host;
  const editId=identity(select);if(editId&&!select.dataset.editId)select.dataset.editId=editId;
  // Give the new wrapper its own identity; the visible control retains the field's saved edits.
  const host=settings.host||document.createElement('div');host.classList.add('location-picker');if(generic)host.classList.add('app-select');if(ownedHost){if(editId)host.dataset.editId=typeof appEditParts==='object'?appEditParts.childIdentity(editId,['host']):'select-host:'+editId;select.before(host);host.append(select);}
  const button=settings.trigger||document.createElement('button');if(button.tagName==='BUTTON')button.type='button';else{button.removeAttribute('href');button.tabIndex=0;}button.classList.add('location-select-trigger');button.id=(select.id||'app-select-'+(++counter))+'-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');if(!settings.trigger)button.dataset.appPart='field';button.dataset.selectControl='';if(editId&&!settings.trigger)button.dataset.editId=editId;
  if(generic){button.classList.add('app-select-trigger');host.dataset.selectId=select.id||button.id;}
  let display=settings.displayLabel;
  if(display){for(const child of settings.contents||[display])button.append(child);}else{display=document.createElement('span');display.className='location-picker-value';display.dataset.userText='';const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 24 24');arrow.setAttribute('aria-hidden','true');arrow.setAttribute('width','16');arrow.setAttribute('height','16');arrow.setAttribute('fill','none');arrow.setAttribute('stroke','currentColor');arrow.setAttribute('stroke-width','1.8');arrow.innerHTML='<path d="m6 9 6 6 6-6"/>';arrow.classList.add('location-picker-arrow');button.append(display,arrow);}
  const menu=document.createElement('div');menu.className='location-picker-menu'+(generic?' app-select-menu':'');menu.setAttribute('popover','auto');menu.id=button.id+'-menu';menu.dataset.editId=locationControl?'location-menu:'+(editId||select.id||counter):typeof appEditParts==='object'?appEditParts.childIdentity(editId||button.id,['menu']):'select-menu:'+(editId||button.id);
  const search=document.createElement('input');search.type='search';search.className='location-picker-search';search.autocomplete='off';
  const list=document.createElement('div');list.className='location-picker-options';list.id=button.id+'-options';list.setAttribute('role','listbox');button.setAttribute('aria-controls',list.id);
  const searchControl=document.createElement('div');searchControl.className='catalogue-search select-search';searchControl.dataset.searchBound='';
  const searchToggle=document.createElement('button');searchToggle.type='button';searchToggle.className='search-toggle';searchToggle.setAttribute('aria-expanded','false');searchToggle.setAttribute('aria-controls',button.id+'-search-field');searchToggle.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></svg>';
  const searchField=document.createElement('div');searchField.className='search-field';searchField.id=button.id+'-search-field';searchField.inert=true;searchField.setAttribute('aria-hidden','true');search.tabIndex=-1;searchField.append(search);searchControl.append(searchToggle,searchField);
  const empty=document.createElement('p');empty.className='location-picker-empty';empty.setAttribute('role','status');empty.hidden=true;menu.append(searchControl,list,empty);
  const done=document.createElement('button');done.type='button';done.className='select-menu-done';done.textContent=wording('Done');menu.append(done);
  function menuHost(){return select.closest('dialog,[popover]')||document.body;}
  menuHost().append(menu);if(select.closest('[data-copy-editor]'))menu.dataset.copyEditor='';host.append(button);select.classList.add('location-select-native');select.hidden=true;select.tabIndex=-1;if(locationControl)select.dataset.userText='';
  const originalLabelFor=originalLabel?.getAttribute('for');if(originalLabel){if(!originalLabel.id)originalLabel.id=button.id+'-label';originalLabel.htmlFor=button.id;}
  let entries=[],shown=[],active=-1,open=false,buffer='',bufferTimer,anchor,scheduled=false,destroyed=false;
  function setSearchOpen(value,focus=true){searchControl.classList.toggle('search-open',value);searchToggle.setAttribute('aria-expanded',String(value));searchField.inert=!value;searchField.setAttribute('aria-hidden',String(!value));search.tabIndex=value?0:-1;searchToggle.setAttribute('aria-label',wording(value?'Close search':searchLabel));searchToggle.title=searchToggle.getAttribute('aria-label');if(!value&&search.value){search.value='';if(open)render();}if(focus)(value?search:searchToggle).focus({preventScroll:true});}
  searchToggle.onclick=()=>setSearchOpen(!searchControl.classList.contains('search-open'));searchToggle.onkeydown=event=>{if(event.key==='Escape')keyboard(event);else if(event.key==='Tab'){if(event.shiftKey){event.preventDefault();button.focus();}else if(!searchControl.classList.contains('search-open'))close();}};
  function label(){return select.getAttribute('aria-label')||fallbackLabel;}
  function position(){
   if(!open)return;if(!select.isConnected||!button.getClientRects().length||select.closest('dialog:not([open]),[hidden]:not(select)')){close(false);return;}
   const rect=button.getBoundingClientRect(),viewport=window.visualViewport,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
   anchor={x:scrollX,y:scrollY,left:rect.left,top:rect.top};
   const menuWidth=Math.min(Math.max(rect.width,260),width-24),below=top+height-rect.bottom-12,above=rect.top-top-12,down=below>=Math.min(320,above),room=Math.max(70,Math.min(360,down?below:above));
   menu.style.width=menuWidth+'px';menu.style.maxHeight=room+'px';menu.style.left=Math.max(left+12,Math.min(rect.left,left+width-menuWidth-12))+'px';menu.style.top=down?(rect.bottom+6)+'px':'auto';menu.style.bottom=down?'auto':(innerHeight-rect.top+6)+'px';
  }
  function activate(index){
   if(!shown.length||index<0){active=-1;button.removeAttribute('aria-activedescendant');search.removeAttribute('aria-activedescendant');return;}
   active=Math.max(0,Math.min(index,shown.length-1));for(const option of list.querySelectorAll('[role=option]'))option.classList.toggle('is-active',Number(option.dataset.selectIndex)===active);
   const option=list.querySelector('[data-select-index="'+active+'"]');if(option){button.setAttribute('aria-activedescendant',option.id);search.setAttribute('aria-activedescendant',option.id);option.scrollIntoView({block:'nearest'});}
  }
  function render(){
   const query=search.value.trim().toLocaleLowerCase();shown=entries.filter(entry=>!entry.hidden&&(entry.name+' '+entry.group).toLocaleLowerCase().includes(query));list.replaceChildren();let previousGroup;
   for(const [index,entry] of shown.entries()){
    if(entry.group&&entry.group!==previousGroup){const heading=document.createElement('div');heading.className='select-option-group';heading.textContent=entry.group;heading.dataset.userText='';list.append(heading);}previousGroup=entry.group;
    const option=document.createElement('button');option.type='button';option.className='location-picker-option'+(generic?' app-select-option':'');option.id=list.id+'-'+entry.index;option.tabIndex=-1;option.setAttribute('role','option');option.setAttribute('aria-selected',String(entry.option.selected));option.disabled=entry.disabled;option.dataset.selectIndex=index;option.dataset.selectValue=entry.value;option.dataset.locationValue=entry.value;option.dataset.appPart=optionPart;if(settings.company)option.dataset.companyValue=entry.value;option.dataset.editId=typeof appEditParts==='object'?appEditParts.childIdentity(optionPart+':'+(editId||button.id),[entry.value]):optionPart+':'+button.id+':'+entry.index;option.setAttribute('aria-disabled',String(entry.disabled));
    const name=document.createElement('span');name.textContent=entry.name;name.dataset.userText='';const tick=document.createElementNS('http://www.w3.org/2000/svg','svg');tick.setAttribute('viewBox','0 0 24 24');tick.setAttribute('width','18');tick.setAttribute('height','18');tick.setAttribute('fill','none');tick.setAttribute('stroke','currentColor');tick.setAttribute('stroke-width','2');tick.setAttribute('aria-hidden','true');tick.innerHTML='<path d="m5 12 4 4L19 6"/>';tick.classList.add('location-picker-check');tick.toggleAttribute('hidden',!entry.option.selected);
    option.append(name,tick);settings.renderOption?.(option,entry);option.onpointerdown=event=>{if(event.pointerType==='mouse')event.preventDefault();};option.onpointermove=event=>{if(event.pointerType==='mouse'&&active!==index)activate(index);};option.onclick=()=>choose(index);list.append(option);
   }
   empty.textContent=wording(entries.length?(settings.emptySearch||(generic?'No options match your search.':'No locations match your search.')):(settings.emptyLabel||(generic?'No options available.':'No locations available.')));empty.hidden=shown.length>0;
   const selected=shown.findIndex(entry=>entry.option.selected&&!entry.disabled);activate(selected>=0?selected:shown.findIndex(entry=>!entry.disabled));
  }
  function sync(){
   if(destroyed)return;const disabled=select.matches(':disabled'),nextDisabled=disabled||select.options.length===0;button.disabled=nextDisabled;button.setAttribute('aria-disabled',String(nextDisabled));button.setAttribute('aria-label',wording(label()));button.setAttribute('aria-required',String(select.required));list.setAttribute('aria-label',wording(label()));list.setAttribute('aria-multiselectable',String(select.multiple));search.placeholder=wording(searchLabel);search.setAttribute('aria-label',wording(searchLabel));done.textContent=wording('Done');done.hidden=!select.multiple;
   const description=select.getAttribute('aria-describedby');if(description)button.setAttribute('aria-describedby',description);else button.removeAttribute('aria-describedby');
   const name=[...select.selectedOptions].map(option=>option.label).join(', ')||wording(generic?'Choose an option':'Choose a location');if(!settings.holdWhileBusy||!disabled){if(display.textContent!==name)display.textContent=name;}
   button.title=display.textContent;button.classList.toggle('is-placeholder',!select.selectedOptions.length||(!select.multiple&&!select.value));entries=[...select.options].map((option,index)=>({option,index,value:option.value,name:option.label,group:option.parentElement.tagName==='OPTGROUP'?option.parentElement.label:'',hidden:option.hidden||Boolean(option.parentElement.closest('[hidden]:not(select)')),disabled:option.disabled||Boolean(option.parentElement.disabled)||Boolean(select.required&&!option.value)}));searchControl.hidden=entries.filter(entry=>!entry.hidden).length<=6;searchToggle.setAttribute('aria-label',wording(searchControl.classList.contains('search-open')?'Close search':searchLabel));searchToggle.title=searchToggle.getAttribute('aria-label');
   if(open){if(button.disabled)close(false);else{render();position();}}
  }
  function scheduleSync(){if(scheduled||destroyed)return;scheduled=true;queueMicrotask(()=>{scheduled=false;sync();});}
  function close(focus=true){open=false;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');search.removeAttribute('aria-activedescendant');if(menu.matches(':popover-open'))menu.hidePopover();if(focus&&button.isConnected&&!button.disabled)button.focus({preventScroll:true});}
  function show(){
   sync();if(button.disabled)return;for(const other of widgets.values())if(other.select!==select)other.close(false);setSearchOpen(false,false);const parent=menuHost();if(menu.parentElement!==parent)parent.append(menu);
   menu.showPopover({source:button});open=true;button.setAttribute('aria-expanded','true');position();render();button.focus({preventScroll:true});
  }
  function choose(index){
   const entry=shown[index];if(!entry||entry.disabled||button.disabled)return;const previous=select.value;
   if(select.multiple)entry.option.selected=!entry.option.selected;else{close();select.value=entry.value;}
   if(select.multiple||entry.value!==previous){select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}
   if(select.validity.valid)button.removeAttribute('aria-invalid');sync();
  }
  function next(delta){let index=active;for(let count=0;count<shown.length;count++){index=(index+delta+shown.length)%shown.length;if(!shown[index].disabled){activate(index);return;}}}
  function keyboard(event){
   if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();if(searchControl.contains(event.target)&&searchControl.classList.contains('search-open'))setSearchOpen(false);else close();return;}
   if(event.key==='Tab'&&open){if(event.target===button&&!searchControl.hidden&&!event.shiftKey){event.preventDefault();searchToggle.focus();}else if(event.target===search){if(event.shiftKey){event.preventDefault();searchToggle.focus();}else close();}else close(false);return;}
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const wasOpen=open;if(!open)show();if(event.key==='Home')activate(shown.findIndex(entry=>!entry.disabled));else if(event.key==='End')activate(shown.findLastIndex(entry=>!entry.disabled));else if(wasOpen)next(event.key==='ArrowDown'?1:-1);return;}
   if(event.key==='Enter'||(event.key===' '&&event.target!==search)){event.preventDefault();event.stopPropagation();if(open)choose(active);else show();return;}
   if(event.target===search)return;
   if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();if(!open)show();clearTimeout(bufferTimer);buffer+=event.key.toLocaleLowerCase();bufferTimer=setTimeout(()=>buffer='',750);const index=shown.findIndex(entry=>!entry.disabled&&entry.name.toLocaleLowerCase().startsWith(buffer));if(index>=0)activate(index);}
  }
  button.onclick=event=>{event.preventDefault();open?close():show();};button.onkeydown=keyboard;search.onkeydown=keyboard;search.oninput=()=>{render();position();};done.onclick=()=>close();menu.addEventListener('toggle',event=>{if(event.newState==='closed'){open=false;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');search.removeAttribute('aria-activedescendant');}});
  select.addEventListener('change',scheduleSync);select.addEventListener('input',scheduleSync);const invalid=event=>{event.preventDefault();button.setAttribute('aria-invalid','true');show();};select.addEventListener('invalid',invalid);const reset=()=>queueMicrotask(()=>{close(false);button.removeAttribute('aria-invalid');sync();});select.form?.addEventListener('reset',reset);
  // Forms also set .value and .selectedIndex without firing change events.
  const descriptors=new Map();for(const property of ['value','selectedIndex']){const native=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,property);if(!native?.set||Object.hasOwn(select,property))continue;descriptors.set(property,Object.getOwnPropertyDescriptor(select,property));Object.defineProperty(select,property,{configurable:true,get(){return native.get.call(this);},set(value){native.set.call(this,value);scheduleSync();}});}
  const ownFocus=Object.getOwnPropertyDescriptor(select,'focus');Object.defineProperty(select,'focus',{configurable:true,value:options=>button.focus(options)});
  const observer=new MutationObserver(scheduleSync);observer.observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','required','selected','label','value','hidden','multiple','aria-label','aria-describedby']});const resize=new ResizeObserver(position);resize.observe(button);
  const widget={select,button,menu,sync,close,position,onScroll(){if(!open||!anchor)return;const rect=button.getBoundingClientRect();if(scrollX!==anchor.x||scrollY!==anchor.y||Math.abs(rect.left-anchor.left)>1||Math.abs(rect.top-anchor.top)>1)close(false);},destroy(){close(false);destroyed=true;observer.disconnect();resize.disconnect();clearTimeout(bufferTimer);select.removeEventListener('change',scheduleSync);select.removeEventListener('input',scheduleSync);select.removeEventListener('invalid',invalid);select.form?.removeEventListener('reset',reset);for(const [property,descriptor] of descriptors){if(descriptor)Object.defineProperty(select,property,descriptor);else delete select[property];}if(ownFocus)Object.defineProperty(select,'focus',ownFocus);else delete select.focus;if(originalLabel){if(originalLabelFor===null)originalLabel.removeAttribute('for');else originalLabel.htmlFor=originalLabelFor;}menu.remove();button.remove();if(ownedHost&&!host.querySelector('select'))host.remove();widgets.delete(select);}};widgets.set(select,widget);sync();return widget;
 }
 function discover(root=document){if(root.nodeType!==Node.ELEMENT_NODE&&root!==document)return;if(root.matches?.('select'))enhance(root);for(const select of root.querySelectorAll('select'))enhance(select);}
 const api={enhance,refresh:select=>widgets.get(select)?.sync(),get:select=>widgets.get(select),closeAll:()=>{for(const widget of widgets.values())widget.close(false);}};window.locationPickers=api;window.appSelects=api;
 new MutationObserver(records=>{
  for(const record of records){if(record.type==='childList'){for(const child of record.addedNodes)discover(child);}else if(record.target.tagName==='FIELDSET')for(const widget of widgets.values())widget.sync();}
  if(records.some(record=>record.removedNodes?.length))for(const widget of widgets.values())if(!widget.select.isConnected)widget.destroy();
 }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
 window.addEventListener('resize',()=>{for(const widget of widgets.values())widget.position();});window.visualViewport?.addEventListener('resize',()=>{for(const widget of widgets.values())widget.position();});window.visualViewport?.addEventListener('scroll',()=>{for(const widget of widgets.values())widget.position();});document.addEventListener('scroll',event=>{if(event.target.closest?.('.location-picker-menu'))return;for(const widget of widgets.values())widget.onScroll();},true);window.addEventListener('interface-text-updated',()=>{for(const widget of widgets.values())widget.sync();});window.addEventListener('app-edit-mode-changed',()=>api.closeAll());discover();
})();
