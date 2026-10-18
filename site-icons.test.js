const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createServer}=require('./server');
const {saveAdmin,saveUser}=require('./auth');

async function fixture(t,configured=false){
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-icons-'));
  if(configured){
    await saveAdmin(dir,'Office','test-office-password');
    await saveUser(dir,'Staff','test-staff-password');
  }
  const server=createServer(dir);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});});
  return {dir,url:'http://127.0.0.1:'+server.address().port};
}

test('website icons are public PNGs with revalidated caching before account setup',async t=>{
  const {url}=await fixture(t);
  const source=await fs.readFile(path.join(__dirname,'public/assets/branding/opstack-icon.png'));
  assert.deepEqual(source.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
  assert.equal(source.readUInt32BE(16),source.readUInt32BE(20),'home-screen source is square');
  for(const route of ['/favicon.png','/apple-touch-icon.png']){
    const response=await fetch(url+route,{redirect:'manual'});
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'image/png');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.equal(response.headers.get('cache-control'),'public, max-age=0, must-revalidate');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),source);
    const cached=await fetch(url+route,{headers:{'If-None-Match':response.headers.get('etag')}});
    assert.equal(cached.status,304);
    assert.equal((await cached.arrayBuffer()).byteLength,0);
  }
});

test('setup, sign-in and signed-in pages share the platform icon regardless of company logos',async t=>{
  const fresh=await fixture(t);
  const {dir,url}=await fixture(t,true);
  const icon=await fs.readFile(path.join(__dirname,'public/assets/branding/opstack-icon.png'));
  const version=crypto.createHash('sha256').update(icon).digest('hex');
  function check(markup){
    assert.ok(markup.includes('<link rel="icon" type="image/png" href="/favicon.png?v='+version+'">'));
    assert.ok(markup.includes('<link rel="apple-touch-icon" href="/apple-touch-icon.png?v='+version+'">'));
  }
  check(await(await fetch(fresh.url+'/setup')).text());
  const companyLogo='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  await fs.writeFile(path.join(dir,'logo.json'),JSON.stringify({type:'image/png',data:companyLogo}));
  check(await(await fetch(url+'/login')).text());
  for(const [username,password,routes] of [
    ['Office','test-office-password',['/home','/','/admin/accounts','/settings']],
    ['Staff','test-staff-password',['/home','/','/cart']]
  ]){
    const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    assert.equal(response.status,200);
    const Cookie=response.headers.get('set-cookie').split(';')[0];
    for(const route of routes){
      const page=await fetch(url+route,{headers:{Cookie},redirect:'manual'});
      assert.equal(page.status,200,username+' '+route);
      check(await page.text());
    }
  }
});
