const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture,reply,key}=require('./test-support/ai-assistance-fixture.cjs'),model=require('./ai-search-model'),search=require('./global-search');
const input=query=>({query,requestId:crypto.randomUUID()}),plan={queries:['pineapple'],pageIds:['page:library']};
const article=(app,title,body,headers={})=>app.api(app.office,'/api/knowledge-library','POST',{title,body,type:'policy',scope:'company'},headers);

test('intelligence search validates bounded query plans and only returns real, permitted destinations',async()=>{
 const pages=search.pagesFor({permissions:['home.view']});
 for(const value of [{queries:['home'],pageIds:['page:users']},{queries:['x'.repeat(81)],pageIds:[]},{queries:['a','b','c','d'],pageIds:[]},{queries:['bad\nquery'],pageIds:[]},{queries:[],pageIds:[]}])assert.throws(()=>model.normalize(value,{pages}),e=>e.status===502);
 const provider=async()=>Array.from({length:25},(_,i)=>({id:'item:'+i,type:'Articles',title:'Pineapple guide '+i,text:'Kitchen procedures',url:'/knowledge-library'}));
 const result=await search.intelligentSearch({permissions:['home.view']},'where is the guide',{queries:['pineapple','PINEAPPLE'],pageIds:['page:home','page:users']},{Articles:provider,Broken:()=>{throw Error('private path and credentials');}});
 assert.equal(result.results.filter(r=>r.type==='Articles').length,10);assert.equal(new Set(result.results.map(r=>r.id)).size,result.results.length);assert(result.results.some(r=>r.id==='page:home'));assert(!result.results.some(r=>r.id==='page:users'));assert.deepEqual(result.unavailable,['Broken']);assert(!JSON.stringify(result).includes('private path'));assert(result.hasMore);
});

test('ordinary search stays free; intelligence requires sign-in, CSRF, valid input and company configuration',async()=>{const app=await fixture({fetchImpl:()=>reply(plan)});try{
 assert.equal((await app.request(null,'/api/search/intelligence','POST',input('find a guide'))).status,401);
 assert.equal((await app.request(app.staff,'/api/search/intelligence','GET')).status,405);
 assert.equal((await app.api(app.staff,'/api/search?q=home')).intelligence.available,false);
 assert.equal((await app.request(app.staff,'/api/search/intelligence','POST',input('find a guide'))).status,503);
 await app.settings();assert.equal((await app.api(app.staff,'/api/search?q=home')).intelligence.available,true);
 for(const value of [input('a'),input('x'.repeat(121)),input('bad\u0000query'),{query:'home',requestId:'invalid'},{}])assert.equal((await app.request(app.staff,'/api/search/intelligence','POST',value)).status,400);
 assert.equal((await app.request(app.staff,'/api/search/intelligence','POST',input('home'),{'X-CSRF-Token':''})).status,403);
 assert.equal((await app.request(app.staff,'/api/ai/status')).status,200);assert.equal((await app.request(app.staff,'/api/ai/settings')).status,403);
 assert.equal((await app.request(app.office,'/api/ai/drafts','POST',{kind:'search',prompt:'home',requestId:crypto.randomUUID()})).status,400);
 assert.equal(app.calls.length,0);
 }finally{await app.close();}});

test('natural-language searches find scoped records without sharing records or making operational changes',async()=>{const app=await fixture({fetchImpl:()=>reply(plan)});try{
 await app.settings();const own=await article(app,'Pineapple handling','Keep the approved procedure nearby. PRIVATE-SOURCE-CONTENT'),other=await app.api(app.office,'/api/companies','POST',{name:'Other business',locationName:'Other store'}),shops=await app.api(app.office,'/api/locations?all=true'),outside=shops.find(s=>s.companyId===other.id),hidden=await article(app,'Pineapple secret','OTHER-COMPANY-CONTENT',{'X-Location-Id':outside.id});
 const privateUser=await app.api(app.office,'/api/accounts','POST',{username:'Private member',password:'ai-test-password',role:'user',locationId:app.location}),thread=await app.api(app.office,'/api/communications/threads','POST',{kind:'direct',members:[privateUser.id]});await app.api(app.office,'/api/communications/threads/'+thread.id+'/messages','POST',{body:'Pineapple manager-only secret'});
 await app.api(app.office,'/api/learning-centre/courses','POST',{requestId:crypto.randomUUID(),title:'Pineapple unpublished course',description:'Private draft',category:'Induction',minutes:5,passPercent:80,lessons:[{id:crypto.randomUUID(),title:'Content',body:'Private course body',richText:null,required:true}],quiz:[{id:crypto.randomUUID(),prompt:'Choose one',options:['SECRET-QUIZ-KEY','Other'],correct:0}]});
 await app.api(app.staff,'/api/search?q=pineapple');const files=['communications.json','learning-centre.json'],before=await Promise.all(files.map(file=>fs.readFile(path.join(app.dir,file),'utf8')));
 const result=await app.api(app.staff,'/api/search/intelligence','POST',input('where is the fruit handling guide'));
 assert(result.results.some(r=>r.id==='article:'+own.id));assert(result.results.some(r=>r.id==='page:library'));assert(!result.results.some(r=>r.id==='article:'+hidden.id||r.id==='chat:'+thread.id||r.type==='Courses'));assert(!JSON.stringify(result).includes(key));
 assert.deepEqual(await Promise.all(files.map(file=>fs.readFile(path.join(app.dir,file),'utf8'))),before);
 const payload=JSON.parse(app.calls[0].options.body),submitted=payload.messages[1].content;
 for(const secret of [own.id,hidden.id,thread.id,'PRIVATE-SOURCE-CONTENT','OTHER-COMPANY-CONTENT','SECRET-QUIZ-KEY',key,'Staff'])assert(!submitted.includes(secret),secret);
 assert(submitted.includes('where is the fruit handling guide'));assert(!submitted.includes('page:users'));assert.equal(payload.response_format.json_schema.name,'opstack_search');assert.equal(payload.max_completion_tokens,1000);assert.equal(payload.store,false);assert.equal(app.calls[0].url,'https://api.openai.com/v1/chat/completions');assert(!JSON.stringify(result).includes('manager-only'));
 assert.equal((await app.request(app.staff,'/api/search/intelligence','POST',input('fruit handling guide'),{'X-Location-Id':outside.id})).status,403);assert.equal(app.calls.length,1);
 }finally{await app.close();}});

test('cached search interpretation rechecks records and quotas without charging a retry',async()=>{const app=await fixture({fetchImpl:()=>reply(plan)});try{
 await app.settings({draftLimit:1});const own=await article(app,'Pineapple handling','Approved procedure'),query=input('find the fruit handling guide');
 const first=await app.api(app.staff,'/api/search/intelligence','POST',query);assert(first.results.some(r=>r.id==='article:'+own.id));
 await app.api(app.office,'/api/knowledge-library/'+own.id,'DELETE',{revision:own.revision});
 const retry=await app.api(app.staff,'/api/search/intelligence','POST',query);assert(!retry.results.some(r=>r.id==='article:'+own.id));assert.equal(app.calls.length,1);
 assert.equal((await app.request(app.staff,'/api/search/intelligence','POST',{...query,query:'another guide'})).status,409);
 assert.equal((await app.request(app.staff,'/api/search/intelligence','POST',input('find another guide'))).status,429);
 const usage=await app.api(app.office,'/api/ai/settings');assert.equal(usage.usedDrafts,1);assert(usage.estimatedUsedMicros>0);
 }finally{await app.close();}});

test('hallucinated pages and provider failures never supply links, results or private errors',async()=>{for(const outcome of ['invented','provider','network']){const app=await fixture({fetchImpl:()=>{if(outcome==='network')throw Error(key);if(outcome==='provider')return new Response(JSON.stringify({error:key}),{status:500});return reply({queries:['home'],pageIds:['https://malicious.example']});}});try{
 await app.settings({draftLimit:1});const response=await app.request(app.staff,'/api/search/intelligence','POST',input('find the home page'));assert.equal(response.status,502);assert(!JSON.stringify(response).includes(key));assert(!JSON.stringify(response).includes('malicious.example'));assert(!response.data.results);
 assert.equal((await app.api(app.staff,'/api/search?q=home')).results[0].id,'page:home');assert.equal((await app.api(app.office,'/api/ai/settings')).usedDrafts,1);
 }finally{await app.close();}}});

test('company and location contexts cannot reuse a search plan across scopes',async()=>{const app=await fixture({fetchImpl:()=>reply(plan)});try{
 await app.settings();const here=await article(app,'Pineapple local','Local procedure'),other=await app.api(app.office,'/api/companies','POST',{name:'Other company',locationName:'Other store'}),shops=await app.api(app.office,'/api/locations?all=true'),there=shops.find(s=>s.companyId===other.id),headers={'X-Location-Id':there.id},outside=await article(app,'Pineapple elsewhere','Other procedure',headers);
 assert.equal((await app.api(app.office,'/api/search?q=pineapple','GET',undefined,headers)).intelligence.available,false);
 const config=await app.api(app.office,'/api/ai/settings','GET',undefined,headers);await app.api(app.office,'/api/ai/settings','PUT',{...config,apiKey:key,enabled:true},headers);
 const result=await app.api(app.office,'/api/search/intelligence','POST',input('find the fruit guide'),headers);assert(result.results.some(r=>r.id==='article:'+outside.id));assert(!result.results.some(r=>r.id==='article:'+here.id));assert.equal((await app.api(app.office,'/api/ai/settings')).usedDrafts,0);
 const shop=await app.api(app.office,'/api/locations','POST',{name:'Second same-company store'}),query=input('find the fruit guide');await app.api(app.office,'/api/search/intelligence','POST',query);assert.equal((await app.request(app.office,'/api/search/intelligence','POST',query,{'X-Location-Id':shop.id})).status,409);
 }finally{await app.close();}});

test('permissions, required reading and company enablement are rechecked after the AI call',async()=>{for(const change of ['permission','reading','disabled']){let started,release;const gate=new Promise(r=>release=r),arrived=new Promise(r=>started=r),app=await fixture({fetchImpl:async()=>{started();await gate;return reply(plan);}});try{
 await app.settings();await article(app,'Pineapple handling','Private policy');const pending=app.request(app.staff,'/api/search/intelligence','POST',input('find the fruit guide'));await arrived;
 if(change==='permission'){const levels=await app.api(app.office,'/api/permission-levels'),data=await app.api(app.office,'/api/permission-levels','POST',{revision:levels.revision,scope:'company',name:'Home only',level:1,permissions:['home.view']}),role=data.levels.find(r=>r.name==='Home only');await app.api(app.office,'/api/accounts/'+app.staff.session.id,'PUT',{username:'Staff',role:role.id,companyId:'default',locationId:app.location});}
 if(change==='reading')await app.api(app.office,'/api/communications/posts','POST',{title:'Read this first',body:'A required announcement',scope:'company',requireRead:true});
 if(change==='disabled')await app.settings({enabled:false});
 release();const response=await pending;assert.equal(response.status,{permission:401,reading:428,disabled:503}[change]);assert(!response.data.results);assert(!JSON.stringify(response).includes('Private policy'));
 }finally{release?.();await app.close();}}});
