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
 let cover={changed:false,data:null,url:null},actor,state=null,filter='current',loading=false,generation=0,editing=null,saving=false,requestId=null;
 const performance=new Map();
 async function api(url,method='GET',body){const response=await fetch(url,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':actor?.csrf||'',...(actor?.locationId?{'X-Location-Id':actor.locationId}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href='/login';throw Error('Please sign in again.');}const value=await response.json().catch(()=>({}));if(!response.ok){if(response.status===428)window.appRequiredReading?.check?.();throw Object.assign(Error(value.error||'Unable to load promotions.'),{status:response.status});}return value;}
 const statusText={running:'Running',upcoming:'Upcoming',finished:'Finished'};
 function shown(){const list=state?.promotions||[];if(filter==='current')return list.filter(item=>item.status!=='finished').sort((a,b)=>(a.status==='running'?0:1)-(b.status==='running'?0:1)||a.startDate.localeCompare(b.startDate));if(filter==='finished')return list.filter(item=>item.status==='finished');return list;}
 const on=key=>Boolean(state?.features?.[key]);
 function render(){
  const list=$('promo-list');$('promo-add').hidden=!state?.canEdit;$('promo-settings-open').hidden=!state?.canEditSettings;
  const board=panel.querySelector('[data-promo-filter=leaderboard]');board.hidden=!on('reporting');if(board.hidden&&filter==='leaderboard')filter='current';
  for(const button of panel.querySelectorAll('[data-promo-filter]'))button.setAttribute('aria-pressed',String(button.dataset.promoFilter===filter));
  list.replaceChildren();list.classList.toggle('is-leaderboard',filter==='leaderboard');if(filter==='leaderboard'){renderLeaderboard(list);return;}
  const items=shown();
  if(!items.length){const empty=node('div',undefined,'promo-empty');empty.append(ui('strong',filter==='finished'?'No finished promotions yet':'No running or upcoming promotions'),ui('p',state?.canEdit?'Add a promotion to mark its days on Daily sales and see how sales compare with the normal projection.':'Promotions added for this location will appear here.'));list.append(empty);return;}
  for(const item of items)list.append(card(item));
 }
 function card(item){
  const article=node('article',undefined,'promo-card is-'+item.status),head=node('div',undefined,'promo-card-head'),badge=node('span',undefined,'promo-icon');badge.innerHTML=icon;
  if(item.image){const cover=node('img');cover.className='promo-card-cover';cover.src=item.image.url;cover.alt='';cover.loading='lazy';cover.decoding='async';article.append(cover);}
  const titles=node('div',undefined,'promo-card-titles'),name=data('h3',item.name),meta=node('div',undefined,'promo-chips');
  const offer=data('span',model.offer(item),'promo-chip promo-chip-offer'),status=ui('span',statusText[item.status],'promo-chip promo-chip-'+item.status);meta.append(status,offer);titles.append(name,meta);head.append(badge,titles);
  if(item.canEdit){const edit=ui('button','Edit','promo-edit');edit.type='button';edit.onclick=()=>openEditor(item,edit);head.append(edit);}
  const facts=node('dl',undefined,'promo-facts');
  const fact=(label,value)=>{const row=node('div');row.append(ui('dt',label),data('dd',value));facts.append(row);};
  const length=model.days(item.startDate,item.endDate);
  fact('Dates',(item.startDate===item.endDate?date(item.startDate):date(item.startDate)+' – '+date(item.endDate))+' · '+length+(length===1?' day':' days'));
  fact('Channels',model.channelText(item.channels));
  fact('Locations',item.locationNames.join(', '));
  if(model.repeats(item))fact('Repeats','Every '+model.weekdayText(item.weekdays));
  if(on('uplift')&&Number.isInteger(item.expectedUplift))fact('Expected uplift','+'+item.expectedUplift+'% on projections, ordering, prep and rosters');
  if(on('items')&&item.items?.length)fact('Products',item.items.map(product=>product.name).join(', '));
  if(item.notes)fact('Notes',item.notes);
  article.append(head,facts);
  if(on('staff')&&state.comms?.post&&item.status!=='finished'){const actions=node('div',undefined,'promo-card-actions'),post=ui('button','Post to Comms','promo-secondary promo-post');post.type='button';post.onclick=()=>openPost(item,post);actions.append(post);article.append(actions);}
  if(item.status!=='upcoming'){const result=node('div',undefined,'promo-result');result.setAttribute('aria-live','polite');article.append(result);showPerformance(item,result);}
  else article.append(ui('p','Results appear once the promotion starts and sales are recorded.','promo-result-note'));
  return article;
 }
 async function showPerformance(item,box){
  const key=item.id+':'+item.revision+':'+state.today;box.replaceChildren(ui('p','Loading results…','promo-result-note'));
  try{if(!performance.has(key))performance.set(key,api('/api/promotions/'+item.id+'/performance'));const result=await performance.get(key);if(!box.isConnected)return;box.replaceChildren(...summary(result,item));}
  catch(error){performance.delete(key);if(box.isConnected)box.replaceChildren(data('p',error.message,'promo-result-note is-error'));}
 }
 function summary(result,item){
  if(!result.comparedDays){return[ui('p',result.recordedDays?'Projections are not available for the recorded days yet.':'No sales have been recorded for these days yet.','promo-result-note')];}
  const up=result.differenceCents>0,down=result.differenceCents<0,grid=node('div',undefined,'promo-result-grid');
  const metric=(label,value,cls)=>{const cell=node('div',undefined,'promo-metric'+(cls?' '+cls:''));cell.append(ui('span',label),data('strong',value));grid.append(cell);};
  metric('Sales',money(result.actualCents));metric('Normal projection',money(result.projectedCents));
  metric('Difference',(up?'▲ +':down?'▼ −':'● ')+money(Math.abs(result.differenceCents))+(result.differencePercent===null?'':' ('+(up?'+':down?'−':'')+Math.abs(result.differencePercent)+'%)'),up?'is-up':down?'is-down':'is-even');
  const days=result.comparedDays,total=result.days.length,note=ui('p',days===total?'Compared over {count} days.':'Compared over {count} of {total} days so far (days without saved sales or a projection are left out).','promo-result-note');
  note.textContent=note.textContent.replace('{count}',days).replace('{total}',total);
  const details=node('details',undefined,'promo-days'),summaryNode=ui('summary','Day by day'),table=node('table'),headRow=node('tr');
  const redemptions=result.redemptions;for(const label of ['Day','Sales','Projection','Difference',...(redemptions?['Redeemed']:[])])headRow.append(ui('th',label));const thead=node('thead');thead.append(headRow);const tbody=node('tbody');
  for(const day of result.days){const row=node('tr'),difference=day.actualCents!==null&&day.projectedCents!==null?day.actualCents-day.projectedCents:null;row.append(data('td',shortDate(day.date)),data('td',money(day.actualCents)),data('td',money(day.projectedCents)),data('td',difference===null?'—':(difference>0?'+':difference<0?'−':'')+money(Math.abs(difference))));if(difference!==null)row.lastChild.className=difference>0?'is-up':difference<0?'is-down':'';if(redemptions)row.append(redemptionCell(item,day,redemptions.canEdit));tbody.append(row);}
  table.append(thead,tbody);details.append(summaryNode,table);
  const parts=[grid,note];
  if(result.best)parts.push(howItWent(result,item));
  if(result.occurrences?.length)parts.push(repeatTable(result.occurrences));
  if(result.stores?.length)parts.push(storeTable(result.stores));
  if(redemptions)parts.push(redemptionSummary(redemptions));
  parts.push(details);
  return parts;
 }
 const signed=cents=>(cents>0?'+':cents<0?'−':'')+money(Math.abs(cents));
 const percent=value=>value===null||value===undefined?'—':(value>0?'+':value<0?'−':'')+Math.abs(value)+'%';
 const tone=value=>value>0?'is-up':value<0?'is-down':'';
 // How it went: best and worst days plus in-store versus delivery sales.
 function howItWent(result,item){
  const box=node('section',undefined,'promo-how'),grid=node('div',undefined,'promo-how-grid');box.append(ui('h4',item.status==='finished'?'How it went':'How it’s going so far'));
  const cell=(label,value,detail,cls)=>{const entry=node('div',undefined,'promo-how-cell'+(cls?' '+cls:''));entry.append(ui('span',label),data('strong',value));if(detail)entry.append(data('small',detail));grid.append(entry);};
  cell('Best day',shortDate(result.best.date),signed(result.best.differenceCents)+' vs projection',tone(result.best.differenceCents));
  if(result.worst.date!==result.best.date)cell('Weakest day',shortDate(result.worst.date),signed(result.worst.differenceCents)+' vs projection',tone(result.worst.differenceCents));
  if(result.channels){const total=result.channels.inStoreCents+result.channels.deliveryCents,share=total>0?Math.round(result.channels.deliveryCents/total*100):null;cell('In store',money(result.channels.inStoreCents),share===null?'':(100-share)+'% of sales');cell('Uber Eats + DoorDash',money(result.channels.deliveryCents),(share===null?'':share+'% of sales · ')+result.channels.days+(result.channels.days===1?' day with a Weekly report':' days with a Weekly report'));}
  box.append(grid);return box;
 }
 function table(heads,rows,cls){const wrap=node('div',undefined,'promo-table-wrap'+(cls?' '+cls:'')),element=node('table'),thead=node('thead'),headRow=node('tr');for(const label of heads)headRow.append(ui('th',label));thead.append(headRow);const tbody=node('tbody');for(const cells of rows){const row=node('tr');for(const cell of cells)row.append(cell);tbody.append(row);}element.append(thead,tbody);wrap.append(element);return wrap;}
 const cellOf=(text,cls)=>{const cell=data('td',text);if(cls)cell.className=cls;return cell;};
 function repeatTable(occurrences){const box=node('section',undefined,'promo-how');box.append(ui('h4','Each repeat'));box.append(table(['Week of','Days','Sales','Projection','Difference'],occurrences.map(entry=>[cellOf(new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(entry.weekStart+'T12:00:00Z'))),cellOf(String(entry.comparedDays)+' / '+entry.dates.length),cellOf(money(entry.actualCents)),cellOf(money(entry.projectedCents)),cellOf(entry.differenceCents===null?'—':signed(entry.differenceCents)+' ('+percent(entry.differencePercent)+')',tone(entry.differenceCents))])));return box;}
 function storeTable(stores){const box=node('section',undefined,'promo-how');box.append(ui('h4','Results by store'));box.append(table(['Store','Days compared','Sales','Projection','Difference'],stores.map(store=>[cellOf(store.name+(store.locationId===state.locationId?' (this store)':'')),cellOf(String(store.comparedDays)),cellOf(money(store.actualCents)),cellOf(money(store.projectedCents)),cellOf(store.differenceCents===null?'—':signed(store.differenceCents)+' ('+percent(store.differencePercent)+')',tone(store.differenceCents))])));return box;}
 function redemptionSummary(info){
  const box=node('section',undefined,'promo-how'),grid=node('div',undefined,'promo-how-grid');box.append(ui('h4','Redemptions'));
  const cell=(label,value,detail,cls)=>{const entry=node('div',undefined,'promo-how-cell'+(cls?' '+cls:''));entry.append(ui('span',label),data('strong',value));if(detail)entry.append(data('small',detail));grid.append(entry);};
  if(info.count===null){box.append(grid,ui('p',info.canEdit?'Enter each day’s redemptions in Day by day below.':'No redemptions have been recorded at this store yet.','promo-result-note'));return box;}
  cell('Redeemed',info.count.toLocaleString('en-AU'),info.days+(info.days===1?' day recorded':' days recorded'));
  cell('Discount cost',info.costCents===null?'—':money(info.costCents),info.costPerRedemptionCents===null?'Add a cost per redemption to the promotion':money(info.costPerRedemptionCents)+' each');
  cell('Extra sales per redemption',info.extraPerRedemptionCents===null?'—':signed(info.extraPerRedemptionCents),'',tone(info.extraPerRedemptionCents));
  cell('Extra sales after discount cost',info.netCents===null?'—':signed(info.netCents),info.comparedDays+(info.comparedDays===1?' day with sales, projection and count':' days with sales, projection and count'),tone(info.netCents));
  box.append(grid);return box;
 }
 // One day's redemption count; saving needs the value it replaces, so concurrent edits are caught.
 function redemptionCell(item,day,canEdit){
  const cell=node('td');if(!canEdit){cell.append(data('span',day.redemptions===null?'—':String(day.redemptions)));return cell;}
  const input=node('input');input.type='number';input.min='0';input.step='1';input.inputMode='numeric';input.className='promo-redeem-input';input.value=day.redemptions===null?'':String(day.redemptions);input.setAttribute('aria-label','Redemptions on '+shortDate(day.date));
  let saved=day.redemptions,busy=false;
  input.onchange=async()=>{if(busy)return;const raw=input.value.trim(),count=raw===''?null:Number(raw);if(count!==null&&(!Number.isInteger(count)||count<0)){input.setCustomValidity('Enter a whole number.');input.reportValidity();return;}input.setCustomValidity('');busy=true;input.disabled=true;
   try{const result=await api('/api/promotions/'+item.id+'/redemptions','PUT',{date:day.date,count,previous:saved});saved=result.count;day.redemptions=saved;performance.clear();input.classList.add('is-saved');setTimeout(()=>input.classList.remove('is-saved'),1200);}
   catch(error){input.value=saved===null?'':String(saved);$('promo-status').textContent=error.message;}
   finally{busy=false;input.disabled=false;}};
  cell.append(input);return cell;
 }
 async function renderLeaderboard(list){
  list.replaceChildren(ui('p','Loading the leaderboard…','promo-result-note'));
  try{const board=await api('/api/promotions/leaderboard');if(filter!=='leaderboard')return;
   if(!board.rows.length){const empty=node('div',undefined,'promo-empty');empty.append(ui('strong','No promotions to rank yet'),ui('p','Promotions appear here once they start and sales are recorded.'));list.replaceChildren(empty);return;}
   const medals={1:'gold',2:'silver',3:'bronze'};
   const rows=board.rows.map(row=>{const place=cellOf(row.rank===null?'—':String(row.rank),'promo-rank'+(medals[row.rank]?' is-'+medals[row.rank]:''));if(medals[row.rank])place.setAttribute('aria-label',medals[row.rank]+' · place '+row.rank);return[place,cellOf(row.name+(row.weekdays?' · '+model.weekdayText(row.weekdays):'')),cellOf(row.offer),cellOf(row.startDate===row.endDate?date(row.startDate):date(row.startDate)+' – '+date(row.endDate)),cellOf(String(row.comparedDays)),cellOf(row.differenceCents===null?'—':signed(row.differenceCents),tone(row.differenceCents)),cellOf(percent(row.differencePercent),tone(row.differencePercent))];});
   const wrap=table(['Rank','Promotion','Offer','Dates','Days compared','Extra sales','Lift'],rows,'promo-leaderboard');
   for(const [index,row] of board.rows.entries())if(medals[row.rank])wrap.querySelectorAll('tbody tr')[index].classList.add('is-'+medals[row.rank]);
   list.replaceChildren(ui('p','Ranked by lift over the normal projection at this store. Promotions without both saved sales and a projection stay unranked.','promo-result-note'),wrap);
  }catch(error){if(filter==='leaderboard')list.replaceChildren(data('p',error.message,'promo-result-note is-error'));}
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
 const values=()=>{const kind=model.kind($('promo-kind').value),raw=$('promo-value').value;return{name:$('promo-name').value,kind:$('promo-kind').value,value:!kind?.value||raw===''?null:kind.value==='percent'?Number(raw):Math.round(Number(raw)*100),channels:[...form.querySelectorAll('input[name=promo-channel]:checked')].map(input=>input.value),startDate:$('promo-start').value,endDate:$('promo-end').value,locationIds:[...form.querySelectorAll('input[name=promo-location]:checked')].map(input=>input.value),notes:$('promo-notes').value,
  // Switched-off features are left out, so the saved values stay as they are.
  ...(on('repeat')?{weekdays:[...form.querySelectorAll('input[name=promo-weekday]:checked')].map(input=>Number(input.value))}:{}),
  ...(on('uplift')?{expectedUplift:$('promo-uplift').value===''?null:Number($('promo-uplift').value)}:{}),
  ...(on('items')?{itemIds:chosenItems.map(item=>item.id)}:{}),
  ...(on('redemptions')?{redemptionCostCents:$('promo-redemption-cost').value===''?null:Math.round(Number($('promo-redemption-cost').value)*100)}:{})};};
 // Promotion products: a searchable list of the company's stock items.
 let chosenItems=[],catalogue=null;
 function renderChosen(){const host=$('promo-item-chips');host.replaceChildren();for(const item of chosenItems){const chip=node('span',undefined,'promo-item-chip');chip.append(data('span',item.name));const remove=node('button','×');remove.type='button';remove.setAttribute('aria-label','Remove '+item.name);remove.onclick=()=>{chosenItems=chosenItems.filter(entry=>entry.id!==item.id);renderChosen();searchItems();};chip.append(remove);host.append(chip);}}
 function searchItems(){const host=$('promo-item-results'),query=$('promo-item-search').value.trim().toLowerCase();host.replaceChildren();if(!query||!catalogue)return;const chosen=new Set(chosenItems.map(item=>item.id));
  const matches=catalogue.filter(item=>!chosen.has(item.id)&&(item.name+' '+item.sku+' '+item.unitAmount).toLowerCase().includes(query)).slice(0,8);
  if(!matches.length){host.append(ui('p','No matching stock items.','promo-field-hint'));return;}
  for(const item of matches){const option=node('button',undefined,'promo-item-option');option.type='button';option.setAttribute('role','option');option.append(data('span',item.name));if(item.unitAmount)option.append(data('small',item.unitAmount));option.onclick=()=>{if(chosenItems.length>=model.maxItems)return;chosenItems.push({id:item.id,name:item.name});renderChosen();$('promo-item-search').value='';searchItems();$('promo-item-search').focus();};host.append(option);}}
 $('promo-item-search').oninput=searchItems;
 $('promo-item-search').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();$('promo-item-results').querySelector('button')?.click();}};
 async function loadCatalogue(){if(catalogue||!on('items'))return;try{catalogue=(await api('/api/promotions/catalogue')).items;searchItems();}catch(error){$('promo-form-status').textContent=error.message;}}
 // Cover image: shown immediately, centre-cropped to 16:9 in the browser (up to 1600 × 900 JPEG) and uploaded after Save.
 function setCover(url,changed,data=null){if(cover.url?.startsWith('blob:'))URL.revokeObjectURL(cover.url);cover={changed,data,url};const preview=$('promo-cover-preview');preview.replaceChildren();preview.dataset.empty=String(!url);if(url){const image=node('img');image.src=url;image.alt=window.interfaceLabel?interfaceLabel('Cover image preview'):'Cover image preview';preview.append(image);}else preview.append(ui('span','No cover image','promo-cover-placeholder'));$('promo-cover-remove').hidden=!url;$('promo-cover-choose-label').textContent=url?(window.interfaceLabel?interfaceLabel('Change image'):'Change image'):(window.interfaceLabel?interfaceLabel('Add cover image'):'Add cover image');}
 async function prepare(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Choose a JPEG, PNG or WebP image.');if(file.size>25000000)throw Error('Choose an image smaller than 25 MB.');
  // Every cover uses one 16:9 shape (up to 1600 × 900) so it fits the Sales card, Home and the kiosk alike; other shapes are centre-cropped.
  const bitmap=await createImageBitmap(file),ratio=16/9,cropWidth=Math.min(bitmap.width,bitmap.height*ratio),cropHeight=cropWidth/ratio,width=Math.round(Math.min(1600,cropWidth)),height=Math.round(width/ratio),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,(bitmap.width-cropWidth)/2,(bitmap.height-cropHeight)/2,cropWidth,cropHeight,0,0,width,height);bitmap.close?.();
  for(const quality of [.86,.76,.66]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=1900000){const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);});return{data,url:URL.createObjectURL(blob)};}}
  throw Error('This image is too large. Try a smaller one.');
 }
 $('promo-cover-input').onchange=async()=>{const file=$('promo-cover-input').files[0];if(!file)return;$('promo-form-status').textContent='';try{const result=await prepare(file);setCover(result.url,true,result.data);}catch(error){$('promo-form-status').textContent=error.message;}finally{$('promo-cover-input').value='';}};
 $('promo-cover-remove').onclick=()=>setCover(null,Boolean(editing?.image)||cover.changed&&Boolean(editing?.image));
 function openEditor(item,trigger){
  if(!state?.canEdit)return;editing=item||null;requestId=item?null:crypto.randomUUID();returnFocus=trigger||document.activeElement;fillKinds();
  $('promo-dialog-title').textContent=item?(window.interfaceLabel?interfaceLabel('Edit promotion'):'Edit promotion'):(window.interfaceLabel?interfaceLabel('Add promotion'):'Add promotion');
  $('promo-name').value=item?.name||'';$('promo-kind').value=item?.kind||'percent';window.appSelects?.refresh?.($('promo-kind'));
  const kind=model.kind(item?.kind||'percent');$('promo-value').value=item&&Number.isInteger(item.value)?(kind?.value==='percent'?String(item.value):(item.value/100).toFixed(2)):'';
  const today=state.today;$('promo-start').value=item?.startDate||today;$('promo-end').value=item?.endDate||today;$('promo-notes').value=item?.notes||'';
  fillChoices($('promo-channels'),model.channels,item?.channels||['in-store'],'promo-channel');
  fillChoices($('promo-locations'),state.locations,item?.locationIds||[state.locationId],'promo-location');
  setCover(item?.image?.url||null,false);$('promo-cover-input').value='';
  $('promo-repeat-field').hidden=!on('repeat');$('promo-uplift-field').hidden=!on('uplift');$('promo-items-field').hidden=!on('items');$('promo-redemption-field').hidden=!on('redemptions');
  const weekdays=$('promo-weekdays');weekdays.replaceChildren();model.weekdayNames.forEach((label,index)=>{const choice=node('label',undefined,'promo-choice'),input=node('input');input.type='checkbox';input.name='promo-weekday';input.value=String(index);input.checked=Boolean(item?.weekdays?.includes(index));choice.append(input,ui('span',label));weekdays.append(choice);});
  $('promo-uplift').value=Number.isInteger(item?.expectedUplift)?String(item.expectedUplift):'';
  $('promo-redemption-cost').value=Number.isInteger(item?.redemptionCostCents)?(item.redemptionCostCents/100).toFixed(2):'';
  chosenItems=(item?.items||[]).map(entry=>({...entry}));renderChosen();$('promo-item-search').value='';$('promo-item-results').replaceChildren();loadCatalogue();
  $('promo-delete').hidden=!item;$('promo-form-status').textContent='';syncKind();snapshot=JSON.stringify(values());
  dialog.showModal();$('promo-name').focus();
 }
 function close(){if(saving)return;if((JSON.stringify(values())!==snapshot||cover.changed)&&!confirm(window.interfaceLabel?interfaceLabel('Discard changes to this promotion?'):'Discard changes to this promotion?'))return;dialog.close();}
 dialog.addEventListener('close',()=>{editing=null;setCover(null,false);if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 $('promo-close').onclick=close;$('promo-cancel').onclick=close;$('promo-kind').onchange=syncKind;
 const busy=value=>{saving=value;for(const control of form.querySelectorAll('button,input,select,textarea'))if(control.id!=='promo-close')control.disabled=value||control.id==='promo-value'&&$('promo-value-field').hidden;};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;const input=values();
  if(!input.channels.length){$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('Choose at least one sales channel.'):'Choose at least one sales channel.';return;}
  if(!input.locationIds.length){$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('Choose at least one location.'):'Choose at least one location.';return;}
  if(input.endDate&&input.startDate&&input.endDate<input.startDate){$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('The end date must be on or after the start date.'):'The end date must be on or after the start date.';$('promo-end').focus();return;}
  if(on('uplift')&&input.expectedUplift!==null&&(!Number.isInteger(input.expectedUplift)||input.expectedUplift<1||input.expectedUplift>300)){$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('Enter an expected uplift from 1% to 300%, or leave it blank.'):'Enter an expected uplift from 1% to 300%, or leave it blank.';$('promo-uplift').focus();return;}
  busy(true);$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('Saving…'):'Saving…';
  try{let saved=editing&&JSON.stringify(input)===snapshot?editing:editing?await api('/api/promotions/'+editing.id,'PUT',{...input,revision:editing.revision}):await api('/api/promotions','POST',{...input,requestId});
   // The promotion is saved; keep editing it (not creating another) if the image step fails.
   editing=saved;requestId=null;snapshot=JSON.stringify(input);
   if(cover.changed){$('promo-form-status').textContent=window.interfaceLabel?interfaceLabel('Saving image…'):'Saving image…';saved=cover.data?await api('/api/promotions/'+saved.id+'/image','PUT',{revision:saved.revision,data:cover.data}):await api('/api/promotions/'+saved.id+'/image','DELETE',{revision:saved.revision});editing=saved;cover.changed=false;}
   busy(false);dialog.close();await load();}
  catch(error){busy(false);$('promo-form-status').textContent=error.message;}
 };
 $('promo-delete').onclick=async()=>{if(!editing||saving)return;if(!confirm((window.interfaceLabel?interfaceLabel('Delete this promotion?'):'Delete this promotion?')+' '+editing.name))return;busy(true);try{await api('/api/promotions/'+editing.id,'DELETE',{revision:editing.revision});snapshot=JSON.stringify(values());busy(false);dialog.close();await load();}catch(error){busy(false);$('promo-form-status').textContent=error.message;}};
 // Promotion settings: one switch per optional feature, saved company-wide with a revision check.
 const settingsDialog=$('promo-settings-dialog');let settingsState=null,settingsBusy=false,settingsFocus=null;
 async function openSettings(trigger){settingsFocus=trigger;$('promo-settings-status').textContent='';$('promo-settings-list').replaceChildren(ui('p','Loading…','promo-result-note'));settingsDialog.showModal();
  try{settingsState=await api('/api/promotions/settings');const list=$('promo-settings-list');list.replaceChildren();
   for(const feature of model.features){const row=node('label',undefined,'promo-switch'),textBox=node('span',undefined,'promo-switch-text'),input=node('input');input.type='checkbox';input.role='switch';input.name='promo-feature';input.value=feature.id;input.checked=settingsState.features[feature.id]!==false;input.disabled=!settingsState.canEdit;textBox.append(ui('strong',feature.name),ui('small',feature.description));row.append(textBox,input,node('span',undefined,'promo-switch-track'));list.append(row);}}
  catch(error){$('promo-settings-status').textContent=error.message;}}
 const settingsValues=()=>Object.fromEntries([...settingsDialog.querySelectorAll('input[name=promo-feature]')].map(input=>[input.value,input.checked]));
 function closeSettings(){if(settingsBusy)return;if(settingsState&&JSON.stringify(settingsValues())!==JSON.stringify(Object.fromEntries(model.featureIds.map(id=>[id,settingsState.features[id]!==false])))&&!confirm(window.interfaceLabel?interfaceLabel('Discard changes to promotion settings?'):'Discard changes to promotion settings?'))return;settingsDialog.close();}
 settingsDialog.addEventListener('close',()=>{settingsState=null;if(settingsFocus?.isConnected)settingsFocus.focus({preventScroll:true});});
 settingsDialog.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
 $('promo-settings-close').onclick=closeSettings;$('promo-settings-cancel').onclick=closeSettings;
 $('promo-settings-open').onclick=event=>openSettings(event.currentTarget);
 $('promo-settings-form').onsubmit=async event=>{event.preventDefault();if(settingsBusy||!settingsState?.canEdit)return;settingsBusy=true;$('promo-settings-status').textContent=window.interfaceLabel?interfaceLabel('Saving…'):'Saving…';
  try{settingsState=await api('/api/promotions/settings','PUT',{revision:settingsState.revision,features:settingsValues()});settingsBusy=false;settingsDialog.close();await load();window.promotionItemFlags?.refresh?.();}
  catch(error){settingsBusy=false;$('promo-settings-status').textContent=error.message;}};
 // Post to Comms: an explicit company post created through the normal Comms API and its permissions.
 const postDialog=$('promo-post-dialog');let posting=null,postBusy=false,postFocus=null,postRequest=null;
 function openPost(item,trigger){posting=item;postFocus=trigger;postRequest=crypto.randomUUID();$('promo-post-status').textContent='';
  $('promo-post-heading').value=(item.status==='running'?'On now: ':'Coming up: ')+item.name;
  const when=item.startDate===item.endDate?date(item.startDate):date(item.startDate)+' to '+date(item.endDate);
  $('promo-post-body').value=[item.name+' — '+model.offer(item)+'.',(model.repeats(item)?'Every '+model.weekdayText(item.weekdays)+', ':'')+when+'.','Channels: '+model.channelText(item.channels)+'.','Stores: '+item.locationNames.join(', ')+'.',item.notes||''].filter(Boolean).join('\n');
  $('promo-post-cover-field').hidden=!item.image;$('promo-post-cover').checked=Boolean(item.image);$('promo-post-required-field').hidden=!state.comms?.require;$('promo-post-required').checked=false;
  postDialog.showModal();$('promo-post-heading').focus();}
 const closePost=()=>{if(!postBusy)postDialog.close();};
 postDialog.addEventListener('close',()=>{posting=null;if(postFocus?.isConnected)postFocus.focus({preventScroll:true});});
 postDialog.addEventListener('cancel',event=>{event.preventDefault();closePost();});
 $('promo-post-close').onclick=closePost;$('promo-post-cancel').onclick=closePost;
 $('promo-post-form').onsubmit=async event=>{event.preventDefault();if(postBusy||!posting)return;const title=$('promo-post-heading').value.trim(),text=$('promo-post-body').value.trim();
  if(!title||!text){$('promo-post-status').textContent=window.interfaceLabel?interfaceLabel('Enter a title and message.'):'Enter a title and message.';return;}
  postBusy=true;$('promo-post-status').textContent=window.interfaceLabel?interfaceLabel('Posting…'):'Posting…';
  try{const blocks=[];
   if(posting.image&&$('promo-post-cover').checked&&!$('promo-post-cover-field').hidden){const blob=await (await fetch(posting.image.url,{cache:'no-store'})).blob(),encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(blob);}),media=await api('/api/communications/media','POST',{name:'promotion-cover.jpg',data:encoded});blocks.push({type:'image',assets:[{id:media.id,name:media.name,mime:media.mime}],spans:[]});}
   for(const line of text.split('\n'))if(line.trim())blocks.push({type:'paragraph',spans:[{text:line}]});
   await api('/api/communications/posts','POST',{scope:'company',title,body:text,richText:{version:1,blocks},requireRead:Boolean(state.comms?.require&&$('promo-post-required').checked),requestId:postRequest});
   postBusy=false;$('promo-post-status').textContent='';postDialog.close();$('promo-status').textContent=window.interfaceLabel?interfaceLabel('Posted to Comms.'):'Posted to Comms.';}
  catch(error){postBusy=false;$('promo-post-status').textContent=error.message;}};
 $('promo-add').onclick=event=>openEditor(null,event.currentTarget);
 for(const button of panel.querySelectorAll('[data-promo-filter]'))button.onclick=()=>{filter=button.dataset.promoFilter;render();};
 const show=()=>{if(location.hash==='#promotions'&&actor)load();};
 window.addEventListener('hashchange',show);
 (async()=>{try{actor=await window.appAccess.initialSession();show();}catch{}})();
})();
