// Invoice screens: the saved weekly bills, the line entry used to save one, the
// price comparison and the applied-price audit.
const {esc,money,layout,locationPicker,needsLocation,hero,csrf}=require('./ui');

const statusPill=status=>`<span class="pill${status==='applied'?' pill-ok':''}">${esc(status)}</span>`;

function list({account,location,locations,invoices,suppliers,notice}){
 if(!location)return needsLocation({account});
 const rows=invoices.length?invoices.map(invoice=>`<tr>
   <td><a href="/invoices/view?id=${esc(invoice.id)}">${esc(invoice.supplierName)}</a><br><span class="muted small">${esc(invoice.invoiceNumber||'No number')}</span></td>
   <td>${esc(invoice.invoiceDate)}</td>
   <td>${money(invoice.totalCents)}</td>
   <td>${statusPill(invoice.status)}${invoice.updateCount?`<br><span class="muted small">${invoice.updateCount} price update${invoice.updateCount===1?'':'s'}</span>`:''}</td>
  </tr>`).join(''):'<tr><td colspan="4" class="muted">No invoices saved at this location.</td></tr>';
 const options=suppliers.map(supplier=>`<option value="${esc(supplier.id)}">${esc(supplier.name)}</option>`).join('');
 return layout({account,title:'Invoices',active:'/invoices',notice,body:`${hero({eyebrow:'Invoices · '+location.name,title:'Weekly bills',text:'Save the lines you reviewed, then confirm only the prices that actually changed. A saved invoice keeps its own audit.'})}
  ${locationPicker({locations,selected:location,action:'/invoices'})}
  <section class="card"><table class="table"><thead><tr><th>Supplier</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>
  <form method="post" action="/invoices" class="card">
   <h2>Save an invoice</h2>
   <p class="muted small">One line per item: description, SKU, quantity, unit price. A unique SKU matches first, then a unique item name; anything else stays unmatched and never changes a price.</p>
   ${csrf(account)}
   <input type="hidden" name="companyId" value="${esc(location.companyId)}">
   <input type="hidden" name="locationId" value="${esc(location.id)}">
   <div class="grid">
    <label class="field"><span>Supplier</span><select name="supplierId"><option value="">Unlisted supplier</option>${options}</select></label>
    <label class="field"><span>Supplier name (if unlisted)</span><input name="supplierName" maxlength="120"></label>
    <label class="field"><span>Invoice date</span><input type="date" name="invoiceDate" required></label>
    <label class="field"><span>Invoice number</span><input name="invoiceNumber" maxlength="80"></label>
   </div>
   <label class="field"><span>Lines</span><textarea name="lines" rows="7" required placeholder="Flour 25kg,INV-FLOUR,4,44.00
Unmatched item,,1,1.00"></textarea></label>
   <div class="actions"><button class="button" type="submit">Save invoice</button></div>
  </form>`});
}

function detail({account,location,invoice,updates,notice}){
 const lineRows=invoice.lines.map(line=>`<tr>
   <td>${esc(line.description)}${line.productName&&line.productName!==line.description?`<br><span class="muted small">→ ${esc(line.productName)}</span>`:''}</td>
   <td>${esc(line.match)}</td><td>${esc(line.quantity)}</td><td>${money(line.unitPriceCents)}</td>
  </tr>`).join('');
 const proposals=invoice.proposals||[];
 const proposalRows=proposals.length?proposals.map(proposal=>`<tr><td>${esc(proposal.name)}<br><span class="muted small">${esc(proposal.sku||'')}</span></td><td>${proposal.currentCents===null?'Not priced':money(proposal.currentCents)}</td><td>${money(proposal.newCents)}</td></tr>`).join(''):'<tr><td colspan="3" class="muted">No price differs from the catalogue.</td></tr>';
 const history=updates.length?updates.map(update=>`<article class="card card-muted"><h2>${esc(update.at.slice(0,10))} · ${esc(update.actorName)}</h2><ul class="plain-list">${update.updates.map(item=>`<li><span>${esc(item.name)}</span><span>${item.beforeCents===null?'Not priced':money(item.beforeCents)} → ${money(item.afterCents)}</span></li>`).join('')}</ul></article>`).join(''):'<p class="muted small">No prices have been applied from this invoice.</p>';
 return layout({account,title:'Invoice',active:'/invoices',notice,body:`${hero({eyebrow:`${esc(invoice.supplierName)} · ${esc(invoice.invoiceDate)}`,title:invoice.invoiceNumber||'Invoice',text:`${statusPill(invoice.status)} ${esc(invoice.weekStart?`Week of ${invoice.weekStart}`:'')}`})}
  <p><a class="button button-quiet" href="/invoices?locationId=${esc(invoice.locationId)}">Back to invoices</a></p>
  <section class="card"><h2>Lines</h2><table class="table"><thead><tr><th>Item</th><th>Match</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${lineRows}</tbody></table>
   <p class="small">Total ${money(invoice.totalCents)}${invoice.gstCents===null?' · GST not recorded':` · GST ${money(invoice.gstCents)}`}</p></section>
  <section class="card"><h2>Price comparison</h2>
   <table class="table"><thead><tr><th>Item</th><th>Current</th><th>Invoice</th></tr></thead><tbody>${proposalRows}</tbody></table>
   ${invoice.status==='review'?`<form method="post" action="/invoices/apply" class="stack">
     ${csrf(account)}
     <input type="hidden" name="invoiceId" value="${esc(invoice.id)}">
     <input type="hidden" name="revision" value="${esc(invoice.revision)}">
     <div class="actions"><button class="button" type="submit">Apply ${proposals.length} price${proposals.length===1?'':'s'}</button></div>
    </form>`:'<p class="small">These prices were applied once; this page is now the audit of that decision.</p>'}
  </section>
  <section><h2>History</h2>${history}</section>`});
}

module.exports={list,detail};
