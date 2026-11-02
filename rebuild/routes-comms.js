// Comms and Library routes.
const permissions=require('./permissions');
const views=require('./views-comms');

async function companyFor(actor,companies,requested){
 const accessible=permissions.accessibleCompanies(actor,companies);
 return accessible.find(company=>company.id===requested)||accessible[0]||null;
}

async function route(ctx){
 const {url,method,viewer,actor,services,html,redirect,readBody,assertCsrf,notice}=ctx;
 const path=url.pathname;
 if(!path.startsWith('/comms')&&!path.startsWith('/library'))return false;
 const companies=await services.store.read('companies');

 if(path==='/comms'&&method==='GET'){
  permissions.requirePermission(actor,'comms.view');
  const company=await companyFor(actor,companies,url.searchParams.get('companyId'));
  if(!company)return redirect('/home');
  const posts=await services.comms.visible(actor,company.id);
  const conversations=permissions.can(actor,'comms.chat')?await services.comms.conversationList(actor,{companyId:company.id}):[];
  const people=(await services.store.read('accounts')).filter(account=>account.id!==actor.id&&permissions.companyIds(account).includes(company.id)).map(account=>({id:account.id,name:account.name}));
  return html(200,views.comms({account:viewer,company,companies,posts,conversations,people,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/comms/thread'&&method==='GET'){
  const {conversation,messages}=await services.comms.thread(actor,{conversationId:url.searchParams.get('id')});
  return html(200,views.thread({account:viewer,conversation,messages,companies,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/comms/post'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.comms.createPost(actor,{companyId:form.companyId,title:form.title,body:form.body,required:form.required==='1'});
  return redirect(`/comms?companyId=${encodeURIComponent(form.companyId)}&saved=post-created`);
 }

 if(path==='/comms/acknowledge'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const result=await services.comms.acknowledge(actor,form.postId);
  return redirect(`/comms?companyId=${encodeURIComponent(result.post.companyId)}&saved=post-acknowledged`);
 }

 if(path==='/comms/start'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const conversation=await services.comms.startConversation(actor,{companyId:form.companyId,name:form.name,memberIds:form.memberIds||[]});
  return redirect(`/comms/thread?id=${encodeURIComponent(conversation.id)}`);
 }

 if(path==='/comms/send'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const message=await services.comms.sendMessage(actor,{conversationId:form.conversationId,body:form.body});
  return redirect(`/comms/thread?id=${encodeURIComponent(message.conversationId)}&saved=message-sent`);
 }

 if(path==='/library'&&method==='GET'){
  permissions.requirePermission(actor,'knowledge.view');
  const company=await companyFor(actor,companies,url.searchParams.get('companyId'));
  if(!company)return redirect('/home');
  const categoryId=url.searchParams.get('categoryId')||null;
  const [categories,articles]=await Promise.all([services.library.categories(actor,company.id),services.library.articles(actor,company.id,categoryId)]);
  return html(200,views.library({account:viewer,company,companies,categories,articles,selectedCategory:categoryId,
   canManage:permissions.can(actor,'knowledge.manage.company'),notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/library/view'&&method==='GET'){
  const article=await services.library.article(actor,url.searchParams.get('id'));
  const categories=await services.library.categories(actor,article.companyId);
  return html(200,views.article({account:viewer,article,categories,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/library/category'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.library.saveCategory(actor,{companyId:form.companyId,name:form.name});
  return redirect(`/library?companyId=${encodeURIComponent(form.companyId)}&saved=category-saved`);
 }

 if(path==='/library/article'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const article=await services.library.saveArticle(actor,{companyId:form.companyId,title:form.title,body:form.body,categoryId:form.categoryId||null});
  return redirect(`/library/view?id=${encodeURIComponent(article.id)}&saved=article-saved`);
 }

 if(path==='/library/publish'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  const article=await services.library.publishArticle(actor,form.articleId);
  return redirect(`/library/view?id=${encodeURIComponent(article.id)}&saved=article-published`);
 }

 return false;
}
module.exports={route,companyFor};
