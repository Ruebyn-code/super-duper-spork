const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const units=require('./public/stock-count-units'),{fixture}=require('./test-support/ai-assistance-fixture.cjs'),usage=require('./stock-usage');
const sleeves={name:'Sleeves',perUnit:20};

test('counting units convert sleeves to the existing three-decimal ordered quantity',()=>{
 assert.equal(units.quantity(20,sleeves),1);assert.equal(units.quantity(10,sleeves),0.5);assert.equal(units.quantity(25,sleeves),1.25);assert.equal(units.quantity(0,sleeves),0);assert.equal(units.quantity(0.5,sleeves),0.025);
 assert.equal(units.quantity(1,{name:'Packs',perUnit:3}),0.333);assert.equal(units.quantity(1.125,null),1.125);
 assert.deepEqual(units.normalize({...sleeves,name:' Sleeves ',forged:true}),sleeves);
 for(const unit of [null,[],{},'Sleeves',{...sleeves,name:''},{...sleeves,name:'x'.repeat(31)},{...sleeves,name:'Sleeves\n'},{...sleeves,perUnit:0},{...sleeves,perUnit:1.5},{...sleeves,perUnit:'20'},{...sleeves,perUnit:1000001}])assert.equal(units.valid(unit),false);
});

test('native stock counts preserve entered sleeves and frozen box quantities for usage, recommendations and retries',async()=>{
 const f=await fixture({fetchImpl:()=>{throw Error('Unexpected provider request');}});
 try{
  const input={name:'Small chip cups',supplierId:'packaging',unitAmount:'Box of 1,000 cups (20 × 50)',price:25,category:'Packaging',countUnit:sleeves};
  const product=await f.api(f.office,'/api/products','POST',input),id=product.id;
  await f.api(f.office,'/api/products/'+id+'/par','PUT',{level:3});
  const request={requestId:crypto.randomUUID(),countDate:'2026-10-18',items:[{id,quantity:20,countUnit:sleeves,unitAmount:'FORGED',countedQuantity:999}]};
  const first=await f.api(f.staff,'/api/stock-counts','POST',request);
  assert.equal(first.items[0].quantity,1);assert.equal(first.items[0].countedQuantity,20);assert.deepEqual(first.items[0].countUnit,sleeves);assert.equal(first.items[0].unitAmount,input.unitAmount);
  const second=await f.api(f.staff,'/api/stock-counts','POST',{countDate:'2026-10-25',items:[{id,quantity:10,countUnit:sleeves}]});
  assert.equal(second.items[0].quantity,0.5);
  const derived=usage.derive([first,second],[],[product],f.staff.session,['2026-10-18'])[0].items[0];
  assert.equal(derived.opening,1);assert.equal(derived.closing,0.5);assert.equal(derived.quantity,0.5);
  const suggestions=usage.orderingSuggestions([second],[product],f.staff.session,{[id]:{level:3}}).items[id];assert.equal(suggestions.stockCount,0.5);assert.equal(suggestions.recommended,3);
  const bytes=await fs.readFile(path.join(f.dir,'stock-counts',first.id+'.json'),'utf8');
  await f.api(f.office,'/api/products/'+id,'PUT',{...input,unitAmount:'Box of 2,000',countUnit:{name:'Sleeves',perUnit:40}});
  const retry=await f.request(f.staff,'/api/stock-counts','POST',request);assert.equal(retry.status,200);assert.deepEqual(retry.data,first);
  assert.equal((await f.request(f.staff,'/api/stock-counts','POST',{...request,requestId:crypto.randomUUID()})).status,409);
  assert.equal((await f.request(f.staff,'/api/stock-counts','POST',{...request,items:[{id,quantity:21,countUnit:sleeves}]})).status,409);
  assert.deepEqual(await f.api(f.staff,'/api/stock-counts/'+first.id),first);assert.equal(await fs.readFile(path.join(f.dir,'stock-counts',first.id+'.json'),'utf8'),bytes);
  const legacy=await f.api(f.staff,'/api/stock-counts','POST',{countDate:'2026-10-25',items:[{id,quantity:1.125}]});assert.equal(legacy.items[0].quantity,1.125);assert.ok(!Object.hasOwn(legacy.items[0],'countUnit'));
  const zero=await f.api(f.staff,'/api/stock-counts','POST',{countDate:'2026-10-25',items:[{id,quantity:0,countUnit:{name:'Sleeves',perUnit:40}}]});assert.equal(zero.items[0].quantity,0);assert.equal(zero.items[0].countedQuantity,0);
  assert.equal(f.calls.length,0);
 }finally{await f.close();}
});

test('count unit settings retain stock management, scope, validation and omitted-field compatibility',async()=>{
 const f=await fixture();
 try{
  const input={name:'Cups',supplierId:'packaging',unitAmount:'Box of 1,000',price:25,countUnit:sleeves},p=await f.api(f.office,'/api/products','POST',input);
  assert.equal((await f.request(f.staff,'/api/products/'+p.id,'PUT',input)).status,403);
  for(const countUnit of [{...sleeves,perUnit:0},{...sleeves,name:'bad\nname'},[],{...sleeves,perUnit:2.5}])assert.equal((await f.request(f.office,'/api/products/'+p.id,'PUT',{...input,countUnit})).status,400);
  const {countUnit,...legacy}=input;await f.api(f.office,'/api/products/'+p.id,'PUT',legacy);assert.deepEqual((await f.api(f.staff,'/api/catalogue')).products.find(x=>x.id===p.id).countUnit,sleeves);
  const count={countDate:'2026-10-25',items:[{id:p.id,quantity:10,countUnit:sleeves}]};
  assert.equal((await f.request(f.staff,'/api/stock-counts','POST',count,{'X-CSRF-Token':'wrong'})).status,403);
  for(const item of [{...count.items[0],countUnit:null},{...count.items[0],countUnit:{...sleeves,perUnit:10}},{...count.items[0],quantity:-1},{...count.items[0],quantity:1000001},{...count.items[0],quantity:0.0001}])assert.ok([400,409].includes((await f.request(f.staff,'/api/stock-counts','POST',{...count,items:[item]})).status));
  const saved=await f.api(f.staff,'/api/stock-counts','POST',count),company=await f.api(f.office,'/api/companies','POST',{name:'Other business',locationName:'Other store'});
  assert.ok(!(await f.api(f.office,'/api/catalogue','GET',undefined,{'X-Location-Id':company.locationId})).products.some(x=>x.id===p.id));
  assert.equal((await f.request(f.office,'/api/stock-counts','POST',count,{'X-Location-Id':company.locationId})).status,400);
  await f.api(f.office,'/api/products/'+p.id,'PUT',{...input,countUnit:null});assert.equal((await f.api(f.staff,'/api/catalogue')).products.find(x=>x.id===p.id).countUnit,null);
  assert.equal((await f.api(f.staff,'/api/stock-counts/'+saved.id)).items[0].quantity,0.5);
 }finally{await f.close();}
});
