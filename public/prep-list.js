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
 const money=cents=>Number.isSafeInteger(cents)?(cents/100).toLocaleString('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:cents%100?2:0}):'—';
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
  // Keep half-typed "Already prepped" amounts and the focused field when the list redraws after another save.
  const drafts=new Map([...list.querySelectorAll('input[data-prep-onhand]')].filter(input=>input.dataset.saved!==input.value).map(input=>[input.dataset.prepOnhand,input.value])),focused=document.activeElement?.dataset?.prepOnhand;
  list.replaceChildren(...[...groups].map(([station,rows])=>{const group=el('section',undefined,'prep-group'),heading=station?data('h3',station):ui('h3','Other items'),left=rows.filter(row=>!row.done).length,badge=el('span',left?word('{count} to go',{count:left}):word('Done'),'prep-group-count'+(left?'':' is-done'));heading.append(badge);group.append(heading,...rows.map(item));return group;}));
  for(const input of list.querySelectorAll('input[data-prep-onhand]')){if(drafts.has(input.dataset.prepOnhand)&&!input.disabled)input.value=drafts.get(input.dataset.prepOnhand);if(input.dataset.prepOnhand===focused&&!input.disabled)input.focus({preventScroll:true});}
 }
 function item(row){
  const card=el('article',undefined,'prep-item'+(row.done?' is-done':'')),check=el('button',undefined,'prep-check'),body=el('div',undefined,'prep-item-body'),name=row.article?.id?articleName(row):data('strong',row.name,'prep-item-name'),known=row.amount!==null&&row.amount!==undefined,left=row.toPrep??row.amount,qty=!known?ui('span','Amount not available','prep-item-amount is-unknown'):data('span',amount(left)+(row.unit?' '+row.unit:''),'prep-item-amount'+(row.onHand!==null&&row.onHand!==undefined&&!left?' is-covered':''));
  if(known&&row.onHand!==null&&row.onHand!==undefined)qty.title=word('To prep: {left} of {total}',{left:amount(left),total:amount(row.amount)});
  check.type='button';check.setAttribute('aria-pressed',String(row.done));check.setAttribute('aria-label',(row.done?word('Mark not done: '):word('Mark done: '))+row.name);check.disabled=!state.canTick||row.removed||pending.has(row.id);
  check.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
  check.onclick=()=>toggle(row);
  const top=el('div',undefined,'prep-item-top');top.append(name,qty);body.append(top);
  // Sales-based amounts: everyone sees the badge; only sales viewers see the ratio and the projected sales behind it.
  if(row.basis==='sales'){const basis=el('p',undefined,'prep-item-basis');basis.append(ui('span','Based on projected sales','prep-basis-badge'));if(row.amount===null||row.amount===undefined)basis.append(data('span',' · '+word(row.amountReason||'No sales projection for this day yet.')));else if(row.salesPer)basis.append(data('span',' · '+word('{amount} per {sales} · projected {projected}',{amount:amount(row.ratio)+(row.unit?' '+row.unit:''),sales:money(row.salesPer*100),projected:money(row.projectedSalesCents)})));body.append(basis);}
  if(row.parts?.length)body.append(partBoxes(row));
  body.append(onHandField(row,known,left));
  if(row.notes)body.append(data('p',row.notes,'prep-item-notes'));
  if(row.done&&row.doneBy)body.append(data('p',word('Done by {name} at {time}',{name:row.doneBy.name||word('someone'),time:time(row.doneAt)}),'prep-item-meta'));
  if(row.removed)body.append(ui('p','Removed from the list since it was ticked.','prep-item-meta'));
  card.append(check,body);
  if(row.label&&state.canPrint){const print=el('a',undefined,'prep-print');print.href='/labels?print='+encodeURIComponent(row.label.id)+'#print';print.append(ui('span',row.done?'Print labels':'Labels'));print.title=word('Print labels with {template}',{template:row.label.name});print.onclick=event=>{if(window.labelsPrint?.(row.label.id)){event.preventDefault();}};card.append(print);}
  return card;
 }
 // Already prepped: what is on hand comes off the amount to make. Saved when the field is left or Enter is pressed (today only).
 function onHandField(row,known,left){
  const wrap=el('div',undefined,'prep-onhand'),label=el('label',undefined,'prep-onhand-field'),input=el('input'),note=el('span',undefined,'prep-onhand-note');
  input.type='number';input.min='0';input.max='1000000';input.step='0.001';input.inputMode='decimal';input.placeholder='0';input.value=row.onHand===null||row.onHand===undefined?'':String(row.onHand);
  input.disabled=!state.canTick||row.removed||row.done||pending.has(row.id)||Boolean(row.parts?.some(part=>part.done));input.dataset.prepOnhand=row.id;input.dataset.saved=input.value;
  label.append(ui('span','Already prepped'),input);if(row.unit)label.append(data('span',row.unit,'prep-onhand-unit'));
  input.setAttribute('aria-label',word('Already prepped: {name}',{name:row.name}));
  if(row.onHand!==null&&row.onHand!==undefined&&known)note.append(left?data('span',word('{left} still to make of {total}',{left:amount(left)+(row.unit?' '+row.unit:''),total:amount(row.amount)})):ui('span','Enough already prepped'));
  const commit=()=>{const raw=input.value.trim(),value=raw===''?null:Number(raw);if(value===(row.onHand??null))return;
   if(value!==null&&!(Number.isFinite(value)&&value>=0&&value<=1000000&&Math.round(value*1000)===value*1000)){status.textContent=word('Enter the amount already prepped as a number from 0 with up to three decimal places, or leave it blank.');input.focus();return;}
   saveOnHand(row,value);};
  input.addEventListener('change',commit);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.blur();}});
  wrap.hidden=!state.canTick&&(row.onHand===null||row.onHand===undefined);  wrap.append(label,note);return wrap;
 }
 // A linked method/recipe article opens read-only in the shared Knowledge centre popup (its own access checks apply).
 function articleName(row){const button=el('button',undefined,'prep-item-name prep-item-article');button.type='button';button.dataset.kcArticle=row.article.id;button.dataset.kcTitle=row.article.title||'';button.append(data('strong',row.name));
  const icon=el('span',undefined,'prep-article-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z"/><path d="M8 7h6M8 11h6"/></svg>';button.append(icon);
  button.title=word('Open how to make it: {title}',{title:row.article.title||row.name});button.setAttribute('aria-label',word('{name} – open how to make it',{name:row.name}));return button;}
 // More than one to make: one checkbox per unit (the last may be a part unit). The item is done once every box is ticked.
 function partBoxes(row){
  const wrap=el('div',undefined,'prep-parts'),total=row.parts.length,ticked=row.parts.filter(part=>part.done).length;wrap.setAttribute('role','group');wrap.setAttribute('aria-label',word('{name}: {done} of {total} ticked',{name:row.name,done:ticked,total}));
  for(const part of row.parts){const box=el('button',undefined,'prep-part'+(part.done?' is-done':''));box.type='button';box.dataset.prepPart=row.id+':'+part.index;box.setAttribute('aria-pressed',String(part.done));
   box.disabled=!state.canTick||row.removed||pending.has(row.id);
   const size=amount(part.size)+(row.unit?' '+row.unit:'');box.setAttribute('aria-label',word('{size}, {number} of {total}',{size,number:part.index+1,total}));
   box.title=part.done&&part.by?word('Done by {name} at {time}',{name:part.by.name||word('someone'),time:time(part.at)}):size;
   box.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
   box.append(data('span',part.size===1?String(part.index+1):amount(part.size),'prep-part-label'));
   box.onclick=()=>togglePart(row,part);wrap.append(box);}
  wrap.append(data('span',word('{done} of {total}',{done:ticked,total}),'prep-parts-count'));return wrap;
 }
 async function togglePart(row,part){
  if(!state?.canTick||pending.has(row.id))return;pending.add(row.id);render();status.textContent='';const focusKey=row.id+':'+part.index;
  try{const result=await api('/part','POST',{date:state.date,itemId:row.id,index:part.index,done:!part.done,revision:row.tickRevision});Object.assign(row,{done:result.done,doneAt:result.doneAt,doneBy:result.doneBy,tickRevision:result.tickRevision,parts:result.parts||row.parts});
   if(result.done&&row.label&&state.canPrint)status.textContent=word('{name} done. Use Print labels to print food labels for it.',{name:row.name});}
  catch(error){status.textContent=error.message;if(error.status===409){try{state=await api('?date='+encodeURIComponent(state.date));}catch{}}}
  finally{pending.delete(row.id);render();list.querySelector('[data-prep-part="'+CSS.escape(focusKey)+'"]')?.focus({preventScroll:true});}
 }
 async function saveOnHand(row,quantity){
  if(!state?.canTick||pending.has(row.id))return;pending.add(row.id);status.textContent='';
  try{const result=await api('/on-hand','POST',{date:state.date,itemId:row.id,quantity,revision:row.onHandRevision||0});Object.assign(row,{onHand:result.onHand,onHandRevision:result.onHandRevision,onHandBy:result.onHandBy,onHandAt:result.onHandAt});
   // The remaining amount comes from the server so rounding matches everywhere.
   const fresh=await api('?date='+encodeURIComponent(state.date)).catch(()=>null),match=fresh?.rows?.find(entry=>entry.id===row.id);if(match)Object.assign(row,{toPrep:match.toPrep,parts:match.parts});else row.toPrep=null;}
  catch(error){status.textContent=error.message;if(error.status===409){try{state=await api('?date='+encodeURIComponent(state.date));}catch{}}}
  finally{pending.delete(row.id);render();}
 }
 async function toggle(row){
  if(!state?.canTick||pending.has(row.id))return;pending.add(row.id);render();status.textContent='';
  try{const result=await api('/tick','POST',{date:state.date,itemId:row.id,done:!row.done,revision:row.tickRevision});Object.assign(row,{done:result.done,doneAt:result.doneAt,doneBy:result.doneBy,tickRevision:result.tickRevision,...(result.parts?{parts:result.parts}:{})});
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
 const basisSelect=el('select'),perInput=el('input'),roundInput=el('input');basisSelect.append(ui('option','Fixed amount each day'),ui('option','Amount per projected sales'));basisSelect.options[0].value='fixed';basisSelect.options[1].value='sales';perInput.type='number';perInput.min='1';perInput.max='1000000';perInput.step='1';perInput.inputMode='numeric';perInput.placeholder='1000';roundInput.type='number';roundInput.min='0.001';roundInput.step='0.001';roundInput.inputMode='decimal';roundInput.placeholder=word('e.g. 0.5');
 const nameInput=el('input'),amountInput=el('input'),unitInput=el('input'),stationInput=el('input'),stationList=el('datalist'),labelSelect=el('select'),notesInput=el('textarea'),activeInput=el('input');
 nameInput.maxLength=80;nameInput.required=true;nameInput.placeholder=word('e.g. Tzatziki');amountInput.type='number';amountInput.min='0.001';amountInput.step='0.001';amountInput.required=true;amountInput.inputMode='decimal';unitInput.maxLength=30;unitInput.placeholder=word('e.g. litres, trays');stationInput.maxLength=60;stationInput.placeholder=word('e.g. Grill, Cold prep');stationList.id='prep-stations';stationInput.setAttribute('list','prep-stations');notesInput.maxLength=300;notesInput.rows=2;activeInput.type='checkbox';
 const dayGroup=el('fieldset',undefined,'prep-days'),dayLegend=ui('legend','Days');dayGroup.append(dayLegend);const dayInputs=days.map((name,index)=>{const label=el('label',undefined,'prep-day'),input=el('input');input.type='checkbox';input.value=String(index+1);label.append(input,ui('span',name));dayGroup.append(label);return input;});
 // How to make it: an optional Knowledge centre article (chosen through the shared read-only article picker).
 const articleBox=el('div',undefined,'prep-article-field'),articleHeading=ui('span','How to make it (optional)','prep-field-name');let articleDraft=null;
 function renderArticle(){const links=Boolean(window.knowledgeArticlePopup?.canLink?.());articleBox.hidden=!links&&!articleDraft;const row=el('div',undefined,'prep-article-row');
  if(articleDraft){const open=el('button',undefined,'prep-article-chip');open.type='button';open.dataset.kcArticle=articleDraft.id;open.dataset.kcTitle=articleDraft.title;open.append(data('span',articleDraft.title));open.title=word('Preview the article');row.append(open);
   if(links){const change=ui('button','Change','prep-secondary prep-small');change.type='button';change.onclick=pickArticle;row.append(change);}
   const unlink=ui('button','Remove','prep-secondary prep-small');unlink.type='button';unlink.onclick=()=>{articleDraft=null;renderArticle();};row.append(unlink);}
  else if(links){const add=ui('button','Link a Knowledge centre article','prep-secondary prep-small');add.type='button';add.onclick=pickArticle;row.append(add);}
  articleBox.replaceChildren(articleHeading,row);}
 async function pickArticle(){const chosen=await window.knowledgeArticlePopup?.pick?.({parent:dialog});if(chosen?.id){articleDraft={id:chosen.id,title:String(chosen.title||'').slice(0,200)||word('Article')};renderArticle();}}
 const activeLabel=el('label',undefined,'prep-active');activeLabel.append(activeInput,ui('span','On the prep list'));
 const editorTitle=ui('h3','Add a prep item'),editorRow1=el('div',undefined,'prep-row'),editorRow2=el('div',undefined,'prep-row');
 const amountField=field('Amount each day',amountInput),salesRow=el('div',undefined,'prep-row prep-sales-row'),perField=field('Per projected sales ($)',perInput),salesHint=ui('p','It’s on the list every day, worked out from that day’s projected sales, e.g. 2 kg per $1,000. If there is no projection yet, staff see “Amount not available”.','prep-sales-hint');salesRow.append(perField,field('Round up to (optional)',roundInput));
 const basisField=field('How much to prep',basisSelect);basisField.classList.add('prep-basis-field');
 function syncBasis(){const sales=basisSelect.value==='sales';salesRow.hidden=salesHint.hidden=!sales;dayGroup.hidden=sales;perInput.required=sales;amountField.querySelector('span').textContent=sales?word('Amount to prep'):word('Amount each day');}basisSelect.onchange=syncBasis;
 editorRow1.append(amountField,field('Unit',unitInput));editorRow2.append(field('Station',stationInput),field('Label template',labelSelect));
 const editorActions=el('div',undefined,'prep-editor-actions'),save=ui('button','Add item','prep-primary'),cancel=ui('button','Cancel','prep-secondary'),remove=ui('button','Delete','prep-delete');save.type='submit';cancel.type=remove.type='button';editorActions.append(remove,cancel,save);
 editor.append(editorTitle,field('Item name',nameInput),basisField,editorRow1,salesRow,salesHint,editorRow2,dayGroup,field('Notes (optional)',notesInput),articleBox,activeLabel,stationList,editorActions);
 dialogBody.append(itemList,editor);foot.append(formStatus);form.append(dialogHead,dialogBody,foot);dialog.append(form);
 let editing=null,requestId=null,saving=false;
 function fillEditor(itemValue){
  editing=itemValue||null;requestId=itemValue?null:crypto.randomUUID();editorTitle.textContent=itemValue?word('Edit prep item'):word('Add a prep item');save.textContent=itemValue?word('Save item'):word('Add item');remove.hidden=!itemValue;cancel.hidden=!itemValue;formStatus.textContent='';
  nameInput.value=itemValue?.name||'';amountInput.value=itemValue?String(itemValue.amount):'';unitInput.value=itemValue?.unit||'';stationInput.value=itemValue?.station||'';notesInput.value=itemValue?.notes||'';activeInput.checked=itemValue?itemValue.active!==false:true;basisSelect.value=itemValue?.basis==='sales'?'sales':'fixed';perInput.value=itemValue?.salesPer?String(itemValue.salesPer):'';roundInput.value=itemValue?.roundTo?String(itemValue.roundTo):'';syncBasis();window.appSelects?.refresh?.(basisSelect);
  for(const input of dayInputs)input.checked=itemValue?itemValue.days.includes(Number(input.value)):true;
  articleDraft=itemValue?.article?.id?{id:itemValue.article.id,title:itemValue.article.title||''}:null;renderArticle();
  labelSelect.replaceChildren(ui('option','No label template'),...(state.labelTemplates||[]).map(template=>{const option=data('option',template.name);option.value=template.id;return option;}));labelSelect.firstChild.value='';labelSelect.value=itemValue?.labelTemplateId&&(state.labelTemplates||[]).some(template=>template.id===itemValue.labelTemplateId)?itemValue.labelTemplateId:'';window.appSelects?.refresh?.(labelSelect);
  stationList.replaceChildren(...[...new Set((state.items||[]).map(entry=>entry.station).filter(Boolean))].map(value=>{const option=el('option');option.value=value;return option;}));
  for(const row of itemList.querySelectorAll('.prep-manage-row'))row.classList.toggle('is-editing',row.dataset.id===itemValue?.id);
 }
 function renderManage(){
  itemList.replaceChildren(ui('h3','Items at this location'));const items=state.items||[];
  if(items.length&&state.copyTargets?.length){const copyButton=ui('button','Copy to other stores','prep-secondary prep-small prep-copy-open');copyButton.type='button';copyButton.onclick=openCopy;itemList.append(copyButton);}
  if(!items.length)itemList.append(ui('p','No prep items yet. Add the first one.','prep-empty'));
  for(const entry of items){const row=el('button',undefined,'prep-manage-row'+(entry.active?'':' is-off'));row.type='button';row.dataset.id=entry.id;const label=el('span',undefined,'prep-manage-text');label.append(data('strong',entry.name),data('small',[amount(entry.amount)+(entry.unit?' '+entry.unit:'')+(entry.basis==='sales'?' '+word('per {sales} projected',{sales:money(entry.salesPer*100)}):''),entry.station,entry.days.length===7?word('Every day'):entry.days.map(day=>days[day-1]).join(' '),entry.active?null:word('Off')].filter(Boolean).join(' · ')));row.append(label);row.onclick=()=>{fillEditor(entry);if(matchMedia('(max-width:700px)').matches)editorTitle.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});};itemList.append(row);}
 }
 // Copy items to other stores: choose items and stores, then one explicit Copy. Each store gets its own copy; names it already has are skipped.
 const copyDialog=el('dialog',undefined,'prep-dialog prep-copy-dialog');copyDialog.setAttribute('aria-labelledby','prep-copy-title');copyDialog.dataset.layoutUi='';document.body.append(copyDialog);
 const copyForm=el('form'),copyHead=el('header',undefined,'prep-dialog-head'),copyTitle=ui('h2','Copy prep items'),copyClose=el('button','×','prep-close');copyTitle.id='prep-copy-title';copyClose.type='button';copyClose.setAttribute('aria-label',word('Close copy prep items'));copyHead.append(copyTitle,copyClose);
 const copyBody=el('div',undefined,'prep-copy-body'),copyItems=el('fieldset',undefined,'prep-copy-group'),copyStores=el('fieldset',undefined,'prep-copy-group'),copyFoot=el('footer',undefined,'prep-dialog-foot prep-copy-foot'),copyStatus=el('p','','prep-form-status'),copyGo=ui('button','Copy','prep-primary'),copyCancel=ui('button','Cancel','prep-secondary');copyStatus.setAttribute('role','status');copyGo.type='submit';copyCancel.type='button';
 copyBody.append(ui('p','Each store gets its own copy it can change. Items a store already has (same name) are skipped.','prep-sales-hint'),copyItems,copyStores);copyFoot.append(copyStatus,copyCancel,copyGo);copyForm.append(copyHead,copyBody,copyFoot);copyDialog.append(copyForm);
 let copyRequest=null,copying=false;
 function checkGroup(fieldset,title,entries,checked){fieldset.replaceChildren(ui('legend',title));const all=el('label',undefined,'prep-copy-option prep-copy-all'),allBox=el('input');allBox.type='checkbox';all.append(allBox,ui('span','Select all'));fieldset.append(all);
  const boxes=entries.map(entry=>{const label=el('label',undefined,'prep-copy-option'),box=el('input');box.type='checkbox';box.value=entry.id;box.checked=checked;label.append(box,data('span',entry.label));fieldset.append(label);return box;});
  const sync=()=>{allBox.checked=boxes.every(box=>box.checked);allBox.indeterminate=!allBox.checked&&boxes.some(box=>box.checked);};allBox.onchange=()=>{for(const box of boxes)box.checked=allBox.checked;copyRequest=null;};for(const box of boxes)box.addEventListener('change',()=>{sync();copyRequest=null;});sync();}
 function openCopy(){if(!state?.copyTargets?.length)return;copyRequest=null;copyStatus.textContent='';
  checkGroup(copyItems,word('Prep items'),(state.items||[]).map(entry=>({id:entry.id,label:entry.name+(entry.station?' · '+entry.station:'')})),true);
  checkGroup(copyStores,word('Copy to'),state.copyTargets.map(entry=>({id:entry.id,label:entry.name})),false);copyDialog.showModal();copyStores.querySelector('input')?.focus();}
 const chosenIn=fieldset=>[...fieldset.querySelectorAll('.prep-copy-option:not(.prep-copy-all) input')].filter(box=>box.checked).map(box=>box.value);
 copyClose.onclick=copyCancel.onclick=()=>{if(!copying)copyDialog.close();};copyDialog.addEventListener('cancel',event=>{if(copying)event.preventDefault();});
 copyForm.onsubmit=async event=>{event.preventDefault();if(copying)return;const itemIds=chosenIn(copyItems),locationIds=chosenIn(copyStores);
  if(!itemIds.length){copyStatus.textContent=word('Choose at least one prep item.');return;}if(!locationIds.length){copyStatus.textContent=word('Choose at least one store.');return;}
  copyRequest||=crypto.randomUUID();copying=true;for(const control of copyForm.querySelectorAll('button,input'))control.disabled=control!==copyClose;copyStatus.textContent=word('Copying…');
  try{const result=await api('/copy','POST',{requestId:copyRequest,itemIds,locationIds});copyStatus.textContent=result.results.map(entry=>word('{store}: {copied} copied',{store:entry.name,copied:entry.copied})+(entry.skipped?word(', {skipped} already there',{skipped:entry.skipped}):'')).join(' · ');copyRequest=null;}
  catch(error){copyStatus.textContent=error.message;if(error.status&&error.status<500&&error.status!==409)copyRequest=null;}
  finally{copying=false;for(const control of copyForm.querySelectorAll('button,input'))control.disabled=false;}};
 function openManage(){if(!state?.canManage)return;renderManage();fillEditor(null);dialog.showModal();nameInput.focus();}
 manage.onclick=openManage;close.onclick=()=>{if(!saving)dialog.close();};dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});dialog.addEventListener('close',()=>{load();manage.focus({preventScroll:true});});cancel.onclick=()=>fillEditor(null);
 const busy=value=>{saving=value;for(const control of form.querySelectorAll('button,input,select,textarea'))control.disabled=value&&control!==close;};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;const chosen=dayInputs.filter(input=>input.checked).map(input=>Number(input.value));
  if(!nameInput.value.trim()){formStatus.textContent=word('Enter the item name.');nameInput.focus();return;}if(!(Number(amountInput.value)>0)){formStatus.textContent=word('Enter an amount above 0.');amountInput.focus();return;}const sales=basisSelect.value==='sales';if(!sales&&!chosen.length){formStatus.textContent=word('Choose at least one day.');return;}if(sales&&!(Number.isInteger(Number(perInput.value))&&Number(perInput.value)>=1)){formStatus.textContent=word('Enter the projected sales amount in whole dollars.');perInput.focus();return;}
  const value={name:nameInput.value,amount:Number(amountInput.value),...(sales?{basis:'sales',salesPer:Number(perInput.value),roundTo:roundInput.value.trim()?Number(roundInput.value):null}:{basis:'fixed'}),unit:unitInput.value,station:stationInput.value,days:sales?[1,2,3,4,5,6,7]:chosen,labelTemplateId:labelSelect.value||null,notes:notesInput.value,article:articleDraft,active:activeInput.checked};
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
