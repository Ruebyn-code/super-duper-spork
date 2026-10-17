// Apply before the stylesheets paint; this preference belongs to the current user on this browser.
(()=>{
 const root=document.documentElement,buttons=new Set(),memory=new Map(),media=window.matchMedia('(prefers-color-scheme: dark)');
 let account=window.appThemeAccount||'guest',explicit=null;
 const key=()=> 'opstack-theme:'+account;
 const valid=value=>value==='light'||value==='dark';
 function read(){try{const value=localStorage.getItem(key());return valid(value)?value:null;}catch{return memory.get(key())||null;}}
 function apply(){
  const mode=explicit||(media.matches?'dark':'light');root.dataset.theme=mode;root.style.colorScheme=mode;
  for(const button of buttons){const dark=mode==='dark';button.setAttribute(button.getAttribute('role')==='menuitemcheckbox'?'aria-checked':'aria-pressed',String(dark));button.title='Dark mode: '+(dark?'on':'off');const state=button.querySelector('.theme-state');if(state)state.textContent=dark?'On':'Off';const icon=button.querySelector('.theme-icon');if(icon)icon.innerHTML=dark?'<circle cx="12" cy="12" r="4"/><g class="icon-detail"><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></g>':'<path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5 8.5 8.5 0 1 0 20.5 13.2Z"/>';
  }
  window.dispatchEvent(new CustomEvent('app-theme-changed',{detail:{mode}}));
 }
 function set(mode){if(!valid(mode))return;explicit=mode;memory.set(key(),mode);try{localStorage.setItem(key(),mode);}catch{}apply();}
 function toggle(){set(root.dataset.theme==='dark'?'light':'dark');}
 function bind(button){buttons.add(button);button.addEventListener('click',toggle);apply();}
 function setAccount(id){const next=id||'guest';if(next===account)return;account=next;explicit=read();apply();}
 window.appTheme={set,toggle,bind,setAccount,get mode(){return root.dataset.theme;}};
 explicit=read();apply();
 media.addEventListener('change',()=>{if(!explicit)apply();});window.addEventListener('storage',event=>{if(event.key===key()||event.key===null){explicit=read();apply();}});
 document.addEventListener('DOMContentLoaded',()=>{
  if(!document.body.classList.contains('authentication-page'))return;
  const button=document.createElement('button');button.type='button';button.id='auth-theme-toggle';button.className='auth-theme-toggle';button.dataset.copyEditor='';button.setAttribute('aria-label','Dark mode');button.innerHTML='<svg class="theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"></svg>';bind(button);document.querySelector('.login-page .management')?.append(button);
 });
})();
