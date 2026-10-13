const {splitBySupplier}=require('./supplier-orders');
function validateDelivery(input){
 const method=input?.method||'none';if(!['none','email'].includes(method))throw Error('Choose email or not configured.');
 const contact=typeof input?.contact==='string'?input.contact.trim():'';
 if(contact.length>500)throw Error('Contact is too long.');
 if(method==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact))throw Error('Enter the supplier email address.');
 return {method,contact:method==='none'?'':contact};
}
function providerStatus(env={}){return {email:Boolean(env.DELIVERY_EMAIL_ENABLED==='true'&&env.RESEND_API_KEY&&env.ORDER_FROM_EMAIL)};}
function textOrder(order){return `Order ${order.orderId}\nRequested by: ${order.requester}${order.locationName?'\nLocation: '+order.locationName:''}${order.phone?'\nContact: '+order.phone:''}${order.location?'\nDeliver to: '+order.location:''}\n\n${order.items.map(i=>`${i.quantity} × ${i.name} (${i.price===null?'price pending':'AUD '+(i.price/100).toFixed(2)+' per unit'})`).join('\n')}\n\nKnown-price subtotal: AUD ${(order.total/100).toFixed(2)}${order.pricePending?' (additional prices pending)':''}\nNotes: ${order.notes||'None'}`;}
async function deliverSupplier(order,delivery,{env={},fetchImpl=fetch}={}){
 const ready=providerStatus(env);if(delivery.method==='none'||!delivery.contact||!ready[delivery.method])return {status:'not_configured',message:'Supplier contact or sending service is not configured.'};
 let url,headers,body;
 if(delivery.method==='email'){url='https://api.resend.com/emails';headers={'Content-Type':'application/json',Authorization:'Bearer '+env.RESEND_API_KEY,'Idempotency-Key':order.orderId+'-'+order.supplierId};body=JSON.stringify({from:env.ORDER_FROM_EMAIL,to:[delivery.contact],subject:'Stock order '+order.orderId,text:textOrder(order)});}
 try{const response=await fetchImpl(url,{method:'POST',headers,body,signal:AbortSignal.timeout(15000),redirect:'error'});if(!response.ok)return {status:'failed',message:'Sending service rejected the order (HTTP '+response.status+').'};return {status:'submitted',message:'Accepted by the sending service; supplier receipt is not confirmed.'};}catch{return {status:'unconfirmed',message:'Could not confirm submission. Check the sending service before resending.'};}
}
async function dispatchOrder(order,suppliers,options){const results=[];for(const supplierOrder of splitBySupplier(order)){const supplier=suppliers.find(s=>s.id===supplierOrder.supplierId);const delivery=supplier?.delivery||{method:'none',contact:''};results.push({supplierId:supplierOrder.supplierId,supplier:supplierOrder.supplier,method:delivery.method,...await deliverSupplier(supplierOrder,delivery,options)});}return results;}
module.exports={validateDelivery,providerStatus,deliverSupplier,dispatchOrder,textOrder};
