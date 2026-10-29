(()=>{
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=text;window.appWording?.label(e,text);}if(cls)e.className=cls;return e;};
 const field=(label,control)=>{const e=node('label',label);e.append(control);return e;};
 const input=(type,value='')=>{const e=node('input');e.type=type;e.value=value;return e;};
 async function open(host,{account,locations,companyId,onState}){
  let disposed=false,pending=0,saved=false,discard;const drafts=new Set(),changed=()=>{if(discard)discard.hidden=drafts.size===0;if(!disposed)onState({busy:pending>0,dirty:drafts.size>0,saved});};
  const assigned=locations.filter(item=>item.companyId===companyId&&(account.locationIds||[account.locationId]).includes(item.id));
  const busy=value=>{pending+=value?1:-1;changed();};
  async function api(url,method='GET',body,locationId){
   const headers={'X-Company-Id':companyId,...(locationId?{'X-Location-Id':locationId}:{})},session=await(await fetch('/api/session',{cache:'no-store',headers})).json();
   const response=await fetch(url,{method,cache:'no-store',headers:{...headers,'Content-Type':'application/json','X-CSRF-Token':session.csrf},...(body===undefined?{}:{body:JSON.stringify(body)})}),data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save roster details.');return data;
  }
  host.append(node('p','The user is created. Add their employment details and roster rates here, or finish these later from Users and Labour settings.','small'));
  if(assigned.length&&appAccess.can('awards.manage')){
   busy(true);try{await window.userEmployment.show(account.id,host,{onDirty:()=>{drafts.add('employment');changed();},onBusy:busy,onSaved:()=>{drafts.delete('employment');saved=true;changed();}});}finally{busy(false);}
  }
  if(assigned.length&&appAccess.can('rostering.view')&&appAccess.can('rostering.costs')){
   const panel=node('fieldset',undefined,'user-setup-rates'),legend=node('legend','Hourly roster rates'),help=node('p','Flat rates apply at the locations below when native award calculations are not enabled. Saving changes only this user’s dated rate.','small');legend.dataset.featureHelp='labour-settings award-settings';panel.append(legend,help);host.prepend(panel);
   for(const location of assigned){
    const card=node('section',undefined,'user-setup-rate'),heading=node('h4'),date=input('date'),rate=input('number'),save=node('button','Save rate'),status=node('p','','small');heading.textContent=location.name;heading.dataset.userText='';rate.min='0';rate.max='100000';rate.step='0.01';rate.placeholder='Not set';date.required=true;rate.required=true;save.type='button';status.setAttribute('role','status');const grid=node('div',undefined,'user-setup-rate-fields');grid.append(field('Effective from',date),field('Hourly rate ($)',rate));card.append(heading,grid,save,status);panel.append(card);save.disabled=true;
    let record=null,frozen=false;const draftKey='rate:'+location.id;
    async function load(){const data=await api('/api/rostering/dashboard','GET',undefined,location.id);if(disposed)return;record=data;if(!date.value)date.value=data.today;if(!drafts.has(draftKey)){const current=data.rates?.records.filter(item=>item.userId===account.id&&item.effectiveDate<=date.value).sort((a,b)=>b.effectiveDate.localeCompare(a.effectiveDate))[0];rate.value=current?(current.rateCents/100).toFixed(2):'';}save.disabled=!data.rates||Boolean(data.summary?.nativePay);if(data.summary?.nativePay){grid.hidden=true;save.hidden=true;status.textContent='Native award calculations are enabled. Use Employment & award below.';}else if(!data.rates)status.textContent='Roster rate access is required for this location.';}
    const mark=()=>{drafts.add(draftKey);changed();};for(const control of [date,rate])control.addEventListener('input',mark);
    save.onclick=async()=>{
     if(pending||disposed||frozen)return;for(const control of [date,rate])if(!control.reportValidity())return;
     const amount=Number(rate.value),cents=Math.round(amount*100);if(!Number.isSafeInteger(cents)||cents<0){status.textContent='Enter a valid hourly rate.';return;}
     const payload={revision:record.rates.revision,effectiveDate:date.value,rates:[{userId:account.id,rateCents:cents}]};busy(true);status.textContent='Saving rate…';
     try{await api('/api/rostering/rates','PUT',payload,location.id);drafts.delete(draftKey);saved=true;await load();status.textContent='Roster rate saved.';}
     catch(error){frozen=true;status.textContent=error.message+' Your draft is kept. Check the latest saved rate before retrying.';const retry=node('button','Check latest rate');retry.type='button';retry.onclick=async()=>{if(pending)return;busy(true);try{await load();const current=record.rates?.records.find(item=>item.userId===account.id&&item.effectiveDate===payload.effectiveDate);if(current?.rateCents===payload.rates[0].rateCents){drafts.delete(draftKey);saved=true;status.textContent='Roster rate is saved.';}else status.textContent='Latest rate checked. Your draft is kept; press Save rate to apply it.';frozen=false;retry.remove();}catch(e){status.textContent=e.message;}finally{date.disabled=frozen;rate.disabled=frozen;save.disabled=frozen||!record?.rates||Boolean(record?.summary?.nativePay);busy(false);}};card.append(retry);}
     finally{date.disabled=frozen;rate.disabled=frozen;save.disabled=frozen||!record?.rates||Boolean(record?.summary?.nativePay);busy(false);}
    };
    busy(true);try{await load();}catch(error){status.textContent=error.message;}finally{busy(false);}
   }
  }
  if(!assigned.length)host.append(node('p','This user’s locations are in another company. Open that company to add their roster details.','small'));
  else if(!appAccess.can('awards.manage')&&!(appAccess.can('rostering.view')&&appAccess.can('rostering.costs')))host.append(node('p','Ask a manager with employment or roster-cost access to finish these details.','small'));
  discard=node('button','Discard unsaved roster changes');discard.type='button';discard.hidden=true;host.append(discard);discard.onclick=()=>{if(pending)return;onState({busy:false,dirty:drafts.size>0,saved,discard:true});};
  return{dispose(){disposed=true;},get dirty(){return drafts.size>0;},get saved(){return saved;}};
 }
 window.userSetupRoster={open};
})();
