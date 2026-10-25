(()=>{
 window.addEventListener('before-location-switch',event=>{if(saving)event.preventDefault();else writeDraft();});

 const $=id=>document.getElementById(id),form=$('count-form');
 let session,products=[],quantities=Object.create(null),draftKey='',saving=false,historyLoaded=false,historyLoading=false,historyGeneration=0,reportGeneration=0;
 let cartKey='',parRefreshPending=false;const cartConfirmations=new Map();
 let requestId='',requestSignature='',draftWarning=false,selectedGroup='all';
 const rows=new Map(),groups=new Map();
 const wording=(original,values={})=>typeof interfaceLabel==='function'?interfaceLabel(original,values):original.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));
 const el=(tag,text,className)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;};
 function today(){const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=type=>parts.find(part=>part.type===type).value;return value('year')+'-'+value('month')+'-'+value('day');}
 async function api(url,method='GET',body){
  if(url==='/api/session'&&method==='GET')return appAccess.initialSession();
  const response=await fetch(url,{method,headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{}),'Content-Type':'application/json','X-CSRF-Token':session?.csrf||''},body:body===undefined?undefined:JSON.stringify(body)});
  if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save changes.');return data;
 }
 function setTemplate(element,original,values){element.dataset.appTemplate=original;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(original,values);}
 function hasCount(id){return Object.hasOwn(quantities,id)&&quantities[id].trim()!=='';}
 function writeDraft(){
  if(!draftKey)return;
  const draft={countDate:form.elements.countDate.value,notes:form.elements.notes.value,quantities,requestId,requestSignature};
  try{localStorage.setItem(draftKey,JSON.stringify(draft));draftWarning=false;$('count-draft-status').textContent=wording('Draft saved on this browser.');}
  catch{draftWarning=true;$('count-draft-status').textContent=wording('Browser storage is unavailable. Save your count before leaving this page.');}
 }
 function resetDraft(){quantities=Object.create(null);requestId='';requestSignature='';form.reset();form.elements.countDate.value=today();for(const row of rows.values())row.input.value='';writeDraft();updateProgress();filterRows();}
 function updateProgress(productId){
  refreshRecommendations(productId);
  const counted=products.filter(product=>hasCount(product.id)).length;setTemplate($('count-progress'),'{counted} of {total} items counted',{counted,total:products.length});
  for(const [id,group] of groups){const items=products.filter(product=>stockCountGroups.resolve(product)===id);setTemplate(group.progress,'{counted} of {total} items counted',{counted:items.filter(product=>hasCount(product.id)).length,total:items.length});}
  $('count-save').disabled=saving||!counted;
 }
 function readCart(){const stored=JSON.parse(localStorage.getItem(cartKey)||'{}');if(!stored||typeof stored!=='object'||Array.isArray(stored))throw Error('Your cart could not be read. Open Cart to check it.');return Object.fromEntries(Object.entries(stored).filter(([id,quantity])=>products.some(product=>product.id===id)&&Number.isInteger(quantity)&&quantity>0&&quantity<=999));}
 function recommendation(product,row){const level=product.par?.level;if(typeof level!=='number'||!Number.isFinite(level)||level<0)return null;if(!row.input.value.trim()||!row.input.validity.valid)return null;const counted=Number(row.input.value);return stockOrderRules.recommendation(product,level,counted);}
 function refreshRecommendations(productId){if(!cartKey)return;let cart={},error='';try{cart=readCart();}catch(failure){error=failure.message;}
  const badge=$('cart-badge');if(badge&&!error)badge.textContent=Object.values(cart).reduce((sum,value)=>sum+value,0);
  for(const product of products){if(productId&&product.id!==productId)continue;const row=rows.get(product.id);if(!row?.add)continue;const level=product.par?.level,known=typeof level==='number'&&Number.isFinite(level)&&level>=0,amount=recommendation(product,row),inCart=cart[product.id]||0,remaining=amount===null?0:Math.max(0,amount-inCart);setTemplate(row.par,known?'Par: {level}':'Par: —',{level:known?new Intl.NumberFormat('en-AU').format(level):''});
   if(known&&product.par.source!=='manual'&&typeof product.par.average==='number')row.par.title=wording('Average used: {average} per week',{average:new Intl.NumberFormat('en-AU',{maximumFractionDigits:5}).format(product.par.average)});else row.par.title='';
   setTemplate(row.recommended,'Recommended: {quantity}',{quantity:amount===null?'—':new Intl.NumberFormat('en-AU').format(amount)});
   const help=error?'Open Cart to check your saved cart.':!known?'Manual par or usage needed':amount===null?'Enter a valid count to see your recommended order.':amount>999?'Recommendation exceeds the 999-per-item cart limit.':amount===0?(inCart?'No order needed. In cart: {quantity}.':'No order needed'):inCart?'In cart: {quantity}':stockOrderRules.describe(product)?'Par − stock count · rounded to order rule':'Par − stock count';row.hint.classList.toggle('count-order-warning',Boolean(error)||amount>999);setTemplate(row.hint,help,{weeks:product.par?.weeksRecorded||0,quantity:inCart});row.par.dataset.parSource=product.par?.source||'unavailable';const source=product.par?.source==='manual'?'Manual par':known?(product.par.weeksRecorded===1?'Based on 1 completed week':'Average of {weeks} completed weeks'):'';setTemplate(row.source,source,{weeks:product.par?.weeksRecorded||0});
   row.add.disabled=!appAccess.can('orders.place')||Boolean(error)||saving||amount===null||amount>999||remaining===0||cartConfirmations.has(product.id);if(!cartConfirmations.has(product.id))setTemplate(row.add,amount===null||amount>999?'Add to cart':amount===0?'No order needed':remaining===0?'In cart':'Add {quantity} to cart',{quantity:remaining});row.add.setAttribute('aria-label',wording('Add recommended order for {name} to cart',{name:product.name}));
  }
 }
 function addRecommendation(product){const row=rows.get(product.id);if(saving||cartConfirmations.has(product.id))return;const amount=recommendation(product,row);if(amount===null||amount<1||amount>999)return;
  try{const cart=readCart(),current=cart[product.id]||0;if(current>=amount){refreshRecommendations();return;}cart[product.id]=amount;localStorage.setItem(cartKey,JSON.stringify(cart));setTemplate(row.feedback,'Added to cart · {quantity} {unit}',{quantity:amount-current,unit:amount-current===1?'unit':'units'});setTemplate(row.add,'Added to cart',{});row.add.classList.add('count-cart-added');const timer=setTimeout(()=>{cartConfirmations.delete(product.id);row.add.classList.remove('count-cart-added');refreshRecommendations();},1400);cartConfirmations.set(product.id,timer);refreshRecommendations();window.dispatchEvent(new CustomEvent('cart-updated',{detail:{key:cartKey}}));}
  catch(error){row.feedback.textContent=error.message||wording('Unable to add the recommendation to your cart.');}
 }
 async function refreshPar(){if(!session||saving||parRefreshPending||document.hidden)return;parRefreshPending=true;try{const catalogue=await api('/api/catalogue');if(saving)return;let regroup=false;for(const product of products){const latest=catalogue.products.find(record=>record.id===product.id);product.par=latest?.par||null;if(latest&&(product.minimumOrder!==latest.minimumOrder||product.orderRule!==latest.orderRule||product.roundingCutoff!==latest.roundingCutoff||product.roundDownThreshold!==latest.roundDownThreshold||product.roundUpThreshold!==latest.roundUpThreshold)){product.minimumOrder=latest.minimumOrder;product.orderRule=latest.orderRule;product.roundingCutoff=latest.roundingCutoff;product.roundDownThreshold=latest.roundDownThreshold;product.roundUpThreshold=latest.roundUpThreshold;regroup=true;}if(latest&&stockCountGroups.resolve(product)!==stockCountGroups.resolve(latest)){product.stockCountGroup=stockCountGroups.resolve(latest);regroup=true;}}if(regroup)buildRows();else refreshRecommendations();}catch{}finally{parRefreshPending=false;}}
 function filterRows(){
  const query=$('count-search').value.trim().toLowerCase(),groupId=selectedGroup;let visible=0;
  for(const product of products){const row=rows.get(product.id);const show=(groupId==='all'||stockCountGroups.resolve(product)===groupId)&&(product.name+' '+(product.sku||'')+' '+(product.unitAmount||'')+' '+(product.category||'')).toLowerCase().includes(query);row.element.hidden=!show;if(show)visible++;}
  for(const [id,group] of groups){const show=(!query&&(groupId==='all'||groupId===id))||products.some(product=>stockCountGroups.resolve(product)===id&&!rows.get(product.id).element.hidden);group.element.hidden=!show;}
  $('count-no-results').hidden=visible>0||!query;
 }
 function selectGroup(id){selectedGroup=id;for(const button of $('count-supplier').children){const active=button.dataset.stockCountGroup===id;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}filterRows();}
 function buildGroupMenu(){
  $('count-supplier').replaceChildren();
  for(const group of [{id:'all',name:'All groups'},...stockCountGroups.groups]){const button=el('button',wording(group.name));button.type='button';button.dataset.stockCountGroup=group.id;button.dataset.editId='count-group-filter-'+group.id;button.onclick=()=>selectGroup(group.id);$('count-supplier').append(button);}
  selectGroup(selectedGroup);
 }
 function reveal(input){$('count-search').value='';selectGroup('all');}
 form.addEventListener('keydown',event=>{if(event.isComposing||event.altKey||event.ctrlKey||event.metaKey||!event.target.matches('.count-quantity-field input'))return;const direction=event.key==='Enter'?(event.shiftKey?-1:1):['ArrowDown','ArrowRight'].includes(event.key)?1:['ArrowUp','ArrowLeft'].includes(event.key)?-1:0;if(!direction)return;event.preventDefault();event.stopPropagation();if(saving)return;const inputs=[...$('count-items').querySelectorAll('.count-quantity-field input')].filter(input=>!input.disabled&&input.getClientRects().length),index=inputs.indexOf(event.target),next=index>=0?inputs[index+direction]:null;if(next){next.focus();next.select();}});
 function buildRows(){
  $('count-items').replaceChildren();rows.clear();groups.clear();
  for(const storage of stockCountGroups.groups){
   const stock=products.filter(product=>stockCountGroups.resolve(product)===storage.id);
   const group=el('section',undefined,'count-stock-group');group.dataset.stockCountGroup=storage.id;group.dataset.editId='count-group-'+storage.id;group.setAttribute('aria-labelledby','count-group-'+storage.id+'-name');
   const heading=el('header',undefined,'count-stock-heading'),caption=el('div',undefined,'count-stock-caption'),name=el('h3',wording(storage.name)),progress=el('span',undefined,'stock-items-count'),column=el('span',wording('Count'),'count-column-heading');heading.classList.add('count-entry-heading');heading.dataset.editId='count-group-'+storage.id+'-summary';name.id='count-group-'+storage.id+'-name';name.dataset.editId=name.id;caption.append(name,progress);const cartColumn=el('span',wording('Cart'),'count-cart-column');heading.append(caption,column,cartColumn);const content=el('div',undefined,'count-stock-content');group.append(heading,content);groups.set(storage.id,{element:group,progress,title:name,name:storage.name});
   if(!stock.length)content.append(el('p',wording('No stock items in this group.'),'small'));
   for(const product of stock){
    const row=el('div',undefined,'count-item');row.dataset.productId=product.id;const details=el('div');const title=el('h3',product.name,'stock-name');title.dataset.userText='';details.append(title);
    if(product.sku||product.unitAmount||stockOrderRules.describe(product)){const meta=el('p',[product.sku?'SKU: '+product.sku:'',product.unitAmount,stockOrderRules.describe(product)].filter(Boolean).join(' · '),'small');meta.dataset.userText='';details.append(meta);}
    const label=el('label',undefined,'count-quantity-field'),caption=el('span',wording('Counted quantity'),'count-field-label'),input=el('input');label.append(caption);input.id='count-quantity-'+product.id;input.type='number';input.min='0';input.max='1000000';input.step='0.001';input.inputMode='decimal';input.enterKeyHint='next';input.placeholder='Not counted';label.htmlFor=input.id;input.setAttribute('aria-label',wording('Counted quantity')+' — '+product.name);input.value=quantities[product.id]||'';
    const stats=el('div',undefined,'count-order-stats'),par=el('strong',undefined,'count-item-par'),source=el('span',undefined,'count-par-source'),recommended=el('span',undefined,'count-item-recommended'),hint=el('span',undefined,'count-order-hint'),add=el('button',undefined,'count-recommend-add'),feedback=el('p',undefined,'count-cart-feedback');add.type='button';add.onclick=()=>addRecommendation(product);feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');hint.id='count-hint-'+product.id;source.id='count-source-'+product.id;input.setAttribute('aria-describedby',hint.id+' '+source.id);add.setAttribute('aria-describedby',hint.id);stats.append(par,source,hint);details.append(stats);const actions=el('div',undefined,'count-order-actions');actions.append(recommended,add,feedback);
    input.oninput=()=>{quantities[product.id]=input.value;writeDraft();updateProgress(product.id);feedback.textContent='';};input.addEventListener('invalid',()=>reveal(input));label.append(input);row.classList.add('count-order-item');row.append(details,label,actions);content.append(row);rows.set(product.id,{element:row,input,par,source,recommended,hint,add,feedback});
   }
   $('count-items').append(group);
  }
  updateProgress();filterRows();
 }
 function showView(){
  const view=location.hash==='#usage'?'usage':location.hash==='#history'?'history':'new';document.querySelectorAll('[data-count-view]').forEach(element=>element.hidden=element.dataset.countView!==view);
  document.querySelectorAll('.stock-count-nav a').forEach(link=>{if(link.hash==='#'+view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
  if(view==='history'&&session&&!historyLoaded)loadHistory();
 }
 function displayDate(value){return new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));}
 function renderReport(record){
  const report=$('count-report');report.replaceChildren();report.hidden=false;report.dataset.editId='stock-count-report-'+record.id;
  const title=el('h2',displayDate(record.countDate));title.dataset.userText='';const meta=el('p',[record.locationName,record.counterName,record.location].filter(Boolean).join(' · '));meta.dataset.userText='';report.append(title,meta);
  for(const storage of stockCountGroups.groups){const items=record.items.filter(item=>stockCountGroups.resolve(item)===storage.id);if(!items.length)continue;const group=el('section',undefined,'count-stock-group');group.dataset.stockCountGroup=storage.id;group.dataset.editId='stock-count-report-'+record.id+'-group-'+storage.id;const heading=el('header',undefined,'count-stock-heading'),name=el('h3',wording(storage.name)),column=el('span',wording('Count'),'count-column-heading');name.id=group.dataset.editId+'-name';group.setAttribute('aria-labelledby',name.id);heading.append(name,column);group.append(heading);const content=el('div',undefined,'count-stock-content');for(const item of items){const row=el('div',undefined,'count-item');row.dataset.productId=item.id;const itemName=el('span',item.name,'stock-name');itemName.dataset.userText='';if(item.unitAmount){const unit=el('span',item.unitAmount,'stock-unit-amount');unit.dataset.userText='';itemName.append(unit);}const quantity=el('strong',new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(item.quantity));quantity.dataset.userText='';row.append(itemName,quantity);content.append(row);}group.append(content);report.append(group);}
  if(record.notes){const notes=el('p',record.notes);notes.dataset.userText='';report.append(notes);}
 }
 async function viewCount(id){const version=++reportGeneration;$('count-message').textContent=wording('Loading count…');try{const record=await api('/api/stock-counts/'+encodeURIComponent(id));if(version!==reportGeneration)return;renderReport(record);$('count-message').textContent='';$('count-report').scrollIntoView({behavior:'smooth',block:'start'});}catch(error){if(version===reportGeneration)$('count-message').textContent=error.message;}}
 async function loadHistory(){
  if(!session||historyLoading)return;historyLoading=true;
  const version=++historyGeneration;$('count-history-refresh').disabled=true;
  try{const history=await api('/api/stock-counts');if(version!==historyGeneration)return;historyLoaded=true;$('count-history-list').replaceChildren();$('count-history-help').textContent=wording(appAccess.can('locations.all',session)?'Administrators can review counts from every location.':'Your location’s saved stock counts.');
   if(!history.length)$('count-history-list').append(el('p',wording('No stock counts saved yet.'),'empty'));
   for(const record of history){const row=el('div',undefined,'count-history-row');row.dataset.editId='stock-count-history-'+record.id;const details=el('div');const title=el('h3',[displayDate(record.countDate),record.location].filter(Boolean).join(' · '));title.dataset.userText='';const meta=el('p',record.counterName+' · '+wording('{count} items counted',{count:record.itemCount}),'small');meta.dataset.userText='';const button=el('button',wording('View count'));button.type='button';button.onclick=()=>viewCount(record.id);details.append(title,meta);row.append(details,button);$('count-history-list').append(row);}
  }catch(error){if(version===historyGeneration)$('count-message').textContent=error.message;}finally{if(version===historyGeneration){historyLoading=false;$('count-history-refresh').disabled=false;}}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(saving)return;const items=products.filter(product=>hasCount(product.id)).map(product=>({id:product.id,quantity:Number(quantities[product.id])}));if(!items.length){$('count-message').textContent=wording('Enter a quantity for at least one stock item.');return;}
  const body={countDate:form.elements.countDate.value,notes:form.elements.notes.value,items},signature=JSON.stringify(body);
  if(signature!==requestSignature||!requestId){requestId=crypto.randomUUID();requestSignature=signature;}body.requestId=requestId;writeDraft();saving=true;for(const control of form.elements)control.disabled=true;$('count-message').textContent=wording('Saving stock count…');
  try{const record=await api('/api/stock-counts','POST',body);try{localStorage.setItem('souvlaki-usage-updated-'+(session.dataScope||session.id),String(Date.now()));}catch{}resetDraft();historyLoaded=false;await loadHistory();location.hash='history';showView();renderReport(record);$('count-message').textContent=wording('Stock count saved.');}
  catch(error){$('count-message').textContent=error.message;}
  finally{saving=false;for(const control of form.elements)control.disabled=false;updateProgress();refreshPar();}
 };
 for(const key of ['countDate','notes'])form.elements[key].addEventListener('input',writeDraft);
 const initialAppSearch=new URLSearchParams(location.search).get('q');if(initialAppSearch)$('count-search').value=initialAppSearch.slice(0,120);
 $('count-search').oninput=filterRows;$('count-history-refresh').onclick=loadHistory;
 $('count-clear').onclick=()=>{if(Object.values(quantities).some(value=>value.trim())||form.elements.notes.value){if(!confirm(wording('Clear your unsaved stock count?')))return;}resetDraft();$('count-message').textContent=wording('Draft cleared.');};
 $('logout').onclick=async()=>{try{await api('/api/logout','POST');location.href=companyLoginUrl();}catch(error){$('count-message').textContent=error.message;}};
 for(const control of form.elements)control.disabled=true;$('count-history-refresh').disabled=true;
 window.addEventListener('storage',event=>{if(event.key===cartKey)refreshRecommendations();if(event.key==='souvlaki-usage-updated-'+(session?.dataScope||session?.id)){historyLoaded=false;refreshPar();if(location.hash==='#history')loadHistory();}});window.addEventListener('focus',()=>{refreshRecommendations();refreshPar();if(session&&location.hash==='#history')loadHistory();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshRecommendations();refreshPar();}});setInterval(refreshPar,60000);
 window.addEventListener('hashchange',showView);showView();
 window.addEventListener('interface-text-updated',()=>{if(session){for(const group of groups.values())group.title.textContent=wording(group.name);updateProgress();buildGroupMenu();if(!draftWarning)$('count-draft-status').textContent=wording('Draft saved on this browser.');}});
 (async()=>{
  try{session=await api('/api/session');if(!session.csrf){location.href=companyLoginUrl();return;}const legacyCartKey='souvlaki-cart-'+(session.id||session.username);cartKey=legacyCartKey+(session.locationId?'-'+session.locationId:'');try{if(session.canMigrateBrowserData&&localStorage.getItem(cartKey)===null&&localStorage.getItem(legacyCartKey)!==null)localStorage.setItem(cartKey,localStorage.getItem(legacyCartKey));}catch{}const legacyKey='souvlaki-stock-count-'+session.id;draftKey=legacyKey+(session.locationId?'-'+session.locationId:'');try{if(session.canMigrateBrowserData&&localStorage.getItem(draftKey)===null&&localStorage.getItem(legacyKey)!==null)localStorage.setItem(draftKey,localStorage.getItem(legacyKey));}catch{}const catalogue=await api('/api/catalogue');products=catalogue.products;
   form.elements.countDate.value=today();let restored=false;
   try{const draft=JSON.parse(localStorage.getItem(draftKey)||'null');if(draft&&typeof draft==='object'){for(const key of ['countDate','notes'])if(typeof draft[key]==='string')form.elements[key].value=draft[key];for(const product of products)if(typeof draft.quantities?.[product.id]==='string')quantities[product.id]=draft.quantities[product.id];requestId=typeof draft.requestId==='string'?draft.requestId:'';requestSignature=typeof draft.requestSignature==='string'?draft.requestSignature:'';restored=Object.values(quantities).some(value=>value.trim())||Boolean(form.elements.notes.value);}}catch{}
   buildRows();buildGroupMenu();for(const control of form.elements)control.disabled=false;updateProgress();$('count-history-refresh').disabled=false;$('count-draft-status').textContent=wording('Draft saves automatically on this browser.');$('count-loading').textContent='';if(restored)$('count-message').textContent=wording('Your unsaved count was restored.');showView();
  }catch(error){$('count-loading').textContent=error.message;}
 })();
})();
