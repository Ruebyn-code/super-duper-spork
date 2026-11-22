// Smarter wastage (display only; reads GET /api/wastage/insights, never writes):
// - Smart insights: this week so far against the same weekdays of the last four weeks, an 8-week cost trend, items wasted
//   on 3+ days in the last 28 days with a practical tip, and waste by weekday. Tapping a repeat item searches the log for it.
// - Recording help: Frequently wasted quick-pick chips, the item's usual reason filled in when none is chosen, a "usually"
//   quantity hint, a warning for unusually large quantities and a note when the item was already recorded today.
//   These only fill the open form; saving still uses the native Save wastage button.
(()=>{
 const $=id=>document.getElementById(id),page=document.querySelector('.wastage-page');if(!page||!$('waste-lines'))return;
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
 const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
 const money=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format((cents||0)/100),number=value=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(value);
 const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],weekdayNames=['Mondays','Tuesdays','Wednesdays','Thursdays','Fridays','Saturdays','Sundays'];
 let data=null,loading=0;const usual=new Map();
 const key=(id,unitAmount)=>id+'\u0000'+(unitAmount||'');

 // ---- Insights section (after the summary cards) ----
 const section=el('section',undefined,'management waste-insights');section.setAttribute('aria-labelledby','waste-insights-title');section.hidden=true;
 section.innerHTML='<div class="waste-panel-heading"><h2 id="waste-insights-title"></h2><span class="waste-insights-note"></span></div><div class="waste-insights-grid"><article class="waste-insight" data-card="trend"></article><article class="waste-insight" data-card="repeat"></article><article class="waste-insight" data-card="days"></article></div>';
 (document.querySelector('.waste-metrics')||$('waste-filters'))?.after(section);
 const card=name=>section.querySelector('[data-card="'+name+'"]');
 function bars(values,{current=-1,labels=[],title=''}={}){const max=Math.max(...values,1),chart=el('div',undefined,'waste-bars');chart.setAttribute('role','img');chart.setAttribute('aria-label',title);
  values.forEach((value,index)=>{const col=el('span',undefined,'waste-bar'+(index===current?' current':''));col.style.setProperty('--h',Math.max(value?6:2,Math.round(value/max*100))+'%');col.title=(labels[index]?labels[index]+': ':'')+money(value);const label=el('i',labels[index]||'');col.append(label);chart.append(col);});return chart;}
 function renderInsights(){
  if(!data){section.hidden=true;return;}section.hidden=false;
  section.querySelector('#waste-insights-title').textContent=word('Smart insights');section.querySelector('.waste-insights-note').textContent=word('From recorded wastage at this location');
  // Trend
  const trend=card('trend'),c=data.comparison,change=c.changePercent;trend.replaceChildren(el('h3',word('This week so far')));
  const value=el('strong',money(c.thisWeekCents),'waste-insight-value');trend.append(value);
  if(change!==null){const up=change>0,chip=el('span',(up?'▲ ':change<0?'▼ ':'● ')+word('{percent}% vs usual',{percent:Math.abs(change)}),'waste-change '+(up?'up':change<0?'down':'flat'));trend.append(chip);}
  else trend.append(el('span',word('No earlier weeks to compare yet'),'waste-change flat'));
  trend.append(el('p',word(c.weekdays===7?'Compared with the average of the last 4 full weeks.':'Compared with the same {days} days of the last 4 weeks.',{days:c.weekdays})+(c.unknown?' '+word('Some items have no price, so costs are partly unknown.'):''),'waste-insight-help'));
  const starts=data.weeks.map(w=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(w.weekStart+'T00:00:00Z')));
  trend.append(bars(data.weeks.map(w=>w.knownCostCents),{current:7,labels:starts.map((s,i)=>i===7?word('Now'):s),title:word('Waste cost for the last 8 weeks')}));
  // Repeat items
  const repeat=card('repeat');repeat.replaceChildren(el('h3',word('Wasted again and again')));
  if(!data.repeat.length)repeat.append(el('p',word('Nothing has been wasted on 3 or more days in the last 4 weeks.'),'waste-insight-help'));
  for(const item of data.repeat){const row=el('button',undefined,'waste-repeat');row.type='button';row.title=word('Show {name} in the wastage log',{name:item.name});
   const top=el('span',undefined,'waste-repeat-top'),name=el('strong',item.name);name.dataset.userText='';top.append(name,el('span',word('{count} days',{count:item.days}),'waste-chip'),el('span',item.unpricedItems?word('{cost} known',{cost:money(item.knownCostCents)}):money(item.knownCostCents),'waste-repeat-cost'));
   row.append(top,el('span',word(item.tip),'waste-repeat-tip'));row.onclick=()=>{const search=$('waste-search');if(!search)return;search.value=item.name;search.dispatchEvent(new Event('input',{bubbles:true}));$('waste-history')?.scrollIntoView({behavior:'smooth',block:'start'});};repeat.append(row);}
  // Weekdays
  const days=card('days');days.replaceChildren(el('h3',word('When waste happens')));
  days.append(el('p',data.busiestWeekday===null?word('No wastage in the last 4 weeks.'):word('Most waste is recorded on {day}.',{day:word(weekdayNames[data.busiestWeekday])}),'waste-insight-lead'));
  days.append(bars(data.weekdays.map(d=>d.knownCostCents),{current:data.busiestWeekday??-1,labels:weekdays.map(d=>word(d)),title:word('Waste cost by weekday, last 4 weeks')}));
  days.append(el('p',word('Last 4 weeks, by the day the waste happened.'),'waste-insight-help'));
 }

 // ---- Recording help inside the Record wastage form ----
 const quick=el('div',undefined,'waste-quick');quick.hidden=true;$('waste-lines').before(quick);
 function renderQuick(){quick.replaceChildren();const items=(data?.quick||[]).filter(item=>productExists(item.id));quick.hidden=!items.length;if(!items.length)return;
  quick.append(el('span',word('Frequently wasted'),'waste-quick-label'));
  for(const item of items){const chip=el('button','+ '+item.name,'waste-quick-chip');chip.type='button';chip.dataset.userText='';chip.title=word('Add {name} · usually {quantity} · {reason}',{name:item.name,quantity:number(item.quantity),reason:word(wastageModel.reasonName(item.reason))});chip.onclick=()=>addItem(item);quick.append(chip);}}
 function productExists(id){const select=document.querySelector('#waste-lines .waste-line select');return !select||[...select.options].some(option=>option.value===id);}
 function lineParts(line){const natives=line.querySelectorAll('select.waste-native');return{product:line.querySelector('.waste-line-item select'),quantity:line.querySelector('.waste-stepper input'),unit:natives[0],reason:natives[1]};}
 function addItem(item){
  let line=[...document.querySelectorAll('#waste-lines .waste-line')].find(row=>!lineParts(row).product?.value);
  if(!line){$('waste-add')?.click();line=[...document.querySelectorAll('#waste-lines .waste-line')].pop();}if(!line)return;
  const parts=lineParts(line);if(!parts.product||![...parts.product.options].some(option=>option.value===item.id))return;
  parts.product.value=item.id;parts.product.dispatchEvent(new Event('change',{bubbles:true}));window.appSelects?.refresh(parts.product);setTimeout(()=>parts.quantity?.focus(),0);
 }
 function chosenUnit(select){const match=/^u(\d+)$/.exec(select?.value||'');if(!match)return null;try{return JSON.parse(select.dataset.units||'[]')[Number(match[1])]||null;}catch{return null;}}
 function hintFor(line){let hint=line.querySelector('.waste-smart-hint');if(!hint){hint=el('p','','waste-smart-hint');hint.setAttribute('aria-live','polite');line.append(hint);}return hint;}
 function update(line,fillReason){
  const parts=lineParts(line),id=parts.product?.value;if(!parts.product)return;
  const hint=hintFor(line);if(!id){hint.replaceChildren();hint.hidden=true;return;}
  const usualEntry=[...usual.values()].find(entry=>entry.id===id),today=(data?.todayItems||[]).find(entry=>entry.id===id),messages=[];
  if(usualEntry){if(fillReason&&parts.reason&&!parts.reason.value&&[...parts.reason.options].some(o=>o.value===usualEntry.reason)){parts.reason.value=usualEntry.reason;parts.reason.dispatchEvent(new Event('change',{bubbles:true}));window.appSelects?.refresh(parts.reason);}
   const unit=chosenUnit(parts.unit),per=unit?unit.perUnit:1,unitName=unit?(unit.measure?unit.name:unit.name.toLowerCase()):word('ordered packs'),usualHere=Math.round(usualEntry.quantity*per*1000)/1000;
   if(parts.quantity)parts.quantity.placeholder=word('Usually {quantity}',{quantity:number(usualHere)});
   messages.push(['info',word('Usually {quantity} {unit} · {reason}',{quantity:number(usualHere),unit:unitName,reason:word(wastageModel.reasonName(usualEntry.reason))})]);
   const entered=Number(parts.quantity?.value)/per;
   if(entered>0&&usualEntry.lines>=3&&entered>usualEntry.quantity*3)messages.push(['warn',word('That is more than 3 times the usual amount — please double-check the quantity.')]);}
  if(today&&$('waste-date')?.value===data.today)messages.push(['warn',word('Already recorded today: {quantity} ordered packs by {names}.',{quantity:number(today.quantity),names:today.by.join(', ')})]);
  hint.replaceChildren(...messages.map(([kind,text])=>el('span',text,'waste-smart-'+kind)));hint.hidden=!messages.length;
 }
 const lines=$('waste-lines');
 lines.addEventListener('change',event=>{const line=event.target.closest('.waste-line');if(!line)return;const isProduct=event.target===lineParts(line).product;setTimeout(()=>update(line,isProduct),0);});
 lines.addEventListener('input',event=>{const line=event.target.closest('.waste-line');if(line)update(line,false);});
 $('waste-date')?.addEventListener('change',()=>{for(const line of lines.querySelectorAll('.waste-line'))update(line,false);});
 new MutationObserver(()=>{for(const line of lines.querySelectorAll('.waste-line'))if(!line.querySelector('.waste-smart-hint'))update(line,false);}).observe(lines,{childList:true});

 // ---- Loading (on start, after saves/voids and when the summary changes) ----
 async function load(){const version=++loading;try{const session=await window.appAccess?.initialSession?.().catch(()=>null);const response=await fetch('/api/wastage/insights',{headers:{...(session?.locationId?{'X-Location-Id':session.locationId}:{})},cache:'no-store'});if(!response.ok)throw Error();const result=await response.json();if(version!==loading)return;data=result;usual.clear();for(const entry of data.usual)usual.set(key(entry.id,entry.unitAmount),entry);renderInsights();renderQuick();for(const line of lines.querySelectorAll('.waste-line'))update(line,false);}catch{if(version===loading&&!data)section.hidden=true;}}
 let timer=0;const later=()=>{clearTimeout(timer);timer=setTimeout(load,400);};
 const cost=$('waste-cost');if(cost)new MutationObserver(later).observe(cost,{childList:true,characterData:true,subtree:true});
 window.addEventListener('interface-text-updated',()=>{renderInsights();renderQuick();});
 later();
})();
