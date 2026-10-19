(()=>{
 const form=document.getElementById('login-form'),options=document.getElementById('login-network-options');
 if(form.elements.network?.value&&options)options.open=true;
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('button[type="submit"]'),message=document.getElementById('login-message');button.disabled=true;message.textContent='Signing in…';
  try{
   const input=Object.fromEntries(new FormData(form));input.network=(input.network||'').trim();input.autoNetwork=!input.network;
   const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}),result=await response.json();
   if(!response.ok){if(response.status===409&&options){options.open=true;form.elements.network.focus();}throw Error(result.error||'Unable to sign in. Try again.');}
   location.href='/home';
  }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
 };
})();
