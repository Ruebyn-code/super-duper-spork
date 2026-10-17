const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('./public/order-email-template'),{dispatchOrder,deliverSupplier}=require('./order-delivery');
const order={id:'order-example',name:'Alex',locationName:'North',notes:'Deliver on Monday.',items:[{name:'Pita',quantity:4,supplierId:'a',supplier:'Supplier A',price:1200},{name:'Olives',quantity:2,supplierId:'b',supplier:'Supplier B',price:null}]};
const env={DELIVERY_EMAIL_ENABLED:'true',RESEND_API_KEY:'fake-key',ORDER_FROM_EMAIL:'orders@example.com'};
test('order templates render all supported details once and isolate supplier items without prices',async()=>{
 const template={subject:'{{location}} order for {{supplier}} / {{order_reference}}',body:'Hi {{supplier}},\n\n{{items}}\n\n{{notes}}\nFrom {{requested_by}} at {{location}} ({{order_reference}})'},emails=[];
 const result=await dispatchOrder(order,[{id:'a',delivery:{method:'email',contact:'a@example.com'}},{id:'b',delivery:{method:'email',contact:'b@example.com'}}],{env:{...env,ORDER_EMAIL_TEMPLATE:template},fetchImpl:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers.Authorization,'Bearer fake-key');emails.push(JSON.parse(options.body));return {ok:true};}});
 assert.deepEqual(result.map(item=>item.status),['submitted','submitted']);
 assert.equal(emails[0].subject,'North order for Supplier A / order-example');assert.equal(emails[1].subject,'North order for Supplier B / order-example');
 assert.equal(emails[0].text,'Hi Supplier A,\n\n4 × Pita\n\nDeliver on Monday.\nFrom Alex at North (order-example)');
 assert.ok(!emails[0].text.includes('Olives'));assert.ok(!emails[1].text.includes('Pita'));assert.match(emails[1].text,/2 × Olives/);
 for(const email of emails){assert.ok(!email.text.includes('1200'));assert.ok(!email.text.includes('null'));assert.ok(!Object.hasOwn(email,'html'));assert.deepEqual(Object.keys(email).sort(),['from','subject','text','to']);}
});
test('template fields are treated as text and inserted data cannot introduce more template instructions',()=>{
 const rendered=model.render(model.defaults,{orderId:'ref',requester:'{{items}}',locationName:'North\r\nBcc: other@example.com',notes:'{{supplier}} <script>alert(1)</script>',items:[{name:'{{location}} <b>Oil</b>',quantity:2,price:900}]});
 assert.equal(rendered.subject,'Stock order for North  Bcc: other@example.com');assert.ok(!/[\r\n]/.test(rendered.subject));assert.match(rendered.text,/2 × {{location}} <b>Oil<\/b>/);assert.match(rendered.text,/Notes: {{supplier}} <script>/);assert.match(rendered.text,/Requested by: {{items}}/);
 assert.match(model.render(model.defaults,{items:[]}).text,/Notes: None/);
});
test('template validation rejects missing or repeated item lists, unknown fields and unsafe or oversized subjects',()=>{
 for(const input of [null,[],{}, {...model.defaults,subject:''},{...model.defaults,body:''},{...model.defaults,subject:'x'.repeat(201)},{...model.defaults,body:'{{items}}'+'x'.repeat(6000)},{...model.defaults,subject:'Order\r\nBcc: hidden@example.com'},{...model.defaults,body:'{{items}}\0'}, {...model.defaults,body:'No item list'}, {...model.defaults,body:'{{items}} {{ items }}'},{...model.defaults,body:'{{items}} {{price}}'},{...model.defaults,body:'{{items}} {{total}}'},{...model.defaults,body:'{{items}} {{unknown}'},{...model.defaults,subject:'{{notes}}'},{...model.defaults,subject:'{{items}}'}])assert.throws(()=>model.validate(input));
 assert.deepEqual(model.validate({subject:' {{ location }} ',body:' {{ items }}\r\nThank you '}),{subject:'{{ location }}',body:'{{ items }}\nThank you'});
 assert.equal(model.render({subject:'{{ location }}',body:'{{ items }}'},{locationName:'North',items:[{name:'Oil',quantity:1}]}).subject,'North');
});
test('a corrupt stored template fails explicitly before calling the sending service',async()=>{
 let sent=false;const result=await deliverSupplier({items:[]},{method:'email',contact:'supplier@example.com'},{env:{...env,ORDER_EMAIL_TEMPLATE:{subject:'Test',body:'Missing items'}},fetchImpl:()=>{sent=true;throw Error('Must not send');}});
 assert.equal(result.status,'failed');assert.match(result.message,/template is invalid/);assert.equal(sent,false);
});
