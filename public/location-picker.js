// In-app location menus keep the underlying form values and change handlers.
(()=>{
 const widgets=new Map();let counter=0;
 const wording=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 function enhance(select,settings={}){
  if(!select||widgets.has(select))return widgets.get(select);
  const originalLabel=select.labels?.[0],labelText=originalLabel?[...originalLabel.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim():'';
  const label=settings.label||select.getAttribute('aria-label')||labelText||'Location',searchLabel=settings.searchLabel||'Search locations',optionPart=settings.optionPart||'location-option';
  const host=settings.host||document.createElement('div');host.classList.add('location-picker');if(!settings.host){select.before(host);host.append(select);}
  const button=document.createElement('button');button.type='button';button.className='location-select-trigger';button.id=(select.id||'location-picker-'+(++counter))+'-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.dataset.appPart='field';
  if(!select.dataset.editId&&typeof elementIdentity==='function')select.dataset.editId=elementIdentity(select);if(select.dataset.editId)button.dataset.editId=select.dataset.editId;
  let display=settings.displayLabel;
  if(display){for(const node of settings.contents||[display])button.append(node);}else{display=document.createElement('span');display.className='location-picker-value';display.dataset.userText='';const arrow=document.createElementNS('http://www.w3.org/2000/svg','svg');arrow.setAttribute('viewBox','0 0 24 24');arrow.setAttribute('aria-hidden','true');arrow.setAttribute('width','16');arrow.setAttribute('height','16');arrow.setAttribute('fill','none');arrow.setAttribute('stroke','currentColor');arrow.setAttribute('stroke-width','1.8');arrow.innerHTML='<path d="m6 9 6 6 6-6"/>';arrow.classList.add('location-picker-arrow');button.append(display,arrow);}
  const menu=document.createElement('div');menu.className='location-picker-menu';menu.setAttribute('popover','auto');menu.id=button.id+'-menu';menu.dataset.editId='location-menu:'+(select.dataset.editId||select.id||counter);
  const search=document.createElement('input');search.type='search';search.className='location-picker-search';search.setAttribute('aria-label',wording(searchLabel));search.placeholder=wording(searchLabel);
  const list=document.createElement('div');list.className='location-picker-options';list.id=button.id+'-options';list.setAttribute('role','listbox');list.setAttribute('aria-label',wording(label));button.setAttribute('aria-controls',list.id);
  const empty=document.createElement('p');empty.className='location-picker-empty';empty.setAttribute('role','status');empty.hidden=true;menu.append(search,list,empty);document.body.append(menu);host.append(button);select.classList.add('location-select-native');select.hidden=true;select.tabIndex=-1;select.dataset.userText='';
  if(originalLabel){if(!originalLabel.id)originalLabel.id=button.id+'-label';originalLabel.htmlFor=button.id;}
  let entries=[],shown=[],active=-1,open=false,buffer='',bufferTimer,anchor;
  function position(){
   if(!open)return;if(!select.isConnected||!button.getClientRects().length){close(false);return;}
   const rect=button.getBoundingClientRect(),viewport=window.visualViewport,left=viewport?.offsetLeft||0,top=viewport?.offsetTop||0,width=viewport?.width||innerWidth,height=viewport?.height||innerHeight;
   anchor={x:scrollX,y:scrollY,left:rect.left,top:rect.top};
   const menuWidth=Math.min(Math.max(rect.width,260),width-24),below=top+height-rect.bottom-12,above=rect.top-top-12,down=below>=Math.min(320,above),room=Math.max(80,Math.min(360,down?below:above));
   menu.style.width=menuWidth+'px';menu.style.maxHeight=room+'px';menu.style.left=Math.max(left+12,Math.min(rect.left,left+width-menuWidth-12))+'px';menu.style.top=down?(rect.bottom+6)+'px':'auto';menu.style.bottom=down?'auto':(innerHeight-rect.top+6)+'px';
  }
  function activate(index){
   if(!shown.length){active=-1;button.removeAttribute('aria-activedescendant');return;}active=Math.max(0,Math.min(index,shown.length-1));
   list.querySelectorAll('[role=option]').forEach((option,i)=>option.classList.toggle('is-active',i===active));button.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});
  }
  function render(){
   const query=search.value.trim().toLocaleLowerCase();shown=entries.filter(entry=>entry.name.toLocaleLowerCase().includes(query));list.replaceChildren();
   for(const [index,entry] of shown.entries()){
    const option=document.createElement('button');option.type='button';option.className='location-picker-option';option.id=list.id+'-'+entry.index;option.tabIndex=-1;option.setAttribute('role','option');option.setAttribute('aria-selected',String(entry.value===select.value));option.disabled=entry.disabled;option.dataset.locationValue=entry.value;option.dataset.appPart=optionPart;if(settings.company)option.dataset.companyValue=entry.value;option.dataset.editId=typeof appEditParts==='object'?appEditParts.childIdentity(optionPart+':'+(select.dataset.editId||select.id),[entry.value]):(optionPart+':'+select.id+':'+entry.value);option.setAttribute('aria-disabled',String(entry.disabled));
    const name=document.createElement('span');name.textContent=entry.name;name.dataset.userText='';const tick=document.createElementNS('http://www.w3.org/2000/svg','svg');tick.setAttribute('viewBox','0 0 24 24');tick.setAttribute('width','18');tick.setAttribute('height','18');tick.setAttribute('fill','none');tick.setAttribute('stroke','currentColor');tick.setAttribute('stroke-width','2');tick.setAttribute('aria-hidden','true');tick.innerHTML='<path d="m5 12 4 4L19 6"/>';tick.classList.add('location-picker-check');tick.hidden=entry.value!==select.value;if(entry.value!==select.value)tick.setAttribute('hidden','');
    option.append(name,tick);option.onpointerdown=event=>{if(event.pointerType==='mouse')event.preventDefault();};option.onpointermove=event=>{if(event.pointerType==='mouse'&&active!==index)activate(index);};option.onclick=()=>choose(index);list.append(option);
   }
   empty.textContent=wording(entries.length?(settings.emptySearch||'No locations match your search.'):(settings.emptyLabel||'No locations available.'));empty.hidden=shown.length>0;
   const selected=shown.findIndex(entry=>entry.value===select.value&&!entry.disabled);activate(selected>=0?selected:Math.max(0,shown.findIndex(entry=>!entry.disabled)));
  }
  function sync(){
   const disabled=select.matches(':disabled'),selected=select.selectedOptions[0];const nextDisabled=disabled||select.options.length===0;if(button.disabled!==nextDisabled)button.disabled=nextDisabled;button.setAttribute('aria-label',wording(label));button.setAttribute('aria-required',String(select.required));list.setAttribute('aria-label',wording(label));search.placeholder=wording(searchLabel);search.setAttribute('aria-label',wording(searchLabel));
   const name=selected?.textContent||wording('Choose a location');if(!settings.holdWhileBusy||!disabled){if(display.textContent!==name)display.textContent=name;}
   button.title=display.textContent;button.classList.toggle('is-placeholder',!select.value);entries=[...select.options].map((option,index)=>({index,value:option.value,name:option.textContent,disabled:option.disabled||option.parentElement?.disabled||Boolean(select.required&&!option.value)}));search.hidden=entries.length<=6;
   if(open){if(button.disabled)close(false);else{render();position();}}
  }
  function close(focus=true){open=false;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');if(menu.matches(':popover-open'))menu.hidePopover();if(focus&&button.isConnected&&!button.disabled)button.focus({preventScroll:true});}
  function show(){if(button.disabled)return;for(const other of widgets.values())if(other.select!==select)other.close(false);search.value='';sync();menu.showPopover();open=true;button.setAttribute('aria-expanded','true');position();render();button.focus({preventScroll:true});}
  function choose(index){const entry=shown[index];if(!entry||entry.disabled||button.disabled)return;close();if(entry.value!==select.value){select.value=entry.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));}button.removeAttribute('aria-invalid');sync();}
  function next(delta){let index=active;for(let count=0;count<shown.length;count++){index=(index+delta+shown.length)%shown.length;if(!shown[index].disabled){activate(index);return;}}}
  function keyboard(event){
   if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();return;}
   if(event.key==='Tab'&&open){close(event.target===search);return;}
   if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();event.stopPropagation();const wasOpen=open;if(!open)show();if(event.target===search)button.focus({preventScroll:true});if(event.key==='Home')activate(shown.findIndex(entry=>!entry.disabled));else if(event.key==='End')activate(shown.findLastIndex(entry=>!entry.disabled));else if(wasOpen)next(event.key==='ArrowDown'?1:-1);return;}
   if(event.target===search)return;
   if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();if(open)choose(active);else show();return;}
   if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();if(!open)show();clearTimeout(bufferTimer);buffer+=event.key.toLocaleLowerCase();bufferTimer=setTimeout(()=>buffer='',750);const index=shown.findIndex(entry=>!entry.disabled&&entry.name.toLocaleLowerCase().startsWith(buffer));if(index>=0)activate(index);}
  }
  button.onclick=()=>open?close():show();button.onkeydown=keyboard;search.onkeydown=keyboard;search.oninput=()=>{render();position();};menu.addEventListener('toggle',event=>{if(event.newState==='closed'){open=false;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');}});
  select.addEventListener('change',sync);select.addEventListener('input',sync);select.addEventListener('invalid',event=>{event.preventDefault();button.setAttribute('aria-invalid','true');show();});select.form?.addEventListener('reset',()=>queueMicrotask(()=>{close(false);button.removeAttribute('aria-invalid');sync();}));
  const observer=new MutationObserver(sync);observer.observe(select,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','required','selected','label']});const resize=new ResizeObserver(position);resize.observe(button);
  const widget={select,button,menu,sync,close,position,onScroll(){if(!open||!anchor)return;const rect=button.getBoundingClientRect();if(scrollX!==anchor.x||scrollY!==anchor.y||Math.abs(rect.left-anchor.left)>1||Math.abs(rect.top-anchor.top)>1)close(false);},destroy(){close(false);observer.disconnect();resize.disconnect();clearTimeout(bufferTimer);menu.remove();widgets.delete(select);}};widgets.set(select,widget);sync();return widget;
 }
 function discover(){for(const select of document.querySelectorAll('select#account-location'))enhance(select);for(const widget of widgets.values())if(!widget.select.isConnected)widget.destroy();}
 window.locationPickers={enhance,refresh:select=>widgets.get(select)?.sync(),closeAll:()=>{for(const widget of widgets.values())widget.close(false);}};
 new MutationObserver(records=>{if(records.some(record=>record.type==='childList'))discover();if(records.some(record=>record.type==='attributes'&&record.attributeName==='disabled'&&record.target.tagName==='FIELDSET'))for(const widget of widgets.values())widget.sync();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
 window.addEventListener('resize',()=>{for(const widget of widgets.values())widget.position();});window.visualViewport?.addEventListener('resize',()=>{for(const widget of widgets.values())widget.position();});window.visualViewport?.addEventListener('scroll',()=>{for(const widget of widgets.values())widget.position();});document.addEventListener('scroll',event=>{if(event.target.closest?.('.location-picker-menu'))return;for(const widget of widgets.values())widget.onScroll();},true);window.addEventListener('interface-text-updated',()=>{for(const widget of widgets.values())widget.sync();});discover();
})();
