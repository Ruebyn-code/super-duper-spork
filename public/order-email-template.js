(function(root){
 const defaults=Object.freeze({subject:'Stock order for {{location}}',body:'Order {{order_reference}}\nRequested by: {{requested_by}}\nLocation: {{location}}\n\n{{items}}\n\nNotes: {{notes}}'});
 const fields=Object.freeze([
  {key:'company',label:'Company',subject:true},{key:'location',label:'Location',subject:true},{key:'supplier',label:'Supplier',subject:true},
  {key:'order_reference',label:'Order reference',subject:true},{key:'requested_by',label:'Ordered by',subject:true},
  {key:'items',label:'Order items',subject:false},{key:'notes',label:'Order notes',subject:false}
 ]);
 function validate(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Choose a valid order email template.');
  const result={};
  for(const [key,max]of [['subject',200],['body',6000]]){
   if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max)throw Error(key==='subject'?'Enter an email subject of 1–200 characters.':'Enter an email message of 1–6,000 characters.');
   const value=input[key].replace(/\r\n?/g,'\n').trim();
   if((key==='subject'&&/[\r\n]/.test(input[key]))||/[\x00-\x08\x0b-\x1f\x7f]/.test(value))throw Error('Email templates cannot contain control characters or line breaks in the subject.');
   const plain=value.replace(/{{([^]*?)}}/g,(token,name)=>{const field=fields.find(field=>field.key===name.trim());if(!field||(key==='subject'&&!field.subject))throw Error('Use the insert buttons for supported '+(key==='subject'?'subject':'message')+' fields.');return '';});
   if(plain.includes('{{')||plain.includes('}}'))throw Error('Complete each field with matching {{ and }}.');
   result[key]=value;
  }
  if([...result.body.matchAll(/{{\s*items\s*}}/g)].length!==1)throw Error('Include the Order items field exactly once in the email message.');
  return result;
 }
 function itemLine(item){const unit=typeof item.unitAmount==='string'?item.unitAmount.trim():'',sku=typeof item.sku==='string'?item.sku.trim():'';return `${item.quantity} × ${item.name}${unit?' ('+unit+')':''}${sku?' [SKU: '+sku+']':''}`;}
 function render(input,order){
  const template=validate(input),values={company:order.companyName||'Your company',location:order.locationName||order.location||'your location',supplier:order.supplier||'Supplier',order_reference:order.orderNumber||order.orderId||order.id||'',requested_by:order.requester||order.name||'',items:order.items.map(itemLine).join('\n'),notes:order.notes||'None'};
  // Replace once: tokens inside stock names or notes are ordinary text, never template instructions.
  const fill=text=>text.replace(/{{\s*([a-z_]+)\s*}}/g,(_,key)=>String(values[key]));
  return {subject:fill(template.subject).replace(/[\x00-\x1f\x7f]/g,' ').trim().slice(0,300),text:fill(template.body)};
 }
 const api={defaults,fields,validate,render,itemLine};if(typeof module==='object'&&module.exports)module.exports=api;else root.orderEmailTemplate=api;
})(typeof globalThis==='object'?globalThis:this);
