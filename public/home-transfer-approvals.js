(()=>{
 const root=document.getElementById('home-transfer-approvals'),feedback=document.getElementById('home-transfer-feedback');if(!root)return;
 const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const template=(node,text,values={})=>{node.dataset.appTemplate=text;node.dataset.appValues=JSON.stringify(values);node.textContent=word(text,values);};
 const ui=(tag,text,cls)=>{const node=el(tag,undefined,cls);template(node,text);return node;};
 const data=(tag,text,cls)=>{const node=el(tag,text,cls);node.dataset.userText='';return node;};
 const number=value=>new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(value),date=value=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Melbourne'}).format(new Date(value));
 let actor=null,identity='',records=[],signature='',loading=false,queued=false,busy=false,generation=0,action=null,returnFocus=null;
 const requests=new Map(),allowed=()=>actor&&['home.view','transfers.view','transfers.receive'].every(key=>appAccess.can(key,actor));
 const context=()=>({userId:actor.id,companyId:actor.companyId,locationId:actor.locationId}),matches=value=>actor&&value.userId===actor.id&&value.companyId===actor.companyId&&value.locationId===actor.locationId;
 const heading=el('div',undefined,'home-transfers-heading'),title=el('div'),caption=ui('h2','Stock transfers to approve'),count=el('p','','small'),all=ui('a','All transfers'),list=el('div',undefined,'home-transfers-list'),status=el('p','','small'),retry=ui('button','Refresh');
 caption.id='home-transfers-title';all.href='/stock-transfers';retry.type='button';status.setAttribute('role','status');title.append(caption,count);heading.append(title,all,retry);root.append(heading,list,status);retry.onclick=()=>refresh();
 const dialog=el('dialog',undefined,'home-transfer-dialog');dialog.id='home-transfer-dialog';dialog.setAttribute('aria-labelledby','home-transfer-title');
 const dialogHeader=el('div',undefined,'home-transfer-dialog-heading'),dialogTitle=ui('h2','Approve stock receipt'),close=ui('button','Close'),body=el('div',undefined,'home-transfer-dialog-body'),actions=el('div',undefined,'home-transfer-dialog-actions'),message=el('p','','small'),confirm=ui('button','Approve receipt'),cancel=ui('button','Cancel');
 dialogTitle.id='home-transfer-title';for(const b of [close,confirm,cancel])b.type='button';close.id='home-transfer-close';confirm.id='home-transfer-confirm';message.id='home-transfer-message';message.setAttribute('role','status');message.setAttribute('aria-live','polite');dialogHeader.append(dialogTitle,close);actions.append(message,confirm,cancel);dialog.append(dialogHeader,body,actions);root.after(dialog);
 function presentation(){if(window.appEmbedded)parent.appShell?.childPresentationChanged(window);}
 function dismiss(){if(busy)return;dialog.close();action=null;presentation();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
 close.onclick=cancel.onclick=dismiss;dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});dialog.addEventListener('close',presentation);
 let backdrop=false;const outside=event=>{const rect=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom);};
 dialog.addEventListener('pointerdown',event=>{backdrop=outside(event);});dialog.addEventListener('click',event=>{if(backdrop&&outside(event))dismiss();backdrop=false;});
 function controls(){for(const button of [close,cancel])button.disabled=busy;confirm.disabled=busy||!action||action.stale||!allowed();retry.disabled=busy||loading;template(confirm,busy?'Approving…':'Approve receipt');}
 function clear(){records=[];signature='';root.hidden=true;list.replaceChildren();body.replaceChildren();message.textContent='';status.textContent='';count.textContent='';feedback.textContent='';feedback.hidden=true;action=null;if(dialog.open)dialog.close();presentation();}
 function setActor(next){const key=JSON.stringify([next?.id,next?.companyId,next?.locationId,next?.permissions]);actor=next;if(key!==identity){identity=key;generation++;clear();}if(!allowed())clear();}
 async function api(path,method='GET',input,scope=context()){
  const response=await fetch('/api/stock-transfers/home-pending'+path,{method,cache:'no-store',headers:{'Content-Type':'application/json','X-Location-Id':scope.locationId,'X-CSRF-Token':actor?.csrf||''},body:input===undefined?undefined:JSON.stringify(input)});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||word('Unable to load stock transfers.')),{status:response.status});return result;
 }
 function review(record,button){
  if(busy||!allowed())return;const key=[actor.id,actor.locationId,record.id,record.revision].join(':');if(!requests.has(key))requests.set(key,crypto.randomUUID());
  action={record,scope:context(),requestId:requests.get(key),stale:false,uncertain:false};returnFocus=button;body.replaceChildren();body.append(data('p',record.from.name+' → '+record.to.name,'home-transfer-route'),data('p',record.from.companyName+(record.from.companyId!==record.to.companyId?' → '+record.to.companyName:''),'small'),data('p',word('Sent {date} by {name}',{date:date(record.createdAt),name:record.senderName}),'small'));
  const items=el('ul',undefined,'home-transfer-items');for(const item of record.items){const row=el('li'),name=data('span',item.target.name+(item.target.unitAmount?' · '+item.target.unitAmount:'')),qty=data('strong',number(item.targetQuantity));row.append(name,qty);if(record.from.companyId!==record.to.companyId)row.append(data('small',word('Sent: {quantity} × {name} {unit}',{quantity:number(item.quantity),name:item.source.name,unit:item.source.unitAmount})));items.append(row);}body.append(items);
  if(record.notes)body.append(data('p',record.notes,'home-transfer-notes'));body.append(el('p',word(record.moveCosts?'Approve only after all items have arrived. This confirms stock receipt and moves the saved stock costs between these locations.':'Approve only after all items have arrived. This confirms receipt and adjusts stock quantities.'),'small'));const link=ui('a','Open transfer history');link.href='/stock-transfers';link.onclick=()=>dismiss();body.append(link);message.textContent='';controls();dialog.showModal();presentation();confirm.focus();
 }
 function render(){
  root.hidden=!records.length;if(!records.length){signature='';list.replaceChildren();return;}template(count,'{count} awaiting approval at {location}',{count:records.length,location:actor.locationName});
  const next=JSON.stringify(records);if(next===signature)return;signature=next;const focused=document.activeElement.closest('[data-home-transfer]')?.dataset.homeTransfer;list.replaceChildren();
  for(const record of records.slice(0,5)){const row=el('div',undefined,'home-transfer-row'),text=el('div'),button=ui('button','Review transfer');row.dataset.homeTransfer=record.id;button.type='button';button.onclick=()=>review(record,button);text.append(data('strong',word('From {location}',{location:record.from.name})),data('span',word('{count} items · {date}',{count:record.items.length,date:date(record.createdAt)}),'small'));row.append(text,button);list.append(row);if(focused===record.id)button.focus({preventScroll:true});}
  if(records.length>5)list.append(el('p',word('Showing the first 5 transfers. Open All transfers to see the rest.'),'small'));
 }
 async function refresh(){
  if(!allowed()||document.hidden)return;if(loading||busy){queued=true;return;}loading=true;controls();const token=generation,scope=context();
  try{const value=await api('', 'GET',undefined,scope);if(token!==generation||!matches(scope)||value.locationId!==scope.locationId||value.companyId!==scope.companyId)return;records=value.transfers;status.textContent='';render();
   if(action&&!busy&&!action.uncertain&&!records.some(record=>record.id===action.record.id&&record.revision===action.record.revision)){action.stale=true;message.textContent=word('This transfer is no longer awaiting approval. Open transfer history to check its current status.');controls();}
  }catch(error){if(token!==generation)return;if([401,403,428].includes(error.status)){clear();if(error.status===428)window.appRequiredReading?.check();}else if(records.length)status.textContent=word('Unable to refresh transfers. Use Refresh to try again.');}
  finally{loading=false;controls();if(queued&&!busy){queued=false;refresh();}}
 }
 confirm.onclick=async()=>{
  if(busy||!action||action.stale||!allowed()||!matches(action.scope))return;const selected=action;busy=true;generation++;controls();message.textContent=word('Approving stock receipt…');let success=false,denied=false;
  try{const result=await api('/'+encodeURIComponent(selected.record.id)+'/receive','POST',{revision:selected.record.revision,requestId:selected.requestId},selected.scope);if(!matches(selected.scope))return;success=true;records=records.filter(record=>record.id!==result.id);feedback.textContent=word('Stock transfer from {location} approved. Receipt has been recorded.',{location:selected.record.from.name});feedback.hidden=false;
   try{for(const location of [result.from.id,result.to.id])localStorage.setItem('souvlaki-usage-updated-location-'+location,String(Date.now()));localStorage.setItem('opstack-transfers-updated',String(Date.now()));}catch{}window.dispatchEvent(new Event('stock-transfer-updated'));window.dispatchEvent(new Event('sales-budget-updated'));
  }catch(error){if(action!==selected||!matches(selected.scope))return;denied=[401,403,428].includes(error.status);selected.stale=error.status===409;selected.uncertain=!error.status||error.status>=500;message.textContent=error.message+(selected.uncertain?' '+word('Retry approval to safely check or finish the same receipt.'):'');if(error.status===428)window.appRequiredReading?.check();}
  finally{busy=false;controls();if(denied)clear();else if(success){dismiss();render();await refresh();}else if(queued){queued=false;refresh();}}
 };
 window.addEventListener('before-location-switch',event=>{if(busy||dialog.open)event.preventDefault();});window.addEventListener('beforeunload',event=>{if(busy){event.preventDefault();event.returnValue='';}});
 window.addEventListener('home-dashboard-access',event=>{if(event.detail.actor){setActor(event.detail.actor);refresh();}});window.addEventListener('focus',()=>refresh());window.addEventListener('pageshow',event=>{if(event.persisted)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('storage',event=>{if(event.key==='opstack-transfers-updated')refresh();});setInterval(refresh,30000);
 (async()=>{try{setActor(await appAccess.initialSession());refresh();}catch{clear();}})();
})();
