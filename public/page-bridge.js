(()=>{
 if(parent===window){const url=new URL(location.href);if(url.searchParams.has('__opstack_content')){url.searchParams.delete('__opstack_content');location.replace(url.href);}return;}
 if(!parent.appShell)return;
 document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!document.querySelector('dialog[open]')){event.preventDefault();parent.appSearch?.focus();}});
 for(const name of ['pointerdown','keydown'])document.addEventListener(name,event=>{if(event.isTrusted)parent.appKioskSession?.activity();},true);
 document.documentElement.classList.add('embedded-page');
 window.appEmbedded=true;
 if(frameElement?.hasAttribute('data-phone-roster-popup')){window.appPhoneRosterPopup=true;document.documentElement.classList.add('phone-roster-popup');}
 window.appRequiredReading=parent.appRequiredReading;
 window.appLocationSetup=parent.appLocationSetup;
 window.appShiftClock=parent.appShiftClock;
 window.appMessageBadge=parent.appMessageBadge;
 for(const name of ['required-reading-changed','shift-clock-updated']){
  const relay=event=>window.dispatchEvent(new CustomEvent(name,{detail:event.detail}));parent.addEventListener(name,relay);
  window.addEventListener('pagehide',()=>parent.removeEventListener(name,relay),{once:true});
 }
 // Entering the content frame is still the same app tab. Refreshing lists on
 // this focus event can replace a button between pointer-down and click.
 window.addEventListener('focus',event=>{if(event.target===window&&event.isTrusted)event.stopImmediatePropagation();},true);
 const originalFetch=window.fetch.bind(window);
 window.fetch=async(...args)=>{const response=await originalFetch(...args);if(response.status===401)parent.appKioskSession?.check();if(response.status===428){parent.appRequiredReading?.check();parent.appLocationSetup?.check();}return response;};
 document.addEventListener('pointerdown',()=>parent.appNavigation?.dismissTransient());
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
  const url=new URL(link.href);if(!parent.appShell.accepts(url))return;
  event.preventDefault();parent.appShell.navigate(url.href);
 });
 window.addEventListener('hashchange',()=>parent.appShell.childRouteChanged(window));
 window.addEventListener('app-theme-changed',event=>{if(parent.appTheme?.mode!==event.detail.mode)parent.appTheme?.set(event.detail.mode);});
 window.addEventListener('app-edit-mode-changed',event=>parent.appShell.childEditChanged(window,event.detail.enabled));
 for(const name of ['interface-text-updated','app-logo-updated','font-library-updated','app-design-saved','app-appearance-updated'])window.addEventListener(name,()=>parent.appShell.appearanceChanged());
 document.addEventListener('DOMContentLoaded',()=>{
  new MutationObserver(()=>parent.appShell.childPresentationChanged(window)).observe(document.body,{attributes:true,attributeFilter:['class']});
  new MutationObserver(()=>parent.appShell.childPresentationChanged(window)).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  parent.appShell.childPresentationChanged(window);
 });
})();
