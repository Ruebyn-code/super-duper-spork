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
 assert.equal(model.sections([],'area').length,model.groups.length);assert.deepEqual(model.sections([],'supplier'),[]);const name='<b>Original supplier & Co</b>',items=[{id:'a',supplierId:'one',supplier:name}];assert.equal(model.sections(items,'supplier')[0].name,name);assert.deepEqual(model.sections(items,'unsupported'),model.sections(items,'area'));
});
