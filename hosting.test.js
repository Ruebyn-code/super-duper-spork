const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createServer}=require('./server');
const {saveAdmin}=require('./auth');
const {dataDirectory,appOrigin,runtimeConfig,prepareDataDirectory}=require('./runtime-config');

async function serve(t,dir,options){
  const server=createServer(dir,options);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
async function temp(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-hosting-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
const loginOptions=origin=>({method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify({username:'existing-admin',password:'existing-password-for-migration'})});

test('hosting config keeps local defaults and validates origins and ports',()=>{
  assert.equal(dataDirectory({}),path.join(__dirname,'data'));
  assert.equal(dataDirectory({DATA_DIR:'/tmp/opstack-private'}),'/tmp/opstack-private');
  assert.equal(appOrigin('https://orders.example.com/'),'https://orders.example.com');
  for(const origin of ['bad-url','ftp://orders.example.com','https://name:secret@example.com','https://example.com/login','https://example.com?x=1','https://example.com/#x'])assert.throws(()=>appOrigin(origin),/APP_ORIGIN/);
  assert.equal(runtimeConfig({}).port,3000);
  for(const port of ['0','65536','abc','1.5'])assert.throws(()=>runtimeConfig({PORT:port}),/PORT/);
  assert.throws(()=>runtimeConfig({MIGRATION_MODE:'yes'}),/MIGRATION_MODE/);
});

test('Railway refuses ephemeral storage and requires HTTPS before enabling access',()=>{
  const env={RAILWAY_ENVIRONMENT_ID:'test-environment',DATA_DIR:'/data',APP_ORIGIN:'https://orders.example.com'};
  assert.throws(()=>runtimeConfig(env),/Attach a Railway volume/);
  const mounted={...env,RAILWAY_VOLUME_MOUNT_PATH:'/data'};
  assert.equal(runtimeConfig(mounted).dataDir,'/data');
  assert.equal(runtimeConfig({...mounted,DATA_DIR:'/data/company'}).dataDir,'/data/company');
  for(const dataDir of ['/app/data','/data-other','/data/../ephemeral'])assert.throws(()=>runtimeConfig({...mounted,DATA_DIR:dataDir}),/inside the attached/);
  assert.throws(()=>runtimeConfig({...mounted,APP_ORIGIN:''}),/public https/);
  assert.throws(()=>runtimeConfig({...mounted,APP_ORIGIN:'http://orders.example.com'}),/public https/);
  assert.equal(runtimeConfig({...mounted,APP_ORIGIN:'',MIGRATION_MODE:'1'}).migrationMode,true);
  assert.equal(dataDirectory({RAILWAY_VOLUME_MOUNT_PATH:'/persist'}),'/persist');
});

test('storage readiness checks are repeatable and preserve existing files',async t=>{
  const dir=await temp(t),dataDir=path.join(dir,'private');
  await prepareDataDirectory(dataDir);
  await fs.writeFile(path.join(dataDir,'existing.json'),'existing record');
  await prepareDataDirectory(dataDir);
  assert.deepEqual(await fs.readdir(dataDir),['existing.json']);
  assert.equal(await fs.readFile(path.join(dataDir,'existing.json'),'utf8'),'existing record');
  await assert.rejects(()=>prepareDataDirectory(path.join(dataDir,'existing.json')));
});

test('migration mode allows health checks but blocks all app reads and writes without initialising data',async t=>{
  const dir=await temp(t),{url}=await serve(t,dir,{migrationMode:true});
  const response=await fetch(url+'/healthz',{headers:{Host:'healthcheck.railway.app'}});
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,migrationMode:true});
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(url+'/healthz',{method:'HEAD'})).status,200);
  for(const route of ['/','/login','/setup','/api/session','/api/orders','/logo']){
    const res=await fetch(url+route);assert.equal(res.status,503);assert.equal(res.headers.get('retry-after'),'60');
  }
  assert.equal((await fetch(url+'/api/login',loginOptions())).status,503);
  assert.equal((await fetch(url+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
  assert.deepEqual(await fs.readdir(dir),[]);
});

test('HTTPS proxy login uses the configured origin and a Secure session cookie',async t=>{
  const dir=await temp(t);await saveAdmin(dir,'existing-admin','existing-password-for-migration');
  const {url}=await serve(t,dir,{publicOrigin:'https://orders.example.com'});
  const denied=await fetch(url+'/api/login',{...loginOptions('https://attacker.example'),headers:{...loginOptions().headers,Origin:'https://attacker.example','X-Forwarded-Proto':'https','X-Forwarded-Host':'attacker.example'}});
  assert.equal(denied.status,403);assert.equal(denied.headers.get('set-cookie'),null);
  assert.equal((await fetch(url+'/api/login',loginOptions(url))).status,403);
  const response=await fetch(url+'/api/login',loginOptions('https://orders.example.com'));
  assert.equal(response.status,200);
  assert.match(response.headers.get('set-cookie'),/; Secure/);
  assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);
  const Cookie=response.headers.get('set-cookie').split(';')[0];
  const session=await(await fetch(url+'/api/session',{headers:{Cookie}})).json();
  assert.equal(session.username,'existing-admin');
  const logout=await fetch(url+'/api/logout',{method:'POST',headers:{Cookie,'X-CSRF-Token':session.csrf}});
  assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0; Secure/);
  assert.equal((await fetch(url+'/healthz',{headers:{Host:'healthcheck.railway.app'}})).status,200);
});

test('local HTTP login ignores spoofed proxy headers and remains usable without hosting config',async t=>{
  const dir=await temp(t);await saveAdmin(dir,'existing-admin','existing-password-for-migration');
  const {url}=await serve(t,dir);
  const spoofed=await fetch(url+'/api/login',{...loginOptions('https://attacker.example'),headers:{...loginOptions().headers,Origin:'https://attacker.example','X-Forwarded-Proto':'https','X-Forwarded-Host':'attacker.example'}});
  assert.equal(spoofed.status,403);
  const response=await fetch(url+'/api/login',loginOptions(url));
  assert.equal(response.status,200);assert.doesNotMatch(response.headers.get('set-cookie'),/; Secure/);
});

test('existing accounts, placed records and uploaded files survive moving and restarting the data folder',async t=>{
  const dir=await temp(t),original=path.join(dir,'mac-data'),volume=path.join(dir,'railway-data');
  await saveAdmin(original,'existing-admin','existing-password-for-migration');
  const {url,server}=await serve(t,original);
  const response=await fetch(url+'/api/login',loginOptions());
  const Cookie=response.headers.get('set-cookie').split(';')[0];
  const session=await(await fetch(url+'/api/session',{headers:{Cookie}})).json();
  const headers={Cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'};
  const placed=await fetch(url+'/api/orders',{method:'POST',headers,body:JSON.stringify({name:'Migration check',items:[{id:'paper',quantity:2}]})});
  assert.equal(placed.status,201);const order=await placed.json();
  await fs.mkdir(path.join(original,'private-upload'),{recursive:true});
  const upload=Buffer.from([0,1,2,128,254,255]);await fs.writeFile(path.join(original,'private-upload','invoice.pdf'),upload);
  await new Promise(resolve=>server.close(resolve));
  await fs.cp(original,volume,{recursive:true});
  const moved=await serve(t,volume,{publicOrigin:'https://orders.example.com'});
  const signedIn=await fetch(moved.url+'/api/login',loginOptions('https://orders.example.com'));assert.equal(signedIn.status,200);
  const movedCookie=signedIn.headers.get('set-cookie').split(';')[0];
  const savedResponse=await fetch(moved.url+'/api/orders/'+order.id,{headers:{Cookie:movedCookie}});
  assert.equal(savedResponse.status,200);const saved=await savedResponse.json();
  assert.equal(saved.id,order.id);assert.equal(saved.total,order.total);
  assert.deepEqual(await fs.readFile(path.join(volume,'private-upload','invoice.pdf')),upload);
  assert.equal((await fetch(moved.url+'/setup',{redirect:'manual'})).headers.get('location'),'/login');
});
