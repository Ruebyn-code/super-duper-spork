const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n/100);
let products=[],suppliers=[],editingId=null,csrf='';
const $=id=>document.getElementById(id);
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
async function api(url,method,body){const response=await fetch(url,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href='/login';throw Error('Please sign in again.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save changes.');return data;}
async function reload(){const data=await api('/api/catalogue','GET');products=data.products;suppliers=data.suppliers;
  const selected=$('supplier-select').value;$('supplier-select').replaceChildren();
  if(!suppliers.length){const option=el('option','Add a supplier first');option.value='';$('supplier-select').append(option);}
  for(const supplier of suppliers){const option=el('option',supplier.name);option.value=supplier.id;$('supplier-select').append(option);}
  if(suppliers.some(s=>s.id===selected))$('supplier-select').value=selected;
  $('supplier-list').replaceChildren();
  for(const supplier of suppliers){const group=el('section',undefined,'supplier-group');const heading=el('div',undefined,'supplier-title');heading.append(el('h3',supplier.name));const stock=products.filter(p=>p.supplierId===supplier.id);const remove=el('button','Remove supplier');remove.type='button';remove.disabled=stock.length>0;remove.title=stock.length?'Remove this supplier’s stock first':'';remove.onclick=()=>removeItem('suppliers',supplier.id,supplier.name);heading.append(remove);group.append(heading);
    if(!stock.length)group.append(el('p','No stock yet. Add an item using the form above.'));
    for(const product of stock){const row=el('div',undefined,'managed-stock');row.append(el('span',product.name+' · '+money(product.price)+' · '+product.stock+' on hand'));const button=el('button','Remove stock');button.type='button';button.setAttribute('aria-label','Remove stock '+product.name);button.onclick=()=>removeItem('products',product.id,product.name);const actions=el('div',undefined,'stock-actions');const edit=el('button','Edit');edit.type='button';edit.setAttribute('aria-label','Edit stock '+product.name);edit.onclick=()=>editStock(product);actions.append(edit,button);row.append(actions);group.append(row);}
    $('supplier-list').append(group);
  }
}
function resetStockForm(){editingId=null;$('stock-form').reset();$('stock-form-title').textContent='Add stock';$('stock-save').textContent='Save stock';$('stock-cancel').hidden=true;}
function editStock(product){editingId=product.id;const form=$('stock-form');for(const key of ['name','supplierId','sku','category','stock','description'])form.elements[key].value=product[key]??'';form.elements.price.value=(product.price/100).toFixed(2);$('stock-form-title').textContent='Edit stock';$('stock-save').textContent='Save changes';$('stock-cancel').hidden=false;form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.name.focus({preventScroll:true});$('manage-message').textContent='Editing '+product.name+'.';}
$('stock-cancel').onclick=()=>{resetStockForm();$('manage-message').textContent='Edit cancelled.';};
async function removeItem(type,id,name){if(!confirm('Remove '+name+'? Existing saved requests will be kept.'))return;try{await api('/api/'+type+'/'+id,'DELETE');if(type==='products'&&editingId===id)resetStockForm();await reload();$('manage-message').textContent=name+' removed.';}catch(error){$('manage-message').textContent=error.message;}}
for(const [formId,url] of [['supplier-form','/api/suppliers'],['stock-form','/api/products']]){
  $(formId).onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;$('manage-message').textContent='Saving…';try{const body=Object.fromEntries(new FormData(e.target));if(formId==='stock-form'){body.price=Number(body.price);body.stock=Number(body.stock);}const editing=formId==='stock-form'&&editingId;await api(editing?url+'/'+editingId:url,editing?'PUT':'POST',body);if(formId==='stock-form')resetStockForm();else e.target.reset();await reload();$('manage-message').textContent=formId==='stock-form'?'Stock saved.':'Supplier saved. Add stock under this supplier below.';}catch(error){$('manage-message').textContent=error.message;}finally{button.disabled=false;}};
}

$('logout').onclick=async()=>{try{await api('/api/logout','POST');location.href='/login';}catch(error){$('manage-message').textContent=error.message;}};
(async()=>{try{const session=await api('/api/session','GET');if(session.role!=='admin'){location.href=session.role==='user'&&session.csrf?'/':'/login';return;}csrf=session.csrf;await reload();}catch(error){$('manage-message').textContent=error.message;}})();
