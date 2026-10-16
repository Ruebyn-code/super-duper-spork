async function route({req,url,params,session,store,body,json,fail}){
 if(url!=='/api/knowledge-library'&&!url.startsWith('/api/knowledge-library/'))return false;
 if(!session)fail('Sign-in required.',401);
 if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/knowledge-library'){
  if(req.method==='GET')json(200,await store.list(session,Object.fromEntries(params)));
  else if(req.method==='POST')json(201,await store.save(session,await body(req,512000)));
  else fail('Unsupported library action.',405);return true;
 }
 if(url==='/api/knowledge-library/media'&&req.method==='POST'){json(201,await store.uploadMedia(session,await body(req,35000000)));return true;}
 const article=url.match(/^\/api\/knowledge-library\/([a-f0-9-]{36})$/i);
 if(article){if(req.method==='GET')json(200,await store.get(session,article[1]));else if(req.method==='PUT')json(200,await store.save(session,await body(req,512000),article[1]));else if(req.method==='DELETE')json(200,await store.remove(session,article[1],await body(req)));else fail('Unsupported article action.',405);return true;}
 fail('Article not found.',404);
}
module.exports={route};
