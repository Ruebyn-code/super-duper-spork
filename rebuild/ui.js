// Shared HTML chrome for every rebuilt page.
//
// One layout, one navigation list and one set of formatting helpers, so a page
// added in a later phase cannot drift from the session banner, the sign-out
// form or the money/number rendering the earlier phases established.
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=cents=>typeof cents==='number'?`$${(cents/100).toFixed(2)}`:'Not priced';
const number=value=>typeof value==='number'?String(Math.round(value*1000)/1000):'—';
const nav=[
 {path:'/home',label:'Home'},
 {path:'/sales',label:'Sales',permission:'sales.view'},
 {path:'/ordering',label:'Ordering',permission:'orders.view'},
 {path:'/stock',label:'Stock',permission:'counts.view'},
 {path:'/invoices',label:'Invoices',permission:'invoices.view'},
 {path:'/workforce',label:'Workforce',permission:'rostering.view'},
 {path:'/reporting',label:'Reporting',permission:'reporting.view'},
 {path:'/comms',label:'Comms',permission:'comms.view'},
 {path:'/library',label:'Library',permission:'knowledge.view'},
 {path:'/learning',label:'Learning',permission:'learning.view'},
 {path:'/users',label:'Users'},
 {path:'/locations',label:'Locations'}
];
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
function hero({eyebrow,title,text}){
 return `<section class="hero">${eyebrow?`<p class="eyebrow">${esc(eyebrow)}</p>`:''}<h1>${esc(title)}</h1>${text?`<p class="muted">${esc(text)}</p>`:''}</section>`;
}
const csrf=account=>`<input type="hidden" name="_csrf" value="${esc(account.csrf)}">`;
module.exports={esc,money,number,nav,layout,locationPicker,needsLocation,hero,csrf};
