(()=>{
 const $=id=>document.getElementById(id),M=rosteringModel,dayNames=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;},user=element=>{element.dataset.userText='';return element;},can=key=>appAccess.can(key),money=value=>value===null||value===undefined?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100),hours=value=>(value/3600).toFixed(2)+' h',date=value=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:M.timeZone}).format(new Date(value+'T12:00:00Z')),time=value=>new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:M.timeZone}).format(new Date(value)),uid=()=>crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
 let session,data,week=M.monday(M.today()),section='',loading=0;
 let requiredReadingWasBlocked=false;
 const phoneViewport=window.appSetupEditor?.task==='roster'?{matches:false,addEventListener(){}}:matchMedia('(max-width:720px), (max-width:1100px) and (max-height:500px) and (pointer:coarse)');
 let phoneRosterScope='mine',phoneRosterDay=M.today(),phoneRosterKey='',phoneRosterDismissed=false,phoneRosterClosing=false;
 const status=(message,good=false)=>{const target=$('rostering-status');target.textContent=message;target.classList.toggle('success',good);};
 async function api(route,method='GET',body){const response=await fetch('/api/rostering/'+route,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||'',...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})},body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();if(!response.ok){if(response.status===401)location.href=companyLoginUrl();if(response.status===428)window.appRequiredReading?.check();throw Error(result.error||'Unable to load rostering.');}return result;}
 const field=(caption,input)=>{const label=node('label',caption);label.append(input);return label;};
 function input(type,name,value=''){const result=node('input');result.type=type;result.name=name;result.value=value;return result;}
 function select(name,items,value){const result=node('select');result.name=name;for(const [id,text]of items){const option=node('option',text);option.value=id;result.append(option);}if(value!==undefined)result.value=value;if(name==='userId')for(const option of result.options)option.dataset.userText='';return result;}
 function button(text,action,cls){const result=node('button',text,cls);result.type='button';result.onclick=action;return result;}
 function badge(text,cls=''){return node('span',text,'roster-badge '+cls);}
 function metric(title,value,detail,cls=''){const card=node('article',undefined,'roster-metric '+cls);card.append(node('span',title),user(node('strong',value)));if(detail)card.append(user(node('small',detail)));card.title=[title,value,detail].filter(Boolean).join(' · ');return card;}
 // Mount shared controls once; moving the original nodes preserves handlers, values and edit identities.
 function moveControls(element,target){
  if(!element)return;for(const control of element.matches('input,select,textarea,button')?[element]:element.querySelectorAll('input,select,textarea,button'))if(control.form?.id)control.setAttribute('form',control.form.id);
  target.append(element);
 }
 function compactDate(id,caption){
  const input=$(id),form=input.form?.id,original=input.closest('label'),group=original?node('div',undefined,'roster-date-group'):input.parentElement;
  if(form)input.setAttribute('form',form);
  if(original){for(const attribute of original.attributes)if(attribute.name!=='for')group.setAttribute(attribute.name,attribute.value);group.classList.add('roster-date-group');const label=node('label',caption);label.htmlFor=id;original.replaceWith(group);group.append(label);}
  const control=node('div',undefined,'date-control'),toggle=button('',()=>{},'date-toggle'),field=node('div',undefined,'date-field');field.id=id+'-compact-field';field.inert=true;field.setAttribute('aria-hidden','true');input.tabIndex=-1;
  toggle.setAttribute('aria-label','Edit '+caption);toggle.title='Edit '+caption;toggle.setAttribute('aria-controls',field.id);toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path class="icon-detail" d="M7 3v4M17 3v4M3 11h18"/></svg>';
  if(!original)input.before(control);else group.append(control);field.append(input);control.append(toggle,field);
 }
 function setupPanelControls(){
  for(const [id,caption]of [['availability-effective','Effective from'],['availability-holiday-start','First day'],['availability-holiday-end','Last day'],['rates-date','Effective from']])compactDate(id,caption);
  const weekbar=document.querySelector('.rostering-weekbar');
  for(const id of ['timesheets','availability','leave','settings']){
   const panel=$('rostering-'+id),heading=panel.querySelector('.roster-section-heading'),tools=node('div',undefined,'roster-panel-controls');tools.dataset.rosterTools=id;tools.hidden=true;tools.dataset.editId='rostering-'+id+'-tools';
   const title=heading.querySelector('h2'),description=heading.querySelector('p');tools.append(title);
   if(id==='timesheets'){moveControls(panel.querySelector('.timesheet-filter'),tools);moveControls(heading.querySelector('.roster-actions'),tools);moveControls($('timesheet-metrics'),tools);}
   if(id==='availability'){moveControls(panel.querySelector('.availability-tools'),tools);moveControls(panel.querySelector('.roster-form-actions'),tools);}
   if(id==='leave'){moveControls(panel.querySelector('.leave-filters'),tools);moveControls($('leave-request'),tools);}
   if(description){description.classList.add('roster-panel-help');panel.prepend(description);}heading.remove();weekbar.append(tools);
  }
  for(const card of document.querySelectorAll('.roster-settings-card')){
   const header=node('div',undefined,'roster-settings-heading');header.append(card.querySelector('h3'));moveControls(card.querySelector('.roster-effective-date'),header);moveControls(card.querySelector('.roster-form-actions'),header);card.prepend(header);
  }
 }
 setupPanelControls();
 const phonePanelSlots=[],phonePanelHost=node('div',undefined,'phone-roster-panels'),phoneSection=select('phoneSection',[['roster','Roster'],['timesheets','Timesheets'],['availability','Availability'],['leave','Leave']],'roster');
 phoneSection.id='phone-roster-section';phoneSection.setAttribute('aria-label','Rostering section');
 const phoneSectionControl=node('div',undefined,'phone-roster-section');phoneSectionControl.append(phoneSection);$('phone-roster').querySelector('.phone-roster-header').after(phoneSectionControl);
 phonePanelHost.id='phone-roster-panels';$('phone-roster').querySelector('.phone-roster-tabs').before(phonePanelHost);
 document.querySelector('.rostering-page').append($('phone-roster'));
 for(const id of ['timesheets','availability','leave'])for(const element of [document.querySelector('[data-roster-tools="'+id+'"]'),$('rostering-'+id)]){const marker=document.createComment('Roster panel position');element.before(marker);phonePanelSlots.push({element,marker});}
 const phoneStatusSlot=document.createComment('Roster status position');$('rostering-status').before(phoneStatusSlot);
 function placePhonePanels(){
  if(phoneViewport.matches){
   for(const {element} of phonePanelSlots)phonePanelHost.append(element);$('phone-roster').querySelector('.phone-roster-datebar').after($('rostering-status'));
  }else{
   for(const {element,marker} of phonePanelSlots)marker.after(element);phoneStatusSlot.after($('rostering-status'));
  }
 }
 placePhonePanels();
 function showPhoneSection(value){
  const next=['roster','timesheets','availability','leave'].includes(value)?value:'roster';phoneRosterDismissed=false;
  history.replaceState(null,'','#'+next);view();
 }
 phoneSection.onchange=()=>showPhoneSection(phoneSection.value);
 window.appPhoneRoster={show:showPhoneSection};
 $('roster-position-add').disabled=$('roster-position-save').disabled=true;
 function positionColour(element,position,color){
  if(!element)return;const value=color===undefined?data?.positionSettings?.positions.find(item=>item.name===position)?.color:color;
  if(/^#[a-f0-9]{6}$/i.test(value||'')){element.style.setProperty('--shift-colour',value);const rgb=[1,3,5].map(index=>parseInt(value.slice(index,index+2),16));element.style.setProperty('--shift-ink',rgb[0]*.299+rgb[1]*.587+rgb[2]*.114<145?'#ffffff':'#24445b');}else{element.style.removeProperty('--shift-colour');element.style.removeProperty('--shift-ink');}
 }
 function syncPhoneRosterMode(){
  const reading=phoneViewport.matches,dialog=$('phone-roster'),open=reading&&!phoneRosterDismissed&&!appRequiredReading.blocked,roster=section==='roster';
  document.body.classList.toggle('phone-roster-reading',reading);
  phoneSection.value=section||'roster';$('phone-roster-shifts').hidden=!roster;phonePanelHost.hidden=roster;
  dialog.querySelector('.phone-roster-tabs').hidden=!roster;$('phone-roster-location').textContent=session?.locationName||'';
  if(!roster){$('phone-roster-caption').textContent={timesheets:'Timesheets',availability:'Your availability',leave:'Leave requests'}[section]||'';if(data){$('phone-roster-date-label').textContent=date(week)+' – '+date(data.weekEnd);$('phone-roster-date').value=week;for(const id of ['previous','next'])$('phone-roster-'+id).setAttribute('aria-label',(id==='previous'?'Previous':'Next')+' week');}}
  renderHourlySales();
  if(open){dialog.hidden=false;if(!dialog.open)dialog.showModal();}
  else if(!phoneRosterClosing){if(dialog.open)dialog.close();dialog.hidden=true;}
 }
 async function dismissPhoneRoster(){
  if(phoneRosterClosing)return;phoneRosterDismissed=true;phoneRosterClosing=true;const dialog=$('phone-roster');
  try{if(dialog.open&&!matchMedia('(prefers-reduced-motion:reduce)').matches)await dialog.animate([{transform:'translateY(0)',opacity:1},{transform:'translateY(100%)',opacity:0}],{duration:180,easing:'ease-in'}).finished;}catch{}
  finally{phoneRosterClosing=false;syncPhoneRosterMode();if(window.appPhoneRosterPopup)parent.appShell.closePhoneRoster(true);else if(phoneViewport.matches)location.href='/home';}
 }
 function phoneShiftsOnDay(shifts,day){return shifts.filter(shift=>shift.date===day||shift.overnight&&M.shiftDate(shift.date,1)===day&&shift.end!=='00:00').sort((a,b)=>(a.date===day?M.minutes(a.start):0)-(b.date===day?M.minutes(b.start):0)||a.username.localeCompare(b.username));}
 function phoneShiftRow(shift,day){
  const row=node('div',undefined,'phone-roster-shift'),person=node('div',undefined,'phone-roster-person'),schedule=node('div',undefined,'phone-roster-time'),carry=shift.date!==day;
  row.dataset.phoneShift=shift.id;positionColour(row,shift.position,shift.positionColor);person.append(user(node('strong',shift.username)));
  if(phoneRosterScope==='mine'&&shift.position)person.append(user(node('small',shift.position)));
  schedule.append(user(node('span',M.formatTimeInput(carry?'00:00':shift.start)+' – '+M.formatTimeInput(shift.end))));
  if(carry)schedule.append(user(node('small','From '+date(shift.date))));else if(shift.overnight)schedule.append(node('small','Ends next day'));
  row.append(person,schedule);return row;
 }
 function phoneShiftCard(shift){
  const wrap=node('div',undefined,'phone-roster-card-wrap'),day=user(node('p',dayNames[(new Date(shift.date+'T12:00:00Z').getUTCDay()+6)%7].slice(0,3)+' '+date(shift.date),'phone-roster-card-date')),card=node('article',undefined,'roster-shift phone-roster-card'),position=user(node('span',shift.position?shift.position.split(/\s+/).map(word=>word[0]).join('').slice(0,2).toUpperCase():'–','roster-position-static')),content=node('div',undefined,'phone-roster-card-content'),times=node('div',undefined,'phone-roster-card-times'),person=node('div',undefined,'phone-roster-card-person');
  card.dataset.phoneShift=shift.id;positionColour(card,shift.position,shift.positionColor);card.setAttribute('aria-label',day.textContent+' · '+(shift.position||'No position')+' · '+M.formatTimeInput(shift.start)+' – '+M.formatTimeInput(shift.end)+(shift.overnight?' · ends next day':''));
  position.title=shift.position||'No position';position.setAttribute('aria-label',position.title);times.append(user(node('span',M.formatTimeInput(shift.start))),user(node('span',M.formatTimeInput(shift.end))));if(shift.overnight)times.append(node('small','+1'));
  person.append(user(node('strong',shift.username)));if(shift.position)person.append(user(node('small',shift.position)));content.append(times,person);if(shift.overnight)content.append(node('small','Ends next day','phone-roster-card-overnight'));card.append(position,content);wrap.append(day,card);window.publicHolidayMarkers?.mark(day,shift.date);return wrap;
 }
 function renderHourlySales(){
  const phone=phoneViewport.matches;
  window.rosterHourlySales?.render({before:phone?$('phone-roster-shifts'):$('roster-days'),projection:data?.summary?.projection,weekStart:week,fixedDate:phone?(phoneRosterScope==='team'?phoneRosterDay:null):(rosterView==='day'?rosterDay:null),phone,hidden:section!=='roster'||appRequiredReading.blocked});
 }
 function renderPhoneRoster(){
  syncPhoneRosterMode();if(!data||!phoneViewport.matches)return;
  if(M.monday(phoneRosterDay)!==week)phoneRosterDay=week;
  const key=JSON.stringify([week,phoneRosterDay,phoneRosterScope,data.teamRoster,data.roster.publishedAt,session.locationName]);if(key===phoneRosterKey)return;phoneRosterKey=key;
  const mine=phoneRosterScope==='mine',host=$('phone-roster-shifts'),team=data.teamRoster||{shifts:[],carryoverShifts:[]},shifts=(mine?team.shifts:[...team.shifts,...team.carryoverShifts]).filter(shift=>!mine||shift.userId===session.id);
  $('phone-roster-location').textContent=session.locationName;$('phone-roster-caption').textContent=mine?'My shifts · Monday–Sunday':'Team shifts · By position';
  $('phone-roster-date-label').textContent=mine?date(week)+' – '+date(data.weekEnd):dayNames[(new Date(phoneRosterDay+'T12:00:00Z').getUTCDay()+6)%7].slice(0,3)+' '+date(phoneRosterDay);
  window.publicHolidayMarkers?.mark($('phone-roster-date-label'),mine?null:phoneRosterDay);$('phone-roster-date').value=mine?week:phoneRosterDay;
  for(const id of ['previous','next'])$('phone-roster-'+id).setAttribute('aria-label',(id==='previous'?'Previous':'Next')+(mine?' week':' day'));
  for(const id of ['mine','team'])$('phone-roster-'+id).setAttribute('aria-pressed',String(id===phoneRosterScope));
  host.replaceChildren();
  const group=(title,rows,day)=>{const block=node('section',undefined,'phone-roster-group');block.dataset.rosterGroup=title;block.append(user(node('h3',title)));for(const shift of rows)block.append(phoneShiftRow(shift,day));host.append(block);};
  if(!data.roster.publishedAt&&!shifts.length){host.append(node('p','No roster has been published for this week.','phone-roster-empty'));return;}
  if(mine){
   for(const shift of shifts.sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)))host.append(phoneShiftCard(shift));
   if(!shifts.length)host.append(node('p','You have no rostered shifts this week.','phone-roster-empty'));
  }else{
   const visible=phoneShiftsOnDay(shifts,phoneRosterDay),groups=new Map();for(const shift of visible){const position=shift.position||'Unassigned position';if(!groups.has(position))groups.set(position,[]);groups.get(position).push(shift);}
   const priority=position=>/supervisor|manager|shift leader|team leader/i.test(position)?0:position==='Unassigned position'?2:1;
   for(const position of [...groups.keys()].sort((a,b)=>priority(a)-priority(b)||a.localeCompare(b)))group(position,groups.get(position),phoneRosterDay);
   if(!visible.length)host.append(node('p','No published shifts on this day.','phone-roster-empty'));
  }
 }
 async function selectPhoneRosterDate(day){
  try{M.date(day);if(!await flushRosterEdits())return;phoneRosterDay=day;if(M.monday(day)!==week)await selectWeek(day);else if(section==='roster')renderPhoneRoster();else syncPhoneRosterMode();}catch(error){status(error.message);}
 }
 const settingsAccess=()=>!phoneViewport.matches&&['rostering.manage','rostering.costs','rostering.budget.location','rostering.budget.company','rostering.budget.network'].some(can);
 function renderSidebar(){const nav=document.querySelector('.rostering-sidebar'),items=[['roster','Roster','<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4"/><path class="icon-detail" d="M3 11h18M7 15h3M14 15h3"/>'],['timesheets','Timesheets','<path d="M5 3h14v18H5Z"/><path class="icon-detail" d="M8 7h8M8 11h8M8 15h5"/>'],['leave','Leave','<path d="M5 3h14v18H5Z"/><path class="icon-detail" d="M8 7h8M8 11h5m-4 5 2 2 4-4"/>'],['availability','Availability','<rect x="3" y="4" width="18" height="17" rx="2"/><path class="icon-detail" d="m7 13 3 3 7-7"/>'],...(settingsAccess()?[['settings','Labour settings','<path d="M4 5h16v14H4Z"/><path class="icon-detail" d="M7 9h10M7 15h10M10 7v4M15 13v4"/>']]:[])];nav.replaceChildren();for(const [id,name,path]of items){const link=node('a',undefined,'page-sidebar-link');link.href='#'+id;link.title=name;link.setAttribute('aria-label',name);link.dataset.rosterView=id;link.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';link.append(node('span',name,'page-sidebar-label'));nav.append(link);}}
 // Background refreshes must not replace active editors or announce loading in the layout.
 function rosterInteractionActive(){
  const board=$('roster-days'),focused=document.activeElement;
  return rosterSaving||rosterPress||rosterDrag||rosterDirty()||document.querySelector('.roster-dialog[open]')||board.querySelector('.location-select-trigger[aria-expanded="true"]')||(board.contains(focused)&&focused.matches('input,textarea,select,[role="combobox"]'));
 }
 async function load(quiet=false,background=false){
  const version=quiet?loading:++loading;if(!quiet&&!background)status('Loading rostering…');
  try{
   const result=await api('dashboard?week='+week);if(version!==loading)return;
   if(!quiet&&section==='roster'&&rosterInteractionActive()){if($('rostering-status').textContent==='Loading rostering…')status('');return;}
   data=result;$('roster-week').value=week;$('roster-week-label').textContent=date(week)+' – '+date(data.weekEnd);
   if(!quiet){renderSection();if(!background)status('');}
  }catch(error){if(version===loading)status(error.message);}
 }
 async function view(){if(!session||appRequiredReading.blocked)return;let next=location.hash.slice(1)||'roster';if(next==='clock'){next='roster';history.replaceState(null,'','#roster');}if(section==='roster'&&next!=='roster'&&(rosterSaving||rosterDirty())){if(!await flushRosterEdits()){history.replaceState(null,'','#roster');return;}}if(!['roster','timesheets','availability','leave','settings'].includes(next)||next==='settings'&&!settingsAccess())next='roster';if(phoneViewport.matches&&location.hash==='#settings')history.replaceState(null,'','#roster');if(next!==section)phoneRosterKey='';if(next==='roster'&&section!=='roster')phoneRosterDismissed=false;section=next;syncPhoneRosterMode();$('roster-toolbar-controls').hidden=phoneViewport.matches||section!=='roster';for(const tools of document.querySelectorAll('[data-roster-tools]'))tools.hidden=tools.dataset.rosterTools!==section;for(const panel of document.querySelectorAll('[data-roster-panel]'))panel.hidden=panel.dataset.rosterPanel!==section;for(const link of document.querySelectorAll('[data-roster-view]')){if(link.dataset.rosterView===section)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}if(data)renderSection();load();}
 function renderSection(){if(!data)return;const render={roster:renderRoster,timesheets:renderTimesheets,availability:renderAvailability,leave:renderLeave,settings:renderSettings};render[section||'roster']();syncPhoneRosterMode();appAccess.apply(session);}
 function renderRoster(preserveBoard=false){renderPhoneRoster();if(phoneViewport.matches)return;const summaryKey=data.summary?Object.fromEntries(['projection','effectiveBudget','budgetCents','plannedCostCents','unpricedShifts','plannedSeconds','plannedPercent','remainingCents'].map(key=>[key,data.summary[key]])):null,key=JSON.stringify([data.weekStart,rosterView,rosterDay,can('rostering.manage'),data.roster,data.people,data.positions,data.awardChecks,summaryKey]);if(key===rosterRenderKey&&$('roster-days').querySelector('.roster-board,.roster-day-board'))return;const summary=data.summary,metrics=$('roster-metrics');metrics.replaceChildren();metrics.hidden=!summary;if(summary){const budget=summary.effectiveBudget;metrics.append(metric('Projected sales',money(summary.projection.projectedSalesCents),summary.projection.weeksRecorded+'/4 completed sales weeks'+((summary.projection.daily||[]).some(day=>day.holiday?.status==='adjusted')?' · Holiday adjustment applied':'')),metric('Labour budget',money(summary.budgetCents),budget?budget.scope[0].toUpperCase()+budget.scope.slice(1)+' '+(budget.mode==='percent'?(budget.value/100).toFixed(2)+'%':'weekly budget'):'Set a labour budget in Labour settings'),metric('Roster cost',money(summary.plannedCostCents),summary.unpricedShifts?summary.unpricedShifts+(summary.nativePay?' shifts need employment or award details':' shifts need staff or hourly rates'):hours(summary.plannedSeconds)+(summary.nativePay?' · Gross wages & allowances':'')+(summary.plannedPercent!==null?' · '+summary.plannedPercent.toFixed(1)+'% of forecast':'')),metric('Budget remaining',money(summary.remainingCents),summary.remainingCents===null?'Needs a budget, forecast and hourly rates':summary.remainingCents<0?'Roster is over budget':'After rostered labour',summary.remainingCents<0?'negative':'positive'));}
  for(const card of metrics.children)card.title=[...card.children].map(part=>part.textContent).join(' · ');
  renderAwardPanel($('roster-award-checks'),data.awardChecks?.roster);for(const card of $('roster-days').querySelectorAll('[data-shift-id]'))markAwardCard(card);
  syncRosterViewControls();const manage=can('rostering.manage');$('roster-view-title').textContent=manage?'Weekly roster':'My published shifts';$('roster-published-status').textContent=data.roster.publishedAt?'Published '+date(M.localParts(data.roster.publishedAt).date)+' by '+data.roster.publishedBy+(manage&&data.roster.hasChanges?' · Unpublished changes':''):manage?'Draft — publish to make shifts visible to users.':'No roster has been published for this week.';$('roster-manager-actions').hidden=!manage;$('roster-copy').disabled=data.roster.shifts.length>0;$('roster-publish').disabled=!data.roster.hasChanges&&Boolean(data.roster.publishedAt);
  if(preserveBoard)updateRosterBoardTotals();else renderRosterBoard(manage,summary);rosterRenderKey=key;updateRosterSaveStatus();}
 // The scheduling board moves shifts, independently of company App edit layouts.
 let rosterRenderKey='',rosterView='staff',rosterDay=M.today(),rosterSaving=false,rosterPress=null,rosterDrag=null,rosterFrame=0,rosterSaveTimer=0,rosterSaveTask=null,rosterNeedsLayout=false,selectedRosterShift=null,rosterDeleting=false,rosterDraggedAt=-Infinity;
 const rosterEditors=new Map(),newRosterShifts=new Map(),deletedRosterShifts=[];
 const rosterDirty=()=>Boolean($('roster-days')?.querySelector('.roster-shift.is-dirty'));
 const rosterEditing=()=>document.body.classList.contains('app-edit-mode');
 function rosterPayload(shift,changes={}){return{weekStart:week,revision:data.roster.revision,userId:shift.userId,date:shift.date,start:shift.start,end:shift.end,overnight:shift.overnight,breakMinutes:shift.breakMinutes,position:shift.position,notes:shift.notes,allowUnavailable:shift.allowUnavailable,...(shift.awardFacts?{awardFacts:shift.awardFacts}:{}),...changes};}
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
  const result=await api('dashboard?week='+week);if(result.roster.revision!==data.roster.revision)for(const editor of rosterEditors.values())if(editor.dirty){editor.pending=false;editor.blocked=true;setRosterEditorError(editor,'The roster changed. Undo this edit and refresh before continuing.');}data=result;
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
  if(rosterDeleting||!can('rostering.delete-shift')||rosterEditing())return;
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
   window.publicHolidayMarkers?.mark(header.querySelector('strong'),day);board.append(header);
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
  $('roster-view').value=rosterView;window.locationPickers?.refresh($('roster-view'));
  const picker=$('roster-day');$('roster-day-control').hidden=rosterView!=='day';
  if(picker.dataset.week!==week){picker.replaceChildren();for(let index=0;index<7;index++){const day=M.shiftDate(week,index),option=user(node('option',dayNames[index].slice(0,3)+' '+date(day)));option.value=day;picker.append(option);}picker.dataset.week=week;}
  picker.value=rosterDay;window.locationPickers?.refresh(picker);
 }
 function dailyShifts(){
  return [...data.roster.shifts,...(data.roster.carryoverShifts||[])].filter(shift=>shift.date===rosterDay||shift.overnight&&M.shiftDate(shift.date,1)===rosterDay&&shift.end!=='00:00');
 }
 function renderDailyRoster(manage,shifts){
  const host=$('roster-days');host.classList.add('roster-daily-scroll');host.setAttribute('aria-label','Daily roster hourly timeline');
  const board=node('div',undefined,'roster-day-board'),corner=node('div',undefined,'roster-board-corner'),axis=node('div',undefined,'roster-day-hours');corner.append(node('strong','Staff'),user(node('small',date(rosterDay))));window.publicHolidayMarkers?.mark(corner.querySelector('small'),rosterDay);
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
    const label=shift.start+' – '+shift.end+(shift.overnight?' +1':''),detail=hours(shift.paidSeconds)+' paid'+(shift.position?' · '+shift.position:'');bar.append(user(node('strong',label)),user(node('small',detail)));bar.title=shift.username+' · '+label+' · '+detail+' · '+shift.breakMinutes+'m unpaid break'+(carry?' · Continues from '+date(shift.date):'');bar.setAttribute('aria-label',bar.title);bar.dataset.timelineShift=shift.id;positionColour(bar,shift.position,shift.positionColor);
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
  function refresh(){positionColour(wrap.closest('.roster-shift'),selected);code.textContent=selected?selected.split(/\s+/).map(word=>word[0]).join('').slice(0,2).toUpperCase():'–';wrap.title=selected||'No position';window.locationPickers?.refresh(position);}
  position.onchange=()=>{
   if(position.value!==addValue){selected=position.value;refresh();return;}
   position.value=selected;refresh();
   const ui=makeDialog('Add position'),name=input('text','positionName');name.required=true;name.maxLength=80;name.autocomplete='off';ui.form.append(field('Position name',name));ui.save.textContent='Use position';
   ui.form.onsubmit=event=>{event.preventDefault();const value=name.value.trim();if(!value){ui.error.textContent='Enter a position name.';return;}if(![...position.options].some(option=>option.value===value)){const option=user(node('option',value));option.value=value;position.insertBefore(option,position.lastElementChild);}position.value=value;position.dispatchEvent(new Event('change',{bubbles:true}));ui.dialog.close();};ui.finish();
  };
  refresh();return{wrap,position,reset(){selected=shift.position||'';position.value=selected;refresh();}};
 }
 function rosterCard(shift,manage){
  const isNew=newRosterShifts.has(shift.id),card=node('article',undefined,'roster-shift'+(shift.userId===null?' roster-vacant-shift':''));card.dataset.shiftId=shift.id;card.dataset.layoutKey='shift:'+shift.id;positionColour(card,shift.position,shift.positionColor);if(isNew)card.dataset.newShift='';
  const availability=shift.availability==='unavailable'?'Availability conflict':shift.availability==='unknown'?'Availability not entered':shift.userId===null?'Vacant shift':'Available';
  const description=[shift.position||'No position',shift.date,shift.start+' – '+shift.end+(shift.overnight?' · ends next day':''),hours(shift.paidSeconds),shift.breakMinutes+'m unpaid break',...(manage?[money(shift.costCents),availability]:[]),shift.notes].filter(Boolean).join(' · ');card.title=description;markAwardCard(card);
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
  if(!['Backspace','Delete'].includes(event.key)||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||section!=='roster'||appRequiredReading.blocked||!selectedRosterShift||!can('rostering.delete-shift')||rosterEditing()||rosterDrag||rosterPress)return;
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
 async function changeRosterView(next){if(!['staff','stacked','day'].includes(next)||!data||!await flushRosterEdits()){syncRosterViewControls();return;}rosterView=next;try{localStorage.setItem('opstack-roster-view:'+session.id+':'+session.companyId,next);}catch{}renderRoster();}
 function renderAwardPanel(host,check){
  if(!host)return;const open=host.open;host.replaceChildren();host.hidden=!check?.enabled;if(!check?.enabled)return;host.classList.toggle('is-clear',!check.reviewRequired);host.append(node('summary',check.reviewRequired?'Award checks · '+check.issues.length+' need review':check.status==='no-items'?'Award checks · No recorded shifts to check':'Award checks · Configured checks clear'));
  host.append(node('p',check.nativeSource?'MA000003 · July 2026 native wage calculations. Totals include wages and recorded allowances. Super and on-cost estimates are shown separately. Review missing details and exceptions before payroll.':'MA000003 · Only reviewed rules within their effective dates are checked. Labour estimates use entered hourly rates.'));
  const list=node('ul');for(const issue of check.issues){const person=data.people.find(p=>p.id===issue.userId)?.username,listItem=user(node('li',(person?person+': ':'')+issue.message));list.append(listItem);}if(list.children.length)host.append(list);if(check.prices){const rows=node('div',undefined,'roster-pay-rows');for(const price of check.prices){const mode=host.id==='roster-award-checks'?'roster':'timesheets',item=(mode==='roster'?data.roster.shifts:data.timesheets).find(i=>i.id===price.subjectId);if(!item)continue;const row=node('div',undefined,'roster-pay-row');row.append(user(node('span',item.username+' · '+(item.date||M.localParts(item.startAt).date)+' · '+money(item.status==='approved'&&item.pay?item.pay.costCents:price.costCents))),button('Pay details',()=>payDetails(item,mode)));rows.append(row);}host.append(rows);}
  host.append(node('p','Checks run: '+(check.coverage.join(', ')||'None for this selection')+'.'),node('p','Not checked: '+check.exclusions.join(', ')+'.'));
  if(host.id==='roster-award-checks'&&data.roster.awardReview){const last=data.roster.awardReview;host.append(user(node('p','Last published award review: '+last.by+' · '+new Date(last.at).toLocaleString('en-AU')+(last.note?' · '+last.note:''))));}if(can('awards.manage')){const link=node('a','Open award settings');link.href='/settings/awards';host.append(link);}host.open=open;
 }
 function payDetails(item,mode){
  const ui=makeDialog('Pay details · '+item.username),pay=item.pay||data.awardChecks?.[mode==='roster'?'roster':'timesheets']?.prices?.find(p=>p.subjectId===item.id),facts=item.awardFacts||{};
  if(pay){const table=node('table',undefined,'roster-pay-table'),head=node('tr');head.append(node('th','Entitlement'),node('th','Hours / rate'),node('th','Amount'));table.append(head);for(const line of pay.lines){const row=node('tr');row.append(user(node('td',line.label+' · '+line.clause)),user(node('td',line.rateCents!==undefined?(line.seconds/3600).toFixed(2)+'h × '+money(line.rateCents):'—')),user(node('td',money(line.amountCents))));table.append(row);}ui.form.append(node('p',item.status==='approved'?'Saved approval calculation. Saving changed pay details reopens this timesheet.':'Wage estimate from the included July 2026 award edition.','roster-help'),table,user(node('p','Gross wages & allowances: '+money(pay.costCents)+' · Super estimate: '+money(pay.superEstimateCents)+' · Other on-cost estimate: '+money(pay.oncostEstimateCents),'roster-help')));if(!pay.complete)ui.form.append(node('p','Required details are missing. Complete the blocking warnings before approval.','roster-error'));}
  const grid=node('div',undefined,'roster-dialog-grid'),mealStart=input('time','mealBreakStart',facts.mealBreakStart||''),rest=input('number','restBreaksTaken',facts.restBreaksTaken??''),unpaid=input('number','unpaidMinutes',item.breakMinutes??Math.round(item.breakSeconds/60)),controls={};unpaid.min=0;unpaid.step=1;rest.min=0;rest.max=20;rest.step=1;grid.append(field('Unpaid meal break start',mealStart));if(mode==='roster')grid.append(field('Unpaid meal break (minutes)',unpaid));else grid.append(field('Paid 10-minute rest breaks taken',rest));
  for(const [key,label]of [['coldMinutes','Cold work minutes (above/equal 0°C)'],['freezerMinutes','Cold work minutes (below 0°C)'],['deliveryKm','Own vehicle delivery km'],['otherKm','Own vehicle other duties km'],['travelMinutes','Extra travel — first leg (minutes)'],['returnTravelMinutes','Extra travel — return leg (minutes)'],['mealOvertimeMinutes','Eligible overtime after ordinary finish (minutes)']]){const control=input('number',key,facts[key]||'');control.min=0;control.max=1440;control.step='any';grid.append(field(label,control));controls[key]=control;}
  const travelStart=input('datetime-local','travelStartAt',facts.travelStartAt?localInput(facts.travelStartAt):''),returnTravelStart=input('datetime-local','returnTravelStartAt',facts.returnTravelStartAt?localInput(facts.returnTravelStartAt):'');grid.append(field('Extra travel first leg starts (Melbourne time)',travelStart),field('Extra travel return leg starts (Melbourne time)',returnTravelStart));
  const reimbursement=input('number','reimbursement',facts.reimbursementCents?(facts.reimbursementCents/100).toFixed(2):''),description=input('text','reimbursementReason',facts.reimbursementReason||'');reimbursement.min=0;reimbursement.step='.01';description.maxLength=300;grid.append(field('Reimbursement ($)',reimbursement),field('Reimbursement reason',description));ui.form.append(grid);
  const checks={};for(const [key,label]of [['mealConditionsReviewed','Overtime meal conditions reviewed (clause 17.4)'],['mealEligible','More than one hour after ordinary finish, under 24h notice, cannot reasonably return home for a meal'],['mealSupplied','Employer supplied the first overtime meal'],['sundayAdjacentOrdinary','Sunday overtime is immediately before/after ordinary work (clause 20.5)']]){const e=input('checkbox',key);e.checked=facts[key]===true;ui.form.append(field(label,e));checks[key]=e;}
  const variation=input('checkbox','hasVariation'),variationPanel=node('div',undefined,'roster-dialog-grid'),v=facts.variation||{},from=input('time','variationStart',v.start||item.start||'09:00'),to=input('time','variationEnd',v.end||item.end||'17:00'),next=input('checkbox','variationOvernight'),breaks=input('number','variationBreak',v.breakMinutes||0),reference=input('text','variationReference',v.reference||''),agreed=input('datetime-local','variationAgreedAt',v.agreedAt?localInput(v.agreedAt):'');variation.checked=Boolean(facts.variation);next.checked=v.overnight===true;breaks.min=0;breaks.max=180;breaks.step=1;reference.minLength=8;reference.maxLength=500;variationPanel.append(field('Agreed start',from),field('Agreed finish',to),field('Ends next day',next),field('Agreed unpaid break (minutes)',breaks),field('Written agreement reference',reference),field('Agreed at (Melbourne time)',agreed));variation.onchange=()=>variationPanel.hidden=!variation.checked;variation.onchange();ui.form.append(field('Recorded written part-time variation for this shift',variation),variationPanel,node('p','Enter only work conditions that actually apply. Cold work must be the principal duties for that day; the two cold minute fields are separate, non-overlapping time. Travel is additional to normal travel. See clause 17 for the full conditions.','roster-help'));
  const reason=input('text','payReason');if(mode==='timesheets'){reason.required=true;reason.maxLength=500;ui.form.append(field('Reason for pay detail change',reason));}
  ui.save.textContent='Save pay details';ui.form.onsubmit=async event=>{event.preventDefault();const awardFacts={};for(const [key,control]of Object.entries(controls))awardFacts[key]=Number(control.value||0);for(const [key,control]of [['travelStartAt',travelStart],['returnTravelStartAt',returnTravelStart]])if(control.value){try{awardFacts[key]=M.instant(control.value.slice(0,10),control.value.slice(11,16));}catch(error){ui.error.textContent=error.message;return;}}awardFacts.mealBreakStart=mealStart.value||undefined;if(mode!=='roster'&&rest.value!=='')awardFacts.restBreaksTaken=Number(rest.value);for(const [key,e]of Object.entries(checks))awardFacts[key]=e.checked;awardFacts.reimbursementCents=Math.round(Number(reimbursement.value||0)*100);awardFacts.reimbursementReason=description.value;if(variation.checked){try{awardFacts.variation={start:from.value,end:to.value,overnight:next.checked,breakMinutes:Number(breaks.value),reference:reference.value,agreedAt:M.instant(agreed.value.slice(0,10),agreed.value.slice(11,16))};}catch(error){ui.error.textContent=error.message;return;}}ui.busy(true);try{if(mode==='roster'){if(!await flushRosterEdits())throw Error('Save the current roster changes first.');await api('shifts/'+item.id,'PUT',rosterPayload(item,{awardFacts,breakMinutes:Number(unpaid.value)}));}else await api('timesheets/'+item.id,'PUT',{action:'pay-details',revision:item.revision,awardFacts,reason:reason.value});ui.dialog.close();await load();status('Pay details saved.',true);}catch(error){ui.error.textContent=error.message;ui.busy(false);}};if(!(mode==='roster'?can('rostering.manage'):can('rostering.approve'))){for(const e of ui.form.querySelectorAll('input,select,textarea'))e.disabled=true;ui.save.remove();ui.cancel.textContent='Close';}ui.finish();
 }
 function markAwardCard(card){const issues=data.awardChecks?.roster?.issues.filter(issue=>issue.subjectId===card.dataset.shiftId)||[];card.classList.toggle('has-award-warning',issues.length>0);if(!card.dataset.awardBaseTitle)card.dataset.awardBaseTitle=card.title;card.title=card.dataset.awardBaseTitle+(issues.length?' · Award review: '+issues.map(issue=>issue.message).join(' '):'');}
 async function confirmAwardReview(check,action){
  if(!check?.enabled)return action({});if(!check.reviewRequired)return action({awardFingerprint:check.fingerprint});
  return new Promise(resolve=>{const ui=makeDialog('Review award checks'),list=node('ul',undefined,'roster-award-review-list'),note=node('textarea');for(const issue of check.issues)list.append(user(node('li',issue.message)));note.className='roster-award-review-note';note.name='awardReviewNote';note.required=true;note.minLength=8;note.maxLength=1000;ui.form.append(node('p','Review these warnings against the award and any applicable agreement before continuing. A review note records your decision; it does not certify compliance.','roster-award-note'),list,field('Review note',note));ui.save.textContent='Record review and continue';ui.form.onsubmit=async event=>{event.preventDefault();ui.busy(true);try{await action({awardFingerprint:check.fingerprint,awardReviewNote:note.value});ui.dialog.close();}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.dialog.addEventListener('close',resolve,{once:true});ui.finish();});
 }
 function makeDialog(title){const dialog=node('dialog',undefined,'roster-dialog');dialog.dataset.copyEditor=dialog.dataset.layoutUi='';const header=node('div',undefined,'roster-dialog-heading'),heading=node('h2',title),close=button('×',()=>{if(!dialog.dataset.busy)dialog.close();},'roster-dialog-close');heading.id='roster-dialog-title';dialog.setAttribute('aria-labelledby',heading.id);close.setAttribute('aria-label','Close dialog');header.append(heading,close);const form=node('form'),error=node('p','','roster-error'),actions=node('div',undefined,'roster-dialog-actions'),cancel=button('Cancel',()=>dialog.close()),save=node('button','Save','rostering-primary');save.type='submit';actions.append(cancel,save);error.setAttribute('role','status');dialog.append(header,form);document.body.append(dialog);dialog.addEventListener('cancel',event=>{if(dialog.dataset.busy)event.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());return{dialog,form,error,actions,save,cancel,finish(){form.append(error,actions);dialog.showModal();},busy(value){dialog.dataset.busy=value?'true':'';for(const control of dialog.querySelectorAll('input,select,textarea,button'))control.disabled=value;}};}
 async function rosterAction(action){if(!await flushRosterEdits())return;if(action==='publish'){const board=$('roster-days');rosterSaving=true;board.inert=true;$('roster-publish').disabled=true;updateRosterSaveStatus();try{await confirmAwardReview(data.awardChecks?.roster,async review=>{await api('publish','POST',{weekStart:week,revision:data.roster.revision,...review});await refreshRosterSaved(false);status('Roster published.',true);});}catch(error){status(error.message);$('roster-publish').disabled=false;}finally{rosterSaving=false;board.inert=false;$('roster-publish').disabled=!data.roster.hasChanges&&Boolean(data.roster.publishedAt);updateRosterSaveStatus();}return;}const ui=makeDialog(action==='publish'?'Publish roster':'Copy previous week'),description=node('p',action==='publish'?'Users at this location will see their shifts from this roster.':'Copy the previous week into this empty draft.'),allow=input('checkbox','allowUnavailable');ui.form.append(description);if(action==='copy-previous')ui.form.append(field('Allow shifts outside submitted availability',allow));ui.save.textContent=action==='publish'?'Publish roster':'Copy shifts';ui.form.onsubmit=async event=>{event.preventDefault();ui.busy(true);try{await api(action,'POST',{weekStart:week,revision:data.roster.revision,allowUnavailable:allow.checked});ui.dialog.close();await load();status(action==='publish'?'Roster published.':'Previous week copied to draft.',true);}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.finish();}
 function renderTimesheets(){renderAwardPanel($('timesheet-award-checks'),data.awardChecks?.timesheets);const all=data.timesheets,selected=$('timesheet-filter').value,rows=all.filter(item=>selected==='all'||item.status===selected),metrics=$('timesheet-metrics');metrics.replaceChildren(metric('Worked hours',hours(all.filter(item=>item.status!=='rejected').reduce((sum,item)=>sum+item.paidSeconds,0))),metric('Approved hours',hours(all.filter(item=>item.status==='approved').reduce((sum,item)=>sum+item.paidSeconds,0))),metric('Pending approval',String(all.filter(item=>item.status==='pending').length)),metric('Clocked in',String(all.filter(item=>item.status==='open').length)));if(data.summary){const summary=data.summary,remaining=summary.budgetCents!==null&&summary.actualCostCents!==null?summary.budgetCents-summary.actualCostCents:null;metrics.replaceChildren(metric('Worked labour',money(summary.actualCostCents),summary.nativePay?'Completed work, including pending approval · Gross wages & allowances':'Includes pending time and active shifts'),metric('Approved labour',money(summary.approvedCostCents),'Approved timesheets only'),metric('Pending approval',String(all.filter(item=>item.status==='pending').length)),metric('Labour budget remaining',money(remaining),'After worked labour',remaining!==null&&remaining<0?'negative':'positive'));}const list=$('timesheet-list');list.replaceChildren();for(const item of rows){const card=node('article',undefined,'timesheet-card');card.dataset.entryId=item.id;card.dataset.layoutKey='time:'+item.id;const info=node('div',undefined,'timesheet-info'),heading=node('div',undefined,'timesheet-heading');heading.append(user(node('strong',item.username)),badge(item.status==='open'?'Clocked in':item.status[0].toUpperCase()+item.status.slice(1),item.status==='approved'?'positive':item.status==='rejected'?'negative':item.status==='pending'?'warning':'muted'));info.append(heading,user(node('p',date(M.localParts(item.startAt).date)+' · '+time(item.startAt)+' – '+(item.endAt?time(item.endAt):'Running')+(item.endAt&&M.localParts(item.endAt).date!==M.localParts(item.startAt).date?' · '+date(M.localParts(item.endAt).date):''),'small')),user(node('small',hours(item.paidSeconds)+' paid · '+Math.round(item.breakSeconds/60)+'m unpaid break'+('costCents'in item?' · '+money(item.costCents):''))));if(item.notes)info.append(user(node('p',item.notes,'timesheet-note')));if(item.longShift)info.append(badge('Long shift — review times','warning'));const actions=node('div',undefined,'timesheet-actions');if(item.canReview){if(item.status==='pending')actions.append(button('Approve',()=>reviewEntry(item,'approve'),'rostering-primary'),button('Reject',()=>reviewDialog(item,'reject')));if(item.status!=='open'&&item.status!=='pending')actions.append(button('Reopen',()=>reviewEntry(item,'reopen')));actions.append(button('Correct',()=>timeDialog(item)));}if(item.pay&&item.canReview)actions.append(button('Pay details',()=>payDetails(item,'timesheets')));actions.append(button('History',()=>historyDialog(item)));card.append(info,actions);list.append(card);}if(!rows.length)list.append(node('p','No timesheets match this week and filter.','roster-empty'));}
 async function reviewEntry(item,action){try{const check=action==='approve'?await api('award-check?entryId='+item.id):null;await confirmAwardReview(check,async review=>{await api('timesheets/'+item.id,'PUT',{revision:item.revision,action,...review});await load();status(action==='approve'?'Timesheet approved.':'Timesheet reopened for review.',true);});}catch(error){status(error.message);}}
 function reviewDialog(item,action){const ui=makeDialog('Reject timesheet'),reason=node('textarea');reason.name='reason';reason.required=true;reason.maxLength=500;reason.rows=3;ui.form.append(field('Reason',reason));ui.save.textContent='Reject timesheet';ui.form.onsubmit=async event=>{event.preventDefault();const payload={action,revision:item.revision,reason:reason.value};ui.busy(true);try{await api('timesheets/'+item.id,'PUT',payload);ui.dialog.close();await load();}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.finish();}
 function localInput(value){const local=M.localParts(value);return local.date+'T'+local.time;}
 function timeDialog(previous){const ui=makeDialog(previous?'Correct timesheet':'Add timesheet'),member=select('userId',data.people.map(person=>[person.id,person.username]),previous?.userId||session.id),start=input('datetime-local','startAt',previous?localInput(previous.startAt):M.today()+'T09:00'),end=input('datetime-local','endAt',previous?.endAt?localInput(previous.endAt):M.today()+'T17:00'),breaks=input('number','breakMinutes',previous?Math.round(previous.breakSeconds/60):0),reason=node('textarea'),fields=node('div',undefined,'roster-dialog-grid');for(const value of [start,end,breaks])value.required=true;breaks.min='0';breaks.step='1';reason.name='reason';reason.required=true;reason.maxLength=500;reason.rows=2;member.disabled=Boolean(previous)||!can('rostering.approve');if(!previous)fields.append(field('User',member));fields.append(field('Clock in (Melbourne time)',start),field('Clock out (Melbourne time)',end),field('Unpaid break (minutes)',breaks));ui.form.append(fields,field(previous?'Reason for correction':'Reason for manual timesheet',reason));ui.save.textContent=previous?'Save correction':'Submit for approval';const reference=uid();ui.form.onsubmit=async event=>{event.preventDefault();let payload;try{payload={userId:member.value,startAt:M.instant(start.value.slice(0,10),start.value.slice(11,16)),endAt:M.instant(end.value.slice(0,10),end.value.slice(11,16)),breakMinutes:Number(breaks.value),reason:reason.value,requestId:reference,...(previous?{action:'correct',revision:previous.revision}:{})};}catch(error){ui.error.textContent=error.message;return;}ui.busy(true);try{await api(previous?'timesheets/'+previous.id:'manual-time',previous?'PUT':'POST',payload);ui.dialog.close();await load();status(previous?'Correction saved. The timesheet needs approval.':'Timesheet submitted for approval.',true);}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.finish();}
 function historyDialog(item){const ui=makeDialog('Timesheet history');ui.save.remove();ui.cancel.textContent='Close';const list=node('div',undefined,'timesheet-history');for(const event of item.audit){const row=node('article');row.append(user(node('strong',event.action.replaceAll('-',' ')+' · '+event.by)),user(node('small',date(M.localParts(event.at).date)+' '+time(event.at))));if(event.reason)row.append(user(node('p',event.reason)));if(event.awardReview)row.append(user(node('p','Award review: '+event.awardReview.note+' · Rule versions: '+(event.awardReview.versionIds.join(', ')||'No reviewed rule version'),'small')));if(event.before&&event.after)row.append(user(node('p','Before: '+time(event.before.startAt)+' – '+(event.before.endAt?time(event.before.endAt):'Running')+' · '+event.before.status+'\nAfter: '+time(event.after.startAt)+' – '+(event.after.endAt?time(event.after.endAt):'Running')+' · '+event.after.status,'small')));list.append(row);}ui.form.append(list);ui.finish();}
 function availabilityRecord(){const kind=$('availability-kind').value;return kind==='school-holiday'?data.availability.holidays.find(item=>item.id===$('availability-holiday-id').value)||{revision:0,days:data.availability.effective.days,notes:''}:data.availability[kind==='week'?'week':'recurring'];}
 function renderAvailability(){
  const kind=$('availability-kind').value,holiday=kind==='school-holiday',picker=$('availability-holiday-id'),selected=picker.value;
  picker.replaceChildren(new Option('New school-holiday schedule',''));for(const record of data.availability.holidays.filter(item=>!item.removed))picker.append(new Option(date(record.startDate)+' – '+date(record.endDate),record.id));picker.value=[...picker.options].some(option=>option.value===selected)?selected:'';
  const record=availabilityRecord(),source=kind==='week'&&(!record.revision||record.removed)?data.availability.recurringForWeek:record,days=$('availability-days');days.replaceChildren();
  for(let index=0;index<7;index++){const value=source.days[index],card=node('div',undefined,'availability-day'),day=select('status',[['','Not entered'],['available','Available all day'],['unavailable','Unavailable'],['window','Available between']],value?.status||''),start=input('time','start',value?.start||'09:00'),end=input('time','end',value?.end||'17:00'),overnight=input('checkbox','overnight'),window=node('div',undefined,'availability-window'),editor=node('div',undefined,'availability-day-editor');card.dataset.dayIndex=index;overnight.checked=value?.overnight||false;card.append(node('strong',dayNames[index]));if(kind==='week')card.append(user(node('small',date(M.shiftDate(week,index)))));day.setAttribute('aria-label',dayNames[index]+' availability');editor.append(day);window.append(field('From',start),field('To',end),field('Ends next day',overnight));const update=()=>window.hidden=day.value!=='window';day.onchange=update;update();editor.append(window);card.append(editor);days.append(card);}
  const earliest=data.availability.earliestDate,eligible=holiday||kind==='recurring'||week>=earliest,editable=can('rostering.availability');
  $('availability-effective-field').hidden=kind!=='recurring';$('availability-effective').disabled=kind!=='recurring'||!editable;$('availability-effective').min=earliest;$('availability-effective').value=record.effectiveFrom&&record.effectiveFrom>=earliest?record.effectiveFrom:earliest;
  $('availability-holiday-fields').hidden=!holiday;$('availability-holiday-start').value=record.startDate||data.today;$('availability-holiday-end').value=record.endDate||M.shiftDate(data.today,13);
  for(const id of ['availability-holiday-start','availability-holiday-end']){$(id).required=holiday;$(id).disabled=!holiday||!editable;}
  $('availability-holiday-id').disabled=!holiday||!editable;$('availability-notes').value=source.notes||'';$('availability-reset').hidden=kind==='recurring'||!record.revision||record.removed;$('availability-reset').textContent=holiday?'Remove holiday schedule':'Use recurring for this week';
  $('availability-notice').textContent=holiday?'No notice period. This schedule takes priority over recurring and weekly availability from the first day through the last day.':eligible?'Regular changes take effect from '+date(earliest)+' or later (14 days’ notice).':'This week is within the 14-day notice period. Choose a later week to change regular availability.';
  $('availability-next-week').hidden=eligible;const scheduled=kind==='recurring'&&record.effectiveFrom>data.today;
  $('availability-saved').textContent=record.updatedAt?(scheduled?'Scheduled from '+date(record.effectiveFrom)+' · ':'')+'Saved '+date(M.localParts(record.updatedAt).date):kind==='week'?'Using recurring availability until you save a weekly override.':'No schedule saved yet.';
  for(const control of days.querySelectorAll('input,select'))control.disabled=!editable||!eligible;$('availability-save').disabled=!editable||!eligible;$('availability-reset').disabled=!editable||!eligible;$('availability-notes').disabled=!editable||!eligible;$('availability-fill').disabled=!editable||!eligible;
  window.locationPickers?.refresh(picker);
  const team=$('team-availability');team.replaceChildren();if(can('rostering.manage'))for(const person of data.teamAvailability){const row=node('article',undefined,'team-availability-person');row.append(user(node('strong',person.username)));const entries=node('div');for(let index=0;index<7;index++){const day=person.days[index],value=day?day.status==='available'?'All day':day.status==='unavailable'?'Unavailable':day.start+'–'+day.end+(day.overnight?' +1':''):'Not entered',cell=node('div');cell.append(node('small',dayNames[index].slice(0,3)),user(node('span',value)));if(person.sources?.[index]?.kind==='school-holiday')cell.append(node('small','School holidays'));for(const leave of person.leaveDays?.[index]||[])cell.append(user(node('small',leave.allDay?'Unavailable': 'Unavailable '+time(leave.startAt)+' – '+time(leave.endAt),'leave-conflict')));entries.append(cell);}row.append(entries);if(person.notes)row.append(user(node('p',person.notes,'small')));team.append(row);}
 }
 async function saveAvailability(event){
  event.preventDefault();const kind=$('availability-kind').value,record=availabilityRecord(),days=[...$('availability-days').children].map(card=>{const selected=card.querySelector('[name=status]').value;return !selected?null:selected==='window'?{status:selected,start:card.querySelector('[name=start]').value,end:card.querySelector('[name=end]').value,overnight:card.querySelector('[name=overnight]').checked}:{status:selected};}),payload={kind,weekStart:week,revision:record.revision,days,notes:$('availability-notes').value,...(kind==='recurring'?{effectiveFrom:$('availability-effective').value}:kind==='school-holiday'?{id:record.id,startDate:$('availability-holiday-start').value,endDate:$('availability-holiday-end').value}:{})};
  $('availability-save').disabled=true;try{const saved=await api('availability','PUT',payload);if(kind==='school-holiday'){$('availability-holiday-id').append(new Option('',saved.id));$('availability-holiday-id').value=saved.id;}await load();status('Availability saved.',true);}catch(error){status(error.message);$('availability-save').disabled=false;}
 }
 const leaveStatus=value=>({'pending':'Pending review','approved':'Approved','rejected':'Declined','withdrawn':'Withdrawn','cancellation-requested':'Cancellation requested','cancelled':'Cancelled'}[value]||value);
 const leaveDates=item=>date(item.startDate)+(item.endDate!==item.startDate?' – '+date(item.endDate):'')+(item.allDay?' · All day':' · '+item.startTime+' – '+item.endTime);
 let leaveScopeInitialized=false;
 function renderLeave(){
  const manager=data.leave.canApprove,owner=$('leave-owner-filter');if(!leaveScopeInitialized){owner.value=manager?'all':'mine';leaveScopeInitialized=true;}owner.querySelector('[value=team]').hidden=!manager;owner.querySelector('[value=all]').hidden=!manager;if(!manager)owner.value='mine';window.locationPickers?.refresh(owner);
  const host=$('leave-requests'),filter=$('leave-status-filter').value;host.replaceChildren();const matchesStatus=item=>filter==='all'||filter==='active'&&(['pending','cancellation-requested'].includes(item.status)||item.status==='approved'&&item.endDate>=data.today)||filter==='approved'&&['approved','cancellation-requested'].includes(item.status)||filter==='pending'&&['pending','cancellation-requested'].includes(item.status);const records=data.leave.requests.filter(item=>(owner.value==='all'||(owner.value==='team'?item.userId!==session.id:item.userId===session.id))&&matchesStatus(item));
  for(const item of records){const card=node('article',undefined,'leave-request-card'),copy=node('div',undefined,'leave-request-copy'),heading=node('div',undefined,'leave-request-heading');heading.append(user(node('strong',item.typeName)),badge(leaveStatus(item.status),'leave-'+item.status));copy.append(heading,user(node('p',item.username+' · '+leaveDates(item),'small')));if(item.shortNotice)copy.append(user(node('p','Short notice · '+item.noticeReason,'small')));if(item.notes)copy.append(user(node('p',item.notes,'leave-note')));const last=item.audit?.at(-1);if(last?.reason)copy.append(user(node('p',last.reason,'small')));if(item.conflictingShifts)copy.append(node('p',item.conflictingShifts+' rostered shifts overlap. Move or reassign them before publishing.','leave-conflict'));
   const actions=node('div',undefined,'leave-request-actions');if(item.userId===session.id&&can('rostering.leave')){if(['pending','rejected'].includes(item.status))actions.append(button('Withdraw',()=>leaveAction(item,'withdraw')));if(item.status==='approved')actions.append(button('Request cancellation',()=>leaveAction(item,'request-cancellation')));}
   if(item.canReview){if(item.status==='pending')actions.append(button('Approve',()=>leaveAction(item,'approve'),'rostering-primary'),button('Decline',()=>leaveAction(item,'reject')));if(item.status==='cancellation-requested')actions.append(button('Approve cancellation',()=>leaveAction(item,'cancel')),button('Keep approved',()=>leaveAction(item,'keep-approved')));else if(item.status==='approved')actions.append(button('Cancel leave',()=>leaveAction(item,'cancel')));}
   card.append(copy,actions);host.append(card);
  }
  if(!records.length)host.append(node('p','No leave requests match these filters.','roster-empty'));
 }
 function requestLeave(){
  const ui=makeDialog('Request leave'),type=select('leaveType',data.leave.types.map(item=>[item.id,item.name]),'annual'),start=input('date','leaveStart',week>data.leave.earliestDate?week:data.leave.earliestDate),end=input('date','leaveEnd',start.value),allDay=input('checkbox','allDay'),startTime=input('time','leaveStartTime','09:00'),endTime=input('time','leaveEndTime','17:00'),notes=node('textarea'),shortNotice=input('checkbox','shortNotice'),noticeReason=node('textarea'),exception=node('div',undefined,'leave-notice-exception'),help=node('p',undefined,'roster-help'),grid=node('div',undefined,'roster-dialog-grid'),times=node('div',undefined,'roster-dialog-grid');start.required=end.required=true;allDay.checked=true;notes.maxLength=1000;notes.rows=3;noticeReason.name='noticeReason';noticeReason.maxLength=500;noticeReason.rows=2;exception.append(field('Unexpected statutory absence — short notice',shortNotice),field('Why 14 days’ notice was not possible',noticeReason));grid.append(field('First day',start),field('Last day',end));times.append(field('From',startTime),field('To',endTime));const update=()=>{const entry=data.leave.types.find(item=>item.id===type.value);times.hidden=allDay.checked;startTime.required=endTime.required=!allDay.checked;exception.hidden=!entry.shortNotice;noticeReason.parentElement.hidden=!shortNotice.checked;noticeReason.required=entry.shortNotice&&shortNotice.checked;start.min=entry.shortNotice&&shortNotice.checked?'':data.leave.earliestDate;help.textContent=entry.help+' Planned leave needs 14 days’ notice.';};type.onchange=()=>{shortNotice.checked=false;update();};allDay.onchange=shortNotice.onchange=update;start.onchange=()=>{if(end.value<start.value)end.value=start.value;};update();ui.form.append(field('Leave type',type),help,exception,grid,field('All day',allDay),times,field('Notes (optional)',notes));ui.save.textContent='Submit request';
  ui.form.onsubmit=async event=>{event.preventDefault();ui.busy(true);try{await api('leave','POST',{type:type.value,startDate:start.value,endDate:end.value,allDay:allDay.checked,startTime:startTime.value,endTime:endTime.value,shortNotice:shortNotice.checked,noticeReason:noticeReason.value,notes:notes.value});ui.dialog.close();await load();status('Leave submitted for review.',true);}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.finish();
 }
 function leaveAction(item,action){
  const titles={approve:'Approve leave',reject:'Decline leave',withdraw:'Withdraw request','request-cancellation':'Request cancellation',cancel:'Cancel approved leave','keep-approved':'Decline cancellation'},ui=makeDialog(titles[action]),reason=node('textarea');reason.rows=2;reason.maxLength=500;reason.required=['reject','cancel','keep-approved'].includes(action);ui.form.append(user(node('p',item.username+' · '+item.typeName+' · '+leaveDates(item),'small')),field(reason.required?'Reason':'Comment (optional)',reason));ui.save.textContent=titles[action];ui.form.onsubmit=async event=>{event.preventDefault();ui.busy(true);try{await api('leave/'+item.id,'PUT',{action,revision:item.revision,reason:reason.value});ui.dialog.close();await load();status('Leave request updated.',true);}catch(error){ui.error.textContent=error.message;ui.busy(false);}};ui.finish();
 }
 let ratesWeek='',positionSettingsRevision=null,positionSettingsKey='',positionSettingsBaseline='';
 function positionSettingsValues(){return [...$('roster-position-list').children].filter(row=>row.matches('.roster-position-editor')).map(row=>({id:row.dataset.positionId,name:row.querySelector('[name=positionName]').value.trim(),color:row.querySelector('[name=positionColor]').value.trim()||null}));}
 function positionSettingsSignature(positions){return JSON.stringify(positions.map(({id,name,color})=>({id,name,color:color?.toLowerCase()||null})).sort((a,b)=>a.id.localeCompare(b.id)));}
 function positionEditor(position){
  const row=node('article',undefined,'roster-position-editor'),name=input('text','positionName',position.name),picker=input('color','positionColorPicker',position.color||getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim()||'#e27925'),hex=input('text','positionColor',position.color||''),colour=node('div',undefined,'roster-position-colour'),preview=node('div',undefined,'roster-position-preview'),code=node('span','','roster-position-static'),example=node('div'),times=node('div',undefined,'roster-position-preview-times'),caption=user(node('strong',position.name||'Position')),reset=button('↺',()=>{hex.value='';update();hex.dispatchEvent(new Event('input',{bubbles:true}));}),remove=button('',()=>row.remove(),'roster-position-remove');
  row.dataset.positionId=position.id;name.maxLength=80;name.required=true;name.autocomplete='off';hex.maxLength=7;hex.pattern='#[a-fA-F0-9]{6}';hex.placeholder='App colour';hex.autocomplete='off';picker.setAttribute('aria-label','Choose position colour');hex.setAttribute('aria-label','Position colour hex code');reset.setAttribute('aria-label','Use app colour');reset.title='Use app colour';remove.setAttribute('aria-label','Remove position');remove.title=position.used?'Used by rostered shifts — rename it or change its colour':'Remove position';remove.disabled=position.used;
  remove.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15"/><path class="icon-detail" d="M10 10v7M14 10v7"/></svg>';
  times.append(node('span','9:00a'),node('span','5:00p'));example.append(times,caption);preview.append(code,example);colour.append(picker,hex,reset);row.append(field('Position name',name),field('Shift colour',colour),preview,remove);
  function update(){const value=hex.value.trim();hex.setCustomValidity(value&&!/^#[a-f0-9]{6}$/i.test(value)?'Enter a colour such as #0d74c0, or leave it blank.':'');positionColour(row,name.value,value);if(/^#[a-f0-9]{6}$/i.test(value))picker.value=value;else if(!value)picker.value=getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim()||'#e27925';caption.textContent=name.value||'Position';code.textContent=name.value.trim().split(/\s+/).filter(Boolean).map(word=>word[0]).join('').slice(0,2).toUpperCase()||'–';}
  picker.oninput=()=>{hex.value=picker.value;update();hex.dispatchEvent(new Event('input',{bubbles:true}));};hex.oninput=name.oninput=update;update();return row;
 }
 function renderPositionSettings(){
  const host=$('roster-position-list'),settings=data.positionSettings,key=JSON.stringify(settings);
  if(!settings){host.replaceChildren();positionSettingsRevision=null;positionSettingsKey='';positionSettingsBaseline='';$('roster-position-add').disabled=$('roster-position-save').disabled=true;return;}
  // Refresh saved settings without replacing a new card, draft edits, or the active colour/name field.
  if(key===positionSettingsKey||positionSettingsRevision!==null&&(host.contains(document.activeElement)||positionSettingsSignature(positionSettingsValues())!==positionSettingsBaseline))return;
  positionSettingsKey=key;positionSettingsRevision=settings.revision;positionSettingsBaseline=positionSettingsSignature(settings.positions);
  $('roster-position-add').disabled=$('roster-position-save').disabled=false;
  host.replaceChildren();for(const position of settings.positions)host.append(positionEditor(position));
 }
 function renderSettings(){renderPositionSettings();const summary=data.summary;if(!summary)return;$('roster-rates-settings').hidden=summary.nativePay;const inheritance=$('budget-inheritance');inheritance.replaceChildren();for(const item of summary.budgets){const card=node('article',undefined,'budget-scope-card'+(summary.effectiveBudget?.scope===item.scope?' active':''));card.append(node('strong',item.scope[0].toUpperCase()+item.scope.slice(1)),user(node('span',item.mode?(item.mode==='percent'?(item.value/100).toFixed(2)+'% of forecast':money(item.value)+' / week'):'No override')));inheritance.append(card);}const editable=summary.budgets.filter(item=>item.canEdit),scope=$('budget-scope'),previous=scope.value;scope.replaceChildren();for(const item of editable){const option=node('option',item.scope[0].toUpperCase()+item.scope.slice(1));option.value=item.scope;scope.append(option);}scope.value=editable.some(item=>item.scope===previous)?previous:editable.some(item=>item.scope==='location')?'location':editable[0]?.scope||'';$('budget-form').hidden=!editable.length;$('budget-form').closest('.roster-settings-card').querySelector('.roster-form-actions').hidden=!editable.length;renderBudgetForm();if(data.rates){if(ratesWeek!==week||!$('rates-date').value){$('rates-date').value=week;ratesWeek=week;}renderRates();}}
 function renderBudgetForm(){const item=data.summary?.budgets.find(item=>item.scope===$('budget-scope').value);if(!item)return;$('budget-mode').value=item.mode||'percent';$('budget-value').value=item.mode?(item.value/100).toFixed(2):'';$('budget-inherit').hidden=!item.mode;$('budget-inherit').textContent=item.scope==='network'?'Clear network default':'Use inherited budget';updateBudgetMode();window.locationPickers?.refresh($('budget-scope'));window.locationPickers?.refresh($('budget-mode'));}
 function updateBudgetMode(){const percent=$('budget-mode').value==='percent';$('budget-prefix').textContent=percent?'%':'$';$('budget-value').max=percent?'100':'100000000';}
 function renderRates(){const date=$('rates-date').value,host=$('rate-people');host.replaceChildren();for(const person of data.rates?.people||[]){const current=data.rates.records.filter(item=>item.userId===person.id&&item.effectiveDate<=date).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0],row=node('label',undefined,'rate-person'),wrap=node('div',undefined,'roster-money-field'),amount=input('number','rate',current?(current.rateCents/100).toFixed(2):'');amount.dataset.userId=person.id;amount.min='0';amount.max='100000';amount.step='0.01';amount.placeholder='Set rate';amount.setAttribute('aria-label',person.username+' hourly rate');row.append(user(node('span',person.username)));wrap.append(node('span','$'),amount);row.append(wrap);host.append(row);}}
 function cents(value){if(!/^\d+(?:\.\d{1,2})?$/.test(value))throw Error('Enter a non-negative amount with up to two decimal places.');const amount=Math.round(Number(value)*100);if(!Number.isSafeInteger(amount))throw Error('Enter a valid amount.');return amount;}
 async function saveBudget(event){event.preventDefault();const item=data.summary.budgets.find(item=>item.scope===$('budget-scope').value);try{const payload={scope:item.scope,revision:item.revision,mode:$('budget-mode').value,value:cents($('budget-value').value)};await formAction($('budget-form'),()=>api('budget','PUT',payload),'Labour budget saved.');}catch(error){status(error.message);}}
 async function formAction(form,action,message){const controls=[...form.elements].filter(control=>control.matches('input,select,textarea,button'));for(const control of controls)control.disabled=true;try{await action();await load();status(message,true);}catch(error){status(error.message);}finally{for(const control of controls)if(control.isConnected)control.disabled=false;}}
 function exportTimesheets(){const headers=['User','Location','Clock in','Clock out','Unpaid break (minutes)','Paid hours','Status',...(data.timesheets.some(item=>'costCents'in item)?['Estimated cost']:[])],rows=data.timesheets.map(item=>[item.username,item.locationName,localInput(item.startAt),item.endAt?localInput(item.endAt):'',(item.breakSeconds/60).toFixed(2),(item.paidSeconds/3600).toFixed(2),item.status,...(headers.includes('Estimated cost')?[item.costCents===null||item.costCents===undefined?'':(item.costCents/100).toFixed(2)]:[])]),escape=value=>'"'+String(/^[=+\-@\t\r]/.test(String(value))?"'"+value:value).replaceAll('"','""')+'"',content=[headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob(['\uFEFF'+content],{type:'text/csv;charset=utf-8'})),link=node('a');link.href=url;link.download='timesheets-'+week+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function selectWeek(value){if(!await flushRosterEdits()){$('roster-week').value=week;return;}try{week=M.monday(value);$('roster-week').value=week;load();}catch(error){status(error.message);}}
 $('roster-previous').onclick=()=>selectWeek(M.shiftDate(week,-7));$('roster-next').onclick=()=>selectWeek(M.shiftDate(week,7));$('roster-this-week').onclick=()=>selectWeek(M.today());$('roster-week').onchange=event=>selectWeek(event.target.value);$('roster-refresh').onclick=async()=>{if(await flushRosterEdits())load();};$('roster-view').onchange=event=>changeRosterView(event.target.value);$('roster-day').onchange=event=>selectRosterDay(event.target.value);$('roster-copy').onclick=()=>rosterAction('copy-previous');$('roster-publish').onclick=()=>rosterAction('publish');$('timesheet-filter').onchange=renderTimesheets;$('timesheet-manual').onclick=()=>timeDialog();$('timesheet-export').onclick=exportTimesheets;
 $('availability-kind').onchange=renderAvailability;$('availability-holiday-id').onchange=renderAvailability;$('availability-form').onsubmit=saveAvailability;
 $('availability-next-week').onclick=()=>{const earliest=data.availability.earliestDate,monday=M.monday(earliest);selectWeek(monday<earliest?M.shiftDate(monday,7):monday);};
 $('availability-fill').onclick=()=>{for(const card of $('availability-days').children){const select=card.querySelector('[name=status]');select.value='available';select.dispatchEvent(new Event('change',{bubbles:true}));}};
 $('availability-reset').onclick=()=>{const kind=$('availability-kind').value,record=availabilityRecord();formAction($('availability-form'),()=>api('availability','DELETE',{kind,id:record.id,weekStart:week,revision:record.revision}),'Availability override removed.');};
 $('leave-request').onclick=requestLeave;$('leave-owner-filter').onchange=$('leave-status-filter').onchange=renderLeave;
 $('roster-position-add').onclick=()=>{const row=positionEditor({id:uid(),name:'',color:null,used:false});$('roster-position-list').append(row);row.querySelector('[name=positionName]').focus();};
 $('positions-form').onsubmit=event=>{event.preventDefault();const payload={revision:positionSettingsRevision,positions:positionSettingsValues()};formAction($('positions-form'),async()=>{await api('positions','PUT',payload);positionSettingsRevision=null;positionSettingsKey='';},'Positions saved.');};
 $('budget-scope').onchange=renderBudgetForm;$('budget-mode').onchange=updateBudgetMode;$('budget-form').onsubmit=saveBudget;$('budget-inherit').onclick=()=>{const item=data.summary.budgets.find(item=>item.scope===$('budget-scope').value);formAction($('budget-form'),()=>api('budget','DELETE',{scope:item.scope,revision:item.revision}),'Budget override removed.');};$('rates-date').onchange=renderRates;$('rates-form').onsubmit=event=>{event.preventDefault();try{const payload={effectiveDate:$('rates-date').value,revision:data.rates.revision,rates:[...$('rate-people').querySelectorAll('input')].map(input=>({userId:input.dataset.userId,rateCents:input.value===''?null:cents(input.value)}))};formAction($('rates-form'),()=>api('rates','PUT',payload),'Hourly rates saved.');}catch(error){status(error.message);}};
 $('phone-roster-close').onclick=$('phone-roster-handle').onclick=dismissPhoneRoster;
 $('phone-roster').addEventListener('cancel',event=>{event.preventDefault();dismissPhoneRoster();});
 let phoneBackdropPress=false;
 $('phone-roster').addEventListener('pointerdown',event=>{const rect=event.currentTarget.getBoundingClientRect();phoneBackdropPress=event.target===event.currentTarget&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);});
 $('phone-roster').addEventListener('click',event=>{if(phoneBackdropPress&&event.target===event.currentTarget)dismissPhoneRoster();phoneBackdropPress=false;});
 let phoneSheetDrag=null;
 $('phone-roster-handle').addEventListener('pointerdown',event=>{if(!event.isPrimary||event.button!==0)return;phoneSheetDrag={id:event.pointerId,y:event.clientY};event.currentTarget.setPointerCapture(event.pointerId);});
 $('phone-roster-handle').addEventListener('pointermove',event=>{if(phoneSheetDrag?.id===event.pointerId&&event.clientY-phoneSheetDrag.y>60){phoneSheetDrag=null;dismissPhoneRoster();}});
 $('phone-roster-handle').addEventListener('pointerup',()=>{phoneSheetDrag=null;});$('phone-roster-handle').addEventListener('pointercancel',()=>{phoneSheetDrag=null;});
 $('phone-roster-mine').onclick=$('phone-roster-team').onclick=event=>{phoneRosterScope=event.currentTarget.id.endsWith('mine')?'mine':'team';renderPhoneRoster();};
 $('phone-roster-previous').onclick=()=>selectPhoneRosterDate(M.shiftDate(section!=='roster'||phoneRosterScope==='mine'?week:phoneRosterDay,section!=='roster'||phoneRosterScope==='mine'?-7:-1));
 $('phone-roster-next').onclick=()=>selectPhoneRosterDate(M.shiftDate(section!=='roster'||phoneRosterScope==='mine'?week:phoneRosterDay,section!=='roster'||phoneRosterScope==='mine'?7:1));
 $('phone-roster-date').onchange=event=>selectPhoneRosterDate(event.target.value);
 phoneViewport.addEventListener('change',async()=>{if(!session)return;await flushRosterEdits();placePhonePanels();renderSidebar();if(phoneViewport.matches&&section==='settings')showPhoneSection('roster');else{syncPhoneRosterMode();if(data)renderSection();}});
 window.addEventListener('storage',event=>{if(session&&['opstack-hourly-sales-'+session.dataScope,'souvlaki-sales-updated-'+(session.dataScope||session.id),'souvlaki-weekly-report-updated-'+session.dataScope].includes(event.key)&&!rosterInteractionActive()&&section==='roster')load(false,true);});
 window.addEventListener('hashchange',view);window.addEventListener('required-reading-changed',event=>{const restored=requiredReadingWasBlocked&&!event.detail.blocked;requiredReadingWasBlocked=event.detail.blocked;syncPhoneRosterMode();if(restored&&session){if(section)load(false,true);else view();}});window.addEventListener('shift-clock-updated',()=>{if(session&&section==='timesheets')load(false,true);});window.addEventListener('focus',()=>{if(session&&!rosterSaving&&!rosterInteractionActive()&&['roster','timesheets'].includes(section))load(false,true);});$('logout').onclick=async()=>{if(!await flushRosterEdits())return;const response=await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':session?.csrf||''}});if(response.ok)location.href=companyLoginUrl();};
 (async()=>{try{const response=await fetch('/api/session');session=await response.json();if(!session.csrf){location.href=companyLoginUrl();return;}appAccess.apply(session);$('rostering-location').textContent=session.locationName+' · '+session.companyName;try{const saved=localStorage.getItem('opstack-roster-view:'+session.id+':'+session.companyId);if(['staff','stacked','day'].includes(saved))rosterView=saved;}catch{}renderSidebar();await appRequiredReading.ready;requiredReadingWasBlocked=appRequiredReading.blocked;view();}catch(error){status(error.message);}})();
})();
