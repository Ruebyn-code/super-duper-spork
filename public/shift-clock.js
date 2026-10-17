(()=>{
 if(!window.appBootstrap?.access||!appAccess.can('rostering.clock'))return;
 const M=shiftClockModel,create=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=wording(text);return e;},wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):(window.appBootstrap.interfaceText?.[text]??text).replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 const uid=()=>crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
 const clockIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path class="icon-detail" d="M12 6v6l4 2"/></svg>';
 const dock=create('button','shift-clock-dock');dock.id='shift-clock-dock';dock.type='button';dock.dataset.layoutUi='';dock.hidden=true;dock.innerHTML=clockIcon;const dockText=create('span');dock.append(dockText);
 const dialog=create('dialog','shift-clock-dialog');dialog.id='shift-clock-dialog';dialog.dataset.layoutUi=dialog.dataset.copyEditor='';dialog.setAttribute('aria-labelledby','shift-clock-title');
 const header=create('div','shift-clock-heading'),stateLabel=create('span','shift-clock-state'),close=create('button','shift-clock-close','×');close.type='button';header.append(stateLabel,close);
 const title=create('h2');title.id='shift-clock-title';const locationLabel=create('p','shift-clock-location'),schedule=create('p','shift-clock-schedule'),timer=create('strong','shift-clock-timer');timer.setAttribute('role','timer');timer.setAttribute('aria-live','off');
 const breakPanel=create('div','shift-clock-breaks'),entitlement=create('p'),progress=create('p','shift-clock-progress'),rules=create('p','shift-clock-rules'),reminder=create('p','shift-clock-reminder');breakPanel.append(entitlement,progress,rules,reminder);
 const actions=create('div','shift-clock-actions'),buttons={};
 for(const [action,label,type]of [['in','Clock in'],['break-start','Paid rest · 10 min','paid'],['break-start','Unpaid meal · 30–60 min','unpaid'],['break-end','End break'],['out','Clock out']]){const b=create('button',action==='in'||action==='out'?'shift-clock-primary':'',label);b.type='button';b.dataset.clockAction=action;if(type)b.dataset.breakType=type;b.onclick=()=>requestAction(action,type);buttons[type||action]=b;actions.append(b);}
 const notesLabel=create('label','shift-clock-notes','Shift note'),notes=create('textarea');notes.id='shift-clock-notes';notes.rows=2;notes.maxLength=500;notesLabel.append(notes);
 const exception=create('div','shift-clock-exception');exception.hidden=true;const warning=create('p'),reasonLabel=create('label',null,'Reason for the timing exception'),reason=create('textarea'),confirm=create('button','shift-clock-primary','Record actual time'),cancelException=create('button',null,'Go back'),exceptionActions=create('div','shift-clock-actions');reason.rows=2;reason.maxLength=500;reason.required=true;reasonLabel.append(reason);confirm.type=cancelException.type='button';exceptionActions.append(cancelException,confirm);exception.append(warning,reasonLabel,exceptionActions);
 const pinPanel=create('div','shift-clock-pin-panel'),pinLabel=create('label',null,'Your four-digit PIN'),pin=create('input'),pinHelp=create('p','shift-clock-pin-help'),managerPanel=create('div','shift-clock-manager'),managerLabel=create('label',null,'Approving manager'),manager=create('select'),managerPinLabel=create('label',null,'Manager’s four-digit PIN'),managerPin=create('input');
 pin.id='shift-clock-pin';manager.id='shift-clock-manager';managerPin.id='shift-clock-manager-pin';
 for(const field of [pin,managerPin]){field.type='password';field.inputMode='numeric';field.pattern='[0-9]{4}';field.minLength=field.maxLength=4;field.autocomplete='off';field.required=true;field.oninput=()=>field.setCustomValidity('');}
 pinLabel.append(pin);managerLabel.append(manager);managerPinLabel.append(managerPin);manager.required=true;managerPanel.append(create('p',null,'Starting before your rostered time needs another manager’s approval.'),managerLabel,managerPinLabel);pinPanel.append(pinLabel,pinHelp,managerPanel);
 const error=create('p','shift-clock-error'),footnote=create('p','shift-clock-footnote','Actual times are recorded when you press a button. Timesheets go to your manager for review.');error.setAttribute('role','status');dialog.append(header,title,locationLabel,schedule,timer,breakPanel,notesLabel,pinPanel,actions,exception,error,footnote);document.body.append(dock,dialog);
 let session,state,offset=0,loading,refreshAgain=false,busy=false,generation=0,nextTimer,request,pendingAction,entryNotesId,stopped=false;const seen=new Set();
 const now=()=>Date.now()+offset,phase=()=>state?M.phase(state,now()):'idle',blocked=()=>document.hidden||window.appRequiredReading?.blocked||document.body.classList.contains('app-edit-mode'),stamp=value=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(value));
 function phaseKey(){const entry=state?.entry,shift=state?.shift;return[session?.id,phase(),entry?.id||shift?.id,shift?.endAt,entry?.breaks.find(item=>!item.endAt)?.startAt].join(':');}
 const seenKey=key=>'opstack-clock-prompt:'+key;
 function remembered(key){try{return seen.has(key)||sessionStorage.getItem(seenKey(key))==='true';}catch{return seen.has(key);}}
 function remember(key){seen.add(key);try{sessionStorage.setItem(seenKey(key),'true');}catch{}}
 function clearPins(){pin.value=managerPin.value='';}
 function hide(){clearPins();dock.hidden=true;if(dialog.open)dialog.close();}
 function open(automatic=false){
  if(!state||phase()==='idle'||blocked()||document.querySelector('dialog[open]:not(#shift-clock-dialog)'))return;
  if(automatic&&remembered(phaseKey()))return;if(!dialog.open)dialog.showModal();remember(phaseKey());
 }
 function maybeOpen(){if(['clock-in','clock-out','break-ready','meal-overdue','meal-due'].includes(phase()))open(true);}
 const contextKey=()=>[state?.entry?.id,state?.entry?.revision,state?.shift?.id].join(':');
 function render(){
  if(!state||stopped||blocked()){hide();return;}const current=phase(),entry=state.entry,shift=state.shift,guide=M.guidance(entry,shift,now());dock.hidden=current==='idle';dock.disabled=busy;
  if(current==='idle'){if(dialog.open)dialog.close();return;}if(pendingAction&&pendingAction.context!==contextKey())pendingAction=null;
  const labels={'early-start':'Request an early start','clock-in':'Time to clock in','clock-out':'Your rostered shift has finished',working:'You’re clocked in','on-break':'You’re on a break','break-ready':'Your break time is up','meal-overdue':'Meal break exceeds 60 minutes','meal-due':'A meal break is due'};
  title.textContent=wording(labels[current]);stateLabel.textContent=wording(entry?(guide.ongoing?(guide.ongoing.paid?'Paid rest break':'Unpaid meal break'):'Clocked in'):'Published shift');locationLabel.textContent=entry?.locationName||shift?.locationName||'';schedule.textContent=shift?stamp(shift.startAt)+' – '+stamp(shift.endAt):stamp(entry.startAt);
  dockText.textContent=wording(current==='early-start'?'Start early':current==='clock-in'?'Clock in':current==='clock-out'?'Clock out':guide.ongoing?'On break':'Shift clock');dock.setAttribute('aria-label',dockText.textContent+' · '+locationLabel.textContent);close.setAttribute('aria-label',wording('Close clock popup'));close.title=wording('Close clock popup');
  const seconds=guide.ongoing?Math.max(0,Math.floor((now()-Date.parse(guide.ongoing.startAt))/1000)):M.elapsed(entry,now());timer.hidden=!entry;timer.textContent=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(value=>String(value).padStart(2,'0')).join(':');
  entitlement.textContent=wording(guide.text);progress.hidden=!entry;progress.textContent=wording('{restTaken} / {restCount} paid rest breaks · {mealsTaken} / {mealCount} unpaid meals',{restTaken:guide.restTaken,restCount:guide.restCount,mealsTaken:guide.mealsTaken,mealCount:guide.mealCount})+(guide.alternatives?wording(' · two meal breaks may replace the second rest'):'');rules.textContent=wording('Clause 14: breaks must not be required in the first or last hour, rest and meal breaks must not be combined, and no more than 5 hours may be worked without a meal break.');
  reminder.textContent=guide.ongoing?(guide.ongoing.paid?wording('Paid rest counts as work. Aim for 10 minutes.'):wording('Meal breaks are unpaid. Take at least 30 minutes and no more than 60 minutes.')):current==='meal-due'?wording('Five hours have passed since starting work or the last meal break. Arrange a meal break now.'):'';reminder.hidden=!reminder.textContent;
  buttons.in.hidden=Boolean(entry);buttons.in.textContent=wording(current==='early-start'?'Approve & clock in':'Clock in');buttons.paid.hidden=buttons.unpaid.hidden=!entry||Boolean(guide.ongoing);buttons['break-end'].hidden=!guide.ongoing;buttons.out.hidden=!entry;
  notesLabel.hidden=!entry;if(entry?.id!==entryNotesId){entryNotesId=entry?.id;let draft;try{draft=entry&&sessionStorage.getItem('opstack-clock-note:'+entry.id);}catch{}notes.value=draft??entry?.notes??'';}
  const early=current==='early-start';managerPanel.hidden=!early;if(!early)managerPin.value='';
  const managerKey=JSON.stringify(state.managers||[]);if(manager.dataset.people!==managerKey){manager.dataset.people=managerKey;manager.replaceChildren();for(const person of [{id:'',username:wording('Choose a manager')},...(state.managers||[])]){const option=create('option');option.value=person.id;option.textContent=person.username;manager.append(option);}window.locationPickers?.refresh(manager);}
  pinHelp.textContent=wording(state.pinSet?'Enter your PIN for every clock or break action.':'Ask a manager to set your four-digit clock PIN in Users.');
  if(early&&!state.managers?.length)pinHelp.textContent+=' '+wording('No eligible manager has a PIN set for this location.');
  pin.disabled=manager.disabled=managerPin.disabled=busy;window.locationPickers?.refresh(manager);
  for(const b of actions.querySelectorAll('button'))b.disabled=busy||!state.pinSet||(early&&!state.managers?.length);
  for(const b of exception.querySelectorAll('button'))b.disabled=busy;
notes.disabled=busy;reason.disabled=busy;actions.hidden=Boolean(pendingAction);exception.hidden=!pendingAction;close.disabled=busy;
  maybeOpen();
 }
 async function fetchState(force=false){
  if(stopped||!session||blocked()&&!force)return;if(loading){if(force){await loading;return fetchState(true);}refreshAgain=true;return loading;}const version=generation;
  loading=(async()=>{try{const response=await fetch('/api/rostering/clock-status',{cache:'no-store',headers:window.appLocationId?{'X-Location-Id':window.appLocationId}:{}});if(response.status===401||response.status===403){stopped=true;hide();return;}if(response.status===428){window.appRequiredReading?.check();hide();return;}if(!response.ok)throw Error('Unable to refresh your shift clock.');const value=await response.json();if(version!==generation)return;state=value;offset=Date.parse(value.serverTime)-Date.now();clearTimeout(nextTimer);if(value.nextChangeAt)nextTimer=setTimeout(()=>fetchState(true),Math.max(30,Math.min(2147483647,Date.parse(value.nextChangeAt)-now()+30)));render();}catch(problem){if(dialog.open)error.textContent=problem.message;}finally{loading=null;if(refreshAgain){refreshAgain=false;queueMicrotask(()=>fetchState());}}})();return loading;
 }
 function requestAction(action,type){
  if(busy||!state||!validPins())return;const warnings=M.warnings(state.entry,state.shift,action,type==='paid',now());error.textContent='';
  if(warnings.length){pendingAction={action,type,context:contextKey()};warning.textContent=warnings.join(' ')+' '+wording('Record what actually happened and add a reason for manager review.');reason.value='';reason.setCustomValidity('');render();reason.focus();return;}performAction(action,type);
 }
 function validPins(){
  for(const field of [pin,...(phase()==='early-start'?[manager,managerPin]:[])]){if(!field.checkValidity()){field.reportValidity();return false;}}
  return true;
 }
 async function performAction(action,type,breakReason){
  if(busy||!state||!validPins())return;const early=phase()==='early-start',secrets={pin:pin.value,...(early?{managerId:manager.value,managerPin:managerPin.value}:{})},payload={action,...(state.entry?{entryId:state.entry.id}:{}),...(action==='in'?{shiftId:state.shift.id}:{}),...(type?{breakType:type}:{}),...(action==='out'?{notes:notes.value}:{}),...(breakReason?{breakReason}:{}),...(early?{managerId:manager.value}:{})},signature=JSON.stringify(payload);
  if(request?.signature!==signature)request={signature,requestId:uid()};clearPins();busy=true;generation++;pendingAction=null;render();error.textContent='';
  try{
   const response=await fetch('/api/rostering/clock',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf,'X-Location-Id':action==='in'?state.shift.locationId:window.appLocationId||session.locationId},body:JSON.stringify({...payload,...secrets,requestId:request.requestId})}),result=await response.json();if(!response.ok){if(response.status===428)window.appRequiredReading?.check();throw Error(result.error||'Unable to save your clock action.');}
   request=null;try{localStorage.setItem('opstack-clock-updated',session.id+':'+Date.now()+':'+Math.random());if(action==='out')sessionStorage.removeItem('opstack-clock-note:'+payload.entryId);}catch{}if(action==='out'&&dialog.open)dialog.close();await fetchState(true);window.dispatchEvent(new Event('shift-clock-updated'));
  }catch(problem){error.textContent=problem.message;await fetchState(true);}finally{busy=false;render();}
 }
 confirm.onclick=()=>{if(!pendingAction)return;if(!reason.value.trim()){reason.setCustomValidity(wording('Enter a reason for the timing exception.'));reason.reportValidity();return;}performAction(pendingAction.action,pendingAction.type,reason.value.trim());};reason.oninput=()=>reason.setCustomValidity('');cancelException.onclick=()=>{pendingAction=null;render();};dock.onclick=()=>open();close.onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('close',()=>{clearPins();pendingAction=null;});dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
 window.addEventListener('before-location-switch',event=>{if(busy)event.preventDefault();});window.addEventListener('focus',()=>fetchState());window.addEventListener('pageshow',()=>fetchState());document.addEventListener('visibilitychange',()=>{if(!document.hidden)fetchState();});window.addEventListener('storage',event=>{if(event.key==='opstack-clock-updated')fetchState(true);});window.addEventListener('required-reading-changed',event=>{if(event.detail.blocked)hide();else fetchState();});window.addEventListener('app-edit-mode-changed',event=>{if(event.detail.enabled)hide();else fetchState();});
 window.appShiftClock={refresh:()=>fetchState(true),open:()=>open()};setInterval(()=>{if(!document.hidden)render();},1000);setInterval(()=>fetchState(),30000);
 notes.oninput=()=>{if(entryNotesId)try{sessionStorage.setItem('opstack-clock-note:'+entryNotesId,notes.value);}catch{}};
 (async()=>{try{await window.appRequiredReading?.ready;const response=await fetch('/api/session',{headers:window.appLocationId?{'X-Location-Id':window.appLocationId}:{}});session=await response.json();if(!session.csrf||!appAccess.can('rostering.clock',session)){stopped=true;return;}await fetchState();}catch{}})();
})();
