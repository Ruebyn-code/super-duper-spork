(()=>{
 const form=document.getElementById('stock-form');if(!form)return;
 const tabs=[...form.querySelectorAll('[data-stock-tab]')],panels=[...form.querySelectorAll('[data-stock-panel]')];
 const name=form.elements.countUnitName,ratio=form.elements.countUnitsPerUnit,preview=document.getElementById('stock-count-unit-preview'),message=document.getElementById('stock-editor-message');
 const dialog=document.getElementById('stock-item-dialog'),closeButton=document.getElementById('stock-dialog-close');let returnFocus=null;
 let busy=false,invalidField=null;const disabled=new Map();
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
 function select(key,focus=false){
  if(busy)return;const selected=tabs.find(tab=>tab.dataset.stockTab===key);if(!selected)return;
  for(const tab of tabs){const active=tab===selected;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;}
  for(const panel of panels)panel.hidden=panel.dataset.stockPanel!==key;
  if(focus)selected.focus();
 }
 for(const tab of tabs){
  tab.addEventListener('click',()=>select(tab.dataset.stockTab));
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
 function reset(){select('details');document.getElementById('stock-photo-options').open=!document.getElementById('stock-photo-preview').hidden;message.textContent='';refresh();}
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
 window.stockItemEditor={select,refresh,reset,setBusy,open,close,get busy(){return busy;}};
 window.addEventListener('before-location-switch',event=>{if(busy||dialog?.open)event.preventDefault();});
 window.addEventListener('interface-text-updated',refresh);
 refresh();
})();
