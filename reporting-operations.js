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
module.exports={training,checklists};
