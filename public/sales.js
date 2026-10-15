(()=>{

 const $=id=>document.getElementById(id),form=$('sales-form');if(!form||!appAccess.can('sales.view'))return;
 window.addEventListener('before-location-switch',event=>{if(busy)event.preventDefault();else if(dirty)saveDraft();});
 const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const money=value=>value===null?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
 const monday=date=>shift(date,-(new Date(date+'T00:00:00Z').getUTCDay()+6)%7);
 const dateLabel=date=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 function template(element,text,values={}){element.dataset.appTemplate=text;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(text,values);}
 function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
 let session,report,selectedWeek='',revision=0,busy=true,dirty=false,generation=0;
 const inputs=[];
 for(let index=0;index<7;index++){
  const row=el('div',undefined,'sales-day'),label=el('label'),name=el('span',weekdays[index]),date=el('span',undefined,'small'),input=el('input');
  row.dataset.editId='sales-day-'+index;label.htmlFor='sales-day-'+index;name.dataset.editId='sales-day-'+index+'-label';date.id='sales-date-'+index;date.dataset.userText='';
  input.id='sales-day-'+index;input.dataset.editId='sales-day-'+index+'-input';input.type='number';input.min=0;input.max=10000000;input.step='0.01';input.inputMode='decimal';input.placeholder='Not recorded';input.disabled=true;
  const field=el('div',undefined,'sales-currency-input'),currency=el('span','$','sales-currency-symbol');
  currency.setAttribute('aria-hidden','true');currency.dataset.userText='';currency.dataset.editId='sales-day-'+index+'-currency';
  field.append(currency,input);label.append(name,date);row.append(label,field);$('sales-days').append(row);inputs.push(input);
  input.oninput=()=>{dirty=true;saveDraft();renderProgress();};
 }
 async function api(url,method='GET',body){const response=await fetch(url,{method,headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{}),'Content-Type':'application/json','X-CSRF-Token':session?.csrf||''},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load sales.');return result;}
 const draftKey=()=>session&&selectedWeek?'souvlaki-sales-draft-'+session.id+(session.locationId?'-'+session.locationId:'')+'-'+selectedWeek:'';
 function saveDraft(){try{localStorage.setItem(draftKey(),JSON.stringify({revision,days:inputs.map(input=>input.value)}));$('sales-draft-status').textContent=wording('Unsaved sales are kept in this browser.');}catch{$('sales-draft-status').textContent=wording('Browser storage is unavailable. Save sales before leaving this page.');}}
 function renderProgress(){let total=0,count=0;for(const input of inputs)if(input.value!==''&&input.validity.valid){total+=Math.round(Number(input.value)*100);count++;}$('sales-entry-total').textContent=money(total);template($('sales-progress'),'{count} of 7 days recorded',{count});renderPerformance();}
 function renderPerformance(){
  if(!report)return;const projection=report.projection,currentEntry=selectedWeek===projection.weekStart;
  const performance=currentEntry?salesPerformance.compare(inputs.map(input=>input.value!==''&&input.validity.valid?Math.round(Number(input.value)*100):null),projection):projection.performance;
  salesPerformanceView.render(projection,performance,{unsaved:currentEntry&&dirty});
 }
 function setBusy(value){busy=value;form.setAttribute('aria-busy',String(value));for(const control of form.elements)control.disabled=value;for(const button of document.querySelectorAll('[data-entry-week]'))button.disabled=value;}
 function showView(){const view=location.hash==='#overview'?'overview':location.hash==='#projection'?'projection':(location.hash==='#report'||location.hash.startsWith('#expense-'))?'report':'entry';document.querySelectorAll('.sales-overview,.sales-performance,[data-edit-id="sales-intro"],[data-edit-id="sales-title"]').forEach(panel=>panel.hidden=['report','overview'].includes(view));$('sales-message').hidden=['report','overview'].includes(view);document.querySelector('.sales-page').classList.toggle('report-active',['report','overview'].includes(view));document.querySelectorAll('[data-sales-view]').forEach(panel=>panel.hidden=panel.dataset.salesView!==(['report','overview'].includes(view)?'weekly':view));document.querySelectorAll('.sales-nav a').forEach(link=>{if(link.hash==='#'+(view==='overview'?'report':view))link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});}
 function renderProjection(){
  if(!report)return;renderPerformance();const projection=report.projection;
  $('sales-current-period').textContent=dateLabel(projection.weekStart)+' – '+dateLabel(projection.weekEnd)+' · Melbourne';
  $('sales-projected-value').textContent=money(projection.projectedSalesCents);$('sales-budget-value').textContent=money(projection.budgetCents);
  template($('sales-projection-status'),projection.weeksRecorded===4?'Based on your location’s previous four complete weeks.':'{weeks} of 4 complete weeks. Record all seven days in each week to calculate your projection.',{weeks:projection.weeksRecorded});
  $('sales-spent-value').textContent=money(projection.spentCents)+(projection.pricePending?' + '+wording('prices pending'):'');$('sales-remaining-value').textContent=money(projection.remainingCents);
  template($('sales-budget-note'),projection.pricePending?'Some ordered items have prices pending. The remaining budget cannot be calculated yet.':projection.remainingCents===null?'Complete four weeks of sales to calculate your budget.':projection.remainingCents<0?'Orders placed are above this week’s budget.':'Budget remaining = 28% of projected sales − orders placed this week.');
  $('sales-remaining-value').classList.toggle('budget-over',projection.remainingCents!==null&&projection.remainingCents<0);
  $('sales-history').replaceChildren();for(const week of projection.history){
   const row=el('div',undefined,'sales-history-row'),details=el('div'),title=el('strong',dateLabel(week.weekStart)+' – '+dateLabel(week.weekEnd)),status=el('p',undefined,'small'),total=el('span',money(week.totalCents)+(week.complete?'':' · '+wording('incomplete'))),button=el('button',wording('Enter / edit sales'));
   row.dataset.editId='sales-history-'+week.weekStart;title.dataset.userText='';total.dataset.userText='';template(status,'{count} of 7 days recorded',{count:week.recordedDays});details.append(title,status);button.type='button';button.dataset.entryWeek=week.weekStart;button.disabled=busy;button.onclick=()=>{location.hash='entry';loadWeek(week.weekStart);};row.append(details,total,button);$('sales-history').append(row);
  }
  $('sales-daily-projections').replaceChildren();for(let index=0;index<7;index++){const day=projection.dailyProjections[index],row=el('div',undefined,'sales-projection-day'),label=el('span',wording(weekdays[index])),value=el('strong',money(day.amountCents));row.dataset.editId='sales-projection-day-'+index;value.dataset.userText='';row.append(label,value);$('sales-daily-projections').append(row);}
 }
 function setRecord(record,useDraft=true){
  selectedWeek=record.weekStart;revision=record.revision;dirty=false;let draft;
  if(useDraft)try{const legacyKey='souvlaki-sales-draft-'+session.id+'-'+selectedWeek;if(session.canMigrateBrowserData&&!localStorage.getItem(draftKey()+'-migrated')){if(localStorage.getItem(draftKey())===null&&localStorage.getItem(legacyKey)!==null)localStorage.setItem(draftKey(),localStorage.getItem(legacyKey));localStorage.setItem(draftKey()+'-migrated','true');}draft=JSON.parse(localStorage.getItem(draftKey())||'null');}catch{}
  if(draft&&Number.isSafeInteger(draft.revision)&&Array.isArray(draft.days)&&draft.days.length===7&&draft.days.every(value=>typeof value==='string')){dirty=true;revision=draft.revision;}
  else draft=null;
  for(let index=0;index<7;index++){inputs[index].value=draft?draft.days[index]:record.days[index]===null?'':(record.days[index]/100).toFixed(2);$('sales-date-'+index).textContent=dateLabel(shift(selectedWeek,index));}
  $('sales-week').value=selectedWeek;$('sales-entry-period').textContent=dateLabel(selectedWeek)+' – '+dateLabel(shift(selectedWeek,6));
  $('sales-draft-status').textContent=draft?wording(draft.revision===record.revision?'Unsaved sales restored from this browser.':'Your draft uses older saved sales. Reload the saved week before saving.'):record.updatedAt?wording('Saved sales loaded. You can edit and save this week again.') : '';
  renderProgress();
 }
 async function loadWeek(week='',useDraft=true){const version=++generation;setBusy(true);$('sales-message').textContent=wording('Loading sales…');try{const data=await api('/api/sales'+(week?'?week='+encodeURIComponent(week):''));if(version!==generation)return;report=data;setRecord(data.record,useDraft);renderProjection();$('sales-message').textContent='';}catch(error){if(version===generation){$('sales-message').textContent=error.message;$('sales-week').value=selectedWeek;}}finally{if(version===generation)setBusy(false);}}
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;generation++;setBusy(true);$('sales-message').textContent=wording('Saving sales…');
  try{const days=inputs.map(input=>input.value===''?null:Math.round(Number(input.value)*100));const record=await api('/api/sales','PUT',{weekStart:selectedWeek,days,revision});try{localStorage.removeItem(draftKey());localStorage.setItem('souvlaki-sales-updated-'+(session.dataScope||session.id),String(Date.now()));}catch{}setRecord(record,false);report=await api('/api/sales?week='+encodeURIComponent(selectedWeek));renderProjection();$('sales-message').textContent=wording('Daily sales saved. Projection and budget updated.');}
  catch(error){$('sales-message').textContent=error.message;}finally{setBusy(false);}
 };
 $('sales-week').onchange=()=>{if($('sales-week').value)loadWeek(monday($('sales-week').value));};$('sales-previous').onclick=()=>loadWeek(shift(selectedWeek,-7));$('sales-next').onclick=()=>loadWeek(shift(selectedWeek,7));$('sales-current').onclick=()=>loadWeek(report.projection.weekStart);
 $('sales-reload').onclick=()=>{if(dirty&&!confirm(wording('Discard unsaved sales for this week and reload saved values?')))return;try{localStorage.removeItem(draftKey());}catch{}loadWeek(selectedWeek,false);};
 $('logout').onclick=async()=>{try{await api('/api/logout','POST');location.href=companyLoginUrl();}catch(error){$('sales-message').textContent=error.message;}};
 async function refreshProjection(){if(!session||busy||document.hidden)return;const version=generation,week=selectedWeek;try{const data=await api('/api/sales?week='+encodeURIComponent(week));if(busy||version!==generation||week!==selectedWeek)return;report=data;if(!dirty)setRecord(data.record);renderProjection();}catch(error){if(version===generation)$('sales-message').textContent=error.message;}}
 window.addEventListener('hashchange',showView);window.addEventListener('interface-text-updated',()=>{renderProjection();renderProgress();});window.addEventListener('focus',refreshProjection);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshProjection();});window.addEventListener('storage',event=>{if(event.key==='souvlaki-sales-updated-'+(session?.dataScope||session?.id)||event.key==='souvlaki-usage-updated-'+(session?.dataScope||session?.id))refreshProjection();});setInterval(refreshProjection,60000);
 setBusy(true);showView();(async()=>{try{session=await api('/api/session');if(!session.csrf){location.href=companyLoginUrl();return;}await loadWeek();}catch(error){$('sales-message').textContent=error.message;}})();
})();
