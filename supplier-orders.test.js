const {test}=require('node:test');const assert=require('node:assert/strict');const {splitBySupplier}=require('./supplier-orders');
test('split orders isolate each supplier and retain quantities and pending prices',()=>{
 const order={id:'order-1',name:'Buyer',phone:'0400000000',location:'Store',notes:'Delivery requested',items:[{id:'a',name:'First',supplierId:'supplier-a',supplier:'Supplier A',quantity:3,price:100},{id:'b',name:'Second',supplierId:'supplier-b',supplier:'Supplier B',quantity:2,price:500},{id:'c',name:'Third',supplierId:'supplier-a',supplier:'Supplier A',quantity:1,price:null}]};
 const result=splitBySupplier(order);assert.equal(result.length,2);assert.deepEqual(result[0].items.map(i=>i.id),['a','c']);assert.deepEqual(result[1].items.map(i=>i.id),['b']);assert.equal(result[0].total,300);assert.equal(result[0].pricePending,true);assert.equal(result[1].total,1000);assert.equal(result[1].pricePending,false);assert.equal(result[1].location,'Store');assert.equal(order.items.length,3);
});
const {validateDelivery,deliverSupplier,dispatchOrder}=require('./order-delivery');
test('email configuration failures identify the missing setting without contacting the provider or exposing credentials',async()=>{
 const order={locationName:'Mernda'},delivery={method:'email',contact:'supplier@example.com'},env={DELIVERY_EMAIL_ENABLED:'true',ORDER_FROM_EMAIL:'mernda@example.com',RESEND_API_KEY:'private-test-key'};
 const fetchImpl=()=>{throw Error('Configuration failures must not contact the provider');};
 for(const [settings,pattern]of [[{...env,DELIVERY_EMAIL_ENABLED:'false'},/Mernda: automatic supplier emails are switched off/],[{...env,ORDER_FROM_EMAIL:''},/Mernda: no sender email is saved/],[{...env,RESEND_API_KEY:''},/Mernda: no Resend API key is saved/]]){
  const result=await deliverSupplier(order,delivery,{env:settings,fetchImpl});assert.equal(result.status,'not_configured');assert.match(result.message,pattern);assert.ok(!JSON.stringify(result).includes('private-test-key'));assert.ok(!JSON.stringify(result).includes('mernda@example.com'));
 }
 const missing=await deliverSupplier(order,delivery,{env:{},fetchImpl});for(const pattern of [/switched off/,/no sender email/,/no Resend API key/])assert.match(missing.message,pattern);
 const noMethod=await deliverSupplier(order,{method:'none'},{env,fetchImpl});assert.equal(noMethod.status,'not_configured');assert.match(noMethod.message,/No delivery method is saved/);
 const invalid=await deliverSupplier(order,{method:'email',contact:''},{env,fetchImpl});assert.equal(invalid.status,'not_configured');assert.match(invalid.message,/supplier email address is missing or invalid/);
});
test('email submissions use their configured route and invalid delivery details are rejected',async()=>{
 const order={orderId:'test-order',supplierId:'supplier-a',supplier:'A',requester:'Buyer',phone:'0400000000',location:'Store',notes:'',items:[{name:'Only supplier A item',price:100,quantity:2}],total:200,pricePending:false};
 const env={DELIVERY_EMAIL_ENABLED:'true',DELIVERY_SMS_ENABLED:'true',DELIVERY_SYSTEM_ENABLED:'true',RESEND_API_KEY:'test-key',ORDER_FROM_EMAIL:'orders@example.com',TWILIO_ACCOUNT_SID:'test-account',TWILIO_AUTH_TOKEN:'test-token',ORDER_SMS_FROM:'+61400000000',SUPPLIER_SYSTEM_TOKEN:'test-system'};const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:true};};
 assert.equal((await deliverSupplier(order,validateDelivery({method:'email',contact:'supplier@example.com'}),{env,fetchImpl})).status,'submitted');assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].options.body).to,['supplier@example.com']);
 assert.equal((await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env:{},fetchImpl})).status,'not_configured');assert.equal(calls.length,1);
 assert.equal((await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env,fetchImpl:async()=>({ok:false,status:400})})).status,'failed');
 assert.equal((await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env,fetchImpl:async()=>{throw Error('timeout');}})).status,'unconfirmed');
 assert.throws(()=>validateDelivery({method:'sms',contact:'not-a-number'}));assert.throws(()=>validateDelivery({method:'system',contact:'http://example.com'}));
});

test('supplier email omits contact and delivery lines when cart does not collect them',async()=>{
 const calls=[];const order={orderId:'simple-cart',requester:'staff',phone:'',location:'',notes:'Friday delivery',items:[{name:'Paper',price:650,quantity:2}],total:1300};
 const result=await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env:{DELIVERY_EMAIL_ENABLED:'true',RESEND_API_KEY:'test-key',ORDER_FROM_EMAIL:'orders@example.com'},fetchImpl:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true};}});
 assert.equal(result.status,'submitted');assert.match(calls[0].text,/Requested by: staff/);assert.match(calls[0].text,/2 × Paper/);assert.match(calls[0].text,/Friday delivery/);assert.ok(!calls[0].text.includes('Contact:'));assert.ok(!calls[0].text.includes('Deliver to:'));assert.ok(!calls[0].text.includes('undefined'));
});

test('supplier emails name the ordering location and include only quantities without prices or totals',async()=>{
 const order={id:'order-email',name:'Alex',locationName:'Melbourne',notes:'Please deliver on Monday.',items:[
  {name:'Pita bread',supplierId:'supplier-a',supplier:'Supplier A',quantity:4,price:1200},
  {name:'Tzatziki',supplierId:'supplier-a',supplier:'Supplier A',quantity:2,price:null},
  {name:'Chicken',supplierId:'supplier-b',supplier:'Supplier B',quantity:3,price:1800}
 ]};
 const suppliers=[{id:'supplier-a',delivery:{method:'email',contact:'a@example.com'}},{id:'supplier-b',delivery:{method:'email',contact:'b@example.com'}}];
 const calls=[];const results=await dispatchOrder(order,suppliers,{env:{DELIVERY_EMAIL_ENABLED:'true',RESEND_API_KEY:'test-key',ORDER_FROM_EMAIL:'melbourne@example.com'},fetchImpl:async(url,options)=>{calls.push(JSON.parse(options.body));return {ok:true};}});
 assert.deepEqual(results.map(result=>result.status),['submitted','submitted']);
 for(const email of calls){assert.equal(email.subject,'Stock order for Melbourne');assert.equal(email.from,'melbourne@example.com');}
 assert.deepEqual(calls.map(email=>email.to),[['a@example.com'],['b@example.com']]);
 assert.equal(calls[0].text,'Order order-email\nRequested by: Alex\nLocation: Melbourne\n\n4 × Pita bread\n2 × Tzatziki\n\nNotes: Please deliver on Monday.');
 assert.equal(calls[1].text,'Order order-email\nRequested by: Alex\nLocation: Melbourne\n\n3 × Chicken\n\nNotes: Please deliver on Monday.');
 assert.equal(splitBySupplier(order)[0].total,4800);assert.equal(splitBySupplier(order)[0].pricePending,true);assert.equal(splitBySupplier(order)[1].total,5400);
});
