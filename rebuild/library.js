// Knowledge library for the rebuilt app: company categories and articles.
//
// Library content is company-scoped and read-only for everyone but its
// managers. Drafts exist only for managers; a published article is what
// learners and staff can read, and publishing stamps who and when. Browsing
// never writes, and no article read starts training or acknowledgement work.
const crypto=require('node:crypto');
const permissions=require('./permissions');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max=20000)=>String(value??'').trim().slice(0,max);

function createLibrary({store,now=Date.now}){
 const stamp=()=>new Date(now()).toISOString();

 async function scope(actor,companyId){
  permissions.requirePermission(actor,'knowledge.view');
  const company=permissions.company(actor,companyId,await store.read('companies'));
  return company;
 }
 const manages=actor=>permissions.can(actor,'knowledge.manage.company');

 async function categories(actor,companyId){
  const company=await scope(actor,companyId);
  const list=(await store.read('articleCategories')).filter(category=>category.companyId===company.id);
  return list.sort((a,b)=>(a.order||0)-(b.order||0)||a.name.localeCompare(b.name));
 }

 async function saveCategory(actor,input){
  const company=await scope(actor,input?.companyId);
  permissions.requirePermission(actor,'knowledge.manage.company');
  const name=text(input?.name,60);
  if(!name)fail('Give the category a name.');
  return store.change('articleCategories',list=>{
   const existing=input?.categoryId?list.find(category=>category.id===input.categoryId&&category.companyId===company.id):null;
   if(input?.categoryId&&!existing)fail('Category not found.',404);
   if(list.some(category=>category.id!==existing?.id&&category.companyId===company.id&&category.name.toLowerCase()===name.toLowerCase()))fail('That category already exists.',409);
   if(existing){existing.name=name;existing.order=Number(input?.order)||existing.order||0;return existing;}
   const record={id:crypto.randomUUID(),companyId:company.id,name,order:Number(input?.order)||0,createdAt:stamp()};
   list.push(record);
   return record;
  });
 }

 async function saveArticle(actor,input){
  const company=await scope(actor,input?.companyId);
  permissions.requirePermission(actor,'knowledge.manage.company');
  const title=text(input?.title,140);
  if(!title)fail('Give the article a title.');
  const body=text(input?.body,20000);
  if(!body)fail('Write the article body.');
  const categories=await store.read('articleCategories');
  const categoryId=input?.categoryId||null;
  if(categoryId&&!categories.some(category=>category.id===categoryId&&category.companyId===company.id))fail('Choose a category in this company.');
  return store.change('articles',list=>{
   const existing=input?.articleId?list.find(article=>article.id===input.articleId&&article.companyId===company.id):null;
   if(input?.articleId&&!existing)fail('Article not found.',404);
   if(existing){
    if(existing.status==='published')fail('That article is published. Create a new one to revise it.',409);
    Object.assign(existing,{title,body,categoryId,updatedAt:stamp()});
    return existing;
   }
   const record={id:crypto.randomUUID(),companyId:company.id,title,body,categoryId,status:'draft',
    authorId:actor.id,authorName:actor.name,createdAt:stamp(),updatedAt:stamp(),publishedAt:null};
   list.push(record);
   return record;
  });
 }

 async function publishArticle(actor,articleId){
  const article=(await store.read('articles')).find(record=>record.id===articleId);
  if(!article)fail('Article not found.',404);
  await scope(actor,article.companyId);
  permissions.requirePermission(actor,'knowledge.manage.company');
  if(article.status==='published')fail('That article is already published.',409);
  return store.change('articles',list=>{
   const record=list.find(item=>item.id===articleId);
   record.status='published';
   record.publishedAt=stamp();
   record.publishedByName=actor.name;
   return record;
  });
 }

 async function articles(actor,companyId,categoryId){
  const company=await scope(actor,companyId);
  const list=(await store.read('articles')).filter(article=>article.companyId===company.id);
  return list
   .filter(article=>manages(actor)||article.status==='published')
   .filter(article=>!categoryId||article.categoryId===categoryId)
   .sort((a,b)=>(b.publishedAt||b.updatedAt).localeCompare(a.publishedAt||a.updatedAt))
   .map(article=>({...article,body:manages(actor)||article.status==='published'?article.body:null}));
 }

 async function article(actor,articleId){
  const article=(await store.read('articles')).find(record=>record.id===articleId);
  if(!article)fail('Article not found.',404);
  await scope(actor,article.companyId);
  if(article.status!=='published'&&!manages(actor))throw permissions.deny('Article not found.',404);
  return article;
 }

 return {categories,saveCategory,saveArticle,publishArticle,articles,article,manages};
}
module.exports={createLibrary};
