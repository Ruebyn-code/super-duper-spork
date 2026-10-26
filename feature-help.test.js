const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const model=require('./public/feature-help-model'),{articles}=require('./public/help-guides'),{fixture}=require('./test-support/delivery-planning-fixture.cjs');

test('feature help links every guide to a relevant page and selects the matching checklist/training context',async()=>{
 const known=new Set(articles.map(a=>a.id)),linked=new Set([...Object.values(model.pages).flat(),...model.common]);assert.deepEqual([...linked].sort(),[...known].sort());
 for(const file of await fs.readdir(path.join(__dirname,'public'))){if(!file.endsWith('.html'))continue;const source=await fs.readFile(path.join(__dirname,'public',file),'utf8');for(const match of source.matchAll(/data-feature-help="([^"]+)"/g))for(const id of model.resolve(match[1],'/home'))assert(known.has(id),file+': '+id);
  for(const match of source.matchAll(/<p\b[^>]*data-feature-instruction[^>]*>([\s\S]*?)<\/p>/g))assert(!/role="(?:status|alert)"/.test(match[1]),file+' must retain nested status messages');
 }
 for(const [selector,value]of model.bindings)for(const id of model.resolve(value,'/home','','Create planners with OpStack intelligence'))assert(known.has(id),selector+': '+id);
 for(const value of Object.values(model.dynamicTitles))for(const id of value.split(' '))assert(known.has(id),id);
 assert.equal(model.resolve('@checklists','/ops-management','#history')[0],'checklist-history');assert.equal(model.resolve('@checklists','/ops-management','#templates')[0],'checklist-builder');assert.equal(model.resolve('@training','/learning-centre','#builder')[0],'course-builder');assert.equal(model.resolve('@training','/learning-centre','#my-learning')[0],'take-course');assert.equal(model.resolve('@intelligence','/ops-management','','Create planners with OpStack intelligence')[0],'intelligence-planners');
});

test('context guide assets join both persistent and embedded pages while existing access remains enforced',async t=>{
 const app=await fixture();t.after(()=>app.close());
 for(const route of ['/home','/home?__opstack_content=1','/admin?__opstack_content=1','/ops-management?__opstack_content=1']){
  const response=await fetch(app.base+route,{headers:app.office.headers});assert.equal(response.status,200);const html=await response.text();for(const asset of ['feature-help.js','feature-help-model.js','feature-help.css']){assert.equal(html.split('/'+asset+'?v=').length-1,1,route+': '+asset);}
 }
 for(const asset of ['feature-help.js','feature-help-model.js','feature-help.css']){const response=await fetch(app.base+'/'+asset);assert.equal(response.status,200);assert(response.headers.get('content-type').includes(asset.endsWith('css')?'text/css':'javascript'));}
 assert.equal((await fetch(app.base+'/home',{redirect:'manual'})).status,303);assert.equal(app.calls.length,0);
});
