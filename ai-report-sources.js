const {can,canAccessLocation}=require('./permissions'),reporting=require('./reporting'),details=require('./reporting-details'),operations=require('./reporting-operations'),finance=require('./public/reporting-model'),progress=require('./public/reporting-progress-model'),schedule=require('./public/report-schedule-model');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const selected=(person,spec)=>spec.userIds.includes(person.id)||spec.roleIds.includes(person.role);
function createSources({dir,auth,locations,companies,catalogues,history,sales,weekly,learning,ops,now=Date.now}){
 async function contexts(actor,spec){
  if(!can(actor,'reporting.view'))fail('Reporting permission required.',403);
  const available=await locations.accessible(actor),ids=reporting.selectLocations(spec.locationIds.join(','),available);
  if(actor.kiosk&&ids.some(id=>id!==actor.locationId))fail('This kiosk is assigned to another location.',403);
  const entries=await Promise.all(ids.map(async id=>companies.context(await locations.sessionContext(actor,id))));
  if(entries.some(context=>context.companyId!==actor.companyId))fail('Choose locations in the selected company.',403);
  if(spec.topics.includes('training')&&entries.some(context=>!can(context,'learning.view')||!can(context,'learning.report')))fail('Training reporting permission is required.',403);
  if(spec.topics.includes('checklists')&&entries.some(context=>!can(context,'ops.view')))fail('Checklist viewing permission is required.',403);
  return entries;
 }
 async function collect(actor,spec,period){
  const entries=await contexts(actor,spec),range=reporting.range({preset:'custom',...period},new Date(now())),facts=[],notes=[],audience={training:[],checklists:[]};
  const add=(topic,location,label,value,unit='count')=>facts.push({id:'f'+(facts.length+1),topic,locationId:location.id,location:location.name,label,value,unit});
  const shops=entries.map(context=>({id:context.locationId,name:context.locationName,companyId:context.companyId}));
  const financial=spec.topics.some(topic=>['performance','sales','orders','stock','rankings'].includes(topic));
  if(financial){
   const [stored,catalogue]=await Promise.all([history(dir),catalogues.read(actor.companyId)]),reports=[];
   for(const context of entries){
    const report=reporting.calculate(await sales.history(dir,context),stored.orders,stored.counts,catalogue,context,{preset:'custom',...period},{now:new Date(now()),transfers:stored.transfers});reports.push(report);const shop=shops.find(s=>s.id===context.locationId);
    if(spec.topics.includes('sales')||spec.topics.includes('performance')){add('sales',shop,'Recorded daily sales',report.summary.recordedDays?report.summary.salesCents:null,'AUD cents');add('sales',shop,'Sales days recorded',report.summary.recordedDays);add('sales',shop,'Sales days in period',report.summary.periodDays);}
    if(spec.topics.includes('orders')){add('orders',shop,'Placed orders',report.summary.orderCount);add('orders',shop,'Placed order cost',report.summary.pricePending?null:report.summary.orderCostCents,'AUD cents');for(const row of report.suppliers.slice(0,10))add('orders',shop,'Supplier order cost: '+row.name,row.pricePending?null:row.orderCostCents,'AUD cents');}
    if(spec.topics.includes('stock')){add('stock',shop,'Complete Sunday–Saturday cycles in range',report.stockUsage.weekCount);for(const item of report.stockUsage.items.slice(0,10)){add('stock',shop,'Stock used: '+item.name,item.completeWeeks?item.used:null,'units / packs');add('stock',shop,'Incomplete or negative usage cycles: '+item.name,item.missingWeeks+item.negativeWeeks);}}
    if(spec.topics.includes('performance')||spec.topics.includes('rankings')){
     report.details=await details.build(dir,context,report.period,{...stored,catalogue,store:weekly,now:new Date(now()),weekBasis:'ending'});const total=finance.financeTotal(report.details.finance),complete=total.weeks>0&&total.recordedDays===total.expectedDays;
     for(const[key,label,unit]of [['salesCents','Weekly report sales','AUD cents'],['totalCostsCents','Total costs','AUD cents'],['profitCents','Profit','AUD cents'],['profitPercent','Profit margin','percent']])add('performance',shop,label,complete?total[key]:null,unit);
     add('performance',shop,'Financial weeks ending in period',total.weeks);add('performance',shop,'Weekly report sales days recorded',total.recordedDays);add('performance',shop,'Weekly report sales days expected',total.expectedDays);add('performance',shop,'Financial dates',report.details.financialFrom?report.details.financialFrom+' to '+report.details.financialThrough:'No financial weeks ending in this period','text');
    }
   }
   if(spec.topics.includes('rankings'))for(const row of progress.financeRankings(reports,'profitCents'))add('rankings',shops.find(shop=>shop.id===row.id),'Profit ranking (complete figures only)',row.rank);
   notes.push('Daily sales and placed order costs use the exact selected dates. Sunday orders are allocated to the following Monday. Financial sales and profit use saved complete Monday–Sunday weeks ending within the selected dates; missing sales or costs remain unknown. Cost of goods uses saved invoice totals including GST for each bundle week, plus net cost transfers; no invoices means zero and missing invoice totals mean unknown costs. Placed orders are separate, and platform fees do not change profit.');
   if(spec.topics.includes('stock'))notes.push('Stock usage uses complete Sunday–Saturday cycles and the next Sunday count; only the first ten stock items and suppliers in the normal report order are included. Missing or negative cycles need checking.');
  }
  for(const kind of ['training','checklists'])if(spec.topics.includes(kind)){
   const result=await operations[kind](entries,range,kind==='training'?learning:ops);notes.push(result.note);audience[kind]=result.rows.map(row=>kind==='training'?row.assignmentId+'|'+row.userId:row.companyId+'|'+row.locationIds[0]+'|'+row.id);
   const all={id:'all',name:'All selected locations'};for(const shop of [all,...shops]){const rows=shop.id==='all'?result.rows:result.rows.filter(row=>row.locationIds.includes(shop.id)),total=progress.summary(rows);for(const[key,label,unit]of [['total','Active records','count'],['completed','Completed','count'],['overdue','Overdue','count'],['inProgress','In progress','count'],['notStarted','Not started','count'],['rate','Completion rate','percent']])add(kind,shop,label,total[key],unit);}
  }
  if(!facts.length||facts.length>600||JSON.stringify(facts).length>60000)fail('This report is too large. Select fewer topics or locations.');
  return{companyId:actor.companyId,company:entries[0].companyName,period:{start:range.start,end:range.end,timeZone:range.timeZone},topics:[...spec.topics],locations:shops,facts,notes,audience};
 }
 async function canRead(actor,spec,source){try{
  const entries=await contexts(actor,spec);if(source)for(const kind of ['training','checklists'])if(source.audience[kind].length){const result=await operations[kind](entries,reporting.range({preset:'custom',...source.period},new Date(now())),kind==='training'?learning:ops),ids=new Set(result.rows.map(row=>kind==='training'?row.assignmentId+'|'+row.userId:row.companyId+'|'+row.locationIds[0]+'|'+row.id));if(source.audience[kind].some(id=>!ids.has(id)))return false;}
  return true;
 }catch(error){if([400,403,404].includes(error.status))return false;throw error;}}
 async function people(actor,spec,source){const accounts=await auth.directory(),records=[];for(const raw of accounts){if(raw.invitation)continue;const person=await auth.forCompany(raw,actor.companyId);if(!selected(person,spec))continue;if(await canRead(person,spec,source))records.push(person);if(records.length>200)fail('This report has more than 200 recipients. Narrow the selected users or permission levels.');}return records;}
 async function current(id,companyId){const record=(await auth.directory()).find(person=>person.id===id&&!person.invitation);return record?auth.forCompany(record,companyId):null;}
 const providerData=source=>({company:source.company,period:source.period,topics:source.topics,notes:source.notes,facts:source.facts});
 const publicSource=source=>{const{audience,...value}=source;return value;};
 return{collect,canRead,people,current,contexts,providerData,publicSource,selected};
}
module.exports={createSources,selected};
