// Optional checklist features on the Checklists page (see docs/checklist-extras.md): Issues, Logs, Trends, QR codes and
// Features views, plus reader additions (handover notes, review, scans, Print / Save as PDF), roster names on cards,
// review badges in History and starter templates in the builder. Browsing never writes; only explicit buttons save.
(()=>{
 const host=document.getElementById('checklist-extras-view');if(!host)return;
 const model=window.checklistExtrasModel,views=['issues','logs','trends','qr','features'];
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined&&text!==null)element.textContent=text;if(cls)element.className=cls;return element;};
 const ui=(tag,text,cls)=>{const element=node(tag,window.interfaceLabel?interfaceLabel(text):text,cls);return element;};
 const data=(tag,text,cls)=>{const element=node(tag,text,cls);element.dataset.userText='';return element;};
 const button=(text,cls,onclick)=>{const element=ui('button',text,cls||'cx-button');element.type='button';if(onclick)element.onclick=onclick;return element;};
 const dateText=value=>value?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value.slice(0,10)+'T12:00:00Z')):'';
 const when=value=>value?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(new Date(value)):'';
 let session=null,settings=null,current=null,ready=null;
 const can=key=>Boolean(window.appAccess?.can?.(key));
 async function api(path,method='GET',body){const response=await fetch('/api/checklist-extras/'+path,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||'',...(session?.locationId?{'X-Location-Id':session.locationId}:{})},body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json().catch(()=>({}));if(!response.ok){if(response.status===428)window.appRequiredReading?.check?.();throw Object.assign(Error(value.error||'Unable to load this checklist feature.'),{status:response.status});}return value;}
 const on=id=>Boolean(settings?.features?.[id]);
 const viewOn={issues:()=>on('issues'),logs:()=>on('foodSafety'),trends:()=>on('trends'),qr:()=>on('qr')&&can('ops.manage'),features:()=>can('ops.manage')};
 async function loadSettings(){try{settings=await api('settings');}catch{settings={features:{},canEdit:false};}for(const item of document.querySelectorAll('[data-checklist-extra]'))item.hidden=!viewOn[item.dataset.opsView]?.();}
 ready=(async()=>{try{session=await window.appAccess.initialSession();}catch{return;}await loadSettings();handleScan();})();
 function panel(title,intro){host.replaceChildren();const head=node('header',undefined,'cx-head'),titles=node('div');titles.append(ui('h2',title),ui('p',intro,'cx-intro'));head.append(titles);host.append(head);const body=node('div',undefined,'cx-body');host.append(body);return{head,body};}
 const message=(box,text,error)=>{box.replaceChildren(ui('p',text,'cx-note'+(error?' is-error':'')));};
 window.checklistExtras={
  isView:view=>views.includes(view),
  async show(view){current=view;host.hidden=false;await ready;if(current!==view)return;if(!viewOn[view]?.()){panel('Not available','This checklist feature is switched off or needs other permissions.');return;}({issues:showIssues,logs:showLogs,trends:showTrends,qr:showQr,features:showFeatures})[view]();},
  hide(){current=null;host.hidden=true;host.replaceChildren();}
 };

 // Issues: failed checks to follow up.
 let issueFilter='open';
 async function showIssues(){
  const {head,body}=panel('Issues','Failed checks from the last 60 days. Give each an owner and due date, then resolve it with a note.');
  const tabs=node('div',undefined,'cx-tabs');for(const [id,label] of [['open','Open'],['resolved','Resolved'],['all','All']]){const tab=button(label,'cx-tab',()=>{issueFilter=id;showIssues();});tab.setAttribute('aria-pressed',String(issueFilter===id));tabs.append(tab);}head.append(tabs);
  message(body,'Loading issues…');
  try{const value=await api('issues?status='+issueFilter);if(current!=='issues')return;body.replaceChildren();
   if(!value.issues.length){message(body,issueFilter==='open'?'No open issues. Failed checks on completed checklists appear here.':'No issues to show.');return;}
   const list=node('div',undefined,'cx-issue-list');for(const issue of value.issues)list.append(issueCard(issue,value));body.append(list);}
  catch(error){message(body,error.message,true);}
 }
 function issueCard(issue,value){
  const card=node('article',undefined,'cx-card cx-issue is-'+issue.status+(issue.overdue?' is-overdue':''));
  const top=node('div',undefined,'cx-card-top');top.append(data('h3',issue.stepTitle),ui('span',issue.status==='resolved'?'Resolved':issue.overdue?'Overdue':'Open','cx-chip is-'+(issue.status==='resolved'?'ok':issue.overdue?'bad':'warn')));card.append(top);
  const facts=node('dl',undefined,'cx-facts'),fact=(label,text)=>{if(!text)return;const row=node('div');row.append(ui('dt',label),data('dd',text));facts.append(row);};
  fact('Checklist',issue.title);fact('Answer',issue.answer+(issue.rule?' · '+issue.rule:''));fact('Corrective note',issue.note);fact('Where',issue.locationName+' · '+dateText(issue.workDate));fact('Completed by',issue.completedBy);
  if(issue.owner)fact('Owner',issue.owner.name);if(issue.dueDate)fact('Due',dateText(issue.dueDate));if(issue.resolution)fact('Resolved',issue.resolution.note+' — '+issue.resolution.by+', '+when(issue.resolution.at));
  card.append(facts);
  if(issue.equipment){const link=node('a',undefined,'cx-link');link.href='/equipment?q='+encodeURIComponent(issue.equipment);link.textContent=(window.interfaceLabel?interfaceLabel('Report a problem with'):'Report a problem with')+' '+issue.equipment;card.append(link);}
  if(value.canEdit){
   const form=node('div',undefined,'cx-issue-form'),owner=node('select'),due=node('input'),note=node('textarea');
   owner.append(ui('option','No owner'));owner.options[0].value='';for(const person of value.owners){const option=data('option',person.name);option.value=person.id;owner.append(option);}owner.value=issue.owner?.id||'';owner.setAttribute('aria-label','Owner');
   due.type='date';due.value=issue.dueDate||'';due.setAttribute('aria-label','Due date');note.rows=2;note.maxLength=1000;note.placeholder=window.interfaceLabel?interfaceLabel('What was done to fix it?'):'What was done to fix it?';note.value=issue.resolution?.note||'';note.setAttribute('aria-label','Resolution note');
   const status=node('p',undefined,'cx-note');status.setAttribute('role','status');
   const save=async state=>{if(state==='resolved'&&!note.value.trim()){status.textContent=window.interfaceLabel?interfaceLabel('Add a note saying how it was fixed.'):'Add a note saying how it was fixed.';note.focus();return;}for(const control of form.querySelectorAll('button,select,input,textarea'))control.disabled=true;status.textContent=window.interfaceLabel?interfaceLabel('Saving…'):'Saving…';
    try{await api('issues/'+issue.runId+'/'+issue.stepId,'PUT',{revision:issue.revision,ownerId:owner.value||null,dueDate:due.value||null,status:state,note:note.value});await showIssues();}
    catch(error){status.textContent=error.message;for(const control of form.querySelectorAll('button,select,input,textarea'))control.disabled=false;}};
   const row=node('div',undefined,'cx-row');const ownerLabel=ui('label','Owner','cx-field');ownerLabel.append(owner);const dueLabel=ui('label','Due','cx-field');dueLabel.append(due);row.append(ownerLabel,dueLabel);
   const actions=node('div',undefined,'cx-actions');actions.append(button(issue.status==='resolved'?'Reopen':'Save','cx-button',()=>save('open')),button(issue.status==='resolved'?'Update resolution':'Resolve','cx-button cx-primary',()=>save('resolved')));
   form.append(row,note,actions,status);card.append(form);
  }
  return card;
 }

 // Logs: number checks (temperatures and other readings) over time.
 let logChoice={templateId:'',stepId:'',days:'30'};
 async function showLogs(){
  const {head,body}=panel('Logs','Readings from number checks such as fridge and cooking temperatures, with their safe range.');
  const controls=node('div',undefined,'cx-row'),checklist=node('select'),step=node('select'),days=node('select');
  for(const value of ['7','14','30','60','90']){const option=data('option',value+' days');option.value=value;days.append(option);}days.value=logChoice.days;
  const field=(label,control)=>{const wrap=ui('label',label,'cx-field');wrap.append(control);return wrap;};controls.append(field('Checklist',checklist),field('Reading',step),field('Period',days));head.append(controls);
  message(body,'Loading logs…');
  let catalogue=[];
  const fillSteps=()=>{step.replaceChildren();const entry=catalogue.find(item=>item.templateId===checklist.value);for(const item of entry?.steps||[]){const option=data('option',item.title+(item.unit?' ('+item.unit+')':''));option.value=item.id;step.append(option);}if(entry?.steps.some(item=>item.id===logChoice.stepId))step.value=logChoice.stepId;window.appSelects?.refresh?.(step);};
  const draw=async()=>{logChoice={templateId:checklist.value,stepId:step.value,days:days.value};if(!checklist.value||!step.value){message(body,'Choose a checklist with a number check.');return;}message(body,'Loading readings…');
   try{const value=await api('logs?'+new URLSearchParams(logChoice));if(current!=='logs')return;body.replaceChildren();if(!value.points.length){message(body,'No readings in this period.');return;}body.append(logChart(value),logTable(value));}catch(error){message(body,error.message,true);}};
  checklist.onchange=()=>{fillSteps();draw();};step.onchange=draw;days.onchange=draw;
  try{const value=await api('logs?days='+days.value);if(current!=='logs')return;catalogue=value.checklists;
   if(!catalogue.length){message(body,'No completed checklists with number checks yet. Add a Number step (for example a temperature) to a checklist to start a log.');return;}
   for(const item of catalogue){const option=data('option',item.title);option.value=item.templateId;checklist.append(option);}checklist.value=catalogue.some(item=>item.templateId===logChoice.templateId)?logChoice.templateId:catalogue[0].templateId;window.appSelects?.refresh?.(checklist);window.appSelects?.refresh?.(days);fillSteps();draw();}
  catch(error){message(body,error.message,true);}
 }
 function logChart(value){
  const width=720,height=240,pad={l:44,r:12,t:12,b:28},points=value.points,values=points.map(point=>point.value),rule=value.rule||{};
  const low=Math.min(...values,rule.min??Infinity,rule.max??Infinity),high=Math.max(...values,rule.max??-Infinity,rule.min??-Infinity),span=high-low||1,min=low-span*.12,max=high+span*.12;
  const x=index=>pad.l+(points.length===1?(width-pad.l-pad.r)/2:index*(width-pad.l-pad.r)/(points.length-1)),y=v=>pad.t+(max-v)/(max-min)*(height-pad.t-pad.b);
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),el=(tag,attrs)=>{const item=document.createElementNS(ns,tag);for(const [key,val] of Object.entries(attrs))item.setAttribute(key,val);svg.append(item);return item;};
  svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.setAttribute('class','cx-chart');svg.setAttribute('role','img');svg.setAttribute('aria-label','Readings chart');
  if(rule.min!=null||rule.max!=null){const top=y(rule.max??max),bottom=y(rule.min??min);el('rect',{x:pad.l,y:top,width:width-pad.l-pad.r,height:Math.max(0,bottom-top),class:'cx-band'});}
  for(const tick of [min,(min+max)/2,max]){el('line',{x1:pad.l,x2:width-pad.r,y1:y(tick),y2:y(tick),class:'cx-grid'});const label=el('text',{x:pad.l-6,y:y(tick)+4,class:'cx-axis','text-anchor':'end'});label.textContent=Math.round(tick*10)/10;}
  el('polyline',{points:points.map((point,index)=>x(index)+','+y(point.value)).join(' '),class:'cx-line'});
  points.forEach((point,index)=>{const dot=el('circle',{cx:x(index),cy:y(point.value),r:4,class:point.passed?'cx-dot':'cx-dot is-fail'});const title=document.createElementNS(ns,'title');title.textContent=dateText(point.date)+' · '+point.value+(value.unit?' '+value.unit:'')+(point.passed?'':' · outside the safe range');dot.append(title);});
  const wrap=node('div',undefined,'cx-chart-wrap');wrap.append(svg);if(rule.min!=null||rule.max!=null)wrap.append(ui('p',(rule.min!=null&&rule.max!=null?'Safe range '+rule.min+' to '+rule.max:rule.max!=null?'Safe at or below '+rule.max:'Safe at or above '+rule.min)+(value.unit?' '+value.unit:''),'cx-note'));return wrap;
 }
 function logTable(value){const wrap=node('div',undefined,'cx-table-wrap'),table=node('table'),head=node('tr');for(const label of ['Date','Reading','Result','Location','By'])head.append(ui('th',label));const thead=node('thead');thead.append(head);const tbody=node('tbody');
  for(const point of [...value.points].reverse()){const row=node('tr');row.append(data('td',dateText(point.date)+(point.at?' '+when(point.at).split(', ').pop():'')),data('td',point.value+(value.unit?' '+value.unit:'')),ui('td',point.passed?'In range':'Out of range',point.passed?'is-ok':'is-bad'),data('td',point.locationName),data('td',point.by||''));tbody.append(row);}
  table.append(thead,tbody);wrap.append(table);return wrap;}

 // Trends: each store's weekly checklist score and a leaderboard.
 let trendWeeks='8';
 async function showTrends(){
  const {head,body}=panel('Score trends','Each store’s average checklist score per week: the points score for scored checklists, otherwise the share of checks that passed.');
  const weeks=node('select');for(const value of ['4','8','12','26']){const option=data('option',value+' weeks');option.value=value;weeks.append(option);}weeks.value=trendWeeks;weeks.onchange=()=>{trendWeeks=weeks.value;showTrends();};const label=ui('label','Period','cx-field');label.append(weeks);head.append(label);
  message(body,'Loading trends…');
  try{const value=await api('trends?weeks='+trendWeeks);if(current!=='trends')return;body.replaceChildren();if(!value.stores.length){message(body,'No completed checklists in this period yet.');return;}
   const medals={1:'gold',2:'silver',3:'bronze'},wrap=node('div',undefined,'cx-table-wrap cx-trends'),table=node('table'),head=node('tr');
   for(const text of ['Rank','Store','Last 4 weeks'])head.append(ui('th',text));for(const start of value.weeks)head.append(data('th',new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(start+'T12:00:00Z'))));
   const thead=node('thead');thead.append(head);const tbody=node('tbody');
   for(const store of value.stores){const row=node('tr');if(medals[store.rank])row.className='is-'+medals[store.rank];const rank=data('td',store.rank??'—','cx-rank'+(medals[store.rank]?' is-'+medals[store.rank]:''));if(medals[store.rank])rank.setAttribute('aria-label',medals[store.rank]+' · place '+store.rank);row.append(rank,data('td',store.name,'cx-store'),data('td',store.recentScore===null?'—':store.recentScore+'%','cx-score'));
    for(const cell of store.weeks){const td=node('td','', 'cx-week');if(cell.score!==null){const bar=node('span',undefined,'cx-bar');bar.style.setProperty('--score',cell.score);bar.title=cell.score+'% · '+cell.runs+(cell.runs===1?' checklist':' checklists');const value=data('span',Math.round(cell.score)+'%');td.append(bar,value);}else td.textContent='—';row.append(td);}tbody.append(row);}
   table.append(thead,tbody);wrap.append(table);body.append(wrap);}
  catch(error){message(body,error.message,true);}
 }

 // QR codes: printable station codes that open a checklist.
 async function showQr(){
  const {body}=panel('QR codes','Stick a QR code at a fridge, toilet or station. Scanning it opens that checklist and records who scanned it and when.');
  message(body,'Loading QR codes…');
  try{const value=await api('stations');if(current!=='qr')return;body.replaceChildren();
   const form=node('form',undefined,'cx-card cx-qr-form'),plan=node('select'),place=node('select'),name=node('input'),equipment=node('input'),status=node('p',undefined,'cx-note');form.noValidate=true;
   for(const item of value.plans){const option=data('option',item.title);option.value=item.id;plan.append(option);}
   const places=()=>{place.replaceChildren();const chosen=value.plans.find(item=>item.id===plan.value);for(const item of value.locations.filter(location=>chosen?.locationIds.includes(location.id))){const option=data('option',item.name);option.value=item.id;place.append(option);}window.appSelects?.refresh?.(place);};plan.onchange=places;places();
   name.maxLength=80;name.placeholder=window.interfaceLabel?interfaceLabel('e.g. Walk-in fridge'):'e.g. Walk-in fridge';equipment.maxLength=120;equipment.placeholder=window.interfaceLabel?interfaceLabel('Optional, e.g. Walk-in fridge'):'Optional, e.g. Walk-in fridge';
   const field=(label,control)=>{const wrap=ui('label',label,'cx-field');wrap.append(control);return wrap;};
   const row=node('div',undefined,'cx-row');row.append(field('Checklist',plan),field('Location',place),field('Station name',name),field('Equipment (for problem reports)',equipment));
   let requestId=crypto.randomUUID();const add=button('Add QR code','cx-button cx-primary');add.type='submit';
   form.append(ui('h3','Add a QR code'),row,add,status);
   if(!value.plans.length){form.replaceChildren(ui('p','Plans you manage appear here once they have locations.','cx-note'));}
   form.onsubmit=async event=>{event.preventDefault();if(!name.value.trim()){status.textContent=window.interfaceLabel?interfaceLabel('Enter a station name.'):'Enter a station name.';name.focus();return;}add.disabled=true;status.textContent=window.interfaceLabel?interfaceLabel('Saving…'):'Saving…';try{await api('stations','POST',{requestId,plannerId:plan.value,locationId:place.value,name:name.value,equipment:equipment.value});requestId=crypto.randomUUID();await showQr();}catch(error){add.disabled=false;status.textContent=error.message;}};
   body.append(form);
   const grid=node('div',undefined,'cx-qr-grid');
   for(const station of value.stations){const card=node('article',undefined,'cx-card cx-qr');const image=node('img');image.src='/api/checklist-extras/stations/'+station.id+'/qr.svg';image.alt=(window.interfaceLabel?interfaceLabel('QR code for'):'QR code for')+' '+station.name;card.append(image,data('h3',station.name),data('p',station.planTitle+' · '+station.locationName,'cx-note'));if(station.equipment)card.append(data('p',station.equipment,'cx-note'));
    const actions=node('div',undefined,'cx-actions');actions.append(button('Print','cx-button',()=>printQr(station)),button('Delete','cx-button cx-danger',async()=>{if(!confirm((window.interfaceLabel?interfaceLabel('Delete this QR code? Printed copies will stop working.'):'Delete this QR code? Printed copies will stop working.')))return;try{await api('stations/'+station.id,'DELETE');await showQr();}catch(error){alert(error.message);}}));card.append(actions);grid.append(card);}
   if(!value.stations.length)grid.append(ui('p','No QR codes yet.','cx-note'));
   body.append(grid);window.appSelects?.refresh?.(plan);}
  catch(error){message(body,error.message,true);}
 }
 function printQr(station){const win=window.open('','_blank');if(!win){alert(window.interfaceLabel?interfaceLabel('Allow pop-ups to print.'):'Allow pop-ups to print.');return;}const doc=win.document;doc.title=station.name;const style=doc.createElement('style');style.textContent='body{font-family:system-ui,sans-serif;text-align:center;padding:24px}img{width:70mm;height:70mm}h1{font-size:22pt;margin:12px 0 4px}p{margin:2px 0;color:#444}';doc.head.append(style);const image=doc.createElement('img');image.src=location.origin+'/api/checklist-extras/stations/'+station.id+'/qr.svg';const h1=doc.createElement('h1');h1.textContent=station.name;const p=doc.createElement('p');p.textContent=station.planTitle+' · '+station.locationName;const hint=doc.createElement('p');hint.textContent='Scan to open this checklist';doc.body.append(image,h1,p,hint);image.onload=()=>{win.focus();win.print();};}

 // Features: the company switches and roster assignment per plan.
 async function showFeatures(){
  const {body}=panel('Checklist features','Turn optional checklist features on or off for every location in this company. Turning one off hides it and never deletes saved details.');
  message(body,'Loading…');
  try{const value=await api('settings');if(current!=='features')return;body.replaceChildren();
   const form=node('form',undefined,'cx-card cx-switches'),status=node('p',undefined,'cx-note');form.noValidate=true;
   for(const feature of model.features){const row=node('label',undefined,'cx-switch'),textBox=node('span',undefined,'cx-switch-text'),input=node('input');input.type='checkbox';input.setAttribute('role','switch');input.name='cx-feature';input.value=feature.id;input.checked=value.features[feature.id]!==false;input.disabled=!value.canEdit;textBox.append(ui('strong',feature.name),ui('small',feature.description));row.append(textBox,input,node('span',undefined,'cx-switch-track'));form.append(row);}
   const save=button('Save features','cx-button cx-primary');save.type='submit';save.hidden=!value.canEdit;form.append(save,status);
   form.onsubmit=async event=>{event.preventDefault();save.disabled=true;status.textContent=window.interfaceLabel?interfaceLabel('Saving…'):'Saving…';try{await api('settings','PUT',{revision:value.revision,features:Object.fromEntries([...form.querySelectorAll('input[name=cx-feature]')].map(input=>[input.value,input.checked]))});await loadSettings();await showFeatures();}catch(error){save.disabled=false;status.textContent=error.message;}};
   body.append(form);
   if(value.features.roster)body.append(await rosterPanel());}
  catch(error){message(body,error.message,true);}
 }
 async function rosterPanel(){
  const card=node('section',undefined,'cx-card');card.append(ui('h3','Assign from the roster'),ui('p','Choose who the published roster puts on each checklist. They see their name on the checklist card and get a notification.','cx-note'));
  try{const [roster,list]=await Promise.all([api('roster'),fetch('/api/ops-management',{cache:'no-store',headers:session?.locationId?{'X-Location-Id':session.locationId}:{}}).then(response=>response.json())]);
   const plans=(list.planners||[]).filter(plan=>plan.canManage);if(!plans.length){card.append(ui('p','Plans you manage appear here.','cx-note'));return card;}
   for(const plan of plans){const row=node('label',undefined,'cx-field cx-roster-row'),select=node('select');row.append(data('span',plan.templateTitle||plan.title));for(const mode of model.rosterModes){const option=ui('option',mode.label);option.value=mode.id;select.append(option);}select.value=roster.modes[plan.id]||'off';
    select.onchange=async()=>{select.disabled=true;try{await api('roster/'+plan.id,'PUT',{mode:select.value});}catch(error){alert(error.message);select.value=roster.modes[plan.id]||'off';}finally{select.disabled=false;roster.modes[plan.id]=select.value;}};row.append(select);card.append(row);}}
  catch(error){card.append(data('p',error.message,'cx-note is-error'));}
  return card;
 }

 // Checklist cards: who the roster puts on each checklist today. History cards: review badges.
 document.addEventListener('ops-rendered',async event=>{
  await ready;const {view,result}=event.detail;
  if(view==='checklists'&&on('roster')){try{const value=await api('roster?date='+encodeURIComponent(result.date));if(!value.enabled)return;for(const card of document.querySelectorAll('#ops-list [data-layout-key^="task:"]')){const [,plannerId,locationId]=card.dataset.layoutKey.split(':'),people=value.assigned[plannerId+':'+locationId];card.querySelector('.cx-on-shift')?.remove();if(!people)continue;const line=data('p',(window.interfaceLabel?interfaceLabel('On shift'):'On shift')+': '+(people.length?people.map(person=>person.name).join(', '):(window.interfaceLabel?interfaceLabel('nobody rostered'):'nobody rostered')),'cx-on-shift');(card.querySelector('h3')||card.firstChild)?.after(line);}}catch{}}
  if(view==='history'&&on('review')){const ids=(result.runs||[]).map(run=>run.id);if(!ids.length)return;try{const value=await api('reviews?ids='+ids.join(','));for(const [id,review] of Object.entries(value.reviews)){const card=document.querySelector('#ops-list [data-layout-key="run:'+id+'"]');if(!card)continue;card.querySelector('.cx-review-chip')?.remove();const chip=ui('span',review.status==='approved'?'Approved':'Redo requested','cx-chip cx-review-chip is-'+(review.status==='approved'?'ok':'bad'));(card.querySelector('h3')||card.firstChild)?.after(chip);}}catch{}}
  if(view==='templates'&&on('starters')&&can('ops.manage'))addStarterButton();
 });

 // Starter templates: ready-made checklists added through the normal checklist API.
 function addStarterButton(){
  const list=document.getElementById('ops-list');if(!list||document.getElementById('cx-starters'))return;
  const bar=node('div',undefined,'cx-starter-bar');bar.id='cx-starters';const open=button('Add a starter template','cx-button');open.onclick=()=>starterDialog(open);bar.append(open);list.before(bar);
  document.addEventListener('ops-rendered',function remove(event){if(event.detail.view!=='templates'){bar.remove();document.removeEventListener('ops-rendered',remove);}});
 }
 function starterDialog(trigger){
  const dialog=node('dialog',undefined,'cx-dialog');dialog.setAttribute('aria-label','Starter templates');const head=node('header',undefined,'cx-dialog-head');head.append(ui('h2','Starter templates'));const close=button('×','cx-close',()=>dialog.close());close.setAttribute('aria-label','Close');head.append(close);
  const body=node('div',undefined,'cx-dialog-body'),status=node('p',undefined,'cx-note');status.setAttribute('role','status');body.append(ui('p','Add a ready-made checklist, then change it like any other. Plans and locations are set in the Plans stage.','cx-note'));
  for(const starter of model.starters){const card=node('article',undefined,'cx-card cx-starter');card.append(ui('h3',starter.title),ui('p',starter.description,'cx-note'),data('p',starter.steps.filter(step=>step.type!=='section').length+' checks','cx-note'));const add=button('Add','cx-button cx-primary');let requestId=crypto.randomUUID();
   add.onclick=async()=>{add.disabled=true;status.textContent=window.interfaceLabel?interfaceLabel('Adding…'):'Adding…';try{const steps=starter.steps.map(step=>({...structuredClone(step),id:crypto.randomUUID(),title:window.interfaceLabel?interfaceLabel(step.title):step.title}));const response=await fetch('/api/ops-management/templates',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session?.csrf||'',...(session?.locationId?{'X-Location-Id':session.locationId}:{})},body:JSON.stringify({contentOnly:true,requestId,title:window.interfaceLabel?interfaceLabel(starter.title):starter.title,description:starter.description,steps})});const value=await response.json().catch(()=>({}));if(!response.ok)throw Error(value.error||'Unable to add this checklist.');requestId=crypto.randomUUID();status.textContent=(window.interfaceLabel?interfaceLabel('Added'):'Added')+': '+value.title;add.disabled=false;document.querySelector('[data-ops-view="templates"]')?.click();}catch(error){add.disabled=false;status.textContent=error.message;}};
   card.append(add);body.append(card);}
  body.append(status);dialog.append(head,body);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();trigger?.focus?.();});dialog.showModal();
 }

 // Reader additions for an opened checklist.
 document.addEventListener('ops-run-opened',async event=>{
  await ready;const run=event.detail.run;if(!run?.id||!settings)return;const answers=document.getElementById('ops-answers');if(!answers)return;
  document.getElementById('cx-run-top')?.remove();document.getElementById('cx-run-bottom')?.remove();
  const top=node('div',undefined,'cx-run-top');top.id='cx-run-top';const bottom=node('div',undefined,'cx-run-bottom');bottom.id='cx-run-bottom';answers.before(top);answers.after(bottom);
  const tasks=[];
  if(on('handover'))tasks.push(api('handover/'+run.id).then(value=>{if(!value.enabled)return;if(value.previous){const box=node('aside',undefined,'cx-handover');box.append(ui('strong','Note from the last shift'),data('p',value.previous.note),data('small',value.previous.by+' · '+when(value.previous.at)));top.append(box);}
   if(value.canWrite&&run.status!=='upcoming'){const box=node('section',undefined,'cx-handover-edit'),label=ui('label','Note for the next shift','cx-field'),input=node('textarea'),save=button('Save note','cx-button'),status=node('span',undefined,'cx-note');input.rows=2;input.maxLength=500;input.value=value.mine?.note||'';label.append(input);let saved=input.value;
    save.onclick=async()=>{save.disabled=true;status.textContent=window.interfaceLabel?interfaceLabel('Saving…'):'Saving…';try{await api('handover/'+run.id,'PUT',{note:input.value});saved=input.value;status.textContent=window.interfaceLabel?interfaceLabel('Saved'):'Saved';}catch(error){status.textContent=error.message;}finally{save.disabled=false;}};
    input.oninput=()=>{status.textContent=input.value===saved?'':(window.interfaceLabel?interfaceLabel('Not saved yet'):'Not saved yet');};
    const actions=node('div',undefined,'cx-actions');actions.append(save,status);box.append(label,actions);bottom.append(box);}}).catch(()=>{}));
  if(on('qr'))tasks.push(api('scans/'+run.id).then(value=>{if(value.scans.length){const line=data('p',(window.interfaceLabel?interfaceLabel('Scanned'):'Scanned')+': '+value.scans.map(scan=>scan.station+' · '+scan.name+' '+when(scan.at)).join(' / '),'cx-note cx-scans');top.append(line);}}).catch(()=>{}));
  if(run.status==='completed'){
   const actions=node('div',undefined,'cx-actions cx-run-actions');
   if(on('foodSafety'))actions.append(button('Print / Save as PDF','cx-button',()=>printRun(run.id)));
   bottom.append(actions);
   if(on('review'))tasks.push(api('reviews?ids='+run.id).then(value=>{if(value.enabled)bottom.prepend(reviewBox(run,value.reviews[run.id]||null,value.canReview));}).catch(()=>{}));
  }
  await Promise.all(tasks);
 });
 function reviewBox(run,review,canReview){
  const box=node('section',undefined,'cx-review'+(review?' is-'+review.status:''));box.append(ui('h3','Manager review'));
  if(review)box.append(ui('p',review.status==='approved'?'Approved':'Redo requested','cx-chip is-'+(review.status==='approved'?'ok':'bad')),...(review.comment?[data('p',review.comment)]:[]),data('small',review.by.name+' · '+when(review.at),'cx-note'));
  else box.append(ui('p','Not reviewed yet.','cx-note'));
  if(canReview){const comment=node('textarea'),status=node('span',undefined,'cx-note');comment.rows=2;comment.maxLength=1000;comment.placeholder=window.interfaceLabel?interfaceLabel('Comment (needed for a redo)'):'Comment (needed for a redo)';comment.setAttribute('aria-label','Review comment');
   const send=async state=>{if(state==='redo'&&!comment.value.trim()){status.textContent=window.interfaceLabel?interfaceLabel('Say what needs redoing.'):'Say what needs redoing.';comment.focus();return;}status.textContent=window.interfaceLabel?interfaceLabel('Saving…'):'Saving…';for(const control of box.querySelectorAll('button,textarea'))control.disabled=true;
    try{const saved=await api('reviews/'+run.id,'PUT',{revision:review?.revision||0,status:state,comment:comment.value});box.replaceWith(reviewBox(run,saved,canReview));}catch(error){status.textContent=error.message;for(const control of box.querySelectorAll('button,textarea'))control.disabled=false;}};
   const actions=node('div',undefined,'cx-actions');actions.append(button('Approve','cx-button cx-primary',()=>send('approved')),button('Ask for a redo','cx-button cx-danger',()=>send('redo')),status);box.append(comment,actions);}
  return box;
 }
 async function printRun(runId){
  const win=window.open('','_blank');if(!win){alert(window.interfaceLabel?interfaceLabel('Allow pop-ups to print.'):'Allow pop-ups to print.');return;}win.document.title='Checklist';win.document.body.textContent='Preparing…';
  try{const run=await api('print/'+runId),doc=win.document;doc.title=run.title;doc.body.replaceChildren();const style=doc.createElement('style');style.textContent='body{font:12pt/1.45 system-ui,sans-serif;color:#111;margin:18mm}h1{font-size:18pt;margin:0 0 4px}.meta{color:#444;margin:0 0 14px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ccc;padding:6px 4px;text-align:left;vertical-align:top}th{font-size:9pt;color:#555;text-transform:uppercase}tr.section td{font-weight:700;background:#f2f2f2}.fail{color:#b91c1c;font-weight:700}img{max-width:60mm;max-height:45mm;display:block;margin-top:4px}small{color:#555}@page{margin:12mm}';doc.head.append(style);
   const add=(tag,text,cls)=>{const item=doc.createElement(tag);if(text!==undefined)item.textContent=text;if(cls)item.className=cls;return item;};
   doc.body.append(add('h1',run.title),add('p',[run.locationName,dateText(run.workDate),run.completedAt?'Completed '+when(run.completedAt)+' by '+run.completedBy:'Not completed',run.score?'Score '+run.score.points+' / '+run.score.max+' ('+run.score.percent+'%)':'',run.review?(run.review.status==='approved'?'Approved':'Redo requested')+' by '+run.review.by.name:''].filter(Boolean).join(' · '),'meta'));
   const table=add('table'),head=add('tr');for(const label of ['Check','Answer','Time'])head.append(add('th',label));table.append(head);
   for(const step of run.steps){const row=add('tr',undefined,['section','timed-section'].includes(step.type)?'section':'');if(row.className){const cell=add('td',step.title);cell.colSpan=3;row.append(cell);table.append(row);continue;}if(step.type==='instruction')continue;
    const answer=add('td');answer.append(add('span',step.type==='signature'&&step.assets.length?'Signed':step.answer||'—',step.outcome==='fail'?'fail':''));if(step.rule)answer.append(add('br'),add('small',step.rule));if(step.note)answer.append(add('br'),add('small','Corrective action: '+step.note));for(const asset of step.assets){const image=add('img');image.src=location.origin+asset.url;image.alt='';answer.append(image);}
    row.append(add('td',step.title),answer,add('td',step.at?when(step.at)+(step.by?' · '+step.by:''):''));table.append(row);}
   doc.body.append(table,add('p','Printed '+when(new Date().toISOString()),'meta'));
   const images=[...doc.images];await Promise.all(images.map(image=>image.complete?null:new Promise(resolve=>{image.onload=image.onerror=resolve;})));win.focus();win.print();}
  catch(error){win.document.body.textContent=error.message;}
 }

 // QR scans: /ops-management?scan=<token> records the scan, then opens that checklist's card.
 async function handleScan(){
  const params=new URLSearchParams(location.search),token=params.get('scan');if(!token)return;params.delete('scan');history.replaceState(history.state,'',location.pathname+(params.toString()?'?'+params:'')+location.hash);
  const note=node('p',undefined,'cx-scan-banner');note.setAttribute('role','status');document.querySelector('main')?.prepend(note);
  try{const value=await api('scan','POST',{token});note.textContent=(window.interfaceLabel?interfaceLabel('Scanned'):'Scanned')+': '+value.station;
   const open=()=>{const card=document.querySelector('#ops-list [data-layout-key^="task:'+value.plannerId+':'+value.locationId+':"]');if(card){(card.querySelector('button')||card).click();return true;}return false;};
   if(!open()){const listener=()=>{if(open())document.removeEventListener('ops-rendered',listener);};document.addEventListener('ops-rendered',listener);setTimeout(()=>document.removeEventListener('ops-rendered',listener),15000);}
   setTimeout(()=>note.remove(),8000);}
  catch(error){note.textContent=error.message;note.classList.add('is-error');}
 }
})();
