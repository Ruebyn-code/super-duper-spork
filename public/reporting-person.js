// Reporting → Team → Activity: a detailed report for one person, shown when the activity is filtered to a single
// person (choose them in People or click their name). Built only from the already-loaded, permission-checked
// activity rows, so it never reads more data or writes anything.
(()=>{
 const panel=document.getElementById('report-activity-panel'),summary=document.getElementById('report-activity-summary');if(!panel||!summary)return;
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 const data=(tag,text,cls)=>{const element=node(tag,text,cls);element.dataset.userText='';return element;};
 const host=node('section',undefined,'person-report');host.id='report-person-report';host.hidden=true;host.setAttribute('aria-labelledby','report-person-name');summary.after(host);
 const hour12=time=>{const [h,m]=time.split(':').map(Number);return(h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h<12?' am':' pm');};
 const dayLabel=date=>new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const shortDay=date=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const shift=(date,days)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
 const weekday=date=>(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;
 const minutes=time=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
 const clockTime=value=>hour12(String(Math.floor(value/60)%24).padStart(2,'0')+':'+String(Math.round(value%60)).padStart(2,'0'));
 const duration=ms=>{const total=Math.round(ms/60000),h=Math.floor(total/60),m=total%60;return h?h+' h'+(m?' '+m+' min':''):m+' min';};
 // Shifts from this person's clock-ins and clock-outs (oldest first); unpaid meal breaks come off the hours.
 function shifts(rows){
  const list=[];let open=null;
  for(const row of [...rows].filter(row=>row.source==='clock').sort((a,b)=>a.at.localeCompare(b.at))){
   if(row.type==='clock-in'){if(open)list.push(open);open={start:row,end:null,breaks:[],breakStart:null,locationName:row.locationName};}
   else if(!open)continue;
   else if(row.type==='break-start')open.breakStart=row;
   else if(row.type==='break-end'&&open.breakStart){open.breaks.push({start:open.breakStart,end:row,meal:/meal/i.test(open.breakStart.title)});open.breakStart=null;}
   else if(row.type==='clock-out'){open.end=row;list.push(open);open=null;}
  }
  if(open)list.push(open);
  return list.map(item=>{const unpaid=item.breaks.filter(entry=>entry.meal).reduce((sum,entry)=>sum+Date.parse(entry.end.at)-Date.parse(entry.start.at),0);return{...item,unpaid,worked:item.end?Date.parse(item.end.at)-Date.parse(item.start.at)-unpaid:null};});
 }
 let state=null;
 document.addEventListener('report-activity-drawn',event=>{state=event.detail;draw();});
 function bars(entries,format=value=>String(value)){
  const max=Math.max(1,...entries.map(entry=>entry.value)),list=node('div',undefined,'person-report-bars');
  for(const entry of entries){const row=node('div',undefined,'person-report-bar');row.title=entry.label+': '+format(entry.value);row.append(data('span',entry.label,'person-report-bar-label'));const track=node('span',undefined,'person-report-bar-track'),fill=node('span',undefined,'person-report-bar-fill');fill.style.setProperty('--size',(entry.value/max*100).toFixed(1)+'%');track.append(fill);row.append(track,data('strong',format(entry.value)));list.append(row);}
  return list;
 }
 function card(title,...children){const section=node('section',undefined,'person-report-card');section.append(node('h3',word(title)),...children);return section;}
 function draw(){
  const rows=state?.rows||[],keys=new Set(rows.map(row=>row.userKey));
  if(!state?.result||keys.size!==1||!rows.length){host.hidden=true;host.replaceChildren();return;}
  const name=rows[0].userName,key=rows[0].userKey,dates=[...new Set(rows.map(row=>row.date))].sort(),places=[...new Set(rows.flatMap(row=>String(row.locationName||'').split(', ')).filter(Boolean))];
  host.hidden=false;host.replaceChildren();
  // Header.
  const head=node('header',undefined,'person-report-head'),avatar=data('span',name.trim().split(/\s+/).map(part=>part[0]).slice(0,2).join('').toUpperCase()||'?','person-report-avatar'),titles=node('div');
  const title=data('h2',name);title.id='report-person-name';titles.append(node('p',word('Person report'),'person-report-eyebrow'),title,data('p',[places.join(', '),dayLabel(dates[0])+(dates.length>1?' – '+dayLabel(dates.at(-1)):'')].filter(Boolean).join(' · '),'person-report-meta'));
  const actions=node('div',undefined,'person-report-actions'),back=node('button',word('Everyone'),'person-report-button'),print=node('button',word('Print'),'person-report-button');back.type=print.type='button';
  back.onclick=()=>state.choose(null);print.onclick=()=>printReport(name);actions.append(back,print);head.append(avatar,titles,actions);host.append(head);
  // Headline numbers.
  const by=type=>rows.filter(row=>row.type===type).length,bySource=source=>rows.filter(row=>row.source===source).length,worked=shifts(rows),included=new Set(state.result.included),has=id=>included.has(state.result.sources.find(item=>item.id===id)?.name);
  const done=worked.filter(item=>item.worked!==null),hoursMs=done.reduce((sum,item)=>sum+item.worked,0),starts=worked.map(item=>minutes(item.start.time));
  const metrics=node('div',undefined,'person-report-metrics');
  const metric=(label,value,note)=>{const cell=node('div',undefined,'person-report-metric');cell.append(node('span',word(label)),data('strong',value));if(note)cell.append(data('small',note));metrics.append(cell);};
  metric('Actions',String(rows.length),word('{count} days active',{count:dates.length}));
  if(has('clock')&&worked.length){metric('Hours clocked',done.length?duration(hoursMs):'—',word('{count} completed shifts',{count:done.length})+(worked.length>done.length?' · '+word('{count} still open',{count:worked.length-done.length}):''));metric('Usual start',starts.length?clockTime(starts.reduce((a,b)=>a+b,0)/starts.length):'—',starts.length?word('Average of {count} clock-ins',{count:starts.length}):'');}
  if(has('checklists'))metric('Checklists',String(by('checklist-complete')),word('{count} steps done',{count:by('checklist-step')}));
  if(has('training'))metric('Training completed',String(by('training-complete')));
  for(const [source,label,unit] of [['orders','Orders','placed or recorded'],['counts','Stock counts','saved'],['wastage','Wastage','records'],['labels','Label batches','printed'],['prep','Prep items','ticked'],['equipment','Equipment','reports and services']])if(has(source)&&bySource(source))metric(label,String(bySource(source)),word(unit));
  host.append(metrics);
  const grid=node('div',undefined,'person-report-grid');
  // What they did.
  const sourceNames=new Map(state.result.sources.map(source=>[source.id,source.name])),counts=new Map();for(const row of rows)counts.set(row.source,(counts.get(row.source)||0)+1);
  grid.append(card('What they did',bars([...counts].sort((a,b)=>b[1]-a[1]).map(([source,value])=>({label:word(sourceNames.get(source)||source),value})))));
  // Day by day.
  const perDay=new Map();for(const row of rows)perDay.set(row.date,(perDay.get(row.date)||0)+1);const span=[];for(let date=dates[0];date<=dates.at(-1)&&span.length<92;date=shift(date,1))span.push(date);
  const days=node('div',undefined,'person-report-days'),peak=Math.max(1,...perDay.values());for(const date of span){const value=perDay.get(date)||0,column=node('span',undefined,'person-report-day'+(value?'':' is-empty'));column.style.setProperty('--size',(value/peak*100).toFixed(1)+'%');column.title=dayLabel(date)+': '+value;column.setAttribute('aria-label',dayLabel(date)+': '+value);days.append(column);}
  const axis=node('div',undefined,'person-report-axis');axis.append(data('span',shortDay(span[0])),data('span',shortDay(span.at(-1))));
  grid.append(card('Day by day',days,axis));
  // When they work: weekday × hour.
  const cells=new Map();for(const row of rows){const keyCell=weekday(row.date)+'|'+Number(row.time.slice(0,2));cells.set(keyCell,(cells.get(keyCell)||0)+1);}
  const hoursUsed=[...cells.keys()].map(item=>Number(item.split('|')[1])),from=Math.min(...hoursUsed),to=Math.max(...hoursUsed),hottest=Math.max(1,...cells.values());
  const heat=node('div',undefined,'person-report-heat');heat.style.setProperty('--columns',String(to-from+1));heat.setAttribute('role','table');heat.setAttribute('aria-label',word('Actions by weekday and hour'));
  heat.append(node('span','', 'person-report-heat-corner'));for(let h=from;h<=to;h++)heat.append(node('span',h%3===from%3?hour12(String(h).padStart(2,'0')+':00').replace(':00',''):'','person-report-heat-hour'));
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((label,day)=>{heat.append(node('span',word(label),'person-report-heat-day'));for(let h=from;h<=to;h++){const value=cells.get(day+'|'+h)||0,cell=node('span',undefined,'person-report-heat-cell');cell.style.setProperty('--heat',(value/hottest).toFixed(2));cell.title=word(label)+' '+hour12(String(h).padStart(2,'0')+':00')+': '+value;heat.append(cell);}});
  grid.append(card('When they work',heat));
  // Where.
  if(places.length>1){const perPlace=new Map();for(const row of rows)for(const place of String(row.locationName||'').split(', ').filter(Boolean))perPlace.set(place,(perPlace.get(place)||0)+1);grid.append(card('Locations',bars([...perPlace].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value})))));}
  host.append(grid);
  // Shifts.
  if(worked.length){const table=node('table'),headRow=node('tr');for(const label of ['Date','Clocked in','Clocked out','Unpaid breaks','Hours'])headRow.append(node('th',word(label)));const thead=node('thead');thead.append(headRow);const tbody=node('tbody');
   for(const item of [...worked].reverse().slice(0,60)){const row=node('tr');row.append(data('td',dayLabel(item.start.date)),data('td',hour12(item.start.time)),data('td',item.end?(item.end.date!==item.start.date?shortDay(item.end.date)+' ':'')+hour12(item.end.time):word('Still clocked in')),data('td',item.unpaid?duration(item.unpaid):'—'),data('td',item.worked===null?'—':duration(item.worked)));tbody.append(row);}
   table.append(thead,tbody);const wrap=node('div',undefined,'person-report-table');wrap.append(table);host.append(card('Shifts',wrap,node('p',word('From clock-ins and clock-outs in this period. Unpaid meal breaks are taken off; paid rest breaks are not.'),'person-report-note')));}
  // Checklists and training they finished.
  const finished=rows.filter(row=>row.type==='checklist-complete'||row.type==='training-complete').slice(0,30);
  if(finished.length){const list=node('ul',undefined,'person-report-list');for(const row of finished){const item=node('li');item.append(data('strong',row.title),data('span',dayLabel(row.date)+' '+hour12(row.time)+(row.locationName?' · '+row.locationName:'')));list.append(item);}host.append(card('Checklists and training completed',list));}
  // Latest actions.
  const recent=node('ul',undefined,'person-report-list');for(const row of rows.slice(0,15)){const item=node('li');item.append(data('strong',row.title),data('span',[dayLabel(row.date)+' '+hour12(row.time),row.detail,row.locationName].filter(Boolean).join(' · ')));recent.append(item);}
  host.append(card('Latest actions',recent,node('p',word('The full timeline for {name} is below.',{name}),'person-report-note')));
 }
 function printReport(name){const win=window.open('','_blank');if(!win)return;const doc=win.document;doc.title=name;const style=doc.createElement('style');style.textContent=[...document.styleSheets].map(sheet=>{try{return[...sheet.cssRules].map(rule=>rule.cssText).join('\n');}catch{return'';}}).join('\n')+'\nbody{padding:16px;background:#fff}.person-report-actions{display:none}';doc.head.append(style);doc.body.append(host.cloneNode(true));setTimeout(()=>{win.focus();win.print();},300);}
})();
