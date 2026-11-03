const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture,password}=require('./test-support/delivery-planning-fixture.cjs');

test('demo screenshot pack downloads require sign-in, preserve required reading and grant no business access',async t=>{
 const app=await fixture();t.after(()=>app.close());
 for(const path of ['/api/help/reference-pack','/api/help/reference-pack/download'])assert.equal((await fetch(app.base+path,{redirect:'manual'})).status,401);
 let levels=await app.api(app.office,'/api/permission-levels');levels=await app.api(app.office,'/api/permission-levels','POST',{revision:levels.revision,name:'Reference reader',scope:'company',level:1,homeDashboard:'staff',permissions:[]});const role=levels.levels.find(r=>r.name==='Reference reader');
 await app.api(app.office,'/api/accounts','POST',{username:'ReferenceReader',password,role:role.id,roleScope:'company',companyId:app.office.session.companyId,locationId:app.location});const reader=await app.login('ReferenceReader');
 const meta=await app.api(reader,'/api/help/reference-pack');assert.equal(meta.demo,true);assert(meta.screenshots>=250);assert(meta.size>1000000);assert.match(meta.sha256,/^[a-f0-9]{64}$/);assert(meta.categories.length>=15);
 const downloaded=await fetch(app.base+'/api/help/reference-pack/download',{headers:reader.headers});assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-type'),'application/zip');assert.match(downloaded.headers.get('content-disposition'),/attachment; filename="OpStack-reference-pack.zip"/);assert.equal(downloaded.headers.get('cache-control'),'private, no-store');assert.equal(downloaded.headers.get('x-content-type-options'),'nosniff');const bytes=Buffer.from(await downloaded.arrayBuffer());assert.equal(bytes.length,meta.size);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),meta.sha256);assert.equal(bytes.readUInt32LE(0),0x04034b50);assert.equal(bytes.readUInt32LE(bytes.length-22),0x06054b50);
 const head=await fetch(app.base+'/api/help/reference-pack/download',{method:'HEAD',headers:reader.headers});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),meta.size);assert.equal((await head.arrayBuffer()).byteLength,0);
 const method=await fetch(app.base+'/api/help/reference-pack/download',{method:'POST',headers:reader.headers});assert.equal(method.status,405);assert.equal(method.headers.get('allow'),'GET, HEAD');
 for(const url of ['/reference-pack/OpStack-reference-pack.zip','/public/reference-pack/OpStack-reference-pack.zip'])assert.equal((await fetch(app.base+url,{headers:reader.headers})).status,404);
 assert.equal((await app.request(reader,'/api/catalogue')).status,403);assert.equal((await app.request(reader,'/api/reporting')).status,403);
 await app.api(app.office,'/api/communications/posts','POST',{title:'Reference required reading',body:'Review this announcement before continuing.',scope:'company',requireRead:true});for(const url of ['/api/help/reference-pack','/api/help/reference-pack/download'])assert.equal((await app.request(reader,url)).status,428);assert.equal(app.calls.length,0);
});

test('owner console has a separately authenticated reference download',async t=>{
 const app=await require('./test-support/stripe-fixture.cjs').fixture();t.after(()=>app.close());
 const response=await fetch(app.base+'/api/opstack/reference-pack',{headers:app.owner.headers});assert.equal(response.status,200);const data=await response.json();assert(data.demo&&data.screenshots>=250);
 const head=await fetch(app.base+'/api/opstack/reference-pack/download',{method:'HEAD',headers:app.owner.headers});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),data.size);
 assert.equal((await fetch(app.base+'/api/opstack/reference-pack',{headers:app.tenant.headers})).status,401);assert.equal(app.calls.length,0);
});
