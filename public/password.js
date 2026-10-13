document.querySelectorAll('input[type="password"]').forEach((input,index)=>{
 if(!input.id)input.id='password-field-'+index;
 input.classList.add('password-input');
 const label=input.closest('label');if(label)label.htmlFor=input.id;
 const wrapper=document.createElement('span');wrapper.className='password-control';input.before(wrapper);wrapper.append(input);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='password-toggle';toggle.setAttribute('aria-controls',input.id);
 function hide(){input.type='password';toggle.textContent='Show';toggle.setAttribute('aria-label','Show password');toggle.setAttribute('aria-pressed','false');}
 hide();toggle.onclick=()=>{if(input.type==='password'){input.type='text';toggle.textContent='Hide';toggle.setAttribute('aria-label','Hide password');toggle.setAttribute('aria-pressed','true');}else hide();};wrapper.append(toggle);
 input.form?.addEventListener('reset',hide);
});
