// Reporting: a "By person" section and a short Highlights strip for every report type (read-only, from loaded rows).
(()=>{
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;},data=(tag,text,cls)=>{const node=el(tag,text,cls);node.dataset.userText='';return node;};
 const money=value=>value===null||value===undefined||!Number.isFinite(value)?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:value%100?2:0}).format(value/100);
 const day=value=>!value?'—':new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(String(value).slice(0,10)+'T12:00:00Z'));
 const initials=name=>name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'?';
 // Who is recorded on each report, what to total for them and how to describe one record.
 const config={
  finance:{key:'recordedBy',role:'Saved by',unit:['week','weeks'],total:'salesCents',totalLabel:'Sales in weeks they saved'},
  reconciliation:{key:'recordedBy',role:'Saved by',unit:['day','days'],total:'salesCents',totalLabel:'Sales in days they saved'},
  expenses:{key:'recordedBy',role:'Saved by',unit:['entry','entries'],total:'totalCents',totalLabel:'Costs they entered'},
  'order-lines':{key:'requestedBy',role:'Requested by',unit:['order line','order lines'],total:'totalCents',totalLabel:'Value ordered'},
  transfers:{key:'handledBy',role:'Sent / received by',unit:['transfer line','transfer lines'],total:'totalCents',totalLabel:'Cost moved'},
  invoices:{key:'createdBy',role:'Uploaded by',unit:['invoice','invoices'],total:'totalCents',totalLabel:'Invoice total'},
  counts:{key:'recordedBy',role:'Counted by',unit:['count entry','count entries']},
  training:{key:row=>row.username,role:'Learner',unit:['assignment','assignments'],done:row=>row.status==='completed',doneLabel:'Completed'},
  checklists:{key:row=>row.completedBy||row.updatedBy,role:'Completed or last worked by',unit:['checklist','checklists'],blank:'Not started yet',done:row=>row.status==='completed',doneLabel:'Completed'}
 };
 // Reports that combine records point to the report that keeps the person.
 const none={platforms:['weekly','Platform fees come from saved weekly reports.','finance','Business overview'],bundles:['weekly','Bundles group invoices by week.','invoices','Stored invoices'],cycles:['combined','Usage cycles combine counts, orders and transfers.','counts','Stock count detail'],stock:['combined','Stock usage totals combine counts, orders and transfers.','counts','Stock count detail'],orders:['combined','Supplier totals combine every order.','order-lines','Cost of goods · details'],'daily-overview':['combined','The daily sales overview combines saved days.','reconciliation','Sales & reconciliation'],sales:['combined','Daily sales entries do not record who entered them.','activity','Staff activity']};
 // A few plain-language highlights for each detailed report.
 const highlights={
  finance:rows=>[best(rows,'salesCents',row=>'Best sales week: '+day(row.weekStart)+' · '+money(row.salesCents)),worst(rows,'profitCents',row=>'Lowest profit week: '+day(row.weekStart)+' · '+money(row.profitCents))],
  reconciliation:rows=>[best(rows.map(row=>({...row,_gap:Number.isFinite(row.varianceCents)?Math.abs(row.varianceCents):null})),'_gap',row=>'Biggest cash difference: '+day(row.date)+' · '+money(row.varianceCents))],
  expenses:rows=>[best(rows,'totalCents',row=>'Largest cost: '+(row.name||row.category)+' · '+money(row.totalCents))],
  platforms:rows=>[best(rows,'totalFeesCents',row=>'Highest fees: '+row.name+' week of '+day(row.weekStart)+' · '+money(row.totalFeesCents))],
  'order-lines':rows=>[best(rows,'totalCents',row=>'Largest line: '+row.name+' ('+row.supplier+') · '+money(row.totalCents)),top(rows,'supplier','totalCents',(name,value)=>'Top supplier: '+name+' · '+money(value))],
  transfers:rows=>[count(rows.filter(row=>row.direction==='out'),'Sent out'),count(rows.filter(row=>row.direction==='in'),'Received')],
  invoices:rows=>[best(rows,'totalCents',row=>'Largest invoice: '+row.supplier+' · '+money(row.totalCents)),top(rows,'supplier','totalCents',(name,value)=>'Top supplier: '+name+' · '+money(value))],
  bundles:rows=>[best(rows,'count',row=>'Busiest week: '+day(row.weekStart)+' · '+row.count+' invoices')],
  counts:rows=>[count(rows,'Items counted'),top(rows,'recordedBy',null,(name,value)=>'Most entries: '+name+' · '+value)],
  cycles:rows=>[best(rows,'quantity',row=>'Most used: '+row.name+' · '+new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(row.quantity))]
 };
 function best(rows,key,text){const list=rows.filter(row=>Number.isFinite(row[key]));if(!list.length)return null;return text(list.reduce((a,b)=>b[key]>a[key]?b:a));}
 function worst(rows,key,text){const list=rows.filter(row=>Number.isFinite(row[key]));if(!list.length)return null;return text(list.reduce((a,b)=>b[key]<a[key]?b:a));}
 function top(rows,key,sum,text){const totals=new Map();for(const row of rows){if(!row[key])continue;const value=sum?(Number.isFinite(row[sum])?row[sum]:0):1;totals.set(row[key],(totals.get(row[key])||0)+value);}const entry=[...totals].sort((a,b)=>b[1]-a[1])[0];return entry?text(entry[0],entry[1]):null;}
 function count(rows,label){return rows.length?label+': '+rows.length:null;}
 const attention=rows=>rows.filter(row=>typeof row.status==='string'&&/missing|check|negative|unknown|incomplete|pending/i.test(row.status)).length;
 let current='',chosen='',panel,select,host,strip;
 function build(){if(panel)return;panel=el('section',undefined,'management report-panel report-people');panel.id='report-people-panel';panel.setAttribute('aria-labelledby','report-people-title');
  const heading=el('div',undefined,'report-panel-heading report-people-heading'),title=el('h2','By person');title.id='report-people-title';const tools=el('div',undefined,'report-people-tools'),label=el('label','Person','report-people-label');select=el('select');select.id='report-person';label.htmlFor='report-person';select.onchange=()=>{chosen=select.value;window.reportRerender?.();};tools.append(label,select);heading.append(title,tools);host=el('div',undefined,'report-people-body');panel.append(heading,host);
  strip=el('div',undefined,'report-highlights');strip.id='report-highlights';strip.setAttribute('aria-label','Highlights');}
 function place(view){if(['training','checklists'].includes(view)){const ranking=document.getElementById('report-location-rankings'),progress=document.getElementById('report-progress-panel');if(!progress||progress.hidden)return false;const anchor=ranking&&progress.contains(ranking)?ranking:document.getElementById('report-progress-summary');if(!anchor)return false;if(anchor.nextElementSibling!==strip||strip.nextElementSibling!==panel)anchor.after(strip,panel);return true;}const target=window.reportDetails?.views?.[view]?document.getElementById('report-detailed-panel'):['training','checklists'].includes(view)?document.getElementById('report-progress-panel'):document.querySelector('[data-report-view="'+view+'"]:not([hidden])');if(!target)return false;if(panel.nextElementSibling!==target)target.before(panel);if(strip.nextElementSibling!==panel)panel.before(strip);return true;}
 function rowsFor(view){if(window.reportDetails?.views?.[view])return window.reportDetails.personRows?.()||[];if(['training','checklists'].includes(view))return window.reportProgress?.personRows?.()||[];return[];}
 function update(view){build();if(view!==current){current=view;chosen='';}if(view==='activity'||!place(view)){panel.hidden=true;strip.hidden=true;return;}panel.hidden=false;
  const rows=rowsFor(view),setup=config[view];
  // Highlights.
  strip.replaceChildren();const items=(highlights[view]?.(rows)||[]).filter(Boolean),flagged=attention(rows);if(flagged)items.push(flagged+(flagged===1?' entry needs':' entries need')+' attention');strip.hidden=!items.length;for(const text of items){const item=data('span',text,'report-highlight');if(/attention/.test(text))item.dataset.state='attention';strip.append(item);}
  host.replaceChildren();
  if(!setup){select.closest('.report-people-tools').hidden=true;const info=none[view]||['combined','This report combines records.','activity','Staff activity'],note=el('div',undefined,'report-people-empty');note.append(el('p',info[1]+' It doesn’t record a person for each line.'));const link=el('a','See who did it in '+info[3],'report-people-link');link.href='#'+info[2];note.append(link);host.append(note);return;}
  select.closest('.report-people-tools').hidden=false;
  const key=typeof setup.key==='function'?setup.key:row=>row[setup.key],people=new Map();
  for(const row of rows){const name=key(row)||'Not recorded',item=people.get(name)||{name,count:0,total:0,hasTotal:false,done:0,last:''};item.count++;if(setup.total&&Number.isFinite(row[setup.total])){item.total+=row[setup.total];item.hasTotal=true;}if(setup.done?.(row))item.done++;const when=row.updatedAt||row.completedAt||row.createdAt||row.date||row.weekStart||'';if(when>item.last)item.last=when;people.set(name,item);}
  const list=[...people.values()].sort((a,b)=>a.name==='Not recorded'?1:b.name==='Not recorded'?-1:b.count-a.count||a.name.localeCompare(b.name));
  const label=name=>name==='Not recorded'&&setup.blank?setup.blank:name,options=[['','Everyone'],...list.map(item=>[item.name,label(item.name)+' ('+item.count+')'])];if(chosen&&!people.has(chosen))options.push([chosen,chosen+' (0)']);select.replaceChildren(...options.map(([value,text])=>{const option=el('option',text);option.value=value;return option;}));select.value=chosen;window.appSelects?.refresh?.(select);
  if(!list.length){host.append(el('p','No records in this selection.','report-people-none'));return;}
  const most=Math.max(...list.map(item=>item.count)),grid=el('div',undefined,'report-people-grid');
  for(const item of list){const card=el('button',undefined,'report-person-card');card.type='button';card.setAttribute('aria-pressed',String(chosen===item.name));card.title=chosen===item.name?'Show everyone':'Show only '+label(item.name);card.onclick=()=>{chosen=chosen===item.name?'':item.name;window.reportRerender?.();};
   const top=el('span',undefined,'report-person-top'),avatar=data('span',item.name==='Not recorded'?'–':initials(item.name),'report-person-avatar');avatar.setAttribute('aria-hidden','true');top.append(avatar,data('strong',label(item.name)));
   const stats=el('span',undefined,'report-person-stats');stats.append(el('span',item.count+' '+setup.unit[item.count===1?0:1]));if(setup.done)stats.append(el('span',item.done+' '+setup.doneLabel.toLowerCase()));if(setup.total&&item.hasTotal)stats.append(el('span',money(item.total),'report-person-total'));
   const bar=el('span',undefined,'report-person-bar'),fill=el('span');fill.style.width=Math.max(4,Math.round(item.count/most*100))+'%';bar.append(fill);
   card.append(top,stats,bar);if(item.last)card.append(el('small','Last: '+day(item.last),'report-person-last'));grid.append(card);}
  const caption=el('p',setup.role+'. Select a person to show only their '+setup.unit[1]+(setup.total?'; totals are '+setup.totalLabel.toLowerCase():'')+'.','report-people-caption');host.append(caption,grid);
 }
 window.reportPeople={update,selected:()=>chosen};
})();
