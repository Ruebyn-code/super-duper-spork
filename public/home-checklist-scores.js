// Head Office Home: the checklist score leaderboard (last four weeks) from Checklists → Trends.
// Read-only through GET /api/checklist-extras/trends; hidden when Score trends is off or checklists aren't viewable.
(()=>{
 const root=document.getElementById('home-checklist-scores');if(!root)return;
 const word=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const data=(tag,text,cls)=>{const node=el(tag,text,cls);node.dataset.userText='';return node;};
 let actor=null,identity='',generation=0;
 const heading=el('div',undefined,'home-prep-heading'),title=el('h2',word('Checklist scores')),link=el('a',word('Score trends'));title.id='home-checklist-scores-title';link.href='/ops-management#trends';heading.append(title,link);
 const summary=el('p',word('Average score over the last four weeks'),'home-prep-summary'),list=el('div',undefined,'home-prep-list');root.append(heading,summary,list);
 const medals={1:'gold',2:'silver',3:'bronze'};
 function clear(){list.replaceChildren();root.hidden=true;}
 const allowed=()=>actor&&window.homeBoardModel?.headOffice?.(actor)&&window.appAccess?.can?.('ops.view',actor);
 async function refresh(){
  if(!allowed()){clear();return;}const version=++generation,scope=actor.locationId;
  try{const response=await fetch('/api/checklist-extras/trends?weeks=4',{cache:'no-store',headers:scope?{'X-Location-Id':scope}:{}});if(!response.ok)throw Error();const value=await response.json();if(version!==generation||scope!==actor?.locationId)return;
   const rows=value.stores.filter(store=>store.recentScore!==null).slice(0,6);if(!rows.length){clear();return;}
   list.replaceChildren(...rows.map(store=>{const item=el('div',undefined,'home-prep-item home-cx-score'+(medals[store.rank]?' is-'+medals[store.rank]:'')),rank=data('span',String(store.rank),'home-cx-rank'+(medals[store.rank]?' is-'+medals[store.rank]:''));if(medals[store.rank])rank.setAttribute('aria-label',medals[store.rank]+' · place '+store.rank);const text=el('div',undefined,'home-prep-text');text.append(data('strong',store.name),data('span',store.recentRuns+(store.recentRuns===1?' checklist':' checklists')));item.append(rank,text,data('strong',store.recentScore+'%','home-cx-value'));return item;}));
   root.hidden=false;}
  catch{if(version===generation)clear();}
 }
 function setActor(next){const key=JSON.stringify([next?.id,next?.companyId,next?.locationId]);actor=next;if(key!==identity){identity=key;generation++;clear();}}
 window.addEventListener('home-dashboard-access',event=>{if(event.detail.actor){setActor(event.detail.actor);refresh();}});
 window.addEventListener('focus',()=>refresh());
 (async()=>{try{setActor(await appAccess.initialSession());refresh();}catch{clear();}})();
})();
