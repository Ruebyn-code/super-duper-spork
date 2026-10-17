const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateDelivery,deliverSupplier,dispatchOrder,providerStatus}=require('./order-delivery'),destinations=require('./public/order-destinations');
const env={DELIVERY_SMS_ENABLED:'true',TWILIO_ACCOUNT_SID:'AC'+'a'.repeat(32),TWILIO_AUTH_TOKEN:'fake-private-token',ORDER_SMS_FROM:'+61400111222'};
const order={orderId:'order-sms',supplierId:'a',supplier:'Supplier A',requester:'Alex',locationName:'North',notes:'Deliver Monday.',items:[{name:'Olives',quantity:3,price:1200}],total:3600};
test('supplier channel validation normalises Australian mobiles and restricts portal links to the selected platform',()=>{
 assert.deepEqual(validateDelivery({method:'sms',contact:'0400 123 456'}),{method:'sms',contact:'+61400123456'});assert.equal(destinations.phone('+64 (21) 123-4567'),'+64211234567');
 for(const contact of ['', 'abc','555', '+123', '+12345678901234567','0400123456x'])assert.throws(()=>validateDelivery({method:'sms',contact}));
 assert.deepEqual(validateDelivery({method:'platform',platform:'albconnect',contact:''}),{method:'platform',platform:'albconnect',contact:'https://albconnect.com.au/storefront/'});
 assert.equal(validateDelivery({method:'platform',platform:'fresho',contact:'https://app.fresho.com/supplier/example'}).platform,'fresho');
 for(const contact of ['http://app.fresho.com','https://example.com','https://app.fresho.com.attacker.example','https://user:password@app.fresho.com','https://app.fresho.com:8443','javascript:alert(1)','https://127.0.0.1'])assert.throws(()=>validateDelivery({method:'platform',platform:'fresho',contact}));
 assert.throws(()=>validateDelivery({method:'platform',platform:'unknown',contact:''}));assert.throws(()=>validateDelivery({method:'system',contact:'https://example.com'}));
});
test('automatic texts use location Twilio credentials, encoded recipient and supplier-only content without prices',async()=>{
 const calls=[],full={id:'order-mixed',name:'Alex',locationName:'North',notes:'Next delivery',items:[{...order.items[0],supplierId:'a',supplier:'Supplier A'},{name:'Paper',supplierId:'b',supplier:'Supplier B',price:650,quantity:2}]};
 const results=await dispatchOrder(full,[{id:'a',delivery:{method:'sms',contact:'0400 123 456'}},{id:'b',delivery:{method:'platform',platform:'fresho',contact:'https://app.fresho.com/'}}],{env:{...env,ORDER_EMAIL_TEMPLATE:{subject:'{{location}} stock order',body:'Hi {{supplier}}\n{{items}}\n{{notes}}'}},fetchImpl:async(url,options)=>{calls.push({url,...options});return {ok:true};}});
 assert.deepEqual(results.map(result=>result.status),['submitted','action_required']);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.twilio.com/2010-04-01/Accounts/'+env.TWILIO_ACCOUNT_SID+'/Messages.json');assert.equal(calls[0].headers.Authorization,'Basic '+Buffer.from(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN).toString('base64'));assert.equal(calls[0].redirect,'error');
 const data=new URLSearchParams(calls[0].body);assert.equal(data.get('To'),'+61400123456');assert.equal(data.get('From'),env.ORDER_SMS_FROM);assert.equal(data.get('Body'),'North stock order\n\nHi Supplier A\n3 × Olives\nNext delivery');assert.ok(!data.get('Body').includes('1200'));assert.ok(!data.get('Body').includes('Paper'));
 assert.match(results[0].message,/receipt is not confirmed/);assert.match(results[1].handoff.text,/2 × Paper/);assert.ok(!results[1].handoff.text.includes('Olives'));assert.ok(!results[1].handoff.text.includes('650'));
});
test('SMS disabled, incomplete, oversized, rejected and uncertain submissions never claim delivery or retry',async()=>{
 const delivery={method:'sms',contact:'+61400123456'};let calls=0;const fetchImpl=async()=>{calls++;return {ok:true};};
 for(const config of [{},{...env,DELIVERY_SMS_ENABLED:'false'},{...env,TWILIO_ACCOUNT_SID:'invalid'},{...env,ORDER_SMS_FROM:''},{...env,TWILIO_AUTH_TOKEN:''}]){assert.equal(providerStatus(config).sms,false);assert.equal((await deliverSupplier(order,delivery,{env:config,fetchImpl})).status,'not_configured');}assert.equal(calls,0);
 const long=await deliverSupplier({...order,items:[{name:'x'.repeat(1600),quantity:1}]},delivery,{env,fetchImpl});assert.equal(long.status,'failed');assert.match(long.message,/no text was sent/);assert.equal(calls,0);
 assert.equal((await deliverSupplier(order,delivery,{env,fetchImpl:async()=>({ok:false,status:401})})).status,'failed');
 assert.equal((await deliverSupplier(order,delivery,{env,fetchImpl:async()=>{calls++;throw Error('timeout');}})).status,'unconfirmed');assert.equal(calls,1);
});
test('ALB Connect and Fresho create explicit manual handoffs and never send a server request',async()=>{
 for(const entry of destinations.platforms){const result=await deliverSupplier(order,{method:'platform',platform:entry.id,contact:entry.url},{env:{},fetchImpl:()=>{throw Error('Must not contact the platform');}});assert.equal(result.status,'action_required');assert.equal(result.handoff.url,entry.url);assert.match(result.handoff.text,/3 × Olives/);assert.match(result.message,/has not been sent/);assert.equal(Object.hasOwn(result,'credentials'),false);}
});
