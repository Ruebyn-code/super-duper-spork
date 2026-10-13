(()=>{
 const form=document.getElementById('email-form');if(!form)return;
 const select=document.getElementById('email-account'),message=document.getElementById('email-message'),keyStatus=document.getElementById('email-key-status');
 let csrf='',sessionId='',accountId='',generation=0,saving=false,ready=false;
 const button=form.querySelector('button[type=submit]');
 function disableForm(disabled){for(const control of form.elements)control.disabled=disabled;}
 async function api(id,method,body){
  const response=await fetch('/api/accounts/'+encodeURIComponent(id)+'/email',{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});
  if(response.status===401){location.href='/login';throw Error('Please sign in again.');}
  const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save email settings.');return data;
 }
 async function load(id){
  const version=++generation;form.reset();disableForm(true);keyStatus.textContent='';message.textContent='Loading email settings…';ready=false;
  try{
   const settings=await api(id,'GET');if(version!==generation||id!==accountId)return;
   form.elements.ORDER_FROM_EMAIL.value=settings.values.ORDER_FROM_EMAIL;
   form.elements.RESEND_API_KEY.value='';form.elements.DELIVERY_EMAIL_ENABLED.checked=settings.enabled.DELIVERY_EMAIL_ENABLED;
   keyStatus.textContent=settings.secrets.RESEND_API_KEY?'Key saved. Leave blank to keep it.':'No key configured.';
   ready=true;message.textContent='';disableForm(false);
  }catch(error){if(version===generation)message.textContent=error.message;}
 }
 window.refreshAccountEmailAccounts=async accounts=>{
  if(!csrf)return;
  const requested=new URLSearchParams(location.search).get('account');
  const previous=accountId;accountId=[accountId,requested,sessionId,accounts[0]?.id].find(id=>id&&accounts.some(account=>account.id===id))||'';
  select.replaceChildren();for(const account of accounts){const option=document.createElement('option');option.value=account.id;option.textContent=account.username;select.append(option);}select.value=accountId;
  if(accountId&&accountId!==previous)await load(accountId);
  if(!accountId){generation++;form.reset();disableForm(true);ready=false;keyStatus.textContent='';message.textContent='Create an account to configure email sending.';}
 };
 select.onchange=async()=>{if(saving)return;accountId=select.value;await load(accountId);};
 form.onsubmit=async event=>{
  event.preventDefault();if(saving||!ready)return;
  const id=accountId,body=Object.fromEntries(new FormData(form));body.DELIVERY_EMAIL_ENABLED=form.elements.DELIVERY_EMAIL_ENABLED.checked;
  saving=true;disableForm(true);select.disabled=true;message.textContent='Saving email settings…';
  try{
   await api(id,'PUT',body);if(accountId===id)await load(id);
   if(accountId===id&&ready)message.textContent='Account email settings are saved. Credentials have not been verified with the sending service.';
  }catch(error){message.textContent=error.message;if(accountId===id&&ready)disableForm(false);}
  finally{saving=false;select.disabled=false;button.disabled=!ready;}
 };
 disableForm(true);
 (async()=>{
  try{
   const response=await fetch('/api/session');const session=await response.json();if(!session.csrf){location.href='/login';return;}if(session.role!=='admin'){location.href='/';return;}
   csrf=session.csrf;sessionId=session.id;
   const result=await fetch('/api/accounts',{headers:{'X-CSRF-Token':csrf}});if(!result.ok)throw Error('Cannot load accounts.');
   await window.refreshAccountEmailAccounts(await result.json());
  }catch(error){message.textContent=error.message;}
 })();
})();
