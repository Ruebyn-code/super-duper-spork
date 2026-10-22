const {fetchWithSetupSnooze:fetch}=require('./test-support/location-setup-snooze.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {createServer}=require('./server'),{saveAdmin}=require('./auth');
async function fixture(t){
 const dir=await fs.mkdtemp('/tmp/holiday-markers-');await saveAdmin(dir,'Office','holiday-marker-test-password');
 const server=createServer(dir);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});});const base='http://127.0.0.1:'+server.address().port;
 async function request(actor,url,method='GET',body,extra={}){const response=await fetch(base+url,{method,headers:{...actor?.headers,...extra},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json()};}
 async function login(username){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'holiday-marker-test-password'})});assert.equal(response.status,200);const headers={Cookie:response.headers.get('set-cookie').split(';')[0],'Content-Type':'application/json'},session=(await request({headers},'/api/session')).data;headers['X-CSRF-Token']=session.csrf;return{headers,session};}
 const office=await login('Office'),shop=(await request(office,'/api/locations','POST',{name:'Victoria',publicHolidayState:'VIC'})).data,other=(await request(office,'/api/locations','POST',{name:'New South Wales',publicHolidayState:'NSW'})).data;
 assert.equal((await request(office,'/api/accounts','POST',{username:'Staff',password:'holiday-marker-test-password',role:'user',locationId:shop.id})).status,201);
 return{dir,request,login,office,shop,other,staff:await login('Staff')};
}
test('public holiday markers expose only selected-location dates with view permission and need no sales history',async t=>{
 const f=await fixture(t),route='/api/public-holidays?year=2026',get=(actor,extra)=>f.request(actor,route,'GET',undefined,extra);
 assert.equal((await get(null)).status,401);assert.equal((await f.request(f.staff,'/api/awards')).status,403);
 const before=await fs.readFile(path.join(f.dir,'locations.json'),'utf8'),result=await get(f.staff);assert.equal(result.status,200);assert.deepEqual(Object.keys(result.data).sort(),['dates','locationId','year']);assert.equal(result.data.locationId,f.shop.id);
 assert.ok(result.data.dates.some(day=>day.date==='2026-04-03'&&day.name==='Good Friday'));assert.ok(result.data.dates.some(day=>day.date==='2026-03-09'&&day.name==='Labour Day'));for(const day of result.data.dates)assert.deepEqual(Object.keys(day).sort(),['date','end','name','start']);
 assert.equal((await get(f.staff,{'X-Location-Id':f.other.id})).status,403);assert.equal((await f.request(f.staff,route+'&locationId='+f.other.id)).data.locationId,f.shop.id);
 const nsw=await get(f.office,{'X-Location-Id':f.other.id});assert.ok(nsw.data.dates.some(day=>day.date==='2026-10-05'&&day.name==='Labour Day'));assert.ok(!nsw.data.dates.some(day=>day.date==='2026-03-09'));
 assert.equal(await fs.readFile(path.join(f.dir,'locations.json'),'utf8'),before);await assert.rejects(fs.readFile(path.join(f.dir,'award-compliance.json')),{code:'ENOENT'});await assert.rejects(fs.access(path.join(f.dir,'location-sales')),{code:'ENOENT'});
 for(const year of ['','1999','2101','2026.0','bad'])assert.equal((await f.request(f.staff,'/api/public-holidays?year='+year)).status,400);assert.equal((await f.request(f.staff,route,'PUT',{})).status,405);
 const catalogue=(await f.request(f.office,'/api/permission-levels')).data,created=await f.request(f.office,'/api/permission-levels','POST',{name:'Ordering only',scope:'company',level:5,permissions:['orders.view'],revision:catalogue.revision});assert.equal(created.status,201);const role=created.data.levels.find(role=>role.name==='Ordering only');assert.equal((await f.request(f.office,'/api/accounts','POST',{username:'Restricted',password:'holiday-marker-test-password',role:role.id,companyId:'default',locationId:f.shop.id})).status,201);assert.equal((await get(await f.login('Restricted'))).status,403);
});
test('holiday marker dates follow reviewed local overrides and part-day periods without returning payroll review data',async t=>{
 const f=await fixture(t),route='/api/public-holidays?year=2026',calendarRoute='/api/awards/calendar',dates=[{date:'2026-04-03',name:'Regional Easter holiday',start:'12:00',end:'24:00'}];
 let config=(await f.request(f.office,'/api/awards')).data.config;assert.equal((await f.request(f.office,calendarRoute,'PUT',{revision:config.revision,locationId:f.shop.id,year:2026,dates,confirmed:false,brokenHill:true})).status,200);assert.ok((await f.request(f.staff,route)).data.dates.some(day=>day.name==='Good Friday'));
 config=(await f.request(f.office,'/api/awards')).data.config;assert.equal((await f.request(f.office,calendarRoute,'PUT',{revision:config.revision,locationId:f.shop.id,year:2026,dates,confirmed:true,brokenHill:true})).status,200);
 const file=path.join(f.dir,'award-compliance.json'),before=await fs.readFile(file,'utf8');assert.deepEqual((await f.request(f.staff,route)).data.dates,dates);assert.equal(await fs.readFile(file,'utf8'),before);const serialized=JSON.stringify((await f.request(f.staff,route)).data);for(const key of ['reviewedBy','brokenHill','audit','profiles','revision'])assert.ok(!serialized.includes(key));
 assert.deepEqual((await f.request(f.office,route)).data.dates,[]);assert.equal((await f.request(f.office,'/api/locations/'+f.shop.id,'PUT',{name:f.shop.name,publicHolidayState:''})).status,200);assert.deepEqual((await f.request(f.staff,route)).data.dates,dates);
});
