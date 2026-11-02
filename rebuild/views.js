// Server-rendered views for the rebuilt app's foundation pages.
//
// Deliberately dependency-free HTML: the rebuild replaces the current 187-file
// browser script bundle, so Phase 1 ships a small server-rendered shell and
// later phases add interactive surfaces on top of the same session and scope
// model.
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const nav=[{path:'/home',label:'Home'},{path:'/users',label:'Users'},{path:'/locations',label:'Locations'}];
function layout({account,title,body,active,notice,error}){
 const links=account?nav.map(item=>`<a class="nav-link${item.path===active?' is-active':''}" href="${item.path}">${esc(item.label)}</a>`).join(''):'';
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
   <p class="eyebrow">Opstack rebuild · Phase 1</p>
   <h1>Sign in</h1>
   <p class="muted">Foundation build: accounts, companies, locations, permission levels and scopes.</p>
   <form method="post" action="/sign-in" class="stack">
    <label class="field"><span>Email</span><input type="email" name="email" value="${esc(email||'')}" autocomplete="username" required></label>
    <label class="field"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>
    <button class="button" type="submit">Sign in</button>
   </form>
  </div>
  ${demoBlock}
 </section>`});
}
function home({account,companies,locations,groups,total}){
 const companyList=companies.length?companies.map(company=>`<li><strong>${esc(company.name)}</strong></li>`).join(''):'<li class="muted">No company access</li>';
 const locationList=locations.length?locations.map(location=>`<li><span>${esc(location.name)}</span><span class="muted">${esc(location.companyName)}</span></li>`).join(''):'<li class="muted">No locations</li>';
 const groupList=groups.map(group=>`<li><span>${esc(group.name)}</span><span class="pill">${group.count}</span></li>`).join('');
 return `<section class="hero">
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
  </section>`;
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
 return `<section class="hero"><h1>Users</h1><p class="muted">Only users who share a location you can reach are listed.</p></section>
  ${link}
  <section class="card"><table class="table"><thead><tr><th>User</th><th>Level</th><th>Access</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>
  ${form}`;
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
 return `<section class="hero"><h1>Locations</h1><p class="muted">Scoped to the companies and locations your account can reach.</p></section>
  <section class="card"><table class="table"><thead><tr><th>Location</th><th>Company</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></section>
  ${form}`;
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
module.exports={signIn,home,users,locations,accept,message,esc};
