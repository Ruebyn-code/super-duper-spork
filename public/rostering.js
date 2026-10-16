(()=>{
 const $=id=>document.getElementById(id),M=rosteringModel,dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;},user=element=>{element.dataset.userText='';return element;},can=key=>appAccess.can(key),money=value=>value===null||value===undefined?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100),hours=value=>(value/3600).toFixed(2)+' h',date=value=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:M.timeZone}).format(new Date(value+'T12:00:00Z')),time=value=>new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:M.timeZone}).format(new Date(value)),uid=()=>crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
 let session,data,week=M.monday(M.today()),section='',loading=0,clockOffset=0,clockBusy=false,clockRequest=null;
 const status=(message,good=false)=>{const target=$('rostering-status');target.textContent=message;target.classList.toggle('success',good);};
 async function api(route,method='GET',body){const response=await fetch('/api/rostering/'+route,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||'',...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!response.ok){if(response.status===401)location.href=companyLoginUrl();if(response.status===428)window.appRequiredReading?.check();throw Error(result.error||'Unable to load rostering.');}return result;}
 const field=(caption,input)=>{const label=node('label',caption);label.append(input);return label;};
 function input(type,name,value=''){const result=node('input');result.type=type;result.name=name;result.value=value;return result;}
 function select(name,items,value){const result=node('select');result.name=name;for(const [id,text]of items){const option=node('option',text);option.value=id;result.append(option);}if(value!==undefined)result.value=value;if(name==='userId')for(const option of result.options)option.dataset.userText='';return result;}
 function button(text,action,cls){const result=node('button',text,cls);result.type='button';result.onclick=action;return result;}
 function badge(text,cls=''){return node('span',text,'roster-badge '+cls);}
 function metric(title,value,detail,cls=''){const card=node('article',undefined,'roster-metric '+cls);card.append(node('span',title),user(node('strong',value)));if(detail)card.append(user(node('small',detail)));return card;}
 const settingsAccess=()=>['rostering.costs','rostering.budget.location','rostering.budget.company','rostering.budget.network'].some(can);
 function renderSidebar(){const nav=document.querySelector('.rostering-sidebar'),items=[['roster','Roster','<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4"/><path class="icon-detail" d="M3 11h18M7 15h3M14 15h3"/>'],['timesheets','Timesheets','<path d="M5 3h14v18H5Z"/><path class="icon-detail" d="M8 7h8M8 11h8M8 15h5"/>'],['clock','Clock in / out','<circle cx="12" cy="12" r="9"/><path class="icon-detail" d="M12 6v6l4 2"/>'],['availability','Availability','<rect x="3" y="4" width="18" height="17" rx="2"/><path class="icon-detail" d="m7 13 3 3 7-7"/>'],...(settingsAccess()?[['settings','Labour settings','<path d="M4 5h16v14H4Z"/><path class="icon-detail" d="M7 9h10M7 15h10M10 7v4M15 13v4"/>']]:[])];nav.replaceChildren();for(const [id,name,path]of items){const link=node('a',undefined,'page-sidebar-link');link.href='#'+id;link.title=name;link.setAttribute('aria-label',name);link.dataset.rosterView=id;link.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';link.append(node('span',name,'page-sidebar-label'));nav.append(link);}}
 // Background refreshes must not replace active editors or announce loading in the layout.
 function rosterInteractionActive(){
  const board=$('roster-days'),focused=document.activeElement;
  return rosterSaving||rosterPress||rosterDrag||rosterDirty()||document.querySelector('.roster-dialog[open]')||board.querySelector('.location-select-trigger[aria-expanded="true"]')||(board.contains(focused)&&focused.matches('input,textarea,select,[role="combobox"]'));
 }
 function clockDisplayKey(entry){return JSON.stringify(entry?[entry.id,entry.startAt,entry.endAt,entry.onBreak,entry.locationId,entry.locationName]:null);}
 async function load(quiet=false,background=false){
  const version=quiet?loading:++loading;if(!quiet&&!background)status('Loading rostering…');
  try{
   const result=await api('dashboard?week='+week);if(version!==loading)return;
   if(quiet&&data){data.clock=result.clock;clockOffset=Date.parse(result.serverTime)-Date.now();if(section==='clock')renderClock();return;}
   if(!quiet&&section==='roster'&&rosterInteractionActive()){if($('rostering-status').textContent==='Loading rostering…')status('');return;}
   data=result;clockOffset=Date.parse(data.serverTime)-Date.now();$('roster-week').value=week;$('roster-week-label').textContent=date(week)+' – '+date(data.weekEnd);
   if(!quiet){renderSection();if(!background)status('');}else if(section==='clock')renderClock();
  }catch(error){if(version===loading)status(error.message);}
 }
 async function view(){if(!session||appRequiredReading.blocked)return;let next=location.hash.slice(1)||'roster';if(section==='roster'&&next!=='roster'&&(rosterSaving||rosterDirty())){if(!await flushRosterEdits()){history.replaceState(null,'','#roster');return;}}if(!['roster','timesheets','clock','availability','settings'].includes(next)||next==='settings'&&!settingsAccess())next='roster';section=next;$('roster-toolbar-controls').hidden=section!=='roster';for(const panel of document.querySelectorAll('[data-roster-panel]'))panel.hidden=panel.dataset.rosterPanel!==section;for(const link of document.querySelectorAll('[data-roster-view]')){if(link.dataset.rosterView===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}if(data)renderSection();load();}
 function renderSection(){if(!data)return;const render={roster:renderRoster,timesheets:renderTimesheets,clock:renderClock,availability:renderAvailability,settings:renderSettings};render[section||'roster']();appAccess.apply(session);}
 function renderRoster(preserveBoard=false){const summaryKey=data.summary?Object.fromEntries(['projection','effectiveBudget','budgetCents','plannedCostCents','unpricedShifts','plannedSeconds','plannedPercent','remainingCents'].map(key=>[key,data.summary[key]])):null,key=JSON.stringify([data.weekStart,rosterView,rosterDay,can('rostering.manage'),data.roster,data.people,data.positions,summaryKey]);if(key===rosterRenderKey&&$('roster-days').querySelector('.roster-board,.roster-day-board'))return;const summary=data.summary,metrics=$('roster-metrics');metrics.replaceChildren();metrics.hidden=!summary;if(summary){const budget=summary.effectiveBudget;metrics.append(metric('Projected sales',money(summary.projection.projectedSalesCents),summary.projection.weeksRecorded+'/4 completed sales weeks'),metric('Labour budget',money(summary.budgetCents),budget?budget.scope[0].toUpperCase()+budget.scope.slice(1)+' '+(budget.mode==='percent'?(budget.value/100).toFixed(2)+'%':'weekly budget'):'Set a labour budget in Labour settings'),metric('Roster cost',money(summary.plannedCostCents),summary.unpricedShifts?summary.unpricedShifts+' shifts need staff or hourly rates':hours(summary.plannedSeconds)+(summary.plannedPercent!==null?' · '+summary.plannedPercent.toFixed(1)+'% of forecast':'')),metric('Budget remaining',money(summary.remainingCents),summary.remainingCents===null?'Needs a budget, forecast and hourly rates':summary.remainingCents<0?'Roster is over budget':'After rostered labour',summary.remainingCents<0?'negative':'positive'));}
  syncRosterViewControls();const manage=can('rostering.manage');$('roster-view-title').textContent=manage?'Weekly roster':'My published shifts';$('roster-published-status').textContent=data.roster.publishedAt?'Published '+date(M.localParts(data.roster.publishedAt).date)+' by '+data.roster.publishedBy+(manage&&data.roster.hasChanges?' · Unpublished changes':''):manage?'Draft — publish to make shifts visible to users.':'No roster has been published for this week.';$('roster-manager-actions').hidden=!manage;$('roster-copy').disabled=data.roster.shifts.length>0;$('roster-publish').disabled=!data.roster.hasChanges&&Boolean(data.roster.publishedAt);
  if(preserveBoard)updateRosterBoardTotals();else renderRosterBoard(manage,summary);rosterRenderKey=key;updateRosterSaveStatus();}
 // The scheduling board moves shifts, independently of company App edit layouts.
 let clockRenderKey='',rosterRenderKey='',rosterView='staff',rosterDay=M.today(),rosterSaving=false,rosterPress=null,rosterDrag=null,rosterFrame=0,rosterSaveTimer=0,rosterSaveTask=null,rosterNeedsLayout=false,selectedRosterShift=null,rosterDeleting=false,rosterDraggedAt=-Infinity;
 const rosterEditors=new Map(),newRosterShifts=new Map(),deletedRosterShifts=[];
 const rosterDirty=()=>Boolean($('roster-days')?.querySelector('.roster-shift.is-dirty'));
 const rosterEditing=()=>document.body.classList.contains('app-edit-mode');
 function rosterPayload(shift,changes={}){return{weekStart:week,revision:data.roster.revision,userId:shift.userId,date:shift.date,start:shift.start,end:shift.end,overnight:shift.overnight,breakMinutes:shift.breakMinutes,position:shift.position,notes:shift.notes,allowUnavailable:shift.allowUnavailable,...changes};}
 function addBoardShift(day=week,userId=null){
  if(!data||!can('rostering.manage')||rosterEditing())return;
  cancelRosterDrag();
  const shift={id:uid(),userId,username:data.people.find(person=>person.id===userId)?.username||'Vacant',date:day,start:'09:00',end:'17:00',overnight:false,breakMinutes:30,position:'',notes:'',allowUnavailable:false,paidSeconds:27000,costCents:null,availability:'unknown'};
  newRosterShifts.set(shift.id,shift);
  const cell=[...$('roster-days').querySelectorAll('[data-roster-drop]')].find(cell=>cell.dataset.rosterDate===day&&(rosterView==='stacked'||cell.dataset.rosterUser===(userId||'')));
  const card=rosterCard(shift,true);if(rosterView==='day'){const holder=node('div',undefined,'roster-cell roster-day-editor');cell.after(holder);holder.append(card);}else cell.insertBefore(card,cell.querySelector('.roster-cell-add'));
  card.scrollIntoView({block:'nearest',inline:'nearest'});card.querySelector('[name=start]').focus({preventScroll:true});status('');
 }
 function updateRosterSaveStatus(){
  const label=$('roster-save-status');if(!label)return;
  const editors=[...rosterEditors.values()],error=editors.some(editor=>editor.error),pending=editors.some(editor=>editor.dirty);
  label.textContent=error?'Changes need attention':rosterSaving||pending?'Saving changes…':'All changes saved';
  label.classList.toggle('has-error',error);
 }
 function setRosterEditorError(editor,message){
  if(!message&&editor.error&&$('rostering-status').textContent===editor.error)status('');
  editor.error=message;editor.message.textContent=message;editor.message.hidden=!message;
  editor.undo.hidden=!message;editor.card.classList.toggle('has-save-error',Boolean(message));updateRosterSaveStatus();
 }
 function queueRosterEditor(editor,delay=450){
  if(editor.blocked){setRosterEditorError(editor,'The roster changed. Undo this edit and refresh before continuing.');return;}
  if(editor.deleting)return;setRosterEditorError(editor,'');editor.dirty=editor.isNew||JSON.stringify(editor.read())!==JSON.stringify(editor.saved);
  editor.pending=editor.dirty;editor.card.classList.toggle('is-dirty',editor.dirty);updateRosterSaveStatus();
  clearTimeout(rosterSaveTimer);if([...rosterEditors.values()].some(item=>item.pending&&!item.error))rosterSaveTimer=setTimeout(saveRosterEditors,delay);
 }
 async function refreshRosterSaved(preserveBoard=true){
  const result=await api('dashboard?week='+week);if(result.roster.revision!==data.roster.revision)for(const editor of rosterEditors.values())if(editor.dirty){editor.pending=false;editor.blocked=true;setRosterEditorError(editor,'The roster changed. Undo this edit and refresh before continuing.');}data=result;clockOffset=Date.parse(data.serverTime)-Date.now();
  for(const editor of rosterEditors.values()){
   const saved=data.roster.shifts.find(shift=>shift.id===editor.shift.id);
   if(saved&&!editor.dirty)Object.assign(editor.shift,saved);
  }
  if(preserveBoard){rosterRenderKey='';renderRoster(true);}else{rosterRenderKey='';renderRoster();}
 }
 function updateRosterBoardTotals(){
  if(rosterView==='day'){updateDailyShiftBars();return;}
  for(const header of $('roster-days').querySelectorAll('.roster-board-day')){
   const shifts=data.roster.shifts.filter(shift=>shift.date===header.dataset.rosterDate),details=header.querySelectorAll('small');
   details[0].textContent=hours(shifts.reduce((sum,shift)=>sum+shift.paidSeconds,0));
   if(details[1])details[1].textContent=money(shifts.some(shift=>shift.costCents===null)?null:shifts.reduce((sum,shift)=>sum+shift.costCents,0))+' labour';
  }
  for(const label of $('roster-days').querySelectorAll('.roster-staff-label'))label.querySelector('small').textContent=hours(data.roster.shifts.filter(shift=>(shift.userId||'')===label.dataset.rosterStaff).reduce((sum,shift)=>sum+shift.paidSeconds,0));
 }
 function settleRosterLayout(){
  if(rosterNeedsLayout&&!rosterInteractionActive()){rosterNeedsLayout=false;rosterRenderKey='';renderRoster();}
 }
 async function saveRosterEditors(){
  clearTimeout(rosterSaveTimer);if(rosterSaveTask)return rosterSaveTask;if(rosterDeleting)return;
  rosterSaveTask=(async()=>{
   await Promise.resolve();rosterSaving=true;updateRosterSaveStatus();let wrote=false,conflict=false;
   try{
    for(let editor;(editor=[...rosterEditors.values()].find(item=>item.pending&&!item.error&&!item.deleting));){
     editor.pending=false;const values=editor.read();
     try{
      if(!editor.form.checkValidity())throw Error('Enter valid start and end times.');
      M.interval({...editor.shift,...values});
      const wasNew=editor.isNew,oldId=editor.shift.id,previousUser=editor.shift.userId;
      const result=await api(wasNew?'shifts':'shifts/'+oldId,wasNew?'POST':'PUT',rosterPayload(editor.shift,values));
      wrote=true;data.roster.revision=result.revision;data.roster.hasChanges=true;
      newRosterShifts.delete(oldId);rosterEditors.delete(oldId);Object.assign(editor.shift,result.shift);editor.isNew=false;
      editor.card.dataset.shiftId=result.shift.id;editor.card.dataset.layoutKey='shift:'+result.shift.id;delete editor.card.dataset.newShift;
      rosterEditors.set(result.shift.id,editor);editor.saved=values;
      const savedIndex=data.roster.shifts.findIndex(shift=>shift.id===oldId);if(savedIndex<0)data.roster.shifts.push(editor.shift);else data.roster.shifts[savedIndex]=editor.shift;
      editor.dirty=JSON.stringify(editor.read())!==JSON.stringify(values);editor.pending=editor.dirty;editor.card.classList.toggle('is-dirty',editor.dirty);
      if(selectedRosterShift===oldId)selectRosterShift(result.shift.id);
      if(previousUser!==result.shift.userId)rosterNeedsLayout=true;
     }catch(error){if(error.message.startsWith('The roster changed')){editor.blocked=true;conflict=true;}setRosterEditorError(editor,error.message);status(error.message);}
    }
    if(wrote||conflict)try{await refreshRosterSaved();}catch(error){status('Changes saved. '+error.message);}
   }finally{
    rosterSaving=false;rosterSaveTask=null;updateRosterSaveStatus();settleRosterLayout();
    if([...rosterEditors.values()].some(editor=>editor.pending&&!editor.error))rosterSaveTimer=setTimeout(saveRosterEditors,0);
   }
  })();return rosterSaveTask;
 }
 async function flushRosterEdits(){
  if(rosterDeleting){status('Saving changes…');return false;}
  if(rosterSaving&&!rosterSaveTask){status('Saving changes…');return false;}
  clearTimeout(rosterSaveTimer);do{await saveRosterEditors();}while([...rosterEditors.values()].some(editor=>editor.pending&&!editor.error));
  if(rosterDirty()){
   const editor=[...rosterEditors.values()].find(editor=>editor.dirty);
   status(editor?.error||'Complete the shift details before continuing.');return false;
  }
  return true;
 }
 async function saveBoardShift(shift,changes){
  if(rosterSaving||rosterDirty())return false;
  rosterSaving=true;updateRosterSaveStatus();const board=$('roster-days');board.inert=true;board.setAttribute('aria-busy','true');
  try{await api('shifts/'+shift.id,'PUT',rosterPayload(shift,changes));await refreshRosterSaved(false);status('Shift saved to draft. Publish when the roster is ready.',true);return true;}
  catch(error){status(error.message);return false;}
  finally{rosterSaving=false;board.inert=false;board.removeAttribute('aria-busy');updateRosterSaveStatus();}
 }
 function shiftTimeInput(name,value){
  const control=input('text',name,M.formatTimeInput(value));control.className='roster-time-input';control.autocomplete='off';control.spellcheck=false;control.maxLength=8;control.required=true;
  control.title='Enter a time such as 9:00a or 17:00';
  control.addEventListener('blur',()=>{const parsed=M.parseTimeInput(control.value);if(parsed)control.value=M.formatTimeInput(parsed);});
  control.addEventListener('keydown',event=>{if(!['ArrowUp','ArrowDown'].includes(event.key)||event.ctrlKey||event.metaKey||event.altKey)return;const parsed=M.parseTimeInput(control.value);if(!parsed)return;event.preventDefault();const total=(M.minutes(parsed)+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?15:1)+1440)%1440;control.value=M.formatTimeInput(String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0'));control.dispatchEvent(new Event('input',{bubbles:true}));});
  return control;
 }
 function readShiftTime(control){const value=M.parseTimeInput(control.value);control.setCustomValidity(value?'':'Enter a time such as 9:00a or 17:00.');return value||'';}
 function selectRosterShift(id){
  selectedRosterShift=id;
  for(const card of $('roster-days').querySelectorAll('[data-shift-id],[data-timeline-shift]')){const selected=(card.dataset.shiftId||card.dataset.timelineShift)===id;card.classList.toggle('is-selected',selected);if(card.matches('button.roster-day-shift'))card.setAttribute('aria-pressed',String(selected));}
 }
 function deletionFeedback(){
  let feedback=$('roster-deletion-feedback');
  if(!feedback){feedback=node('div',undefined,'roster-deletion-feedback');feedback.id='roster-deletion-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.append(node('span','Shift deleted.'),button('Undo',undoRosterDeletion));document.body.append(feedback);}
  feedback.hidden=!deletedRosterShifts.length;feedback.querySelector('button').disabled=rosterDeleting;
 }
 async function removeBoardShift(editor){
  if(rosterDeleting||!can('rostering.manage')||rosterEditing())return;
  rosterDeleting=true;editor.deleting=true;editor.pending=false;editor.card.inert=true;cancelRosterDrag();
  try{
   if(rosterSaveTask)await rosterSaveTask;
   rosterSaving=true;updateRosterSaveStatus();
   let snapshot={...editor.shift};if(editor.read){const candidate={...snapshot,...editor.read()};try{M.interval(candidate);snapshot=candidate;}catch{}}
   if(!editor.isNew){const result=await api('shifts/'+editor.shift.id,'DELETE',{weekStart:week,revision:data.roster.revision});data.roster.revision=result.revision;}
   newRosterShifts.delete(editor.shift.id);rosterEditors.delete(editor.shift.id);editor.card.closest('.roster-day-editor')?.remove();editor.card.remove();
   for(const element of $('roster-days').querySelectorAll('[data-shift-id],[data-timeline-shift]'))if((element.dataset.shiftId||element.dataset.timelineShift)===editor.shift.id)element.remove();
   selectRosterShift(null);deletedRosterShifts.push({shift:snapshot,weekStart:week});deletionFeedback();status('');
   if(!editor.isNew)await refreshRosterSaved();
  }catch(error){status(error.message);}
  finally{editor.deleting=false;editor.card.inert=false;rosterSaving=rosterDeleting=false;updateRosterSaveStatus();deletionFeedback();if([...rosterEditors.values()].some(editor=>editor.pending&&!editor.error))rosterSaveTimer=setTimeout(saveRosterEditors,0);}
 }
 async function undoRosterDeletion(){
  const previous=deletedRosterShifts.at(-1);if(!previous||rosterDeleting)return;
  rosterDeleting=true;deletionFeedback();
  try{
   if(rosterSaveTask)await rosterSaveTask;rosterSaving=true;updateRosterSaveStatus();
   if(previous.weekStart!==week)throw Error('Return to the deleted shift’s week to undo.');
   const result=await api('shifts','POST',rosterPayload(previous.shift));data.roster.revision=result.revision;deletedRosterShifts.pop();await refreshRosterSaved();
   if(rosterView!=='day'){
    const cell=[...$('roster-days').querySelectorAll('[data-roster-drop]')].find(cell=>cell.dataset.rosterDate===result.shift.date&&(rosterView==='stacked'||cell.dataset.rosterUser===(result.shift.userId||'')));
    if(cell){const shift=data.roster.shifts.find(item=>item.id===result.shift.id),card=rosterCard(shift,true);cell.insertBefore(card,cell.querySelector('.roster-cell-add'));card.focus({preventScroll:true});selectRosterShift(shift.id);}
   }
   status('');
  }catch(error){status(error.message);}
  finally{rosterSaving=rosterDeleting=false;updateRosterSaveStatus();deletionFeedback();if([...rosterEditors.values()].some(editor=>editor.pending&&!editor.error))rosterSaveTimer=setTimeout(saveRosterEditors,0);}
 }
 function renderRosterBoard(manage,summary){
  cancelRosterDrag();rosterNeedsLayout=false;rosterEditors.clear();const host=$('roster-days'),scrollLeft=host.scrollLeft,scrollTop=host.scrollTop,boardShifts=[...data.roster.shifts,...newRosterShifts.values()];
  host.replaceChildren();host.className='roster-board-scroll';host.tabIndex=0;host.setAttribute('aria-label','Weekly roster. Scroll to see all days.');
  if(rosterView==='day'){renderDailyRoster(manage,boardShifts);return;}
  const board=node('div',undefined,'roster-board '+(rosterView==='staff'?'roster-staff-board':'roster-stacked-board'));host.append(board);
  if(rosterView==='staff'){
   const corner=node('div',undefined,'roster-board-corner');corner.append(node('strong','Staff'),node('small',data.people.length+' people'));board.append(corner);
  }
  for(let index=0;index<7;index++){
   const day=M.shiftDate(week,index),shifts=data.roster.shifts.filter(item=>item.date===day),header=node('div',undefined,'roster-board-day');
   header.dataset.rosterDate=day;header.append(user(node('strong',dayNames[index].slice(0,3)+' '+date(day))),user(node('small',hours(shifts.reduce((sum,item)=>sum+item.paidSeconds,0)))));
   if(summary){const cost=shifts.some(item=>item.costCents===null)?null:shifts.reduce((sum,item)=>sum+item.costCents,0);header.append(user(node('small',money(cost)+' labour','roster-day-cost')));}
   board.append(header);
  }
  if(rosterView==='staff'){
   const people=[...(manage?[{id:null,username:'Vacant'}]:[]),...data.people];
   // Retain shifts assigned to a person who has since left this location.
   for(const shift of data.roster.shifts)if(!people.some(person=>person.id===shift.userId))people.push({id:shift.userId,username:shift.username});
   for(const person of people){
    const shifts=boardShifts.filter(shift=>shift.userId===person.id),label=node('div',undefined,'roster-staff-label');
    label.dataset.rosterStaff=person.id||'';label.append(user(node('strong',person.username)),user(node('small',hours(shifts.reduce((sum,shift)=>sum+shift.paidSeconds,0)))));board.append(label);
    for(let index=0;index<7;index++)board.append(rosterCell(M.shiftDate(week,index),person.id,shifts,manage));
   }
  }else{
   for(let index=0;index<7;index++)board.append(rosterCell(M.shiftDate(week,index),undefined,boardShifts,manage));
  }
  $('roster-view-staff').setAttribute('aria-pressed',String(rosterView==='staff'));$('roster-view-stacked').setAttribute('aria-pressed',String(rosterView==='stacked'));
  host.scrollLeft=scrollLeft;host.scrollTop=scrollTop;selectRosterShift(selectedRosterShift);
 }
 function rosterCell(day,userId,shifts,manage){
  const cell=node('div',undefined,'roster-cell'+(rosterView==='stacked'?' roster-stack-column':''));cell.dataset.rosterDrop='';cell.dataset.rosterDate=day;
  if(userId!==undefined)cell.dataset.rosterUser=userId||'';
  for(const shift of shifts.filter(item=>item.date===day).sort((a,b)=>a.start.localeCompare(b.start)||a.username.localeCompare(b.username)))cell.append(rosterCard(shift,manage));
  if(manage){const add=button('+ Add Shift',()=>addBoardShift(day,userId),'roster-cell-add');add.setAttribute('aria-label','Add shift on '+day+(userId===undefined?'':userId===null?' for Vacant':' for '+(data.people.find(person=>person.id===userId)?.username||'staff')));cell.append(add);}
  else if(!cell.children.length)cell.append(node('span','—','roster-cell-empty'));
  return cell;
 }
 function syncRosterViewControls(){
  if(M.monday(rosterDay)!==week)rosterDay=week;
  for(const view of ['staff','stacked','day'])$('roster-view-'+view).setAttribute('aria-pressed',String(rosterView===view));
  const picker=$('roster-day');$('roster-day-control').hidden=rosterView!=='day';
  if(picker.dataset.week!==week){picker.replaceChildren();for(let index=0;index<7;index++){const day=M.shiftDate(week,index),option=user(node('option',dayNames[index].slice(0,3)+' '+date(day)));option.value=day;picker.append(option);}picker.dataset.week=week;}
  picker.value=rosterDay;window.locationPickers?.refresh(picker);
 }
 function dailyShifts(){
  return [...data.roster.shifts,...(data.roster.carryoverShifts||[])].filter(shift=>shift.date===rosterDay||shift.overnight&&M.shiftDate(shift.date,1)===rosterDay&&shift.end!=='00:00');
 }
 function renderDailyRoster(manage,shifts){
  const host=$('roster-days');host.classList.add('roster-daily-scroll');host.setAttribute('aria-label','Daily roster hourly timeline');
  const board=node('div',undefined,'roster-day-board'),corner=node('div',undefined,'roster-board-corner'),axis=node('div',undefined,'roster-day-hours');corner.append(node('strong','Staff'),user(node('small',date(rosterDay))));
  for(let hour=0;hour<24;hour++){const tick=user(node('span',String(hour).padStart(2,'0')+':00'));axis.append(tick);}axis.setAttribute('aria-label','Hours from midnight to midnight');board.append(corner,axis);host.append(board);
  const visible=dailyShifts(),people=[...(manage?[{id:null,username:'Vacant'}]:[]),...data.people];
  for(const shift of visible)if(!people.some(person=>person.id===shift.userId))people.push({id:shift.userId,username:shift.username});
  for(const person of people){
   const label=node('div',undefined,'roster-staff-label'),lane=node('div',undefined,'roster-day-lane');label.dataset.rosterStaff=person.id||'';label.append(user(node('strong',person.username)));lane.dataset.rosterDrop='';lane.dataset.rosterDate=rosterDay;lane.dataset.rosterUser=person.id||'';lane.setAttribute('aria-label',person.username+' on '+rosterDay);
   if(manage){const add=button('+',()=>addBoardShift(rosterDay,person.id),'roster-cell-add roster-day-add');add.setAttribute('aria-label','Add shift on '+rosterDay+' for '+person.username);label.append(add);}board.append(label,lane);
  }
  updateDailyShiftBars();
  if(innerWidth<=1000&&visible.length){const first=Math.min(...visible.map(shift=>shift.date===rosterDay?M.minutes(shift.start):0)),lane=board.querySelector('.roster-day-lane');host.scrollLeft=Math.max(0,(first-60)/1440*lane.getBoundingClientRect().width);}
 }
 function updateDailyShiftBars(){
  if(rosterPress||rosterDrag){rosterNeedsLayout=true;return;}
  const shifts=dailyShifts(),manage=can('rostering.manage');
  for(const lane of $('roster-days').querySelectorAll('.roster-day-lane')){
   for(const bar of lane.querySelectorAll('.roster-day-shift'))bar.remove();
   const tracks=[],entries=shifts.filter(shift=>(shift.userId||'')===lane.dataset.rosterUser).map(shift=>({shift,start:shift.date===rosterDay?M.minutes(shift.start):0,end:shift.date===rosterDay?(shift.overnight?1440:M.minutes(shift.end)):M.minutes(shift.end)})).sort((a,b)=>a.start-b.start||a.end-b.end);
   for(const {shift,start,end}of entries){
    if(end<=start)continue;let track=tracks.findIndex(until=>until<=start);if(track<0)track=tracks.length;tracks[track]=end;
    const carry=shift.date!==rosterDay,bar=node(manage&&!carry?'button':'div',undefined,'roster-day-shift'+(carry?' is-continuation':''));if(bar.tagName==='BUTTON')bar.type='button';bar.style.left=(start/1440*100)+'%';bar.style.width=((end-start)/1440*100)+'%';bar.style.top=(track*34+5)+'px';
    const label=shift.start+' – '+shift.end+(shift.overnight?' +1':''),detail=hours(shift.paidSeconds)+' paid'+(shift.position?' · '+shift.position:'');bar.append(user(node('strong',label)),user(node('small',detail)));bar.title=shift.username+' · '+label+' · '+detail+' · '+shift.breakMinutes+'m unpaid break'+(carry?' · Continues from '+date(shift.date):'');bar.setAttribute('aria-label',bar.title);bar.dataset.timelineShift=shift.id;
    if(manage&&!carry){
     bar.setAttribute('aria-keyshortcuts','Backspace Delete');bar.addEventListener('focus',()=>selectRosterShift(shift.id));bar.addEventListener('pointerdown',event=>startRosterPress(event,shift,bar));bar.addEventListener('contextmenu',event=>{if(rosterPress||rosterDrag)event.preventDefault();});
     bar.onclick=async()=>{
      if(performance.now()-rosterDraggedAt<400)return;selectRosterShift(shift.id);
      if(rosterEditors.has(shift.id))return;
      if(!await flushRosterEdits())return;const holder=node('div',undefined,'roster-cell roster-day-editor'),card=rosterCard(data.roster.shifts.find(item=>item.id===shift.id)||shift,true);lane.after(holder);holder.append(card);selectRosterShift(shift.id);
     };
    };lane.append(bar);
   }
   lane.style.minHeight=(Math.max(1,tracks.length)*34+15)+'px';
  }
  selectRosterShift(selectedRosterShift);
 }
 async function selectRosterDay(value){if(!await flushRosterEdits()){$('roster-day').value=rosterDay;window.locationPickers?.refresh($('roster-day'));return;}rosterDay=value;renderRoster();}
 function rosterPositionControl(shift){
  const names=[...new Set([...(data.positions||[]),...data.roster.shifts.map(item=>item.position),shift.position].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  let addValue='__add_position__';while(names.includes(addValue))addValue+='+';
  const position=select('position',[['','No position'],...names.map(name=>[name,name]),[addValue,'+ Add position…']],shift.position||''),wrap=node('div',undefined,'roster-position-field'),code=user(node('span','','roster-position-code'));
  for(const option of position.options)if(option.value&&option.value!==addValue)option.dataset.userText='';position.setAttribute('aria-label','Position for '+shift.username);wrap.append(position,code);
  let selected=shift.position||'';
  function refresh(){code.textContent=selected?selected.split(/\s+/).map(word=>word[0]).join('').slice(0,2).toUpperCase():'–';wrap.title=selected||'No position';window.locationPickers?.refresh(position);}
  position.onchange=()=>{
   if(position.value!==addValue){selected=position.value;refresh();return;}
   position.value=selected;refresh();
   const ui=makeDialog('Add position'),name=input('text','positionName');name.required=true;name.maxLength=80;name.autocomplete='off';ui.form.append(field('Position name',name));ui.save.textContent='Use position';
   ui.form.onsubmit=event=>{event.preventDefault();const value=name.value.trim();if(!value){ui.error.textContent='Enter a position name.';return;}if(![...position.options].some(option=>option.value===value)){const option=user(node('option',value));option.value=value;position.insertBefore(option,position.lastElementChild);}position.value=value;position.dispatchEvent(new Event('change',{bubbles:true}));ui.dialog.close();};ui.finish();
  };
  refresh();return{wrap,position,reset(){selected=shift.position||'';position.value=selected;refresh();}};
 }
 function rosterCard(shift,manage){
  const isNew=newRosterShifts.has(shift.id),card=node('article',undefined,'roster-shift'+(shift.userId===null?' roster-vacant-shift':''));card.dataset.shiftId=shift.id;card.dataset.layoutKey='shift:'+shift.id;if(isNew)card.dataset.newShift='';
  const availability=shift.availability==='unavailable'?'Availability conflict':shift.availability==='unknown'?'Availability not entered':shift.userId===null?'Vacant shift':'Available';
  const description=[shift.position||'No position',shift.date,shift.start+' – '+shift.end+(shift.overnight?' · ends next day':''),hours(shift.paidSeconds),shift.breakMinutes+'m unpaid break',...(manage?[money(shift.costCents),availability]:[]),shift.notes].filter(Boolean).join(' · ');card.title=description;
  if(manage){
   const form=node('form',undefined,'roster-inline-form'),position=rosterPositionControl(shift),staff=select('userId',[['','Vacant'],...data.people.map(person=>[person.id,person.username])],shift.userId||''),staffField=node('div',undefined,'roster-staff-field'),start=shiftTimeInput('start',shift.start),end=shiftTimeInput('end',shift.end),times=node('div',undefined,'roster-inline-times'),message=node('p','','roster-inline-error'),undo=button('Undo',()=>{
    if(editor.isNew){editor.pending=false;newRosterShifts.delete(shift.id);rosterEditors.delete(shift.id);card.closest('.roster-day-editor')?.remove();card.remove();updateRosterSaveStatus();return;}
    if(editor.blocked){const latest=data.roster.shifts.find(item=>item.id===shift.id);if(latest)Object.assign(shift,latest);editor.blocked=false;rosterNeedsLayout=true;}
    staff.value=shift.userId||'';start.value=M.formatTimeInput(shift.start);end.value=M.formatTimeInput(shift.end);position.reset();window.locationPickers?.refresh(staff);editor.pending=editor.dirty=false;editor.saved=editor.read();card.classList.remove('is-dirty');setRosterEditorError(editor,'');settleRosterLayout();
   },'roster-inline-undo');
   if(shift.userId&&!data.people.some(person=>person.id===shift.userId)){const option=user(node('option',shift.username));option.value=shift.userId;staff.append(option);staff.value=shift.userId;}
   staff.setAttribute('aria-label','Staff for shift '+shift.start+' on '+shift.date);start.setAttribute('aria-label','Shift start time');end.setAttribute('aria-label','Shift end time');start.required=end.required=true;
   times.append(start,end);if(shift.overnight){const next=node('span','+1','roster-next-day');next.title='Ends next day';times.append(next);}staffField.append(staff);form.append(position.wrap,times,staffField);message.hidden=undo.hidden=true;message.setAttribute('role','status');card.append(form,message,undo);
   const tools=node('div',undefined,'roster-shift-tools'),grip=button('⠿',()=>{selectRosterShift(shift.id);card.focus({preventScroll:true});},'roster-shift-grip');grip.setAttribute('aria-label','Drag shift for '+shift.username);grip.title='Drag to move this shift';tools.append(grip);card.append(tools);
   card.tabIndex=0;card.setAttribute('role','group');card.setAttribute('aria-label',shift.username+' · '+description);card.setAttribute('aria-keyshortcuts','Backspace Delete');card.addEventListener('focus',()=>selectRosterShift(shift.id));
   const editor={shift,card,form,message,undo,isNew,dirty:isNew,pending:false,error:'',read(){const assigned=staff.value||null;return{userId:assigned,start:readShiftTime(start),end:readShiftTime(end),position:position.position.value,allowUnavailable:assigned===shift.userId?shift.allowUnavailable:false};}};
   editor.saved=editor.read();rosterEditors.set(shift.id,editor);
   form.addEventListener('input',()=>queueRosterEditor(editor));form.addEventListener('change',()=>queueRosterEditor(editor,100));form.onsubmit=event=>{event.preventDefault();queueRosterEditor(editor,0);};
   card.addEventListener('focusout',()=>setTimeout(settleRosterLayout,0));
   card.addEventListener('pointerdown',event=>startRosterPress(event,shift,card));card.addEventListener('contextmenu',event=>{if(rosterPress||rosterDrag)event.preventDefault();});
   if(isNew)queueRosterEditor(editor);
  }else{
   const position=user(node('span',shift.position?shift.position.split(/\s+/).map(word=>word[0]).join('').slice(0,2).toUpperCase():'–','roster-position-static')),content=node('div',undefined,'roster-shift-content');position.title=shift.position||'No position';position.setAttribute('aria-label',shift.position||'No position');content.append(user(node('p',shift.start+' – '+shift.end+(shift.overnight?' +1':''),'roster-shift-time')),user(node('strong',shift.username)));card.append(position,content);card.classList.add('roster-readonly-shift');
  }
  const state=node('span',undefined,'roster-shift-state '+(shift.availability==='unavailable'?'conflict':shift.availability==='available'?'available':shift.userId===null?'vacant':'unknown'));state.title=availability;state.setAttribute('aria-label',availability);state.setAttribute('role','img');card.append(state);
  return card;
 }
 function startRosterPress(event,shift,card){
  if(!event.isPrimary||event.button!==0||rosterSaving&&!rosterSaveTask||rosterDeleting||rosterEditing()||event.target.closest('input,select,.location-picker,button:not(.roster-shift-grip):not(.roster-day-shift)'))return;
  const editor=rosterEditors.get(shift.id),candidate=editor?{...shift,...editor.read()}:shift;try{M.interval(candidate);}catch(error){status(error.message);return;}
  cancelRosterDrag();selectRosterShift(shift.id);
  const press={shift,card,duration:M.minutes(candidate.end)-M.minutes(candidate.start)+(candidate.overnight?1440:0),displayStart:candidate.start,displayEnd:candidate.end,x:event.clientX,y:event.clientY,pointerId:event.pointerId,pointerType:event.pointerType,grip:Boolean(event.target.closest('.roster-shift-grip'))||card.classList.contains('roster-day-shift'),timeline:card.classList.contains('roster-day-shift')};rosterPress=press;
  card.classList.add('is-pressing');if(rosterDirty())saveRosterEditors();press.timer=setTimeout(()=>beginRosterDrag(press),event.pointerType==='mouse'?250:press.grip?220:320);
 }
 function beginRosterDrag(press){
  if(rosterPress!==press)return;clearTimeout(press.timer);
  const rect=press.card.getBoundingClientRect(),ghost=node('div',undefined,'roster-drag-ghost');ghost.dataset.layoutUi='';ghost.setAttribute('aria-hidden','true');ghost.append(user(node('strong',press.shift.username)),user(node('span',press.displayStart+' – '+press.displayEnd)));ghost.style.width=Math.min(rect.width,260)+'px';document.body.append(ghost);
  const lane=press.timeline?press.card.closest('.roster-day-lane'):null;
  rosterDrag={...press,ghost,initialX:press.x,initialY:press.y,moved:false,offsetX:Math.min(press.x-rect.left,260),offsetY:Math.min(press.y-rect.top,40),timelineOffset:lane?(press.x-rect.left)/lane.getBoundingClientRect().width*1440:0,target:null};rosterPress=null;press.card.classList.remove('is-pressing');press.card.classList.add('is-dragging');document.body.classList.add('roster-drag-active');
  try{press.card.setPointerCapture(press.pointerId);}catch{}status('Drop on a day or staff row to move this shift.');moveRosterDrag(press.x,press.y);rosterFrame=requestAnimationFrame(scrollRosterDrag);
 }
 function clearRosterPress(){if(rosterPress){clearTimeout(rosterPress.timer);rosterPress.card.classList.remove('is-pressing');rosterPress=null;}}
 function moveRosterDrag(x,y){
  const drag=rosterDrag;if(!drag)return;drag.moved=drag.moved||Math.hypot(x-drag.initialX,y-drag.initialY)>4;drag.x=x;drag.y=y;drag.ghost.style.transform='translate3d('+(x-drag.offsetX)+'px,'+(y-drag.offsetY)+'px,0)';
  const hit=document.elementFromPoint(x,y),staff=hit?.closest('[data-roster-staff]');let cell=hit?.closest('[data-roster-drop]');
  if(!cell&&staff)cell=[...$('roster-days').querySelectorAll('[data-roster-drop]')].find(cell=>cell.dataset.rosterUser===staff.dataset.rosterStaff&&cell.dataset.rosterDate===drag.shift.date);
  if(drag.target!==cell){drag.target?.classList.remove('is-drop-target');drag.preview?.remove();drag.preview=null;drag.target=cell||null;drag.target?.classList.add('is-drop-target');}
  drag.times=null;
  if(drag.timeline&&!staff&&cell?.classList.contains('roster-day-lane')&&drag.moved){
   const rect=cell.getBoundingClientRect(),duration=drag.duration,start=Math.max(0,Math.min(1425,Math.floor((2879-duration)/15)*15,Math.round(((x-rect.left)/rect.width*1440-drag.timelineOffset)/15)*15)),finish=start+duration,clock=minutes=>String(Math.floor(minutes%1440/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
   drag.times={start:clock(start),end:clock(finish),overnight:finish>=1440};
   if(!drag.preview){drag.preview=node('div',undefined,'roster-drop-preview');cell.append(drag.preview);}drag.preview.style.left=start/1440*100+'%';drag.preview.style.width=Math.min(duration,1440-start)/1440*100+'%';drag.preview.textContent=M.formatTimeInput(drag.times.start)+' – '+M.formatTimeInput(drag.times.end);
  }
 }
 function scrollRosterDrag(){
  const drag=rosterDrag;if(!drag)return;if(!drag.moved){rosterFrame=requestAnimationFrame(scrollRosterDrag);return;}const host=$('roster-days'),rect=host.getBoundingClientRect(),edge=44;
  if(drag.y>=rect.top&&drag.y<=rect.bottom){if(drag.x<rect.left+edge)host.scrollLeft-=10;else if(drag.x>rect.right-edge)host.scrollLeft+=10;}
  if(drag.y<rect.top+edge&&host.scrollTop>0)host.scrollTop-=10;else if(drag.y>rect.bottom-edge&&host.scrollTop<host.scrollHeight-host.clientHeight)host.scrollTop+=10;else if(drag.y<90)window.scrollBy(0,-10);else if(drag.y>innerHeight-70)window.scrollBy(0,10);
  moveRosterDrag(drag.x,drag.y);rosterFrame=requestAnimationFrame(scrollRosterDrag);
 }
 function cancelRosterDrag(){clearRosterPress();cancelAnimationFrame(rosterFrame);if(rosterDrag){const drag=rosterDrag;rosterDrag=null;drag.ghost.remove();drag.preview?.remove();drag.card.classList.remove('is-dragging');drag.target?.classList.remove('is-drop-target');try{drag.card.releasePointerCapture(drag.pointerId);}catch{}}document.body.classList.remove('roster-drag-active');}
 async function dropRosterDrag(cancelled=false){
  if(!rosterDrag){clearRosterPress();return;}
  const drag=rosterDrag,target=drag.target,shift=drag.shift,times=drag.times;cancelRosterDrag();if(drag.moved)rosterDraggedAt=performance.now();
  if(cancelled||!target){status('Shift move cancelled.');settleRosterLayout();return;}
  if(!await flushRosterEdits())return;
  const date=target.dataset.rosterDate,userId='rosterUser'in target.dataset?(target.dataset.rosterUser||null):shift.userId;
  if(date===shift.date&&userId===shift.userId&&(!times||times.start===shift.start&&times.end===shift.end&&times.overnight===shift.overnight)){status('');return;}
  await saveBoardShift(shift,{date,userId,...(times||{}),allowUnavailable:false});
 }
 document.addEventListener('pointermove',event=>{if(rosterDrag&&event.pointerId===rosterDrag.pointerId){event.preventDefault();moveRosterDrag(event.clientX,event.clientY);}else if(rosterPress&&event.pointerId===rosterPress.pointerId&&Math.hypot(event.clientX-rosterPress.x,event.clientY-rosterPress.y)>4){if(rosterPress.pointerType==='mouse'||rosterPress.grip){const press=rosterPress;beginRosterDrag(press);event.preventDefault();moveRosterDrag(event.clientX,event.clientY);}else clearRosterPress();}},{passive:false});
 document.addEventListener('pointerdown',event=>{
  if(!can('rostering.manage')||rosterEditing())return;
  const card=event.target.closest('[data-shift-id],button[data-timeline-shift]');
  if(card&&$('roster-days').contains(card)){selectRosterShift(card.dataset.shiftId||card.dataset.timelineShift);if(!event.target.closest('input,textarea,select,button,.location-picker,[contenteditable]'))card.focus({preventScroll:true});}
  else if(!event.target.closest('.location-picker-menu,.roster-deletion-feedback'))selectRosterShift(null);
 });
 document.addEventListener('keydown',event=>{
  if(!['Backspace','Delete'].includes(event.key)||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||section!=='roster'||appRequiredReading.blocked||!selectedRosterShift||!can('rostering.manage')||rosterEditing()||rosterDrag||rosterPress)return;
  if(event.target.closest('input,textarea,select,[contenteditable],[role="textbox"],[role="combobox"],dialog,[role="dialog"],.location-picker-menu,button:not(.roster-shift-grip):not(.roster-day-shift)'))return;
  const card=event.target.closest('[data-shift-id],[data-timeline-shift]');if(!card&&event.target!==document.body)return;
  const shift=data.roster.shifts.find(shift=>shift.id===selectedRosterShift),element=$('roster-days').querySelector('[data-timeline-shift="'+selectedRosterShift+'"]');
  const editor=rosterEditors.get(selectedRosterShift)||(shift&&element?{shift,card:element,isNew:false}:null);if(!editor)return;
  event.preventDefault();removeBoardShift(editor);
 });
 document.addEventListener('touchmove',event=>{if(rosterDrag)event.preventDefault();},{passive:false});
 document.addEventListener('pointerup',event=>{if(rosterDrag&&event.pointerId===rosterDrag.pointerId){event.preventDefault();dropRosterDrag();}else clearRosterPress();});
 document.addEventListener('pointercancel',()=>dropRosterDrag(true));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&(rosterDrag||rosterPress)){event.preventDefault();dropRosterDrag(true);}});
 document.addEventListener('click',async event=>{const link=event.target.closest('a[href]');if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||link.target==='_blank'||link.hasAttribute('download')||!rosterDirty()&&!rosterSaving)return;const target=new URL(link.href,location.href);if(target.origin!==location.origin||target.pathname===location.pathname)return;event.preventDefault();event.stopPropagation();if(await flushRosterEdits())location.assign(target.href);},true);
 window.addEventListener('beforeunload',event=>{if(rosterDirty()||rosterSaving){event.preventDefault();event.returnValue='';}});window.addEventListener('app-edit-mode-changed',cancelRosterDrag);window.addEventListener('blur',()=>dropRosterDrag(true));
 async function changeRosterView(next){if(!data||!await flushRosterEdits())return;rosterView=next;try{localStorage.setItem('opstack-roster-view:'+session.id+':'+session.companyId,next);}catch{}renderRoster();}
 function makeDialog(title){const dialog=node('dialog',undefined,'roster-dialog');dialog.dataset.copyEditor=dialog.dataset.layoutUi='';const header=node('div',undefined,'roster-dialog-heading'),heading=node('h2',title),close=button('×',()=>{if(!dialog.dataset.busy)dialog.close();},'roster-dialog-close');heading.id='roster-dialog-title';dialog.setAttribute('aria-labelledby',heading.id);close.setAttribute('aria-label','Close dialog');header.append(heading,close);const form=node('form'),error=node('p','','roster-error'),actions=node('div',undefined,'roster-dialog-actions'),cancel=button('Cancel',()=>dialog.close()),save=node('button','Save','rostering-primary');save.type='submit';actions.append(cancel,save);error.setAttribute('role','status');dialog.append(header,form);document.body.append(dialog);dialog.addEventListener('cancel',event=>{if(dialog.dataset.busy)event.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());return{dialog,form,error,actions,save,cancel,finish(){form.append(error,actions);dialog.showModal();},busy(value){dialog.dataset.busy=value?'true':'';for(const control of dialog.querySelectorAll('input,select,textarea,button'))control.disabled=value;}};}
 async function rosterAction(action){if(!await flushRosterEdits())return;if(action==='publish'){const board=$('roster-days');rosterSaving=true;board.inert=true;$('roster-publish').disabled=true;updateRosterSaveStatus();try{await api('publish','POST',{weekStart:week,revision:data.roster.revision});await refreshRosterSaved(false);status('Roster published.',true);}catch(error){status(error.message);$('roster-publish').disabled=false;}finally{rosterSaving=false;board.inert=false;updateRosterSaveStatus();}return;}const ui=makeDialog(action==='publish'?'Publish roster':'Copy previous week'),description=node('p',action==='publish'?'Users at this location will see their shifts from this roster.':'Copy the previous week into this empty draft.'),allow=input('checkbox','allowUnavailable');ui.form.append(description);if(action==='copy-previous')ui.form.append(field('Allow shifts outside submitted availability',allow));ui.save.textContent=action==='publish'?'Publish roster':'Copy shifts';ui.form.onsubmit=async event=>{event.preventDefault();ui.busy(true);try{await api(action,'POST',{weekStart:week,revision:data.roster.revision,allowUnavailable:allow.checked});ui.dialog.close();await load();status(action==='publish'?'Roster published.':'Previous week copied to draft.',true);}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.finish();}
 function renderClock(){const host=$('clock-panel'),key=JSON.stringify([clockDisplayKey(data.clock),can('rostering.clock'),session.locationId,session.locationName]);if(key===clockRenderKey&&host.children.length){for(const control of host.querySelectorAll('.clock-actions button'))control.disabled=clockBusy;updateClockElapsed();return;}const entry=data.clock,draftNotes=$('clock-notes')?.value||'';host.replaceChildren();host.append(badge(entry?(entry.onBreak?'On break':'Clocked in'):'Clocked out',entry?'positive':'muted'),node('h3',entry?'Your shift is running':'Ready to start?'));if(entry){host.append(user(node('p','Clocked in '+date(M.localParts(entry.startAt).date)+' at '+time(entry.startAt)+' · '+entry.locationName,'small')),node('strong','00:00:00','clock-elapsed'));host.querySelector('.clock-elapsed').id='clock-elapsed';if(entry.locationId!==session.locationId)host.append(user(node('p','This shift belongs to '+entry.locationName+'. Clocking out keeps its time there.','roster-help')));}else host.append(user(node('p','Your next clock-in will be recorded at '+session.locationName+'.','roster-help')));const actions=node('div',undefined,'clock-actions');if(can('rostering.clock')){if(!entry)actions.append(button('Clock in',()=>clockAction('in'),'rostering-primary clock-main-action'));else{actions.append(button(entry.onBreak?'End break':'Start unpaid break',()=>clockAction(entry.onBreak?'break-end':'break-start')),button('Clock out',()=>clockAction('out'),'rostering-primary clock-main-action'));const notes=node('textarea');notes.id='clock-notes';notes.rows=2;notes.maxLength=500;notes.placeholder='Optional note for this shift';notes.value=draftNotes;host.append(field('Shift note',notes));}}host.append(actions,node('p','Clock times are recorded by the server. Timesheets require manager approval.','roster-help'));for(const control of actions.querySelectorAll('button'))control.disabled=clockBusy;clockRenderKey=key;updateClockElapsed();}
 function updateClockElapsed(){const target=$('clock-elapsed');if(!target||!data?.clock)return;const entry=data.clock,at=Date.now()+clockOffset,end=entry.endAt?Date.parse(entry.endAt):at,breakMs=entry.breaks.reduce((sum,item)=>sum+Math.max(0,(item.endAt?Date.parse(item.endAt):at)-Date.parse(item.startAt)),0),seconds=Math.max(0,Math.floor((end-Date.parse(entry.startAt)-breakMs)/1000));target.textContent=[Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(value=>String(value).padStart(2,'0')).join(':');}
 async function clockAction(action){if(clockBusy)return;const notes=$('clock-notes')?.value||'';if(clockRequest?.action!==action||clockRequest.entryId!==(data.clock?.id||undefined))clockRequest={action,entryId:data.clock?.id,requestId:uid(),notes};clockBusy=true;for(const control of $('clock-panel').querySelectorAll('button'))control.disabled=true;try{await api('clock','POST',clockRequest);clockRequest=null;await load();status(action==='out'?'Clocked out. Your timesheet is ready for review.':action==='in'?'Clocked in.':action==='break-start'?'Unpaid break started.':'Break ended.',true);}catch(error){status(error.message);await load(true);}finally{clockBusy=false;renderClock();}}
 function renderTimesheets(){const all=data.timesheets,selected=$('timesheet-filter').value,rows=all.filter(item=>selected==='all'||item.status===selected),metrics=$('timesheet-metrics');metrics.replaceChildren(metric('Worked hours',hours(all.filter(item=>item.status!=='rejected').reduce((sum,item)=>sum+item.paidSeconds,0))),metric('Approved hours',hours(all.filter(item=>item.status==='approved').reduce((sum,item)=>sum+item.paidSeconds,0))),metric('Pending approval',String(all.filter(item=>item.status==='pending').length)),metric('Clocked in',String(all.filter(item=>item.status==='open').length)));if(data.summary){const summary=data.summary,remaining=summary.budgetCents!==null&&summary.actualCostCents!==null?summary.budgetCents-summary.actualCostCents:null;metrics.replaceChildren(metric('Worked labour',money(summary.actualCostCents),'Includes pending time and active shifts'),metric('Approved labour',money(summary.approvedCostCents),'Approved timesheets only'),metric('Pending approval',String(all.filter(item=>item.status==='pending').length)),metric('Labour budget remaining',money(remaining),'After worked labour',remaining!==null&&remaining<0?'negative':'positive'));}const list=$('timesheet-list');list.replaceChildren();for(const item of rows){const card=node('article',undefined,'timesheet-card');card.dataset.entryId=item.id;card.dataset.layoutKey='time:'+item.id;const info=node('div',undefined,'timesheet-info'),heading=node('div',undefined,'timesheet-heading');heading.append(user(node('strong',item.username)),badge(item.status==='open'?'Clocked in':item.status[0].toUpperCase()+item.status.slice(1),item.status==='approved'?'positive':item.status==='rejected'?'negative':item.status==='pending'?'warning':'muted'));info.append(heading,user(node('p',date(M.localParts(item.startAt).date)+' · '+time(item.startAt)+' – '+(item.endAt?time(item.endAt):'Running')+(item.endAt&&M.localParts(item.endAt).date!==M.localParts(item.startAt).date?' · '+date(M.localParts(item.endAt).date):''),'small')),user(node('small',hours(item.paidSeconds)+' paid · '+Math.round(item.breakSeconds/60)+'m unpaid break'+('costCents'in item?' · '+money(item.costCents):''))));if(item.notes)info.append(user(node('p',item.notes,'timesheet-note')));if(item.longShift)info.append(badge('Long shift — review times','warning'));const actions=node('div',undefined,'timesheet-actions');if(item.canReview){if(item.status==='pending')actions.append(button('Approve',()=>reviewEntry(item,'approve'),'rostering-primary'),button('Reject',()=>reviewDialog(item,'reject')));if(item.status!=='open'&&item.status!=='pending')actions.append(button('Reopen',()=>reviewEntry(item,'reopen')));actions.append(button('Correct',()=>timeDialog(item)));}actions.append(button('History',()=>historyDialog(item)));card.append(info,actions);list.append(card);}if(!rows.length)list.append(node('p','No timesheets match this week and filter.','roster-empty'));}
 async function reviewEntry(item,action){try{await api('timesheets/'+item.id,'PUT',{revision:item.revision,action});await load();status(action==='approve'?'Timesheet approved.':'Timesheet reopened for review.',true);}catch(error){status(error.message);}}
 function reviewDialog(item,action){const ui=makeDialog('Reject timesheet'),reason=node('textarea');reason.name='reason';reason.required=true;reason.maxLength=500;reason.rows=3;ui.form.append(field('Reason',reason));ui.save.textContent='Reject timesheet';ui.form.onsubmit=async event=>{event.preventDefault();const payload={action,revision:item.revision,reason:reason.value};ui.busy(true);try{await api('timesheets/'+item.id,'PUT',payload);ui.dialog.close();await load();}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.finish();}
 function localInput(value){const local=M.localParts(value);return local.date+'T'+local.time;}
 function timeDialog(previous){const ui=makeDialog(previous?'Correct timesheet':'Add timesheet'),member=select('userId',data.people.map(person=>[person.id,person.username]),previous?.userId||session.id),start=input('datetime-local','startAt',previous?localInput(previous.startAt):M.today()+'T09:00'),end=input('datetime-local','endAt',previous?.endAt?localInput(previous.endAt):M.today()+'T17:00'),breaks=input('number','breakMinutes',previous?Math.round(previous.breakSeconds/60):0),reason=node('textarea'),fields=node('div',undefined,'roster-dialog-grid');for(const value of [start,end,breaks])value.required=true;breaks.min='0';breaks.step='1';reason.name='reason';reason.required=true;reason.maxLength=500;reason.rows=2;member.disabled=Boolean(previous)||!can('rostering.approve');if(!previous)fields.append(field('User',member));fields.append(field('Clock in (Melbourne time)',start),field('Clock out (Melbourne time)',end),field('Unpaid break (minutes)',breaks));ui.form.append(fields,field(previous?'Reason for correction':'Reason for manual timesheet',reason));ui.save.textContent=previous?'Save correction':'Submit for approval';const reference=uid();ui.form.onsubmit=async event=>{event.preventDefault();let payload;try{payload={userId:member.value,startAt:M.instant(start.value.slice(0,10),start.value.slice(11,16)),endAt:M.instant(end.value.slice(0,10),end.value.slice(11,16)),breakMinutes:Number(breaks.value),reason:reason.value,requestId:reference,...(previous?{action:'correct',revision:previous.revision}:{})};}catch(error){ui.error.textContent=error.message;return;}ui.busy(true);try{await api(previous?'timesheets/'+previous.id:'manual-time',previous?'PUT':'POST',payload);ui.dialog.close();await load();status(previous?'Correction saved. The timesheet needs approval.':'Timesheet submitted for approval.',true);}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.finish();}
 function historyDialog(item){const ui=makeDialog('Timesheet history');ui.save.remove();ui.cancel.textContent='Close';const list=node('div',undefined,'timesheet-history');for(const event of item.audit){const row=node('article');row.append(user(node('strong',event.action.replaceAll('-',' ')+' · '+event.by)),user(node('small',date(M.localParts(event.at).date)+' '+time(event.at))));if(event.reason)row.append(user(node('p',event.reason)));if(event.before&&event.after)row.append(user(node('p','Before: '+time(event.before.startAt)+' – '+(event.before.endAt?time(event.before.endAt):'Running')+' · '+event.before.status+'\nAfter: '+time(event.after.startAt)+' – '+(event.after.endAt?time(event.after.endAt):'Running')+' · '+event.after.status,'small')));list.append(row);}ui.form.append(list);ui.finish();}
 function renderAvailability(){const kind=$('availability-kind').value,record=data.availability[kind==='week'?'week':'recurring'],source=kind==='week'&&!record.revision||record.removed?data.availability.recurring:record,days=$('availability-days');days.replaceChildren();for(let index=0;index<7;index++){const value=source.days[index],card=node('div',undefined,'availability-day'),day=select('status',[['','Not entered'],['available','Available all day'],['unavailable','Unavailable'],['window','Available between']],value?.status||''),start=input('time','start',value?.start||'09:00'),end=input('time','end',value?.end||'17:00'),overnight=input('checkbox','overnight'),window=node('div',undefined,'availability-window');card.dataset.dayIndex=index;overnight.checked=value?.overnight||false;card.append(node('strong',dayNames[index]),user(node('small',date(M.shiftDate(week,index)))));day.setAttribute('aria-label',dayNames[index]+' availability');card.append(day);window.append(field('From',start),field('To',end),field('Ends next day',overnight));const update=()=>window.hidden=day.value!=='window';day.onchange=update;update();card.append(window);days.append(card);} $('availability-notes').value=source.notes||'';$('availability-reset').hidden=kind!=='week'||!data.availability.week.revision||data.availability.week.removed;$('availability-saved').textContent=kind==='week'&&!record.revision||record.removed?'Using recurring availability until you save a weekly override.':record.updatedAt?'Saved '+date(M.localParts(record.updatedAt).date):'No availability entered yet.';const editable=can('rostering.availability');for(const control of $('availability-form').querySelectorAll('input,textarea,button'))control.disabled=!editable;for(const select of days.querySelectorAll('select'))select.disabled=!editable;
  const team=$('team-availability');team.replaceChildren();if(can('rostering.manage'))for(const person of data.teamAvailability){const row=node('article',undefined,'team-availability-person');row.append(user(node('strong',person.username)));const entries=node('div');for(let index=0;index<7;index++){const day=person.days[index],value=day?day.status==='available'?'All day':day.status==='unavailable'?'Unavailable':day.start+'–'+day.end+(day.overnight?' +1':''):'Not entered',cell=node('div');cell.append(node('small',dayNames[index].slice(0,3)),user(node('span',value)));entries.append(cell);}row.append(entries);if(person.notes)row.append(user(node('p',person.notes,'small')));team.append(row);}}
 async function saveAvailability(event){event.preventDefault();const kind=$('availability-kind').value,record=data.availability[kind==='week'?'week':'recurring'],days=[...$('availability-days').children].map(card=>{const selected=card.querySelector('[name=status]').value;if(!selected)return null;return selected==='window'?{status:selected,start:card.querySelector('[name=start]').value,end:card.querySelector('[name=end]').value,overnight:card.querySelector('[name=overnight]').checked}:{status:selected};}),payload={kind,weekStart:week,revision:record.revision,days,notes:$('availability-notes').value};$('availability-save').disabled=true;try{await api('availability','PUT',payload);await load();status('Availability saved.',true);}catch(error){status(error.message);$('availability-save').disabled=false;}}
 let ratesWeek='';
 function renderSettings(){const summary=data.summary;if(!summary)return;const inheritance=$('budget-inheritance');inheritance.replaceChildren();for(const item of summary.budgets){const card=node('article',undefined,'budget-scope-card'+(summary.effectiveBudget?.scope===item.scope?' active':''));card.append(node('strong',item.scope[0].toUpperCase()+item.scope.slice(1)),user(node('span',item.mode?(item.mode==='percent'?(item.value/100).toFixed(2)+'% of forecast':money(item.value)+' / week'):'No override')));inheritance.append(card);}const editable=summary.budgets.filter(item=>item.canEdit),scope=$('budget-scope'),previous=scope.value;scope.replaceChildren();for(const item of editable){const option=node('option',item.scope[0].toUpperCase()+item.scope.slice(1));option.value=item.scope;scope.append(option);}scope.value=editable.some(item=>item.scope===previous)?previous:editable.some(item=>item.scope==='location')?'location':editable[0]?.scope||'';$('budget-form').hidden=!editable.length;renderBudgetForm();if(data.rates){if(ratesWeek!==week||!$('rates-date').value){$('rates-date').value=week;ratesWeek=week;}renderRates();}}
 function renderBudgetForm(){const item=data.summary?.budgets.find(item=>item.scope===$('budget-scope').value);if(!item)return;$('budget-mode').value=item.mode||'percent';$('budget-value').value=item.mode?(item.value/100).toFixed(2):'';$('budget-inherit').hidden=!item.mode;$('budget-inherit').textContent=item.scope==='network'?'Clear network default':'Use inherited budget';updateBudgetMode();window.locationPickers?.refresh($('budget-scope'));window.locationPickers?.refresh($('budget-mode'));}
 function updateBudgetMode(){const percent=$('budget-mode').value==='percent';$('budget-prefix').textContent=percent?'%':'$';$('budget-value').max=percent?'100':'100000000';}
 function renderRates(){const date=$('rates-date').value,host=$('rate-people');host.replaceChildren();for(const person of data.rates?.people||[]){const current=data.rates.records.filter(item=>item.userId===person.id&&item.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0],row=node('label',undefined,'rate-person'),wrap=node('div',undefined,'roster-money-field'),amount=input('number','rate',current?(current.rateCents/100).toFixed(2):'');amount.dataset.userId=person.id;amount.min='0';amount.max='100000';amount.step='0.01';amount.placeholder='Set rate';amount.setAttribute('aria-label',person.username+' hourly rate');row.append(user(node('span',person.username)));wrap.append(node('span','$'),amount);row.append(wrap);host.append(row);}}
 function cents(value){if(!/^\d+(?:\.\d{1,2})?$/.test(value))throw Error('Enter a non-negative amount with up to two decimal places.');const amount=Math.round(Number(value)*100);if(!Number.isSafeInteger(amount))throw Error('Enter a valid amount.');return amount;}
 async function saveBudget(event){event.preventDefault();const item=data.summary.budgets.find(item=>item.scope===$('budget-scope').value);try{const payload={scope:item.scope,revision:item.revision,mode:$('budget-mode').value,value:cents($('budget-value').value)};await formAction($('budget-form'),()=>api('budget','PUT',payload),'Labour budget saved.');}catch(error){status(error.message);}}
 async function formAction(form,action,message){const controls=[...form.querySelectorAll('input,select,textarea,button')];for(const control of controls)control.disabled=true;try{await action();await load();status(message,true);}catch(error){status(error.message);}finally{for(const control of controls)if(control.isConnected)control.disabled=false;}}
 function exportTimesheets(){const headers=['User','Location','Clock in','Clock out','Unpaid break (minutes)','Paid hours','Status',...(data.timesheets.some(item=>'costCents'in item)?['Estimated cost']:[])],rows=data.timesheets.map(item=>[item.username,item.locationName,localInput(item.startAt),item.endAt?localInput(item.endAt):'',(item.breakSeconds/60).toFixed(2),(item.paidSeconds/3600).toFixed(2),item.status,...(headers.includes('Estimated cost')?[item.costCents===null||item.costCents===undefined?'':(item.costCents/100).toFixed(2)]:[])]),escape=value=>'"'+String(/^[=+\-@\t\r]/.test(String(value))?"'"+value:value).replaceAll('"','""')+'"',content=[headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'})),link=node('a');link.href=url;link.download='timesheets-'+week+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function selectWeek(value){if(!await flushRosterEdits()){$('roster-week').value=week;return;}try{week=M.monday(value);$('roster-week').value=week;load();}catch(error){status(error.message);}}
 $('roster-previous').onclick=()=>selectWeek(M.shiftDate(week,-7));$('roster-next').onclick=()=>selectWeek(M.shiftDate(week,7));$('roster-this-week').onclick=()=>selectWeek(M.today());$('roster-week').onchange=event=>selectWeek(event.target.value);$('roster-refresh').onclick=async()=>{if(await flushRosterEdits())load();};$('roster-view-staff').onclick=()=>changeRosterView('staff');$('roster-view-stacked').onclick=()=>changeRosterView('stacked');$('roster-view-day').onclick=()=>changeRosterView('day');$('roster-day').onchange=event=>selectRosterDay(event.target.value);$('roster-copy').onclick=()=>rosterAction('copy-previous');$('roster-publish').onclick=()=>rosterAction('publish');$('timesheet-filter').onchange=renderTimesheets;$('timesheet-manual').onclick=()=>timeDialog();$('timesheet-export').onclick=exportTimesheets;
 $('availability-kind').onchange=renderAvailability;$('availability-form').onsubmit=saveAvailability;$('availability-fill').onclick=()=>{for(const card of $('availability-days').children){const select=card.querySelector('[name=status]');select.value='available';select.dispatchEvent(new Event('change',{bubbles:true}));}};$('availability-reset').onclick=()=>{const record=data.availability.week;formAction($('availability-form'),()=>api('availability','DELETE',{kind:'week',weekStart:week,revision:record.revision}),'Weekly override removed. Recurring availability applies.');};
 $('budget-scope').onchange=renderBudgetForm;$('budget-mode').onchange=updateBudgetMode;$('budget-form').onsubmit=saveBudget;$('budget-inherit').onclick=()=>{const item=data.summary.budgets.find(item=>item.scope===$('budget-scope').value);formAction($('budget-form'),()=>api('budget','DELETE',{scope:item.scope,revision:item.revision}),'Budget override removed.');};$('rates-date').onchange=renderRates;$('rates-form').onsubmit=event=>{event.preventDefault();try{const payload={effectiveDate:$('rates-date').value,revision:data.rates.revision,rates:[...$('rate-people').querySelectorAll('input')].map(input=>({userId:input.dataset.userId,rateCents:input.value===''?null:cents(input.value)}))};formAction($('rates-form'),()=>api('rates','PUT',payload),'Hourly rates saved.');}catch(error){status(error.message);}};
 window.addEventListener('hashchange',view);window.addEventListener('required-reading-changed',event=>{if(!event.detail.blocked&&session)load();});setInterval(updateClockElapsed,1000);setInterval(()=>{if(session&&!document.hidden&&!appRequiredReading.blocked)load(true);},15000);window.addEventListener('focus',()=>{if(session&&!rosterSaving&&!rosterInteractionActive()&&['roster','timesheets','clock'].includes(section))load(false,true);});$('logout').onclick=async()=>{if(!await flushRosterEdits())return;const response=await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':session?.csrf||''}});if(response.ok)location.href=companyLoginUrl();};
 (async()=>{try{const response=await fetch('/api/session');session=await response.json();if(!session.csrf){location.href=companyLoginUrl();return;}appAccess.apply(session);$('rostering-location').textContent=session.locationName+' · '+session.companyName;try{const saved=localStorage.getItem('opstack-roster-view:'+session.id+':'+session.companyId);if(['staff','stacked','day'].includes(saved))rosterView=saved;}catch{}renderSidebar();await appRequiredReading.ready;view();}catch(error){status(error.message);}})();
})();
