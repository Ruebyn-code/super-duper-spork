// Workforce routes: roster week, shift writes, publication, the clock,
// timesheet approval, availability, leave and the employer/employment setup.
const permissions=require('./permissions');
const views=require('./views-workforce');

const monday=date=>new Date(Date.parse(date+'T00:00:00Z')-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

async function route(ctx){
 const {url,method,viewer,actor,services,html,redirect,readBody,assertCsrf,scopeFor,notice}=ctx;
 const path=url.pathname;
 if(!path.startsWith('/workforce'))return false;
 if(!permissions.can(actor,'rostering.view'))throw permissions.deny('You do not have permission to view rosters.');

 if(path==='/workforce'&&method==='GET'){
  const scope=await scopeFor(actor,url.searchParams.get('locationId'));
  if(!scope.location)return html(200,views.workforce({account:viewer,location:null,locations:scope.locations,week:{rows:[],days:[]},people:[]}));
  const location=scope.location;
  const requested=url.searchParams.get('week');
  const weekStart=validDate(requested)?monday(requested):monday(services.sales.today());
  const week=await services.workforce.week(actor,{companyId:location.companyId,locationId:location.id,weekStart});
  const [timesheetWeek,clock,availability,leave,team]=await Promise.all([
   services.workforce.timesheets(actor,{companyId:location.companyId,locationId:location.id,weekStart}),
   services.workforce.clockState(actor,location.id),
   services.workforce.availability(actor,{companyId:location.companyId,locationId:location.id}),
   services.workforce.leave(actor,{companyId:location.companyId,locationId:location.id}),
   services.workforce.workforce(actor,{companyId:location.companyId,locationId:location.id})
  ]);
  const pay=permissions.can(actor,'rostering.costs')?await services.workforce.payHistory(actor,{companyId:location.companyId,locationId:location.id}):null;
  const estimate=week.estimate?{totalCents:week.estimate.totalCents,byShift:Object.fromEntries(week.estimate.byShift)}:null;
  return html(200,views.workforce({account:viewer,location,locations:scope.locations,week:{...week,clock,canAward:permissions.can(actor,'awards.manage')},
   timesheetWeek,pay,availability,leave,people:team.people,employer:team.employer,estimate,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/workforce/shift'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.workforce.saveShift(actor,{companyId:form.companyId,locationId:form.locationId,shiftId:form.shiftId||null,
   accountId:form.accountId,date:form.date,start:form.start,end:form.end,overnight:form.overnight==='1',
   position:form.position,note:form.note});
  return redirect(`/workforce?locationId=${encodeURIComponent(form.locationId)}&week=${encodeURIComponent(form.weekStart||form.date)}&saved=shift-saved`);
 }

 if(path==='/workforce/shift/delete'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const shift=(await services.store.read('shifts')).find(item=>item.id===form.shiftId);
  if(!shift){const error=new Error('Shift not found.');error.status=404;throw error;}
  await services.workforce.deleteShift(actor,shift.id);
  return redirect(`/workforce?locationId=${encodeURIComponent(shift.locationId)}&week=${encodeURIComponent(monday(shift.date))}&saved=shift-removed`);
 }

 if(path==='/workforce/publish'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.workforce.publish(actor,{companyId:form.companyId,locationId:form.locationId,weekStart:form.weekStart});
  return redirect(`/workforce?locationId=${encodeURIComponent(form.locationId)}&week=${encodeURIComponent(form.weekStart)}&saved=roster-published`);
 }

 if(path==='/workforce/unpublish'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const publication=await services.workforce.unpublish(actor,{publicationId:form.publicationId});
  return redirect(`/workforce?locationId=${encodeURIComponent(publication.locationId)}&week=${encodeURIComponent(publication.weekStart)}&saved=roster-withdrawn`);
 }

 if(path==='/workforce/clock'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.workforce.clock(actor,{companyId:form.companyId,locationId:form.locationId,kind:form.kind});
  return redirect(`/workforce?locationId=${encodeURIComponent(form.locationId)}&saved=clocked`);
 }

 if(path==='/workforce/timesheet/approve'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.workforce.approve(actor,{companyId:form.companyId,locationId:form.locationId,weekStart:form.weekStart});
  return redirect(`/workforce?locationId=${encodeURIComponent(form.locationId)}&week=${encodeURIComponent(form.weekStart)}&saved=timesheet-approved`);
 }

 if(path==='/workforce/availability'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.workforce.saveAvailability(actor,{companyId:form.companyId,locationId:form.locationId,accountId:actor.id,name:actor.name,
   weekday:Number(form.weekday),start:form.start,end:form.end});
  return redirect(`/workforce?locationId=${encodeURIComponent(form.locationId)}&saved=availability-saved`);
 }

 if(path==='/workforce/leave'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.workforce.requestLeave(actor,{companyId:form.companyId,locationId:form.locationId,accountId:actor.id,name:actor.name,
   startDate:form.startDate,endDate:form.endDate,type:form.type,note:form.note});
  return redirect(`/workforce?locationId=${encodeURIComponent(form.locationId)}&saved=leave-requested`);
 }

 if(path==='/workforce/leave/decide'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const record=await services.workforce.decideLeave(actor,{id:form.id,decision:form.decision});
  return redirect(`/workforce?locationId=${encodeURIComponent(record.locationId)}&saved=leave-decided`);
 }

 if(path==='/workforce/employer'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const superBps=form.superBps===''?1200:Math.round(Number(form.superBps)*100);
  await services.workforce.saveEmployer(actor,{companyId:form.companyId,locationId:form.locationId,employerName:form.employerName,
   publicHolidayState:form.publicHolidayState,payPeriodAnchor:form.payPeriodAnchor,payPeriodWeeks:1,superBps,
   coverageConfirmed:form.coverageConfirmed==='1'});
  return redirect(`/workforce?locationId=${encodeURIComponent(form.locationId)}&saved=employer-saved`);
 }

 if(path==='/workforce/terms'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.workforce.saveProfile(actor,{companyId:form.companyId,locationId:form.locationId,accountId:form.accountId,
   effectiveFrom:form.effectiveFrom,dateOfBirth:form.dateOfBirth,employmentStart:form.employmentStart,
   employmentType:form.employmentType,classification:form.classification,payBasis:'award',cycleWeeks:1});
  return redirect(`/workforce?locationId=${encodeURIComponent(form.locationId)}&saved=terms-saved`);
 }

 return false;
}
module.exports={route,monday};
