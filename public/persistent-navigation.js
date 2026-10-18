(()=>{
 if(parent!==window&&parent.appShell){parent.appShell.navigate(location.href,{history:'replace'});return;}
 const page=document.querySelector('.app-shell>.app-page');
 if(!page||window.appShell)return;
 const routes=new Set(['/home','/','/cart','/stock-count','/stock-transfers','/sales','/reporting','/admin','/admin/accounts','/admin/settings','/settings','/settings/awards','/admin/appearance/signin','/admin/appearance/setup','/email-settings','/rostering','/communications','/knowledge-library']);
 const root=document.documentElement,area=document.createElement('div'),placeholder=document.createElement('div');
 area.className='shell-page-area';area.dataset.layoutUi='';placeholder.className='shell-page-placeholder';placeholder.inert=true;
 for(const child of [...page.childNodes])if(!child.classList?.contains('mobile-brand-header'))placeholder.append(child);
 area.append(placeholder);page.append(area);root.classList.add('persistent-shell');
 const loading=document.createElement('div');loading.className='shell-loading-bar';loading.hidden=true;loading.setAttribute('aria-hidden','true');
 const error=document.createElement('div');error.className='shell-navigation-error';error.hidden=true;error.dataset.layoutUi='';
 const message=document.createElement('span');message.setAttribute('role','status');
 const retry=document.createElement('button');retry.type='button';retry.textContent='Retry';error.append(message,retry);document.body.append(loading,error);
 let current=null,pending=null,generation=0,committed=new URL(location.href),lastRequest=committed.href,lastMode='replace',editing=false,refreshingAppearance=false;
 const syncingEdits=new WeakMap();
 const canonical=value=>{const url=new URL(value,location.href);url.searchParams.delete('__opstack_content');return url;};
 const samePage=(a,b)=>a.pathname===b.pathname&&a.search===b.search;
 function accepts(url){return url.origin===location.origin&&routes.has(url.pathname);}
 function fail(text){area.setAttribute('aria-busy','false');loading.hidden=true;message.textContent=text;error.hidden=false;}
 function guard(){
  if(!current)return true;
  const child=current.contentWindow,event=new child.Event('before-location-switch',{cancelable:true});
  if(!child.dispatchEvent(event))return false;
  const unload=new child.Event('beforeunload',{cancelable:true});child.dispatchEvent(unload);
  return !unload.defaultPrevented||confirm('Changes are still being saved. Leave this page?');
 }
 function setAddress(url,mode,session){
  if(mode==='push'&&url.href!==committed.href)history.pushState({opstackPage:true},'',url.href);
  else if(mode==='replace'||url.href!==location.href)history.replaceState({opstackPage:true},'',url.href);
  committed=new URL(url);document.title=current?.contentDocument?.title||document.title;
  window.appNavigation?.refresh(session);
 }
 async function syncEdit(frame=current){
  if(!frame||!frame.contentWindow?.appEmbedded)return;
  const child=frame.contentWindow,enabled=child.document.body.classList.contains('app-edit-mode');
  if(enabled===editing)return;
  syncingEdits.set(child,(syncingEdits.get(child)||0)+1);
  try{await child.appEditor?.setEnabled(editing);if(frame===current&&child.appEditor?.enabled!==editing)await child.appEditor?.setEnabled(editing);}
  finally{syncingEdits.set(child,syncingEdits.get(child)-1);}
 }
 function presentation(child){
  if(child!==current?.contentWindow)return;
  root.classList.toggle('shell-conversation-fullscreen',child.document.body.classList.contains('comms-conversation-open'));
  // The phone roster is a page reader. Its sheet covers only the content
  // document, so users must still be able to leave through the shared bar.
  const modal=Boolean(child.document.querySelector('dialog[open]:not(#phone-roster)'));
  for(const control of document.querySelectorAll('#app-sidebar,.mobile-brand-header,#app-edit-indicator,#shift-clock-dock'))control.inert=modal;
 }
 async function loaded(frame,version,mode){
  if(frame===current&&pending)return;
  if(frame!==current&&(version!==generation||frame!==pending))return;
  clearTimeout(frame.navigationTimer);
  try{
   const child=frame.contentWindow,url=canonical(child.location.href);
   if(['/login','/setup'].includes(url.pathname)){location.replace(url.href);return;}
   if(!accepts(url)||!child.appEmbedded||!child.appAccess)throw Error('Unable to open this page.');
   const session=await child.appAccess.initialSession();
   if(frame!==current&&(version!==generation||frame!==pending))return;
   if(!session.csrf){location.replace('/login');return;}
   if(session.companyId!==window.appCompanyId||session.locationId!==window.appLocationId){location.replace(url.href);return;}
   const previous=current;current=frame;pending=null;
   frame.removeAttribute('data-pending');frame.title=child.document.title||'App page';placeholder.remove();
   if(previous&&previous!==frame)previous.remove();
   window.appAccess?.apply(session);
   if(editing&&!appAccess.can('appearance.manage',session))document.getElementById('app-edit-toggle')?.click();
   area.setAttribute('aria-busy','false');loading.hidden=true;error.hidden=true;
   setAddress(url,mode,session);presentation(child);await syncEdit(frame);
   window.appRequiredReading?.check();window.appMessageBadge?.refresh();
  }catch(problem){
   if(frame!==current){frame.remove();if(pending===frame)pending=null;}
   fail('This page could not load. Your current page is still open.');
  }
 }
 function navigate(destination,{history:mode='push',force=false,check=true}={}){
  const url=canonical(destination);if(!accepts(url))return false;
  if(check&&!guard())return false;
  error.hidden=true;lastRequest=url.href;lastMode=mode;
  if(current&&!force&&samePage(canonical(current.contentWindow.location.href),url)){
   const childUrl=new URL(current.contentWindow.location.href);if(childUrl.hash!==url.hash){childUrl.hash=url.hash;current.contentWindow.location.replace(childUrl.href);}setAddress(url,mode);return true;
  }
  generation++;if(pending){clearTimeout(pending.navigationTimer);pending.remove();}
  const frame=document.createElement('iframe'),version=generation;frame.className='shell-page-frame';frame.dataset.pending='';frame.title='Loading page';
  frame.addEventListener('load',()=>loaded(frame,version,mode));
  frame.addEventListener('error',()=>{if(frame===pending){frame.remove();pending=null;fail('Connection unavailable. Try opening this page again.');}});
  frame.navigationTimer=setTimeout(()=>{if(pending===frame){frame.remove();pending=null;fail('This page is taking longer than expected. Try again.');}},30000);
  pending=frame;loading.hidden=false;area.setAttribute('aria-busy','true');const source=new URL(url);source.searchParams.set('__opstack_content','1');frame.src=source.href;area.append(frame);return true;
 }
 function childRouteChanged(child){
  if(child!==current?.contentWindow)return;
  const url=canonical(child.location.href);if(accepts(url))setAddress(url,'replace');
 }
 async function appearanceChanged(){
  if(refreshingAppearance)return;refreshingAppearance=true;
  try{
   await Promise.allSettled([window,current?.contentWindow].filter(Boolean).flatMap(view=>[
    view.refreshAppearance?.(),view.refreshInterfaceText?.(),view.refreshElementOverrides?.(),view.refreshLogo?.(),
    (async()=>{const response=await view.fetch('/font-library',{headers:view.companyHeaders()});if(response.ok)view.applyFontLibrary?.(await response.json());})()
   ]));
  }finally{refreshingAppearance=false;}
 }
 window.appShell={accepts,navigate,childRouteChanged,childPresentationChanged:presentation,appearanceChanged,
  childEditChanged(child,enabled){if(child!==current?.contentWindow||syncingEdits.get(child)||enabled===editing)return;window.appEditor?.setEnabled(enabled);},
  get frame(){return current;}
 };
 retry.onclick=()=>navigate(lastRequest,{force:true,history:lastMode});
 const logout=document.getElementById('logout');
 if(logout)logout.onclick=async()=>{try{const session=await appAccess.initialSession(),response=await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':session.csrf}});if(!response.ok)throw Error();location.replace('/login');}catch{fail('Unable to sign out. Check your connection and try again.');}};
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  const url=new URL(link.href);if(!accepts(url))return;event.preventDefault();navigate(url.href);
 });
 window.addEventListener('popstate',()=>{if(!navigate(location.href,{history:'none'}))history.replaceState({opstackPage:true},'',committed.href);});
 window.addEventListener('before-location-switch',event=>{if(!guard())event.preventDefault();});
 window.addEventListener('app-edit-mode-changed',event=>{editing=event.detail.enabled;syncEdit();});
 window.addEventListener('app-theme-changed',event=>{const child=current?.contentWindow;if(child?.appTheme&&child.appTheme.mode!==event.detail.mode)child.appTheme.set(event.detail.mode);});
 window.addEventListener('app-design-saved',appearanceChanged);window.addEventListener('app-appearance-updated',appearanceChanged);
 window.addEventListener('focus',()=>{const child=current?.contentWindow;if(child)child.dispatchEvent(new child.Event('focus'));});
 window.addEventListener('beforeunload',event=>{if(!current)return;const child=current.contentWindow,unload=new child.Event('beforeunload',{cancelable:true});child.dispatchEvent(unload);if(unload.defaultPrevented){event.preventDefault();event.returnValue='';}});
 history.replaceState({opstackPage:true},'',location.href);navigate(location.href,{history:'replace',check:false});
})();
