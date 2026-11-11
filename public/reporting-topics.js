// Reporting topics: six topic pages (Overview, Sales, Costs & orders, Stock, Team, Checklists) built from the
// #report-view groups. Tabs switch between a topic's reports; reporting-charts.js draws each report's charts.
// Display only: it never reads the server or writes.
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
  // Compact layout: the tabs sit at the start of the filter toolbar, and the one-line summary keeps its full text on hover.
  const toolbar=document.getElementById('report-controls');if(toolbar&&tabs.parentElement!==toolbar)toolbar.prepend(tabs);
  const summaryLine=document.getElementById('report-view-summary');if(summaryLine)setTimeout(()=>{summaryLine.title=summaryLine.textContent;});
 }
 let lastReports=null;
 window.reportTopics={last,update(view,reports){lastReports=reports;renderTabs();window.reportCharts?.update(view,reports);}};
 select.addEventListener('change',renderTabs);window.addEventListener('hashchange',()=>setTimeout(()=>{renderTabs();window.reportCharts?.update(select.value,lastReports);}));
 window.addEventListener('interface-text-updated',()=>{renderTabs();window.reportCharts?.update(select.value,lastReports);});
 renderTabs();setTimeout(renderTabs,600);
})();
