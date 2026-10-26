const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const par=require('./par-levels'),rules=require('./public/stock-order-rules'),usage=require('./stock-usage'),{fixture}=require('./test-support/ai-assistance-fixture.cjs');
const dates=['2026-09-13','2026-09-20','2026-09-27','2026-10-04'],actor={id:'own'},now=new Date('2026-10-14T00:00:00Z');
const records=quantities=>dates.map((weekStart,index)=>({accountId:'own',source:'sunday_counts_and_orders',weekStart,items:[{id:'cups',status:'complete',quantity:quantities[index]}]}));

test('automatic order-when levels average up to four completed usage weeks and distinguish unknown from zero',()=>{
 const input=records([4,5,6,6]),products=[{id:'cups'}];
 for(let weeks=1;weeks<=4;weeks++){const p=par.calculate(input.slice(0,weeks),products,actor,{now}).levels.cups;assert.equal(p.orderWhenLevel,[4,4.5,5,5.25][weeks-1]);assert.equal(p.weeksRecorded,weeks);}
 const empty=par.calculate([],products,actor,{now,manualLevels:{cups:10}}).levels.cups;assert.equal(empty.orderWhenLevel,null);assert.equal(empty.level,10);assert.equal(rules.recommendation({par:empty},10,5),5);
 assert.equal(par.calculate(records([0,0,0,0]),products,actor,{now}).levels.cups.orderWhenLevel,0);
 const mixed=[...input,input[0],{...input[0],accountId:'other'},{...input[0],weekStart:'2026-09-06'},{...input[0],weekStart:'2026-10-11'}];assert.equal(par.calculate(mixed,products,actor,{now}).levels.cups.orderWhenLevel,5.25);
 const missing=input.map(r=>({...r,items:[{id:'cups',status:'missing_closing_count',quantity:null}]}));assert.equal(par.calculate(missing,products,actor,{now}).levels.cups.orderWhenLevel,null);
 assert.equal(par.calculate(input,products,actor,{now:new Date('2026-12-01T00:00:00Z')}).levels.cups.orderWhenLevel,null);
});

test('at-or-below triggers top up toward the target with native minimum/rounding rules and three-decimal count precision',()=>{
 const level=par.calculate(records([4,5,6,6]),[{id:'cups'}],actor,{now}).levels.cups,product={par:level};assert.equal(level.level,6);
 for(const[count,expected]of [[5.5,0],[5.251,0],[5.25,1],[5,1],[4.25,2],[0,6]])assert.equal(rules.recommendation(product,6,count),expected);
 assert.equal(rules.recommendation({...product,minimumOrder:15,orderRule:'multiples'},6,5.25),15);assert.equal(rules.recommendation({...product,minimumOrder:15,orderRule:'multiples'},6,5.251),0);
 assert.equal(rules.recommendation(product,6,null),null);assert.equal(rules.recommendation(product,null,0),null);
 const fractional=par.calculate(records([1.25,.5,.125,0]),[{id:'cups'}],actor,{now}).levels.cups;assert.equal(fractional.average,.46875);assert.equal(fractional.orderWhenLevel,.468);assert.equal(rules.recommendation({par:fractional},1,.469),0);assert.equal(rules.recommendation({par:fractional},1,.468),1);
 const counts=[{id:'count',accountId:'own',createdAt:'2026-10-14T01:00:00Z',items:[{id:'cups',quantity:5.5}]}];assert.equal(usage.orderingSuggestions(counts,[{id:'cups'}],actor,{cups:level}).items.cups.recommended,0);
});

test('catalogue/menu recommendations derive location order-when levels read-only from native counts and reject client overrides',async()=>{
 const f=await fixture({fetchImpl:()=>{throw Error('Unexpected provider');}});try{
  let catalogue=await f.api(f.office,'/api/catalogue');const current=catalogue.parWindow.currentWeekStart,shift=days=>new Date(Date.parse(current+'T00:00:00Z')+days*86400000).toISOString().slice(0,10),counts=[];
  for(const [index,quantity]of [30,26,21,15,9].entries())counts.push(await f.api(f.staff,'/api/stock-counts','POST',{countDate:shift(-28+index*7),items:[{id:'paper',quantity}]}));
  await f.api(f.staff,'/api/stock-counts','POST',{countDate:shift(1),items:[{id:'paper',quantity:5.5}]});const before=await fs.readFile(path.join(f.dir,'catalogue.json'),'utf8'),countBytes=await Promise.all(counts.map(c=>fs.readFile(path.join(f.dir,'stock-counts',c.id+'.json'),'utf8')));
  const get=async()=> (await f.api(f.staff,'/api/catalogue')).products.find(p=>p.id==='paper');let p=await get();assert.equal(p.par.orderWhenLevel,5.25);assert.equal(p.par.level,6);assert.equal(p.par.weeksRecorded,4);assert.equal(p.ordering.recommended,0);
  assert.equal((await f.api(f.staff,'/api/menu')).find(p=>p.id==='paper').par.orderWhenLevel,5.25);assert.equal(await fs.readFile(path.join(f.dir,'catalogue.json'),'utf8'),before);assert.deepEqual(await Promise.all(counts.map(c=>fs.readFile(path.join(f.dir,'stock-counts',c.id+'.json'),'utf8'))),countBytes);
  for(const[count,expected]of [[5.25,1],[4.25,2]]){await f.api(f.staff,'/api/stock-counts','POST',{countDate:shift(1),items:[{id:'paper',quantity:count}]});p=await get();assert.equal(p.ordering.recommended,expected);assert.equal(p.par.orderWhenLevel,5.25);}
  const other=await f.api(f.office,'/api/locations','POST',{name:'Other store',companyId:f.office.session.companyId}),headers={'X-Location-Id':other.id};assert.equal((await f.api(f.office,'/api/catalogue','GET',undefined,headers)).products.find(p=>p.id==='paper').par.orderWhenLevel,null);
  await f.api(f.office,'/api/products/paper/par','PUT',{level:10},headers);assert.equal((await f.api(f.office,'/api/catalogue','GET',undefined,headers)).products.find(p=>p.id==='paper').par.orderWhenLevel,null);
  assert.equal((await f.request(f.staff,'/api/catalogue','GET',undefined,headers)).status,403);
  const input={name:p.name,supplierId:p.supplierId,price:p.price/100,orderWhenLevel:999,par:{orderWhenLevel:999}};await f.api(f.office,'/api/products/paper','PUT',input);assert.equal((await get()).par.orderWhenLevel,5.25);assert.equal((await f.request(f.staff,'/api/products/paper','PUT',input)).status,403);
  assert.equal((await f.request(f.staff,'/api/orders','POST',{items:[{id:'paper',quantity:1}]})).status,201,'Recommendation thresholds do not block explicit manual orders');assert.equal(f.calls.length,0);
 }finally{await f.close();}
});
