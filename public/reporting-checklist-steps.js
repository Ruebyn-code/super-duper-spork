// Checklist progress → By step: read-only step reports built from the loaded checklist rows.
// Rows only carry done/not done, server-recorded times, who did it and timed-section timing; never answer values.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.reportChecklistStepsModel=factory();})(globalThis,()=>{
 const timings={within:'On time',early:'Early',late:'Late',missed:'Missed',pending:'Not done yet',unrecorded:'Time not recorded'};
 const zone='Australia/Melbourne';
 const minuteOfDay=value=>{const parts=new Intl.DateTimeFormat('en-AU',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:zone}).formatToParts(new Date(value));return Number(parts.find(part=>part.type==='hour').value)*60+Number(parts.find(part=>part.type==='minute').value);};
 const median=list=>{if(!list.length)return null;const sorted=[...list].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:Math.round((sorted[middle-1]+sorted[middle])/2);};
 const checklistKey=row=>row.templateId||'title:'+row.title;
 // Checklists in the loaded rows, most runs first.
 function checklists(rows){const map=new Map();for(const row of rows){if(!Array.isArray(row.steps))continue;const key=checklistKey(row),item=map.get(key)||{key,title:row.title,runs:0,latest:''};item.runs++;if((row.workDate||'')>=item.latest){item.latest=row.workDate||'';item.title=row.title;}map.set(key,item);}return[...map.values()].sort((a,b)=>b.runs-a.runs||a.title.localeCompare(b.title));}
 // Step totals for one checklist. Step order follows the newest run, then any older steps.
 function summarise(rows,key){
  const runs=rows.filter(row=>Array.isArray(row.steps)&&checklistKey(row)===key).sort((a,b)=>(b.workDate||'').localeCompare(a.workDate||'')||String(b.id).localeCompare(String(a.id))),steps=new Map();
  for(const run of runs)for(const step of run.steps){
   const item=steps.get(step.id)||{id:step.id,title:step.title,type:step.type,sectionId:step.sectionId,sectionTitle:step.sectionTitle,timed:step.timed,total:0,done:0,timing:{within:0,early:0,late:0,missed:0,pending:0,unrecorded:0},minutes:[],people:new Map(),last:null,entries:[]};
   item.total++;if(step.done)item.done++;if(step.timed&&step.timing)item.timing[step.timing]=(item.timing[step.timing]||0)+1;
   if(step.done&&step.completedAt){item.minutes.push(minuteOfDay(step.completedAt));if(!item.last||step.completedAt>item.last)item.last=step.completedAt;}
   if(step.done&&step.completedBy)item.people.set(step.completedBy,(item.people.get(step.completedBy)||0)+1);
   item.entries.push({runId:run.id,workDate:run.workDate,locationNames:run.locationNames||[],companyName:run.companyName||'',runStatus:run.status,done:step.done,completedAt:step.completedAt,completedBy:step.completedBy,timing:step.timed?step.timing:null});
   steps.set(step.id,item);
  }
  const list=[...steps.values()].map(item=>{const decided=item.timing.within+item.timing.early+item.timing.late+item.timing.missed,top=[...item.people].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];return{...item,rate:item.total?item.done/item.total*100:null,onTime:item.timed&&decided?item.timing.within/decided*100:null,decided,usualMinute:median(item.minutes),topPerson:top?{name:top[0],count:top[1]}:null,people:undefined,minutes:undefined};});
  const sections=[];for(const step of list){const last=sections[sections.length-1];if(!last||last.id!==step.sectionId)sections.push({id:step.sectionId,title:step.sectionTitle,timed:step.timed,steps:[step]});else last.steps.push(step);}
  for(const section of sections){const sum=key=>section.steps.reduce((total,step)=>total+(key==='decided'?step.decided:step.timing[key]),0);section.total=section.steps.reduce((total,step)=>total+step.total,0);section.done=section.steps.reduce((total,step)=>total+step.done,0);section.within=sum('within');section.decided=sum('decided');section.onTime=section.timed&&section.decided?section.within/section.decided*100:null;}
  const total=list.reduce((sum,step)=>sum+step.total,0),done=list.reduce((sum,step)=>sum+step.done,0),within=list.reduce((sum,step)=>sum+step.timing.within,0),decided=list.reduce((sum,step)=>sum+step.decided,0);
  return{runs:runs.length,steps:list,sections,total,done,rate:total?done/total*100:null,timed:list.some(step=>step.timed),onTime:decided?within/decided*100:null,within,decided};
 }
 const clockText=minute=>minute===null?'—':new Intl.DateTimeFormat('en-AU',{hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(new Date(Date.UTC(2000,0,1,Math.floor(minute/60),minute%60)));
 return{timings,checklists,summarise,clockText,checklistKey,minuteOfDay};
});

(()=>{
 if(typeof document==='undefined')return;
 const model=globalThis.reportChecklistStepsModel,$=id=>document.getElementById(id);
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;},data=(tag,text,cls)=>{const node=el(tag,text,cls);node.dataset.userText='';return node;};
 const percent=value=>value===null?'—':new Intl.NumberFormat('en-AU',{maximumFractionDigits:0}).format(value)+'%';
 const date=value=>!value?'—':new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Melbourne'}).format(new Date(value.length===10?value+'T12:00:00Z':value));
 const time=value=>!value?'—':new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(new Date(value));
 let mode='checklists',chosen='',openStep='',controls,modeButtons,picker,pickerWrap,history,lastSummary=null,lastRows=[];
 function build(){
  if(controls)return;controls=el('div',undefined,'report-step-controls');
  const toggle=el('div',undefined,'report-step-mode');toggle.setAttribute('role','group');toggle.setAttribute('aria-label',word('Report checklists or steps'));
  modeButtons=[['checklists','By checklist'],['steps','By step']].map(([value,label])=>{const button=el('button',word(label));button.type='button';button.dataset.mode=value;button.onclick=()=>{if(mode===value)return;mode=value;openStep='';window.reportRerender?.();};toggle.append(button);return button;});
  pickerWrap=el('div',undefined,'report-step-picker');const label=el('label',word('Checklist'));picker=el('select');picker.id='report-step-checklist';label.htmlFor=picker.id;picker.onchange=()=>{chosen=picker.value;openStep='';window.reportRerender?.();};pickerWrap.append(label,picker);
  controls.append(toggle,pickerWrap);
  history=el('section',undefined,'report-step-history');history.id='report-step-history';history.hidden=true;
 }
 function place(){build();const toolbar=document.querySelector('#report-progress-panel .report-progress-toolbar');if(toolbar&&controls.parentNode!==toolbar)toolbar.prepend(controls);const scroll=$('report-progress-table')?.closest('.report-table-scroll');if(scroll&&history.previousElementSibling!==scroll)scroll.after(history);}
 function hide(){if(!controls)return;controls.hidden=true;history.hidden=true;document.getElementById('report-progress-panel')?.classList.remove('is-step-report');}
 function metric(label,value,note,key){const card=el('div',undefined,'management report-metric');card.dataset.progressMetric=key;card.append(el('span',word(label)),data('strong',value),el('span',word(note),'small'));$('report-progress-summary').append(card);}
 function chip(state){const node=el('span',word(model.timings[state]||state),'report-step-timing');node.dataset.timing=state;return node;}
 function bar(value){const wrap=el('span',undefined,'report-step-bar'),fill=el('span');fill.style.width=(value===null?0:Math.max(2,Math.round(value)))+'%';wrap.append(fill);return wrap;}
 // Returns true when the By step view drew the report.
 function render(rows){
  place();controls.hidden=false;modeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mode===mode)));pickerWrap.hidden=mode!=='steps';
  const panel=$('report-progress-panel');panel.classList.toggle('is-step-report',mode==='steps');
  if(mode!=='steps'){history.hidden=true;return false;}
  lastRows=rows;const list=model.checklists(rows);if(!list.some(item=>item.key===chosen))chosen=list[0]?.key||'';
  picker.replaceChildren(...list.map(item=>{const option=el('option',item.title+' ('+item.runs+')');option.value=item.key;return option;}));if(!list.length){const option=el('option',word('No checklists in this selection'));option.value='';picker.append(option);}picker.value=chosen;window.appSelects?.refresh?.(picker);
  const summary=lastSummary=chosen?model.summarise(rows,chosen):null,host=$('report-progress-summary');host.replaceChildren();
  metric('Checklist runs',String(summary?.runs||0),'Saved and today’s unstarted runs in this selection','runs');
  metric('Steps',String(summary?.steps.length||0),'Response steps you can see','steps');
  metric('Steps done',percent(summary?.rate??null),summary?.total?word('{done} of {total} step checks',{done:summary.done,total:summary.total}):'No steps to measure','rate');
  metric('On time',summary?.timed?percent(summary.onTime):word('No timed sections'),summary?.timed?(summary.decided?word('{within} of {decided} timed steps inside their window',{within:summary.within,decided:summary.decided}):'Timed steps still to do'):'This checklist has no timed sections','on-time');
  $('report-progress-title').textContent=word('Checklist steps');$('report-progress-count').textContent=summary?word('{count} steps',{count:summary.steps.length}):'';
  $('report-progress-note').textContent=word('Each step shows how often it was done across the selected runs, the usual time it was ticked off (Melbourne time), who did it most, and for timed sections whether it was done inside the window. Answers are not shown.');
  const table=$('report-progress-table'),head=el('thead'),header=el('tr'),body=el('tbody');
  for(const label of ['Step','Done','Completion','On time','Usual time','Most done by','Last done']){const th=el('th',word(label));th.scope='col';header.append(th);}head.append(header);
  for(const section of summary?.sections||[]){
   if(section.id){const row=el('tr',undefined,'report-step-section'+(section.timed?' is-timed':'')),cell=el('td');cell.colSpan=7;const name=data('strong',section.timed?word('Timed section · {window}',{window:section.title}):section.title);cell.append(name);const facts=el('span',undefined,'report-step-section-facts');facts.append(el('span',word('{done} of {total} done',{done:section.done,total:section.total})));if(section.timed)facts.append(el('span',section.decided?word('{rate} on time',{rate:percent(section.onTime)}):word('No timed results yet')));cell.append(facts);row.append(cell);body.append(row);}
   for(const step of section.steps){
    const row=el('tr',undefined,'report-step-row');row.dataset.open=String(openStep===step.id);
    const name=el('td'),button=data('button',step.title,'report-step-open');button.type='button';button.setAttribute('aria-expanded',String(openStep===step.id));button.setAttribute('aria-controls','report-step-history');button.onclick=()=>{openStep=openStep===step.id?'':step.id;window.reportRerender?.();};name.append(button);row.append(name);
    row.append(el('td',step.done+' / '+step.total,'report-amount'));
    const completion=el('td',undefined,'report-step-completion');completion.append(bar(step.rate),el('span',percent(step.rate)));row.append(completion);
    const timing=el('td');if(!step.timed)timing.textContent='—';else if(!step.decided)timing.append(chip('pending'));else{timing.append(el('strong',percent(step.onTime)));const parts=['early','late','missed'].filter(key=>step.timing[key]).map(key=>step.timing[key]+' '+word(model.timings[key]).toLowerCase());if(parts.length)timing.append(el('small',parts.join(' · ')));}row.append(timing);
    row.append(el('td',model.clockText(step.usualMinute)));
    row.append(data('td',step.topPerson?step.topPerson.name+' ('+step.topPerson.count+')':'—'));
    row.append(el('td',step.last?date(step.last):'—'));body.append(row);
   }
  }
  table.replaceChildren(head,body);$('report-progress-empty').hidden=!!summary?.steps.length;
  $('report-previous').disabled=true;$('report-next').disabled=true;$('report-page-status').textContent=summary?word('{count} steps',{count:summary.steps.length}):'';
  drawHistory(summary);return true;
 }
 function drawHistory(summary){
  const step=summary?.steps.find(item=>item.id===openStep);history.hidden=!step;history.replaceChildren();if(!step)return;
  const heading=el('div',undefined,'report-panel-heading'),title=data('h3',word('Step history · {step}',{step:step.title})),close=el('button',word('Close'),'report-step-close');close.type='button';close.onclick=()=>{openStep='';window.reportRerender?.();};heading.append(title,close);
  const facts=el('p',step.timed?word('{section}. Each run shows when this step was ticked off and whether that was inside the window.',{section:word('Timed section · {window}',{window:step.sectionTitle})}):word('Each run shows whether this step was done, when and by whom.'),'small');
  const scroll=el('div',undefined,'report-table-scroll'),table=el('table',undefined,'report-table report-step-history-table'),head=el('thead'),header=el('tr'),body=el('tbody');
  for(const label of ['Work date','Location','Done','Done at','Done by','Timing']){const th=el('th',word(label));th.scope='col';header.append(th);}head.append(header);
  for(const entry of step.entries){const row=el('tr');row.append(el('td',date(entry.workDate)));const location=data('td',entry.locationNames.join(', '));location.append(data('small',entry.companyName));row.append(location);const done=el('td'),badge=el('span',word(entry.done?'Done':entry.runStatus==='not-started'?'Not started':'Not done'),'report-progress-badge');badge.dataset.state=entry.done?'completed':entry.timing==='missed'?'overdue':'in-progress';done.append(badge);row.append(done,el('td',time(entry.completedAt)),data('td',entry.completedBy||'—'));const timing=el('td');if(entry.timing)timing.append(chip(entry.timing));else timing.textContent='—';row.append(timing);body.append(row);}
  table.append(head,body);scroll.append(table);scroll.setAttribute('role','region');scroll.tabIndex=0;scroll.setAttribute('aria-label',word('Step history'));history.append(heading,facts,scroll);
 }
 const local=value=>{const parts=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Australia/Melbourne'}).formatToParts(new Date(value)).map(part=>[part.type,part.value]));return parts.year+'-'+parts.month+'-'+parts.day+' '+parts.hour+':'+parts.minute;};
 const active=()=>mode==='steps';
 // CSV of every step on every run for the chosen checklist.
 function exportRows(){if(!lastSummary)return null;const headers=['Checklist','Section','Step','Work date','Location','Company','Done','Done at (Melbourne)','Done by','Timing'],title=model.checklists(lastRows).find(item=>item.key===chosen)?.title||'',values=[];for(const step of lastSummary.steps)for(const entry of step.entries)values.push([title,step.timed?'Timed section · '+step.sectionTitle:step.sectionTitle,step.title,entry.workDate,entry.locationNames.join('; '),entry.companyName,entry.done?'Yes':'No',entry.completedAt?local(entry.completedAt):'',entry.completedBy||'',entry.timing?model.timings[entry.timing]:'']);return{headers,values};}
 window.reportChecklistSteps={render,hide,active,exportRows};
})();
