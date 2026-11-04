// Head Office all-stores daily/weekly sales against the shared projection outlook.
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const{fixture}=require('./test-support/roster-hourly-fixture.cjs'),M=require('./public/home-board-model'),boards=require('./home-board');
async function setup(t){const a=await fixture({seed:false});t.after(()=>a.close());await a.api(a.office,'/api/locations/'+a.location,'PUT',{name:'Delta'});a.hq=await a.api(a.office,'/api/locations/head-office','POST',{});a.headers={'X-Location-Id':a.hq.id};a.read=(query='')=>a.api(a.office,'/api/home-insights?topics=daily-outlook,weekly-outlook'+query,'GET',undefined,a.headers);a.save=(id,days,weekStart='2026-10-19')=>a.api(a.office,'/api/sales','PUT',{weekStart,revision:0,days},{'X-Location-Id':id});a.shop=name=>a.api(a.office,'/api/locations','POST',{name,companyId:a.office.session.companyId});return a;}
test('daily and weekly outlooks compare saved sales with each store’s projection and total all stores',async t=>{
 const a=await setup(t),alpha=await a.shop('Alpha'),fresh=await a.shop('Fresh');
 for(const id of [a.location,alpha.id])for(const week of ['2026-09-21','2026-09-28','2026-10-05','2026-10-12'])await a.save(id,[1000,1000,1000,1000,1000,2000,2000],week);
 await a.save(a.location,[1100,900,1000,null,1200,null,null]);await a.save(alpha.id,[1000,1000,1000,1000,null,null,null]);await a.save(fresh.id,[500,null,null,null,700,null,null]);
 const projection=await a.api(a.office,'/api/sales?week=2026-10-19','GET',undefined,{'X-Location-Id':a.location}),expected=projection.dailyProjection.days;assert(expected.every(Number.isSafeInteger));
 const result=await a.read(),daily=result.outlook.daily,weekly=result.outlook.weekly,by=(list,name)=>list.entries.find(e=>e.name===name);
 assert.equal(daily.date,'2026-10-23');const delta=by(daily,'Delta');assert.deepEqual([delta.salesCents,delta.projectedCents,delta.varianceCents],[1200,expected[4],1200-expected[4]],'daily outlook reuses the Daily sales projection');
 assert.equal(by(daily,'Alpha').salesCents,null);assert.equal(by(daily,'Alpha').varianceCents,null,'unrecorded days have no difference');assert.equal(by(daily,'Fresh').projectedCents,null,'stores without history have no invented outlook');
 assert.equal(daily.totals.salesCents,1900);assert.equal(daily.totals.salesCentsStores,2);assert.equal(daily.totals.varianceCents,1200-expected[4],'the all-stores difference only uses stores with both figures');
 const week=by(weekly,'Delta');assert.equal(weekly.throughDate,'2026-10-23');assert.equal(week.salesCents,4200);assert.equal(week.recordedDays,4);assert.equal(week.elapsedDays,5);
 assert.equal(week.comparableCents,expected[0]+expected[1]+expected[2]+expected[4]);assert.equal(week.varianceCents,4200-week.comparableCents);assert.equal(week.projectedCents,expected.reduce((n,v)=>n+v,0));assert.equal(week.expectedCents,4200+expected[3]+expected[5]+expected[6]);
 assert.equal(by(weekly,'Fresh').projectedCents,null);assert.equal(by(weekly,'Fresh').expectedCents,null);assert.equal(weekly.totals.salesCents,4200+4000+1200);assert.equal(weekly.totals.projectedCentsStores,2);
 assert(!result.outlook.daily.entries.some(e=>e.id===a.hq.id),'the administrative Head Office is excluded');assert(!JSON.stringify(result).includes('outlookSource'));
 assert.equal((await a.read('&location='+alpha.id)).outlook.weekly.entries.length,1);
 assert.equal((await a.read('&leaderboardDate=2026-10-19')).outlook.daily.entries.find(e=>e.name==='Delta').salesCents,1100,'the date picker chooses the daily outlook day');
});
test('the previous Head Office default upgrades to include the outlook sections without writing, while custom layouts stay',async t=>{
 const a=await setup(t),file=path.join(a.dir,'home-dashboard-head-office.json'),saved=JSON.stringify({revision:4,sections:M.previousHeadOfficeDefaults()});await fs.writeFile(file,saved);
 const read=await boards.read(a.dir,'head-office');assert.deepEqual(read.sections.map(s=>s.type).slice(0,4),['business-kpis','business-daily-outlook','business-leaderboard','business-weekly-outlook']);assert.equal(read.revision,4);assert.equal(await fs.readFile(file,'utf8'),saved);
 const custom=M.previousHeadOfficeDefaults().slice(1);await fs.writeFile(file,JSON.stringify({revision:5,sections:custom}));assert(!(await boards.read(a.dir,'head-office')).sections.some(s=>s.type==='business-daily-outlook'));
 assert.equal(M.types['business-weekly-outlook'].group,'Head Office');assert.equal(M.allowedType('manager','business-daily-outlook'),false);
});
