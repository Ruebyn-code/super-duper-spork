const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const{fixture}=require('./test-support/roster-hourly-fixture.cjs'),branding=require('./head-office-branding');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw4kAAAAASUVORK5CYII=','base64');
async function setup(t){const a=await fixture({seed:false});t.after(()=>a.close());return a;}
const logoBytes=async(a,actor,headers={},query='')=>{const r=await fetch(a.base+'/logo'+query,{headers:{...actor.headers,...headers}});return r.status===200?Buffer.from(await r.arrayBuffer()).toString('base64'):r.status;};

test('Head Office has its own branding, starting from its company and never changing the company',async t=>{
 const a=await setup(t),companyId=a.office.session.companyId,store={'X-Location-Id':a.location};
 await a.api(a.office,'/api/settings','PATCH',{backgrounds:{signin:'#123456'}},store);await a.api(a.office,'/api/logo','POST',{data:png.toString('base64')},store);
 const office=await a.api(a.office,'/api/locations/head-office','POST',{}),hq={'X-Location-Id':office.id};
 /* before any Head Office change it shows the company's look and nothing is written */
 assert.equal((await a.api(a.office,'/appearance','GET',undefined,hq)).backgrounds.signin,'#123456');
 assert.equal(await branding.active(a.dir),false);assert.equal(await logoBytes(a,a.office,hq),png.toString('base64'));
 /* the first Head Office change copies the company branding once and then stays separate */
 await a.api(a.office,'/api/settings','PATCH',{backgrounds:{signin:'#abcdef'}},hq);
 assert.equal(await branding.active(a.dir),true);
 assert.equal((await a.api(a.office,'/appearance','GET',undefined,hq)).backgrounds.signin,'#abcdef');
 assert.equal((await a.api(a.office,'/appearance','GET',undefined,{...hq,'X-Company-Id':companyId})).backgrounds.signin,'#abcdef');
 assert.equal((await a.api(a.office,'/appearance','GET',undefined,store)).backgrounds.signin,'#123456');
 assert.equal(await logoBytes(a,a.office,hq),png.toString('base64'),'the company logo was copied into Head Office branding');
 await a.api(a.office,'/api/sidebar-logo','DELETE',undefined,hq);await a.api(a.office,'/api/logo','POST',{data:png.toString('base64')},hq);
 /* explicit ?company=<id> requests (company picker logos) keep the company's own branding */
 assert.equal(await logoBytes(a,a.office,hq,'?company='+companyId),png.toString('base64'));
 assert.equal(await logoBytes(a,a.office,hq,'?company=head-office'),png.toString('base64'));
 /* company changes made later never reach Head Office */
 await a.api(a.office,'/api/settings','PATCH',{backgrounds:{signin:'#654321'}},store);
 assert.equal((await a.api(a.office,'/appearance','GET',undefined,hq)).backgrounds.signin,'#abcdef');
 assert.equal((await a.api(a.office,'/appearance','GET',undefined,store)).backgrounds.signin,'#654321');
 /* wording and Home layouts stay with the company */
 assert.equal((await fs.readdir(branding.folder(a.dir))).filter(f=>/home-dashboard|interface-text|element-overrides|layouts/.test(f)).length,0);
 const page=await (await fetch(a.base+'/home',{headers:{...a.office.headers,...hq}})).text();
 assert.match(page,/window\.appBrandingScope="head-office"/);assert.match(page,/company=head-office/);
 const storePage=await (await fetch(a.base+'/home',{headers:{...a.office.headers,...store}})).text();
 assert.match(storePage,/window\.appBrandingScope="company"/);assert.equal(a.calls(),0);
});

test('Head Office branding needs appearance permission and seeds concurrently only once',async t=>{
 const a=await setup(t),office=await a.api(a.office,'/api/locations/head-office','POST',{}),hq={'X-Location-Id':office.id};
 const results=await Promise.all(['#111111','#222222','#333333'].map(colour=>a.request(a.office,'/api/settings','PATCH',{backgrounds:{signin:colour}},hq)));
 assert(results.every(r=>r.status===200));
 const marker=JSON.parse(await fs.readFile(path.join(branding.folder(a.dir),'branding.json'),'utf8'));assert.equal(marker.seededFrom,a.office.session.companyId);
 assert.equal((await a.request(a.staff,'/api/settings','PATCH',{backgrounds:{signin:'#444444'}})).status,403);
 assert.equal(branding.applies({session:{companyId:'c'},isHeadOffice:true,queryCompany:'other'}),false);
 assert.equal(branding.applies({session:{companyId:'c'},isHeadOffice:true,headerCompany:'c'}),true);
 assert.equal(branding.applies({session:{companyId:'c'},isHeadOffice:false}),false);
});
