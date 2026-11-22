const {test}=require('node:test'),assert=require('node:assert/strict'),model=require('./public/stock-count-groups');
test('area and supplier grouping partition the same immutable count snapshots without changing units or quantities',()=>{
 const items=Object.freeze([Object.freeze({id:'a',name:'Milk',stockCountGroup:'dry',supplierId:'one',supplier:'One',quantity:0}),Object.freeze({id:'b',name:'Pita',stockCountGroup:'freezer',supplierId:'one',supplier:'One',quantity:1.125,countedQuantity:22.5,countUnit:Object.freeze({name:'Sleeves',perUnit:20})}),Object.freeze({id:'c',name:'Chicken',supplierId:'two',supplier:'Two',quantity:3})]),before=JSON.stringify(items);
 for(const by of ['area','supplier']){const sections=model.sections(items,by),result=sections.flatMap(section=>section.items);assert.deepEqual(result.map(item=>item.id).sort(),['a','b','c']);for(const section of sections)for(const item of section.items){assert.equal(model.key(item,by),section.id);assert.strictEqual(item,items.find(saved=>saved.id===item.id));}}
 assert.equal(JSON.stringify(items),before);assert.equal(model.sections(items,'area').find(section=>section.id==='dry').items[0].id,'a');
});
test('supplier grouping separates equal names by supplier identity and keeps missing suppliers visible',()=>{
 const items=[{id:'a',supplierId:'one',supplier:'Same name'},{id:'b',supplierId:'two',supplier:'Same name'},{id:'c'},{id:'d',supplierId:'unassigned'},{id:'e',supplierId:'removed',supplier:'Saved supplier name'}],sections=model.sections(items,'supplier');assert.equal(sections.length,5);assert.equal(new Set(sections.map(s=>s.id)).size,5);assert.equal(sections.find(s=>s.items[0].id==='c').name,'Unassigned supplier');assert.equal(sections.find(s=>s.items[0].id==='d').name,'Supplier removed');assert.equal(sections.find(s=>s.items[0].id==='e').name,'Saved supplier name');
});
test('empty counts and saved supplier names remain read-only display data',()=>{
 assert.equal(model.sections([],'area').length,model.groups.length+1);assert.equal(model.sections([],'area').at(-1).id,'none');assert.deepEqual(model.sections([],'supplier'),[]);const name='<b>Original supplier & Co</b>',items=[{id:'a',supplierId:'one',supplier:name}];assert.equal(model.sections(items,'supplier')[0].name,name);assert.deepEqual(model.sections(items,'unsupported'),model.sections(items,'area'));
});

test('custom group lists resolve saved, deleted and automatic groups, and saved counts keep their original names',()=>{
 const list=[{id:'front',name:'Front fridge'},{id:'dry',name:'Dry shelf'}];
 assert.equal(model.resolve({name:'Chicken'},list),'none','an automatic area the company removed is Not grouped');
 assert.equal(model.resolve({name:'Rice'},list),'dry');assert.equal(model.resolve({stockCountGroup:'front'},list),'front');assert.equal(model.resolve({stockCountGroup:'gone'},list),'none');assert.equal(model.resolve({stockCountGroup:'none'}),'none');
 assert.equal(model.resolve({stockCountGroup:'freezer'}),'freezer','companies without their own list keep the built-in areas');
 const saved=model.sections([{id:1,stockCountGroup:'freezer'},{id:2,stockCountGroup:'old',stockCountGroupName:'Old shelf'},{id:3,stockCountGroup:'front'}],'area',list,true).map(section=>[section.id,section.name,section.items.map(item=>item.id)]);
 assert.deepEqual(saved,[['front','Front fridge',[3]],['dry','Dry shelf',[]],['freezer','Freezer Stock',[1]],['old','Old shelf',[2]],['none','Not grouped',[]]]);
 assert.deepEqual(model.normalizeList([{name:' Front  fridge '},{id:'dry',name:'Dry'}]),[{id:'front-fridge',name:'Front fridge'},{id:'dry',name:'Dry'}]);
 for(const bad of [[],[{name:''}],[{name:'A'},{name:'a'}],[{name:'x'.repeat(41)}],Array.from({length:41},(_,i)=>({name:'G'+i}))])assert.throws(()=>model.normalizeList(bad));
});
test('companies save their own count groups and item choices; counts snapshot the group name',async t=>{
 const crypto=require('node:crypto'),{fixture}=require('./test-support/roster-hourly-fixture.cjs');const f=await fixture({seed:false});t.after(()=>f.close());
 const rice=await f.api(f.office,'/api/products','POST',{name:'Rice',supplierId:'packaging',unitAmount:'10kg',price:20}),milk=await f.api(f.office,'/api/products','POST',{name:'Milk',supplierId:'packaging',unitAmount:'2L',price:3});
 const before=await f.api(f.office,'/api/catalogue');assert.equal(before.countGroups,undefined);assert.equal(model.resolve(before.products.find(p=>p.id===milk.id),before),'cool-room');
 assert.equal((await f.request(f.staff,'/api/products/count-groups','PUT',{groups:[{name:'Front'}]})).status,403,'stock management is required');
 const saved=await f.api(f.office,'/api/products/count-groups','PUT',{revision:0,groups:[{id:'front-x1',name:'Front fridge'},{id:'dry',name:'Back shelf'}],assignments:{[milk.id]:'front-x1'}});
 assert.deepEqual(saved.groups,[{id:'front-x1',name:'Front fridge'},{id:'dry',name:'Back shelf'}]);assert.equal(saved.revision,1);
 assert.equal(saved.assignments[milk.id],'front-x1');assert.equal(saved.assignments[rice.id],'dry','items in a kept group stay there');
 const catalogue=await f.api(f.office,'/api/catalogue');assert.deepEqual(catalogue.countGroups,saved.groups);for(const product of catalogue.products)assert.ok(['front-x1','dry','none'].includes(product.stockCountGroup),product.name+' '+product.stockCountGroup);
 assert.equal((await f.request(f.office,'/api/products/count-groups','PUT',{revision:0,groups:[{name:'Stale'}]})).status,409);
 assert.equal((await f.request(f.office,'/api/products/count-groups','PUT',{revision:1,groups:[{name:'A'}],assignments:{[milk.id]:'missing'}})).status,400);
 assert.equal((await f.request(f.office,'/api/products/'+rice.id,'PUT',{name:'Rice',supplierId:'packaging',price:20,stockCountGroup:'freezer'})).status,400,'items can only use the company groups');
 await f.api(f.office,'/api/products/'+rice.id,'PUT',{name:'Rice',supplierId:'packaging',price:20,stockCountGroup:'front-x1'});
 const count=await f.api(f.staff,'/api/stock-counts','POST',{requestId:crypto.randomUUID(),countDate:'2026-10-22',items:[{id:rice.id,quantity:1},{id:milk.id,quantity:2}]});
 const record=count.record||count;assert.deepEqual(record.items.map(item=>[item.stockCountGroup,item.stockCountGroupName]),[['front-x1','Front fridge'],['front-x1','Front fridge']]);
 // Deleting a group moves its items to Not grouped; the saved count keeps the name it was counted with.
 const after=await f.api(f.office,'/api/products/count-groups','PUT',{revision:1,groups:[{id:'dry',name:'Back shelf'}]});assert.equal(after.assignments[milk.id],'none');
 const reread=await f.api(f.staff,'/api/stock-counts/'+record.id);const sections=model.sections((reread.record||reread).items,'area',after.groups,true);assert.equal(sections.find(section=>section.id==='front-x1').name,'Front fridge');
});
