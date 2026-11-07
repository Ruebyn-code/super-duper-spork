// Knowledge centre articles linked from checklists and Comms open here as a read-only popup.
// Reads go through the normal permission-checked GET /api/knowledge-library/:id, so people only
// see articles they could open in the Knowledge centre. Opening never edits, acknowledges or saves.
(()=>{
 if(window.knowledgeArticlePopup)return;
 const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const word=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 const data=(tag,text,cls)=>{const element=node(tag,text,cls);element.dataset.userText='';return element;};
 const headers=()=>({'Content-Type':'application/json',...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})});
 async function get(route,signal){const response=await fetch('/api/knowledge-library'+route,{cache:'no-store',headers:headers(),signal});const value=await response.json().catch(()=>({}));if(!response.ok){if(response.status===428)window.appRequiredReading?.check?.();throw Object.assign(Error(value.error||'Unable to open this article.'),{status:response.status});}return value;}
 const canLink=()=>Boolean(window.appAccess?.can?.('knowledge.view'))&&window.appAccess?.featureOn?.('knowledge')!==false;
 const closeIcon='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
 function shell(cls,label){const dialog=node('dialog',undefined,'kc-article-dialog '+cls);dialog.dataset.layoutUi='';dialog.dataset.copyEditor='';dialog.setAttribute('aria-label',label);const head=node('header','', 'kc-article-head'),titles=node('div',undefined,'kc-article-titles'),kicker=node('p',word('Knowledge centre'),'kc-article-kicker'),title=data('h2','','kc-article-title'),close=node('button',undefined,'kc-article-close');close.type='button';close.innerHTML=closeIcon;close.setAttribute('aria-label',word('Close'));close.title=word('Close');titles.append(kicker,title);head.append(titles,close);const body=node('div',undefined,'kc-article-body');dialog.append(head,body);close.onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});return{dialog,title,body,head};}
 function mount(dialog,parent){const returnFocus=document.activeElement;(parent||document.body).append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});},{once:true});dialog.showModal();}
 // Read-only article popup.
 async function open(id,fallbackTitle='',{parent}={}){
  if(!uuid.test(id||''))return;
  const view=shell('kc-article-reader',word('Knowledge centre article'));view.title.textContent=fallbackTitle||word('Loading article…');
  const status=node('p',word('Loading article…'),'kc-article-status');status.setAttribute('role','status');view.body.append(status);
  const footer=node('footer',undefined,'kc-article-foot'),full=node('a',word('Open in Knowledge centre'),'kc-article-full');full.href='/knowledge-library#article-'+id;full.target='_top';footer.append(full);
  mount(view.dialog,parent||document.querySelector('dialog[open]')||document.body);
  const controller=new AbortController();view.dialog.addEventListener('close',()=>controller.abort(),{once:true});
  try{
   const article=await get('/'+id,controller.signal);if(!view.dialog.open)return;
   view.title.textContent=article.title||fallbackTitle;
   const meta=node('p',undefined,'kc-article-meta');meta.append(data('span',[article.type==='policy'?word('Policy'):word('Information'),article.categoryName].filter(Boolean).join(' · ')));if(article.updatedAt)meta.append(data('span',' · '+word('Updated')+' '+new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Melbourne'}).format(new Date(article.updatedAt))));
   const content=node('div',undefined,'kc-article-content');content.dataset.userText='';
   if(window.formattedText)formattedText.render(content,article.body,article.richText);else content.textContent=article.body||'';
   view.body.replaceChildren(meta,content);view.dialog.append(footer);view.body.scrollTop=0;view.body.focus?.();
  }catch(error){if(error.name==='AbortError'||!view.dialog.open)return;status.textContent=error.status===403||error.status===404?word('This article isn’t available to you. It may have been removed or not shared with your role or location.'):error.message;status.classList.add('kc-article-error');}
 }
 // Search and choose an article to link. Resolves {id,title} or null.
 function pick({parent}={}){
  return new Promise(resolve=>{
   const view=shell('kc-article-picker',word('Link a Knowledge centre article'));view.title.textContent=word('Link an article');
   const search=node('input');search.type='search';search.placeholder=word('Search articles');search.setAttribute('aria-label',word('Search Knowledge centre articles'));search.className='kc-article-search';
   const list=node('div',undefined,'kc-article-results');list.setAttribute('role','listbox');list.setAttribute('aria-label',word('Articles'));
   const status=node('p','', 'kc-article-status');status.setAttribute('role','status');
   view.body.append(search,status,list);let chosen=null,controller=null,timer=0;
   async function load(){controller?.abort();controller=new AbortController();status.textContent=word('Searching…');try{const result=await get('?q='+encodeURIComponent(search.value.trim().slice(0,120))+'&page=1',controller.signal);list.replaceChildren();for(const item of result.articles||[]){const option=node('button',undefined,'kc-article-option');option.type='button';option.setAttribute('role','option');option.append(data('strong',item.title),data('small',[item.type==='policy'?word('Policy'):word('Information'),item.categoryName].filter(Boolean).join(' · ')));if(item.excerpt)option.append(data('span',item.excerpt,'kc-article-excerpt'));option.onclick=()=>{chosen={id:item.id,title:item.title};view.dialog.close();};list.append(option);}status.textContent=result.articles?.length?'':word('No articles match. Try another search.');}catch(error){if(error.name!=='AbortError')status.textContent=error.message;}}
   search.oninput=()=>{clearTimeout(timer);timer=setTimeout(load,250);};
   search.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();list.querySelector('button')?.click();}if(event.key==='ArrowDown'){event.preventDefault();list.querySelector('button')?.focus();}};
   list.onkeydown=event=>{const items=[...list.querySelectorAll('button')],index=items.indexOf(document.activeElement);if(event.key==='ArrowDown'){event.preventDefault();items[Math.min(items.length-1,index+1)]?.focus();}if(event.key==='ArrowUp'){event.preventDefault();(index<=0?search:items[index-1]).focus();}};
   view.dialog.addEventListener('close',()=>{controller?.abort();clearTimeout(timer);resolve(chosen);},{once:true});
   mount(view.dialog,parent);search.focus();load();
  });
 }
 // Article links anywhere in the page (formatted text cards and checklist step links).
 document.addEventListener('click',event=>{const trigger=event.target.closest?.('[data-kc-article]');if(!trigger||trigger.closest('[inert]'))return;event.preventDefault();event.stopPropagation();open(trigger.dataset.kcArticle,trigger.dataset.kcTitle||'',{parent:trigger.closest('dialog')||document.body});},true);
 window.knowledgeArticlePopup={open,pick,canLink};
})();
