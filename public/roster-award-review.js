(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.rosterAwardReview=api;})(globalThis,()=>{
 function issuesFor(check,shifts,{userId,shiftId}={}){
  if(!check?.enabled)return[];
  const subjects=new Map(shifts.map(shift=>[shift.id,shift])),hasWork=shiftId?subjects.has(shiftId):shifts.some(shift=>shift.userId===userId);
  return(check.issues||[]).filter(issue=>{
   if(!issue.subjectId&&!issue.userId)return hasWork;
   if(shiftId)return issue.subjectId===shiftId||!issue.subjectId&&issue.userId===userId;
   if(issue.subjectId)return subjects.has(issue.subjectId)&&subjects.get(issue.subjectId).userId===userId;
   return Boolean(issue.userId&&issue.userId===userId);
  });
 }
 function group(issues){
  const groups=new Map();for(const issue of issues){const key=JSON.stringify([issue.userId||null,issue.code,issue.message,Boolean(issue.blocking),issue.clause||null]);if(!groups.has(key))groups.set(key,{...issue,subjectIds:[]});const entry=groups.get(key);if(issue.subjectId&&!entry.subjectIds.includes(issue.subjectId))entry.subjectIds.push(issue.subjectId);}
  return[...groups.values()].sort((a,b)=>Number(Boolean(b.blocking))-Number(Boolean(a.blocking)));
 }
 let popup=null,owner=null,signature='';
 const node=(doc,tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 function close(restore=false){const trigger=owner;owner=null;signature='';if(trigger)trigger.setAttribute('aria-expanded','false');if(popup?.matches(':popover-open'))popup.hidePopover();if(restore&&trigger?.isConnected)trigger.focus({preventScroll:true});}
 function position(){
  if(!owner||!popup?.matches(':popover-open'))return;if(!owner.isConnected){close();return;}
  const view=owner.ownerDocument.defaultView,r=owner.getBoundingClientRect();if(r.bottom<0||r.top>view.innerHeight){close();return;}
  const box=popup.getBoundingClientRect(),below=view.innerHeight-r.bottom-10,above=r.top-10,top=below>=Math.min(box.height,above)?r.bottom+6:Math.max(8,r.top-box.height-6);
  popup.style.left=Math.max(8,Math.min(r.left,view.innerWidth-box.width-8))+'px';popup.style.top=Math.max(8,Math.min(top,view.innerHeight-box.height-8))+'px';
 }
 function ensure(doc){
  if(popup)return;popup=node(doc,'section',undefined,'roster-award-popover');popup.id='roster-award-popover';popup.setAttribute('popover','auto');popup.setAttribute('role','dialog');popup.setAttribute('aria-modal','false');popup.setAttribute('aria-labelledby','roster-award-popover-title');popup.dataset.layoutUi=popup.dataset.copyEditor='';doc.body.append(popup);
  popup.addEventListener('toggle',event=>{if(event.newState==='closed'){owner?.setAttribute('aria-expanded','false');owner=null;signature='';}});
  popup.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(true);}});
  doc.defaultView.addEventListener('resize',position);doc.defaultView.addEventListener('scroll',position,true);
 }
 function paint(value){
  const groups=group(value.issues),next=JSON.stringify([value.title,value.context,groups,value.allowSetup]);if(next===signature)return;signature=next;const doc=popup.ownerDocument,heading=node(doc,'div',undefined,'roster-award-popover-heading'),title=node(doc,'h3','Award review'),dismiss=node(doc,'button','×','roster-award-popover-close'),person=node(doc,'p',value.title,'roster-award-popover-person'),context=node(doc,'p',value.context,'roster-award-popover-context'),list=node(doc,'ul',undefined,'roster-award-popover-list');title.id='roster-award-popover-title';person.dataset.userText=context.dataset.userText='';dismiss.type='button';dismiss.setAttribute('aria-label','Close award review');dismiss.onclick=()=>close(true);heading.append(title,dismiss);
  for(const issue of groups){const li=node(doc,'li'),label=node(doc,'strong',issue.blocking?'Missing pay details':'Review required'),message=node(doc,'p',issue.message),details=[];message.dataset.userText='';li.classList.toggle('is-blocking',Boolean(issue.blocking));if(issue.clause)details.push('Clause '+issue.clause);if(issue.subjectIds.length>1)details.push(issue.subjectIds.length+' shifts');li.append(label,message);if(details.length){const note=node(doc,'small',details.join(' · '));note.dataset.userText='';li.append(note);}list.append(li);}
  popup.replaceChildren(heading,person,context,list);if(value.allowSetup){const link=node(doc,'a','Review award setup','roster-award-popover-link');link.href='/settings/awards';popup.append(link);}
 }
 function open(trigger){
  const value=trigger.rosterAwardRead?.();if(trigger.disabled||!value?.issues?.length)return;if(owner===trigger&&popup?.matches(':popover-open')){close(true);return;}close();ensure(trigger.ownerDocument);owner=trigger;paint(value);trigger.setAttribute('aria-expanded','true');popup.showPopover();position();popup.querySelector('button').focus({preventScroll:true});
 }
 function attach(host,read,{disabled=false}={}){
  const value=read(),groups=group(value?.issues||[]);let trigger=[...host.children].find(e=>e.classList.contains('roster-award-trigger'));
  if(!groups.length){if(trigger===owner)close();trigger?.remove();return;}
  if(!trigger){trigger=node(host.ownerDocument,'button',undefined,'roster-award-trigger');trigger.type='button';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls','roster-award-popover');trigger.setAttribute('aria-expanded','false');trigger.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/></svg>';trigger.onclick=event=>{event.stopPropagation();open(trigger);};host.append(trigger);}
  trigger.rosterAwardRead=read;trigger.disabled=disabled;trigger.setAttribute('aria-label',(disabled?'Award review updating for ':'Award review for ')+value.title+(disabled?'':': '+groups.length+' issue'+(groups.length===1?'':'s')));trigger.title=disabled?'Save changes to update award review':'View award review';
  if(owner===trigger){if(disabled)close();else{paint(value);position();}}
 }
 function refresh(){if(owner&&!owner.isConnected)close();}
 return{issuesFor,group,attach,close,refresh};
});
