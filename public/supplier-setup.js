// Step-by-step supplier setup (Suppliers & stock → Add supplier): 1 name, 2 how orders are sent, 3 review and create.
// Creating uses the native APIs: POST /api/suppliers (name), then PUT /api/suppliers/:id with the delivery details when
// they are set. If the supplier is created but the delivery details fail, the created supplier is remembered so a retry only
// saves the delivery details (never creating a second supplier). Browsing the steps never saves anything.
(()=>{
 const form=document.getElementById('supplier-form');if(!form)return;
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const platforms=()=>window.orderDestinations?.platforms||[];
 const steps=[{key:'name',title:'Supplier'},{key:'delivery',title:'Sending orders'},{key:'review',title:'Review'}];
 let step=0,busy=false,created=null,returnFocus=null;

 const dialog=el('dialog',undefined,'setup-wizard supplier-setup');dialog.id='supplier-setup';dialog.setAttribute('aria-labelledby','supplier-setup-title');
 dialog.innerHTML=`<div class="setup-wizard-heading"><span class="setup-wizard-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/></svg></span><div><h2 id="supplier-setup-title"></h2><p class="setup-wizard-sub"></p></div><button type="button" class="setup-wizard-close" aria-label="">×</button></div>
 <ol class="setup-wizard-steps"></ol>
 <form class="setup-wizard-body" novalidate>
  <section data-setup-step="name"><label>Supplier name<input name="supplierName" required maxlength="100" autocomplete="off"></label><p class="setup-wizard-hint" data-hint="name"></p></section>
  <section data-setup-step="delivery" hidden><fieldset class="setup-wizard-choices"><legend></legend></fieldset><label data-field="platform" hidden><span></span><select name="platform"></select></label><label data-field="contact" hidden><span></span><input name="contact" maxlength="500"></label><p class="setup-wizard-hint" data-hint="delivery"></p></section>
  <section data-setup-step="review" hidden><dl class="setup-wizard-review"></dl><p class="setup-wizard-hint" data-hint="review"></p></section>
  <section data-setup-step="done" hidden><p class="setup-wizard-done"></p></section>
 </form>
 <div class="setup-wizard-footer"><p class="setup-wizard-status" role="status" aria-live="polite"></p><div class="setup-wizard-actions"><button type="button" data-action="back"></button><button type="button" data-action="next"></button><button type="button" data-action="create"></button><button type="button" data-action="stock"></button><button type="button" data-action="done"></button></div></div>`;
 document.body.append(dialog);
 const $=selector=>dialog.querySelector(selector),body=$('form'),nameInput=body.elements.supplierName,platform=body.elements.platform,contact=body.elements.contact,status=$('.setup-wizard-status');
 const buttons=Object.fromEntries([...dialog.querySelectorAll('[data-action]')].map(button=>[button.dataset.action,button]));
 const methods=[['none','Not yet','Set this up later in the supplier’s Order delivery settings.'],['email','Email','Orders are emailed to the supplier.'],['sms','Text message','Orders are texted automatically through this location’s Twilio setup. SMS charges apply.'],['platform','Ordering platform','Copy the order and finish checkout in the supplier’s platform.']];
 const choices=$('.setup-wizard-choices');
 for(const [value,label,help] of methods){const option=el('label',undefined,'setup-wizard-choice'),radio=el('input');radio.type='radio';radio.name='method';radio.value=value;if(value==='none')radio.checked=true;const text=el('span');text.append(el('strong',word(label)),el('small',word(help)));option.append(radio,text);choices.append(option);}
 function texts(){
  $('#supplier-setup-title').textContent=word('Add supplier');$('.setup-wizard-close').setAttribute('aria-label',word('Close'));
  $('.setup-wizard-choices legend').textContent=word('How should orders be sent?');
  $('[data-hint="name"]').textContent=word('Use the name your team knows them by. You can add their stock after this.');
  $('[data-field="platform"] span').textContent=word('Platform');
  buttons.back.textContent=word('Back');buttons.create.textContent=word('Create supplier');buttons.stock.textContent=word('Add stock for this supplier');buttons.done.textContent=word('Done');
 }
 function method(){return body.querySelector('input[name="method"]:checked')?.value||'none';}
 function deliveryFields(){
  const value=method(),entry=platforms().find(item=>item.id===platform.value);$('[data-field="platform"]').hidden=value!=='platform';$('[data-field="contact"]').hidden=value==='none';contact.required=value!=='none';
  contact.type=value==='email'?'email':value==='sms'?'tel':'url';$('[data-field="contact"] span').textContent=word(value==='email'?'Supplier email address':value==='sms'?'Supplier mobile number':'Platform ordering link');
  contact.placeholder=value==='email'?'orders@supplier.com':value==='sms'?'+61400123456':entry?.url||'';if(value==='platform'&&!contact.value&&entry)contact.value=entry.url;
  for(const option of choices.querySelectorAll('.setup-wizard-choice'))option.classList.toggle('selected',option.querySelector('input').checked);
  $('[data-hint="delivery"]').textContent=value==='none'?'':word('Orders use this location’s sending settings.');
 }
 choices.addEventListener('change',()=>{contact.value='';deliveryFields();});platform.addEventListener('change',()=>{contact.value=platforms().find(item=>item.id===platform.value)?.url||'';deliveryFields();});
 function review(){
  const list=$('.setup-wizard-review'),value=method(),label=methods.find(item=>item[0]===value)[1],rows=[['Supplier',nameInput.value.trim()],['Sending orders',word(label)+(value==='platform'?' · '+(platforms().find(item=>item.id===platform.value)?.name||''):'')]];if(value!=='none')rows.push([value==='email'?'Email':value==='sms'?'Mobile':'Link',contact.value.trim()]);
  list.replaceChildren(...rows.flatMap(([term,detail])=>{const dd=el('dd',detail);dd.dataset.userText='';return [el('dt',word(term)),dd];}));
  $('[data-hint="review"]').textContent=word('Delivery days, cutoffs and holidays are set per location in Locations → Delivery.');
 }
 function render(){
  const done=step===steps.length;for(const section of body.querySelectorAll('[data-setup-step]'))section.hidden=section.dataset.setupStep!==(done?'done':steps[step].key);
  const list=$('.setup-wizard-steps');list.replaceChildren(...steps.map((item,index)=>{const li=el('li');li.dataset.state=done||index<step?'done':index===step?'current':'upcoming';li.append(el('span',String(index+1),'setup-wizard-number'),el('span',word(item.title)));if(index===step&&!done)li.setAttribute('aria-current','step');return li;}));
  $('.setup-wizard-sub').textContent=done?word('Supplier added'):word('Step {number} of {total}',{number:step+1,total:steps.length})+' · '+word(steps[step].title);
  buttons.back.hidden=done||step===0;buttons.next.hidden=done||step===steps.length-1;buttons.next.textContent=step<steps.length-1?word('Next: {step}',{step:word(steps[step+1].title)}):'';
  buttons.create.hidden=done||step!==steps.length-1;buttons.create.textContent=word(created&&!created.deliverySaved?'Save delivery details':'Create supplier');
  buttons.stock.hidden=buttons.done.hidden=!done;if(step===2)review();if(step===1)deliveryFields();
  for(const button of Object.values(buttons))button.disabled=busy;nameInput.readOnly=Boolean(created);
 }
 function valid(){
  if(step===0){nameInput.setCustomValidity('');const name=nameInput.value.trim();if(name&&!created&&typeof suppliers!=='undefined'&&suppliers.some(item=>item.name.toLowerCase()===name.toLowerCase()))nameInput.setCustomValidity(word('That supplier already exists.'));if(!nameInput.checkValidity()){nameInput.reportValidity();nameInput.focus();return false;}}
  if(step===1&&method()!=='none'&&!contact.checkValidity()){contact.reportValidity();contact.focus();return false;}
  return true;
 }
 function focusStep(){const field=step===0?nameInput:step===1?body.querySelector('input[name="method"]:checked'):buttons.create.hidden?buttons.done:buttons.create;setTimeout(()=>field?.focus(),0);}
 function go(index){if(busy)return;if(index>step&&!valid())return;step=index;status.textContent='';render();focusStep();}
 buttons.back.onclick=()=>go(step-1);buttons.next.onclick=()=>go(step+1);
 body.addEventListener('submit',event=>{event.preventDefault();if(step<steps.length-1)go(step+1);else if(step===steps.length-1)buttons.create.click();});
 nameInput.addEventListener('input',()=>nameInput.setCustomValidity(''));
 body.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.isComposing||event.shiftKey||event.altKey||event.ctrlKey||event.metaKey||!/^(INPUT|SELECT)$/.test(event.target.tagName))return;event.preventDefault();if(step<steps.length-1)go(step+1);else if(step===steps.length-1)buttons.create.click();});
 async function request(url,method,payload){const session=window.__supplierSetupSession||(window.__supplierSetupSession=await (await fetch('/api/session')).json());
  const response=await fetch(url,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf||'',...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})},body:JSON.stringify(payload)});const result=await response.json().catch(()=>({}));if(!response.ok)throw Error(result.error||word('Unable to save the supplier.'));return result;}
 buttons.create.onclick=async()=>{
  if(busy||!valid())return;busy=true;render();status.textContent=word('Saving…');
  try{
   if(!created){const supplier=await request('/api/suppliers','POST',{name:nameInput.value.trim()});created={id:supplier.id,name:supplier.name,deliverySaved:false};}
   const value=method();if(value!=='none')await request('/api/suppliers/'+created.id,'PUT',{delivery:{method:value,contact:contact.value.trim(),...(value==='platform'?{platform:platform.value}:{})}});
   created.deliverySaved=true;step=steps.length;status.textContent='';$('.setup-wizard-done').textContent=word('{name} is ready. Add the items you order from them, then set delivery days for each location.',{name:created.name});
   try{await window.reload?.();}catch{}
  }catch(error){status.textContent=created?word('{name} was created, but its delivery details were not saved: {error} Press Save delivery details to try again.',{name:created.name,error:error.message}):error.message;}
  finally{busy=false;render();if(step===steps.length)focusStep();}
 };
 buttons.done.onclick=()=>close();
 buttons.stock.onclick=()=>{const id=created?.id;close();if(location.hash!=='#stock'){location.hash='stock';window.applyAdminPanels?.();}const add=document.getElementById('add-stock-shortcut');add?.click();setTimeout(()=>{const select=document.getElementById('supplier-select');if(select&&id&&[...select.options].some(option=>option.value===id)){select.value=id;window.locationPickers?.refresh?.(select);}},0);};
 function reset(){step=0;busy=false;created=null;body.reset();nameInput.readOnly=false;nameInput.setCustomValidity('');contact.value='';status.textContent='';platform.replaceChildren(...platforms().map(item=>Object.assign(el('option',item.name),{value:item.id})));}
 function open(opener){if(dialog.open)return;returnFocus=opener;if(!created||created.deliverySaved)reset();texts();render();dialog.showModal();focusStep();if(window.appEmbedded)parent.appShell?.childPresentationChanged?.(window);}
 function close(){if(busy)return;dialog.close();if(created?.deliverySaved)created=null;(returnFocus?.isConnected?returnFocus:null)?.focus();if(window.appEmbedded)parent.appShell?.childPresentationChanged?.(window);}
 $('.setup-wizard-close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 // Replace the old inline "Add supplier" panel with the step-by-step popup (same permissions: the button keeps its place).
 function attach(){const old=document.querySelector('button[aria-controls="admin-create-supplier-form"]');if(!old)return false;const button=old.cloneNode(true);button.removeAttribute('aria-expanded');button.removeAttribute('aria-controls');button.setAttribute('aria-haspopup','dialog');button.id='add-supplier-setup';old.replaceWith(button);document.getElementById('admin-create-supplier-form')?.setAttribute('hidden','');button.addEventListener('click',()=>open(button));return true;}
 if(!attach())window.addEventListener('DOMContentLoaded',attach,{once:true});
 window.supplierSetup={open,close};
})();
