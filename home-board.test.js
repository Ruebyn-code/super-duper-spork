const {fetchWithSetupSnooze:fetch}=require('./test-support/location-setup-snooze.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./public/home-board-model'),store=require('./home-board'),permissions=require('./permissions'),{createServer}=require('./server'),{saveAdmin}=require('./auth');

test('Home catalogue supplies a fresh default dashboard and covers every Opstack area without arbitrary destinations',()=>{
 const first=model.defaults(),next=model.defaults();first[1].links.pop();assert.equal(next[1].links.length,6);assert.equal(next.length,6);assert.deepEqual(model.validate(next),next);
 assert.ok(Object.keys(model.types).length>=20);for(const id of ['ordering','cart','counts','transfers','sales','weekly-report','cogs','labour','opex','ro','reporting','messages','chats','posts','checklists','checklist-builder','labels','library','roster','timesheets','availability','leave','invoices','users','locations','companies','settings','appearance','permissions','awards','console'])assert.ok(model.links[id],id);
 for(const item of Object.values(model.links)){assert.ok(item.href.startsWith('/')&&!item.href.startsWith('//'));for(const key of item.permissions)assert.ok(permissions.keys.includes(key),key);}
 assert.equal(model.links.posts.href,'/communications#posts');
});

test('Home validation bounds sections, safely retains entered text, and rejects unknown types, URLs and stale properties',()=>{
 const base={id:'one',type:'heading',size:'half',title:'<b>Location totals</b>',note:'My company notes'};assert.equal(model.validate([base])[0].title,base.title);
 const invalid=[null,{},Array(49).fill(base),[base,base],[{...base,id:'../escape'}],[{...base,type:'__proto__'}],[{...base,type:['heading']}],[{...base,type:'module',target:['ordering']}],[{...base,type:'quick-links',links:[['ordering']]}],[{...base,size:'fixed'}],[{...base,title:'a'.repeat(81)}],[{...base,note:'a'.repeat(401)}],[{...base,title:'bad\u0000'}],[{...base,href:'https://example.com'}],[{...base,links:[]}],[{...base,target:'ordering'}],[{...base,type:'module',target:'https://example.com'}],[{...base,type:'module',target:'__proto__'}],[{...base,type:'quick-links',links:['ordering','ordering']}],[{...base,type:'quick-links',links:['made-up']}],[{...base,type:'quick-links',links:null}],[{id:'a',type:'quarter-totals',size:'full'},{id:'b',type:'quarter-totals',size:'half'}]];
 for(const input of invalid)assert.throws(()=>model.validate(input),JSON.stringify(input));assert.deepEqual(model.validate([]),[]);
 const input=[{id:'links',type:'quick-links',size:'full',links:['ordering']}],result=model.validate(input);input[0].links.push('sales');assert.deepEqual(result[0].links,['ordering']);
});

test('Home section and link visibility follows custom permissions, phone restrictions and platform identity',()=>{
 const actor={permissions:['home.view','orders.view','comms.view','rostering.view','rostering.manage','appearance.manage']};
 assert.equal(model.allowedLink(actor,'users'),false);assert.equal(model.allowedLink(actor,'messages'),true);assert.equal(model.allowedLink(actor,'roster-maker'),true);assert.equal(model.allowedLink(actor,'roster-maker',{phone:true}),false);assert.equal(model.allowedLink(actor,'appearance',{phone:true}),false);assert.equal(model.visible(actor,{type:'module',target:'roster-maker'},{phone:true}),false);assert.equal(model.visible(actor,{type:'quick-links',links:['roster-maker']},{phone:true}),false);
 assert.equal(model.allowedLink(actor,'console'),false);assert.equal(model.allowedLink({...actor,opstackSupport:true},'console'),true);
 assert.equal(model.visible(actor,{type:'finance'}),false);assert.equal(model.visible(actor,{type:'comms'}),true);assert.equal(model.visible(actor,{type:'module',target:'users'}),false);assert.equal(model.visible(actor,{type:'quick-links',links:['users','ordering']}),true);
});

test('Home sections use atomic optimistic revisions and never overwrite concurrent or invalid changes',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'home-board-store-'));try{
  assert.equal((await store.read(dir)).revision,0);const input={revision:0,sections:[{id:'heading',type:'heading',size:'third',title:'Custom Home'}]};
  const results=await Promise.allSettled([store.save(dir,input),store.save(dir,{...input,sections:[]})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  const saved=await store.read(dir);assert.equal(saved.revision,1);assert.deepEqual(saved.sections,input.sections);await assert.rejects(store.save(dir,{revision:1,sections:[{id:'x',type:'script',size:'full'}]}),e=>e.status===400);await assert.rejects(store.save(dir,{revision:-1,sections:[]}),e=>e.status===400);assert.deepEqual(await store.read(dir),saved);
  assert.equal((await fs.stat(path.join(dir,'home-dashboard.json'))).mode&0o777,0o600);assert.deepEqual((await fs.readdir(dir)),['home-dashboard.json']);
  assert.equal((await store.save(dir,{revision:1,sections:[]})).revision,2);assert.deepEqual((await store.read(dir)).sections,[]);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'home-board-api-'));await saveAdmin(dir,'Office','office-test-password');let server,base;
 async function start(){server=createServer(dir,{fetchImpl:()=>{throw Error('No external providers in Home tests');}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}await start();
 async function request(actor,url,method='GET',input,extra={}){const res=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...actor?.headers,...extra},body:input===undefined?undefined:JSON.stringify(input),redirect:'manual'});return{status:res.status,data:res.headers.get('content-type')?.includes('json')?await res.json():await res.text(),response:res};}
 async function login(username,password='member-test-password'){const reply=await request(null,'/api/login','POST',{username,password});assert.equal(reply.status,200,JSON.stringify(reply.data));const actor={headers:{Cookie:reply.response.headers.get('set-cookie').split(';')[0]}};actor.session=(await request(actor,'/api/session')).data;actor.headers['X-CSRF-Token']=actor.session.csrf;return actor;}
 const office=await login('Office','office-test-password');async function user(name,role='user',locationId=office.session.locationId){const r=await request(office,'/api/accounts','POST',{username:name,password:'member-test-password',role,companyId:'default',locationId,locationIds:[locationId]});assert.equal(r.status,201,JSON.stringify(r.data));return login(name);}
 t.after(async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true,maxRetries:3});});return{dir,office,request,login,user,restart:async()=>{await new Promise(r=>server.close(r));await start();}};
}

test('Home API requires CSRF and appearance permission, isolates companies, and preserves saved sections after restart',async t=>{
 const app=await fixture(t),{request,office}=app,company=(await request(office,'/api/companies','POST',{name:'Other company',locationName:'Other store'})).data,member=await app.user('Member'),input={revision:0,sections:[{id:'custom',type:'heading',size:'full',title:'Our custom Home'}]},a={'X-Company-Id':'default'},b={'X-Company-Id':company.id};
 assert.equal((await request(null,'/api/home-dashboard')).status,401);assert.equal((await request(member,'/api/home-dashboard')).status,200);assert.equal((await request(member,'/api/home-dashboard','PUT',input)).status,403);assert.equal((await request(office,'/api/home-dashboard','PUT',input,{'X-CSRF-Token':''})).status,403);
 assert.equal((await request(office,'/api/home-dashboard','PUT',input,a)).status,200);assert.deepEqual((await request(member,'/api/home-dashboard')).data.sections,input.sections);assert.equal((await request(office,'/api/home-dashboard', 'GET',undefined,b)).data.revision,0);assert.equal((await request(member,'/api/home-dashboard','GET',undefined,b)).status,403);
 assert.equal((await request(office,'/api/home-dashboard','PUT',input,a)).status,409);assert.equal((await request(office,'/api/home-dashboard','PUT',{revision:1,sections:[{id:'bad',type:'heading',size:'full',html:'script'}]},a)).status,400);
 let catalogue=(await request(office,'/api/permission-levels')).data;const levels=(await request(office,'/api/permission-levels','POST',{name:'Home designer',scope:'company',level:10,permissions:['home.view','appearance.manage'],revision:catalogue.revision})).data,role=levels.levels.find(r=>r.name==='Home designer'),designer=await app.user('Designer',role.id);
 assert.equal((await request(designer,'/api/home-dashboard','PUT',{revision:1,sections:[]},a)).status,200);assert.equal((await request(designer,'/api/home-dashboard','PUT',input,b)).status,403);
 await app.restart();const again=await app.login('Office','office-test-password');assert.deepEqual((await request(again,'/api/home-dashboard','GET',undefined,a)).data,{revision:2,sections:[]});assert.deepEqual((await request(again,'/api/home-dashboard','GET',undefined,b)).data.sections,model.defaults());
 for(const asset of ['/home-board.js','/home-board-model.js','/home-board.css'])assert.equal((await request(again,asset)).status,200);
});

test('recent Home orders include only the current user’s placed location orders and expose summary fields only',async t=>{
 const app=await fixture(t),{request,office}=app,member=await app.user('Member'),base={createdAt:'2026-10-19T01:00:00Z',status:'requested',locationId:office.session.locationId,requestOwnerId:office.session.id,total:2500,items:[{id:'rice',name:'Private order detail',quantity:2,price:1250}],credentials:'secret'};
 const own={...base,id:crypto.randomUUID()},unknown={...base,id:crypto.randomUUID(),pricePending:true,items:[{id:'rice',quantity:3,price:null}],total:0},other={...base,id:crypto.randomUUID(),requestOwnerId:member.session.id},away={...base,id:crypto.randomUUID(),locationId:'hidden-location'},draft={...base,id:crypto.randomUUID(),status:'draft'};
 for(const order of [own,unknown,other,away,draft])await fs.writeFile(path.join(app.dir,order.id+'.json'),JSON.stringify(order));
 const response=await request(office,'/api/home-orders');assert.equal(response.status,200);assert.equal(response.data.length,2);assert.ok(response.data.some(o=>o.id===own.id&&o.units===2&&o.totalCents===2500));assert.equal(response.data.find(o=>o.id===unknown.id).pricePending,true);
 for(const item of response.data)assert.deepEqual(Object.keys(item).sort(),['createdAt','id','pricePending','totalCents','units']);assert.ok(!JSON.stringify(response.data).includes('secret'));assert.deepEqual((await request(member,'/api/home-orders')).data.map(o=>o.id),[other.id]);assert.equal((await request(null,'/api/home-orders')).status,401);
 const catalogue=(await request(office,'/api/permission-levels')).data,levels=(await request(office,'/api/permission-levels','POST',{name:'Home only',scope:'company',level:1,permissions:['home.view'],revision:catalogue.revision})).data,homeOnly=await app.user('Home only',levels.levels.find(r=>r.name==='Home only').id);assert.equal((await request(homeOnly,'/api/home-orders')).status,403);
});

test('Home reads never acknowledge mandatory posts and cannot bypass the required-reading gate',async t=>{
 const app=await fixture(t),member=await app.user('Member'),{request,office}=app;
 const post=await request(office,'/api/communications/posts','POST',{title:'Required policy',body:'Read this before working.',scope:'company',requireRead:true});assert.equal(post.status,201);
 for(const url of ['/api/home-dashboard','/api/home-orders','/api/home-totals'])assert.equal((await request(member,url)).status,428,url);
 assert.equal((await request(member,'/api/communications/required')).data.due.length,1);assert.equal((await request(office,'/api/home-dashboard')).status,200);assert.equal((await request(member,'/api/communications/required')).data.due.length,1);
});

test('Home section geometry preserves preset compatibility and rejects unsafe custom sizes',()=>{
 const section={id:'resize',type:'heading',size:'half',span:5,height:248};assert.deepEqual(model.validate([section]),[section]);
 for(const patch of [{span:2},{span:13},{span:3.5},{column:0},{column:13},{height:-1},{height:1601},{height:'200'}])assert.throws(()=>model.validate([{...section,...patch}]));
 const legacy={id:'old',type:'heading',size:'full'};assert.deepEqual(model.validate([legacy]),[legacy]);
});
