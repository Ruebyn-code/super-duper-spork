const {can}=require('./permissions');
const calendar=require('./public/ops-planner-model');
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};
const day=value=>value?calendar.local(Date.parse(value)).slice(0,10):null;
const within=(value,period)=>value&&value>=period.start&&value<=period.end;
async function training(contexts,period,store){
 if(contexts.some(actor=>!can(actor,'learning.view')||!can(actor,'learning.report')))fail('Training reporting permission is required in every selected company.');
 const selected=new Map();
 for(const actor of contexts){
  const result=await store.report(actor,{locationId:actor.locationId});
  for(const row of result.rows){
   if(!within(row.dueDate,period)&&!within(day(row.completedAt),period)&&!(!row.dueDate&&within(day(row.assignedAt),period)))continue;
   const key=actor.companyId+'|'+row.assignmentId+'|'+row.userId;
   if(!selected.has(key))selected.set(key,{...row,locationIds:[],locationNames:[],companyId:actor.companyId,companyName:actor.companyName});
   const saved=selected.get(key);saved.locationIds.push(actor.locationId);saved.locationNames.push(actor.locationName);
  }
 }
 return {rows:[...selected.values()],note:'Training due or completed in this period. Training without a due date uses its assignment date. Status is current; cancelled assignments are excluded from completion rates.'};
}
async function checklists(contexts,period,store){
 if(contexts.some(actor=>!can(actor,'ops.view')))fail('Checklist viewing permission is required in every selected company.');
 const rows=[];
 for(const actor of contexts){const result=await store.report(actor,{...period,locationId:actor.locationId});for(const row of result.rows)rows.push({...row,companyId:actor.companyId,companyName:actor.companyName,locationIds:[actor.locationId],locationNames:[actor.locationName]});}
 return {rows,note:'Saved checklists use their work date. If today is selected, unstarted tasks scheduled for today are included. Earlier unstarted schedules are not reconstructed. Status is current.'};
}
// Staff activity: a read-only timeline of what people did, built from existing permission-checked readers.
const activitySources=[
 {id:'checklists',name:'Checklists',keys:['ops.view']},
 {id:'clock',name:'Clock in & breaks',keys:['rostering.approve','rostering.manage']},
 {id:'orders',name:'Orders',keys:['orders.view']},
 {id:'counts',name:'Stock counts',keys:['counts.view']},
 {id:'wastage',name:'Wastage',keys:['wastage.view']},
 {id:'labels',name:'Labels',keys:['prep.view']},
 {id:'training',name:'Training',keys:['learning.report']},
 {id:'equipment',name:'Equipment',keys:['equipment.view']}
];
const typeSource={'checklist-step':'checklists','checklist-complete':'checklists','clock-in':'clock','clock-out':'clock','break-start':'clock','break-end':'clock',order:'orders','order-recorded':'orders',count:'counts',wastage:'wastage','wastage-void':'wastage',labels:'labels','training-complete':'training','equipment-fault':'equipment','equipment-resolved':'equipment','equipment-service':'equipment'};
const melbourne=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function local(at){const parts=Object.fromEntries(melbourne.formatToParts(new Date(at)).map(part=>[part.type,part.value]));return{date:parts.year+'-'+parts.month+'-'+parts.day,time:parts.hour+':'+parts.minute};}
async function activity(contexts,period,deps){
 const events=[],skipped=new Set(),failed=new Set(),included=new Set(),names=new Map((await deps.directory()).map(person=>[person.id,person.username])),ids=new Map([...names].map(([id,name])=>[String(name).toLowerCase(),id]));
 const inside=at=>{if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))return false;const day=local(at).date;return day>=period.start&&day<=period.end;};
 for(const actor of contexts){
  const sources={
   checklists:()=>deps.ops.activity(actor,{start:period.start,end:period.end,locationId:actor.locationId}),
   clock:()=>deps.rostering.clockActivity(actor),
   orders:async()=>(await deps.orders()).orders.filter(order=>order.status==='requested'&&(order.companyId||'default')===actor.companyId&&order.locationId===actor.locationId).map(order=>{const manual=order.source==='manual_history',suppliers=new Set((order.items||[]).map(item=>item.supplierId)).size;return{at:manual?order.recordedAt||order.createdAt:order.createdAt,userId:manual?order.recordedById||null:order.requestOwnerId||null,userName:manual?order.recordedBy||'':'',type:manual?'order-recorded':'order',title:(manual?'Recorded past order ':'Placed order ')+(order.orderNumber||''),detail:(order.items||[]).length+' items · '+suppliers+(suppliers===1?' supplier':' suppliers')};}),
   counts:async()=>(await deps.counts(actor)).filter(count=>count.locationId===actor.locationId).map(count=>({at:count.createdAt,userId:null,userName:count.counterName||'',type:'count',title:'Saved a stock count',detail:count.itemCount+' items · count date '+count.countDate})),
   wastage:async()=>{const result=await deps.wastage.list(actor,new URLSearchParams({from:period.start,to:period.end}));return result.records.flatMap(record=>[{at:record.createdAt,userId:record.createdBy?.id||null,userName:record.createdBy?.name||'',type:'wastage',title:'Recorded wastage',detail:(record.items||[]).length+((record.items||[]).length===1?' item':' items')},...(record.voidedAt?[{at:record.voidedAt,userId:record.voidedBy?.id||null,userName:record.voidedBy?.name||'',type:'wastage-void',title:'Voided wastage',detail:''}]:[])]);},
   labels:()=>deps.labels.batchActivity(actor,actor.locationId),
   training:async()=>{if(!can(actor,'learning.view'))return[];const result=await deps.learning.report(actor,{locationId:actor.locationId});return result.rows.filter(row=>row.completedAt).map(row=>({at:row.completedAt,userId:row.userId||null,userName:row.username||'',type:'training-complete',title:'Completed training: '+(row.courseTitle||''),detail:row.assignmentTitle&&row.assignmentTitle!==row.courseTitle?row.assignmentTitle:''}));},
   equipment:async()=>{const result=await deps.equipment.list(actor);return(result.items||[]).flatMap(item=>[...(item.faults||[]).flatMap(fault=>[{at:fault.reportedAt,userId:fault.reportedBy?.id||null,userName:fault.reportedBy?.name||'',type:'equipment-fault',title:'Reported a problem: '+item.name,detail:fault.description||''},...(fault.resolvedAt?[{at:fault.resolvedAt,userId:fault.resolvedBy?.id||null,userName:fault.resolvedBy?.name||'',type:'equipment-resolved',title:'Resolved a problem: '+item.name,detail:''}]:[])]),...(item.services||[]).map(service=>({at:service.recordedAt,userId:service.recordedBy?.id||null,userName:service.recordedBy?.name||'',type:'equipment-service',title:'Logged a service: '+item.name,detail:service.notes||''}))]);}
  };
  for(const source of activitySources){
   if(!source.keys.some(key=>can(actor,key))){skipped.add(source.name);continue;}
   let found;try{found=await sources[source.id]();included.add(source.name);}catch(error){if(error.status&&error.status<500){skipped.add(source.name);continue;}failed.add(source.name);continue;}
   for(const event of found||[]){if(!inside(event.at))continue;const userId=event.userId||ids.get(String(event.userName||'').toLowerCase())||null,userName=(userId&&names.get(userId))||event.userName||'Unknown person',when=local(event.at);events.push({id:actor.locationId+'|'+events.length,at:event.at,date:when.date,time:when.time,userKey:userId||'name:'+userName.toLowerCase(),userName,type:event.type,source:typeSource[event.type]||source.id,title:String(event.title||'').slice(0,300),detail:String(event.detail||'').slice(0,300),locationId:actor.locationId,locationName:actor.locationName,companyName:actor.companyName});}
  }
 }
 // A training completion belongs to the person, not each location they work at: show it once.
 const merged=new Map();for(const event of events){if(event.source!=='training')continue;const key=[event.userKey,event.at,event.title].join('|'),first=merged.get(key);if(first){if(!first.locationName.split(', ').includes(event.locationName))first.locationName+=', '+event.locationName;event.duplicate=true;}else merged.set(key,event);}
 for(let index=events.length-1;index>=0;index--)if(events[index].duplicate)events.splice(index,1);
 events.sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
 const limited=events.slice(0,20000),people=[...new Map(limited.map(event=>[event.userKey,event.userName])).entries()].map(([key,name])=>({key,name})).sort((a,b)=>a.name.localeCompare(b.name));
 for(const name of included)skipped.delete(name);
 return{rows:limited,people,sources:activitySources.map(source=>({id:source.id,name:source.name})),included:[...included],skipped:[...skipped].filter(name=>!included.has(name)),failed:[...failed],truncated:events.length>limited.length,note:'Times are in Melbourne time. Each source only shows what you are allowed to see for the selected locations. Checklist steps show the latest time each step was completed.'};
}
module.exports={training,checklists,activity};
