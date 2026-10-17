(()=>{
 const form=document.getElementById('email-form'),editor=document.getElementById('location-email-editor'),home=document.getElementById('location-email-form-home');if(!form||!editor||!home)return;
 const message=document.getElementById('email-message'),keyStatus=document.getElementById('email-key-status'),keyInput=form.elements.RESEND_API_KEY;
 const savedMask='••••••••••••';
 let csrf='',locationId='',generation=0,saving=false,ready=false,archived=false,locationSaving=false,keySaved=false;
 const wording=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 function disable(value){for(const control of form.elements)control.disabled=value;}
 function feedback(text='',state=''){message.textContent=wording(text);message.dataset.state=state;}
 function keyFeedback(){
  const draft=keyInput.value!==savedMask&&Boolean(keyInput.value.trim());
  keyStatus.dataset.state=draft?'unsaved':keySaved?'saved':'empty';
  keyStatus.textContent=wording(draft?'New API key: not saved yet':keySaved?'API key saved':'No API key configured');
 }
 function showSettings(settings){
  form.elements.ORDER_FROM_EMAIL.value=settings.values.ORDER_FROM_EMAIL;
  form.elements.DELIVERY_EMAIL_ENABLED.checked=settings.enabled.DELIVERY_EMAIL_ENABLED;
  keySaved=settings.secrets.RESEND_API_KEY;
  keyInput.value=keySaved?savedMask:'';
  keyFeedback();
 }
 function reset(){form.reset();keySaved=false;keyStatus.textContent='';keyStatus.dataset.state='';feedback();disable(true);}
 // Select the whole mask so typing or pasting replaces it rather than appending to it.
 const selectMask=()=>{if(keyInput.value===savedMask)keyInput.select();};
 keyInput.addEventListener('focus',selectMask);
 keyInput.addEventListener('click',selectMask);
 keyInput.addEventListener('input',()=>{
  // A mask is only a display value; never let fragments become a replacement credential.
  keyInput.value=keyInput.value.replaceAll('•','');
  keyFeedback();
 });
 form.addEventListener('input',()=>feedback());
 const sessionPromise=(async()=>{const response=await fetch('/api/session',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});const session=await response.json();if(!session.csrf){location.href=companyLoginUrl();throw Error('Please sign in again.');}if(!appAccess.can('email.manage',session))throw Error('Location email permission required.');csrf=session.csrf;})();sessionPromise.catch(()=>{});
 async function request(id,method,body){await sessionPromise;const response=await fetch('/api/locations/'+encodeURIComponent(id)+'/email',{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save email settings.');return data;}
 async function load(id){const version=++generation;ready=false;reset();feedback('Loading email settings…');
  try{const settings=await request(id,'GET');if(version!==generation||id!==locationId)return;showSettings(settings);ready=true;disable(archived||saving||locationSaving);feedback(archived?'Restore this location before changing its email settings.':'');}
  catch(error){if(version===generation)feedback(error.message,'error');}
 }
 window.locationEmailEditor={get busy(){return saving;},setLocationBusy(value){locationSaving=value;disable(value||saving||!ready||archived);},open(record,host){if(saving)return;locationId=record.id;archived=record.archived;host.append(editor);load(locationId);},close(){if(saving)return false;generation++;locationId='';ready=false;reset();home.append(editor);return true;}};
 form.onsubmit=async event=>{event.preventDefault();if(saving||locationSaving||!ready||archived)return;
  const id=locationId,body={ORDER_FROM_EMAIL:form.elements.ORDER_FROM_EMAIL.value,DELIVERY_EMAIL_ENABLED:form.elements.DELIVERY_EMAIL_ENABLED.checked};
  if(keyInput.value!==savedMask&&keyInput.value.trim())body.RESEND_API_KEY=keyInput.value.trim();
  saving=true;disable(true);feedback('Saving email settings…');window.dispatchEvent(new CustomEvent('location-email-saving',{detail:true}));
  try{const summary=await request(id,'PUT',body);window.updateLocationEmailSummary?.(id,summary);if(locationId===id){showSettings(summary);feedback(keySaved?'Email settings saved successfully. Your API key is saved; it has not been verified with Resend.':'Email settings saved successfully. No API key is configured.','success');}}
  catch(error){if(locationId===id)feedback(error.message,'error');}
  finally{saving=false;disable(locationSaving||!ready||archived);window.dispatchEvent(new CustomEvent('location-email-saving',{detail:false}));}
 };
 disable(true);
})();
