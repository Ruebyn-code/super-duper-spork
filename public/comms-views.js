// Comms view options (display only): Posts as Cards / List / Headlines and conversations as Cards / List / Compact,
// remembered per person on this browser. Desktop/tablet only; phones keep their combined inbox. Nothing is saved to the server.
(()=>{
 const heading=document.querySelector('.communication-view-heading');if(!heading||window.commsViews)return;window.commsViews=true;
 const phone=matchMedia('(max-width:720px)'),body=document.body;
 const options={posts:[['cards','Cards'],['list','List'],['headlines','Headlines']],chats:[['cards','Cards'],['list','List'],['compact','Compact']]};
 const icons={cards:'<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',list:'<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/>',headlines:'<path d="M4 6h16M4 12h10M4 18h13"/>',compact:'<path d="M4 5h16M4 9.5h16M4 14h16M4 18.5h16"/>'};
 const word=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 let key='comms-view',prefs={posts:'cards',chats:'cards'};const openPosts=new Set();
 const switcher=document.createElement('div');switcher.className='comms-view-switch';switcher.setAttribute('role','group');switcher.dataset.layoutUi='';
 const label=document.createElement('span');label.className='comms-view-label';label.textContent=word('View');switcher.append(label);
 heading.append(switcher);
 function section(){const hash=location.hash||'#posts';return ['#direct-messages','#group-chats'].includes(hash)?'chats':['#posts','#company-posts','#network-posts'].includes(hash)?'posts':null;}
 function draw(){
  const kind=section(),show=Boolean(kind)&&!phone.matches&&!(kind==='chats'&&body.classList.contains('comms-conversation-active'));
  switcher.hidden=!show;for(const [name,values] of Object.entries(options))for(const [id] of values)body.classList.toggle('comms-'+name+'-view-'+id,prefs[name]===id&&id!=='cards');
  if(!show)return;switcher.setAttribute('aria-label',word(kind==='posts'?'Post view':'Conversation view'));
  [...switcher.querySelectorAll('button')].forEach(button=>button.remove());
  for(const [id,title] of options[kind]){const button=document.createElement('button');button.type='button';button.className='comms-view-option';button.dataset.view=id;button.setAttribute('aria-pressed',String(prefs[kind]===id));button.title=word(title);button.innerHTML='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">'+icons[id]+'</svg>';const text=document.createElement('span');text.textContent=word(title);button.append(text);button.onclick=()=>choose(kind,id);switcher.append(button);}
 }
 function choose(kind,id){if(prefs[kind]===id)return;prefs[kind]=id;try{localStorage.setItem(key,JSON.stringify(prefs));}catch{}draw();markPosts();switcher.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});}
 // Headlines: posts fold to title, author and a short preview; Show more/Show less opens one post at a time without any server call.
 function markPosts(){
  const headlines=prefs.posts==='headlines';
  for(const post of document.querySelectorAll('#communication-post-list .communication-post')){
   const id=post.dataset.postId||'';let toggle=post.querySelector(':scope > .comms-post-toggle');
   if(!headlines){toggle?.remove();post.classList.remove('comms-post-open');continue;}
   if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.className='comms-post-toggle';toggle.dataset.layoutUi='';toggle.onclick=()=>{if(openPosts.has(id))openPosts.delete(id);else openPosts.add(id);markPosts();};const preview=post.querySelector(':scope > .communication-post-body');if(preview)preview.after(toggle);else post.append(toggle);}
   const open=openPosts.has(id);post.classList.toggle('comms-post-open',open);toggle.textContent=word(open?'Show less':'Show more');toggle.setAttribute('aria-expanded',String(open));
  }
 }
 const list=document.getElementById('communication-post-list');if(list)new MutationObserver(()=>{if(prefs.posts==='headlines')markPosts();}).observe(list,{childList:true});
 new MutationObserver(draw).observe(body,{attributes:true,attributeFilter:['class']});
 addEventListener('hashchange',draw);phone.addEventListener('change',draw);addEventListener('interface-text-updated',()=>{label.textContent=word('View');draw();markPosts();});
 (async()=>{try{const session=await window.appAccess?.initialSession?.();if(session?.id)key='comms-view:'+session.id;const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&typeof saved==='object'){if(options.posts.some(([id])=>id===saved.posts))prefs.posts=saved.posts;if(options.chats.some(([id])=>id===saved.chats))prefs.chats=saved.chats;}}catch{}draw();markPosts();})();
 draw();
})();
