const crypto=require('node:crypto');
const {splitBySupplier}=require('./supplier-orders'),{providerStatus}=require('./order-delivery');
const {itemLine}=require('./public/order-email-template');
const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
const statuses={submitted:'Accepted by the sending service; supplier receipt is not confirmed.',action_required:'Action required: finish this order in the supplier ordering platform. It has not been submitted there.',not_configured:'Not sent: supplier delivery or sending settings are not configured.',failed:'Sending failed. Check the order in OpStack.',unconfirmed:'Submission unconfirmed. Check the sending service before resending.',pending:'Sending is still processing or unconfirmed.'};
function content(order){
 const subject=('Order confirmation · '+(order.locationName||'Your location')+' · '+(order.orderNumber||order.id)).replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,200);
 const instant=new Date(order.createdAt),savedAt=Number.isFinite(instant.valueOf())?new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Melbourne'}).format(instant)+' (Melbourne time)':'Not recorded';
 const lines=['Your order has been saved in OpStack.','This confirms the saved order, not supplier receipt.','', 'Company: '+(order.companyName||'Your company'),'Location: '+(order.locationName||'Your location'),'Order: '+(order.orderNumber||order.id),'Placed by: '+(order.name||'Team member'),'Saved: '+savedAt];
 for(const supplier of splitBySupplier(order)){
  const delivery=order.delivery?.find(result=>result.supplierId===supplier.supplierId);
  lines.push('',supplier.supplier||'Supplier',statuses[delivery?.status]||statuses.unconfirmed);
  for(const item of supplier.items)lines.push(itemLine(item)+(Number.isSafeInteger(item.price)?' — '+money(item.price*item.quantity)+' estimated':' — price pending'));
  lines.push('Supplier estimate: '+money(supplier.total)+(supplier.pricePending?' + prices pending':''));
 }
 lines.push('','Estimated order total: '+money(order.total)+(order.pricePending?' + prices pending':''),'','Notes: '+(order.notes||'None'));
 return{subject,text:lines.join('\n')};
}
function idempotencyKey(order,networkId){return 'order-confirmation-'+crypto.createHash('sha256').update(JSON.stringify([networkId,order.companyId,order.locationId,order.id])).digest('hex');}
async function send(order,{env={},fetchImpl=fetch,networkId}={}){
 if(!providerStatus(env).email||typeof env.ORDER_FROM_EMAIL!=='string'||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.ORDER_FROM_EMAIL))return{status:'not_configured',message:'Confirmation email was not sent. Configure this location’s sender email and Resend key, and enable automatic emails.'};
 try{
  const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.RESEND_API_KEY,'Idempotency-Key':idempotencyKey(order,networkId)},body:JSON.stringify({from:env.ORDER_FROM_EMAIL,to:[env.ORDER_FROM_EMAIL],...content(order)}),signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)return{status:'failed',message:'The sending service rejected the confirmation email (HTTP '+response.status+'). Your order is saved; supplier sending statuses are shown separately.'};
  return{status:'submitted',message:'Confirmation email accepted by the sending service for this location’s sender address. Inbox delivery is not confirmed.'};
 }catch{return{status:'unconfirmed',message:'Confirmation email submission is unconfirmed. Your order is saved. Check Resend before placing another order.'};}
}
module.exports={content,idempotencyKey,send};
