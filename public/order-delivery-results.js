(()=>{
 const panel=document.getElementById('order-delivery-results');if(!panel)return;
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 let session,key='',version=0;
 function show(order){
  version++;panel.replaceChildren();panel.hidden=false;panel.append(node('h2','Order delivery'),node('p','Order '+order.id,'small'));
  for(const delivery of order.delivery||[]){
   const card=node('article',undefined,'order-delivery-card'),header=node('div',undefined,'order-delivery-heading'),title=node('h3',delivery.supplier),labels={submitted:'Accepted by sending service',action_required:'Finish in platform',not_configured:'Not sent',failed:'Sending failed',unconfirmed:'Submission unconfirmed',pending:'Processing unconfirmed'},badge=node('span',labels[delivery.status]||'Not confirmed','order-delivery-badge');badge.dataset.state=delivery.status;title.dataset.userText='';header.append(title,badge);card.append(header,node('p',delivery.message,'small'));
   if(delivery.configurationMessage){const setup=node('p',delivery.configurationMessage,'small');setup.dataset.userText='';card.append(setup);}
   if(delivery.status==='action_required'&&delivery.handoff){
    let destination;try{destination=orderDestinations.platform(delivery.handoff.platform,delivery.handoff.url);}catch{card.append(node('p','The saved platform link is invalid. Ask an administrator to update the supplier.','small'));panel.append(card);continue;}
    const details=node('details'),summary=node('summary','View order to copy'),text=node('textarea');text.readOnly=true;text.rows=7;text.value=delivery.handoff.text;text.setAttribute('aria-label','Order text for '+delivery.supplier);details.append(summary,text);
    const actions=node('div',undefined,'order-delivery-actions'),copy=node('button','Copy order'),open=node('a','Open '+orderDestinations.platforms.find(item=>item.id===destination.platform).name),status=node('p','','small');copy.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(text.value);status.textContent='Order copied. Submit it in the platform to complete your order.';}catch{details.open=true;text.focus();text.select();status.textContent='Select and copy the order text, then submit it in the platform.';}};
    open.href=destination.contact;open.target='_blank';open.rel='noopener noreferrer';actions.append(copy,open);card.append(actions,details,status);
   }
   panel.append(card);
  }
  if(key)try{localStorage.setItem(key,order.id);}catch{}
 }
 window.orderDeliveryResults={show,async init(account){session=account;key='opstack-order-delivery-'+session.id+'-'+session.locationId;let id;try{id=localStorage.getItem(key);}catch{}if(!id||!/^[a-f0-9-]{36}$/i.test(id))return;const current=version;try{const response=await fetch('/api/orders/'+id+'?deliverySetup=true',{headers:{...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{})}});if(response.status===404){if(version===current)localStorage.removeItem(key);return;}if(!response.ok)return;const order=await response.json();if(version===current)show(order);}catch{}}};
})();
