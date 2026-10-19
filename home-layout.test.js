const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const model=require('./public/home-layout-model'),elements=require('./element-overrides'),styles=require('./public/appearance-style');
const {createServer}=require('./server'),{saveAdmin}=require('./auth');

test('Home options validate bounded sizes and known widgets without permitting arbitrary CSS or selectors',()=>{
 const defaults=model.validate({});assert.equal(defaults.density,'compact');assert.equal(defaults.columns,6);
 assert.notEqual(defaults.hidden,model.defaults.hidden);
 const value=model.validate({columns:6,radius:0,gap:24,hidden:['home-totals','home-cart-card']});
 assert.equal(value.radius,0);assert.match(model.css(value),/--home-radius:0px/);
 for(const bad of [null,[],{columns:1},{columns:7},{columns:2.5},{gap:100},{radius:-1},{width:'100%;color:red'},{notes:'true'},{hidden:['body']},{hidden:['home-totals','home-totals']},{hidden:['home-main']},{position:'fixed'},{density:'tiny'},{shortcutStyle:'raw'}])assert.throws(()=>model.validate(bad));
 const css=model.css(value);assert.match(css,/body:not\(.app-edit-mode\).*home-totals/);assert.match(css,/body.app-edit-mode.*home-cart-card/);assert.equal(model.css({hidden:['<style>']}),'');
 assert.match(styles.buildElements({},'<main data-edit-id="home-main">'),/--home-columns:6/);
 assert.equal(styles.buildElements({'home-main':{homeLayout:value}},'<main data-edit-id="sales-main">'),'');
});

test('Home options coexist with individual appearance edits and linking, and reset without removing them',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'home-options-store-'));
 try{
  await elements.patch(dir,{id:'home-main',changes:{background:'primary',homeLayout:{columns:3,hidden:['home-cart-card']}}});
  await elements.patch(dir,{id:'home-main',changes:{font:'verdana'}});
  await elements.patch(dir,{id:'home-main',scope:'type',type:'container',changes:{background:'secondary'}});
  let saved=await elements.read(dir);assert.equal(saved['home-main'].homeLayout.columns,3);assert.equal(saved['type:container'].background,'secondary');
  await assert.rejects(elements.patch(dir,{id:'home-totals',changes:{homeLayout:{}}}));
  await assert.rejects(elements.patch(dir,{id:'home-main',scope:'type',type:'container',changes:{homeLayout:{}}}));
  await assert.rejects(elements.patch(dir,{id:'home-main',changes:{homeLayout:{hidden:['unknown']}}}));
  assert.deepEqual(await elements.read(dir),saved);
  await elements.patch(dir,{id:'home-main',changes:{homeLayout:null}});saved=await elements.read(dir);assert.equal(saved['home-main'].homeLayout,undefined);assert.equal(saved['home-main'].linked,true);assert.equal(saved['type:container'].background,'secondary');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('Home configuration requires appearance permission and CSRF, stays within its company, and survives restart',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'home-options-api-'));await saveAdmin(dir,'Office','test-office-password');let server,url;
 async function start(){server=createServer(dir,{fetchImpl:()=>{throw Error('Unexpected provider request');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;}
 async function request(actor,route,method='GET',input,extra={}){const response=await fetch(url+route,{method,headers:{'Content-Type':'application/json',...(actor?{Cookie:actor.cookie,'X-CSRF-Token':actor.session.csrf}:{}),...extra},body:input===undefined?undefined:JSON.stringify(input)});return{status:response.status,response,data:response.headers.get('content-type')?.includes('application/json')?await response.json():await response.text()};}
 async function login(username,password){const reply=await request(null,'/api/login','POST',{username,password});assert.equal(reply.status,200);const actor={cookie:reply.response.headers.get('set-cookie').split(';')[0],session:{}};actor.session=(await request(actor,'/api/session')).data;return actor;}
 await start();
 try{
  let office=await login('Office','test-office-password');const other=(await request(office,'/api/companies','POST',{name:'Other company',locationName:'Other location'})).data;
  const input={id:'home-main',changes:{homeLayout:{columns:3,gap:8,radius:8,hidden:['home-cart-card','home-total-orders']}}},scopeA={'X-Company-Id':'default'},scopeB={'X-Company-Id':other.id};
  assert.equal((await request(null,'/api/element-overrides','PATCH',input)).status,401);
  assert.equal((await request(office,'/api/element-overrides','PATCH',input,{'X-CSRF-Token':''})).status,403);
  assert.equal((await request(office,'/api/element-overrides','PATCH',input,scopeA)).status,200);
  assert.equal((await request(office,'/element-overrides','GET',undefined,scopeB)).data['home-main'],undefined);
  await request(office,'/api/accounts','POST',{username:'Member',password:'test-member-password',role:'user',locationIds:[office.session.locationId]});
  const member=await login('Member','test-member-password');assert.equal((await request(member,'/api/element-overrides','PATCH',input)).status,403);
  const html=(await request(member,'/home')).data;assert.match(html,/--home-columns:3/);assert.match((await request(member,'/home?__opstack_content=1')).data,/home-layout\.js/);assert.match(html,/home-cart-card.*display:none!important/);
  assert.equal((await request(office,'/api/element-overrides','PATCH',{...input,changes:{homeLayout:{columns:99}}},scopeA)).status,400);
  await new Promise(resolve=>server.close(resolve));await start();office=await login('Office','test-office-password');
  assert.equal((await request(office,'/element-overrides','GET',undefined,scopeA)).data['home-main'].homeLayout.columns,3);
  assert.equal((await request(office,'/element-overrides','GET',undefined,scopeB)).data['home-main'],undefined);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
