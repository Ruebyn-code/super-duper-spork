const {test}=require('node:test');const assert=require('node:assert/strict');const {splitBySupplier}=require('./supplier-orders');
test('split orders isolate each supplier and retain quantities and pending prices',()=>{
 const order={id:'order-1',name:'Buyer',phone:'0400000000',location:'Store',notes:'Delivery requested',items:[{id:'a',name:'First',supplierId:'supplier-a',supplier:'Supplier A',quantity:3,price:100},{id:'b',name:'Second',supplierId:'supplier-b',supplier:'Supplier B',quantity:2,price:500},{id:'c',name:'Third',supplierId:'supplier-a',supplier:'Supplier A',quantity:1,price:null}]};
 const result=splitBySupplier(order);assert.equal(result.length,2);assert.deepEqual(result[0].items.map(i=>i.id),['a','c']);assert.deepEqual(result[1].items.map(i=>i.id),['b']);assert.equal(result[0].total,300);assert.equal(result[0].pricePending,true);assert.equal(result[1].total,1000);assert.equal(result[1].pricePending,false);assert.equal(result[1].location,'Store');assert.equal(order.items.length,3);
});
const {validateDelivery,deliverSupplier}=require('./order-delivery');
test('email submissions use their configured route and other methods are rejected',async()=>{
 const order={orderId:'test-order',supplierId:'supplier-a',supplier:'A',requester:'Buyer',phone:'0400000000',location:'Store',notes:'',items:[{name:'Only supplier A item',price:100,quantity:2}],total:200,pricePending:false};
 const env={DELIVERY_EMAIL_ENABLED:'true',DELIVERY_SMS_ENABLED:'true',DELIVERY_SYSTEM_ENABLED:'true',RESEND_API_KEY:'test-key',ORDER_FROM_EMAIL:'orders@example.com',TWILIO_ACCOUNT_SID:'test-account',TWILIO_AUTH_TOKEN:'test-token',ORDER_SMS_FROM:'+61400000000',SUPPLIER_SYSTEM_TOKEN:'test-system'};const calls=[];const fetchImpl=async(url,options)=>{calls.push({url,options});return {ok:true};};
 assert.equal((await deliverSupplier(order,validateDelivery({method:'email',contact:'supplier@example.com'}),{env,fetchImpl})).status,'submitted');assert.equal(calls.length,1);assert.deepEqual(JSON.parse(calls[0].options.body).to,['supplier@example.com']);
 assert.equal((await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env:{},fetchImpl})).status,'not_configured');assert.equal(calls.length,1);
 assert.equal((await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env,fetchImpl:async()=>({ok:false,status:400})})).status,'failed');
 assert.equal((await deliverSupplier(order,{method:'email',contact:'supplier@example.com'},{env,fetchImpl:async()=>{throw Error('timeout');}})).status,'unconfirmed');
 assert.throws(()=>validateDelivery({method:'sms',contact:'0400000000'}));assert.throws(()=>validateDelivery({method:'system',contact:'http://example.com'}));
});
