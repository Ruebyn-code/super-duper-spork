// Comms and Library screens: posts (with the required-reading gate), chats, and
// company articles.
const {esc,layout,hero,csrf}=require('./ui');

const companyPicker=(companies,selected)=>companies.length>1?`<form method="get" class="picker">
  <label class="field"><span>Company</span><select name="companyId">${companies.map(company=>`<option value="${esc(company.id)}"${company.id===selected.id?' selected':''}>${esc(company.name)}</option>`).join('')}</select></label>
  <button class="button button-quiet" type="submit">View</button>
 </form>`:'';

function comms({account,company,companies,posts,conversations,people,notice}){
 const required=posts.filter(post=>post.outstanding);
 const postRows=posts.length?posts.map(post=>`<article class="card${post.outstanding?' card-required':''}">
   <h2>${esc(post.title)} ${post.required?'<span class="pill pill-warn">required reading</span>':''}</h2>
   <p class="small muted">${esc(post.authorName)} · ${esc(post.createdAt.slice(0,10))}${post.audience==='location'?' · location post':''}</p>
   <p>${esc(post.body)}</p>
   ${post.required?(post.acknowledgedAt?`<p class="small muted">Acknowledged ${esc(post.acknowledgedAt.slice(0,10))}</p>`:
    `<form method="post" action="/comms/acknowledge">${csrf(account)}<input type="hidden" name="postId" value="${esc(post.id)}"><button class="button" type="submit">I have read this</button></form>`):''}
  </article>`).join(''):'<p class="muted">No posts yet.</p>';
 const chatRows=conversations.length?conversations.map(conversation=>`<li><a href="/comms/thread?id=${esc(conversation.id)}">${esc(conversation.name||'Direct message')}</a>
   <span class="muted small">${conversation.unread?`${conversation.unread} unread`:(conversation.last?esc(conversation.last.name):'No messages')}</span></li>`).join(''):'<li class="muted">No conversations.</li>';
 return layout({account,title:'Comms',active:'/comms',notice,body:`${hero({eyebrow:'Comms · '+company.name,title:'Posts and chats',text:'A required post stays outstanding until you acknowledge it, and blocks the rest of the app until you do.'})}
  ${companyPicker(companies,company)}
  ${required.length?`<p class="banner banner-warn" role="alert">${required.length} required post${required.length===1?'':'s'} still to acknowledge.</p>`:''}
  <section class="grid">
   <article class="card"><h2>Conversations</h2><ul class="plain-list">${chatRows}</ul>
    <form method="post" action="/comms/start" class="stack">${csrf(account)}
     <input type="hidden" name="companyId" value="${esc(company.id)}">
     <label class="field"><span>Name (for a group)</span><input name="name" maxlength="80"></label>
     <fieldset class="check-group"><legend>Members</legend>${people.map(person=>`<label class="check"><input type="checkbox" name="memberIds" value="${esc(person.id)}"> <span>${esc(person.name)}</span></label>`).join('')}</fieldset>
     <div class="actions"><button class="button button-quiet" type="submit">Start conversation</button></div>
    </form>
   </article>
   <form method="post" action="/comms/post" class="card"><h2>Write a post</h2>
    ${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(company.id)}">
    <label class="field"><span>Title</span><input name="title" maxlength="140" required></label>
    <label class="field"><span>Body</span><textarea name="body" rows="5" required></textarea></label>
    <label class="check"><input type="checkbox" name="required" value="1"> <span>Require everyone to acknowledge it</span></label>
    <div class="actions"><button class="button" type="submit">Publish post</button></div>
   </form>
  </section>
  <section>${postRows}</section>`});
}

function thread({account,conversation,messages,notice,companies,company}){
 const rows=messages.map(message=>`<article class="card card-muted"><p class="small muted">${esc(message.name)} · ${esc(message.createdAt.slice(0,16).replace('T',' '))}</p><p>${esc(message.body)}</p></article>`).join('')||'<p class="muted">No messages yet.</p>';
 return layout({account,title:'Chat',active:'/comms',notice,body:`${hero({eyebrow:conversation.kind==='group'?'Group':'Direct message',title:conversation.name||'Direct message'})}
  <p><a class="button button-quiet" href="/comms?companyId=${esc(conversation.companyId)}">Back to Comms</a></p>
  ${rows}
  <form method="post" action="/comms/send" class="card">${csrf(account)}
   <input type="hidden" name="conversationId" value="${esc(conversation.id)}">
   <label class="field"><span>Message</span><textarea name="body" rows="3" required></textarea></label>
   <div class="actions"><button class="button" type="submit">Send</button></div>
  </form>`});
}

function library({account,company,companies,categories,articles,selectedCategory,canManage,notice}){
 const categoryRows=categories.map(category=>`<li><a href="/library?companyId=${esc(company.id)}&categoryId=${esc(category.id)}"${category.id===selectedCategory?' aria-current="page"':''}>${esc(category.name)}</a></li>`).join('');
 const rows=articles.length?articles.map(article=>`<tr>
   <td><a href="/library/view?id=${esc(article.id)}">${esc(article.title)}</a></td>
   <td>${esc(categories.find(category=>category.id===article.categoryId)?.name||'Uncategorised')}</td>
   <td>${article.status==='published'?esc(article.publishedAt?.slice(0,10)||'published'):'<span class="pill">draft</span>'}</td>
  </tr>`).join(''):'<tr><td colspan="3" class="muted">No articles yet.</td></tr>';
 return layout({account,title:'Library',active:'/library',notice,body:`${hero({eyebrow:'Library · '+company.name,title:'Knowledge library',text:'Published company articles. Drafts are visible to their managers only.'})}
  ${companyPicker(companies,company)}
  <section class="grid">
   <article class="card"><h2>Categories</h2><ul class="plain-list">${categoryRows||'<li class="muted">No categories.</li>'}</ul></article>
   <article class="card"><h2>Articles</h2><table class="table"><thead><tr><th>Title</th><th>Category</th><th>Published</th></tr></thead><tbody>${rows}</tbody></table></article>
  </section>
  ${canManage?`<section class="grid">
   <form method="post" action="/library/category" class="card">${csrf(account)}<h2>Add a category</h2>
    <input type="hidden" name="companyId" value="${esc(company.id)}">
    <label class="field"><span>Name</span><input name="name" maxlength="60" required></label>
    <div class="actions"><button class="button" type="submit">Add category</button></div>
   </form>
   <form method="post" action="/library/article" class="card">${csrf(account)}<h2>Write an article</h2>
    <input type="hidden" name="companyId" value="${esc(company.id)}">
    <label class="field"><span>Title</span><input name="title" maxlength="140" required></label>
    <label class="field"><span>Category</span><select name="categoryId"><option value="">Uncategorised</option>${categories.map(category=>`<option value="${esc(category.id)}">${esc(category.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Body</span><textarea name="body" rows="6" required></textarea></label>
    <div class="actions"><button class="button" type="submit">Save draft</button></div>
   </form>
  </section>`:''}`});
}

function article({account,article,categories,notice}){
 return layout({account,title:article.title,active:'/library',notice,body:`${hero({eyebrow:'Library · '+(categories.find(category=>category.id===article.categoryId)?.name||'Uncategorised'),title:article.title,text:article.status==='published'?`Published ${(article.publishedAt||article.updatedAt).slice(0,10)}`:'Draft'})}
  <p><a class="button button-quiet" href="/library?companyId=${esc(article.companyId)}">Back to Library</a></p>
  <article class="card"><p>${esc(article.body)}</p></article>
  ${article.status!=='published'?`<form method="post" action="/library/publish">${csrf(account)}<input type="hidden" name="articleId" value="${esc(article.id)}"><button class="button" type="submit">Publish article</button></form>`:''}`});
}

module.exports={comms,thread,library,article};
