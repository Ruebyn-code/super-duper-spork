(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./reporting-model'));else root.reportingProgressModel=factory(root.reportingModel);})(globalThis,finance=>{
 const statuses={'not-started':'Not started','in-progress':'In progress',completed:'Completed',overdue:'Overdue',cancelled:'Cancelled'};
 function filter(rows,{query='',status='all'}={}){const text=query.trim().toLocaleLowerCase();return rows.filter(row=>(status==='all'||row.status===status)&&(!text||[row.username,row.courseTitle,row.assignmentTitle,row.title,row.plannerName,row.companyName,...row.locationNames].filter(Boolean).join(' ').toLocaleLowerCase().includes(text)));}
 // Checklist steps in a timed section that were done early, late or not at all within the window count as failed.
 const failedTiming=new Set(['early','late','missed']);
 function timedFails(row){return Array.isArray(row.steps)?row.steps.filter(step=>step.timed&&failedTiming.has(step.timing)).length:0;}
 // One record's share of completion (0–1). Training and checklists without step facts: completed or not.
 // Checklists: completed runs score 1, otherwise answered steps; each failed timed step is taken off.
 function score(row){
  if(!Array.isArray(row.steps)||!row.steps.length)return row.status==='completed'?1:0;
  const total=row.steps.length,fails=timedFails(row),credited=row.status==='completed'?total-fails:row.steps.filter(step=>step.done&&!(step.timed&&failedTiming.has(step.timing))).length;
  return Math.max(0,Math.min(1,credited/total));
 }
 function summary(rows){const active=rows.filter(row=>row.status!=='cancelled'),completed=active.filter(row=>row.status==='completed').length,stepped=active.some(row=>Array.isArray(row.steps)),fails=active.reduce((sum,row)=>sum+timedFails(row),0),points=active.reduce((sum,row)=>sum+score(row),0);return{total:active.length,completed,overdue:active.filter(row=>row.status==='overdue').length,inProgress:active.filter(row=>row.status==='in-progress').length,notStarted:active.filter(row=>row.status==='not-started').length,timedFails:fails,timedFailRuns:active.filter(row=>timedFails(row)>0).length,rate:active.length?(stepped?points/active.length*100:completed/active.length*100):null};}
 function ranks(entries,metric,direction=-1){const selected=entries.map(row=>({...row,value:row[metric]??null})).sort((a,b)=>a.value===null?(b.value===null?a.name.localeCompare(b.name):1):b.value===null?-1:(a.value-b.value)*direction||a.name.localeCompare(b.name));let previous,rank=null;return selected.map((row,index)=>{if(row.value!==null&&row.value!==previous)rank=index+1;previous=row.value;return{...row,rank:row.value===null?null:rank};});}
 function progressRankings(rows,locations,metric='rate'){return ranks(locations.map(location=>({id:location.id,name:location.name,company:location.companyName,...summary(rows.filter(row=>row.companyId===location.companyId&&row.locationIds.includes(location.id)))})).map(row=>({...row,rate:row.total?row.rate:null,overdue:row.total?row.overdue:null,completed:row.total?row.completed:null})),metric,metric==='overdue'?1:-1);}
 function financeRankings(reports,metric='profitCents',options={}){return ranks(reports.map(report=>{const total=finance.financeTotal(finance.filtered([report],'finance',options)),complete=total.weeks>0&&total.recordedDays===total.expectedDays;return{id:report.location.id,name:report.location.name,company:report.company.name,total:total.weeks,salesCents:complete?total.salesCents:null,profitCents:complete?total.profitCents:null,profitPercent:complete?total.profitPercent:null};}),metric);}
 return{statuses,filter,summary,score,timedFails,ranks,progressRankings,financeRankings};
});
