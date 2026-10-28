const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,password}=require('./test-support/delivery-planning-fixture.cjs');

test('help is authenticated and available without business permissions, while feature access and required reading stay enforced',async t=>{
 const app=await fixture();t.after(()=>app.close());
 const guest=await fetch(app.base+'/help?__opstack_content=1',{redirect:'manual'});assert.equal(guest.status,303);assert.equal(guest.headers.get('location'),'/login');
 let roles=await app.api(app.office,'/api/permission-levels');roles=await app.api(app.office,'/api/permission-levels','POST',{revision:roles.revision,name:'Help only',scope:'company',level:1,homeDashboard:'staff',permissions:[]});const role=roles.levels.find(r=>r.name==='Help only');await app.api(app.office,'/api/accounts','POST',{username:'HelpReader',password,role:role.id,roleScope:'company',companyId:app.office.session.companyId,locationId:app.location});const reader=await app.login('HelpReader');
 for(const url of ['/help','/help?__opstack_content=1']){const response=await fetch(app.base+url,{headers:reader.headers});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const html=await response.text();assert.match(html,/Help &amp; support/);if(url.includes('__opstack_content'))assert.match(html,/src="\/help\.js\?v=/);else assert.match(html,/src="\/persistent-navigation\.js\?v=/);}
 assert.equal((await app.request(reader,'/api/catalogue')).status,403);assert.equal((await app.request(reader,'/api/reporting')).status,403);assert.equal((await app.request(reader,'/api/ai/settings')).status,403);
 await app.api(app.office,'/api/communications/posts','POST',{title:'Required update',body:'Read before continuing.',scope:'company',requireRead:true});const blocked=await fetch(app.base+'/help?__opstack_content=1',{headers:reader.headers,redirect:'manual'});assert.equal(blocked.status,303);assert.match(blocked.headers.get('location'),/^\/communications\?returnTo=/);assert.equal(app.calls.length,0);
});

test('help guides use registered destinations and valid permissions, cover every feature area and preserve related-guide links',()=>{
 const {categories,articles}=require('./public/help-guides'),files=require('./public-files'),permissions=require('./public/permission-model'),ids=new Set(articles.map(a=>a.id)),groups=new Set(categories.map(c=>c.id));assert.equal(ids.size,articles.length);assert.equal(groups.size,categories.length);
 for(const article of articles){assert(groups.has(article.category),article.id);assert(article.steps.length>=3,article.id);for(const related of article.related)assert(ids.has(related),article.id+' → '+related);for(const key of article.permissions||[])assert([...permissions.keys,...permissions.actionKeys].includes(key),key);if(article.route){const url=new URL(article.route,'https://help.example');assert.equal(url.origin,'https://help.example');assert(files[url.pathname]?.endsWith('.html'),article.route);}}
 for(const category of categories)assert(articles.some(a=>a.category===category.id),category.id);
 for(const id of ['place-order','receiving-orders','hourly-import','scan-invoice','shift-clock','checklist-planners','course-questions','read-library','team-chat','scheduled-reports','intelligence-setup','location-setup','permissions','print-labels','support-request'])assert(ids.has(id),id);
});
