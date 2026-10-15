(()=>{
 if(!window.appBootstrap?.access||!appAccess.can('comms.view'))return;
 let count=0,generation=0,loading=null,refreshAgain=false;
 function render(){const badge=document.getElementById('communications-unread-badge');if(!badge)return;const text=count?String(count):'';if(badge.textContent!==text)badge.textContent=text;badge.hidden=count===0;}
 function setCount(value){if(!Number.isSafeInteger(value)||value<0)return;generation++;count=value;render();}
 async function refresh(force=false){
  if((document.hidden&&!force)||window.appRequiredReading?.blocked)return;
  if(loading){refreshAgain=true;return loading;}
  const version=generation;
  loading=(async()=>{try{const response=await fetch('/api/communications/unread',{cache:'no-store',headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(response.ok){const result=await response.json();if(version===generation)setCount(result.unread);}else if(response.status===401||response.status===403)setCount(0);}catch{}finally{loading=null;if(refreshAgain){refreshAgain=false;queueMicrotask(()=>refresh());}}})();return loading;
 }
 function changed(){try{localStorage.setItem('souvlaki-messages-updated',String(Date.now())+Math.random());}catch{}refresh(true);}
 window.appMessageBadge={setCount,refresh,changed,get count(){return count;}};
 document.addEventListener('DOMContentLoaded',()=>{render();refresh();});window.addEventListener('pageshow',()=>refresh());window.addEventListener('focus',()=>refresh());document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});window.addEventListener('storage',event=>{if(event.key==='souvlaki-messages-updated')refresh(true);});window.addEventListener('required-reading-changed',event=>{if(!event.detail.blocked)refresh();});setInterval(()=>refresh(),5000);
})();
