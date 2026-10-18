const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'public/access.js'),'utf8');
function page(fetch,locationId='store-one'){
  const window={appBootstrap:{access:{role:'user'}},appLocationId:locationId,addEventListener(){}};
  const document={documentElement:{dataset:{}},body:{},querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
  vm.runInNewContext(source,{window,document,location:{pathname:'/home'},permissionModel:{can:()=>true,defaults:[]},MutationObserver:class{observe(){}},fetch,structuredClone,queueMicrotask});
  return window.appAccess;
}

test('page components share one initial session request and receive independent copies',async()=>{
  let requests=0,complete;
  const pending=new Promise(resolve=>complete=resolve);
  const access=page(async(url,options)=>{
    requests++;assert.equal(url,'/api/session');assert.equal(options.cache,'no-store');assert.equal(options.headers['X-Location-Id'],'store-one');
    await pending;return Response.json({id:'staff',csrf:'test-token',locations:[{id:'store-one'}]});
  });
  const first=access.initialSession(),second=access.initialSession();assert.equal(requests,1);complete();
  const [a,b]=await Promise.all([first,second]);a.locations[0].id='changed';
  assert.equal(b.locations[0].id,'store-one');assert.equal((await access.initialSession()).locations[0].id,'store-one');assert.equal(requests,1);
});

test('failed initial reads can retry, and a new page or location fetches a fresh session',async()=>{
  let requests=0;
  const access=page(async()=>{requests++;return requests===1?new Response('',{status:503}):Response.json({id:'first-user'});});
  await assert.rejects(access.initialSession(),/Unable to load/);
  assert.equal((await access.initialSession()).id,'first-user');assert.equal(requests,2);
  const nextPage=page(async(url,options)=>{requests++;assert.equal(options.headers['X-Location-Id'],'store-two');return Response.json({id:'second-user'});},'store-two');
  assert.equal((await nextPage.initialSession()).id,'second-user');assert.equal(requests,3);
});
