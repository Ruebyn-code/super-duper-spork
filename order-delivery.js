const {splitBySupplier}=require('./supplier-orders');
function validateDelivery(input){
 const method=input?.method||'none';if(!['none','email','sms','system'].includes(method))throw Error('Choose email, text message, ordering system, or not configured.');
 const contact=typeof input?.contact==='string'?input.contact.trim():'';
 if(contact.length>500)throw Error('Contact is too long.');
 if(method==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))throw Error('Enter the supplier email address.');
 if(method==='sms'&&!/^\+[1-9]\d{7,14}$/.test(contact))throw Error('Enter a phone number with country code, such as +61400123456.');
 if(method==='system'){let url;try{url=new URL(contact);}catch{throw Error('Enter an HTTPS order API endpoint.');}if(url.protocol!=='https:'||url.username||url.password||url.hash)throw Error('Use an HTTPS API endpoint without credentials in its URL.');}
 return {method,contact:method==='none'?'':contact};
}
function providerStatus(env=process.env){return {email:Boolean(env.DELIVERY_EMAIL_ENABLED==='true'&&env.RESEND_API_KEY&&env.ORDER_FROM_EMAIL),sms:Boolean(env.DELIVERY_SMS_ENABLED==='true'&&env.TWILIO_ACCOUNT_SID&&env.TWILIO_AUTH_TOKEN&&env.ORDER_SMS_FROM),system:Boolean(env.DELIVERY_SYSTEM_ENABLED==='true'&&env.SUPPLIER_SYSTEM_TOKEN)};}
function textOrder(order){return `Order ${order.orderId}\nRequested by: ${order.requester}\nContact: ${order.phone}\nDeliver to: ${order.location}\n\n${order.items.map(i=>`${i.quantity} × ${i.name} (${i.price===null?'price pending':'AUD '+(i.price/100).toFixed(2)+' per unit'})`).join('\n')}\n\nKnown-price subtotal: AUD ${(order.total/100).toFixed(2)}${order.pricePending?' (additional prices pending)':''}\nNotes: ${order.notes||'None'}`;}
async function deliverSupplier(order,delivery,{env=process.env,fetchImpl=fetch}={}){
 const ready=providerStatus(env);if(delivery.method==='none'||!delivery.contact||!ready[delivery.method])return {status:'not_configured',message:'Supplier contact or sending service is not configured.'};
 let url,headers,body;
 if(delivery.method==='email'){url='https://api.resend.com/emails';headers={'Content-Type':'application/json',Authorization:'Bearer '+env.RESEND_API_KEY,'Idempotency-Key':order.orderId+'-'+order.supplierId};body=JSON.stringify({from:env.ORDER_FROM_EMAIL,to:[delivery.contact],subject:'Stock order '+order.orderId,text:textOrder(order)});}
 if(delivery.method==='sms'){url='https://api.twilio.com/2010-04-01/Accounts/'+encodeURIComponent(env.TWILIO_ACCOUNT_SID)+'/Messages.json';headers={'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN).toString('base64')};body=new URLSearchParams({From:env.ORDER_SMS_FROM,To:delivery.contact,Body:textOrder(order)}).toString();}
 if(delivery.method==='system'){url=delivery.contact;headers={'Content-Type':'application/json',Authorization:'Bearer '+env.SUPPLIER_SYSTEM_TOKEN,'Idempotency-Key':order.orderId+'-'+order.supplierId};body=JSON.stringify(order);}
 try{const response=await fetchImpl(url,{method:'POST',headers,body,signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)return {status:'failed',message:'Sending service rejected the order (HTTP '+response.status+').'};return {status:'submitted',message:'Accepted by the sending service; supplier receipt is not confirmed.'};}catch{return {status:'unconfirmed',message:'Could not confirm submission. Check the sending service before resending.'};}
}
async function dispatchOrder(order,suppliers,options){const results=[];for(const supplierOrder of splitBySupplier(order)){const supplier=suppliers.find(s=>s.id===supplierOrder.supplierId);const delivery=supplier?.delivery||{method:'none',contact:''};results.push({supplierId:supplierOrder.supplierId,supplier:supplierOrder.supplier,method:delivery.method,...await deliverSupplier(supplierOrder,delivery,options)});}return results;}
module.exports={validateDelivery,providerStatus,deliverSupplier,dispatchOrder,textOrder};
