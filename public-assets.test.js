const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {gunzipSync}=require('node:zlib');
const {createServer}=require('./server');
const {createPublicAssets}=require('./public-assets');

async function temporary(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-public-assets-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
async function serve(t,server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));return 'http://127.0.0.1:'+server.address().port;}
function raw(url,headers={},method='GET'){return new Promise((resolve,reject)=>{http.request(url,{headers,method},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,data:Buffer.concat(chunks)}));}).on('error',reject).end();});}

test('public scripts and styles bypass account storage, but HTML and APIs stay private',async t=>{
  const dir=await temporary(t),url=await serve(t,createServer(dir));
  for(const route of ['/style.css','/app.js','/theme.js','/fonts/Opsilon-xRj8m.ttf'])assert.equal((await fetch(url+route)).status,200);
  assert.deepEqual(await fs.readdir(dir),[],'static requests do not initialise or read account state');
  const page=await fetch(url+'/home',{redirect:'manual'});assert.equal(page.status,303);assert.equal(page.headers.get('location'),'/login');assert.equal(page.headers.get('cache-control'),'no-store');
  const api=await fetch(url+'/api/catalogue');assert.equal(api.status,401);assert.equal(api.headers.get('cache-control'),'no-store');
  assert.equal((await fetch(url+'/../accounts.json')).status,404);
});

test('page asset URLs change with their contents and only matching versions are immutable',async t=>{
  const dir=await temporary(t);await fs.writeFile(path.join(dir,'app.js'),'console.log("first version");');
  const assets=createPublicAssets(dir,{'/app.js':'app.js','/home':'home.html'});
  const original='<script src="/app.js"></script><link href=\'/app.js?old=1#part\'><a href="/home">Home</a><link href="//external.example/app.js"><img src="/logo?company=other">';
  const first=await assets.versionMarkup(original),version=(await assets.read('app.js')).etag.slice(1,-1);
  assert.ok(first.includes('src="/app.js?v='+version+'"'));
  assert.ok(first.includes("href='/app.js?old=1&v="+version+"#part'"));
  for(const unchanged of ['<a href="/home">','href="//external.example/app.js"','src="/logo?company=other"'])assert.ok(first.includes(unchanged));
  const url=await serve(t,http.createServer(async(req,res)=>{await assets.serve(req,res,new URL(req.url,'http://localhost'));}));
  assert.match((await fetch(url+'/app.js?v='+version)).headers.get('cache-control'),/immutable/);
  await fs.writeFile(path.join(dir,'app.js'),'console.log("a different second version");');
  const second=await assets.versionMarkup(original);assert.notEqual(second,first);
  const stale=await fetch(url+'/app.js?v='+version);assert.match(stale.headers.get('cache-control'),/must-revalidate/);assert.match(await stale.text(),/second version/);
  assert.match((await fetch(url+'/app.js')).headers.get('cache-control'),/must-revalidate/);
});

test('gzip reduces shared downloads, respects quality preferences and revalidates the correct representation',async t=>{
  const dir=await temporary(t),source='body { color: blue; background: white; }\n'.repeat(500);
  await fs.writeFile(path.join(dir,'style.css'),source);
  const assets=createPublicAssets(dir,{'/style.css':'style.css'});
  const url=await serve(t,http.createServer(async(req,res)=>{await assets.serve(req,res,new URL(req.url,'http://localhost'));}));
  const zipped=await raw(url+'/style.css',{'Accept-Encoding':'br, gzip'});
  assert.equal(zipped.status,200);assert.equal(zipped.headers['content-encoding'],'gzip');assert.equal(zipped.headers.vary,'Accept-Encoding');
  assert.equal(gunzipSync(zipped.data).toString(),source);assert.ok(zipped.data.length<Buffer.byteLength(source)/4);
  const plain=await raw(url+'/style.css',{'Accept-Encoding':'gzip;q=0, *;q=1'});
  assert.equal(plain.headers['content-encoding'],undefined);assert.equal(plain.data.toString(),source);assert.notEqual(plain.headers.etag,zipped.headers.etag);
  const cached=await raw(url+'/style.css',{'Accept-Encoding':'gzip','If-None-Match':zipped.headers.etag});assert.equal(cached.status,304);assert.equal(cached.data.length,0);
  const different=await raw(url+'/style.css',{'Accept-Encoding':'identity','If-None-Match':zipped.headers.etag});assert.equal(different.status,200);assert.equal(different.data.toString(),source);
  const head=await raw(url+'/style.css',{'Accept-Encoding':'gzip'},'HEAD');assert.equal(head.status,200);assert.equal(head.data.length,0);assert.equal(Number(head.headers['content-length']),zipped.data.length);
});
