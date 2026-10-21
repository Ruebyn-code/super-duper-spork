(()=>{
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 const data=(tag,text,cls)=>{const element=node(tag,text,cls);element.dataset.userText='';return element;};
 const label=(tag,text,cls)=>{const element=node(tag,typeof interfaceLabel==='function'?interfaceLabel(text):text,cls);element.dataset.appTemplate=text;return element;};
 const money=cents=>cents===null?'Price pending':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
 let popup,body,context,total,notice,finish;
 function create(){
  popup=node('dialog',undefined,'order-review');popup.id='order-review';popup.dataset.layoutUi=popup.dataset.copyEditor='';popup.setAttribute('aria-labelledby','order-review-title');
  const header=node('div',undefined,'order-review-heading'),title=label('h2','Double check your order'),close=label('button','×','order-review-close');title.id='order-review-title';close.type='button';close.setAttribute('aria-label','Close order review');close.onclick=()=>finish?.(false);header.append(title,close);
  body=node('div',undefined,'order-review-body');context=data('p','','order-review-context');notice=data('p','','order-review-notice');notice.setAttribute('role','status');
  const footer=node('div',undefined,'order-review-footer'),amount=node('div',undefined,'order-review-total'),actions=node('div',undefined,'order-review-actions'),back=label('button','Back to cart'),confirm=label('button','Place order','order-review-confirm');total=data('strong','');amount.append(label('span','Estimated total'),total);back.type=confirm.type='button';back.autofocus=true;back.onclick=()=>finish?.(false);confirm.onclick=()=>{confirm.disabled=true;finish?.(true);};actions.append(back,confirm);footer.append(amount,actions);popup.append(header,body,footer);document.body.append(popup);
  popup.addEventListener('cancel',event=>{event.preventDefault();finish?.(false);});popup.addEventListener('close',()=>{if(!popup.open)finish?.(false);});
  let backdrop=false;const outside=event=>{const r=popup.getBoundingClientRect();return event.target===popup&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};popup.addEventListener('pointerdown',event=>{backdrop=outside(event);});popup.addEventListener('click',event=>{if(backdrop&&outside(event))finish?.(false);backdrop=false;});
 }
 function review(snapshot){
  if(finish)return Promise.resolve(false);if(!popup)create();
  const previous=document.activeElement;body.replaceChildren();context.textContent=[snapshot.locationName,snapshot.companyName].filter(Boolean).join(' · ');notice.textContent=snapshot.notice||'';notice.hidden=!notice.textContent;body.append(context,notice);
  const groups=new Map();let amount=0,pending=false;
  for(const item of snapshot.items){if(!groups.has(item.supplierId))groups.set(item.supplierId,[]);groups.get(item.supplierId).push(item);}
  for(const items of groups.values()){
   const section=node('section',undefined,'order-review-supplier');section.append(data('h3',items[0].supplier));let subtotal=0,pricesPending=false;
   for(const item of items){const row=node('div',undefined,'order-review-item'),details=node('div'),line=item.price===null?null:item.quantity*item.price;row.dataset.productId=item.id;details.append(data('strong',item.name));if(item.unitAmount)details.append(data('small',item.unitAmount,'order-review-unit'));details.append(data('span',item.quantity+' × '+money(item.price),'order-review-quantity'));row.append(details,data('strong',money(line),'order-review-line-total'));section.append(row);subtotal+=line??0;pricesPending||=line===null;}
   const sum=node('div',undefined,'order-review-subtotal');sum.append(label('span','Subtotal'),data('strong',money(subtotal)+(pricesPending?' + prices pending':'')));section.append(sum);body.append(section);amount+=subtotal;pending||=pricesPending;
  }
  if(snapshot.notes){const notes=node('section',undefined,'order-review-notes');notes.append(label('h3','Notes'),data('p',snapshot.notes));body.append(notes);}
  total.textContent=money(amount)+(pending?' + prices pending':'');
  return new Promise(resolve=>{finish=approved=>{if(!finish)return;finish=null;if(popup.open)popup.close();if(previous?.isConnected&&!previous.disabled)previous.focus({preventScroll:true});resolve(approved);};popup.querySelector('.order-review-confirm').disabled=false;popup.showModal();body.scrollTop=0;});
 }
 window.orderReview={review};
})();
