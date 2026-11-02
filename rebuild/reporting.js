// Reporting for the rebuilt app: one read-only business overview.
//
// Sales, costs, profit and margin come from records the other phases already
// wrote; this module never recalculates a price or writes anything. A location
// with an incomplete week is listed with its recorded sales but no profit,
// margin or ranking, so a partial week is never mistaken for a small one.
const permissions=require('./permissions');

const round2=value=>Math.round(value*100)/100;

function createReporting({store,sales,learning,checklists}){
 async function overview(actor,input){
  permissions.requirePermission(actor,'reporting.view');
  const [companies,locations]=await Promise.all([store.read('companies'),store.read('locations')]);
  const company=permissions.company(actor,input?.companyId,companies);
  const scoped=permissions.accessibleLocations(actor,locations).filter(location=>location.companyId===company.id&&!location.archived);
  const weekStart=input?.weekStart||null;
  const rows=[];
  for(const location of scoped){
   // The same week report the Sales page shows, so both screens always agree.
   const report=await sales.weekReport(actor,{companyId:company.id,locationId:location.id,weekStart});
   rows.push({
    locationId:location.id,locationName:location.name,weekStart:report.weekStart,
    salesCents:report.salesCents,costCents:report.costCents,profitCents:report.profitCents,marginPct:report.marginPct,
    recordedDays:report.recordedDays,complete:report.complete,pricePending:report.pricePending,
    orderCostCents:report.orderCostCents,invoiceCostCents:report.invoiceCostCents,expenseCents:report.expenseCents
   });
  }
  const ranked=[...rows].filter(row=>row.complete&&row.profitCents!==null).sort((a,b)=>(b.profitCents||0)-(a.profitCents||0));
  const position=new Map(ranked.map((row,index)=>[row.locationId,index+1]));
  const complete=rows.length>0&&rows.every(row=>row.complete);
  const totals=complete?{
   salesCents:rows.reduce((sum,row)=>sum+row.salesCents,0),
   costCents:rows.reduce((sum,row)=>sum+row.costCents,0),
   profitCents:rows.reduce((sum,row)=>sum+row.profitCents,0)
  }:null;
  if(totals)totals.marginPct=totals.salesCents>0?round2(totals.profitCents/totals.salesCents*100):null;

  const training=permissions.can(actor,'learning.report')?await learning.progress(actor,company.id):null;
  const checklistProgress=permissions.can(actor,'ops.view')?await checklists.progress(actor,company.id):null;
  return {
   company,weekStart:rows[0]?.weekStart||weekStart,
   rows:rows.map(row=>({...row,rank:position.get(row.locationId)||null})),
   totals,complete,
   training,checklists:checklistProgress
  };
 }

 return {overview};
}
module.exports={createReporting};
