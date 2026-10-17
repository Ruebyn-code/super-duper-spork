const {splitBySupplier}=require('./supplier-orders');
const emailTemplate=require('./public/order-email-template');
const destinations=require('./public/order-destinations');
function validateDelivery(input){
 const method=input?.method||'none';if(!['none','email','sms','platform'].includes(method))throw Error('Choose email, text message, ordering platform or not configured.');
 const contact=typeof input?.contact==='string'?input.contact.trim():'';
 if(contact.length>500)throw Error('Contact is too long.');
 if(method==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))throw Error('Enter the supplier email address.');
 if(method==='sms')return {method,contact:destinations.phone(contact)};
 if(method==='platform')return {method,...destinations.platform(input.platform,contact)};
 return {method,contact:method==='none'?'':contact};
}
function providerStatus(env={}){return {email:Boolean(env.DELIVERY_EMAIL_ENABLED==='true'&&env.RESEND_API_KEY&&env.ORDER_FROM_EMAIL),sms:Boolean(env.DELIVERY_SMS_ENABLED==='true'&&/^AC[0-9a-f]{32}$/i.test(env.TWILIO_ACCOUNT_SID||'')&&env.TWILIO_AUTH_TOKEN&&/^\+[1-9]\d{7,14}$/.test(env.ORDER_SMS_FROM||''))};}
function textOrder(order){return `Order ${order.orderId}\nRequested by: ${order.requester}${order.locationName?'\nLocation: '+order.locationName:''}${order.phone?'\nContact: '+order.phone:''}${order.location?'\nDeliver to: '+order.location:''}\n\n${order.items.map(emailTemplate.itemLine).join('\n')}\n\nNotes: ${order.notes||'None'}`;}
async function deliverSupplier(order,delivery,{env={},fetchImpl=fetch}={}){
 try{delivery=validateDelivery(delivery);}catch{return {status:'not_configured',message:'The supplier delivery details are invalid. Ask an administrator to update them.'};}
 if(delivery.method==='platform'){
  let content;try{content=env.ORDER_EMAIL_TEMPLATE?emailTemplate.render(env.ORDER_EMAIL_TEMPLATE,order):{subject:'Stock order for '+(order.locationName||order.location||'your location'),text:textOrder(order)};}catch{return {status:'failed',message:'Update the company order email template in Settings before preparing this order.'};}
  return {status:'action_required',message:'Saved in Opstack. Copy the items and submit the order in '+destinations.platforms.find(item=>item.id===delivery.platform).name+'. It has not been sent to the platform.',handoff:{platform:delivery.platform,url:delivery.contact,text:content.subject+'\n\n'+content.text}};
 }
 const ready=providerStatus(env);if(delivery.method==='none'||!delivery.contact||!ready[delivery.method])return {status:'not_configured',message:'Supplier contact or sending service is not configured.'};
 let url,headers,body;
 if(delivery.method==='sms'){
  let content;try{content=env.ORDER_EMAIL_TEMPLATE?emailTemplate.render(env.ORDER_EMAIL_TEMPLATE,order):{subject:'Stock order for '+(order.locationName||order.location||'your location'),text:textOrder(order)};}catch{return {status:'failed',message:'Update the company order email template in Settings before sending this order.'};}
  const text=content.subject+'\n\n'+content.text;if(text.length>1600)return {status:'failed',message:'This order exceeds the 1,600-character SMS limit. Use email or reduce the message length; no text was sent.'};
  url='https://api.twilio.com/2010-04-01/Accounts/'+env.TWILIO_ACCOUNT_SID+'/Messages.json';headers={'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic '+Buffer.from(env.TWILIO_ACCOUNT_SID+':'+env.TWILIO_AUTH_TOKEN).toString('base64')};body=new URLSearchParams({To:delivery.contact,From:env.ORDER_SMS_FROM,Body:text}).toString();
 }
 if(delivery.method==='email'){let content;try{content=env.ORDER_EMAIL_TEMPLATE?emailTemplate.render(env.ORDER_EMAIL_TEMPLATE,order):{subject:'Stock order for '+(order.locationName||order.location||'your location'),text:textOrder(order)};}catch{return {status:'failed',message:'The saved order email template is invalid. Ask an administrator to update Settings → Order email template.'};}url='https://api.resend.com/emails';headers={'Content-Type':'application/json',Authorization:'Bearer '+env.RESEND_API_KEY,'Idempotency-Key':order.orderId+'-'+order.supplierId};body=JSON.stringify({from:env.ORDER_FROM_EMAIL,to:[delivery.contact],...content});}
 try{const response=await fetchImpl(url,{method:'POST',headers,body,signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)return {status:'failed',message:'Sending service rejected the order (HTTP '+response.status+').'};return {status:'submitted',message:'Accepted by the sending service; supplier receipt is not confirmed.'};}catch{return {status:'unconfirmed',message:'Could not confirm submission. Check the sending service before resending.'};}
}
async function dispatchOrder(order,suppliers,options){const results=[];for(const supplierOrder of splitBySupplier(order)){const supplier=suppliers.find(s=>s.id===supplierOrder.supplierId);const delivery=supplier?.delivery||{method:'none',contact:''};results.push({supplierId:supplierOrder.supplierId,supplier:supplierOrder.supplier,method:delivery.method,...await deliverSupplier(supplierOrder,delivery,options)});}return results;}
module.exports={validateDelivery,providerStatus,deliverSupplier,dispatchOrder,textOrder};
