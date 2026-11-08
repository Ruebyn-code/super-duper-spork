// Home: running promotions (and ones starting within a week) at the selected location, with cover images.
// Read-only through GET /api/home-promotions (Home viewing); never shows sales results or writes.
(()=>{
 const root=document.getElementById('home-promotions');if(!root)return;
 const word=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 const ui=(tag,text,cls)=>{const node=el(tag,word(text),cls);window.appWording?.label(node,text);return node;};
 const data=(tag,text,cls)=>{const node=el(tag,text,cls);node.dataset.userText='';return node;};
 const day=value=>new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
 const tag='<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.5"/></svg>';
 let actor=null,identity='',signature='',generation=0;
 const heading=el('div',undefined,'home-promotions-heading'),title=ui('h2','Promotions'),all=ui('a','All promotions'),list=el('div',undefined,'home-promotions-list');
 title.id='home-promotions-title';all.href='/sales#promotions';heading.append(title,all);root.append(heading,list);list.setAttribute('role','list');
 function clear(){signature='';list.replaceChildren();root.hidden=true;}
 function card(item){
  const article=el('article',undefined,'home-promotion'+(item.status==='running'?' is-running':'')),media=el('div',undefined,'home-promotion-media');article.setAttribute('role','listitem');
  if(item.image){const image=el('img');image.src=item.image.url;image.alt='';image.loading='lazy';image.decoding='async';media.append(image);}else{media.classList.add('is-empty');media.innerHTML=tag;}
  const body=el('div',undefined,'home-promotion-body'),name=data('h3',item.name),meta=el('p',undefined,'home-promotion-meta');
  const offer=data('span',item.offer,'home-promotion-offer'),when=data('span',item.status==='running'?(item.endDate===item.startDate?word('Today only'):word('Until')+' '+day(item.endDate)):word('Starts')+' '+day(item.startDate),'home-promotion-when');
  meta.append(offer,when);body.append(name,meta);article.append(media,body);return article;
 }
 async function refresh(){
  if(!actor||!window.appAccess?.can?.('home.view',actor)){clear();return;}
  const version=++generation,scope=actor.locationId;
  try{const response=await fetch('/api/home-promotions',{cache:'no-store',headers:scope?{'X-Location-Id':scope}:{}});if(!response.ok)throw Error();const result=await response.json();if(version!==generation||scope!==actor?.locationId)return;
   const items=result.promotions||[],key=JSON.stringify(items);if(key===signature)return;signature=key;list.replaceChildren(...items.map(card));root.hidden=!items.length;all.hidden=!window.appAccess?.can?.('sales.view',actor);}
  catch{if(version===generation)clear();}
 }
 function setActor(next){const key=JSON.stringify([next?.id,next?.companyId,next?.locationId]);actor=next;if(key!==identity){identity=key;generation++;clear();}}
 window.addEventListener('home-dashboard-access',event=>{if(event.detail.actor){setActor(event.detail.actor);refresh();}});
 window.addEventListener('focus',()=>refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
 (async()=>{try{setActor(await appAccess.initialSession());refresh();}catch{clear();}})();
})();
