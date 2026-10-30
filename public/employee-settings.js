(()=>{
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=text;window.appWording?.label(e,text);}if(cls)e.className=cls;return e;};
 const icons={personal:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',pay:'<circle cx="12" cy="12" r="9"/><path d="M12 5v14M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9"/>',time:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',leave:'<path d="m12 3 1 7 7 4v2l-7-2v5l3 2H8l3-2v-5l-7 2v-2l7-4Z"/>'};
 let current=null;
 function mount(form,{account,locationId,photoEditor}){
  current?.destroy();
  const actions=form.querySelector('.admin-form-actions'),save=document.getElementById('account-save'),cancel=document.getElementById('account-cancel'),title=document.getElementById('account-form-title'),original=[...form.children].filter(e=>e!==actions&&e!==title),controls=original.flatMap(e=>[...e.querySelectorAll('input,select,textarea')].filter(control=>control.name)),noValidate=form.noValidate,phone=form.elements.phoneNumber,layout=node('div',undefined,'page-sidebar-layout employee-settings-layout'),menu=node('div',undefined,'page-sidebar employee-settings-menu'),content=node('div',undefined,'employee-settings-content'),notice=node('p','','employee-settings-status'),panels=new Map(),tabs=new Map();
  let disposed=false,accountDirty=false,payDirty=false,busy=false,loaded=false,payLoading=null,active='personal',agreements=null,agreementsDirty=false,agreementsBusy=false;
  form.noValidate=true;form.classList.add('employee-settings-form');menu.setAttribute('role','tablist');menu.setAttribute('aria-label','Employee settings');menu.setAttribute('aria-orientation','vertical');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  for(const [id,label]of [['personal','Personal'],['pay','Pay Conditions'],['time','Time & Attendance'],['leave','Leave & Availability']]){
   const tab=node('button',undefined,'page-sidebar-link employee-settings-tab'),icon=document.createElementNS('http://www.w3.org/2000/svg','svg'),text=node('span',label,'page-sidebar-label'),arrow=node('span','›','employee-settings-chevron'),panel=node('section',undefined,'employee-settings-panel'),heading=node('h3',label);tab.type='button';tab.id='employee-settings-tab-'+id;tab.dataset.employeeGroup=id;tab.setAttribute('role','tab');tab.setAttribute('aria-controls','employee-settings-panel-'+id);icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');icon.setAttribute('stroke-width','1.8');icon.setAttribute('stroke-linecap','round');icon.setAttribute('stroke-linejoin','round');icon.setAttribute('aria-hidden','true');icon.innerHTML=icons[id];arrow.setAttribute('aria-hidden','true');tab.append(icon,text,arrow);panel.id='employee-settings-panel-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panel.tabIndex=0;heading.dataset.featureHelp=id==='pay'?'award-settings':id==='leave'?'leave-availability':id==='time'?'shift-clock timesheets':'manage-users profile-photo';panel.append(heading);menu.append(tab);content.append(panel);tabs.set(id,tab);panels.set(id,panel);tab.onclick=()=>show(id);
  }
  const personal=panels.get('personal'),fields=node('div',undefined,'employee-settings-fields'),pay=panels.get('pay'),time=panels.get('time'),leave=panels.get('leave');
  for(const e of original)(e===photoEditor?.element?personal:fields).append(e);personal.append(fields);
  const pin=node('output','','employee-settings-pin'),pinLabel=node('p','Clock PIN','employee-settings-label');time.append(pinLabel,pin);
  function updatePin(){const digits=phone.value.replace(/\D/g,'');pin.textContent=digits.length>=7?digits.slice(-4):'Add a phone number in Personal';pin.dataset.userText='';}
  updatePin();
  const clockHelp=node('p','The clock PIN uses the last four digits of the phone number saved in Personal.','small');time.append(clockHelp);
  const link=(host,label,hash)=>{const a=node('a',label,'employee-settings-link');a.href='/rostering#'+hash;host.append(a);};
  if(appAccess.can('rostering.view')){link(time,'Open timesheets','timesheets');link(leave,'Open leave requests','leave');link(leave,'Open availability','availability');}
  else{time.append(node('p','Your permission level does not include timesheet access.','small'));leave.append(node('p','Your permission level does not include leave or availability access.','small'));}
  if(appAccess.can('awards.manage')){
   const hours=node('button','Edit regular working hours','employee-settings-link');hours.type='button';hours.onclick=async()=>{show('pay');await payLoading;if(disposed)return;const target=pay.querySelector('.user-employment-pattern:not([hidden]),button[aria-controls=user-employment-pattern]:not([hidden])');if(target){target.scrollIntoView({block:'nearest'});(target.matches('button')?target:target.querySelector('input:not(:disabled)'))?.focus({preventScroll:true});}else notice.textContent='Choose Part-time in Pay Conditions to add regular working hours.';};time.append(hours);
  }
  else pay.append(node('p','Employment and pay details require employment management permission.','small'));
  const payHost=node('div',undefined,'employee-settings-pay'),agreementsHost=node('div');pay.append(payHost,agreementsHost);layout.append(menu,content);actions.before(layout,notice);
  function busyState(value){busy=value;payHost.inert=value;agreementsHost.inert=value&&!agreementsBusy;menu.inert=value;fields.inert=value;cancel.disabled=value;save.disabled=value;form.setAttribute('aria-busy',String(value));const extra=form.closest('.user-edit-panel')?.querySelector('.admin-editor-actions');if(extra)extra.inert=value;}
  function loadPay(){if(loaded||!appAccess.can('awards.manage'))return;loaded=true;payLoading=window.userEmployment.show(account.id,payHost,{locationId,onDirty:()=>payDirty=true,onClean:()=>payDirty=false,onBusy:busyState,onSaved:()=>{payDirty=false;agreements?.refresh();}});if(appAccess.can('users.manage')&&window.employmentPayDocuments)agreements=window.employmentPayDocuments.mount(agreementsHost,{userId:account.id,locationId,blocked:()=>accountDirty||payDirty||busy&&!agreementsBusy,onDirty:value=>agreementsDirty=value,onBusy:value=>{agreementsBusy=value;busyState(value);}});}
  function show(id,{focus=false}={}){
   if(disposed||busy||!panels.has(id))return;active=id;notice.textContent='';
   for(const [key,tab]of tabs){const selected=key===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;panels.get(key).hidden=!selected;panels.get(key).inert=!selected;}
   save.hidden=id!=='personal';if(id==='pay')loadPay();if(focus)tabs.get(id).focus({preventScroll:true});
  }
  function keyboard(event){const ids=[...tabs.keys()],index=ids.indexOf(event.target.dataset.employeeGroup);if(index<0||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?ids.length-1:(index+(event.key==='ArrowDown'?1:-1)+ids.length)%ids.length;show(ids[next],{focus:true});}
  function changed(event){if(controls.includes(event.target)){accountDirty=true;updatePin();}}
  function invalid(event){if(controls.includes(event.target))show('personal');}
  function submit(event){
   if(disposed)return;const reject=text=>{event.preventDefault();event.stopImmediatePropagation();notice.textContent=text;};
   if(busy||photoEditor?.saving){reject('Wait for the current save to finish.');return;}
   if(active!=='personal'){reject('Save pay changes with Save employment details. Account details are saved in Personal.');return;}
   if(payDirty){reject('Save or discard the unfinished pay changes before saving account details.');return;}if(agreementsDirty||agreements?.pending){reject('Send or discard the selected employment documents before saving account details.');return;}
   if(photoEditor?.dirty){reject('Save the selected photo before saving account details, or cancel these edits.');return;}
   for(const control of controls)if(!control.checkValidity()){event.preventDefault();event.stopImmediatePropagation();show('personal');control.reportValidity();const focus=control.tagName==='SELECT'?control.closest('label')?.querySelector('.location-select-trigger')||control:control;focus.focus();return;}
  }
  function canClose(){if(busy||photoEditor?.saving)return false;return !(accountDirty||payDirty||agreementsDirty||agreements?.pending||photoEditor?.dirty)||confirm('Discard unsaved employee settings?');}
  function beforeSwitch(event){if(busy||photoEditor?.saving||accountDirty||payDirty||agreementsDirty||agreements?.pending||photoEditor?.dirty){event.preventDefault();notice.textContent='Save or cancel employee settings before switching pages, locations or companies.';}}
  function beforeUnload(event){if(busy||photoEditor?.saving||accountDirty||payDirty||agreementsDirty||agreements?.pending||photoEditor?.dirty){event.preventDefault();event.returnValue='';}}
  menu.addEventListener('keydown',keyboard);for(const name of ['input','change'])form.addEventListener(name,changed);form.addEventListener('invalid',invalid,true);form.addEventListener('submit',submit,true);window.addEventListener('before-location-switch',beforeSwitch);window.addEventListener('beforeunload',beforeUnload);
  current={show,canClose,setBusy:busyState,destroy(){if(disposed)return;disposed=true;agreements?.destroy();for(const name of ['input','change'])form.removeEventListener(name,changed);form.removeEventListener('invalid',invalid,true);form.removeEventListener('submit',submit,true);window.removeEventListener('before-location-switch',beforeSwitch);window.removeEventListener('beforeunload',beforeUnload);for(const e of original)actions.before(e);layout.remove();notice.remove();form.noValidate=noValidate;form.classList.remove('employee-settings-form');form.removeAttribute('aria-busy');save.hidden=false;save.disabled=cancel.disabled=false;current=null;}};
  show('personal');return current;
 }
 window.employeeSettings={mount,setBusy:value=>current?.setBusy(value),canClose:()=>current?.canClose()??true,destroy:()=>current?.destroy()};
})();
