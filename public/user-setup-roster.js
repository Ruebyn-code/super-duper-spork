(()=>{
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=text;window.appWording?.label(e,text);}if(cls)e.className=cls;return e;};
 async function open(host,{account,locations,companyId,onState}){
  let disposed=false,pending=0,saved=false,ready=false,dirty=false,payDirty=false,documentDirty=false,agreements=null,preview=null;
  const assigned=locations.filter(item=>item.companyId===companyId&&(account.locationIds||[account.locationId]).includes(item.id));
  const discard=node('button','Discard unsaved roster changes');discard.type='button';discard.hidden=true;
  const changed=()=>{dirty=payDirty||documentDirty;discard.textContent=documentDirty?'Discard unsaved pay and document changes':'Discard unsaved roster changes';discard.hidden=!dirty;if(!disposed)onState({busy:pending>0,dirty,saved,ready});},busy=value=>{pending+=value?1:-1;changed();};
  if(assigned.length&&appAccess.can('awards.manage')){
   const payHost=node('div');host.append(payHost);busy(true);try{await window.userEmployment.show(account.id,payHost,{locationId:assigned.find(l=>l.id===window.appLocationId)?.id||assigned[0].id,onDirty:()=>{payDirty=true;ready=false;changed();},onClean:()=>{payDirty=false;changed();},onRosterState:value=>{ready=value.ready&&!value.preview&&value.current;changed();},onBusy:busy,onSaved:()=>{payDirty=false;saved=true;agreements?.refresh();changed();}});}finally{busy(false);}
  }else if(assigned.length&&appAccess.can('rostering.view')&&appAccess.can('rostering.costs')){
   preview=window.awardHourlyRates.mount(host,{userId:account.id,companyId,locationId:assigned.find(l=>l.id===window.appLocationId)?.id||assigned[0].id,onState:value=>{ready=value.ready&&!value.preview&&value.current;changed();}});host.append(node('p','Ask a manager with employment access to complete or change this employee’s award details.','small'));
  }else host.append(node('p',assigned.length?'Ask a manager with employment or roster-cost access to finish these details.':'This user’s locations are in another company. Open that company to add their roster details.','small'));
  if(assigned.length&&appAccess.can('users.manage')&&appAccess.can('awards.manage')&&window.employmentPayDocuments){agreements=window.employmentPayDocuments.mount(host,{userId:account.id,locationId:assigned.find(l=>l.id===window.appLocationId)?.id||assigned[0].id,blocked:()=>payDirty||pending>0,onDirty:value=>{documentDirty=value;changed();},onBusy:busy});await agreements.ready;}
  host.append(discard);discard.onclick=()=>{if(pending)return;onState({busy:false,dirty,saved,discard:true});};
  return{dispose(){disposed=true;agreements?.destroy();preview?.destroy();},get dirty(){return dirty;},get saved(){return saved;}};
 }
 window.userSetupRoster={open};
})();
