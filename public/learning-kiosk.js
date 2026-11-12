// Training-only kiosks: a welcome banner above the Learning centre (display only; never saves or starts training).
(()=>{
 const root=document.documentElement;if(!root.classList.contains('kiosk-training-frame'))return;
 function start(){
  const main=document.getElementById('learning-main');if(!main||document.getElementById('learning-kiosk-hero'))return;
  const hero=document.createElement('section'),text=document.createElement('div'),eyebrow=document.createElement('p'),title=document.createElement('h2'),lead=document.createElement('p'),icon=document.createElement('span');
  hero.id='learning-kiosk-hero';hero.className='learning-kiosk-hero';hero.setAttribute('aria-label','Training station');
  eyebrow.className='learning-kiosk-eyebrow';eyebrow.textContent='Training station';title.dataset.userText='';title.textContent='Welcome';lead.textContent='Choose a course below, or open In-store training for your practical sessions.';
  icon.className='learning-kiosk-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 9v6"/></svg>';
  text.append(eyebrow,title,lead);hero.append(text,icon);
  // The banner sits above the tab row once the shared subpage layout exists (it is built after load).
  const place=(tries=0)=>{const workspace=document.querySelector('.subpages-workspace');if(workspace){workspace.before(hero);return;}if(tries<40)setTimeout(()=>place(tries+1),50);else main.prepend(hero);};place();
  fetch('/api/session',{credentials:'same-origin'}).then(response=>response.ok?response.json():null).then(session=>{const name=String(session?.username||'').trim().split(/\s+/)[0];if(name)title.textContent='Hi '+name+', ready to learn?';const place=session?.locations?.find(item=>item.id===session.locationId)?.name;if(place)eyebrow.textContent='Training station · '+place;}).catch(()=>{});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
