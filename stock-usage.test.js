const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');const usage=require('./stock-usage');
const products=[{id:'a',name:'First',supplierId:'supplier'},{id:'zero',name:'Zero',supplierId:'supplier'},{id:'missing',name:'Missing',supplierId:'supplier'}],session={id:'own',role:'admin'};
const count=(date,quantity,extra={})=>({id:crypto.randomUUID(),accountId:'own',countDate:date,createdAt:date+'T00:00:00Z',items:[{id:'a',quantity},{id:'zero',quantity:0}],...extra});
const order=(createdAt,quantity,extra={})=>({id:crypto.randomUUID(),requestOwnerId:'own',createdAt,status:'requested',items:[{id:'a',quantity}],...extra});
test('automatic usage includes Sunday and Saturday orders once, uses the next Sunday count, and separates adjacent cycles',()=>{
 const counts=[count('2026-10-04',10),count('2026-10-11',4),count('2026-10-18',1),count('2026-10-04',999,{accountId:'other'}),count('2026-10-05',999)];
 const sunday=order('2026-10-03T14:00:00Z',5),saturday=order('2026-10-10T12:59:59Z',2),nextSunday=order('2026-10-10T13:00:00Z',3);
 const orders=[sunday,saturday,nextSunday,sunday,order('2026-10-03T13:59:59Z',999),order('2026-10-06T00:00:00Z',999,{requestOwnerId:'other'}),order('2026-10-06T00:00:00Z',999,{status:'cancelled'}),order('2026-10-06T00:00:00Z',999,{requestOwnerId:undefined})];
 const [first,second]=usage.derive(counts,orders,products,session,['2026-10-04','2026-10-11']);assert.equal(first.items[0].opening,10);assert.equal(first.items[0].ordered,7);assert.equal(first.items[0].available,17);assert.equal(first.items[0].closing,4);assert.equal(first.items[0].quantity,13);assert.equal(first.items[0].orderCount,2);assert.equal(second.items[0].ordered,3);assert.equal(second.items[0].quantity,6);assert.equal(first.items[1].quantity,0);assert.equal(first.items[2].status,'missing_both_counts');
});
test('latest per-item Sunday counts correct usage; missing and negative stock do not become zero',()=>{
 const older=count('2026-10-04',10),newer=count('2026-10-04',12,{createdAt:'2026-10-05T10:00:00Z'}),partial=count('2026-10-04',99,{createdAt:'2026-10-05T11:00:00Z',items:[{id:'zero',quantity:0}]}),closing=count('2026-10-11',15);
 let result=usage.derive([older,newer,partial,closing],[],products,session,['2026-10-04'])[0];assert.equal(result.items[0].opening,12);assert.equal(result.items[0].calculatedUsage,-3);assert.equal(result.items[0].quantity,null);assert.equal(result.items[0].status,'negative_usage');
 result=usage.derive([older,newer,partial,closing],[order('2026-10-05T00:00:00Z',5)],products,session,['2026-10-04'])[0];assert.equal(result.items[0].quantity,2);
 result=usage.derive([older],[],products,session,['2026-10-04'])[0];assert.equal(result.items[0].status,'missing_closing_count');assert.equal(result.items[0].available,10);
 result=usage.derive([closing],[],products,session,['2026-10-04'])[0];assert.equal(result.items[0].status,'missing_opening_count');assert.equal(result.items[0].available,null);
 const fraction=usage.derive([count('2026-10-04',1.125),count('2026-10-11',0.5)],[],products,session,['2026-10-04'])[0];assert.equal(fraction.items[0].quantity,0.625);
});
test('history reader refreshes new/corrected records, ignores credentials and manual usage, and rebuilds after restart',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'auto-usage-'));try{
 await fs.mkdir(path.join(dir,'stock-counts'));await fs.mkdir(path.join(dir,'stock-usage'));await fs.writeFile(path.join(dir,'accounts.json'),'NOT AN ORDER');await fs.writeFile(path.join(dir,'stock-usage','old-week.json'),'NOT AUTOMATIC USAGE');
 const counts=[count('2026-10-04',20),count('2026-10-11',5)],placed=order('2026-10-07T00:00:00Z',3);
 for(const record of counts)await fs.writeFile(path.join(dir,'stock-counts',record.id+'.json'),JSON.stringify(record));await fs.writeFile(path.join(dir,placed.id+'.json'),JSON.stringify(placed));
 const reader=usage.createReader();let result=await usage.report(dir,session,products,'2026-10-04',{reader});assert.equal(result.record.items[0].quantity,18);result=await usage.report(dir,session,products,'2026-10-04',{reader});assert.equal(result.record.items[0].quantity,18);
 const correction=count('2026-10-11',8,{createdAt:'2026-10-12T00:00:00Z'});await fs.writeFile(path.join(dir,'stock-counts',correction.id+'.json'),JSON.stringify(correction));placed.items[0].quantity=5;await fs.writeFile(path.join(dir,placed.id+'.json'),JSON.stringify(placed));result=await usage.report(dir,session,products,'2026-10-04',{reader});assert.equal(result.record.items[0].quantity,17);
 const restored=await usage.report(dir,session,products,'2026-10-04',{reader:usage.createReader()});assert.equal(restored.record.items[0].quantity,17);const other=await usage.report(dir,{id:'other',role:'admin'},products,'2026-10-04',{reader});assert.equal(other.record.items[0].status,'missing_both_counts');assert.equal(other.record.items[0].ordered,0);
 await assert.rejects(usage.report(dir,session,products,'2026-10-05',{reader}),error=>error.status===400);assert.equal(await fs.readFile(path.join(dir,'stock-usage','old-week.json'),'utf8'),'NOT AUTOMATIC USAGE');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('ordering shows the latest account stock take and par-minus-count recommendations, with zero, fractional and omitted counts distinct',()=>{
 const {orderingSuggestions}=usage;const own={id:'own',role:'admin'};const items=['a','zero','missing','fraction','over','no-par'].map(id=>({id}));
 const history=[{id:'old',accountId:'own',createdAt:'2026-10-11T10:00:00Z',countDate:'2026-10-11',items:[{id:'a',quantity:99},{id:'missing',quantity:8}]},{id:'new',accountId:'own',createdAt:'2026-10-14T10:00:00Z',countDate:'2026-10-14',items:[{id:'a',quantity:2},{id:'zero',quantity:0},{id:'fraction',quantity:2.625},{id:'over',quantity:9},{id:'no-par',quantity:1}]},{id:'other',accountId:'other',createdAt:'2026-10-14T11:00:00Z',countDate:'2026-10-14',items:[{id:'a',quantity:999}]}];
 const levels=Object.fromEntries(items.map(item=>[item.id,{level:item.id==='no-par'?null:7}]));const result=orderingSuggestions(history,items,own,levels);
 assert.equal(result.stockTake.id,'new');assert.equal(result.stockTake.countDate,'2026-10-14');assert.deepEqual(result.items.a,{stockCount:2,recommended:5});assert.deepEqual(result.items.zero,{stockCount:0,recommended:7});assert.deepEqual(result.items.fraction,{stockCount:2.625,recommended:5});assert.deepEqual(result.items.over,{stockCount:9,recommended:0});assert.deepEqual(result.items.missing,{stockCount:null,recommended:null});assert.deepEqual(result.items['no-par'],{stockCount:1,recommended:null});
 const empty=orderingSuggestions(history,items,{id:'unknown'},levels);assert.equal(empty.stockTake,null);assert.equal(empty.items.a.stockCount,null);assert.equal(empty.items.a.recommended,null);
});
