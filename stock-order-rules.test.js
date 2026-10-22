const {fetchWithSetupSnooze:fetch}=require('./test-support/location-setup-snooze.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const rules=require('./public/stock-order-rules'),usage=require('./stock-usage'),{createServer}=require('./server'),{saveAdmin,saveUser}=require('./auth');

test('minimum and multiple rules round recommendations without changing pars, zeroes or unknown counts',()=>{
 const minimum={id:'lamb',minimumOrder:15,orderRule:'minimum'},multiples={...minimum,orderRule:'multiples'};
 for(const [product,input,expected]of [[minimum,11,15],[minimum,16,16],[multiples,11,15],[multiples,16,30],[multiples,30,30],[multiples,30.001,45],[minimum,0,0],[multiples,0,0],[{},11,11]])assert.equal(rules.round(product,input),expected);
 for(const invalid of [null,undefined,NaN,Infinity,-1,'11'])assert.equal(rules.round(minimum,invalid),null);
 assert.equal(rules.recommendation(minimum,20,9),15);assert.equal(rules.recommendation(multiples,20,4),30);assert.equal(rules.recommendation(multiples,20,3.625),30);
 assert.equal(rules.recommendation(multiples,20,20),0);assert.equal(rules.recommendation(multiples,20,25),0);assert.equal(rules.recommendation(multiples,null,1),null);assert.equal(rules.recommendation(multiples,20,null),null);
 const levels={lamb:{level:20}},counts=[{id:'count',accountId:'own',createdAt:'2026-10-11T01:00:00Z',items:[{id:'lamb',quantity:4}]}];
 assert.deepEqual(usage.orderingSuggestions(counts,[minimum],{id:'own'},levels).items.lamb,{stockCount:4,recommended:16});
 assert.deepEqual(usage.orderingSuggestions(counts,[multiples],{id:'own'},levels).items.lamb,{stockCount:4,recommended:30});assert.equal(levels.lamb.level,20);
});

test('cart rounding, decrements and maximums respect order rules without capping an oversized recommendation',()=>{
 const minimum={minimumOrder:15},multiples={...minimum,orderRule:'multiples'};
 assert.equal(rules.decrease(minimum,16),15);assert.equal(rules.decrease(minimum,15),0);assert.equal(rules.decrease(multiples,30),15);assert.equal(rules.decrease(multiples,15),0);
 assert.equal(rules.round(multiples,15+1),30);assert.equal(rules.round(minimum,15+1),16);
 assert.equal(rules.maximum(multiples),990);assert.equal(rules.round(multiples,991),1005);assert.equal(rules.recommendation(multiples,995,0),1005);assert.equal(rules.valid(multiples,1005),false);
 for(const quantity of [0,11,16,999,1.5])assert.equal(rules.valid(multiples,quantity),false);for(const quantity of [15,30,990])assert.equal(rules.valid(multiples,quantity),true);
 assert.equal(rules.maximum({minimumOrder:999,orderRule:'multiples'}),999);assert.equal(rules.round({minimumOrder:999,orderRule:'multiples'},1000),1998);assert.equal(rules.valid({},999),true);
});

test('custom cutoffs round below down and at the cutoff up, while preserving minimums and valid order units',()=>{
 const product={id:'lamb',minimumOrder:15,orderRule:'cutoff',roundingCutoff:5};
 for(const [input,expected]of [[0,0],[1,15],[11,15],[15,15],[16,15],[19,15],[20,30],[29,30],[30,30],[34,30],[35,45]])assert.equal(rules.round(product,input),expected);
 assert.equal(rules.recommendation(product,30,11),15);assert.equal(rules.recommendation(product,30,10),30);
 assert.equal(rules.recommendation(product,30,10.001),15);assert.equal(rules.recommendation(product,30,9.999),30);
 assert.equal(rules.round({...product,roundingCutoff:10},24),15);assert.equal(rules.round({...product,roundingCutoff:10},25),30);
 assert.equal(rules.round({...product,roundingCutoff:0},16),30);assert.equal(rules.round({...product,roundingCutoff:0},15),15);assert.equal(rules.round({...product,roundingCutoff:15},29),15);
 for(const mode of ['minimum','multiples','cutoff'])for(const min of [1,7,15,999])for(const input of [0,1,6,7,14,15,16,19,20,29,30,999,1000]){
  const rule={minimumOrder:min,orderRule:mode,roundingCutoff:Math.min(5,min)},rounded=rules.round(rule,input);
  assert.equal(rules.round(rule,rounded),rounded);if(input)assert.ok(rounded>=min);else assert.equal(rounded,0);
  if(mode!=='minimum')assert.equal(rounded%min,0);
 }
});

test('separate round-down and round-up cutoffs keep the gap exact and can be changed or disabled independently',()=>{
 const product={id:'lamb',minimumOrder:15,orderRule:'separate',roundDownThreshold:3,roundUpThreshold:5};
 for(const [quantity,expected]of [[0,0],[1,15],[11,15],[15,15],[16,15],[18,15],[19,19],[20,30],[29,30],[30,30],[33,30],[34,34],[35,45]])assert.equal(rules.round(product,quantity),expected);
 assert.equal(rules.round({...product,roundDownThreshold:2},18),18);assert.equal(rules.round({...product,roundDownThreshold:2},20),30);
 assert.equal(rules.round({...product,roundUpThreshold:6},20),20);assert.equal(rules.round({...product,roundUpThreshold:6},18),15);
 assert.equal(rules.round({...product,roundDownThreshold:null},18),18);assert.equal(rules.round({...product,roundDownThreshold:null},20),30);
 assert.equal(rules.round({...product,roundUpThreshold:null},20),20);assert.equal(rules.round({...product,roundUpThreshold:null},18),15);
 assert.equal(rules.round({...product,roundDownThreshold:null,roundUpThreshold:null},11),15);assert.equal(rules.round({...product,roundDownThreshold:null,roundUpThreshold:null},19),19);
 assert.equal(rules.recommendation(product,30,12),15);assert.equal(rules.recommendation(product,30,11),19);assert.equal(rules.recommendation(product,30,10),30);
 assert.equal(rules.recommendation(product,30,11.5),19);assert.equal(rules.recommendation(product,30,10.5),30);assert.equal(rules.recommendation(product,30,null),null);assert.equal(rules.recommendation(product,30,31),0);
 assert.equal(rules.maximum(product),994);assert.equal(rules.decrease(product,30),19);assert.equal(rules.decrease(product,19),15);assert.equal(rules.decrease(product,15),0);
 for(const down of [null,0,3,15])for(const up of [null,0,5,15]){
  if(down!==null&&up!==null&&down>=up)continue;
  const rule={...product,roundDownThreshold:down,roundUpThreshold:up};
  for(const quantity of [0,0.001,1,11,15,18,18.999,19,19.001,20,29.999,30,999,999.999]){
   const rounded=rules.round(rule,quantity);assert.equal(rules.round(rule,rounded),rounded);assert.equal(Number.isInteger(rounded),true);assert.ok(quantity===0?rounded===0:rounded>=15);
  }
  assert.equal(rules.valid(rule,rules.maximum(rule)),true);for(let q=rules.maximum(rule)+1;q<=999;q++)assert.equal(rules.valid(rule,q),false);
 }
});

test('order rules persist per company, require stock-management permission and enforce saved quantities on checkout',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stock-order-rules-'));await saveAdmin(dir,'Office','office-test-password');await saveUser(dir,'Member','member-test-password');let server,base;
 async function start(){server=createServer(dir,{fetchImpl:()=>{throw Error('No external order sending in tests.');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;}
 async function login(username){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username==='Office'?'office-test-password':'member-test-password'})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],session=await(await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json();return {session,headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':session.csrf}};}
 async function api(actor,url,method='GET',input,extra={}){const response=await fetch(base+url,{method,headers:{...actor.headers,...extra},body:input===undefined?undefined:JSON.stringify(input)});return {status:response.status,data:await response.json()};}
 try{
  await start();let office=await login('Office'),member=await login('Member');assert.equal((await api(office,'/api/accounts/'+member.session.id,'PUT',{username:'Member',role:'user',password:'',locationIds:[office.session.locationId],locationId:office.session.locationId})).status,200);member=await login('Member');const legacy=(await api(office,'/api/catalogue')).data.products.find(item=>item.id==='paper');assert.equal(legacy.minimumOrder,1);assert.equal(legacy.orderRule,'minimum');
  const input={name:'Lamb',supplierId:'office',category:'Meat',unitAmount:'1 kg',sku:'LAMB-KG',price:12.5,minimumOrder:15,orderRule:'minimum'},created=await api(office,'/api/products','POST',input);assert.equal(created.status,201);const id=created.data.id;
  for(const invalid of [0,-1,1.5,1000,'15',null,{}])assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,minimumOrder:invalid})).status,400);
  for(const invalid of ['',null,{},'nearest'])assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,orderRule:invalid})).status,400);
  for(const invalid of [-1,1.5,1000,'5',null,{}])assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,roundingCutoff:invalid})).status,400);
  for(const key of ['roundDownThreshold','roundUpThreshold'])for(const invalid of [-1,1.5,1000,'5',{},true])assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,[key]:invalid})).status,400);
  for(const invalid of [{roundDownThreshold:16,roundUpThreshold:null},{roundDownThreshold:null,roundUpThreshold:16},{roundDownThreshold:5,roundUpThreshold:5},{roundDownThreshold:6,roundUpThreshold:5}])assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,orderRule:'separate',...invalid})).status,400);
  assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,orderRule:'cutoff',roundingCutoff:16})).status,400);
  for(const method of ['POST','PUT'])assert.equal((await api(member,'/api/products'+(method==='PUT'?'/'+id:''),method,input)).status,403);
  const order=quantity=>({items:[{id,quantity,minimumOrder:1,orderRule:'minimum'}]});
  assert.equal((await api(member,'/api/orders','POST',order(11))).status,400);let placed=await api(member,'/api/orders','POST',order(16));assert.equal(placed.status,201);assert.equal(placed.data.total,20000);assert.equal(placed.data.items[0].quantity,16);const saved=placed.data;
  assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,orderRule:'multiples'})).status,200);
  assert.equal((await api(member,'/api/orders','POST',order(16))).status,400);placed=await api(member,'/api/orders','POST',order(30));assert.equal(placed.status,201);assert.equal(placed.data.total,37500);assert.equal(placed.data.items[0].quantity,30);assert.equal(placed.data.items[0].sku,'LAMB-KG');
  const {minimumOrder,orderRule,...oldClient}=input;assert.equal((await api(office,'/api/products/'+id,'PUT',oldClient)).status,200);let product=(await api(member,'/api/catalogue')).data.products.find(item=>item.id===id);assert.equal(product.minimumOrder,15);assert.equal(product.orderRule,'multiples');
  assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,orderRule:'cutoff',roundingCutoff:5})).status,200);assert.equal((await api(member,'/api/orders','POST',order(19))).status,400);assert.equal((await api(member,'/api/orders','POST',order(15))).status,201);
  const count=await api(member,'/api/stock-counts','POST',{countDate:'2026-10-11',items:[{id,quantity:11}]});assert.equal(count.status,201);assert.equal((await api(office,'/api/products/'+id+'/par','PUT',{level:30})).status,200);product=(await api(member,'/api/catalogue')).data.products.find(item=>item.id===id);assert.equal(product.par.level,30);assert.equal(product.ordering.stockCount,11);assert.equal(product.ordering.recommended,15);
  const company=(await api(office,'/api/companies','POST',{name:'Another company',locationName:'Another store'})).data;const other={...input,minimumOrder:4,orderRule:'multiples'},otherHeaders={'X-Location-Id':company.locationId};assert.equal((await api(office,'/api/products/'+id,'PUT',other,otherHeaders)).status,400);const supplier=(await api(office,'/api/suppliers','POST',{name:'Other supplier'},otherHeaders)).data,otherProduct=await api(office,'/api/products','POST',{...other,supplierId:supplier.id},otherHeaders);assert.equal(otherProduct.status,201);assert.equal(otherProduct.data.minimumOrder,4);assert.equal((await api(member,'/api/orders/'+saved.id)).data.items[0].quantity,16);
  await new Promise(resolve=>server.close(resolve));await start();office=await login('Office');member=await login('Member');product=(await api(member,'/api/catalogue')).data.products.find(item=>item.id===id);assert.equal(product.minimumOrder,15);assert.equal(product.orderRule,'cutoff');assert.equal(product.roundingCutoff,5);assert.equal((await api(office,'/api/catalogue','GET',undefined,otherHeaders)).data.products.find(item=>item.id===otherProduct.data.id).minimumOrder,4);
  const separate={...input,orderRule:'separate',roundDownThreshold:3,roundUpThreshold:5};assert.equal((await api(office,'/api/products/'+id,'PUT',separate)).status,200);
  product=(await api(member,'/api/catalogue')).data.products.find(item=>item.id===id);assert.equal(product.ordering.recommended,19);assert.equal(product.par.level,30);
  assert.equal((await api(member,'/api/orders','POST',order(18))).status,400);const exact=await api(member,'/api/orders','POST',order(19));assert.equal(exact.status,201);assert.equal(exact.data.total,23750);assert.equal((await api(member,'/api/orders','POST',order(20))).status,400);
  assert.equal((await api(office,'/api/products/'+id,'PUT',{...oldClient,roundUpThreshold:6})).status,200);product=(await api(member,'/api/catalogue')).data.products.find(item=>item.id===id);assert.equal(product.roundDownThreshold,3);assert.equal(product.roundUpThreshold,6);assert.equal(product.orderRule,'separate');assert.equal((await api(member,'/api/orders','POST',order(20))).status,201);
  await new Promise(resolve=>server.close(resolve));await start();office=await login('Office');member=await login('Member');product=(await api(member,'/api/catalogue')).data.products.find(item=>item.id===id);assert.equal(product.roundDownThreshold,3);assert.equal(product.roundUpThreshold,6);
  assert.equal((await api(office,'/api/products/'+id,'PUT',{...oldClient,roundDownThreshold:null})).status,200);product=(await api(member,'/api/catalogue')).data.products.find(item=>item.id===id);assert.equal(product.roundDownThreshold,null);assert.equal(product.roundUpThreshold,6);assert.equal((await api(member,'/api/orders','POST',order(18))).status,201);assert.equal((await api(member,'/api/orders/'+exact.data.id)).data.items[0].quantity,19);
  assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,minimumOrder:1,orderRule:'minimum'})).status,200);assert.equal((await api(member,'/api/orders','POST',order(1))).status,201);
 }finally{if(server?.listening)await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
