(()=>{
 const form=document.getElementById('stock-form');if(!form)return;
 const tabs=[...form.querySelectorAll('[data-stock-tab]')],panels=[...form.querySelectorAll('[data-stock-panel]')];
 const name=form.elements.countUnitName,ratio=form.elements.countUnitsPerUnit,preview=document.getElementById('stock-count-unit-preview'),message=document.getElementById('stock-editor-message');
 const dialog=document.getElementById('stock-item-dialog'),closeButton=document.getElementById('stock-dialog-close');let returnFocus=null;
 let busy=false,invalidField=null,setupMode=false,furthest=0;const disabled=new Map();
 // Step-by-step setup for new items: the same three panels become steps 1–3 with Back/Next, and Save stock appears on the
 // last step. Next checks only the visible fields of the current step. Editing an existing item keeps the free tabs.
 const intros={details:'Name the item, choose its supplier and enter its price.',counting:'Describe one supplier pack and how staff count it.',ordering:'Set the ordering rules and this location’s stock levels, then save.'};
 const create=(tag,text,className)=>{if(typeof document.createElement!=='function')return null;const node=document.createElement(tag);if(text)node.textContent=text;if(className)node.className=className;return node;};
 const stepLine=create('p','','stock-setup-step'),back=create('button','','stock-setup-back'),next=create('button','','stock-setup-next');
 if(stepLine){stepLine.id='stock-setup-step';stepLine.setAttribute('aria-live','polite');stepLine.hidden=true;form.querySelector('.stock-settings-tabs')?.after(stepLine);}
 if(back&&next){back.type=next.type='button';back.hidden=next.hidden=true;const actions=form.querySelector('.admin-form-actions'),save=document.getElementById('stock-save');(save||actions?.firstChild)?.before?.(back,next);if(!save&&actions)actions.prepend(back,next);
  back.addEventListener('click',()=>{const index=currentIndex();if(index>0)select(tabs[index-1].dataset.stockTab);focusStep();});next.addEventListener('click',()=>goTo(currentIndex()+1));}
 function currentIndex(){return Math.max(0,tabs.findIndex(tab=>tab.getAttribute('aria-selected')==='true'));}
 function stepValid(index){const panel=panels[index];for(const control of [...(form.elements||[])]){if(control.closest?.('[data-stock-panel]')!==panel||control.disabled||!control.checkValidity||!control.getClientRects?.().length)continue;if(!control.checkValidity()){control.reportValidity?.();control.focus?.();return false;}}return true;}
 function goTo(index){if(busy)return;index=Math.min(Math.max(index,0),tabs.length-1);for(let step=currentIndex();step<index;step++){if(!stepValid(step))return;select(tabs[step+1].dataset.stockTab);}if(index<currentIndex())select(tabs[index].dataset.stockTab);focusStep();}
 function focusStep(){const panel=panels[currentIndex()],field=[...(form.elements||[])].find(control=>control.closest?.('[data-stock-panel]')===panel&&!control.disabled&&control.getClientRects?.().length&&/^(INPUT|SELECT|TEXTAREA)$/.test(control.tagName||''));(field||tabs[currentIndex()])?.focus?.({preventScroll:false});}
 function updateSetup(){
  const index=currentIndex(),last=index===tabs.length-1,save=document.getElementById('stock-save');form.classList?.toggle('stock-setup',setupMode);
  for(const [position,tab] of tabs.entries()){if(setupMode){tab.dataset.stepState=position<index?'done':position===index?'current':'upcoming';tab.setAttribute('aria-label',wording('Step {number}: {name}',{number:position+1,name:tab.textContent}));}else{delete tab.dataset.stepState;tab.removeAttribute?.('aria-label');}}
  if(stepLine){stepLine.hidden=!setupMode;stepLine.textContent=setupMode?wording('Step {number} of {total}',{number:index+1,total:tabs.length})+' · '+wording(intros[tabs[index].dataset.stockTab]||''):'';}
  if(back&&next){back.hidden=!setupMode||index===0;next.hidden=!setupMode||last;back.textContent=wording('Back');next.textContent=wording('Next: {step}',{step:tabs[index+1]?.textContent||''});}
  if(save)save.hidden=setupMode&&!last;
 }
 function setup(on){setupMode=Boolean(on);furthest=0;select('details');updateSetup();}
 // In setup, pressing Enter before the last step moves on instead of saving.
 form.addEventListener('submit',event=>{if(!setupMode||currentIndex()===tabs.length-1)return;event.preventDefault();event.stopImmediatePropagation();goTo(currentIndex()+1);},true);
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
 function select(key,focus=false){
  if(busy)return;const selected=tabs.find(tab=>tab.dataset.stockTab===key);if(!selected)return;
  for(const tab of tabs){const active=tab===selected;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
  for(const panel of panels)panel.hidden=panel.dataset.stockPanel!==key;
  furthest=Math.max(furthest,tabs.indexOf(selected));updateSetup();
  if(focus)selected.focus();
 }
 for(const tab of tabs){
  tab.addEventListener('click',()=>{if(setupMode){goTo(tabs.indexOf(tab));return;}select(tab.dataset.stockTab);});
  tab.addEventListener('keydown',event=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)||event.altKey||event.ctrlKey||event.metaKey)return;
   event.preventDefault();const index=tabs.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   select(tabs[next].dataset.stockTab,true);
  });
 }
 // Count by: ordered units, smaller packs (name + whole number) or a weight/volume measure (decimal amount per ordered unit).
 const kind=form.elements.countUnitKind,measureNames={kg:'Kilograms',g:'Grams',L:'Litres',mL:'Millilitres'};
 function refresh(){
  const value=kind?kind.value:(name.value.trim()||ratio.value.trim()?'pack':''),measure=value.includes(':')?value.split(':'):null,pack=value==='pack',hasName=Boolean(name.value.trim()),hasRatio=Boolean(ratio.value.trim());
  const nameField=document.getElementById('stock-count-name-field'),ratioField=document.getElementById('stock-count-ratio-field'),ratioLabel=document.getElementById('stock-count-ratio-label');
  if(nameField)nameField.hidden=!pack;if(ratioField)ratioField.hidden=!value;
  ratio.step=measure?'0.001':'1';ratio.min=measure?'0.001':'1';ratio.placeholder=measure?(measure[1]==='g'||measure[1]==='mL'?'e.g. 5000':'e.g. 5'):'e.g. 20';
  if(ratioLabel)ratioLabel.textContent=measure?wording('{unit} in one ordered unit',{unit:wording(measureNames[measure[1]])}):wording('Counting units per ordered unit');
  name.setCustomValidity(pack&&!hasName&&hasRatio?wording('Enter a counting unit name, such as Sleeves.'):'');
  ratio.setCustomValidity(pack&&hasName&&!hasRatio?wording('Enter how many counting units are in one ordered unit.'):measure&&!hasRatio?wording('Enter how much is in one ordered unit, such as 5 for a 5 kg bag.'):'');
  const unit=measure?stockCountUnits.normalize({name:measure[1],perUnit:Number(ratio.value),measure:measure[0]}):pack?stockCountUnits.normalize({name:name.value,perUnit:Number(ratio.value)}):null;
  const text=unit?'1 ordered unit = {quantity} {unit}. Counting {half} {unit} records 0.5 ordered units.':!value?'Count using the ordered unit. To count by weight, volume or smaller packs, choose Count by above.':measure?'Enter an amount above 0 with up to three decimals.':'Enter a counting unit name and a whole number per ordered unit.';
  const format=new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}),values={quantity:unit?format.format(unit.perUnit):'',unit:unit?.name||'',half:unit?format.format(unit.perUnit/2):''};
  preview.dataset.appTemplate=text;preview.dataset.appValues=JSON.stringify(values);preview.textContent=wording(text,values);
 }
 kind?.addEventListener('change',refresh);
 for(const input of [name,ratio])input.addEventListener('input',refresh);
 // Reveal only the first invalid field; later validation events must not hide it.
 form.addEventListener('invalid',event=>{
  if(invalidField)return;invalidField=event.target;const panel=invalidField.closest('[data-stock-panel]');if(panel)select(panel.dataset.stockPanel);
  setTimeout(()=>{invalidField=null;},0);
 },true);
 function reset(){setupMode=false;select('details');document.getElementById('stock-photo-options').open=!document.getElementById('stock-photo-preview').hidden;message.textContent='';refresh();}
 function presentation(){
  if(!dialog)return;document.documentElement.classList.toggle('stock-settings-open',dialog.open);
  if(window.appEmbedded)parent.appShell?.childPresentationChanged(window);
 }
 function open(opener){
  if(busy||!dialog)return;returnFocus=opener||returnFocus;if(!dialog.open)dialog.showModal();
  returnFocus?.setAttribute('aria-expanded','true');presentation();const field=form.elements.name;const focus=field.getClientRects().length?field:tabs.find(tab=>tab.getAttribute('aria-selected')==='true');focus?.focus({preventScroll:true});
 }
 function close(){
  if(busy||!dialog?.open)return;dialog.close();returnFocus?.setAttribute('aria-expanded','false');presentation();
  const focus=returnFocus?.isConnected&&returnFocus.getClientRects().length?returnFocus:document.getElementById('add-stock-shortcut');focus?.focus({preventScroll:true});
 }
 if(dialog){
  closeButton.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',presentation);
  let backdrop=false;const outside=event=>{const rect=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);};
  dialog.addEventListener('pointerdown',event=>{backdrop=outside(event);});dialog.addEventListener('click',event=>{if(backdrop&&outside(event))close();backdrop=false;});
 }
 function setBusy(value){
  busy=value;form.setAttribute('aria-busy',String(value));
  if(value){for(const control of form.elements){disabled.set(control,control.disabled);control.disabled=true;}}
  else {for(const [control,wasDisabled]of disabled)control.disabled=wasDisabled;disabled.clear();}
  for(const select of form.querySelectorAll('select'))window.locationPickers?.refresh(select);
  if(closeButton)closeButton.disabled=value;
 }
 window.stockItemEditor={select,refresh,reset,setup,setBusy,open,close,get setupMode(){return setupMode;},get busy(){return busy;}};
 window.addEventListener('before-location-switch',event=>{if(busy||dialog?.open)event.preventDefault();});
 window.addEventListener('interface-text-updated',refresh);
 refresh();
})();
