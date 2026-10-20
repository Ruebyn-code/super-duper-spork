(()=>{
 if(parent!==window)return;
 let staff,csrf='',expires=0,lastTouch=0,checking=false,touching=false,locking=false,notice;
 const pending=value=>{try{if(value)sessionStorage.setItem('opstack-kiosk-lock-pending','true');else sessionStorage.removeItem('opstack-kiosk-lock-pending');}catch{}};
 const hide=()=>document.documentElement.classList.add('kiosk-lock-pending');
 async function api(path,body){const response=await fetch('/api/kiosk/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)}),value=await response.json();if(!response.ok)throw Error(value.error||'Enter your PIN again.');return value;}
 function expiry(value){expires=Date.now()+Math.max(0,Date.parse(value.expiresAt)-Date.parse(value.now));}
 function leave(){locking=true;hide();location.replace('/kiosk');}
 async function lock(){if(locking)return;locking=true;pending(true);hide();try{if(csrf){await api('lock',{});pending(false);}}catch{}location.replace('/kiosk');}
 async function check(){if(checking||locking)return;checking=true;try{const value=await api('status');csrf=value.csrf||'';let needsLock=false;try{needsLock=Boolean(sessionStorage.getItem('opstack-kiosk-lock-pending'));}catch{}
  if(needsLock){if(value.worker)await api('lock',{});pending(false);leave();return;}
  if(!value.paired||!value.worker||value.worker.sessionId!==staff?.kiosk.sessionId){leave();return;}
  expiry({...value.worker,now:value.now});document.documentElement.classList.remove('kiosk-lock-pending');
 }catch{await lock();}finally{checking=false;}}
 function activity(){if(!staff||locking||touching||Date.now()-lastTouch<10000)return;if(Date.now()>=expires){lock();return;}lastTouch=Date.now();touching=true;api('touch',{}).then(expiry).catch(lock).finally(()=>touching=false);}
 window.appKioskSession={activity,lock,check,get locking(){return locking;}};
 document.addEventListener('click',event=>{if(event.target.closest('#logout')){event.preventDefault();event.stopImmediatePropagation();lock();}},true);
 for(const name of ['pointerdown','keydown'])document.addEventListener(name,event=>{if(event.isTrusted)activity();},true);
 window.addEventListener('pageshow',event=>{if(event.persisted){hide();check();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){hide();check();}});
 window.addEventListener('focus',()=>check());
 (async()=>{try{staff=await appAccess.initialSession();if(!staff?.kiosk){leave();return;}notice=document.createElement('div');notice.className='kiosk-idle-notice';notice.setAttribute('role','status');notice.hidden=true;document.body.append(notice);await check();setInterval(check,5000);setInterval(()=>{if(locking||!expires)return;const left=Math.max(0,Math.ceil((expires-Date.now())/1000));notice.hidden=left>=20;notice.textContent=left<20?'Kiosk locks in '+left+'s — tap or type to continue':'';if(!left)lock();},1000);}catch{lock();}})();
})();
