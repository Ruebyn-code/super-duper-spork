// Existing feature fixtures use the real five-minute snooze so that adding a
// location does not turn unrelated scenarios into onboarding tests. Setup's own
// integration tests use native fetch and exercise the unsnoozed server gate.
async function fetchWithSetupSnooze(url,options){
 const response=await globalThis.fetch(url,options);
 if(response.status!==428)return response;
 const result=await response.clone().json();if(result.code!=='LOCATION_SETUP')return response;
 const headers=new Headers(options?.headers),origin=new URL(url).origin;
 const signedIn=await globalThis.fetch(origin+'/api/session',{headers});if(!signedIn.ok)return response;
 const actor=await signedIn.json();if(!actor.csrf)return response;
 if(result.setup.companyId!==actor.companyId){const r=await globalThis.fetch(origin+'/api/locations?all=true',{headers});if(!r.ok)return response;const location=(await r.json()).find(l=>!l.archived&&l.companyId===result.setup.companyId);if(!location)return response;headers.set('X-Location-Id',location.id);}
 headers.set('Content-Type','application/json');headers.set('X-CSRF-Token',actor.csrf);
 const snoozed=await globalThis.fetch(origin+'/api/location-setup/snooze',{method:'POST',headers,body:'{}'});
 if(!snoozed.ok)return response;
 return globalThis.fetch(url,options);
}
module.exports={fetchWithSetupSnooze};
