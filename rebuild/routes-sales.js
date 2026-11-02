// Sales routes: weekly entry, weekly-report import, hourly sales, expenses and
// budgets. Every write resolves its company/location through the services'
// own access checks; the route only parses the form.
const permissions=require('./permissions');
const views=require('./views-sales');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const cents=value=>{
 const clean=String(value??'').replace(/[$,\s]/g,'');
 if(!clean)return null;
 const number=Number(clean);
 return Number.isFinite(number)&&number>=0?Math.round(number*100):NaN;
};
const monday=date=>new Date(Date.parse(date+'T00:00:00Z')-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

async function route(ctx){
 const {url,method,viewer,actor,services,html,redirect,readBody,assertCsrf,scopeFor,notice}=ctx;
 const path=url.pathname;
 if(!path.startsWith('/sales'))return false;
 if(!permissions.can(actor,'sales.view'))throw permissions.deny('You do not have permission to view sales.');

 if(path==='/sales'&&method==='GET'){
  const scope=await scopeFor(actor,url.searchParams.get('locationId'));
  if(!scope.location)return html(200,views.sales({account:viewer,location:null,locations:scope.locations,weeks:[],record:{days:Array(7).fill(null),sources:[]},weekStart:services.sales.today()}));
  const location=scope.location;
  const weeks=await services.sales.listWeeks(actor,location.id);
  const requested=url.searchParams.get('week');
  const weekStart=validDate(requested)?monday(requested):monday(services.sales.today());
  const record=weeks.find(week=>week.weekStart===weekStart)||{weekStart,days:Array(7).fill(null),sources:[],revision:0};
  if(!weeks.some(week=>week.weekStart===weekStart))weeks.unshift(record);
  const forecast=await services.sales.forecast(actor,{companyId:location.companyId,locationId:location.id,weekStart});
  const hourlyRow=await services.sales.hourlyDay(actor,location.id,forecast.hourly.date);
  const report=permissions.can(actor,'reporting.view')?await services.sales.weekReport(actor,{companyId:location.companyId,locationId:location.id,weekStart}):null;
  const budget=(await services.store.read('budgets')).find(item=>item.locationId===location.id&&item.weekStart===weekStart)||report?.budget||null;
  return html(200,views.sales({account:viewer,location,locations:scope.locations,weekStart,weeks,record,
   projection:forecast.projection,hourly:{...hourlyRow,date:forecast.hourly.date,forecast:forecast.hourly.forecast},report,budget,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/sales/week'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const days=Array.from({length:7},(_,index)=>cents(form['day'+index]));
  if(days.some(value=>Number.isNaN(value)))fail('Enter daily sales as non-negative dollars, or leave a day blank.');
  await services.sales.saveWeek(actor,{companyId:form.companyId,locationId:form.locationId,weekStart:form.weekStart,days,revision:Number(form.revision)});
  return redirect(`/sales?locationId=${encodeURIComponent(form.locationId)}&week=${encodeURIComponent(form.weekStart)}&saved=week-saved`);
 }

 if(path==='/sales/import'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const result=await services.sales.importReport(actor,{companyId:form.companyId,locationId:form.locationId,csv:form.csv,sourceName:form.sourceName});
  return redirect(`/sales?locationId=${encodeURIComponent(form.locationId)}&week=${encodeURIComponent(result.report.weekStart)}&saved=report-imported`);
 }

 if(path==='/sales/hourly'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const hours=Array.from({length:24},(_,index)=>cents(form['hour'+index]));
  if(hours.some(value=>Number.isNaN(value)))fail('Enter hourly sales as non-negative dollars, or leave an hour blank.');
  await services.sales.saveHourly(actor,{companyId:form.companyId,locationId:form.locationId,date:form.date,hours,revision:Number(form.revision)});
  return redirect(`/sales?locationId=${encodeURIComponent(form.locationId)}&saved=hourly-saved`);
 }

 if(path==='/sales/expense'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const amountCents=cents(form.amountCents);
  if(!Number.isSafeInteger(amountCents)||amountCents<=0)fail('Enter an expense above zero.');
  await services.sales.saveExpense(actor,{companyId:form.companyId,locationId:form.locationId,date:form.date,type:form.type,description:form.description,amountCents});
  return redirect(`/sales?locationId=${encodeURIComponent(form.locationId)}&saved=expense-added`);
 }

 if(path==='/sales/budget'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const salesCents=cents(form.salesCents),labourCents=cents(form.labourCents);
  if(Number.isNaN(salesCents)||Number.isNaN(labourCents))fail('Enter budgets as non-negative dollars, or leave them blank.');
  await services.sales.saveBudget(actor,{companyId:form.companyId,locationId:form.locationId,weekStart:form.weekStart,salesCents,labourCents});
  return redirect(`/sales?locationId=${encodeURIComponent(form.locationId)}&week=${encodeURIComponent(form.weekStart)}&saved=budget-saved`);
 }

 return false;
}
module.exports={route,cents,monday};
