// Append-only activity trail for the rebuilt app. Bounded like the current
// app's audit list so it cannot grow without limit.
const crypto=require('node:crypto');
function createAudit({store,now=Date.now}){
 return (actor,action,details={})=>store.change('audit',list=>{
  list.push({id:crypto.randomUUID(),at:new Date(now()).toISOString(),actorId:actor?.id||null,actorName:actor?.name||null,action,...details});
  if(list.length>2000)list.splice(0,list.length-2000);
 });
}
module.exports={createAudit};
