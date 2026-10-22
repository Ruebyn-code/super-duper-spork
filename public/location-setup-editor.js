// Ordinary forms retain their permissions, writes and private location context.
(()=>{
 const bridge=window.appSetupEditor;if(!bridge||parent===window)return;
 let dirty=false,writes=0,version=0,failed=false,interaction=-Infinity;const originalFetch=window.fetch.bind(window);
 const report=()=>parent.appLocationSetup?.editorState(frameElement,{dirty,busy:writes>0});
 bridge.saved=()=>{dirty=false;report();parent.appLocationSetup?.saved(frameElement);};
 window.fetch=async(input,options={})=>{const url=new URL(input instanceof Request?input.url:String(input),location.href),local=url.origin===location.origin&&url.pathname.startsWith('/api/'),method=(options.method||input.method||'GET').toUpperCase(),writing=local&&!['GET','HEAD'].includes(method),saving=writing&&/^\/api\/(?:locations|accounts|account-invitations|suppliers|products|rostering|awards|ops-management\/(?:templates|planners)|learning-centre\/courses|kiosk-devices)(?:\/|$)/.test(url.pathname),at=version;
  if(local){const headers=new Headers(options.headers||input.headers);if(!headers.has('X-Location-Id'))headers.set('X-Location-Id',window.appLocationId);options={...options,headers};}
  if(writing){writes++;report();}
  try{const response=await originalFetch(input,options);if(response.status===401)parent.appKioskSession?.check();if(response.status===428)parent.appRequiredReading?.check();if(writing){if(!response.ok)failed=true;else if(saving&&at===version&&!failed)dirty=false;}return response;}
  catch(error){if(writing)failed=true;throw error;}finally{if(writing){writes--;if(!writes)failed=false;report();parent.appLocationSetup?.check();}}
 };
 for(const type of ['pointerdown','keydown'])document.addEventListener(type,event=>{if(event.isTrusted)interaction=performance.now();},true);
 for(const type of ['input','change'])document.addEventListener(type,event=>{if((event.isTrusted||performance.now()-interaction<1000)&&event.target.closest('input:not([type=search]),select:not(#devices-location):not(#learning-filter):not(#learning-category),textarea,[contenteditable=true]')){version++;dirty=true;report();}},true);
 window.addEventListener('beforeunload',event=>{if(dirty||writes){event.preventDefault();event.returnValue='';}});
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download'))return;const url=new URL(link.href,location.href);if(url.origin!==location.origin)return;if(url.pathname!==location.pathname){event.preventDefault();return;}url.searchParams.set('__opstack_content','1');url.searchParams.set('__opstack_setup',bridge.task);url.searchParams.set('setupLocation',bridge.locationId);if(url.search!==location.search){event.preventDefault();if(!dirty&&!writes)location.href=url.href;}},true);
 const core=['details','hours','manager','sending'].includes(bridge.task);
 function mount(){if(core){const dialog=document.getElementById('location-settings-dialog');if(dialog&&dialog.parentElement!==document.body)document.body.append(dialog);}if(bridge.task==='devices'){const select=document.getElementById('devices-location');if(select&&select.value!==bridge.locationId&&[...select.options].some(o=>o.value===bridge.locationId)){select.value=bridge.locationId;select.dispatchEvent(new Event('change'));}}}
 new MutationObserver(mount).observe(document.body,{subtree:true,childList:true});mount();report();
})();
