// Sales → Promotions: record the deals a store runs and compare their days with the normal projection.
// Browsing, filtering and expanding never write; only Save promotion and Delete call the API.
(()=>{
 const $=id=>document.getElementById(id),panel=$('sales-promotions');if(!panel)return;
 const model=window.promotionsModel;
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 const ui=(tag,text,cls)=>{const element=node(tag,text,cls);window.appWording?.label(element,text);return element;};
 const data=(tag,text,cls)=>{const element=node(tag,text,cls);element.dataset.userText='';return element;};
 const money=value=>value===null||value===undefined?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 const date=value=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const shortDate=value=>new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const icon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>';
 let actor,state=null,filter='current',loading=false,generation=0,editing=null,saving=false,requestId=null;
 const performance=new Map();
 async function api(url,method='GET',body){const response=await fetch(url,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':actor?.csrf||'',...(actor?.locationId?{'X-Location-Id':actor.locationId}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href='/login';throw Error('Please sign in again.');}const value=await response.json().catch(()=>({}));if(!response.ok){if(response.status===428)window.appRequiredReading?.check?.();throw Object.assign(Error(value.error||'Unable to load promotions.'),{status:response.status});}return value;}
 const statusText={running:'Running',upcoming:'Upcoming',finished:'Finished'};
 function shown(){const list=state?.promotions||[];if(filter==='current')return list.filter(item=>item.status!=='finished').sort((a,b)=>(a.status==='running'?0:1)-(b.status==='running'?0:1)||a.startDate.localeCompare(b.startDate));if(filter==='finished')return list.filter(item=>item.status==='finished');return list;}
 function render(){
  const list=$('promo-list'),items=shown();list.replaceChildren();$('promo-add').hidden=!state?.canEdit;
  for(const button of panel.querySelectorAll('[data-promo-filter]'))button.setAttribute('aria-pressed',String(button.dataset.promoFilter===filter));
  if(!items.length){const empty=node('div',undefined,'promo-empty');empty.append(ui('strong',filter==='finished'?'No finished promotions yet':'No running or upcoming promotions'),ui('p',state?.canEdit?'Add a promotion to mark its days on Daily sales and see how sales compare with the normal projection.':'Promotions added for this location will appear here.'));list.append(empty);return;}
  for(const item of items)list.append(card(item));
 }
 function card(item){
  const article=node('article',undefined,'promo-card is-'+item.status),head=node('div',undefined,'promo-card-head'),badge=node('span',undefined,'promo-icon');badge.innerHTML=icon;
  const titles=node('div',undefined,'promo-card-titles'),name=data('h3',item.name),meta=node('div',undefined,'promo-chips');
  const offer=data('span',model.offer(item),'promo-chip promo-chip-offer'),status=ui('span',statusText[item.status],'promo-chip promo-chip-'+item.status);meta.append(status,offer);titles.append(name,meta);head.append(badge,titles);
  if(item.canEdit){const edit=ui('button','Edit','promo-edit');edit.type='button';edit.onclick=()=>openEditor(item,edit);head.append(edit);}
  const facts=node('dl',undefined,'promo-facts');
  const fact=(label,value)=>{const row=node('div');row.append(ui('dt',label),data('dd',value));facts.append(row);};
  const length=model.days(item.startDate,item.endDate);
  fact('Dates',(item.startDate===item.endDate?date(item.startDate):date(item.startDate)+' – '+date(item.endDate))+' · '+length+(length===1?' day':' days'));
  fact('Channels',model.channelText(item.channels));
  fact('Locations',item.locationNames.join(', '));
  if(item.notes)fact('Notes',item.notes);
  article.append(head,facts);
  if(item.status!=='upcoming'){const result=node('div',undefined,'promo-result');result.setAttribute('aria-live','polite');article.append(result);showPerformance(item,result);}
  else article.append(ui('p','Results appear once the promotion starts and sales are recorded.','promo-result-note'));
  return article;
 }
 async function showPerformance(item,box){
  const key=item.id+':'+item.revision+':'+state.today;box.replaceChildren(ui('p','Loading results…','promo-result-note'));
  try{if(!performance.has(key))performance.set(key,api('/api/promotions/'+item.id+'/performance'));const result=await performance.get(key);if(!box.isConnected)return;box.replaceChildren(...summary(result));}
  catch(error){performance.delete(key);if(box.isConnected)box.replaceChildren(data('p',error.message,'promo-result-note is-error'));}
 }
 function summary(result){
  if(!result.comparedDays){return[ui('p',result.recordedDays?'Projections are not available for the recorded days yet.':'No sales have been recorded for these days yet.','promo-result-note')];}
  const up=result.differenceCents>0,down=result.differenceCents<0,grid=node('div',undefined,'promo-result-grid');
  const metric=(label,value,cls)=>{const cell=node('div',undefined,'promo-metric'+(cls?' '+cls:''));cell.append(ui('span',label),data('strong',value));grid.append(cell);};
  metric('Sales',money(result.actualCents));metric('Normal projection',money(result.projectedCents));
  metric('Difference',(up?'▲ +':down?'▼ −':'● ')+money(Math.abs(result.differenceCents))+(result.differencePercent===null?'':' ('+(up?'+':down?'−':'')+Math.abs(result.differencePercent)+'%)'),up?'is-up':down?'is-down':'is-even');
  const days=result.comparedDays,total=result.days.length,note=ui('p',days===total?'Compared over {count} days.':'Compared over {count} of {total} days so far (days without saved sales or a projection are left out).','promo-result-note');
  note.textContent=note.textContent.replace('{count}',days).replace('{total}',total);
  const details=node('details',undefined,'promo-days'),summaryNode=ui('summary','Day by day'),table=node('table'),headRow=node('tr');
  for(const label of ['Day','Sales','Projection','Difference'])headRow.append(ui('th',label));const thead=node('thead');thead.append(headRow);const tbody=node('tbody');
  for(const day of result.days){const row=node('tr'),difference=day.actualCents!==null&&day.projectedCents!==null?day.actualCents-day.projectedCents:null;row.append(data('td',shortDate(day.date)),data('td',money(day.actualCents)),data('td',money(day.projectedCents)),data('td',difference===null?'—':(difference>0?'+':difference<0?'−':'')+money(Math.abs(difference))));if(difference!==null)row.lastChild.className=difference>0?'is-up':difference<0?'is-down':'';tbody.append(row);}
  table.append(thead,tbody);details.append(summaryNode,table);
  return[grid,note,details];
 }
 async function load(){
  if(!actor||!window.appAccess?.can?.('sales.view')||loading)return;const version=++generation;loading=true;$('promo-status').textContent=window.interfaceLabel?interfaceLabel('Loading promotions…'):'Loading promotions…';
  try{const value=await api('/api/promotions');if(version!==generation)return;state=value;performance.clear();window.promotionMarkers?.refresh();$('promo-status').textContent='';render();}
  catch(error){if(version===generation)$('promo-status').textContent=error.message;}
  finally{if(version===generation)loading=false;}
 }
 // Editor.
 const dialog=$('promo-dialog'),form=$('promo-form');let returnFocus=null,snapshot='';
 function fillKinds(){const select=$('promo-kind');if(select.options.length)return;for(const kind of model.kinds){const option=ui('option',kind.label);option.value=kind.id;select.append(option);}window.appSelects?.refresh?.(select);}
 function fillChoices(host,items,selected,name){host.replaceChildren();for(const item of items){const label=node('label','', 'promo-choice'),input=node('input');input.type='checkbox';input.name=name;input.value=item.id;input.checked=selected.includes(item.id);label.append(input,name==='promo-location'?data('span',item.name):ui('span',item.label));host.append(label);}}
 function syncKind(){const kind=model.kind($('promo-kind').value),field=$('promo-value-field'),input=$('promo-value'),label=$('promo-value-label');field.hidden=!kind?.value;input.disabled=!kind?.value;input.required=Boolean(kind?.value);if(kind?.value==='percent'){label.textContent='Discount (%)';input.min='1';input.max='100';input.step='1';}else if(kind?.value==='cents'){label.textContent=kind.id==='price'?'Special price ($)':'Amount off ($)';input.min='0.01';input.max='1000000';input.step='0.01';}}
 const values=()=>{const kind=model.kind($('promo-kind').value),raw=$('promo-value').value;return{name:$('promo-name').value,kind:$('promo-kind').value,value:!kind?.value||raw===''?null:kind.value==='percent'?Number(raw):Math.round(Number(raw)*100),channels:[...form.querySelectorAll('input[name=promo-channel]:checked')].map(input=>input.value),startDate:$('promo-start').value,endDate:$('promo-end').value,locationIds:[...form.querySelectorAll('input[name=promo-location]:checked')].map(input=>input.value),notes:$('promo-notes').value};};
 function openEditor(item,trigger){
  if(!state?.canEdit)return;editing=item||null;requestId=item?null:crypto.randomUUID();returnFocus=trigger||document.activeElement;fillKinds();
  $('promo-dialog-title').textContent=item?(window.interfaceLabel?interfaceLabel('Edit promotion'):'Edit promotion'):(window.interfaceLabel?interfaceLabel('Add promotion'):'Add promotion');
  $('promo-name').value=item?.name||'';$('promo-kind').value=item?.kind||'percent';window.appSelects?.refresh?.($('promo-kind'));
  const kind=model.kind(item?.kind||'percent');$('promo-value').value=item&&Number.isInteger(item.value)?(kind?.value==='percent'?String(item.value):(item.value/100).toFixed(2)):'';
  const today=state.today;$('promo-start').value=item?.startDate||today;$('promo-end').value=item?.endDate||today;$('promo-notes').value=item?.notes||'';
  fillChoices($('promo-channels'),model.channels,item?.channels||['in-store'],'promo-channel');
  fillChoices($('promo-locations'),state.locations,item?.locationIds||[state.locationId],'promo-location');
  $('promo-delete').hidden=!item;$('promo-form-status').textContent='';syncKind();snapshot=JSON.stringify(values());
  dialog.showModal();$('promo-name').focus();
 }
 function close(){if(saving)return;if(JSON.stringify(values())!==snapshot&&!confirm(window.interfaceLabel?interfaceLabel('Discard changes to this promotion?'):'Discard changes to this promotion?'))return;dialog.close();}
 dialog.addEventListener('close',()=>{editing=null;if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 $('promo-close').onclick=close;$('promo-cancel').onclick=close;$('promo-kind').onchange=syncKind;
 const busy=value=>{saving=value;for(const control of form.querySelectorAll('button,input,select,textarea'))if(control.id!=='promo-close')control.disabled=value||control.id==='promo-value'&&$('promo-value-field').hidden;};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;const input=values();
  if(!input.channels.length){$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('Choose at least one sales channel.'):'Choose at least one sales channel.';return;}
  if(!input.locationIds.length){$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('Choose at least one location.'):'Choose at least one location.';return;}
  if(input.endDate&&input.startDate&&input.endDate<input.startDate){$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('The end date must be on or after the start date.'):'The end date must be on or after the start date.';$('promo-end').focus();return;}
  busy(true);$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('Saving…'):'Saving…';
  try{if(editing)await api('/api/promotions/'+editing.id,'PUT',{...input,revision:editing.revision});else await api('/api/promotions','POST',{...input,requestId});snapshot=JSON.stringify(input);busy(false);dialog.close();await load();}
  catch(error){busy(false);$('promo-form-status').textContent=error.message;}
 };
 $('promo-delete').onclick=async()=>{if(!editing||saving)return;if(!confirm((window.interfaceLabel?interfaceLabel('Delete this promotion?'):'Delete this promotion?')+' '+editing.name))return;busy(true);try{await api('/api/promotions/'+editing.id,'DELETE',{revision:editing.revision});snapshot=JSON.stringify(values());busy(false);dialog.close();await load();}catch(error){busy(false);$('promo-form-status').textContent=error.message;}};
 $('promo-add').onclick=event=>openEditor(null,event.currentTarget);
 for(const button of panel.querySelectorAll('[data-promo-filter]'))button.onclick=()=>{filter=button.dataset.promoFilter;render();};
 const show=()=>{if(location.hash==='#promotions'&&actor)load();};
 window.addEventListener('hashchange',show);
 (async()=>{try{actor=await window.appAccess.initialSession();show();}catch{}})();
})();
