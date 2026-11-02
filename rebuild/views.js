// Server-rendered views for the rebuilt app's foundation pages.
//
// Deliberately dependency-free HTML: the rebuild replaces the current 187-file
// browser script bundle, so Phase 1 ships a small server-rendered shell and
// later phases add interactive surfaces on top of the same session and scope
// model.
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const nav=[{path:'/home',label:'Home'},{path:'/ordering',label:'Ordering',permission:'orders.view'},{path:'/stock',label:'Stock',permission:'counts.view'},{path:'/users',label:'Users'},{path:'/locations',label:'Locations'}];
const money=cents=>typeof cents==='number'?`$${(cents/100).toFixed(2)}`:'Not priced';
const number=value=>typeof value==='number'?String(Math.round(value*1000)/1000):'—';
function layout({account,title,body,active,notice,error}){
 const grants=account?.grants||[];
 const links=account?nav.filter(item=>!item.permission||grants.includes(item.permission)).map(item=>`<a class="nav-link${item.path===active?' is-active':''}" href="${item.path}">${esc(item.label)}</a>`).join(''):'';
 const bar=account?`<header class="topbar"><div class="topbar-inner"><a class="brand" href="/home"><span class="brand-mark">Opstack</span><span class="brand-tag">rebuild</span></a><nav class="nav">${links}</nav><form method="post" action="/sign-out"><input type="hidden" name="_csrf" value="${esc(account.csrf)}"><button class="button button-quiet" type="submit">Sign out</button></form></div></header>`:'';
 const banner=notice?`<p class="banner banner-ok" role="status">${esc(notice)}</p>`:'';
 const failure=error?`<p class="banner banner-error" role="alert">${esc(error)}</p>`:'';
 return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Opstack rebuild</title><link rel="stylesheet" href="/rebuild.css"></head>
<body>${bar}<main class="page">${banner}${failure}${body}</main></body></html>`;
}
function signIn({previewMode,demo,error,email,notice}){
 const accounts=demo||[];
 const demoBlock=previewMode&&accounts.length?`<section class="card card-muted"><h2>Demo accounts</h2><p class="muted">Seeded for this branch. Not available outside the preview.</p><ul class="plain-list">${accounts.map(item=>`<li><code>${esc(item.email)}</code><span class="muted">${esc(item.note)}</span></li>`).join('')}</ul><p class="muted">Password for every demo account: <code>${esc(accounts[0].password)}</code></p></section>`:'';
 return layout({title:'Sign in',notice,error,body:`<section class="auth">
  <div class="auth-card">
   <p class="eyebrow">Opstack rebuild · Phases 1–2</p>
   <h1>Sign in</h1>
   <p class="muted">Foundations, ordering and stock: accounts and scopes, counts, target levels, carts, orders and transfers.</p>
   <form method="post" action="/sign-in" class="stack">
    <label class="field"><span>Email</span><input type="email" name="email" value="${esc(email||'')}" autocomplete="username" required></label>
    <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
    <button class="button" type="submit">Sign in</button>
   </form>
  </div>
  ${demoBlock}
 </section>`});
}
function home({account,companies,locations,groups,total,notice}){
 const companyList=companies.length?companies.map(company=>`<li><strong>${esc(company.name)}</strong></li>`).join(''):'<li class="muted">No company access</li>';
 const locationList=locations.length?locations.map(location=>`<li><span>${esc(location.name)}</span><span class="muted">${esc(location.companyName)}</span></li>`).join(''):'<li class="muted">No locations</li>';
 const groupList=groups.map(group=>`<li><span>${esc(group.name)}</span><span class="pill">${group.count}</span></li>`).join('');
 return layout({account,title:'Home',active:'/home',notice,body:`<section class="hero">
   <p class="eyebrow">${esc(account.roleName)} · ${esc(account.companyNames||'')}</p>
   <h1>Hello, ${esc(account.name)}</h1>
   <p class="muted">Signed in as ${esc(account.email)}. You are viewing only your own company and location data.</p>
  </section>
  <section class="grid">
   <article class="card"><h2>Company</h2><ul class="plain-list">${companyList}</ul></article>
   <article class="card"><h2>Locations in scope</h2><p class="metric">${locations.length}</p><ul class="plain-list">${locationList}</ul></article>
   <article class="card"><h2>Permissions</h2><p class="metric">${account.grants.length}<span class="muted"> / ${total}</span></p><ul class="plain-list">${groupList}</ul></article>
  </section>
  <section class="card">
   <h2>Session</h2>
   <p class="muted">Sessions last 8 hours. Signing out everywhere revokes every device at once by invalidating this account's session version.</p>
   <form method="post" action="/sign-out-everywhere"><input type="hidden" name="_csrf" value="${esc(account.csrf)}"><button class="button button-danger" type="submit">Sign out everywhere</button></form>
  </section>`});
}
function users({account,users,companies,locations,setupLink}){
 const rows=users.length?users.map(user=>`<tr>
   <td><strong>${esc(user.name)}</strong><span class="muted block">${esc(user.email)}</span></td>
   <td>${esc(user.roleName)}</td>
   <td>${user.locationIds.length} location${user.locationIds.length===1?'':'s'}<span class="muted block">${user.grants.length} permissions</span></td>
   <td>${user.pending?'<span class="pill pill-warn">Invitation pending</span>':'<span class="pill">Active</span>'}</td>
  </tr>`).join(''):'<tr><td colspan="4" class="muted">No other users in your scope.</td></tr>';
 const locationBoxes=locations.map(location=>`<label class="check"><input type="checkbox" name="locationIds" value="${esc(location.id)}"> <span>${esc(location.name)}</span></label>`).join('');
 const companyOptions=companies.map(company=>`<option value="${esc(company.id)}">${esc(company.name)}</option>`).join('');
 const form=account.canInvite?`<article class="card">
   <h2>Invite a user</h2>
   <form method="post" action="/users/invite" class="stack">
    <input type="hidden" name="_csrf" value="${esc(account.csrf)}">
    <label class="field"><span>Name</span><input name="name" maxlength="100" required></label>
    <label class="field"><span>Email</span><input type="email" name="email" required></label>
    <label class="field"><span>Permission level</span><select name="role">
      <option value="user">Ordering manager</option>
      <option value="franchisee">Franchisee</option>
      <option value="admin">Head Office</option>
    </select></label>
    <label class="field"><span>Company</span><select name="companyId">${companyOptions}</select></label>
    <fieldset class="checks"><legend>Locations</legend>${locationBoxes}</fieldset>
    <button class="button" type="submit">Create invitation</button>
   </form>
  </article>`:`<article class="card card-muted"><h2>Invite a user</h2><p class="muted">Your permission level does not include creating users. Ask a Head Office user to invite them.</p></article>`;
 const link=setupLink?`<p class="banner banner-ok">Invitation created for ${esc(setupLink.email)}. Email delivery arrives in a later phase, so open the one-time setup link directly:<br><code>${esc(setupLink.url)}</code></p>`:'';
 return layout({account,title:'Users',active:'/users',body:`<section class="hero"><h1>Users</h1><p class="muted">Only users who share a location you can reach are listed.</p></section>
  ${link}
  <section class="card"><table class="table"><thead><tr><th>User</th><th>Level</th><th>Access</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>
  ${form}`});
}
function locations({account,locations,companies}){
 const rows=locations.length?locations.map(location=>`<tr><td><strong>${esc(location.name)}</strong></td><td>${esc(location.companyName)}</td><td>${location.archived?'Archived':'Active'}</td></tr>`).join(''):'<tr><td colspan="3" class="muted">No locations in scope.</td></tr>';
 const options=companies.map(company=>`<option value="${esc(company.id)}">${esc(company.name)}</option>`).join('');
 const form=account.canCreateLocation?`<article class="card"><h2>Add a location</h2>
   <form method="post" action="/locations" class="stack">
    <input type="hidden" name="_csrf" value="${esc(account.csrf)}">
    <label class="field"><span>Location name</span><input name="name" maxlength="100" required></label>
    <label class="field"><span>Company</span><select name="companyId">${options}</select></label>
    <button class="button" type="submit">Add location</button>
   </form></article>`:'';
 return layout({account,title:'Locations',active:'/locations',body:`<section class="hero"><h1>Locations</h1><p class="muted">Scoped to the companies and locations your account can reach.</p></section>
  <section class="card"><table class="table"><thead><tr><th>Location</th><th>Company</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>
  ${form}`});
}
function locationPicker({locations,selected,action,extra}){
 if(!locations.length)return '';
 const options=locations.map(location=>`<option value="${esc(location.id)}"${location.id===selected?.id?' selected':''}>${esc(location.name)} · ${esc(location.companyName||'')}</option>`).join('');
 return `<form method="get" action="${esc(action)}" class="picker">
   <label class="field"><span>Location</span><select name="locationId">${options}</select></label>
   ${extra?`<label class="check"><input type="checkbox" name="all" value="1"${extra==='all'?' checked':''}> <span>Show every item</span></label>`:''}
   <button class="button button-quiet" type="submit">View</button>
  </form>`;
}
function needsLocation({account}){
 return layout({account,title:'No location',body:`<section class="hero"><h1>No location in scope</h1><p class="muted">${esc(account.name)}, your account has no location access yet. Ask a Head Office user to add one.</p></section>`});
}
function ordering({account,location,locations,rows,window,countedWeeks,showAll,notice}){
 if(!location)return needsLocation({account});
 const visible=showAll?rows:rows.filter(row=>row.toOrder);
 const sheet=visible.length?visible.map(row=>`<div class="sheet-row">
   <div class="sub"><span class="sheet-name">${esc(row.name)}</span>
    ${row.unit?`<span class="muted small">${esc(row.unit)}</span>`:''}
    <span class="sheet-meta">${esc(row.supplier)} · On hand ${esc(number(row.counted))}${row.level===null?' · Usage needed':` · Target ${esc(number(row.level))} · Order when ${esc(number(row.orderWhenLevel))}`}</span>
    ${row.rule?`<span class="sheet-meta">${esc(row.rule)}</span>`:''}</div>
   ${row.toOrder
    ?`<input class="qty" name="quantity:${esc(row.productId)}" value="${esc(number(row.quantity))}" inputmode="decimal" autocomplete="off" aria-label="Order quantity for ${esc(row.name)}">`
    :`<span class="pill ${row.level===null?'pill-warn':''}">${row.level===null?'No counts':'Covered'}</span>`}
  </div>`).join(''):'<p class="muted">Nothing needs ordering from this location right now.</p>';
 const weeks=countedWeeks?`Usage from ${countedWeeks} completed Sunday count${countedWeeks===1?'':'s'} (${esc(window.startDate)} to ${esc(window.endDate)}).`:'No Sunday counts in the usage window yet, so no target levels are available.';
 const heading=showAll?'Every stock item':'What needs ordering';
 return layout({account,title:'Ordering',active:'/ordering',notice,body:`<section class="hero">
   <p class="eyebrow">Ordering · ${esc(location.name)}</p>
   <h1>${esc(heading)}</h1>
   <p class="muted">${esc(weeks)}</p>
  </section>
  ${locationPicker({locations,selected:location,action:'/ordering',extra:showAll?'all':''})}
  <form method="post" action="/ordering/cart" class="card">
   <input type="hidden" name="_csrf" value="${esc(account.csrf)}">
   <input type="hidden" name="companyId" value="${esc(location.companyId)}">
   <input type="hidden" name="locationId" value="${esc(location.id)}">
   <div class="section-head"><h2>${esc(heading)}</h2><a class="small" href="/ordering?locationId=${esc(location.id)}${showAll?'':'&all=1'}">${showAll?'Only what needs ordering':'Show every item'}</a></div>
   <div class="sheet">${sheet}</div>
   <label class="field"><span>Notes for the suppliers</span><textarea name="note" rows="2" maxlength="500"></textarea></label>
   <div class="actions"><button class="button" type="submit">Review order</button></div>
  </form>`});
}
function cart({account,location,companyId,lines,totalCents,rounded,hasUnknownPrice,note}){
 const rows=lines.map(line=>`<tr>
   <td><strong>${esc(line.name)}</strong><span class="muted block small">${esc(line.supplier)}</span></td>
   <td class="nowrap">${esc(number(line.quantity))}</td>
   <td class="nowrap">${esc(money(line.unitPriceCents))}<span class="muted block small">${line.lineTotalCents===null?'—':esc(money(line.lineTotalCents))}</span></td>
  </tr>`).join('');
 const changes=rounded&&rounded.length?`<p class="banner">Rounded to each item's ordering rule: ${rounded.map(item=>esc(item.name)+' '+esc(number(item.from))+' → '+esc(number(item.to))).join(', ')}.</p>`:'';
 const unknown=hasUnknownPrice?`<p class="banner banner-error" role="alert">Some items have no saved price. They are ordered at an unknown price and the total below is incomplete.</p>`:'';
 return layout({account,title:'Cart',active:'/ordering',body:`<section class="hero">
   <p class="eyebrow">Cart · ${esc(location.name)}</p>
   <h1>Double check your order</h1>
   <p class="muted">Prices are saved with the order now, so later catalogue changes cannot rewrite it.</p>
  </section>
  ${changes}${unknown}
  <section class="card"><table class="table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>${rows}</tbody></table>
   <p class="total">Total <strong>${esc(money(totalCents))}</strong></p>
   ${note?`<p class="muted small">Notes: ${esc(note)}</p>`:''}
  </section>
  <div class="actions">
   <form method="post" action="/orders" class="inline">
    <input type="hidden" name="_csrf" value="${esc(account.csrf)}">
    <input type="hidden" name="companyId" value="${esc(companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <input type="hidden" name="requestId" value="${esc(account.csrf.slice(0,8)+'-'+Date.now())}">
    <input type="hidden" name="note" value="${esc(note)}">
    ${lines.map(line=>`<input type="hidden" name="quantity:${esc(line.productId)}" value="${esc(number(line.quantity))}">`).join('')}
    <button class="button" type="submit">Place order</button>
   </form>
   <a class="button button-quiet" href="/ordering?locationId=${esc(location.id)}">Back to the order sheet</a>
  </div>`});
}
function stock({account,location,locations,items,counts,transfers,orders,wastage,suppliers,today,notice}){
 if(!location)return needsLocation({account});
 const productOptions=items.filter(item=>!item.archived).map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('');
 const destinations=locations.filter(item=>item.id!==location.id&&item.companyId===location.companyId);
 const canTransfer=account.grants.includes('transfers.send')&&destinations.length>0;
 const canReceive=account.grants.includes('transfers.receive');
 const countRows=counts.slice(0,4).map(record=>`<li><span>${esc(record.countDate)} · ${esc(record.counterName)}</span><span class="muted">${record.itemCount} items</span></li>`).join('')||'<li class="muted">No counts saved yet.</li>';
 const pending=transfers.filter(transfer=>transfer.status==='sent');
 const transferRows=pending.map(transfer=>{
  const mine=transfer.to.id===location.id,mineSent=transfer.from.id===location.id&&account.grants.includes('transfers.send');
  const action=mine&&canReceive
   ?`<form method="post" action="/transfers/receive" class="inline"><input type="hidden" name="_csrf" value="${esc(account.csrf)}"><input type="hidden" name="transferId" value="${esc(transfer.id)}"><button class="button button-quiet" type="submit">Receive</button></form>`
   :mineSent
   ?`<form method="post" action="/transfers/cancel" class="inline"><input type="hidden" name="_csrf" value="${esc(account.csrf)}"><input type="hidden" name="transferId" value="${esc(transfer.id)}"><button class="button button-quiet" type="submit">Cancel</button></form>`
   :`<span class="pill${mine?'':' pill-warn'}">${mine?'Waiting on you':'In transit'}</span>`;
  return `<li><span><strong>${esc(transfer.from.name)} → ${esc(transfer.to.name)}</strong><span class="muted block small">${transfer.items.length} item${transfer.items.length===1?'':'s'} · sent by ${esc(transfer.sentByName)}</span></span>${action}</li>`;
 }).join('')||'<li class="muted">Nothing in transit.</li>';
 const orderRows=orders.filter(order=>order.status==='requested').slice(0,6).map(order=>`<li><span><strong>${esc(order.orderNumber)}</strong><span class="muted block small">${order.items.length} item${order.items.length===1?'':'s'} · ${esc(money(order.totalCents))}</span></span>
   <form method="post" action="/orders/receive" class="inline"><input type="hidden" name="_csrf" value="${esc(account.csrf)}"><input type="hidden" name="orderId" value="${esc(order.id)}"><button class="button button-quiet" type="submit">Confirm delivery</button></form></li>`).join('')||'<li class="muted">No order is waiting on a delivery.</li>';
 const wastageRows=wastage.slice(0,5).map(entry=>`<li><span>${esc(entry.date)} · ${esc(entry.name)}</span><span class="muted">${esc(number(entry.quantity))}${entry.unit?' '+esc(entry.unit):''} · ${esc(money(entry.estimatedCents))}</span></li>`).join('')||'<li class="muted">No wastage recorded.</li>';
 const sendForm=canTransfer?`<form method="post" action="/transfers" class="stack">
    <input type="hidden" name="_csrf" value="${esc(account.csrf)}">
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="fromLocationId" value="${esc(location.id)}">
    <label class="field"><span>Send to</span><select name="toLocationId">${destinations.map(item=>`<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Stock item</span><select name="productId">${productOptions}</select></label>
    <label class="field"><span>Quantity</span><input name="quantity" inputmode="decimal" autocomplete="off" required></label>
    <label class="field"><span>Note</span><input name="note" maxlength="500"></label>
    <button class="button" type="submit">Send stock</button>
   </form>`:'<p class="muted small">Sending stock needs the send transfers permission and another location in this company.</p>';
 const wastageForm=account.grants.includes('wastage.record')?`<form method="post" action="/stock/wastage" class="stack">
    <input type="hidden" name="_csrf" value="${esc(account.csrf)}">
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <label class="field"><span>Date</span><input type="date" name="date" value="${esc(today)}" required></label>
    <label class="field"><span>Stock item</span><select name="productId">${productOptions}</select></label>
    <label class="field"><span>Quantity wasted</span><input name="quantity" inputmode="decimal" autocomplete="off" required></label>
    <label class="field"><span>Reason</span><input name="reason" maxlength="500"></label>
    <button class="button" type="submit">Record wastage</button>
   </form>`:'<p class="muted small">Recording wastage needs the record wastage action.</p>';
 const itemOptions=suppliers.map(supplier=>`<option value="${esc(supplier.id)}">${esc(supplier.name)}</option>`).join('');
 const addForm=account.grants.includes('stock.manage')&&suppliers.length?`<article class="card">
   <h2>Add a stock item</h2>
   <form method="post" action="/stock/items" class="stack">
    <input type="hidden" name="_csrf" value="${esc(account.csrf)}">
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <label class="field"><span>Item name</span><input name="name" maxlength="140" required></label>
    <label class="field"><span>Supplier</span><select name="supplierId">${itemOptions}</select></label>
    <label class="field"><span>Unit amount</span><input name="unit" maxlength="60" placeholder="15kg box"></label>
    <label class="field"><span>Price (AUD)</span><input name="unitPrice" inputmode="decimal" placeholder="43.95" required></label>
    <label class="field"><span>Ordering rule</span><select name="orderRule">
      <option value="minimum">Minimum order</option>
      <option value="multiples">Order in multiples</option>
      <option value="cutoff">Rounding cutoff</option>
     </select></label>
    <label class="field"><span>Order unit / multiple</span><input name="minimumOrder" inputmode="numeric" value="1" required></label>
    <button class="button" type="submit">Add stock item</button>
   </form>
   <p class="muted small">Rules are applied to every suggestion for that item: minimum orders, whole multiples, or a rounding cutoff.</p>
  </article>`:'';
 return layout({account,title:'Stock',active:'/stock',notice,body:`<section class="hero">
   <p class="eyebrow">Stock · ${esc(location.name)}</p>
   <h1>Counts, transfers and deliveries</h1>
   <p class="muted">A count is a physical snapshot. Only a confirmed transfer or delivery changes stock.</p>
  </section>
  ${locationPicker({locations,selected:location,action:'/stock'})}
  <section class="card">
   <div class="section-head"><h2>Stock count</h2><a class="button button-quiet" href="/stock/counts?locationId=${esc(location.id)}">Record a count</a></div>
   <p class="muted small">Latest counts at this location.</p>
   <ul class="plain-list">${countRows}</ul>
  </section>
  <section class="card">
   <h2>Waiting on a delivery</h2>
   <ul class="plain-list">${orderRows}</ul>
  </section>
  <section class="card">
   <h2>Transfers</h2>
   <ul class="plain-list">${transferRows}</ul>
   ${sendForm}
  </section>
  <section class="card">
   <h2>Wastage</h2>
   <ul class="plain-list">${wastageRows}</ul>
   ${wastageForm}
  </section>
  ${addForm}`});
}
function countSheet({account,location,locations,items,today}){
 if(!location)return needsLocation({account});
 const rows=items.map(item=>`<div class="sheet-row">
   <div class="sub"><span class="sheet-name">${esc(item.name)}</span>
    <span class="sheet-meta">${esc(item.unit||item.supplier)} · On hand ${esc(number(item.onHand))}</span></div>
   <input class="qty" name="quantity:${esc(item.id)}" inputmode="decimal" autocomplete="off" placeholder="${esc(number(item.onHand))}" aria-label="Counted quantity for ${esc(item.name)}">
  </div>`).join('');
 return layout({account,title:'Stock count',active:'/stock',body:`<section class="hero">
   <p class="eyebrow">Stock · ${esc(location.name)}</p>
   <h1>Record a stock count</h1>
   <p class="muted">Enter what you counted. Blank rows stay uncounted, and zero is a real count.</p>
  </section>
  <form method="post" action="/stock/counts" class="card">
   <input type="hidden" name="_csrf" value="${esc(account.csrf)}">
   <input type="hidden" name="companyId" value="${esc(location.companyId)}">
   <input type="hidden" name="locationId" value="${esc(location.id)}">
   <label class="field"><span>Count date</span><input type="date" name="countDate" value="${esc(today)}" required></label>
   <label class="field"><span>Note</span><input name="note" maxlength="1000"></label>
   <div class="sheet">${rows||'<p class="muted">This company has no stock items yet.</p>'}</div>
   <div class="actions"><button class="button" type="submit">Save count</button><a class="button button-quiet" href="/stock?locationId=${esc(location.id)}">Cancel</a></div>
  </form>`});
}
function accept({token,name,email,error}){
 return layout({title:'Set up your account',error,body:`<section class="auth"><div class="auth-card">
   <p class="eyebrow">Account setup</p><h1>Choose your password</h1>
   <p class="muted">${esc(email)}</p>
   <form method="post" action="/accept" class="stack">
    <input type="hidden" name="token" value="${esc(token)}">
    <label class="field"><span>Your name</span><input name="name" value="${esc(name||'')}" maxlength="100" required></label>
    <label class="field"><span>Password</span><input type="password" name="password" autocomplete="new-password" required></label>
    <label class="field"><span>Confirm password</span><input type="password" name="confirm" autocomplete="new-password" required></label>
    <button class="button" type="submit">Set password</button>
   </form>
   <p class="muted small">Use 15–256 characters. Spaces are welcome — several unrelated words work well. This link works once and expires after 48 hours.</p>
  </div></section>`});
}
function message({account,title,text,status}){
 return layout({title,account,body:`<section class="hero"><p class="eyebrow">${status}</p><h1>${esc(title)}</h1><p class="muted">${esc(text)}</p><p><a class="button button-quiet" href="${account?'/home':'/'}">${account?'Back to Home':'Back to sign in'}</a></p></section>`});
}
module.exports={signIn,home,users,locations,ordering,cart,stock,countSheet,accept,message,esc};
