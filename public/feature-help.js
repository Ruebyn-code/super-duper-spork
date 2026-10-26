(()=>{
 if(location.pathname==='/help'||window.appFeatureHelp)return;
 const model=window.opstackFeatureHelp;if(!model)return;
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const mounted=new WeakMap();let library=null,active=null,scheduled=false;
 function script(source){return new Promise((resolve,reject)=>{const tag=node('script');tag.src=source;tag.onload=resolve;tag.onerror=()=>{tag.remove();reject(Error('Guides could not load.'));};document.head.append(tag);});}
 function load(){
  if(!library)library=(async()=>{if(!document.querySelector('link[data-feature-help-style]')){const css=node('link');css.rel='stylesheet';css.href='/help.css';css.dataset.featureHelpStyle='';document.head.append(css);}if(!window.opstackHelp)await script('/help-guides.js');if(!window.opstackHelpMedia)await script('/help-media-manifest.js');if(!window.helpVisualGuides)await script('/help-media.js');return window.opstackHelp;})().catch(error=>{library=null;throw error;});
  return library;
 }
 async function open(ids,origin){
  if(active){active.dialog.close();active.dispose();}
  const dialog=node('dialog',undefined,'feature-help-dialog'),bar=node('header',undefined,'feature-help-bar'),title=node('h2','Feature guide'),close=node('button','×','feature-help-close'),content=node('div',undefined,'feature-help-content');
  let media=null,disposed=false;title.id='feature-help-title';dialog.setAttribute('aria-labelledby',title.id);dialog.dataset.layoutUi='';close.type='button';close.setAttribute('aria-label','Close feature guide');bar.append(title,close);content.append(node('p','Loading guide…'));dialog.append(bar,content);
  const dispose=()=>{if(disposed)return;disposed=true;media?.destroy();dialog.remove();if(active?.dialog===dialog)active=null;origin?.setAttribute('aria-expanded','false');if(origin?.isConnected)origin.focus({preventScroll:true});};active={dialog,dispose};
  const dismiss=()=>{dialog.close();dispose();};close.onclick=dismiss;dialog.addEventListener('cancel',event=>{if(event.target===dialog){event.preventDefault();dismiss();}});dialog.addEventListener('close',dispose,{once:true});dialog.addEventListener('keydown',event=>event.stopPropagation());dialog.addEventListener('click',event=>event.stopPropagation());document.body.append(dialog);origin?.setAttribute('aria-expanded','true');dialog.showModal();close.focus();
  try{
   const catalogue=await load();if(disposed)return;const byId=new Map(catalogue.articles.map(a=>[a.id,a])),available=[...new Set([...ids,...(model.pages[location.pathname]||[]),...model.common])].map(id=>byId.get(id)).filter(Boolean),picker=node('select'),field=node('label','Guide','feature-help-picker'),article=node('article',undefined,'help-article');picker.setAttribute('aria-label','Choose a feature guide');picker.dataset.layoutUi='';for(const item of available){const option=node('option',item.title);option.value=item.id;picker.append(option);}field.append(picker);content.replaceChildren(field,article);
   function show(id){media?.destroy();media=null;const guide=byId.get(id);if(!guide)return;picker.value=id;title.textContent=guide.title;bar.classList.toggle('ai-dialog-heading',Boolean(guide.ai));article.replaceChildren(node('p',guide.description,'feature-help-description'));const steps=node('ol',undefined,'help-steps');for(const text of guide.steps)steps.append(node('li',text));article.append(steps);media=window.helpVisualGuides.mount({article:guide,steps});if(guide.notes.length){const notes=node('aside',undefined,'help-guide-notes');notes.append(node('h3','Things to know'));for(const text of guide.notes)notes.append(node('p',text));article.append(notes);}const link=node('a','Open Help & support','help-media-original');link.href='/help#guide='+encodeURIComponent(id);link.target='_blank';link.rel='noopener';article.append(link);content.scrollTop=0;}
   picker.onchange=()=>show(picker.value);show(available[0]?.id);
  }catch{if(!disposed){const link=node('a','Open Help & support');link.href='/help';link.target='_blank';link.rel='noopener';content.replaceChildren(node('p','This guide could not load. Try again or open Help & support.'),link);}}
 }
 function attach(target,value){
  if(target.closest('.feature-help-dialog,#app-sidebar,nav,[contenteditable=true],.formatted-text')||target.matches('button,a,input,textarea')||target.closest('button,a,summary'))return;
  const old=mounted.get(target);if(old&&target.contains(old)){old.dataset.featureHelpValue=value;old.setAttribute('aria-label','Help: '+(target.textContent.trim()||'this feature'));return;}
  const label=target.textContent.trim()||'this feature',button=node('button',undefined,'feature-help-trigger');button.type='button';button.dataset.layoutUi='';button.dataset.featureHelpTrigger='';button.dataset.featureHelpValue=value;button.setAttribute('aria-label','Help: '+label);button.setAttribute('title','Guide for '+label);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');button.innerHTML='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10.5V17M12 7h.01"/></svg>';button.onclick=event=>{event.preventDefault();event.stopPropagation();open(model.resolve(button.dataset.featureHelpValue,location.pathname,location.hash,target.textContent.trim()),button);};target.append(button);mounted.set(target,button);
 }
 function scan(){
  scheduled=false;
  for(const [selector,prefixes]of model.instructionText)for(const target of document.querySelectorAll(selector))target.classList.toggle('feature-instruction',prefixes.some(prefix=>target.textContent.trim().startsWith(prefix)));
  for(const target of document.querySelectorAll('[data-feature-help]'))attach(target,target.dataset.featureHelp);
  for(const [selector,value]of model.bindings)for(const target of document.querySelectorAll(selector))attach(target,value);
  for(const target of document.querySelectorAll('dialog h2,dialog h3,.ai-dialog-heading h2,.location-delivery-plans h3,#home-manager-summary h2,#home-transfer-approvals h2')){if(target.closest('[data-user-text],.formatted-text,[contenteditable=true]'))continue;const title=[...target.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim(),value=model.dynamicTitles[title];if(value)attach(target,value);}
 }
 const observer=new MutationObserver(records=>{if(scheduled||records.every(r=>r.target.nodeType===1&&r.target.closest('.feature-help-dialog')))return;scheduled=true;requestAnimationFrame(scan);});observer.observe(document.body,{subtree:true,childList:true});scan();
 window.appFeatureHelp={open,refresh:scan,close(){if(active){active.dialog.close();active.dispose();}}};
 window.addEventListener('pagehide',()=>{observer.disconnect();active?.dispose();},{once:true});
})();
