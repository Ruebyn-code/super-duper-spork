// Reporting → Staff activity: filters the loaded timeline by people, time of day and activity type (no extra reads).
(()=>{
 const $=id=>document.getElementById(id);if(!$('report-activity-panel'))return;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;},data=(tag,text,cls)=>{const node=el(tag,text,cls);node.dataset.userText='';return node;};
 const presets=[['all','All day',null,null],['morning','Morning','05:00','11:00'],['midday','Midday','11:00','15:00'],['afternoon','Afternoon','15:00','18:00'],['evening','Evening','18:00','23:00'],['overnight','Overnight','23:00','05:00'],['custom','Custom',null,null]];
 let result=null,rows=[],page=1,preset='all',chosen=null,sources=null,columns=null;
 const columnChoices=()=>[{id:'total',name:'Actions'},...(result?result.sources.filter(source=>result.included.includes(source.name)&&(!sources||sources.has(source.id))):[]),{id:'first',name:'First'},{id:'last',name:'Last'}];
 const showColumn=id=>!columns||columns.has(id);
 function columnsLabel(){const all=columnChoices(),count=all.filter(c=>showColumn(c.id)).length;$('report-activity-columns-text').textContent=count===all.length?'All columns':count===0?'Name only':count===1?all.find(c=>showColumn(c.id)).name:count+' columns';}
 function columnsUi(){const host=$('report-activity-columns');host.replaceChildren();for(const choice of columnChoices()){const label=el('label',undefined,'report-activity-person report-activity-column'),box=el('input');box.type='checkbox';box.checked=showColumn(choice.id);box.onchange=()=>{if(!columns)columns=new Set(columnChoices().map(c=>c.id));if(box.checked)columns.add(choice.id);else columns.delete(choice.id);columnsLabel();draw();};label.append(box,el('span',choice.name));host.append(label);}columnsLabel();}
 const hour=time=>{const [h,m]=time.split(':').map(Number);const suffix=h<12?'am':'pm',h12=h%12||12;return h12+(m?':'+String(m).padStart(2,'0'):'')+' '+suffix;};
 const dayLabel=date=>new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 function window_(){const item=presets.find(p=>p[0]===preset);if(preset==='custom')return[$('report-activity-from').value||'00:00',$('report-activity-to').value||'23:59'];return item[2]?[item[2],item[3]]:null;}
 function inWindow(time){const range=window_();if(!range)return true;const [from,to]=range;return from<=to?time>=from&&time<to:time>=from||time<to;}
 function presetsUi(){const select=$('report-activity-time');if(!select.options.length){for(const [id,label,from,to] of presets)select.add(new Option(from?label+' ('+hour(from)+' – '+hour(to)+')':label,id));select.onchange=()=>{preset=select.value;$('report-activity-custom').hidden=preset!=='custom';page=1;draw();};}select.value=preset;window.appSelects?.refresh?.(select);}
 const availableSources=()=>result?result.sources.filter(source=>result.included.includes(source.name)):[];
 function sourcesLabel(){const available=availableSources(),count=available.filter(source=>!sources||sources.has(source.id)).length;$('report-activity-sources-text').textContent=!sources||count===available.length?'All activity':count===0?'No activity selected':count===1?available.find(source=>sources.has(source.id)).name:count+' types';}
 function sourcesUi(){const host=$('report-activity-sources');host.replaceChildren();if(!result)return;const available=availableSources();if(!sources)sources=new Set(available.map(source=>source.id));const counts=new Map();for(const row of result.rows)counts.set(row.source,(counts.get(row.source)||0)+1);for(const source of available){const label=el('label',undefined,'report-activity-person report-activity-source'),box=el('input');box.type='checkbox';box.checked=sources.has(source.id);box.onchange=()=>{if(box.checked)sources.add(source.id);else sources.delete(source.id);sourcesLabel();page=1;draw();};const swatch=el('span','','report-activity-swatch');swatch.dataset.source=source.id;swatch.setAttribute('aria-hidden','true');label.append(box,swatch,el('span',source.name),el('small',String(counts.get(source.id)||0)));host.append(label);}sourcesLabel();}
 function peopleLabel(){const total=result?.people.length||0;$('report-activity-people-text').textContent=!chosen||chosen.size===total?'Everyone':chosen.size===0?'No one selected':chosen.size===1?result.people.find(person=>chosen.has(person.key))?.name||'1 person':chosen.size+' people';}
 function peopleUi(){const list=$('report-activity-people-list'),q=$('report-activity-people-search').value.trim().toLowerCase();list.replaceChildren();if(!result)return;const counts=new Map();for(const row of result.rows)counts.set(row.userKey,(counts.get(row.userKey)||0)+1);for(const person of result.people.filter(person=>!q||person.name.toLowerCase().includes(q))){const label=el('label',undefined,'report-activity-person'),box=el('input');box.type='checkbox';box.checked=!chosen||chosen.has(person.key);box.onchange=()=>{if(!chosen)chosen=new Set(result.people.map(p=>p.key));if(box.checked)chosen.add(person.key);else chosen.delete(person.key);peopleLabel();page=1;draw();};const avatar=data('span',person.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase(),'report-activity-avatar');avatar.setAttribute('aria-hidden','true');label.append(box,avatar,data('span',person.name),el('small',String(counts.get(person.key)||0)));list.append(label);}if(!list.children.length)list.append(el('p','No people match.','small'));}
 function filtered(){if(!result)return[];const q=($('report-search')?.value||'').trim().toLowerCase();return result.rows.filter(row=>(!chosen||chosen.has(row.userKey))&&(!sources||sources.has(row.source))&&inWindow(row.time)&&(!q||(row.userName+' '+row.title+' '+row.detail+' '+row.locationName).toLowerCase().includes(q)));}
 function metric(label,value,note){const card=el('div',undefined,'management report-metric');card.append(el('span',label),data('strong',value),el('span',note,'small'));$('report-activity-summary').append(card);}
 // By person chart: one stacked bar per person split by activity type, drawn from the same filtered rows (display only).
 const chartColours=['var(--primary,#008cff)','color-mix(in srgb,var(--secondary,#45efc3) 75%,#0f766e)','#f59e0b','#8b5cf6','#ef4444','#14b8a6','#64748b','#ec4899','#84cc16','#0ea5e9','#a16207','#be185d'];
 function personChart(people,shown){
  const host=$('report-activity-person-chart');host.replaceChildren();const list=[...people].sort((a,b)=>b[1].total-a[1].total||a[1].name.localeCompare(b[1].name));
  if(!list.length){host.hidden=true;return;}host.hidden=false;
  const colour=new Map(shown.map((source,index)=>[source.id,chartColours[index%chartColours.length]]));
  const used=shown.filter(source=>list.some(([,item])=>item.bySource[source.id]));
  const legend=el('ul',undefined,'report-activity-person-legend');for(const source of used){const item=el('li'),swatch=el('span',undefined,'report-activity-person-swatch');swatch.style.background=colour.get(source.id);item.append(swatch,el('span',source.name));legend.append(item);}
  const max=list[0][1].total||1,limit=20,chart=el('ol',undefined,'report-activity-person-bars');chart.setAttribute('aria-label','Actions by person');
  for(const [key,item] of list.slice(0,limit)){
   const row=el('li',undefined,'report-activity-person-bar'),name=data('button',item.name,'report-activity-person-link');name.type='button';name.title='Show only '+item.name;name.onclick=()=>{chosen=new Set([key]);peopleLabel();peopleUi();page=1;draw();$('report-activity-title').scrollIntoView({behavior:'smooth',block:'start'});};
   const track=el('div',undefined,'report-activity-person-track'),fill=el('div',undefined,'report-activity-person-fill');fill.style.width=(item.total/max*100).toFixed(2)+'%';
   const parts=[];for(const source of used){const count=item.bySource[source.id];if(!count)continue;const part=el('span',undefined,'report-activity-person-part');part.style.background=colour.get(source.id);part.style.flexGrow=String(count);part.title=source.name+': '+count;fill.append(part);parts.push(source.name+' '+count);}
   track.append(fill);track.setAttribute('role','img');track.setAttribute('aria-label',item.name+': '+item.total+' actions'+(parts.length?' ('+parts.join(', ')+')':''));
   row.append(name,track,el('strong',String(item.total),'report-activity-person-total'));chart.append(row);
  }
  host.append(legend,chart);if(list.length>limit)host.append(el('p',(list.length-limit)+' more '+(list.length-limit===1?'person is':'people are')+' in the table below.','small'));
 }
 // Timeline charts: actions per day (or per week for long periods) and per hour of the day, stacked by activity type.
 // Drawn from the same filtered rows as the list; days inside the shown range with nothing recorded are zero.
 function stackedColumns(title,buckets,used,colour,labelEvery){
  const card=el('div',undefined,'report-activity-timeline-card');card.append(el('h3',title));
  const max=Math.max(1,...buckets.map(b=>b.total)),plot=el('div',undefined,'report-activity-columns-plot');plot.setAttribute('role','img');
  plot.setAttribute('aria-label',title+': '+buckets.filter(b=>b.total).map(b=>b.label+' '+b.total).join(', ')||'no actions');
  buckets.forEach((bucket,index)=>{
   const column=el('div',undefined,'report-activity-column');column.title=bucket.label+': '+bucket.total+(bucket.total===1?' action':' actions')+used.filter(s=>bucket.by[s.id]).map(s=>'\n'+s.name+': '+bucket.by[s.id]).join('');
   const stack=el('div',undefined,'report-activity-column-stack');stack.style.height=(bucket.total/max*100).toFixed(2)+'%';
   for(const source of used){const count=bucket.by[source.id];if(!count)continue;const part=el('span');part.style.background=colour.get(source.id);part.style.flexGrow=String(count);stack.append(part);}
   const label=el('span',index%labelEvery===0?bucket.short:'','report-activity-column-label');column.append(stack,label);plot.append(column);
  });
  card.append(plot);return card;
 }
 function timelineChart(shown){
  const host=$('report-activity-timeline-chart');host.replaceChildren();if(!rows.length){host.hidden=true;return;}host.hidden=false;
  const colour=new Map(shown.map((source,index)=>[source.id,chartColours[index%chartColours.length]])),used=shown.filter(source=>rows.some(row=>row.source===source.id));
  const legend=el('ul',undefined,'report-activity-person-legend');for(const source of used){const item=el('li'),swatch=el('span',undefined,'report-activity-person-swatch');swatch.style.background=colour.get(source.id);item.append(swatch,el('span',source.name));legend.append(item);}
  const day=date=>Date.UTC(+date.slice(0,4),+date.slice(5,7)-1,+date.slice(8,10)),iso=ms=>new Date(ms).toISOString().slice(0,10);
  const dates=rows.map(row=>row.date).sort(),from=day(dates[0]),to=day(dates[dates.length-1]),span=Math.round((to-from)/864e5)+1,weekly=span>62;
  const keyOf=date=>{if(!weekly)return date;const ms=day(date),back=(new Date(ms).getUTCDay()+6)%7;return iso(ms-back*864e5);};
  const buckets=new Map();const start=weekly?day(keyOf(dates[0])):from;for(let ms=start;ms<=to;ms+=(weekly?7:1)*864e5){const key=iso(ms),label=dayLabel(key);buckets.set(key,{label:weekly?'Week of '+label:label,short:new Date(ms).getUTCDate()+'/'+(new Date(ms).getUTCMonth()+1),total:0,by:{}});}
  const hours=[...Array(24)].map((_,h)=>({label:hour(String(h).padStart(2,'0')+':00'),short:hour(String(h).padStart(2,'0')+':00').replace(':00','').replace(/\s/g,''),total:0,by:{}}));
  for(const row of rows){const bucket=buckets.get(keyOf(row.date));if(bucket){bucket.total++;bucket.by[row.source]=(bucket.by[row.source]||0)+1;}const h=hours[Number(row.time.slice(0,2))];if(h){h.total++;h.by[row.source]=(h.by[row.source]||0)+1;}}
  const list=[...buckets.values()],grid=el('div',undefined,'report-activity-timeline-grid');
  grid.append(stackedColumns(weekly?'Actions by week':'Actions by day',list,used,colour,Math.max(1,Math.ceil(list.length/12))),stackedColumns('Actions by time of day',hours,used,colour,3));
  host.append(legend,grid);
 }
 function draw(){
  rows=filtered();const summary=$('report-activity-summary');summary.replaceChildren();if(!result)return;
  const people=new Map();for(const row of rows){const item=people.get(row.userKey)||{name:row.userName,total:0,bySource:{},first:row.at,last:row.at};item.total++;item.bySource[row.source]=(item.bySource[row.source]||0)+1;if(row.at<item.first)item.first=row.at;if(row.at>item.last)item.last=row.at;people.set(row.userKey,item);}
  const hours=new Map();for(const row of rows){const h=row.time.slice(0,2);hours.set(h,(hours.get(h)||0)+1);}const busiest=[...hours].sort((a,b)=>b[1]-a[1])[0],top=[...people.values()].sort((a,b)=>b.total-a.total)[0];
  metric('Actions',String(rows.length),'Things done in this period and time of day');metric('People',String(people.size),'People with at least one action');metric('Busiest hour',busiest?hour(busiest[0]+':00')+' – '+hour(String((Number(busiest[0])+1)%24).padStart(2,'0')+':00'):'—',busiest?busiest[1]+' actions':'No actions yet');metric('Most active',top?top.name:'—',top?top.total+' actions':'No actions yet');
  // By person.
  const shown=result.sources.filter(source=>result.included.includes(source.name)&&(!sources||sources.has(source.id))),head=$('report-activity-person-head'),hr=el('tr');const visible=shown.filter(source=>showColumn(source.id));for(const label of ['Person',...(showColumn('total')?['Actions']:[]),...visible.map(source=>source.name),...(showColumn('first')?['First']:[]),...(showColumn('last')?['Last']:[])])hr.append(Object.assign(el('th',label),{scope:'col'}));head.replaceChildren(hr);columnsLabel();
  const body=$('report-activity-person-rows');body.replaceChildren();const fmt=at=>{const row=rows.find(r=>r.at===at);return row?dayLabel(row.date)+' '+hour(row.time):'—';};
  for(const [key,item] of [...people].sort((a,b)=>b[1].total-a[1].total||a[1].name.localeCompare(b[1].name))){const tr=el('tr'),name=el('td',undefined,'report-activity-person-cell'),button=data('button',item.name,'report-activity-person-link');button.type='button';button.title='Show only '+item.name;button.onclick=()=>{chosen=new Set([key]);peopleLabel();peopleUi();page=1;draw();$('report-activity-title').scrollIntoView({behavior:'smooth',block:'start'});};name.append(button);tr.append(name);if(showColumn('total'))tr.append(el('td',String(item.total),'report-amount'));for(const source of visible)tr.append(el('td',item.bySource[source.id]?String(item.bySource[source.id]):'—','report-amount'));if(showColumn('first'))tr.append(el('td',fmt(item.first)));if(showColumn('last'))tr.append(el('td',fmt(item.last)));body.append(tr);}
  personChart(people,shown);
  $('report-activity-people-count').textContent=people.size+(people.size===1?' person':' people');
  timelineChart(shown);
  // Timeline.
  const pages=Math.max(1,Math.ceil(rows.length/50));page=Math.min(Math.max(1,page),pages);const list=$('report-activity-rows');list.replaceChildren();let lastDate='';
  for(const row of rows.slice((page-1)*50,page*50)){if(row.date!==lastDate){lastDate=row.date;const day=el('tr',undefined,'report-activity-day'),cell=el('th',dayLabel(row.date));cell.colSpan=4;cell.scope='colgroup';day.append(cell);list.append(day);}const tr=el('tr');tr.dataset.source=row.source;const when=el('td',hour(row.time),'report-activity-time'),who=el('td',undefined,'report-activity-who'),avatar=data('span',row.userName.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase(),'report-activity-avatar');avatar.setAttribute('aria-hidden','true');who.append(avatar,data('span',row.userName));const what=el('td'),box=el('div',undefined,'report-activity-what'),tag=el('span',(result.sources.find(source=>source.id===row.source)||{}).name||row.source,'report-activity-tag');tag.dataset.source=row.source;box.append(tag,data('strong',row.title));if(row.detail)box.append(data('small',row.detail));what.append(box);const where=data('td',row.locationName);tr.append(when,who,what,where);list.append(tr);}
  $('report-activity-count').textContent=rows.length+(rows.length===1?' action':' actions');$('report-activity-empty').hidden=rows.length>0;$('report-activity-page').textContent='Page '+page+' of '+pages;$('report-activity-previous').disabled=page===1;$('report-activity-next').disabled=page===pages;
  const notes=[result.note];if(result.skipped.length)notes.push('Not shown because of your permissions: '+result.skipped.join(', ')+'.');if(result.failed.length)notes.push('Could not load: '+result.failed.join(', ')+'.');if(result.truncated)notes.push('Showing the latest 20,000 actions. Choose a shorter period to see everything.');$('report-activity-note').textContent=notes.join(' ');
  // The person report (reporting-person.js) draws itself from these same filtered rows.
  document.dispatchEvent(new CustomEvent('report-activity-drawn',{detail:{rows,result,choose:key=>{chosen=key?new Set([key]):null;peopleLabel();peopleUi();page=1;draw();}}}));
 }
 function render(next){const changed=!result||next&&(JSON.stringify(next.people.map(p=>p.key))!==JSON.stringify(result.people.map(p=>p.key)));result=next;if(!result){clear();return;}if(changed&&chosen)chosen=new Set([...chosen].filter(key=>result.people.some(p=>p.key===key)));if(changed)sources=null;presetsUi();sourcesUi();peopleLabel();peopleUi();draw();}
 function clear(){result=null;rows=[];$('report-activity-summary').replaceChildren();$('report-activity-rows').replaceChildren();$('report-activity-person-rows').replaceChildren();$('report-activity-count').textContent='';$('report-activity-note').textContent='';$('report-activity-empty').hidden=true;}
 function exportCsv(){if(!result)return;const range=window_(),meta=[['Report','Staff activity'],['From',result.period?.start||''],['To',result.period?.end||''],['Time of day',range?range.join(' – '):'All day'],['People',$('report-activity-people-text').textContent],['Activity',$('report-activity-sources-text').textContent],['Time zone','Australia/Melbourne'],[]],head=['Date','Time','Person','Activity type','What they did','Details','Location','Company'],values=rows.map(row=>[row.date,row.time,row.userName,(result.sources.find(source=>source.id===row.source)||{}).name||row.source,row.title,row.detail,row.locationName,row.companyName]);const url=URL.createObjectURL(new Blob([reportingExport.csv([...meta,head,...values])],{type:'text/csv;charset=utf-8'})),link=el('a');link.href=url;link.download='report-staff-activity-'+(result.period?.start||'')+'-'+(result.period?.end||'')+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 // People picker popover.
 const menu=$('report-activity-people-menu'),toggle=$('report-activity-people');
 function place(){const box=toggle.getBoundingClientRect(),width=Math.min(320,innerWidth-16);menu.style.width=width+'px';menu.style.left=Math.max(8,Math.min(innerWidth-width-8,box.left))+'px';menu.style.top=Math.round(box.bottom+6)+'px';menu.style.maxHeight=Math.max(220,innerHeight-box.bottom-24)+'px';}
 toggle.onclick=()=>{if(menu.matches(':popover-open')){menu.hidePopover();return;}peopleUi();menu.showPopover();place();$('report-activity-people-search').focus();};
 menu.addEventListener('toggle',event=>toggle.setAttribute('aria-expanded',String(event.newState==='open')));
 const sourcesMenu=$('report-activity-sources-menu'),sourcesToggle=$('report-activity-sources-toggle');
 function placeMenu(target,trigger){const box=trigger.getBoundingClientRect(),width=Math.min(300,innerWidth-16);target.style.width=width+'px';target.style.left=Math.max(8,Math.min(innerWidth-width-8,box.left))+'px';target.style.top=Math.round(box.bottom+6)+'px';target.style.maxHeight=Math.max(220,innerHeight-box.bottom-24)+'px';}
 sourcesToggle.onclick=()=>{if(sourcesMenu.matches(':popover-open')){sourcesMenu.hidePopover();return;}sourcesUi();sourcesMenu.showPopover();placeMenu(sourcesMenu,sourcesToggle);sourcesMenu.querySelector('input')?.focus();};
 sourcesMenu.addEventListener('toggle',event=>sourcesToggle.setAttribute('aria-expanded',String(event.newState==='open')));
 $('report-activity-sources-all').onclick=()=>{sources=null;sourcesUi();page=1;draw();};$('report-activity-sources-none').onclick=()=>{sources=new Set();sourcesUi();page=1;draw();};
 const columnsMenu=$('report-activity-columns-menu'),columnsToggle=$('report-activity-columns-toggle');
 columnsToggle.onclick=()=>{if(columnsMenu.matches(':popover-open')){columnsMenu.hidePopover();return;}columnsUi();columnsMenu.showPopover();const box=columnsToggle.getBoundingClientRect(),width=Math.min(260,innerWidth-16);columnsMenu.style.width=width+'px';columnsMenu.style.left=Math.max(8,Math.min(innerWidth-width-8,box.right-width))+'px';columnsMenu.style.top=Math.round(box.bottom+6)+'px';columnsMenu.style.maxHeight=Math.max(220,innerHeight-box.bottom-24)+'px';columnsMenu.querySelector('input')?.focus();};
 columnsMenu.addEventListener('toggle',event=>columnsToggle.setAttribute('aria-expanded',String(event.newState==='open')));
 $('report-activity-columns-all').onclick=()=>{columns=null;columnsUi();draw();};$('report-activity-columns-none').onclick=()=>{columns=new Set();columnsUi();draw();};
 $('report-activity-people-search').oninput=peopleUi;$('report-activity-people-all').onclick=()=>{chosen=null;peopleLabel();peopleUi();page=1;draw();};$('report-activity-people-none').onclick=()=>{chosen=new Set();peopleLabel();peopleUi();page=1;draw();};
 for(const id of ['report-activity-from','report-activity-to'])$(id).addEventListener('change',()=>{page=1;draw();});
 $('report-activity-previous').onclick=()=>{page--;draw();};$('report-activity-next').onclick=()=>{page++;draw();};
 $('report-search')?.addEventListener('input',()=>{if(result&&!$('report-activity-panel').hidden){page=1;draw();}});
 window.addEventListener('resize',()=>{if(menu.matches(':popover-open'))place();if(sourcesMenu.matches(':popover-open'))placeMenu(sourcesMenu,sourcesToggle);});
 presetsUi();
 window.reportActivity={render,clear,exportCsv};
})();
