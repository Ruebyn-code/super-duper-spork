(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.createOpsAutosave=factory;})(typeof window==='object'?window:globalThis,({save,onState=()=>{},delay=650})=>{
 let version=0,saved=0,epoch=0,timer=null,pending=null,error=null,blocked=false;
 const state=phase=>onState({phase,dirty:version>saved,saving:Boolean(pending),error});
 function schedule(){clearTimeout(timer);if(!blocked)timer=setTimeout(()=>{flush().catch(()=>{});},delay);}
 function changed(){version++;if(!blocked){error=null;state('pending');schedule();}}
 async function flush(){
  clearTimeout(timer);timer=null;if(blocked)throw error;
  if(pending){await pending;if(version>saved)return flush();return;}
  if(version===saved)return;
  const current=epoch;
  pending=Promise.resolve().then(async()=>{
   while(current===epoch&&version>saved){const target=version;error=null;state('saving');try{await save();}catch(reason){if(current!==epoch)return;error=reason;blocked=reason.status===409;state('error');throw reason;}if(current===epoch)saved=target;}
  });
  try{await pending;}finally{if(current===epoch){pending=null;if(!error)state(version>saved?'pending':'saved');}}
 }
 function reset(){if(pending)throw Error('Wait for automatic saving to finish.');clearTimeout(timer);timer=null;epoch++;version=saved=0;error=null;blocked=false;state('idle');}
 return{changed,flush,reset,get dirty(){return version>saved;},get saving(){return Boolean(pending);},get error(){return error;}};
});
