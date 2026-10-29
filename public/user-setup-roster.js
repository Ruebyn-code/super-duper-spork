(()=>{
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=text;window.appWording?.label(e,text);}if(cls)e.className=cls;return e;};
 async function open(host,{account,locations,companyId,onState}){
  let disposed=false,pending=0,saved=false,dirty=false,preview=null;
  const assigned=locations.filter(item=>item.companyId===companyId&&(account.locationIds||[account.locationId]).includes(item.id));
  const discard=node('button','Discard unsaved roster changes');discard.type='button';discard.hidden=true;
  const changed=()=>{discard.hidden=!dirty;if(!disposed)onState({busy:pending>0,dirty,saved});},busy=value=>{pending+=value?1:-1;changed();};
  if(assigned.length&&appAccess.can('awards.manage')){
   busy(true);try{await window.userEmployment.show(account.id,host,{onDirty:()=>{dirty=true;changed();},onBusy:busy,onSaved:()=>{dirty=false;saved=true;changed();}});}finally{busy(false);}
  }else if(assigned.length&&appAccess.can('rostering.view')&&appAccess.can('rostering.costs')){
   preview=window.awardHourlyRates.mount(host,{userId:account.id,companyId});host.append(node('p','Ask a manager with employment access to complete or change this employee’s award details.','small'));
  }else host.append(node('p',assigned.length?'Ask a manager with employment or roster-cost access to finish these details.':'This user’s locations are in another company. Open that company to add their roster details.','small'));
  host.append(discard);discard.onclick=()=>{if(pending)return;onState({busy:false,dirty,saved,discard:true});};
  return{dispose(){disposed=true;preview?.destroy();},get dirty(){return dirty;},get saved(){return saved;}};
 }
 window.userSetupRoster={open};
})();
