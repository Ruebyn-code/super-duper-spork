document.querySelectorAll('input[type="password"]').forEach((input,index)=>{
 if(!input.id)input.id='password-field-'+index;
 input.classList.add('password-input');
 const label=input.closest('label');if(label)label.htmlFor=input.id;
 const wrapper=document.createElement('span');wrapper.className='password-control';input.before(wrapper);wrapper.append(input);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='password-toggle';toggle.setAttribute('aria-controls',input.id);
 function hide(){input.type='password';toggle.textContent='Show';toggle.setAttribute('aria-label','Show password');toggle.setAttribute('aria-pressed','false');}
 hide();toggle.onclick=()=>{if(input.type==='password'){input.type='text';toggle.textContent='Hide';toggle.setAttribute('aria-label','Hide password');toggle.setAttribute('aria-pressed','true');}else hide();};wrapper.append(toggle);
 input.form?.addEventListener('reset',hide);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();});
 if(input.hasAttribute('data-user-password')&&window.userPasswordPolicy){
  const hasHelp=Boolean(input.getAttribute('aria-describedby'));
  const feedback=document.createElement('span');feedback.className='small';feedback.id=input.id+'-requirements';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');wrapper.after(feedback);
  input.setAttribute('aria-describedby',[input.getAttribute('aria-describedby'),feedback.id].filter(Boolean).join(' '));
  function check(){const issue=input.value?window.userPasswordPolicy.issue(input.value):'';input.setCustomValidity(issue);feedback.textContent=input.value?(issue||'Password meets the requirements.'):(hasHelp?'':window.userPasswordPolicy.help);}
  input.addEventListener('input',check);input.form?.addEventListener('reset',()=>queueMicrotask(check));check();
 }
});
