// Reporting charts: a set of charts for every report, drawn from the rows Reporting has already loaded
// (financial/detail rows, the classic daily/supplier/usage results, training and checklist progress, and staff
// activity). Display only: it never reads the server or writes, and groups with any unrecorded amount show —
// instead of a partial total.
(()=>{
 const panel=document.getElementById('report-topic-chart');if(!panel)return;
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 const data=(tag,text,cls)=>{const element=node(tag,text,cls);element.dataset.userText='';return element;};
 const money=cents=>cents===null||cents===undefined?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:Math.abs(cents)>=100000?0:2}).format(cents/100);
 const count=value=>value===null||value===undefined?'—':Number(value).toLocaleString('en-AU',{maximumFractionDigits:3});
 const pct=value=>value===null||value===undefined?'—':(Math.round(value*10)/10).toLocaleString('en-AU')+'%';
 const shortDate=value=>value?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(String(value).slice(0,10)+'T12:00:00Z')):'';
 const monday=date=>{const value=new Date(String(date).slice(0,10)+'T12:00:00Z');value.setUTCDate(value.getUTCDate()-((value.getUTCDay()+6)%7));return value.toISOString().slice(0,10);};
 const hour12=h=>(h%12||12)+(h<12?' am':' pm');
 const weekdays=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const groupName=key=>window.reportingModel?.groups?.[key]||key;
 // Strict grouping: each bucket adds up one or more fields; any unrecorded value makes that bucket's figure unknown.
 function group(rows,keyOf,fields){
  const buckets=new Map();
  for(const row of rows){const key=keyOf(row)??'Not recorded',entry=buckets.get(key)||{key,values:fields.map(()=>0),known:fields.map(()=>true)};
   fields.forEach((field,index)=>{if(field===null){entry.values[index]+=1;return;}const value=typeof field==='function'?field(row):row[field];if(Number.isFinite(value))entry.values[index]+=value;else entry.known[index]=false;});buckets.set(key,entry);}
  return[...buckets.values()].map(entry=>({key:entry.key,values:entry.values.map((value,index)=>entry.known[index]?value:null)}));
 }
 const total=(rows,field)=>rows.length&&rows.every(row=>Number.isFinite(row[field]))?rows.reduce((sum,row)=>sum+row[field],0):null;
 const byDate=list=>list.sort((a,b)=>String(a.key).localeCompare(String(b.key)));
 const byValue=list=>list.sort((a,b)=>Math.abs(b.values[0]??0)-Math.abs(a.values[0]??0));
 // Chart specs: {type:'columns'|'bars'|'donut', title, entries|parts, series, format, label, signed, note}
 const columns=(title,entries,series,format,extra={})=>({type:'columns',title,entries:(extra.sorted?entries:byDate(entries)).slice(-31),more:Math.max(0,entries.length-31),series,format,label:extra.label||shortDate,...extra});
 const bars=(title,entries,series,format,extra={})=>({type:'bars',title,entries:(extra.keepOrder?entries:byValue(entries)).slice(0,12),more:Math.max(0,entries.length-12),series,format,label:extra.label||(key=>String(key)),...extra});
 const donut=(title,parts,format,extra={})=>({type:'donut',title,parts:parts.filter(part=>part.value!==0),unknown:parts.filter(part=>part.value===null).map(part=>part.label),format,...extra});
 const builders={
  finance(reports,rows){const weeks=group(rows,row=>row.weekStart,['salesCents','totalCostsCents','profitCents']),charts=[
   columns('Sales and total costs by week',weeks.map(week=>({key:week.key,values:[week.values[0],week.values[1]]})),['Sales','Total costs'],money),
   columns('Profit by week',weeks.map(week=>({key:week.key,values:[week.values[2]]})),['Profit'],money,{signed:true}),
   donut('Where the money went',[['costOfGoodsCents','Cost of goods'],['labourCents','Labour'],['opExCents','Operating expenses'],['roCents','R&O']].map(([field,label])=>({label,value:total(rows,field)})),money),
   columns('Profit margin by week',weeks.map(week=>({key:week.key,values:[week.values[0]>0&&week.values[2]!==null?week.values[2]/week.values[0]*100:null]})),['Margin'],pct,{signed:true})];
   if(reports.length>1)charts.push(bars('Sales by location',group(rows,row=>row._location?.name,['salesCents']),['Sales'],money));return charts;},
  reconciliation(reports,rows){return[
   columns('Sales by day',group(rows,row=>row.date,['salesCents']),['Sales'],money),
   donut('Sales by channel',[['tillSalesCents','Till'],['uberEatsCents','Uber Eats'],['doorDashCents','DoorDash']].map(([field,label])=>({label,value:total(rows,field)})),money),
   donut('How customers paid',[['cashCents','Cash'],['eftposCents','Eftpos'],['pettyCashCents','Petty cash']].map(([field,label])=>({label,value:total(rows,field)})),money),
   columns('Cash variance by day',group(rows,row=>row.date,['varianceCents']),['Variance'],money,{signed:true})];},
  platforms(reports,rows){return[
   bars('Fees and expected pay by platform',group(rows,row=>row.name,['totalFeesCents','expectedPayCents']),['Total fees','Expected pay'],money),
   donut('What the fees are made of',[['feesCents','Fees'],['marketingCents','Marketing'],['refundsCents','Refunds']].map(([field,label])=>({label,value:total(rows,field)})),money),
   columns('Platform fees by week',group(rows,row=>row.weekStart,['totalFeesCents']),['Total fees'],money)];},
  expenses(reports,rows){return[
   donut('Expenses by category',group(rows,row=>row.category,['totalCents']).map(entry=>({label:String(entry.key),value:entry.values[0]})),money),
   columns('Expenses by week',group(rows,row=>row.weekStart,['totalCents']),['Expenses'],money),
   bars('Biggest expenses',group(rows,row=>row.name,['totalCents']),['Total'],money)];},
  'order-lines'(reports,rows){return[
   bars('Cost of goods by supplier',group(rows,row=>row.supplier,['totalCents']),['Order cost'],money),
   bars('Most ordered items by cost',group(rows,row=>row.name,['totalCents']),['Order cost'],money),
   columns('Cost of goods by week',group(rows,row=>row.costDate?monday(row.costDate):null,['totalCents']),['Order cost'],money),
   donut('Cost by storage area',group(rows,row=>row.group,['totalCents']).map(entry=>({label:groupName(entry.key),value:entry.values[0]})),money)];},
  invoices(reports,rows){return[
   bars('Invoices by supplier',group(rows,row=>row.supplier,['totalCents']),['Invoice total'],money),
   columns('Invoice totals by week',group(rows,row=>row.weekStart,['totalCents']),['Invoice total'],money),
   donut('Subtotal and GST',[['subtotalCents','Subtotal'],['taxCents','GST']].map(([field,label])=>({label,value:total(rows,field)})),money)];},
  bundles(reports,rows){return[
   columns('Invoice totals by week',group(rows,row=>row.weekStart,['totalCents']),['Invoice total'],money),
   columns('Invoices per week',group(rows,row=>row.weekStart,['count','missingTotals']),['Invoices','Missing totals'],count)];},
  transfers(reports,rows){return[
   donut('Transfers in and out',group(rows,row=>row.direction,[null]).map(entry=>({label:String(entry.key),value:entry.values[0]})),count),
   bars('Units transferred by item',group(rows,row=>row.name,['quantity']),['Units'],count),
   columns('Transfer cost by week',group(rows.filter(row=>row.moveCosts),row=>row.costDate?monday(row.costDate):null,['totalCents']),['Cost'],money)];},
  counts(reports,rows){return[
   donut('Count entries by area',group(rows,row=>row.group,[null]).map(entry=>({label:groupName(entry.key),value:entry.values[0]})),count),
   columns('Count entries by day',group(rows,row=>row.date,[null]),['Entries'],count),
   bars('Most counted items',group(rows,row=>row.name,[null]),['Entries'],count)];},
  cycles(reports,rows){return[
   bars('Stock used by item',group(rows,row=>row.name,['calculatedUsage']),['Used'],count),
   donut('Cycle status',group(rows,row=>row.status,[null]).map(entry=>({label:String(entry.key)==='complete'?'Complete':String(entry.key)==='negative'?'Negative usage':String(entry.key)==='missing'?'Missing counts':String(entry.key),value:entry.values[0]})),count),
   bars('Ordered by item',group(rows,row=>row.name,['ordered']),['Ordered'],count)];},
  'daily-overview'(reports){const rows=reports.flatMap(report=>(report.weekly||[]).map(week=>({...week,_location:report.location}))),weeks=group(rows,row=>row.weekStart||row.rangeStart,['salesCents','orderCostCents']),charts=[
   columns('Sales and order costs by week',weeks,['Sales','Order costs'],money),
   columns('Order costs as a share of sales',weeks.map(week=>({key:week.key,values:[week.values[0]>0&&week.values[1]!==null?week.values[1]/week.values[0]*100:null]})),['Share of sales'],pct)];
   if(reports.length>1)charts.push(bars('Sales by location',group(rows,row=>row._location?.name,['salesCents']),['Sales'],money));return charts;},
  sales(reports){const rows=reports.flatMap(report=>report.daily||[]),days=group(rows,row=>row.date,['salesCents','orderCostCents']),recorded=days.filter(day=>day.values[0]!==null),avg=weekdays.map((label,index)=>{const list=recorded.filter(day=>(new Date(day.key+'T12:00:00Z').getUTCDay()+6)%7===index);return{key:label,values:[list.length?Math.round(list.reduce((sum,day)=>sum+day.values[0],0)/list.length):null]};});return[
   columns('Sales by day',days.map(day=>({key:day.key,values:[day.values[0]]})),['Sales'],money),
   bars('Average sales by weekday',avg,['Average sales'],money,{keepOrder:true,label:key=>word(key)}),
   columns('Order costs by day',days.map(day=>({key:day.key,values:[day.values[1]]})),['Order costs'],money)];},
  orders(reports){const rows=reports.flatMap(report=>report.suppliers||[]),bySupplier=group(rows,row=>row.name,['orderCostCents','orderCount']);return[
   bars('Order costs by supplier',bySupplier.map(entry=>({key:entry.key,values:[entry.values[0]]})),['Order cost'],money),
   donut('Share of order costs',bySupplier.map(entry=>({label:String(entry.key),value:entry.values[0]})),money),
   bars('Orders by supplier',bySupplier.map(entry=>({key:entry.key,values:[entry.values[1]]})),['Orders'],count)];},
  stock(reports){const rows=reports.flatMap(report=>report.stockUsage?.items||[]);return[
   bars('Most used items',group(rows,row=>row.name,['used']),['Used'],count),
   bars('Most ordered items',group(rows,row=>row.name,['ordered']),['Ordered'],count),
   donut('Items by storage area',group(rows,row=>row.group,[null]).map(entry=>({label:groupName(entry.key),value:entry.values[0]})),count)];}
 };
 const statusNames={completed:'Completed','in-progress':'In progress','not-started':'Not started',overdue:'Overdue',cancelled:'Cancelled',missed:'Missed'};
 function progressCharts(view,rows){
  const status=donut(view==='training'?'Training status':'Checklist status',group(rows,row=>row.status,[null]).map(entry=>({label:word(statusNames[entry.key]||String(entry.key)),value:entry.values[0]})),count);
  const title=row=>view==='training'?row.courseTitle||row.title:row.title;
  const items=bars(view==='training'?'Completed by course':'Completed by checklist',group(rows,title,[null,row=>row.status==='completed'?1:0]).map(entry=>({key:entry.key,values:[entry.values[1],entry.values[0]]})),['Completed','Total'],count,{valueText:entry=>count(entry.values[0])+' / '+count(entry.values[1])});
  const places=bars('Completed by location',group(rows.flatMap(row=>(row.locationNames||[]).map(name=>({...row,_place:name}))),row=>row._place,[null,row=>row.status==='completed'?1:0]).map(entry=>({key:entry.key,values:[entry.values[1],entry.values[0]]})),['Completed','Total'],count,{valueText:entry=>count(entry.values[0])+' / '+count(entry.values[1])});
  const done=rows.filter(row=>row.completedAt),byDay=columns('Completed by day',group(done,row=>String(row.completedAt).slice(0,10),[null]),[view==='training'?'Completed':'Completed'],count);
  return[status,items,places,byDay];
 }
 function activityCharts(rows){
  const sourceNames=new Map((activity?.result?.sources||[]).map(source=>[source.id,source.name]));
  return[
   donut('Actions by type',group(rows,row=>row.source,[null]).map(entry=>({label:word(sourceNames.get(entry.key)||String(entry.key)),value:entry.values[0]})),count),
   columns('Actions by hour',Array.from({length:24},(_,hour)=>({key:hour,values:[rows.filter(row=>Number(row.time.slice(0,2))===hour).length]})).filter((entry,index,list)=>list.slice(0,index+1).some(item=>item.values[0])&&list.slice(index).some(item=>item.values[0])),['Actions'],count,{label:hour12,sorted:true}),
   bars('Actions by weekday',weekdays.map((label,index)=>({key:label,values:[rows.filter(row=>(new Date(row.date+'T12:00:00Z').getUTCDay()+6)%7===index).length]})),['Actions'],count,{keepOrder:true,label:key=>word(key)}),
   bars('Most active people',group(rows,row=>row.userName,[null]),['Actions'],count),
   columns('Actions by day',group(rows,row=>row.date,[null]),['Actions'],count)];
 }
 // Drawing.
 function legend(series){const list=node('div',undefined,'report-chart-legend');series.forEach((label,index)=>list.append(node('span',word(label),'report-chart-key is-'+index)));return list;}
 function drawColumns(spec){
  const values=spec.entries.flatMap(entry=>entry.values).filter(value=>value!==null),max=Math.max(1,...values.map(value=>Math.abs(value))),signed=spec.signed&&values.some(value=>value<0);
  const chart=node('div',undefined,'report-chart-columns'+(signed?' is-signed':''));chart.setAttribute('role','list');chart.style.setProperty('--count',String(spec.entries.length));
  const step=Math.ceil(spec.entries.length/8);
  spec.entries.forEach((entry,index)=>{const item=node('div',undefined,'report-chart-column');item.setAttribute('role','listitem');item.tabIndex=0;const label=spec.label(entry.key);
   const text=label+': '+spec.series.map((name,i)=>word(name)+' '+spec.format(entry.values[i])).join(' · ');item.title=text;item.setAttribute('aria-label',text);
   const stack=node('div',undefined,'report-chart-column-bars');stack.setAttribute('aria-hidden','true');
   if(signed){const up=node('span',undefined,'report-chart-half is-up'),down=node('span',undefined,'report-chart-half is-down');entry.values.forEach((value,i)=>{const bar=node('span',undefined,'report-chart-column-bar is-'+i+(value===null?' is-unknown':value<0?' is-negative':''));bar.style.setProperty('--size',(value===null?0:Math.abs(value)/max*100).toFixed(2)+'%');(value!==null&&value<0?down:up).append(bar);});stack.classList.add('is-signed');stack.append(up,down);}
   else entry.values.forEach((value,i)=>{const bar=node('span',undefined,'report-chart-column-bar is-'+i+(value===null?' is-unknown':''));bar.style.setProperty('--size',(value===null?0:Math.abs(value)/max*100).toFixed(2)+'%');stack.append(bar);});
   item.append(stack,data('span',index%step===0?label:'','report-chart-column-label'));chart.append(item);});
  return chart;
 }
 function drawBars(spec){
  const values=spec.entries.flatMap(entry=>entry.values).filter(value=>value!==null),max=Math.max(1,...values.map(value=>Math.abs(value)));
  const list=node('div',undefined,'report-chart-bars');list.setAttribute('role','list');
  for(const entry of spec.entries){const item=node('div',undefined,'report-chart-bar');item.setAttribute('role','listitem');item.tabIndex=0;const label=spec.label(entry.key);
   const text=label+': '+spec.series.map((name,i)=>word(name)+' '+spec.format(entry.values[i])).join(' · ');item.title=text;item.setAttribute('aria-label',text);
   const track=node('span',undefined,'report-chart-bar-track');track.setAttribute('aria-hidden','true');
   entry.values.forEach((value,i)=>{if(value===null)return;const fill=node('span',undefined,'report-chart-bar-fill is-'+i+(value<0?' is-negative':''));fill.style.setProperty('--size',(Math.abs(value)/max*100).toFixed(2)+'%');track.append(fill);});
   item.append(data('span',label,'report-chart-bar-label'),track,data('strong',spec.valueText?spec.valueText(entry):spec.format(entry.values[0]),'report-chart-bar-value'+(entry.values[0]<0?' is-negative':'')));list.append(item);}
  return list;
 }
 const palette=['var(--primary,#008cff)','color-mix(in srgb,var(--secondary,#45efc3) 75%,#0f766e)','#f59e0b','#8b5cf6','#ef4444','#14b8a6','#64748b','#ec4899'];
 function drawDonut(spec){
  const parts=spec.parts.filter(part=>part.value!==null&&part.value>0).sort((a,b)=>b.value-a.value),sum=parts.reduce((total,part)=>total+part.value,0),wrap=node('div',undefined,'report-chart-donut');
  const shown=parts.slice(0,7),rest=parts.slice(7).reduce((total,part)=>total+part.value,0);if(rest)shown.push({label:word('Other'),value:rest});
  let angle=0;const stops=shown.map((part,index)=>{const from=angle;angle+=part.value/sum*360;return palette[index%palette.length]+' '+from.toFixed(2)+'deg '+angle.toFixed(2)+'deg';});
  const ring=node('div',undefined,'report-chart-ring');ring.style.background='conic-gradient('+stops.join(',')+')';ring.setAttribute('role','img');ring.setAttribute('aria-label',shown.map(part=>part.label+' '+spec.format(part.value)+' ('+pct(part.value/sum*100)+')').join(', '));
  const centre=node('span',undefined,'report-chart-ring-centre');centre.append(data('strong',spec.format(sum)),node('small',word('Total')));ring.append(centre);
  const keys=node('ul',undefined,'report-chart-donut-keys');shown.forEach((part,index)=>{const item=node('li');const swatch=node('span',undefined,'report-chart-swatch');swatch.style.background=palette[index%palette.length];item.append(swatch,data('span',part.label),data('strong',spec.format(part.value)),data('small',pct(part.value/sum*100)));keys.append(item);});
  wrap.append(ring,keys);return wrap;
 }
 function card(spec){
  const usable=spec.type==='donut'?spec.parts.some(part=>part.value!==null&&part.value>0):spec.entries.some(entry=>entry.values.some(value=>value!==null&&value!==0));
  const box=node('section',undefined,'report-chart-card is-'+spec.type),head=node('div',undefined,'report-chart-head');head.append(node('h3',word(spec.title)));
  // Charts without recorded figures stay as a short note, so it is clear what will appear once figures are saved.
  if(!usable){box.classList.add('is-empty');box.append(head,node('p',word(spec.type==='donut'&&spec.unknown?.length?'Shows once these figures are recorded: {parts}.':'Nothing recorded for this period yet.',{parts:(spec.unknown||[]).join(', ')}),'report-chart-note'));return box;}
  if(spec.series?.length>1)head.append(legend(spec.series));box.append(head);
  box.append(spec.type==='columns'?drawColumns(spec):spec.type==='bars'?drawBars(spec):drawDonut(spec));
  const notes=[];if(spec.more)notes.push(word(spec.type==='columns'?'Showing the latest {count}.':'Showing the top {count}.',{count:spec.entries.length}));
  if(spec.type!=='donut'&&spec.entries.some(entry=>entry.values.some(value=>value===null)))notes.push(word('Periods or groups with figures not recorded yet show —.'));
  if(spec.type==='donut'&&spec.unknown?.length)notes.push(word('Not included because some figures are not recorded yet: {parts}.',{parts:spec.unknown.join(', ')}));
  if(notes.length)box.append(node('p',notes.join(' '),'report-chart-note'));
  return box;
 }
 function render(specs,anchor){
  const cards=specs.map(card).filter(Boolean);panel.replaceChildren();if(!cards.length||cards.every(item=>item.classList.contains('is-empty'))){panel.hidden=true;return;}
  // Charts with figures first; empty ones after them.
  cards.sort((a,b)=>Number(a.classList.contains('is-empty'))-Number(b.classList.contains('is-empty')));
  if(anchor&&panel.previousElementSibling!==anchor)anchor.after(panel);
  const head=node('div',undefined,'report-chart-panel-head'),title=node('h2',word('Charts'));title.id='report-topic-chart-title';head.append(title);const grid=node('div',undefined,'report-chart-grid');grid.append(...cards);panel.append(head,grid);panel.hidden=false;
 }
 // Charts sit straight after the headline numbers, above location rankings and the table.
 const home=document.createComment('report charts'),summaryBox=document.getElementById('report-detail-summary');if(summaryBox)summaryBox.after(panel);panel.before(home);
 let current='',reportsLoaded=null,activity=null,progress=null;
 function draw(){
  const view=current;if(!view){panel.hidden=true;return;}
  if(view==='activity'){if(!activity?.rows?.length){panel.hidden=true;return;}render(activityCharts(activity.rows),document.getElementById('report-activity-summary'));return;}
  if(view==='training'||view==='checklists'){if(progress?.view!==view||!progress.rows.length){panel.hidden=true;return;}render(progressCharts(view,progress.rows),document.getElementById('report-progress-summary'));return;}
  const builder=builders[view];if(!builder||!reportsLoaded?.length){panel.hidden=true;return;}
  const rows=window.reportingModel?.views?.[view]?window.reportingModel.raw(reportsLoaded,view):[];
  let specs=[];try{specs=builder(reportsLoaded,rows);}catch{specs=[];}
  if(home.nextSibling!==panel)home.after(panel);render(specs);
 }
 document.addEventListener('report-activity-drawn',event=>{activity=event.detail;if(current==='activity')draw();});
 document.addEventListener('report-progress-drawn',event=>{progress=event.detail;if(current===event.detail.view)draw();});
 window.reportCharts={update(view,reports){current=view;if(reports)reportsLoaded=reports;draw();}};
})();
