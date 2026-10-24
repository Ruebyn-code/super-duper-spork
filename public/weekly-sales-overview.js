(()=>{
 const $=id=>document.getElementById(id),panel=$('weekly-overview-page');if(!panel||!appAccess.can('finances.view'))return;
 const fields=['salesCents','costOfGoodsPercent','labourPercent','opExPercent','roPercent','profitCents','profitPercent'];
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100),shortDate=value=>value.slice(8)+'.'+value.slice(5,7),date=value=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 let data=null,locationName='',quarter=new URL(location.href).searchParams.get('quarter')||'',mode=new URL(location.href).searchParams.get('period')==='ytd'?'ytd':'quarter',generation=0,busy=false;
 function label(node,text,values={}){node.dataset.appTemplate=text;node.dataset.appValues=JSON.stringify(values);node.textContent=wording(text,values);}
 function cell(row,field,summary=false){const td=document.createElement('td'),value=row[field];td.dataset.userText='';td.textContent=value===null?'':field.endsWith('Cents')?money(value):value.toFixed(2)+'%';if(summary)td.title=wording('{count} completed weeks',{count:row.counts[field]});if(field.startsWith('profit')){td.className=field==='profitCents'?'overview-profit':'overview-profit-percent';td.dataset.profitState=value===null?'unavailable':value>0?'profit':value<0?'loss':'break-even';}return td;}
 function appendRow(parent,row,title,{summary=false,previous=false}={}){const tr=document.createElement('tr'),th=document.createElement('th');th.scope='row';if(summary){tr.className=previous?'overview-previous':'overview-average';th.textContent=wording(title);th.dataset.appTemplate=title;th.dataset.appValues='{}';}else{tr.dataset.week=row.weekStart;const link=document.createElement('a');link.href='/sales?week='+encodeURIComponent(row.weekStart)+'#report';link.textContent=shortDate(row.weekStart)+' – '+shortDate(row.weekEnd);link.title=date(row.weekStart)+' – '+date(row.weekEnd);th.append(link);if(row.recordedDays>0&&row.recordedDays<7){const partial=document.createElement('span');partial.className='overview-partial';partial.textContent=wording('{count}/7 days',{count:row.recordedDays});th.append(partial);}if(row.pricePending)tr.title=wording('Some placed orders have prices pending.');}tr.append(th,...fields.map(field=>cell(row,field,summary)));parent.append(tr);}
 function appendWeeks(body){
  let previousQuarter='';
  for(const row of data.rows){
   if(data.period.mode==='ytd'){
    // A completed week belongs to its Sunday's quarter. Keep the unfinished
    // week in the current quarter when its Sunday falls beyond the YTD cutoff.
    const through=row.weekEnd<data.period.endDate?row.weekEnd:data.period.endDate,year=through.slice(0,4),number=Math.floor((Number(through.slice(5,7))-1)/3)+1,key=year+'-Q'+number;
    if(key!==previousQuarter){const tr=document.createElement('tr'),th=document.createElement('th'),month=new Intl.DateTimeFormat('en-AU',{month:'short',timeZone:'UTC'}),first=new Date(Date.UTC(Number(year),(number-1)*3,1)),last=new Date(Date.UTC(Number(year),number*3-1,1));tr.className='overview-quarter-divider';tr.dataset.quarter=key;th.colSpan=8;th.scope='row';th.dataset.editId='overview-quarter-heading-'+key;label(th,'Q{quarter} · {months} {year}',{quarter:number,months:month.format(first)+'–'+month.format(last),year});tr.append(th);body.append(tr);previousQuarter=key;}
   }
   appendRow(body,row);
  }
 }
 function render(){
  for(const button of panel.querySelectorAll('[data-overview-mode]')){const active=button.dataset.overviewMode===mode;button.setAttribute('aria-pressed',String(active));}
  $('overview-quarter-controls').hidden=mode!=='quarter';$('overview-current').disabled=busy||Boolean(data&&quarter===data.period.currentQuarter);if(!data)return;
  label($('overview-title'),'{location} · Sales overview',{location:locationName});$('overview-period').textContent=data.period.label+' · '+date(data.period.startDate)+' – '+date(data.period.endDate);
  const body=$('overview-rows'),foot=$('overview-average');body.replaceChildren();foot.replaceChildren();appendRow(body,data.previousAverage,data.period.previous.label,{summary:true,previous:true});appendWeeks(body);appendRow(foot,data.average,data.period.mode==='ytd'?'Year to date average':'Average',{summary:true});
  label($('overview-average-status'),'{count} completed weeks included in the sales average.',{count:data.average.completedWeeks});
 }
 function saveUrl(){const url=new URL(location.href);if(mode==='ytd')url.searchParams.set('period','ytd');else url.searchParams.delete('period');if(quarter)url.searchParams.set('quarter',quarter);history.replaceState(null,'',url);}
 async function load(){const version=++generation;busy=true;panel.setAttribute('aria-busy','true');for(const button of panel.querySelectorAll('button'))button.disabled=true;$('overview-message').textContent=wording('Loading overview…');const params=new URLSearchParams({mode});if(quarter&&mode==='quarter')params.set('quarter',quarter);try{const response=await fetch('/api/weekly-sales-overview?'+params,{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(response.status===401){location.href=companyLoginUrl();return;}const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load the overview.');if(version!==generation)return;data=result;if(mode==='quarter')quarter=result.period.key;$('overview-message').textContent='';saveUrl();}catch(error){if(version===generation){data=null;$('overview-rows').replaceChildren();$('overview-average').replaceChildren();$('overview-average-status').textContent='';$('overview-message').textContent=error.message;}}finally{if(version===generation){busy=false;panel.setAttribute('aria-busy','false');for(const button of panel.querySelectorAll('button'))button.disabled=false;render();}}}
 for(const button of panel.querySelectorAll('[data-overview-mode]'))button.onclick=()=>{if(busy||mode===button.dataset.overviewMode)return;mode=button.dataset.overviewMode;load();};
 function move(offset){const [year,q]=quarter.split('-Q').map(Number),index=year*4+q-1+offset;quarter=Math.floor(index/4)+'-Q'+(index%4+1);load();}
 $('overview-previous').onclick=()=>move(-1);$('overview-next').onclick=()=>move(1);$('overview-current').onclick=()=>{quarter=data?.period.currentQuarter||'';load();};
 const visible=()=>location.hash==='#overview';
 window.addEventListener('hashchange',()=>{if(visible())load();});window.addEventListener('focus',()=>{if(visible()&&!busy)load();});window.addEventListener('storage',event=>{if(visible()&&!busy&&/^souvlaki-(weekly-report|operating-expenses|usage|invoices)-updated-/.test(event.key||''))load();});window.addEventListener('interface-text-updated',render);
 setInterval(()=>{if(visible()&&!busy&&!document.hidden)load();},60000);
 render();(async()=>{try{const response=await fetch('/api/session',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}}),session=await response.json();locationName=session.locationName||'';if(visible())await load();}catch(error){$('overview-message').textContent=error.message;}})();
})();
