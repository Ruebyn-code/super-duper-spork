(()=>{
 const form=document.getElementById('account-form'),home=document.getElementById('account-form-home'),trigger=document.getElementById('create-user');if(!form||!home||!trigger)return;
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=text;window.appWording?.label(e,text);}if(cls)e.className=cls;return e;};
 const button=(text,id)=>{const e=node('button',text);e.type='button';if(id)e.id=id;return e;};
 const field=name=>form.elements.namedItem(name),actions=form.querySelector('.admin-form-actions'),save=document.getElementById('account-save'),cancel=document.getElementById('account-cancel');
 const dialog=node('dialog',undefined,'user-setup-dialog');dialog.id='user-setup-dialog';dialog.dataset.layoutUi='';dialog.dataset.copyEditor='';dialog.setAttribute('aria-labelledby','user-setup-title');
 const header=node('header'),close=button('Close','user-setup-close'),badge=node('span','User setup','user-setup-badge'),title=node('h2','Let’s set up your user'),company=node('p');title.id='user-setup-title';title.dataset.featureHelp='manage-users account-invitations';company.dataset.userText='';header.append(close,badge,title,company);dialog.append(header);document.body.append(dialog);
 const body=node('div',undefined,'user-setup-body'),overview=node('section'),progress=node('p',undefined,'user-setup-progress'),meter=node('progress'),rows=node('ol',undefined,'user-setup-tasks'),stepHeader=node('div',undefined,'user-setup-step-heading'),stepTitle=node('h3'),stepCount=node('p'),fields=node('div',undefined,'user-setup-fields'),review=node('section',undefined,'user-setup-review'),reviewTitle=node('h3','Review your user'),reviewRows=node('dl'),notice=node('p','They will receive a setup link and choose their own password.','small'),status=node('p',undefined,'user-setup-status');
 overview.id='user-setup-checklist';overview.append(progress,meter,rows);meter.max=4;meter.setAttribute('aria-label','User setup progress');stepTitle.id='user-setup-step-title';stepTitle.tabIndex=-1;stepHeader.append(stepCount,stepTitle);review.id='user-setup-review';reviewTitle.tabIndex=-1;review.append(reviewTitle,reviewRows,notice);status.id='user-setup-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');body.append(overview,stepHeader,fields,review,status);
 const back=button('Back to checklist','user-setup-back'),next=button('Continue','user-setup-next'),skip=button('Skip for now','user-setup-skip'),finish=button('Review invitation','user-setup-review-button'),discard=button('Discard draft','user-setup-discard'),complete=button('Finish user setup','user-setup-finish'),rosterHost=node('div',undefined,'user-setup-roster');rosterHost.id='user-setup-roster';
 let active=false,busy=false,stage='overview',context=null,original=[],originalNoValidate=false,changed=false,created=null,savedSummaries=[],roster=null,rosterState={dirty:false,saved:false},rosterDone=false;
 const confirmed=new Map();
 const steps=[
  {id:'details',title:'Name & email',controls:()=>[field('username'),field('email')],summary:()=>[field('username').value.trim(),field('email').value.trim()].filter(Boolean).join(' · ')},
  {id:'phone',title:'Phone & clock PIN',optional:true,controls:()=>[field('phoneNumber')],summary:()=>field('phoneNumber').value.trim()?'Phone added · PIN ending '+field('phoneNumber').value.replace(/\D/g,'').slice(-4):'Skipped for now'},
  {id:'permissions',title:'Permissions',controls:()=>[field('role'),field('roleScope')].filter(Boolean),summary:()=>[field('role')?.selectedOptions[0]?.label,field('roleScope')?.selectedOptions[0]?.label].filter(Boolean).join(' · ')},
  {id:'locations',title:'Locations',controls:()=>[field('locationId'),...form.querySelectorAll('#account-locations input')],summary:()=>{const count=form.querySelectorAll('#account-locations input:checked').length;return count+' location'+(count===1?'':'s')+' · Default: '+(field('locationId').selectedOptions[0]?.label||'Not selected');}},
  {id:'roster',title:'Roster details',optional:true,controls:()=>[],summary:()=>rosterState.ready?'Roster setup ready':rosterDone?'Finish later from Users or Labour settings':'Available after the user is created'}
 ];
 const signature=step=>JSON.stringify(step.controls().map(control=>[control.name,control.type==='checkbox'?control.checked:control.value]));
 const done=step=>step.id==='roster'?rosterDone:created?true:confirmed.get(step.id)===signature(step);
 const summary=step=>created&&step.id!=='roster'?savedSummaries[steps.indexOf(step)]:step.summary();
 const setStatus=text=>{status.textContent=text;};
 function presentation(){document.documentElement.classList.toggle('user-setup-open',dialog.open);trigger.setAttribute('aria-expanded',String(dialog.open));if(window.appEmbedded)parent.appShell?.childPresentationChanged(window);}
 function refresh(){
  if(!active)return;const current=steps.find(step=>step.id===stage),count=steps.filter(done).length;
  progress.textContent=count+' of '+steps.length+' steps complete';progress.dataset.userText='';meter.value=count;
  for(const step of steps){const complete=done(step);step.row.dataset.done=String(complete);step.check.textContent=complete?'✓':String(steps.indexOf(step)+1);step.check.setAttribute('aria-label',complete?'Complete':'Incomplete');step.value.textContent=complete?summary(step):step.id==='roster'?'Employment, award classification and hourly rates · after invitation':step.optional?'Optional — add a phone number or skip for now':'Not completed';step.edit.textContent=complete?'Edit step':'Set up';step.edit.disabled=busy||(created&&step.id!=='roster')||(!created&&step.id==='roster');}
  overview.hidden=stage!=='overview';stepHeader.hidden=!current;fields.hidden=!current;review.hidden=stage!=='review';
  for(const entry of original)entry.node.hidden=entry.node.id==='account-form-title'||!current||!current.elements.includes(entry.node);
  rosterHost.hidden=stage!=='roster';
  if(current){stepCount.textContent='Step '+(steps.indexOf(current)+1)+' of '+steps.length;stepCount.dataset.userText='';stepTitle.textContent=current.title+(current.optional?' (optional)':'');}
  back.hidden=stage==='overview';next.hidden=!current;skip.hidden=!(stage==='phone'&&!field('phoneNumber').value.trim()||stage==='roster'&&!rosterState.dirty);finish.hidden=stage!=='overview'||Boolean(created);finish.disabled=busy||!steps.slice(0,4).every(done);discard.hidden=stage!=='overview'||Boolean(created);save.hidden=stage!=='review'||Boolean(created);cancel.hidden=false;complete.hidden=stage!=='overview'||!created;complete.disabled=busy||!rosterDone;
  for(const control of [back,next,skip,discard,close,cancel])control.disabled=busy;
  save.disabled=busy;form.setAttribute('aria-busy',String(busy));
  if(stage==='review'){
   reviewRows.replaceChildren();for(const step of steps){const term=node('dt',step.title),value=node('dd');value.textContent=summary(step);value.dataset.userText='';reviewRows.append(term,value);}
  }
 }
 function showStage(value,focus=true){if(busy)return;stage=value;setStatus('');refresh();body.scrollTop=0;if(!focus)return;const step=steps.find(item=>item.id===value),target=step?stepTitle:value==='review'?reviewTitle:steps.find(item=>!done(item))?.edit||finish;target?.focus({preventScroll:true});}
 function invalid(step,message,control){showStage(step.id,false);setStatus(message);if(control){const focus=control.tagName==='SELECT'?control.parentElement.querySelector('.location-select-trigger')||control:control;focus.focus({preventScroll:true});control.reportValidity();}return false;}
 function validate(step){
  if(step.id==='roster'){if(!created)return false;if(rosterState.dirty){setStatus('Save the unfinished roster details before continuing.');return false;}return true;}
  const controls=step.controls();field('username').setCustomValidity(field('username').value.trim()?'':'Enter the user’s name.');
  const phone=field('phoneNumber'),number=phone.value.trim(),digits=number.replace(/\D/g,'');phone.setCustomValidity(!number||(/^\+?[\d ().-]+$/.test(number)&&digits.length>=7&&digits.length<=15)?'':'Enter a valid phone number with 7–15 digits, or skip for now.');
  if(step.id==='locations'){
   const selected=[...form.querySelectorAll('#account-locations input:checked')];if(!selected.length)return invalid(step,'Choose at least one location.',controls[1]);
   if(!selected.some(control=>control.value===field('locationId').value))return invalid(step,'Choose a default location included in their location access.',field('locationId'));
  }
  for(const control of controls)if(!control.checkValidity())return invalid(step,control.validationMessage,control);
  if(step.id==='permissions'&&controls.some(control=>!control.value||!control.selectedOptions[0]||control.selectedOptions[0].disabled))return invalid(step,'Choose an available permission level and scope.',field('role'));
  return true;
 }
 function continueStep(){const step=steps.find(item=>item.id===stage);if(!step||!validate(step))return;if(step.id==='roster'){if(!rosterState.ready){setStatus('Complete the roster setup check, or choose Skip for now to finish it later.');return;}rosterDone=true;showStage('overview');return;}confirmed.set(step.id,signature(step));const index=steps.indexOf(step);showStage(index===3?'overview':steps[index+1].id);}
 function closeDialog(){if(busy)return;if(created&&!rosterState.dirty)reset();else if(dialog.open)dialog.close();presentation();trigger.focus({preventScroll:true});}
 function reset(){
  if(!active)return;busy=false;fields.inert=false;
  roster?.dispose();roster=null;window.userEmployment?.hide();rosterHost.replaceChildren();rosterHost.remove();created=null;rosterDone=false;rosterState={dirty:false,saved:false};dialog.close();for(const entry of original){entry.node.hidden=entry.hidden;form.insertBefore(entry.node,actions);}body.remove();for(const control of [back,next,skip,finish,discard,complete])control.remove();
  home.append(form);form.noValidate=originalNoValidate;form.removeAttribute('aria-busy');for(const control of [field('username'),field('phoneNumber')])control.setCustomValidity('');save.hidden=false;save.disabled=false;cancel.disabled=false;cancel.textContent='Cancel edit';active=false;confirmed.clear();changed=false;context=null;original=[];presentation();
 }
 function open(input){
  if(busy)return;if(!active){
   active=true;context=input;company.textContent=input.companyName;originalNoValidate=form.noValidate;form.noValidate=true;changed=false;confirmed.clear();stage='overview';meter.max=steps.length;
   original=[...form.children].filter(child=>child!==actions).map(child=>({node:child,hidden:child.hidden}));
   for(const step of steps){step.elements=step.controls().map(control=>control.closest('label')||control.closest('fieldset')).filter((item,index,array)=>item&&array.indexOf(item)===index);if(step.id==='locations')step.elements=[field('locationId').closest('label'),document.getElementById('account-locations').closest('fieldset')];}
   rows.replaceChildren();for(const step of steps){const row=node('li',undefined,'user-setup-task'),check=node('span',undefined,'user-setup-check'),copy=node('div'),name=node('strong',step.title),value=node('p'),edit=button('Set up');row.dataset.userSetupStep=step.id;edit.dataset.userSetupEdit=step.id;edit.setAttribute('aria-label','Set up '+step.title);edit.onclick=()=>showStage(step.id);copy.append(name,value);row.append(check,copy,edit);rows.append(row);Object.assign(step,{row,check,value,edit});}
   fields.append(...original.map(entry=>entry.node),rosterHost);form.prepend(body);actions.prepend(back,next,skip,finish,complete);actions.append(discard);dialog.append(form);home.hidden=true;cancel.textContent='Close';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);
  }
  if(!dialog.open)dialog.showModal();presentation();refresh();(steps.some(step=>step.id===stage)?stepTitle:stage==='review'?reviewTitle:steps.find(step=>!done(step))?.edit||finish).focus({preventScroll:true});
 }
 function setBusy(value){
  if(!active||busy===value)return;busy=value;fields.inert=value;refresh();
 }
 function allowSubmit(){
  if(!active)return true;if(busy||created)return false;if(stage!=='review'){if(steps.some(step=>step.id===stage))continueStep();else{const incomplete=steps.slice(0,4).find(step=>!done(step));showStage(incomplete?.id||'review');}return false;}
  for(const step of steps.slice(0,4)){if(!validate(step))return false;if(!done(step)){showStage(step.id);setStatus('Review this step before sending the invitation.');return false;}}
  if(!window.appAccess.can('users.create')){setStatus('You no longer have permission to invite users.');return false;}return true;
 }
 form.addEventListener('submit',event=>{if(!allowSubmit()){event.preventDefault();event.stopImmediatePropagation();}},true);
 for(const eventName of ['input','change'])form.addEventListener(eventName,event=>{if(!active||!fields.contains(event.target)||busy)return;changed=true;setStatus('');for(const step of steps)if(!done(step))confirmed.delete(step.id);refresh();});
 next.onclick=continueStep;skip.onclick=()=>{if(stage==='roster'){if(busy||rosterState.dirty)return;rosterDone=true;showStage('overview');}else continueStep();};back.onclick=()=>showStage('overview');finish.onclick=()=>{for(const step of steps.slice(0,4))if(!validate(step)||!done(step))return;showStage('review');};complete.onclick=()=>{if(!rosterDone||busy)return;reset();home.hidden=true;trigger.focus({preventScroll:true});};
 discard.onclick=()=>{if(busy)return;reset();form.reset();trigger.focus({preventScroll:true});};
 close.onclick=closeDialog;dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});dialog.addEventListener('close',presentation);
 const hasDraft=()=>active&&(created?rosterState.dirty:changed||confirmed.size>0);
 window.addEventListener('before-location-switch',event=>{if(busy||dialog.open||hasDraft()){event.preventDefault();if(!dialog.open&&!busy)open();setStatus('Finish or discard the user setup draft before switching pages, locations or companies.');}});
 window.addEventListener('beforeunload',event=>{if(busy||hasDraft()){event.preventDefault();event.returnValue='';}});
 async function loadRoster(){
  const identity=created.id;roster?.dispose();window.userEmployment?.hide();rosterHost.replaceChildren();rosterDone=false;rosterState={dirty:false,saved:false};
  try{roster=await window.userSetupRoster.open(rosterHost,{account:created,locations:context.locations,companyId:context.companyId,onState:state=>{if(!active||created?.id!==identity)return;if(state.discard){loadRoster();return;}rosterState=state;setBusy(state.busy);refresh();}});}catch(error){setBusy(false);setStatus('The user is created. '+error.message+' You can finish roster details later.');}
 }
 async function invited(account,message){
  savedSummaries=steps.slice(0,4).map(step=>step.summary());created=account;setBusy(false);showStage('roster');setStatus(message);await loadRoster();
 }
 window.userSetup={open,reset,close:closeDialog,setBusy,setStatus,invited,get active(){return active;},get busy(){return busy;},get created(){return created;},get context(){return context;}};
})();
