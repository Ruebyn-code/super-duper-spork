// Shared equipment register rules for the server and the Equipment page.
(function(root){
 const categories=[['cooking','Cooking'],['refrigeration','Refrigeration'],['beverage','Beverage'],['food-prep','Food preparation'],['cleaning','Cleaning & dishwashing'],['pos-it','POS & IT'],['safety','Safety & fire'],['furniture','Furniture & fit-out'],['other','Other']].map(([id,name])=>({id,name}));
 const statuses=[['operational','Working'],['attention','Needs attention'],['out-of-service','Out of service'],['retired','Retired']].map(([id,name])=>({id,name}));
 const serviceTypes=[['service','Scheduled service'],['repair','Repair'],['inspection','Inspection or test'],['clean','Deep clean'],['other','Other']].map(([id,name])=>({id,name}));
 const severities=[['minor','Minor – still usable'],['major','Major – affects use'],['unusable','Can’t be used']].map(([id,name])=>({id,name}));
 const scopes=[['location','This location'],['company','Whole company'],['network','Whole network']].map(([id,name])=>({id,name}));
 const name=(list,id)=>list.find(item=>item.id===id)?.name||id;
 const day=86400000,parse=value=>Date.parse(value+'T12:00:00Z'),add=(value,days)=>new Date(parse(value)+days*day).toISOString().slice(0,10),between=(from,to)=>Math.round((parse(to)-parse(from))/day);
 const lastService=item=>(item.services||[]).filter(s=>s.type!=='clean').map(s=>s.date).sort().pop()||null;
 // Next service counts from the latest non-cleaning service, or the purchase date. Without an interval nothing is due.
 function service(item,today){
  if(item.status==='retired'||!Number.isSafeInteger(item.serviceIntervalDays))return{state:'none',next:null,last:lastService(item)};
  const last=lastService(item),from=last||item.purchaseDate||null;if(!from)return{state:'unknown',next:null,last};
  const next=add(from,item.serviceIntervalDays),days=between(today,next);return{state:days<0?'overdue':days<=14?'soon':'ok',next,days,last};
 }
 function warranty(item,today){if(!item.warrantyUntil)return{state:'none'};const days=between(today,item.warrantyUntil);return{state:days<0?'expired':days<=30?'soon':'active',days};}
 const openFaults=item=>(item.faults||[]).filter(f=>f.status==='open');
 function summarize(items,today){const active=items.filter(i=>i.status!=='retired');return{total:active.length,retired:items.length-active.length,outOfService:active.filter(i=>i.status==='out-of-service').length,attention:active.filter(i=>i.status==='attention').length,openFaults:active.reduce((n,i)=>n+openFaults(i).length,0),overdue:active.filter(i=>service(i,today).state==='overdue').length,dueSoon:active.filter(i=>service(i,today).state==='soon').length,warrantySoon:active.filter(i=>warranty(i,today).state==='soon').length};}
 const api={scopes,categories,statuses,serviceTypes,severities,name,service,warranty,openFaults,summarize,lastService};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.equipmentModel=api;
})(typeof window==='object'?window:globalThis);
