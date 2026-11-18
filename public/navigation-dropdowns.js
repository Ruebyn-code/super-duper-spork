// Small dropdown menus under the main bar listing each destination's sub-options (desktop/tablet with a mouse or keyboard).
// Display only: links reuse the persistent shell's ordinary navigation, guards and permission checks; nothing is saved.
(()=>{
 if(window.top!==window||window.navigationDropdowns)return;window.navigationDropdowns=true;
 const root=document.documentElement,model=()=>window.subpageNavigationModel;
 const wording=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 const phone=matchMedia('(max-width:720px), (max-width:1100px) and (max-height:500px) and (pointer:coarse)'),hover=matchMedia('(hover:hover) and (pointer:fine)');
 let panel=null,owner=null,openTimer=0,closeTimer=0;
 const can=key=>window.appAccess?.can?.(key);
 const featureOn=id=>window.appAccess?.featureOn?window.appAccess.featureOn(id):true;
 function itemsFor(link){
  const m=model();if(!m?.menu)return [];let url;try{url=new URL(link.href,location.href);}catch{return [];}
  const items=m.menu(url.pathname)||[];
  return items.filter(item=>m.visible(item,can)&&(!m.features[item.href]||featureOn(m.features[item.href])));
 }
 function available(){return !phone.matches&&!root.classList.contains('kiosk-app')&&!root.classList.contains('app-edit-mode')&&document.getElementById('top-navigation-tabs');}
 function build(){panel=document.createElement('nav');panel.id='nav-dropdown';panel.className='nav-dropdown';panel.hidden=true;panel.dataset.layoutUi='';panel.setAttribute('data-copy-editor','');
  panel.addEventListener('pointerenter',()=>clearTimeout(closeTimer));panel.addEventListener('pointerleave',()=>scheduleClose());
  panel.addEventListener('keydown',event=>{const links=[...panel.querySelectorAll('a')],index=links.indexOf(document.activeElement);
   if(event.key==='Escape'){event.preventDefault();const back=owner;close();back?.focus();}
   else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=links[(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length];next?.focus();}
   else if(event.key==='Home'||event.key==='End'){event.preventDefault();links[event.key==='Home'?0:links.length-1]?.focus();}
   else if(event.key==='Tab'){close();}});
  panel.addEventListener('click',event=>{if(event.target.closest('a'))setTimeout(close,0);});
  document.body.append(panel);}
 function current(item){const here=location.pathname+location.hash,url=new URL(item.href,location.href);return url.pathname+url.hash===here||(!url.hash&&url.pathname===location.pathname&&!location.hash);}
 function open(link,focusFirst=false){
  if(!available())return false;const items=itemsFor(link);if(items.length<2){close();return false;}
  if(!panel)build();clearTimeout(closeTimer);
  if(owner!==link){owner?.removeAttribute('aria-expanded');panel.replaceChildren();const name=link.dataset.sidebarName||link.querySelector('.sidebar-label')?.textContent.trim()||'';panel.setAttribute('aria-label',name);
   const title=document.createElement('p');title.className='nav-dropdown-title';title.textContent=name;title.dataset.userText='';panel.append(title);
   for(const item of items){const a=document.createElement('a');a.href=item.href;a.textContent=wording(item.title);if(current(item))a.setAttribute('aria-current','page');panel.append(a);}
   owner=link;}
  link.setAttribute('aria-expanded','true');panel.hidden=false;place();
  if(focusFirst)panel.querySelector('a')?.focus();return true;
 }
 function place(){if(!owner||!panel||panel.hidden)return;const r=owner.getBoundingClientRect(),w=panel.offsetWidth;panel.style.top=Math.round(r.bottom+6)+'px';panel.style.left=Math.round(Math.max(8,Math.min(r.left+r.width/2-w/2,innerWidth-w-8)))+'px';}
 function close(){clearTimeout(openTimer);clearTimeout(closeTimer);if(panel)panel.hidden=true;owner?.removeAttribute('aria-expanded');owner=null;}
 function scheduleClose(){clearTimeout(openTimer);clearTimeout(closeTimer);closeTimer=setTimeout(close,220);}
 function init(){
  const tabs=document.getElementById('top-navigation-tabs');if(!tabs)return false;
  tabs.addEventListener('pointerover',event=>{if(event.pointerType!=='mouse'||!hover.matches)return;const link=event.target.closest('a[href]');if(!link||!tabs.contains(link))return;clearTimeout(closeTimer);clearTimeout(openTimer);openTimer=setTimeout(()=>open(link),owner?0:140);});
  tabs.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse')scheduleClose();});
  tabs.addEventListener('keydown',event=>{const link=event.target.closest('a[href]');if(!link||event.altKey||event.ctrlKey||event.metaKey)return;
   if(event.key==='ArrowDown'){if(open(link,true))event.preventDefault();}else if(event.key==='Escape'&&owner){close();}});
  tabs.addEventListener('focusout',event=>{if(!panel?.contains(event.relatedTarget)&&!tabs.contains(event.relatedTarget))close();});
  tabs.addEventListener('click',()=>close());
  for(const link of tabs.querySelectorAll('a[href]'))if(itemsFor(link).length>1)link.setAttribute('aria-haspopup','true');
  return true;
 }
 document.addEventListener('pointerdown',event=>{if(panel&&!panel.hidden&&!panel.contains(event.target)&&!owner?.contains(event.target))close();},true);
 const closeOpen=()=>{if(panel&&!panel.hidden)close();};addEventListener('resize',closeOpen);addEventListener('scroll',event=>{if(!panel?.contains(event.target))closeOpen();},true);addEventListener('blur',()=>setTimeout(()=>{if(!document.hasFocus())closeOpen();},0));
 addEventListener('app-edit-mode-changed',close);addEventListener('popstate',close);
 const start=()=>{if(!init()){let tries=0;const timer=setInterval(()=>{if(init()||++tries>40)clearInterval(timer);},250);}};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
