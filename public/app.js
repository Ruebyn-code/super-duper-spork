const money = n => new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n/100);
let products=[], suppliers=[], cart={}, category='All', busy=false, editingId=null,csrf='';
const $=id=>document.getElementById(id);
function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function renderMenu(){
  $('menu').replaceChildren();
  const query=$('search').value.toLowerCase();
  const filtered=products.filter(p=>(category==='All'||p.supplierId===category)&&(p.name+' '+p.sku+' '+p.supplier).toLowerCase().includes(query));
  if(!filtered.length)$('menu').append(el('p','No stock matches your search.'));
  for(const p of filtered){const card=el('article',undefined,'product');card.append(el('div',p.emoji,'product-art'),el('p',p.supplier+' · '+(p.sku||p.category),'sku'),el('h3',p.name),el('p',p.description,'description'),el('p',p.stock+' packs / units currently on hand','stock'));const row=el('div',undefined,'product-bottom');row.append(el('strong',money(p.price)));const button=el('button','+ Add');button.type='button';button.disabled=busy||(cart[p.id]||0)>=999;button.setAttribute('aria-label','Add '+p.name);button.onclick=()=>{cart[p.id]=(cart[p.id]||0)+1;render();};row.append(button);card.append(row);$('menu').append(card);}
}
function render(){renderMenu();$('cart').replaceChildren();let total=0,count=0;
  for(const p of products){const qty=cart[p.id]||0;if(!qty)continue;total+=p.price*qty;count+=qty;const row=el('div',undefined,'cart-row');row.append(el('strong',p.name));const controls=el('div',undefined,'quantity');const minus=el('button','−');minus.type='button';minus.disabled=busy;minus.setAttribute('aria-label','Remove one '+p.name);minus.onclick=()=>{cart[p.id]--;render();};const input=el('input');input.type='number';input.min=1;input.max=999;input.value=qty;input.disabled=busy;input.setAttribute('aria-label',p.name+' quantity');input.onchange=()=>{const n=Number(input.value);if(Number.isInteger(n)&&n>=1&&n<=999)cart[p.id]=n;render();};const remove=el('button','×');remove.type='button';remove.disabled=busy;remove.setAttribute('aria-label','Remove '+p.name);remove.onclick=()=>{delete cart[p.id];render();};controls.append(minus,input,remove,el('span',money(qty*p.price)));row.append(controls);$('cart').append(row);}
  if(!count)$('cart').append(el('div','Your request is empty. Add stock to get started.','empty'));
  $('count').textContent=count+' units';$('total').textContent=money(total);$('submit').disabled=!count||busy;$('submit').textContent=busy?'Saving request…':'Submit stock request →';
}
$('search').oninput=renderMenu;
$('checkout').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;render();$('message').textContent='';const body=Object.fromEntries(new FormData(e.target));body.items=Object.entries(cart).filter(([,q])=>q>0).map(([id,quantity])=>({id,quantity}));try{const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const order=await response.json();if(!response.ok)throw Error(order.error);cart={};$('message').textContent='Request '+order.id+' saved. Estimated total '+money(order.total)+'. No supplier order has been placed.';e.target.reset();}catch(error){$('message').textContent=error.message||'Could not save the request. Try again.';}finally{busy=false;render();}};
async function api(url,method,body){const response=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href='/login';throw Error('Please sign in again.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save changes.');return data;}
async function reload(){
  const data=await api('/api/catalogue','GET');products=data.products;suppliers=data.suppliers;
  for(const id of Object.keys(cart))if(!products.some(p=>p.id===id))delete cart[id];
  if(category!=='All'&&!suppliers.some(s=>s.id===category))category='All';
  $('filters').replaceChildren();
  for(const supplier of [{id:'All',name:'All suppliers'},...suppliers]){const b=el('button',supplier.name,category===supplier.id?'active':'');b.onclick=()=>{category=supplier.id;for(const child of $('filters').children)child.classList.toggle('active',child===b);renderMenu();};$('filters').append(b);}
  render();
}
$('logout').onclick=async()=>{try{await fetch('/api/logout',{method:'POST',headers:{'X-CSRF-Token':csrf}});location.href='/login';}catch(error){$('message').textContent=error.message;}};
(async()=>{try{const session=await api('/api/session','GET');if(!session.csrf){location.href='/login';return;}csrf=session.csrf;$('user-greeting').textContent='Yassou, '+session.username+'!';$('admin-link').hidden=session.role!=='admin';await reload();$('load-status').textContent='';}catch(error){$('load-status').textContent=error.message;}})();
