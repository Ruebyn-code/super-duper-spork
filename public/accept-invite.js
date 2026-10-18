(()=>{
 const $=id=>document.getElementById(id),form=$('invite-form'),status=$('invite-message');
 let token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 history.replaceState(null,'',location.pathname);
 async function request(action,body){const response=await fetch('/api/invitations/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),referrerPolicy:'no-referrer'});const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to set up your account.');return result;}
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button[type=submit]');button.disabled=true;status.textContent='Setting your password…';
  try{await request('accept',{token,...Object.fromEntries(new FormData(form))});token='';form.reset();form.hidden=true;$('invite-description').textContent='Your account is ready. Sign in using your email and the password you chose.';status.textContent='Password saved successfully.';$('invite-sign-in').textContent='Sign in to Opstack';$('invite-sign-in').focus();}
  catch(error){status.textContent=error.message;}finally{button.disabled=false;}
 };
 (async()=>{try{const details=await request('inspect',{token});$('invite-email').value=details.email;$('invite-description').textContent='Welcome, '+details.username+'. Choose a password to finish setting up your account.';form.hidden=false;form.elements.password.focus();}catch(error){token='';$('invite-description').textContent='This invitation cannot be used.';status.textContent=error.message;}})();
})();
