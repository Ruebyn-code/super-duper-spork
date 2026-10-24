(()=>{
 const $=id=>document.getElementById(id),form=$('order-email-template-form');if(!form)return;
 const model=window.orderEmailTemplate,subject=$('email-template-subject'),body=$('email-template-body'),message=$('email-template-message'),tokens=$('email-template-tokens');
 let session,ready=false,busy=false,revision=0,saved={...model.defaults},insertTarget=body;
 const wording=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 const value=()=>({subject:subject.value,body:body.value});
 const dirty=()=>ready&&JSON.stringify(value())!==JSON.stringify(saved);
 function feedback(text='',state=''){message.textContent=wording(text);message.dataset.state=state;}
 function disable(){for(const control of form.elements)control.disabled=busy||!ready;for(const button of tokens.children)button.disabled=busy||!ready||(insertTarget===subject&&!button.field.subject);}
 function preview(){
  const changed=dirty(),isDefault=JSON.stringify(value())===JSON.stringify(model.defaults);
  $('email-template-status').dataset.state=changed?'unsaved':'saved';$('email-template-status').textContent=wording(changed?'Unsaved template changes':isDefault?'Default template':'Template saved');$('email-template-discard').hidden=!changed;
  try{const rendered=model.render(value(),{orderId:'ORD-EXAMPLE',supplier:'Sample supplier',companyName:session?.companyName||'Your company',requester:session?.username||'Team member',locationName:session?.locationName||'Your location',notes:'Please deliver on our next delivery day.',items:[{name:'Example stock item',quantity:4,unitAmount:'5 kg',sku:'STK-001'},{name:'Another stock item',quantity:2,unitAmount:'Box of 12'}]});$('email-preview-subject').textContent=rendered.subject;$('email-preview-body').textContent=rendered.text;$('email-template-error').textContent='';}
  catch(error){$('email-template-error').textContent=wording(error.message);$('email-preview-subject').textContent=wording('Complete your template to preview it');$('email-preview-body').textContent='';}
 }
 function show(record){revision=record.revision;saved={...record.template};subject.value=saved.subject;body.value=saved.body;ready=true;$('email-template-reload').hidden=true;preview();disable();}
 async function api(method='GET',data){const response=await fetch('/api/order-email-template',{method,headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf,...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})},body:data===undefined?undefined:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Unable to save the email template.'),{status:response.status});return result;}
 async function load(){busy=true;disable();feedback('Loading company email template…');try{show(await api());feedback();}catch(error){feedback(error.message,'error');$('email-template-reload').hidden=false;}finally{busy=false;disable();$('email-template-reload').disabled=false;}}
 for(const field of model.fields){const button=document.createElement('button');button.type='button';button.textContent=wording(field.label);button.field=field;button.title='{{'+field.key+'}}';button.onclick=()=>{if(button.disabled)return;insertTarget.setRangeText('{{'+field.key+'}}',insertTarget.selectionStart,insertTarget.selectionEnd,'end');insertTarget.focus({preventScroll:true});insertTarget.dispatchEvent(new Event('input',{bubbles:true}));};tokens.append(button);}
 for(const input of [subject,body])input.addEventListener('focus',()=>{insertTarget=input;$('email-template-insert-label').textContent=wording(input===subject?'Insert into subject':'Insert into message');disable();});
 form.addEventListener('input',()=>{feedback();preview();});
 $('email-template-reset').onclick=()=>{subject.value=model.defaults.subject;body.value=model.defaults.body;preview();feedback();};
 $('email-template-discard').onclick=()=>{subject.value=saved.subject;body.value=saved.body;preview();feedback();};
 $('email-template-reload').onclick=load;
 form.onsubmit=async event=>{event.preventDefault();if(busy||!ready)return;let template;try{template=model.validate(value());}catch(error){preview();feedback(error.message,'error');return;}
  busy=true;disable();feedback('Saving company template…');
  try{show(await api('PUT',{template,revision}));feedback('Company email template saved successfully. All locations in '+session.companyName+' will use it for future orders.','success');}
  catch(error){feedback(error.message,'error');if(error.status===409)$('email-template-reload').hidden=false;}
  finally{busy=false;disable();}
 };
 window.addEventListener('before-location-switch',event=>{if(busy||dirty()){event.preventDefault();feedback(busy?'Wait for the email template to finish saving.':'Save or discard your template changes before switching locations or companies.','error');}});
 window.addEventListener('beforeunload',event=>{if(busy||dirty()){event.preventDefault();event.returnValue='';}});
 disable();
 (async()=>{try{const response=await fetch('/api/session',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});session=await response.json();if(!session.csrf||!appAccess.can('email.manage',session))return;$('email-template-company').textContent='One template for all locations in '+session.companyName+'.';$('email-preview-from').textContent='Location’s configured sender email';await load();}catch(error){feedback(error.message,'error');}})();
})();
