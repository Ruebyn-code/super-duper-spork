// Home: today's prep progress at the selected location, with explicit ticks (prep.view) and links to print
// food labels for linked templates. Reading never writes; only a tick calls the prep list API.
(()=>{
 const root=document.getElementById('home-prep');if(!root)return;
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const data=(tag,text,cls)=>{const node=el(tag,text,cls);node.dataset.userText='';return node;};
 const amount=value=>Number(value).toLocaleString('en-AU',{maximumFractionDigits:3});
 let actor=null,identity='',state=null,generation=0,pending=new Set(),showAll=false;
 const heading=el('div',undefined,'home-prep-heading'),title=el('h2',word('Today’s prep')),link=el('a',word('Open prep list'));title.id='home-prep-title';link.href='/labels#prep';heading.append(title,link);
 const bar=el('div',undefined,'home-prep-bar'),fill=el('span'),summary=el('p','','home-prep-summary'),list=el('div',undefined,'home-prep-list'),more=el('button','','home-prep-more'),status=el('p','','home-prep-status');
 bar.setAttribute('aria-hidden','true');bar.append(fill);more.type='button';status.setAttribute('role','status');root.append(heading,summary,bar,list,more,status);
 more.onclick=()=>{showAll=!showAll;render();};
 const allowed=()=>actor&&window.appAccess?.can?.('home.view',actor)&&window.appAccess?.can?.('prep.view',actor);
 function clear(){state=null;list.replaceChildren();root.hidden=true;}
 function render(){
  if(!state||!state.total){clear();return;}root.hidden=false;
  const percent=Math.round(state.done/state.total*100);fill.style.width=percent+'%';summary.textContent=state.done===state.total?word('All {total} items done',{total:state.total}):word('{done} of {total} done',{done:state.done,total:state.total});
  const ordered=[...state.rows.filter(row=>!row.done),...state.rows.filter(row=>row.done)],shown=showAll?ordered:ordered.slice(0,6);
  list.replaceChildren(...shown.map(row=>{const item=el('div',undefined,'home-prep-item'+(row.done?' is-done':'')),check=el('button',undefined,'home-prep-check'),text=el('div',undefined,'home-prep-text');
   check.type='button';check.setAttribute('aria-pressed',String(row.done));check.setAttribute('aria-label',(row.done?word('Mark not done: '):word('Mark done: '))+row.name);check.disabled=pending.has(row.id);check.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';check.onclick=()=>toggle(row);
   text.append(data('strong',row.name),data('span',[amount(row.amount)+(row.unit?' '+row.unit:''),row.station].filter(Boolean).join(' · ')));item.append(check,text);
   if(row.done&&row.label&&state.canPrint){const print=el('a',word('Labels'),'home-prep-print');print.href='/labels?print='+encodeURIComponent(row.label.id)+'#print';print.title=word('Print labels with {template}',{template:row.label.name});item.append(print);}
   return item;}));
  more.hidden=ordered.length<=6;more.textContent=showAll?word('Show fewer'):word('Show all {count}',{count:ordered.length});
 }
 async function toggle(row){
  if(pending.has(row.id))return;pending.add(row.id);render();status.textContent='';
  try{const response=await fetch('/api/prep-list/tick',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':actor.csrf,'X-Location-Id':actor.locationId},body:JSON.stringify({date:state.date,itemId:row.id,done:!row.done,revision:row.tickRevision})}),result=await response.json().catch(()=>({}));
   if(!response.ok)throw Object.assign(Error(result.error||word('Unable to update the prep list.')),{status:response.status});
   row.done=result.done;row.tickRevision=result.tickRevision;state.done=state.rows.filter(entry=>entry.done).length;}
  catch(error){status.textContent=error.message;if(error.status===409)refresh();}
  finally{pending.delete(row.id);render();}
 }
 async function refresh(){
  if(!allowed()){clear();return;}const version=++generation,scope=actor.locationId;
  try{const response=await fetch('/api/home-prep',{cache:'no-store',headers:scope?{'X-Location-Id':scope}:{}});if(!response.ok)throw Error();const value=await response.json();if(version!==generation||scope!==actor?.locationId||pending.size)return;state=value;status.textContent='';render();}
  catch{if(version===generation)clear();}
 }
 function setActor(next){const key=JSON.stringify([next?.id,next?.companyId,next?.locationId]);actor=next;if(key!==identity){identity=key;generation++;showAll=false;clear();}}
 window.addEventListener('home-dashboard-access',event=>{if(event.detail.actor){setActor(event.detail.actor);refresh();}});
 window.addEventListener('focus',()=>refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 (async()=>{try{setActor(await appAccess.initialSession());refresh();}catch{clear();}})();
})();
