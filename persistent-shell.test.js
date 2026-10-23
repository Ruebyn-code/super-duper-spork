const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createServer}=require('./server');
const {saveAdmin,saveUser}=require('./auth');

async function fixture(t){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-persistent-shell-'));
 await saveAdmin(dir,'Office','shell-test-office');await saveUser(dir,'Staff','shell-test-staff');
 const server=createServer(dir);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+server.address().port;
 async function login(username,password){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const Cookie=response.headers.get('set-cookie').split(';')[0],session=await(await fetch(base+'/api/session',{headers:{Cookie}})).json();return {Cookie,'X-CSRF-Token':session.csrf};}
 return {base,office:await login('Office','shell-test-office'),staff:await login('Staff','shell-test-staff')};
}
const script=(html,name)=>new RegExp('src="/'+name+'\\.js\\?v=[a-f0-9]{64}"').test(html);

test('navigation shell runs shared controls once while content documents retain their own page scripts',async t=>{
 const app=await fixture(t);
 for(const [route,pageScript] of [['/order-history','order-history'],['/home','home'],['/','app'],['/sales','sales'],['/rostering','rostering'],['/communications','communications']]){
  const outer=await fetch(app.base+route,{headers:app.office});assert.equal(outer.status,200);assert.equal(outer.headers.get('cache-control'),'no-store');const shell=await outer.text();
  assert.ok(script(shell,'persistent-navigation'));assert.ok(script(shell,'navigation'));assert.ok(script(shell,'required-reading'));assert.ok(script(shell,'shift-clock'));assert.ok(!script(shell,pageScript));
  const content=await fetch(app.base+route,{headers:{...app.office,'Sec-Fetch-Dest':'iframe'}});assert.equal(content.status,200);assert.equal(content.headers.get('cache-control'),'no-store');const html=await content.text();
  assert.ok(script(html,'page-bridge'));assert.ok(script(html,pageScript));assert.ok(!script(html,'persistent-navigation'));assert.ok(!script(html,'navigation'));assert.ok(!script(html,'required-reading'));assert.ok(!script(html,'shift-clock'));
 }
 const login=await(await fetch(app.base+'/login')).text();assert.ok(script(login,'login'));assert.ok(!script(login,'persistent-navigation'));assert.ok(!script(login,'page-bridge'));
 const fallback=await(await fetch(app.base+'/home?__opstack_content=1',{headers:app.office})).text();assert.ok(script(fallback,'page-bridge'));assert.ok(script(fallback,'home'));assert.ok(!script(fallback,'persistent-navigation'));
 const preview=await(await fetch(app.base+'/admin/appearance/signin?__opstack_content=1',{headers:app.office})).text();assert.ok(script(preview,'page-bridge'));assert.ok(script(preview,'auth-preview'));assert.ok(script(preview,'app-editor'));
});

test('content-only requests enforce sign-in, page permissions and required reading',async t=>{
 const app=await fixture(t),frame={'Sec-Fetch-Dest':'iframe'};
 const guest=await fetch(app.base+'/home',{headers:frame,redirect:'manual'});assert.equal(guest.status,303);assert.equal(guest.headers.get('location'),'/login');
 const denied=await fetch(app.base+'/settings',{headers:{...app.staff,...frame},redirect:'manual'});assert.equal(denied.status,303);
 const post=await fetch(app.base+'/api/communications/posts',{method:'POST',headers:{...app.office,'Content-Type':'application/json'},body:JSON.stringify({title:'Required update',body:'Read this first.',scope:'company',requireRead:true})});assert.equal(post.status,201);
 const blocked=await fetch(app.base+'/sales',{headers:{...app.staff,...frame},redirect:'manual'});assert.equal(blocked.status,303);assert.match(blocked.headers.get('location'),/^\/communications\?returnTo=/);
 const api=await fetch(app.base+'/api/catalogue',{headers:app.staff});assert.equal(api.status,428);
});

test('content navigation honours saved custom permission levels and subsequent edits',async t=>{
 const app=await fixture(t),headers={...app.office,'Content-Type':'application/json'};
 const catalogue=await(await fetch(app.base+'/api/permission-levels',{headers})).json();
 const created=await fetch(app.base+'/api/permission-levels',{method:'POST',headers,body:JSON.stringify({revision:catalogue.revision,scope:'company',name:'Sales viewer',level:10,permissions:['home.view','sales.view']})});assert.equal(created.status,201);
 const levels=await created.json(),role=levels.levels.find(value=>value.name==='Sales viewer'),office=await(await fetch(app.base+'/api/session',{headers})).json();
 const account=await fetch(app.base+'/api/accounts',{method:'POST',headers,body:JSON.stringify({username:'Viewer',password:'shell-test-viewer',role:role.id,roleScope:'company',companyId:office.companyId,locationId:office.locationId,locationIds:[office.locationId]})});assert.equal(account.status,201);
 const login=await fetch(app.base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Viewer',password:'shell-test-viewer'})});assert.equal(login.status,200);
 const Cookie=login.headers.get('set-cookie').split(';')[0],frame={Cookie,'Sec-Fetch-Dest':'iframe'};
 const sales=await fetch(app.base+'/sales',{headers:frame});assert.equal(sales.status,200);assert.ok(script(await sales.text(),'sales'));
 for(const [route,destination] of [['/','/home'],['/settings','/home'],['/admin/accounts','/']]){const denied=await fetch(app.base+route,{headers:frame,redirect:'manual'});assert.equal(denied.status,303);assert.equal(denied.headers.get('location'),destination);}
 const changed=await fetch(app.base+'/api/permission-levels/'+role.id,{method:'PUT',headers,body:JSON.stringify({revision:levels.revision,scope:'company',name:'Home only',level:10,permissions:['home.view']})});assert.equal(changed.status,200);
 const restricted=await fetch(app.base+'/sales?__opstack_content=1',{headers:{Cookie},redirect:'manual'});assert.equal(restricted.status,303);assert.equal(restricted.headers.get('location'),'/home');
 const session=await(await fetch(app.base+'/api/session',{headers:{Cookie}})).json();assert.equal(session.role,role.id);assert.equal(session.roleName,'Home only');assert.deepEqual(session.permissions,['home.view']);
});
