(()=>{
 const form=document.getElementById('email-form'),editor=document.getElementById('location-email-editor'),home=document.getElementById('location-email-form-home');if(!form||!editor||!home)return;
 const message=document.getElementById('email-message'),keyStatus=document.getElementById('email-key-status');
 let csrf='',locationId='',generation=0,saving=false,ready=false,archived=false,locationSaving=false;
 const wording=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 function disable(value){for(const control of form.elements)control.disabled=value;}
 const sessionPromise=(async()=>{const response=await fetch('/api/session');const session=await response.json();if(!session.csrf){location.href=companyLoginUrl();throw Error('Please sign in again.');}if(session.role!=='admin')throw Error('Head Office permission required.');csrf=session.csrf;})();sessionPromise.catch(()=>{});
 async function request(id,method,body){await sessionPromise;const response=await fetch('/api/locations/'+encodeURIComponent(id)+'/email',{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save email settings.');return data;}
 async function load(id){const version=++generation;ready=false;form.reset();disable(true);keyStatus.textContent='';message.textContent=wording('Loading email settings…');
  try{const settings=await request(id,'GET');if(version!==generation||id!==locationId)return;form.elements.ORDER_FROM_EMAIL.value=settings.values.ORDER_FROM_EMAIL;form.elements.RESEND_API_KEY.value='';form.elements.DELIVERY_EMAIL_ENABLED.checked=settings.enabled.DELIVERY_EMAIL_ENABLED;keyStatus.textContent=wording(settings.secrets.RESEND_API_KEY?'Key saved. Leave blank to keep it.':'No key configured.');ready=true;disable(archived||saving||locationSaving);message.textContent=archived?wording('Restore this location before changing its email settings.'):'';}
  catch(error){if(version===generation)message.textContent=error.message;}
 }
 window.locationEmailEditor={get busy(){return saving;},setLocationBusy(value){locationSaving=value;disable(value||saving||!ready||archived);},open(record,host){if(saving)return;locationId=record.id;archived=record.archived;host.append(editor);load(locationId);},close(){if(saving)return false;generation++;locationId='';ready=false;form.reset();disable(true);keyStatus.textContent='';message.textContent='';home.append(editor);return true;}};
 form.onsubmit=async event=>{event.preventDefault();if(saving||locationSaving||!ready||archived)return;const id=locationId,body=Object.fromEntries(new FormData(form));body.DELIVERY_EMAIL_ENABLED=form.elements.DELIVERY_EMAIL_ENABLED.checked;saving=true;disable(true);message.textContent=wording('Saving email settings…');window.dispatchEvent(new CustomEvent('location-email-saving',{detail:true}));
  try{const summary=await request(id,'PUT',body);window.updateLocationEmailSummary?.(id,summary);if(locationId===id)await load(id);if(locationId===id&&ready)message.textContent=wording('Location email settings are saved. Credentials have not been verified with the sending service.');}
  catch(error){message.textContent=error.message;if(locationId===id&&ready)disable(false);}
  finally{saving=false;window.dispatchEvent(new CustomEvent('location-email-saving',{detail:false}));}
 };
 disable(true);
})();
