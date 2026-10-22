const {fetchWithSetupSnooze:fetch}=require('./test-support/location-setup-snooze.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const template=require('./public/order-email-template'),{textOrder,dispatchOrder}=require('./order-delivery'),{createServer}=require('./server'),{saveAdmin,saveUser}=require('./auth');
test('supplier item lines include unit amount and SKU when present and preserve legacy item formatting',()=>{
 const item={name:'Tomato sauce',quantity:2,unitAmount:' 4 L ',sku:' SAUCE-04 ',price:3456};assert.equal(template.itemLine(item),'2 × Tomato sauce (4 L) [SKU: SAUCE-04]');
 assert.equal(template.itemLine({...item,unitAmount:'',sku:''}),'2 × Tomato sauce');assert.equal(template.itemLine({name:'Paper',quantity:1}),'1 × Paper');
 assert.equal(template.itemLine({...item,unitAmount:'',sku:'SAUCE-04'}),'2 × Tomato sauce [SKU: SAUCE-04]');assert.equal(template.itemLine({...item,sku:''}),'2 × Tomato sauce (4 L)');
 const order={orderId:'stock-order',requester:'Alex',items:[item]};for(const text of [textOrder(order),template.render(template.defaults,order).text]){assert.match(text,/2 × Tomato sauce \(4 L\) \[SKU: SAUCE-04\]/);assert.ok(!text.includes('3456'));}
 assert.match(template.render(template.defaults,{...order,items:[{...item,sku:'{{notes}}'}]}).text,/SKU: {{notes}}/);
});
test('email, SMS and both platform handoffs send only their supplier’s names, unit amounts and SKUs',async()=>{
 const items=['email','sms','albconnect','fresho'].map((id,index)=>({id,supplierId:id,supplier:id,name:'Stock '+id,quantity:index+1,unitAmount:'Box of '+(index+5),sku:'CODE-'+id,price:9876})),suppliers=items.map(item=>({id:item.id,delivery:item.id==='email'?{method:'email',contact:'supplier@example.com'}:item.id==='sms'?{method:'sms',contact:'+61400123456'}:{method:'platform',platform:item.id,contact:''}}));
 const sent=[],env={DELIVERY_EMAIL_ENABLED:'true',RESEND_API_KEY:'fake-key',ORDER_FROM_EMAIL:'orders@example.com',DELIVERY_SMS_ENABLED:'true',TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'fake-token',ORDER_SMS_FROM:'+61400111222'};
 for(const custom of [false,true]){
  const calls=[],results=await dispatchOrder({id:'mixed-'+custom,name:'Alex',locationName:'North',items},suppliers,{env:{...env,...(custom?{ORDER_EMAIL_TEMPLATE:{subject:'{{location}} order',body:'Hello {{supplier}}\n{{items}}'}}:{})},fetchImpl:async(url,options)=>{calls.push({url,...options});return {ok:true};}});
  assert.deepEqual(results.map(result=>result.status),['submitted','submitted','action_required','action_required']);assert.equal(calls.length,2);
  const messages=[JSON.parse(calls[0].body).text,new URLSearchParams(calls[1].body).get('Body'),results[2].handoff.text,results[3].handoff.text];
  for(const [index,text]of messages.entries()){assert.ok(text.includes(template.itemLine(items[index])));for(const other of items.filter((_,i)=>i!==index))assert.ok(!text.includes(other.sku));assert.ok(!text.includes('9876'));}sent.push(...messages);
 }
 assert.equal(sent.length,8);
});
test('stock unit amounts and supplier SKUs persist, validate, obey permissions and remain stable on saved orders and counts',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'stock-unit-'));await saveAdmin(dir,'Office','office-test-password');await saveUser(dir,'Member','member-test-password');let server,base;
 async function start(){server=createServer(dir);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;}
 async function login(username){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:username==='Office'?'office-test-password':'member-test-password'})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],session=await(await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json();return {session,headers:{Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':session.csrf}};}
 async function api(actor,url,method='GET',input,extra={}){const response=await fetch(base+url,{method,headers:{...actor.headers,...extra},body:input===undefined?undefined:JSON.stringify(input)});return {status:response.status,data:await response.json()};}
 try{await start();let office=await login('Office'),member=await login('Member');let catalogue=(await api(office,'/api/catalogue')).data;assert.equal(catalogue.products.find(item=>item.id==='paper').unitAmount,'');
  const input={name:'Tomato sauce',supplierId:'office',unitAmount:' 4 L ',sku:' SAUCE-04 ',category:'Dry',price:12.5,description:'This removed field must be ignored'},created=await api(office,'/api/products','POST',input);assert.equal(created.status,201);const id=created.data.id;assert.equal(created.data.unitAmount,'4 L');assert.equal(created.data.sku,'SAUCE-04');assert.ok(!Object.hasOwn(created.data,'description'));
  for(const key of ['unitAmount','sku'])for(const invalid of [5,null,{},'bad\nline','bad\rline','bad\u2028line','x'.repeat(key==='sku'?61:81)])assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,[key]:invalid})).status,400,key);
  for(const method of ['POST','PUT'])assert.equal((await api(member,'/api/products'+(method==='PUT'?'/'+id:''),method,input)).status,403);
  const saved=(await api(member,'/api/orders','POST',{items:[{id,quantity:2,sku:'FORGED',unitAmount:'999 kg',price:1}]})).data;assert.equal(saved.total,2500);assert.equal(saved.items[0].sku,'SAUCE-04');assert.equal(saved.items[0].unitAmount,'4 L');
  const count=(await api(member,'/api/stock-counts','POST',{countDate:'2026-10-11',items:[{id,quantity:1}]})).data;assert.equal(count.items[0].unitAmount,'4 L');assert.ok(!Object.hasOwn(count.items[0],'description'));
  const {unitAmount,sku,...legacyInput}=input;assert.equal((await api(office,'/api/products/'+id,'PUT',legacyInput)).status,200);catalogue=(await api(office,'/api/catalogue')).data;assert.equal(catalogue.products.find(item=>item.id===id).unitAmount,'4 L');assert.equal(catalogue.products.find(item=>item.id===id).sku,'SAUCE-04');
  assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,unitAmount:'Box of 6',sku:'NEW-SKU'})).status,200);assert.equal((await api(member,'/api/orders/'+saved.id)).data.items[0].sku,'SAUCE-04');assert.equal((await api(member,'/api/orders/'+saved.id)).data.items[0].unitAmount,'4 L');assert.equal((await api(member,'/api/stock-counts/'+count.id)).data.items[0].unitAmount,'4 L');
  await new Promise(resolve=>server.close(resolve));await start();office=await login('Office');member=await login('Member');assert.equal((await api(member,'/api/catalogue')).data.products.find(item=>item.id===id).unitAmount,'Box of 6');
  assert.equal((await api(office,'/api/products/'+id,'PUT',{...input,unitAmount:'',sku:''})).status,200);const plain=(await api(member,'/api/orders','POST',{items:[{id,quantity:3}]})).data;assert.equal(plain.items[0].sku,'');assert.equal(plain.items[0].unitAmount,'');assert.equal(template.itemLine(plain.items[0]),'3 × Tomato sauce');
  const company=(await api(office,'/api/companies','POST',{name:'Other business',locationName:'Other store'})).data;assert.ok(!(await api(office,'/api/catalogue','GET',undefined,{'X-Location-Id':company.locationId})).data.products.some(item=>item.id===id));
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
