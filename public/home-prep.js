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
   text.append(data('strong',row.name),data('span',[row.amount===null||row.amount===undefined?(typeof interfaceLabel==='function'?interfaceLabel('Amount not available'):'Amount not available'):amount(row.toPrep??row.amount)+(row.unit?' '+row.unit:'')+(row.onHand!==null&&row.onHand!==undefined?' '+(typeof interfaceLabel==='function'?interfaceLabel('to prep'):'to prep'):''),row.parts?.length&&!row.done?row.partsDone+'/'+row.partCount:null,row.station].filter(Boolean).join(' · ')));item.append(check,text);
   // More than one to make: one small box per unit, ticked one at a time like on the prep list.
   if(row.parts?.length&&!row.done){const boxes=el('div',undefined,'home-prep-parts');boxes.setAttribute('role','group');boxes.setAttribute('aria-label',word('{name}: {done} of {total} ticked',{name:row.name,done:row.partsDone,total:row.partCount}));
    for(const part of row.parts){const box=el('button',part.size===1?String(part.index+1):amount(part.size),'home-prep-part'+(part.done?' is-done':''));box.type='button';box.setAttribute('aria-pressed',String(part.done));box.setAttribute('aria-label',word('{size}, {number} of {total}',{size:amount(part.size)+(row.unit?' '+row.unit:''),number:part.index+1,total:row.partCount}));box.dataset.homePrepPart=row.id+':'+part.index;box.disabled=pending.has(row.id);box.onclick=()=>togglePart(row,part);boxes.append(box);}
    text.append(boxes);}
   if(row.done&&row.label&&state.canPrint){const print=el('a',word('Labels'),'home-prep-print');print.href='/labels?print='+encodeURIComponent(row.label.id)+'#print';print.title=word('Print labels with {template}',{template:row.label.name});item.append(print);}
   return item;}));
  more.hidden=ordered.length<=6;more.textContent=showAll?word('Show fewer'):word('Show all {count}',{count:ordered.length});
 }
 const post=async(route,body)=>{const response=await fetch('/api/prep-list/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':actor.csrf,'X-Location-Id':actor.locationId},body:JSON.stringify(body)}),result=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(result.error||word('Unable to update the prep list.')),{status:response.status});return result;};
 const apply=(row,result)=>{row.done=result.done;row.tickRevision=result.tickRevision;if(result.parts){row.parts=result.parts.map(({index,size,done})=>({index,size,done}));row.partsDone=row.parts.filter(part=>part.done).length;row.partCount=row.parts.length;}state.done=state.rows.filter(entry=>entry.done).length;};
 async function togglePart(row,part){
  if(pending.has(row.id))return;pending.add(row.id);render();status.textContent='';const key=row.id+':'+part.index;
  try{apply(row,await post('part',{date:state.date,itemId:row.id,index:part.index,done:!part.done,revision:row.tickRevision}));}
  catch(error){status.textContent=error.message;if(error.status===409)refresh();}
  finally{pending.delete(row.id);render();list.querySelector('[data-home-prep-part="'+CSS.escape(key)+'"]')?.focus({preventScroll:true});}
 }
 async function toggle(row){
  if(pending.has(row.id))return;pending.add(row.id);render();status.textContent='';
  try{apply(row,await post('tick',{date:state.date,itemId:row.id,done:!row.done,revision:row.tickRevision}));}
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
