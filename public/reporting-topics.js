// Reporting topics: six topic pages (Overview, Sales, Costs & orders, Stock, Team, Checklists) built from the
// #report-view groups. Tabs switch between a topic's reports, and a chart summarises the loaded rows of the
// selected report. Display only: it reuses the rows Reporting already loaded and never calculates new figures,
// reads the server or writes.
(()=>{
 const select=document.getElementById('report-view'),tabs=document.getElementById('report-topic-tabs'),panel=document.getElementById('report-topic-chart');if(!select||!tabs||!panel)return;
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 const data=(tag,text,cls)=>{const element=node(tag,text,cls);element.dataset.userText='';return element;};
 // Short tab names; the full report name stays in the summary line under the heading.
 const short={finance:'Business overview','daily-overview':'By day',reconciliation:'Reconciliation',sales:'Entries',platforms:'Platform fees',expenses:'Expenses','order-lines':'Cost of goods',orders:'Suppliers',invoices:'Invoices',bundles:'Invoice bundles',stock:'Usage',cycles:'Usage by week',counts:'Counts',transfers:'Transfers',activity:'Activity',training:'Training',checklists:'Checklist progress'};
 const about={overview:'Sales, costs, profit and margin at a glance.',sales:'What was sold, day by day and by channel, and how the cash reconciled.',costs:'Where the money went: expenses, cost of goods, suppliers and invoices.',stock:'Stock used, counted and moved between locations.',team:'What people did and how their training is going.',checklists:'Checklists completed, missed and in progress.'};
 const groups=()=>[...select.querySelectorAll('optgroup[data-topic]')];
 const topicOf=view=>groups().find(group=>[...group.children].some(option=>option.value===view));
 const memory='opstack-report-topic:';
 const last=id=>{try{return sessionStorage.getItem(memory+String(id).replace(/^topic:/,''))||null;}catch{return null;}};
 function renderTabs(){
  const view=select.value,group=topicOf(view);if(!group){tabs.hidden=true;return;}
  try{sessionStorage.setItem(memory+group.dataset.topic,view);}catch{}
  const eyebrow=document.querySelector('[data-edit-id="reporting-eyebrow"]');if(eyebrow){eyebrow.textContent=group.label;eyebrow.dataset.userText='';}
  const options=[...group.children].filter(option=>option.tagName==='OPTION'&&!option.hidden);
  tabs.replaceChildren();tabs.hidden=options.length<2;
  const row=node('div',undefined,'report-topic-tablist');row.setAttribute('role','group');row.setAttribute('aria-label',word('Reports in {topic}',{topic:group.label}));
  for(const option of options){const tab=node('a',word(short[option.value]||option.textContent),'report-topic-tab');tab.href='#'+option.value;tab.title=option.textContent;if(option.value===view)tab.setAttribute('aria-current','page');if(option.disabled){tab.setAttribute('aria-disabled','true');tab.classList.add('is-disabled');tab.title=word('Additional permission is required in every selected company.');tab.addEventListener('click',event=>event.preventDefault());}row.append(tab);}
  tabs.append(row);
 }
 // Chart settings per report: group the loaded rows by a field and add up one or two amounts (unknown amounts stay out).
 const money=cents=>cents===null||cents===undefined?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:Math.abs(cents)>=100000?0:2}).format(cents/100);
 const count=value=>Number(value||0).toLocaleString('en-AU',{maximumFractionDigits:3});
 const shortDate=value=>value?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(String(value).slice(0,10)+'T12:00:00Z')):'';
 const charts={
  finance:{title:'Sales and total costs by week',by:'weekStart',date:true,series:[['salesCents','Sales'],['totalCostsCents','Total costs']],format:money},
  reconciliation:{title:'Cash variance by day',by:'date',date:true,series:[['varianceCents','Variance']],format:money,signed:true},
  platforms:{title:'Platform fees by platform',by:'name',series:[['totalFeesCents','Total fees'],['expectedPayCents','Expected pay']],format:money},
  expenses:{title:'Expenses by category',by:'category',series:[['totalCents','Total']],format:money},
  'order-lines':{title:'Cost of goods by supplier',by:'supplier',series:[['totalCents','Order cost']],format:money},
  invoices:{title:'Invoices by supplier',by:'supplier',series:[['totalCents','Invoice total']],format:money},
  bundles:{title:'Invoice totals by week',by:'weekStart',date:true,series:[['totalCents','Invoice total']],format:money},
  transfers:{title:'Units transferred by item',by:'name',series:[['quantity','Units']],format:count},
  counts:{title:'Count entries by area',by:'group',series:[[null,'Entries']],format:count,labels:'groups'},
  cycles:{title:'Stock used by item',by:'name',series:[['calculatedUsage','Used']],format:count}
 };
 function summarise(view,reports){
  const config=charts[view],model=window.reportingModel;if(!config||!model||!reports?.length)return null;
  const rows=model.raw(reports,view),buckets=new Map();let unknown=0;
  // A group's amount is only shown when every row in it has that amount recorded, so partial totals never look complete.
  for(const row of rows){const key=row[config.by]??'Not recorded',entry=buckets.get(key)||{key,values:config.series.map(()=>0),known:config.series.map(()=>true)};
   config.series.forEach(([field],index)=>{if(field===null){entry.values[index]+=1;return;}const value=row[field];if(Number.isFinite(value))entry.values[index]+=value;else{entry.known[index]=false;unknown++;}});buckets.set(key,entry);}
  for(const entry of buckets.values())entry.values=entry.values.map((value,index)=>entry.known[index]?value:null);
  let list=[...buckets.values()].filter(entry=>entry.known.some(Boolean));
  if(config.date)list.sort((a,b)=>String(a.key).localeCompare(String(b.key)));else list.sort((a,b)=>Math.abs(b.values[0]??0)-Math.abs(a.values[0]??0));
  const more=config.date?Math.max(0,list.length-26):Math.max(0,list.length-12);list=config.date?list.slice(-26):list.slice(0,12);
  return{config,list,unknown,more,rows:rows.length};
 }
 function draw(view,reports){
  const result=summarise(view,reports);panel.replaceChildren();if(!result||!result.list.length){panel.hidden=true;return;}panel.hidden=false;
  const {config,list}=result,head=node('div',undefined,'report-topic-chart-head'),title=node('h2',word(config.title));title.id='report-topic-chart-title';head.append(title);
  const legend=node('div',undefined,'report-topic-legend');config.series.forEach(([,label],index)=>{const item=node('span',word(label),'report-topic-key is-'+index);legend.append(item);});if(config.series.length>1)head.append(legend);
  const labelOf=key=>config.date?shortDate(key):config.labels==='groups'?word(window.reportingModel.groups[key]||key):String(key);
  const values=list.flatMap(entry=>entry.values).filter(value=>value!==null),max=Math.max(1,...values.map(Math.abs)),signed=config.signed&&values.some(value=>value<0);
  const chart=node('div',undefined,'report-topic-bars'+(config.date?' is-timeline':' is-ranked')+(signed?' is-signed':''));chart.setAttribute('role','list');
  for(const entry of list){const item=node('div',undefined,'report-topic-bar');item.setAttribute('role','listitem');item.tabIndex=0;
   const text=labelOf(entry.key)+': '+config.series.map(([,label],index)=>word(label)+' '+(entry.known[index]?config.format(entry.values[index]):'—')).join(' · ');item.title=text;item.setAttribute('aria-label',text);
   const name=data('span',labelOf(entry.key),'report-topic-bar-label'),track=node('span',undefined,'report-topic-bar-track');track.setAttribute('aria-hidden','true');
   config.series.forEach((series,index)=>{const value=entry.values[index];if(value===null)return;const fill=node('span',undefined,'report-topic-bar-fill is-'+index+(value<0?' is-negative':''));fill.style.setProperty('--size',(Math.abs(value)/max*100).toFixed(2)+'%');track.append(fill);});
   const amount=data('span',entry.values[0]===null?'—':config.format(entry.values[0]),'report-topic-bar-value'+(entry.values[0]<0?' is-negative':''));item.append(name,track,amount);chart.append(item);}
  const notes=[];if(result.more)notes.push(word(config.date?'Showing the latest {count} periods.':'Showing the top {count}.',{count:list.length}));if(result.unknown)notes.push(word('Groups with figures not recorded yet show —.'));
  panel.append(head,chart);if(notes.length)panel.append(node('p',notes.join(' '),'report-topic-note'));
 }
 let lastReports=null;
 window.reportTopics={last,update(view,reports){lastReports=reports;renderTabs();draw(view,reports);}};
 select.addEventListener('change',renderTabs);window.addEventListener('hashchange',()=>setTimeout(()=>{renderTabs();draw(select.value,lastReports);}));
 window.addEventListener('interface-text-updated',()=>{renderTabs();draw(select.value,lastReports);});
 renderTabs();setTimeout(renderTabs,600);
})();
