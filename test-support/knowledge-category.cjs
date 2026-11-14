// Test helper: every Knowledge centre article needs a category, so fixture article creates that
// don't choose one get a shared "General" category for their scope (reused when it already exists).
module.exports=function withKnowledgeCategory(request){
 return async function(actor,url,method='GET',body,extra){
  if(url==='/api/knowledge-library'&&method==='POST'&&body&&typeof body==='object'&&!Array.isArray(body)&&body.categoryId===undefined){
   const scope=body.scope==='network'?'network':'company',name=scope==='network'?'General (network)':'General';
   const listed=await request(actor,'/api/knowledge-library/categories','GET',undefined,extra);
   let category=(listed?.data?.categories||[]).find(item=>item.scope===scope&&item.name===name);
   if(!category){const made=await request(actor,'/api/knowledge-library/categories','POST',{name,scope},extra);if(made?.status===201)category=made.data;}
   if(category)body={...body,categoryId:category.id};
  }
  return request(actor,url,method,body,extra);
 };
};
