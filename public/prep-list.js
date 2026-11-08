// Labels → Prep list: today's prep items for the selected location, grouped by station. Staff tick items off
// (recording who and when) and can print food labels for items linked to a label template. Managers add and
// edit items in a popup. Browsing dates and opening the editor never write.
(()=>{
 const $=id=>document.getElementById(id),panel=$('prep-list');if(!panel)return;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
 const ui=(tag,text,cls,values)=>{const node=el(tag,word(text,values),cls);window.appWording?.label(node,text,values);return node;};
 const data=(tag,text,cls)=>{const node=el(tag,text,cls);node.dataset.userText='';return node;};
 const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const amount=value=>Number(value).toLocaleString('en-AU',{maximumFractionDigits:3});
 const longDate=value=>new Intl.DateTimeFormat('en-AU',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const time=value=>new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(new Date(value));
 const shift=(date,by)=>new Date(Date.parse(date+'T12:00:00Z')+by*86400000).toISOString().slice(0,10);
 let actor=null,state=null,date=null,loading=false,generation=0,pending=new Set();
 async function api(route='',method='GET',body){const response=await fetch('/api/prep-list'+route,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':actor?.csrf||'',...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json().catch(()=>({}));if(!response.ok){if(response.status===428)window.appRequiredReading?.check?.();throw Object.assign(Error(value.error||word('Unable to load the prep list.')),{status:response.status});}return value;}
 // Static frame.
 const head=el('header',undefined,'prep-head'),titles=el('div'),title=ui('h2','Prep list'),subtitle=data('p','','prep-date-label'),controls=el('div',undefined,'prep-controls');
 const previous=el('button','‹','prep-nav'),next=el('button','›','prep-nav'),todayButton=ui('button','Today','prep-today'),manage=ui('button','Manage items','prep-manage');
 previous.type=next.type=todayButton.type=manage.type='button';previous.setAttribute('aria-label',word('Previous day'));next.setAttribute('aria-label',word('Next day'));title.dataset.featureHelp='print-labels';
 titles.append(title,subtitle);controls.append(previous,todayButton,next,manage);head.append(titles,controls);
 const progress=el('div',undefined,'prep-progress'),ring=el('div',undefined,'prep-ring'),progressText=el('div',undefined,'prep-progress-text'),count=data('strong',''),note=el('span','','prep-progress-note');
 ring.setAttribute('aria-hidden','true');progressText.append(count,note);progress.append(ring,progressText);
 const status=el('p','','prep-status');status.setAttribute('role','status');const list=el('div',undefined,'prep-groups');
 panel.append(head,progress,status,list);
 function render(){
  if(!state)return;subtitle.textContent=longDate(state.date)+(state.date===state.today?' · '+word('Today'):'');todayButton.disabled=state.date===state.today;next.disabled=state.date>=shift(state.today,7);previous.disabled=state.date<=shift(state.today,-90);manage.hidden=!state.canManage;
  const total=state.rows.length,done=state.rows.filter(row=>row.done).length,percent=total?Math.round(done/total*100):0;
  ring.style.setProperty('--prep-progress',percent+'%');ring.textContent=total?percent+'%':'';count.textContent=total?word('{done} of {total} done',{done,total}):word('Nothing to prep');
  note.textContent=!total?(state.canManage?word('Add prep items with Manage items.'):word('No prep items are scheduled for this day.')):state.canTick?(done===total?word('All prep is done for today.'):word('Tick items off as you finish them.')):word('Past and future days are read-only.');
  const groups=new Map();for(const row of state.rows){const key=row.station||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}
  list.replaceChildren(...[...groups].map(([station,rows])=>{const group=el('section',undefined,'prep-group'),heading=station?data('h3',station):ui('h3','Other items'),left=rows.filter(row=>!row.done).length,badge=el('span',left?word('{count} to go',{count:left}):word('Done'),'prep-group-count'+(left?'':' is-done'));heading.append(badge);group.append(heading,...rows.map(item));return group;}));
 }
 function item(row){
  const card=el('article',undefined,'prep-item'+(row.done?' is-done':'')),check=el('button',undefined,'prep-check'),body=el('div',undefined,'prep-item-body'),name=data('strong',row.name,'prep-item-name'),qty=data('span',amount(row.amount)+(row.unit?' '+row.unit:''),'prep-item-amount');
  check.type='button';check.setAttribute('aria-pressed',String(row.done));check.setAttribute('aria-label',(row.done?word('Mark not done: '):word('Mark done: '))+row.name);check.disabled=!state.canTick||row.removed||pending.has(row.id);
  check.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  check.onclick=()=>toggle(row);
  const top=el('div',undefined,'prep-item-top');top.append(name,qty);body.append(top);
  if(row.notes)body.append(data('p',row.notes,'prep-item-notes'));
  if(row.done&&row.doneBy)body.append(data('p',word('Done by {name} at {time}',{name:row.doneBy.name||word('someone'),time:time(row.doneAt)}),'prep-item-meta'));
  if(row.removed)body.append(ui('p','Removed from the list since it was ticked.','prep-item-meta'));
  card.append(check,body);
  if(row.label&&state.canPrint){const print=el('a',undefined,'prep-print');print.href='/labels?print='+encodeURIComponent(row.label.id)+'#print';print.append(ui('span',row.done?'Print labels':'Labels'));print.title=word('Print labels with {template}',{template:row.label.name});print.onclick=event=>{if(window.labelsPrint?.(row.label.id)){event.preventDefault();}};card.append(print);}
  return card;
 }
 async function toggle(row){
  if(!state?.canTick||pending.has(row.id))return;pending.add(row.id);render();status.textContent='';
  try{const result=await api('/tick','POST',{date:state.date,itemId:row.id,done:!row.done,revision:row.tickRevision});Object.assign(row,{done:result.done,doneAt:result.doneAt,doneBy:result.doneBy,tickRevision:result.tickRevision});
   if(result.done&&row.label&&state.canPrint)status.textContent=word('{name} done. Use Print labels to print food labels for it.',{name:row.name});}
  catch(error){status.textContent=error.message;if(error.status===409)await load();}
  finally{pending.delete(row.id);render();}
 }
 async function load(){
  if(!actor||loading)return;const version=++generation;loading=true;status.textContent=word('Loading prep list…');
  try{const value=await api(date?'?date='+date:'');if(version!==generation)return;state=value;date=value.date;status.textContent='';render();}
  catch(error){if(version===generation)status.textContent=error.message;}
  finally{if(version===generation)loading=false;}
 }
 previous.onclick=()=>{if(state){date=shift(state.date,-1);load();}};next.onclick=()=>{if(state){date=shift(state.date,1);load();}};todayButton.onclick=()=>{date=null;load();};
 // Manage items popup.
 const dialog=el('dialog',undefined,'prep-dialog');dialog.setAttribute('aria-labelledby','prep-dialog-title');dialog.dataset.layoutUi='';document.body.append(dialog);
 const form=el('form'),dialogHead=el('header',undefined,'prep-dialog-head'),dialogTitle=ui('h2','Prep items'),close=el('button','×','prep-close');dialogTitle.id='prep-dialog-title';close.type='button';close.setAttribute('aria-label',word('Close prep items'));dialogHead.append(dialogTitle,close);
 const dialogBody=el('div',undefined,'prep-dialog-body'),itemList=el('div',undefined,'prep-manage-list'),editor=el('div',undefined,'prep-editor'),foot=el('footer',undefined,'prep-dialog-foot'),formStatus=el('p','','prep-form-status');formStatus.setAttribute('role','status');
 const field=(label,control)=>{const wrap=el('label',undefined,'prep-field');wrap.append(ui('span',label,'prep-field-name'),control);return wrap;};
 const nameInput=el('input'),amountInput=el('input'),unitInput=el('input'),stationInput=el('input'),stationList=el('datalist'),labelSelect=el('select'),notesInput=el('textarea'),activeInput=el('input');
 nameInput.maxLength=80;nameInput.required=true;nameInput.placeholder=word('e.g. Tzatziki');amountInput.type='number';amountInput.min='0.001';amountInput.step='0.001';amountInput.required=true;amountInput.inputMode='decimal';unitInput.maxLength=30;unitInput.placeholder=word('e.g. litres, trays');stationInput.maxLength=60;stationInput.placeholder=word('e.g. Grill, Cold prep');stationList.id='prep-stations';stationInput.setAttribute('list','prep-stations');notesInput.maxLength=300;notesInput.rows=2;activeInput.type='checkbox';
 const dayGroup=el('fieldset',undefined,'prep-days'),dayLegend=ui('legend','Days');dayGroup.append(dayLegend);const dayInputs=days.map((name,index)=>{const label=el('label',undefined,'prep-day'),input=el('input');input.type='checkbox';input.value=String(index+1);label.append(input,ui('span',name));dayGroup.append(label);return input;});
 const activeLabel=el('label',undefined,'prep-active');activeLabel.append(activeInput,ui('span','On the prep list'));
 const editorTitle=ui('h3','Add a prep item'),editorRow1=el('div',undefined,'prep-row'),editorRow2=el('div',undefined,'prep-row');
 editorRow1.append(field('Amount each day',amountInput),field('Unit',unitInput));editorRow2.append(field('Station',stationInput),field('Label template',labelSelect));
 const editorActions=el('div',undefined,'prep-editor-actions'),save=ui('button','Add item','prep-primary'),cancel=ui('button','Cancel','prep-secondary'),remove=ui('button','Delete','prep-delete');save.type='submit';cancel.type=remove.type='button';editorActions.append(remove,cancel,save);
 editor.append(editorTitle,field('Item name',nameInput),editorRow1,editorRow2,dayGroup,field('Notes (optional)',notesInput),activeLabel,stationList,editorActions);
 dialogBody.append(itemList,editor);foot.append(formStatus);form.append(dialogHead,dialogBody,foot);dialog.append(form);
 let editing=null,requestId=null,saving=false;
 function fillEditor(itemValue){
  editing=itemValue||null;requestId=itemValue?null:crypto.randomUUID();editorTitle.textContent=itemValue?word('Edit prep item'):word('Add a prep item');save.textContent=itemValue?word('Save item'):word('Add item');remove.hidden=!itemValue;cancel.hidden=!itemValue;formStatus.textContent='';
  nameInput.value=itemValue?.name||'';amountInput.value=itemValue?String(itemValue.amount):'';unitInput.value=itemValue?.unit||'';stationInput.value=itemValue?.station||'';notesInput.value=itemValue?.notes||'';activeInput.checked=itemValue?itemValue.active!==false:true;
  for(const input of dayInputs)input.checked=itemValue?itemValue.days.includes(Number(input.value)):true;
  labelSelect.replaceChildren(ui('option','No label template'),...(state.labelTemplates||[]).map(template=>{const option=data('option',template.name);option.value=template.id;return option;}));labelSelect.firstChild.value='';labelSelect.value=itemValue?.labelTemplateId&&(state.labelTemplates||[]).some(template=>template.id===itemValue.labelTemplateId)?itemValue.labelTemplateId:'';window.appSelects?.refresh?.(labelSelect);
  stationList.replaceChildren(...[...new Set((state.items||[]).map(entry=>entry.station).filter(Boolean))].map(value=>{const option=el('option');option.value=value;return option;}));
  for(const row of itemList.querySelectorAll('.prep-manage-row'))row.classList.toggle('is-editing',row.dataset.id===itemValue?.id);
 }
 function renderManage(){
  itemList.replaceChildren(ui('h3','Items at this location'));const items=state.items||[];
  if(!items.length)itemList.append(ui('p','No prep items yet. Add the first one.','prep-empty'));
  for(const entry of items){const row=el('button',undefined,'prep-manage-row'+(entry.active?'':' is-off'));row.type='button';row.dataset.id=entry.id;const label=el('span',undefined,'prep-manage-text');label.append(data('strong',entry.name),data('small',[amount(entry.amount)+(entry.unit?' '+entry.unit:''),entry.station,entry.days.length===7?word('Every day'):entry.days.map(day=>days[day-1]).join(' '),entry.active?null:word('Off')].filter(Boolean).join(' · ')));row.append(label);row.onclick=()=>fillEditor(entry);itemList.append(row);}
 }
 function openManage(){if(!state?.canManage)return;renderManage();fillEditor(null);dialog.showModal();nameInput.focus();}
 manage.onclick=openManage;close.onclick=()=>{if(!saving)dialog.close();};dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});dialog.addEventListener('close',()=>{load();manage.focus({preventScroll:true});});cancel.onclick=()=>fillEditor(null);
 const busy=value=>{saving=value;for(const control of form.querySelectorAll('button,input,select,textarea'))control.disabled=value&&control!==close;};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;const chosen=dayInputs.filter(input=>input.checked).map(input=>Number(input.value));
  if(!nameInput.value.trim()){formStatus.textContent=word('Enter the item name.');nameInput.focus();return;}if(!(Number(amountInput.value)>0)){formStatus.textContent=word('Enter an amount above 0.');amountInput.focus();return;}if(!chosen.length){formStatus.textContent=word('Choose at least one day.');return;}
  const value={name:nameInput.value,amount:Number(amountInput.value),unit:unitInput.value,station:stationInput.value,days:chosen,labelTemplateId:labelSelect.value||null,notes:notesInput.value,active:activeInput.checked};
  busy(true);formStatus.textContent=word('Saving…');
  try{if(editing)await api('/items/'+editing.id,'PUT',{...value,revision:editing.revision});else await api('/items','POST',{...value,requestId});state=await api(date?'?date='+date:'');busy(false);renderManage();fillEditor(null);formStatus.textContent=word('Saved.');render();}
  catch(error){busy(false);formStatus.textContent=error.message;if(error.status===409||error.status===404)requestId=crypto.randomUUID();}
 };
 remove.onclick=async()=>{if(!editing||saving)return;if(!confirm(word('Delete {name} from the prep list? Past ticks stay in history.',{name:editing.name})))return;busy(true);try{await api('/items/'+editing.id,'DELETE',{revision:editing.revision});state=await api(date?'?date='+date:'');busy(false);renderManage();fillEditor(null);render();}catch(error){busy(false);formStatus.textContent=error.message;}};
 // Shown through the Labels page's view switch.
 const visible=()=>!panel.hidden;new MutationObserver(()=>{if(visible())load();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('focus',()=>{if(visible()&&!dialog.open)load();});
 (async()=>{try{actor=await window.appAccess.initialSession();if(visible())load();}catch{}})();
})();
