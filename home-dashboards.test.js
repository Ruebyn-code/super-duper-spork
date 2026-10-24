const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture,password,week,tradingHours}=require('./test-support/roster-hourly-fixture.cjs'),M=require('./public/home-board-model'),P=require('./permissions'),ops=require('./home-operations'),store=require('./home-board');
async function setup(t,options){const app=await fixture(options);t.after(()=>app.close());return app;}
async function role(app,name,permissions,homeDashboard='staff',id){const current=await app.api(app.office,'/api/permission-levels');const result=await app.api(app.office,'/api/permission-levels'+(id?'/'+id:''),id?'PUT':'POST',{revision:current.revision,name,level:10,scope:'company',permissions,...(homeDashboard===undefined?{}:{homeDashboard})});return result.levels.find(r=>r.name===name);}
async function user(app,name,roleId){await app.api(app.office,'/api/accounts','POST',{username:name,password,role:roleId,companyId:app.office.session.companyId,locationId:app.location});return app.login(name);}
const get=(app,actor=app.office,headers)=>app.api(actor,'/api/home-operations','GET',undefined,headers);
const budget=(app,scope,mode,value,revision=0)=>app.api(app.office,'/api/rostering/budget','PUT',{scope,mode,value,revision});

test('Staff profile defaults and validation exclude sales without changing ordinary permissions; board revisions are independent',async t=>{
 const app=await setup(t,{seed:false}),permissions=['home.view','sales.view','sales.edit','appearance.manage'],staffRole=await role(app,'Staff Home',permissions),staff=await user(app,'Staff dashboard',staffRole.id);
 assert.equal(staff.session.homeDashboard,'staff');assert.deepEqual(staff.session.permissions,permissions);assert.equal((await app.request(staff,'/api/sales')).status,200);
 for(const url of ['/api/home-totals','/api/home-daily-sales','/api/home-operations','/api/home-dashboard?dashboard=manager'])assert.equal((await app.request(staff,url)).status,403,url);
 assert.equal((await app.request(staff,'/api/home-daily-sales','PUT',{})).status,403);
 const original=await app.api(app.office,'/api/home-dashboard'),staffBoard=await app.api(staff,'/api/home-dashboard');assert.deepEqual(staffBoard.sections,M.defaults('staff'));
 for(const type of ['quarter-totals','sales-progress','finance','ordering-budget']){assert.equal(M.visible(staff.session,{type}),false);assert.equal((await app.request(staff,'/api/home-dashboard','PUT',{revision:0,sections:[{id:'bad',type,size:'full'}]})).status,400);}
 for(const target of ['sales','weekly-report','reporting','projections','cogs','labour']){assert.equal(M.allowedLink(staff.session,target),false);assert.equal((await app.request(staff,'/api/home-dashboard','PUT',{revision:0,sections:[{id:'bad',type:'module',size:'full',target}]})).status,400);}
 const input={revision:0,sections:[{id:'our-staff',type:'quick-links',size:'full',links:['roster','comms']}]};assert.equal((await app.api(staff,'/api/home-dashboard','PUT',input)).revision,1);assert.deepEqual(await app.api(app.office,'/api/home-dashboard'),original);assert.deepEqual((await app.api(app.office,'/api/home-dashboard?dashboard=staff')).sections,input.sections);
 assert.equal((await app.request(staff,'/api/home-dashboard','PUT',input)).status,409);assert.equal((await app.request(staff,'/api/home-dashboard?dashboard=../../escape')).status,400);
 const html=await fetch(app.base+'/home?__opstack_content=1',{headers:staff.headers});assert.match(await html.text(),/data-home-dashboard="staff"/);
 assert.deepEqual(P.keys.includes('home.dashboard'),false);assert.equal((await app.api(app.office,'/api/session')).homeDashboard,'manager');
 const meta=await app.api(app.office,'/api/permission-levels'),saved=meta.levels.find(r=>r.id===staffRole.id);await app.api(app.office,'/api/permission-levels/'+saved.id,'PUT',{revision:meta.revision,scope:'company',name:'Staff retained',level:10,permissions});assert.equal((await app.api(staff,'/api/session')).homeDashboard,'staff');
 const revision=(await app.api(app.office,'/api/permission-levels')).revision;for(const value of ['supervisor',null,{},['staff']])assert.equal((await app.request(app.office,'/api/permission-levels','POST',{revision,scope:'company',name:'Bad dashboard',level:1,permissions:['home.view'],homeDashboard:value})).status,400);
 assert.equal(app.calls(),0);
});

test('Manager summary shows exact current/cumulative forecasts, inherited labour budgets, and no payroll or import data',async t=>{
 const app=await setup(t);app.setTime('2026-10-23T02:30:00Z');await budget(app,'network','percent',3000);
 const hourFile=path.join(app.dir,'hourly-sales',app.location+'.json'),before=await fs.readFile(hourFile,'utf8'),rosterBefore=await fs.readFile(path.join(app.dir,'rostering.json'),'utf8');
 const summary=await get(app);assert.equal(summary.day.salesCents,12500);assert.equal(summary.day.labourCents,3750);assert.equal(summary.current.hour,13);assert.equal(summary.current.salesCents,0);assert.equal(summary.current.throughSalesCents,3125);assert.equal(summary.current.throughLabourCents,937);assert.deepEqual(summary.rows.map(r=>r.hour),[11,12,13]);assert.equal(summary.rosterHref,'/rostering#roster');
 for(const text of ['private-source','updatedBy','rateCents','scopeId','budgets','imports','userId'])assert(!JSON.stringify(summary).includes(text),text);assert.equal(await fs.readFile(hourFile,'utf8'),before);assert.equal(await fs.readFile(path.join(app.dir,'rostering.json'),'utf8'),rosterBefore);
 await budget(app,'company','fixed',70000);assert.equal((await get(app)).day.labourCents,10000);await budget(app,'location','percent',2000);assert.equal((await get(app)).day.labourCents,2500);
 // Read-only supervisors need Home and sales view; no roster management, payroll, or budget-write permissions are granted.
 const supervisor=await user(app,'Supervisor', (await role(app,'Supervisor',['home.view','sales.view'],'manager')).id);assert.equal((await get(app,supervisor)).rosterHref,null);assert.equal((await app.request(supervisor,'/api/rostering/dashboard')).status,403);assert.equal((await app.request(supervisor,'/api/rostering/budget','PUT',{scope:'location',mode:'fixed',value:1,revision:1})).status,403);
 const viewerRole=await role(app,'Home only',['home.view'],'manager'),viewer=await user(app,'Home viewer',viewerRole.id);assert.equal((await app.request(viewer,'/api/home-operations')).status,403);assert.equal((await app.request(null,'/api/home-operations')).status,401);
 const other=await app.api(app.office,'/api/locations','POST',{name:'Other store'});assert.equal((await app.request(supervisor,'/api/home-operations','GET',undefined,{'X-Location-Id':other.id})).status,403);assert.equal((await get(app,app.office,{'X-Location-Id':other.id})).day.salesCents,null);
 await app.api(app.office,'/api/communications/posts','POST',{title:'Required reading',body:'Read this first.',scope:'company',requireRead:true});assert.equal((await app.request(supervisor,'/api/home-operations')).status,428);assert.equal(app.calls(),0);
});

test('Manager forecasts roll over at close and retain the prior trading date after midnight, with missing data distinct from zero',async t=>{
 const app=await setup(t);await budget(app,'location','percent',3000);app.setTime('2026-10-23T14:30:00Z');let summary=await get(app);assert.equal(summary.date,'2026-10-23');assert.equal(summary.calendarDate,'2026-10-24');assert.equal(summary.current.hour,1);assert.equal(summary.current.dayOffset,1);assert.equal(summary.current.salesCents,1875);assert.equal(summary.current.throughSalesCents,12500);assert.equal(summary.current.throughLabourCents,3750);assert.equal(summary.rows.at(-1).dayOffset,1);
 app.setTime('2026-10-23T17:00:00Z');summary=await get(app);assert.equal(summary.date,'2026-10-24');assert.equal(summary.state,'closed');assert.equal(summary.current.salesCents,null);assert.equal(summary.current.throughSalesCents,null);assert.deepEqual(summary.rows,[]);
 const partial=await setup(t,{partialDate:'2026-10-16'});await budget(partial,'location','percent',3000);summary=await get(partial);assert.equal(summary.day.salesCents,12500);assert.equal(summary.day.labourCents,3750);assert.equal(summary.current.salesCents,null);assert.match(summary.salesReason,/complete hourly/);
 const zero=await setup(t,{zero:true});await budget(zero,'location','fixed',0);summary=await get(zero);assert.deepEqual(summary.day,{salesCents:0,labourCents:0});assert.equal(summary.current.salesCents,0);assert.equal(summary.current.throughLabourCents,0);await budget(zero,'location','fixed',100,1);assert.equal((await get(zero)).day.labourCents,null);
});

test('company dashboard overrides and live role changes preserve ordinary access and cannot be bypassed using a profile query',async t=>{
 const app=await setup(t,{seed:false}),company=await app.api(app.office,'/api/companies','POST',{name:'Other company',locationName:'Other location'}),other=(await app.api(app.office,'/api/locations?all=true')).find(l=>l.companyId===company.id);await app.api(app.office,'/api/accounts','POST',{username:'Shared',password,role:'user',companyId:app.office.session.companyId,locationId:app.location,locationIds:[app.location,other.id]});const actor=await app.login('Shared');assert.equal(actor.session.homeDashboard,'manager');
 await role(app,'Local Staff',['home.view','sales.view'],'staff','user');assert.equal((await app.api(actor,'/api/session')).homeDashboard,'staff');assert.equal((await app.api(actor,'/api/session','GET',undefined,{'X-Location-Id':other.id})).homeDashboard,'manager');assert.equal((await app.request(actor,'/api/home-operations?dashboard=manager')).status,403);assert.equal((await app.request(actor,'/api/sales')).status,200);
 await role(app,'Local Manager',['home.view','sales.view'],'manager','user');assert.equal((await app.api(actor,'/api/session')).homeDashboard,'manager');assert.equal((await app.request(actor,'/api/home-operations')).status,200);
 const board=await store.read(app.dir,'staff');assert.equal(board.revision,0);assert.equal(app.calls(),0);
});

test('hourly holiday forecasts reuse growth-adjusted days and allocate every labour cent',()=>{
 const actor={homeDashboard:'manager',permissions:['home.view','sales.view']},location={name:'Store',tradingHours},daily=Array.from({length:7},(_,i)=>({date:'2026-10-'+String(19+i),salesCents:10001}));
 const projection={daily,history:[],weekStart:week};daily[4].holiday={status:'adjusted',previousDate:'2025-10-24',growthPercent:20};daily[4].salesCents=240001;
 const hourly={days:{'2025-10-24':{hours:Array.from({length:24},(_,h)=>h===11?1:h===18?2:h===1?3:0)}}},summary=ops.calculate(actor,{location,now:'2026-10-23T14:30:00Z',projection,hourly,budget:{mode:'percent',value:3333}});
 assert.equal(summary.forecastMethod,'holiday');assert.equal(summary.day.salesCents,240001);assert.equal(summary.day.labourCents,79992);assert.equal(summary.current.throughSalesCents,240001);assert.equal(summary.current.throughLabourCents,79992);assert.equal(summary.rows.reduce((sum,row)=>sum+row.salesCents,0),240001);assert.equal(summary.rows.reduce((sum,row)=>sum+row.labourCents,0),79992);
 for(const now of ['2026-10-03T15:59:00Z','2026-10-03T16:01:00Z','2026-04-04T15:59:00Z','2026-04-04T16:01:00Z']){const ctx=ops.context(location,now);assert.equal(ctx.status.state,'open');assert(ctx.date<ctx.calendarDate);assert([1,2,3].includes(ctx.hour));}
 assert.throws(()=>ops.calculate({...actor,homeDashboard:'staff'},{location,projection,hourly,budget:null}),e=>e.status===403);
});
