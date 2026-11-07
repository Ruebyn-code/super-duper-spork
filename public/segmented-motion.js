// Smoothly slide the selected highlight between buttons that sit next to each other
// (segmented controls, tabs, view toggles and radio-style choices). Display only:
// around a real click/keypress it measures the old and new selected buttons and
// animates the group's ::before highlight between them. It never changes state or data,
// and it adds no elements, so :first-child/:last-child styling and child lists stay intact.
(()=>{
 if(window.__segmentedMotion)return;window.__segmentedMotion=true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),forced=matchMedia('(forced-colors: active)');
 const candidate='button,[role=tab],[role=radio],a[aria-current],label:has(>input[type=radio])';
 const DURATION=240,lengths=['x','y','w','h'];
 const css='@property --sm-x{syntax:"<length>";inherits:true;initial-value:0px}@property --sm-y{syntax:"<length>";inherits:true;initial-value:0px}@property --sm-w{syntax:"<length>";inherits:true;initial-value:0px}@property --sm-h{syntax:"<length>";inherits:true;initial-value:0px}'
  +'.segmented-motion-host{isolation:isolate}.segmented-motion-host.segmented-motion-static{position:relative}'
  +'.segmented-motion-host::before{content:"";position:absolute;left:0;top:0;width:var(--sm-w);height:var(--sm-h);transform:translate(var(--sm-x),var(--sm-y));border-radius:var(--sm-r,8px);background-color:var(--sm-bg,transparent);background-image:var(--sm-img,none);box-shadow:var(--sm-shadow,none);z-index:-1;pointer-events:none;transition:none}'
  +'.segmented-motion-host.segmented-motion-run{transition:--sm-x '+DURATION+'ms cubic-bezier(.2,.8,.2,1),--sm-y '+DURATION+'ms cubic-bezier(.2,.8,.2,1),--sm-w '+DURATION+'ms cubic-bezier(.2,.8,.2,1),--sm-h '+DURATION+'ms cubic-bezier(.2,.8,.2,1)}'
  +'.segmented-motion-host>.segmented-motion-target{background:transparent!important;box-shadow:none!important}'
  +'@media (prefers-reduced-motion:reduce),(forced-colors:active){.segmented-motion-host::before{display:none}}';
 function addStyle(){if(document.getElementById('segmented-motion-style'))return;const style=document.createElement('style');style.id='segmented-motion-style';style.textContent=css;(document.head||document.documentElement).append(style);}
 const supported=typeof CSS!=='undefined'&&CSS.registerProperty!==undefined;
 function selected(node){
  if(!node||node.disabled)return false;
  for(const attr of ['aria-pressed','aria-selected','aria-checked'])if(node.getAttribute(attr)==='true')return true;
  const current=node.getAttribute('aria-current');if(current&&current!=='false')return true;
  if(node.matches('label')&&node.querySelector(':scope>input[type=radio]:checked'))return true;
  return /(^|\s)(is-)?(active|selected|current)(\s|$)/.test(typeof node.className==='string'?node.className:'');
 }
 // The nearest parent whose direct children include 2–12 option-like controls.
 function groupOf(target){
  let option=target.closest?.(candidate);
  for(let depth=0;option&&depth<2;depth++){
   const parent=option.parentElement;if(!parent)return null;
   const options=[...parent.children].filter(child=>child.matches(candidate));
   if(options.length>=2&&options.length<=12&&!parent.closest('[role=listbox],[role=menu],.app-select-menu,.location-picker-menu'))return{parent,options};
   option=parent.closest(candidate);
  }
  return null;
 }
 const pending=new WeakMap();
 function capture(event){
  if(!supported||reduced.matches||forced.matches)return;
  const group=groupOf(event.target);if(!group||group.parent.classList.contains('segmented-motion-host'))return;
  // Skip groups that already use their own ::before decoration.
  if(getComputedStyle(group.parent,'::before').content!=='none')return;
  const before=group.options.filter(selected);if(before.length!==1)return;
  const old=before[0],rect=old.getBoundingClientRect();if(!rect.width||!rect.height)return;
  pending.set(group.parent,{old,rect,at:performance.now()});
  requestAnimationFrame(()=>requestAnimationFrame(()=>settle(group.parent)));setTimeout(()=>settle(group.parent),150);
 }
 function settle(parent){
  const record=pending.get(parent);if(!record)return;
  if(!parent.isConnected){pending.delete(parent);return;}
  const now=[...parent.children].filter(child=>child.matches(candidate)&&selected(child));
  if(now.length!==1||now[0]===record.old&&record.old.isConnected){if(performance.now()-record.at>450)pending.delete(parent);return;}
  pending.delete(parent);slide(parent,record.rect,now[0],record.old.isConnected?record.old:null);
 }
 function slide(parent,from,next,old){
  // Read the selected look with the button's own transitions paused, so a fade-in doesn't give a pale highlight.
  const priorTransition=next.style.getPropertyValue('transition'),priorPriority=next.style.getPropertyPriority('transition');next.style.setProperty('transition','none','important');
  const to=next.getBoundingClientRect(),style=getComputedStyle(next),image=style.backgroundImage,colour=style.backgroundColor;
  const restoreTransition=()=>{if(priorTransition)next.style.setProperty('transition',priorTransition,priorPriority);else next.style.removeProperty('transition');};
  const visible=image!=='none'||(colour&&colour!=='transparent'&&!/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(colour));
  if(!visible||!to.width||Math.abs(to.left-from.left)+Math.abs(to.top-from.top)<1){restoreTransition();return;}
  addStyle();
  const box=parent.getBoundingClientRect(),place=rect=>({x:rect.left-box.left-parent.clientLeft+parent.scrollLeft,y:rect.top-box.top-parent.clientTop+parent.scrollTop,w:rect.width,h:rect.height});
  const set=values=>{for(const key of lengths)parent.style.setProperty('--sm-'+key,values[key]+'px');};
  parent.style.setProperty('--sm-r',style.borderRadius);parent.style.setProperty('--sm-bg',colour);parent.style.setProperty('--sm-img',image);parent.style.setProperty('--sm-shadow',style.boxShadow);
  if(getComputedStyle(parent).position==='static')parent.classList.add('segmented-motion-static');
  // Text colours swap with the highlight: start each button at the other's colour, then ease to its own.
  const nextColour=style.color,oldColour=old?getComputedStyle(old).color:null,swaps=[];
  if(old&&oldColour!==nextColour){next.style.setProperty('color',oldColour,'important');old.style.setProperty('color',nextColour,'important');swaps.push(next,old);}
  set(place(from));parent.classList.add('segmented-motion-host');next.classList.add('segmented-motion-target');
  void parent.offsetWidth;
  for(const node of swaps){node.style.setProperty('transition','color '+DURATION+'ms ease','important');node.style.removeProperty('color');}
  if(!swaps.includes(next))next.style.setProperty('transition','none','important');
  parent.classList.add('segmented-motion-run');set(place(to));
  let cleaned=false;const done=()=>{if(cleaned)return;cleaned=true;parent.classList.remove('segmented-motion-host','segmented-motion-run','segmented-motion-static');next.classList.remove('segmented-motion-target');for(const node of swaps)if(node!==next)node.style.removeProperty('transition');next.style.setProperty('transition','none','important');requestAnimationFrame(()=>requestAnimationFrame(restoreTransition));for(const key of [...lengths,'r','bg','img','shadow'])parent.style.removeProperty('--sm-'+key);};
  setTimeout(done,DURATION+40);
 }
 document.addEventListener('pointerdown',event=>{if(event.button===0)capture(event);},true);
 document.addEventListener('keydown',event=>{if(['Enter',' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))capture(event);},true);
})();
