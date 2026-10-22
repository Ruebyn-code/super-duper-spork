const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const sales=require('./sales'),{shift}=require('./stock-usage');
const actor={id:'person',companyId:'company',locationId:'shop'},anchor='2026-03-30',now=new Date('2026-04-03T04:00:00Z');
const monday=date=>shift(date,-(new Date(date+'T00:00:00Z').getUTCDay()+6)%7);
async function fixture(t,{current=11000,previous=10000,holiday=200000}={}){
 const dir=await fs.mkdtemp('/tmp/holiday-forecast-');t.after(()=>fs.rm(dir,{recursive:true,force:true}));const store=sales.createStore();
 const rows=new Map();for(let date='2024-01-01';date<='2026-04-04';date=shift(date,1)){const start=monday(date);if(!rows.has(start))rows.set(start,Array(7).fill(null));let value=date>'2025-04-18'?current:previous;if(date==='2024-04-21'&&current&&previous)value=Math.round(300000*previous/current);rows.get(start)[(new Date(date+'T00:00:00Z').getUTCDay()+6)%7]=value;}for(const [weekStart,days]of rows)await store.save(dir,actor,{weekStart,days,revision:0});
 async function day(date,value){const weekStart=monday(date),record=await sales.read(dir,actor,weekStart),days=[...record.days];days[(new Date(date+'T00:00:00Z').getUTCDay()+6)%7]=value;return store.save(dir,actor,{weekStart,revision:record.revision,days});}
 await day('2025-04-18',holiday);await day('2025-04-21',300000);
 const state={companies:[{companyId:'company',revision:0,enabled:false,holidayCalendars:[{locationId:'shop',year:2026,confirmed:true,dates:[{date:'2026-04-03',name:'Good Friday'},{date:'2026-04-06',name:'Easter Monday'}]},{locationId:'shop',year:2025,confirmed:true,dates:[{date:'2025-04-18',name:'Good Friday'},{date:'2025-04-21',name:'Easter Monday'}]}]}],versions:[],feed:{},profiles:[{privatePayrollValue:'never expose payroll'}],audit:[{secret:'never expose audit'}]};
 async function calendars(){await fs.writeFile(path.join(dir,'award-compliance.json'),JSON.stringify(state));}await calendars();
 return{dir,store,state,calendars,day,report:(at=now)=>store.report(dir,actor,anchor,{now:at})};
}
test('movable holiday uses last year’s matching holiday and the unrounded growth ratio, while normal days and source data stay unchanged',async t=>{
 const f=await fixture(t);await f.day('2026-04-03',230000);const source=await fs.readFile(path.join(f.dir,'location-sales/shop/2025-04-14.json'),'utf8'),report=await f.report(),day=report.projection.dailyProjections[4];
 assert.equal(day.amountCents,220000);assert.equal(day.holiday.previousDate,'2025-04-18');assert.equal(day.holiday.growthPercent,10);assert.equal(day.holiday.comparisonDays,349);assert.equal(report.projection.projectedSalesCents,286000);assert.equal(report.projection.budgetCents,80080);assert.equal(report.projection.performance.expectedCents,264000);assert.equal(report.projection.performance.differenceCents,10000);
 assert.deepEqual(report.projection.dailyProjections.filter((_,i)=>i!==4).map(day=>day.amountCents),Array(6).fill(11000));assert.equal(await fs.readFile(path.join(f.dir,'location-sales/shop/2025-04-14.json'),'utf8'),source);assert.ok(!JSON.stringify(report).includes('privatePayrollValue'));assert.ok(!JSON.stringify(report).includes('never expose'));
});
test('negative growth and zero holiday revenue remain valid projections',async t=>{
 const f=await fixture(t,{current:9000});let report=await f.report();assert.equal(report.projection.dailyProjections[4].amountCents,180000);assert.equal(report.projection.dailyProjections[4].holiday.growthPercent,-10);
 await f.day('2025-04-18',0);report=await f.report();assert.equal(report.projection.dailyProjections[4].amountCents,0);assert.equal(report.projection.projectedSalesCents,54000);
});
test('a total sales increase of 20 percent adds exactly 20 percent to last year’s holiday',async t=>{
 const f=await fixture(t,{current:12000});const report=await f.report(),day=report.projection.dailyProjections[4];assert.equal(day.holiday.growthPercent,20);assert.equal(day.amountCents,240000);assert.equal(report.projection.projectedSalesCents,312000);assert.equal(report.projection.budgetCents,87360);
 await f.day('2026-04-03',9000000);await f.day('2026-04-04',8000000);assert.equal((await f.report()).projection.dailyProjections[4].amountCents,240000);
});
test('automatic state calendars feed holiday forecasts without annual manual entries or payroll confirmation',async t=>{
 const f=await fixture(t,{current:12000});f.state.companies[0].holidayCalendars=[];await fs.writeFile(path.join(f.dir,'locations.json'),JSON.stringify([{id:'shop',companyId:'company',publicHolidayState:'VIC'}]));await f.calendars();const file=path.join(f.dir,'award-compliance.json'),before=await fs.readFile(file,'utf8'),report=await f.report();assert.equal(report.projection.dailyProjections[4].amountCents,240000);assert.equal(report.projection.dailyProjections[4].holiday.growthPercent,20);assert.equal(await fs.readFile(file,'utf8'),before);assert.deepEqual(f.state.companies[0].holidayCalendars,[]);await fs.rm(file);assert.equal((await f.report()).projection.dailyProjections[4].amountCents,240000);await assert.rejects(fs.readFile(file),{code:'ENOENT'});await fs.writeFile(path.join(f.dir,'locations.json'),JSON.stringify([{id:'shop',companyId:'other-company',publicHolidayState:'VIC'}]));assert.equal((await f.report()).projection.dailyProjections[4].holiday,undefined);
});
test('unrounded year-on-year ratios round the final holiday amount to cents',async t=>{
 const f=await fixture(t,{current:10001,previous:30000,holiday:123456});const day=(await f.report()).projection.dailyProjections[4];assert.equal(day.amountCents,41156);assert.equal(day.holiday.growthPercent,-66.66);
});
test('growth uses total sales since the previous holiday, including dates before January and outside the recent four weeks',async t=>{
 const f=await fixture(t);await f.day('2025-06-15',20000);f.state.companies[0].holidayCalendars[1].dates.push({date:'2025-06-15',name:'Regional holiday'});await f.calendars();const day=(await f.report()).projection.dailyProjections[4];assert.equal(day.amountCents,Math.round(200000*(349*11000+300000-11000+9000)/(349*10000+Math.round(300000/1.1)-10000)));assert.equal(day.holiday.comparisonDays,349);assert.equal(day.holiday.comparison.fromDate,'2025-04-19');assert.equal(day.holiday.comparison.throughDate,'2026-04-02');
});
test('missing history, unreviewed or ambiguous matches, and a zero comparison denominator use explicit four-week fallbacks',async t=>{
 for(const scenario of ['missing-holiday','missing-comparison','unreviewed','ambiguous','zero-denominator'])await t.test(scenario,async t=>{
  const f=await fixture(t,{previous:scenario==='zero-denominator'?0:10000});
  if(scenario==='missing-holiday')await f.day('2025-04-18',null);
  if(scenario==='missing-comparison')await f.day('2025-01-15',null);
  if(scenario==='unreviewed')f.state.companies[0].holidayCalendars[1].confirmed=false;
  if(scenario==='ambiguous')f.state.companies[0].holidayCalendars[1].dates.push({date:'2025-04-19',name:'Good Friday'});
  await f.calendars();const report=await f.report(),day=report.projection.dailyProjections[4];assert.equal(day.amountCents,11000);assert.equal(day.holiday.status,'fallback');assert.ok(day.holiday.reason);assert.equal(report.projection.projectedSalesCents,77000);
 });
});
test('weekly-report revenue takes precedence for the prior holiday without exposing costs or changing source records',async t=>{
 const f=await fixture(t),folder=path.join(f.dir,'weekly-sales-reports/shop');await fs.mkdir(folder,{recursive:true});const report={weekStart:'2025-04-14',locationId:'shop',companyId:'company',breakdown:{tillSales:Array(7).fill(null),uberEats:Array(7).fill(null),doorDash:Array(7).fill(null)},costs:{private:'costs stay private'}};for(const key of ['tillSales','uberEats','doorDash'])report.breakdown[key][4]=key==='tillSales'?300000:0;
 const file=path.join(folder,'2025-04-14.json'),original=JSON.stringify(report);await fs.writeFile(file,original);const projected=await f.report();assert.equal(projected.projection.dailyProjections[4].amountCents,330000);assert.ok(!JSON.stringify(projected).includes('costs stay private'));assert.equal(await fs.readFile(file,'utf8'),original);
});
test('Sunday ordering and future rosters apply holidays to the actual target dates with the same completed history',async t=>{
 const f=await fixture(t),report=await f.report(new Date('2026-04-05T05:00:00Z'));assert.equal(report.projection.dailyProjections[4].amountCents,220000);assert.equal(report.orderingProjection.weekStart,'2026-04-06');assert.equal(report.orderingProjection.dailyProjections[0].amountCents,330000);assert.equal(report.orderingProjection.projectedSalesCents,396000);assert.equal(report.orderingProjection.budgetCents,110880);
 const roster=await sales.rosterProjection(f.dir,actor,'2026-04-06',{now:new Date('2026-04-05T05:00:00Z')});assert.equal(roster.projectedSalesCents,report.orderingProjection.projectedSalesCents);assert.equal(roster.daily[0].salesCents,330000);
 const historical=await sales.rosterProjection(f.dir,actor,anchor,{now:new Date('2026-05-20T00:00:00Z')});assert.equal(historical.daily[4].salesCents,220000);assert.equal(historical.history[0].weekStart,'2026-03-23');
});
test('unreviewed current calendars and other company/location calendars never change a forecast',async t=>{
 const f=await fixture(t);f.state.companies[0].holidayCalendars[0].confirmed=false;await f.calendars();let report=await f.report();assert.equal(report.projection.projectedSalesCents,77000);assert.equal(report.projection.dailyProjections[4].holiday,undefined);
 f.state.companies[0].holidayCalendars[0].confirmed=true;f.state.companies[0].companyId='other';await f.calendars();report=await f.report();assert.equal(report.projection.projectedSalesCents,77000);f.state.companies[0].companyId='company';for(const calendar of f.state.companies[0].holidayCalendars)calendar.locationId='other';await f.calendars();assert.equal((await f.report()).projection.projectedSalesCents,77000);
});
test('holiday-to-holiday growth handles leap days and New Year boundaries',async t=>{
 const {adjustments}=require('./holiday-projections'),dir=await fs.mkdtemp('/tmp/holiday-calendar-');t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 for(const scenario of [
  {asOf:'2024-03-01',anchor:'2024-02-26',week:'2024-03-04',target:'2024-03-04',previous:'2023-03-06',name:'Local holiday',from:'2023-03-07',comparisonDays:359},
  {asOf:'2027-01-01',anchor:'2026-12-28',week:'2026-12-28',target:'2027-01-01',previous:'2026-01-01',name:'New Year’s Day',from:'2026-01-02',comparisonDays:364}
 ]){
  await fs.writeFile(path.join(dir,'award-compliance.json'),JSON.stringify({companies:[{companyId:'company',holidayCalendars:[{locationId:'shop',year:Number(scenario.target.slice(0,4)),confirmed:true,dates:[{date:scenario.target,name:scenario.name}]},{locationId:'shop',year:Number(scenario.previous.slice(0,4)),confirmed:true,dates:[{date:scenario.previous,name:scenario.name}]}]}]}));
  const readRevenue=async starts=>starts.map(weekStart=>({weekStart,days:Array.from({length:7},(_,index)=>{const date=shift(weekStart,index);if(date===scenario.previous)return 200000;if(date.endsWith('02-29'))return 90000000;return date>=scenario.from?12000:10000;})}));
  const changes=await adjustments(dir,actor,{weekStarts:[scenario.week],anchor:scenario.anchor,asOf:scenario.asOf,readRevenue}),holiday=changes[scenario.target];assert.equal(holiday.growthPercent,20);assert.equal(holiday.comparisonDays,scenario.comparisonDays);assert.equal(holiday.amountCents,240000);assert.equal(holiday.comparison.fromDate,scenario.from);
 }
});
test('Sales and roster APIs share the holiday forecast while projection viewers cannot read award or finance data',async t=>{
 const f=await fixture(t,{current:12000}),{saveAdmin}=require('./auth'),{createServer}=require('./server');await saveAdmin(f.dir,'Office','holiday-api-test-password');const server=createServer(f.dir,{salesNow:()=>now.valueOf(),rosteringNow:()=>now.valueOf()});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const base='http://127.0.0.1:'+server.address().port;
 async function login(username){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'holiday-api-test-password'})});assert.equal(response.status,200);const headers={Cookie:response.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'},session=await(await fetch(base+'/api/session',{headers})).json();headers['X-CSRF-Token']=session.csrf;return{headers,session};}
 async function request(who,url,method='GET',body,extra={}){const response=await fetch(base+url,{method,headers:{...who.headers,...extra},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json()};}
 const office=await login('Office'),locationId=office.session.locationId,source=path.join(f.dir,'location-sales/shop'),target=path.join(f.dir,'location-sales',locationId);await fs.rename(source,target);
 for(const file of await fs.readdir(target)){const record=JSON.parse(await fs.readFile(path.join(target,file),'utf8'));record.locationId=locationId;record.accountId=office.session.id;await fs.writeFile(path.join(target,file),JSON.stringify(record));}
 f.state.companies[0].companyId=office.session.companyId;for(const calendar of f.state.companies[0].holidayCalendars)calendar.locationId=locationId;await f.calendars();
 const projected=await request(office,'/api/sales');assert.equal(projected.status,200);assert.equal(projected.data.projection.projectedSalesCents,312000);const dashboard=await request(office,'/api/rostering/dashboard?week='+anchor);assert.equal(dashboard.status,200,JSON.stringify(dashboard.data));assert.equal(dashboard.data.summary.projection.projectedSalesCents,312000);
 const levels=(await request(office,'/api/permission-levels')).data,roles=(await request(office,'/api/permission-levels','POST',{revision:levels.revision,scope:'company',name:'Holiday projection reader',level:10,permissions:['home.view','sales.view']})).data,role=roles.levels.find(item=>item.name==='Holiday projection reader');
 assert.equal((await request(office,'/api/accounts','POST',{username:'Viewer',password:'holiday-api-test-password',companyId:office.session.companyId,roleScope:'company',role:role.id,locationId,locationIds:[locationId]})).status,201);const viewer=await login('Viewer'),visible=await request(viewer,'/api/sales');assert.equal(visible.status,200);assert.equal(visible.data.projection.dailyProjections[4].amountCents,240000);assert.equal((await request(viewer,'/api/awards')).status,403);assert.equal((await request(viewer,'/api/weekly-sales-reports')).status,403);assert.ok(!JSON.stringify(visible.data).includes('never expose'));
 const other=(await request(office,'/api/locations','POST',{name:'Other shop'})).data;assert.equal((await request(viewer,'/api/sales','GET',undefined,{'X-Location-Id':other.id})).status,403);assert.equal((await request(office,'/api/sales','GET',undefined,{'X-Location-Id':other.id})).data.projection.projectedSalesCents,null);
});
