const crypto=require('node:crypto'),{can}=require('./permissions'),calendar=require('./public/ops-planner-model');
function createSources({dir,sales,ops,learning,communications,locations,invoices,now=Date.now}){
 async function collect(actor){
  if(!can(actor,'home.view'))throw Object.assign(Error('Home viewing permission required.'),{status:403});
  const instant=now(),day=calendar.local(instant).slice(0,10),yesterday=calendar.shift(day,-1),week=calendar.monday(day),facts=[],notes=['Figures are for the selected location and your current access. Missing data is unknown. This briefing does not perform operational actions.'],jobs=[];
  const add=(id,label,value,unit,href,group)=>facts.push({id,label,value,unit,href,group});
  const job=(group,load,render)=>jobs.push({group,load,render});
  job('Trading',()=>locations.status(actor.locationId,instant),result=>add('trading','Trading status',{open:'Open',closed:'Closed',unknown:'Hours not set'}[result.tradingStatus.state]||'Hours not set','text','/home','Trading'));
  if(can(actor,'sales.view'))job('Sales',()=>sales.history(dir,actor),records=>{
   const days=new Map();for(const record of records)for(let i=0;i<7;i++)if(Number.isSafeInteger(record.days[i])&&record.days[i]>=0)days.set(calendar.shift(record.weekStart,i),record.days[i]);
   const completed=[...days].filter(([date])=>date>=week&&date<=yesterday),expected=Math.max(0,Math.round((Date.parse(day)-Date.parse(week))/86400000));
   add('sales-yesterday','Daily sales · '+yesterday,days.get(yesterday)??null,'AUD cents','/sales#entry','Sales');
   add('sales-week','Recorded daily sales this week through yesterday',completed.length?completed.reduce((sum,[,amount])=>sum+amount,0):null,'AUD cents','/sales#entry','Sales');
   add('sales-recorded','Completed trading dates with sales recorded this week',completed.length,'count','/sales#entry','Sales');add('sales-expected','Completed calendar dates this week',expected,'count','/sales#entry','Sales');
   notes.push('Sales use saved Daily sales only, through yesterday in Melbourne time. The current week starts Monday. Missing dates are excluded from recorded totals; no profit, growth or forecast is inferred.');
  });
  if(can(actor,'ops.view'))job('Checklists',()=>ops.list(actor,{date:day,location:actor.locationId}),result=>{
   const open=result.tasks.filter(task=>task.run?.status!=='completed');add('checklists-open','Open checklist windows',open.length,'count','/ops-management#active','Checklists');add('checklists-due','Open checklists due within the next hour',open.filter(task=>task.dueAt&&Date.parse(task.dueAt)>=instant&&Date.parse(task.dueAt)<=instant+3600000).length,'count','/ops-management#active','Checklists');
   notes.push('Checklist counts cover currently available windows in your planner audience at this location. Expired or future windows are not included, so these counts are not a full-day completion report.');
  });
  if(can(actor,'learning.view'))job('Training',()=>learning.dashboard(actor),result=>{
   const pending=result.myLearning.filter(item=>item.status!=='cancelled'&&item.progress.status!=='completed');add('training-pending','Your outstanding training assignments',pending.length,'count','/learning-centre#my-learning','Training');add('training-overdue','Your overdue training assignments',pending.filter(item=>item.progress.status==='overdue').length,'count','/learning-centre#my-learning','Training');notes.push('Training covers only your current assignments, including assignments shared across your accessible locations; it is not a team training ranking.');
  });
  if(can(actor,'comms.view'))job('Comms',()=>communications.unread(actor),result=>{add('comms-unread','Your unread messages',result.unread,'count','/communications#direct-messages','Comms');notes.push('Unread messages cover your accessible conversations. Message content, members and staff names are excluded.');});
  if(can(actor,'invoices.view'))job('Invoices',()=>invoices.list(dir,actor,week),result=>{const bundle=result.bundles.find(row=>row.weekStart===week);add('invoices-count','Saved invoices in this week’s bundle',bundle?.count||0,'count','/home#invoices','Invoices');add('invoices-missing','Saved invoices missing a total this week',bundle?.missingTotals||0,'count','/home#invoices','Invoices');notes.push('Invoice counts are saved documents, not expenses, sales or stock-price changes.');});
  const results=await Promise.allSettled(jobs.map(item=>item.load()));for(let i=0;i<jobs.length;i++){const item=jobs[i],result=results[i];try{if(result.status==='rejected')throw result.reason;item.render(result.value);}catch{for(let j=facts.length-1;j>=0;j--)if(facts[j].group===item.group)facts.splice(j,1);add('unavailable-'+item.group.toLowerCase(),item.group+' data',null,'count','/home',item.group);notes.push(item.group+' could not be loaded. Do not treat this as zero or suggest a cause.');}}
  const version=crypto.createHash('sha256').update(JSON.stringify([actor.id,actor.companyId,actor.locationId,[...(actor.permissions||[])].sort(),[...(actor.networkPermissions||[])].sort(),day,facts,notes])).digest('hex');
  return{day,weekStart:week,timeZone:calendar.zone,locationId:actor.locationId,locationName:actor.locationName,checkedAt:new Date(instant).toISOString(),version,facts,notes};
 }
 return{collect};
}
module.exports={createSources};
