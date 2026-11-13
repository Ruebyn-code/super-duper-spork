async function route({req,res,url,params,session,store,body,json,fail,origin}){
 if(url!=='/api/knowledge-library'&&!url.startsWith('/api/knowledge-library/'))return false;
 if(!session)fail('Sign-in required.',401);
 if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/knowledge-library/categories'){if(req.method==='GET')json(200,await store.categories(session));else if(req.method==='POST')json(201,await store.saveCategory(session,await body(req)));else fail('Unsupported category action.',405);return true;}
 const category=url.match(/^\/api\/knowledge-library\/categories\/([a-f0-9-]{36})$/i);if(category){if(req.method==='PUT')json(200,await store.saveCategory(session,await body(req),category[1]));else if(req.method==='DELETE')json(200,await store.removeCategory(session,category[1],await body(req)));else fail('Unsupported category action.',405);return true;}
 if(url==='/api/knowledge-library'){
  if(req.method==='GET')json(200,await store.list(session,Object.fromEntries(params)));
  else if(req.method==='POST')json(201,await store.save(session,await body(req,512000)));
  else fail('Unsupported library action.',405);return true;
 }
 if(url==='/api/knowledge-library/levels'){if(req.method==='GET')json(200,await store.levels(session));else fail('Unsupported permission level action.',405);return true;}
 if(url==='/api/knowledge-library/media'&&req.method==='POST'){json(201,await store.uploadMedia(session,await body(req,35000000)));return true;}
 if(url==='/api/knowledge-library/home'){if(req.method==='GET')json(200,await store.home(session));else fail('Unsupported action.',405);return true;}
 if(url==='/api/knowledge-library/owners'){if(req.method==='GET')json(200,await store.owners(session));else fail('Unsupported action.',405);return true;}
 const action=url.match(/^\/api\/knowledge-library\/([a-f0-9-]{36})\/(favourite|viewed|feedback|questions|confirm|check|reviewed|publish|approval|draft|versions|qr\.svg)(?:\/([a-f0-9-]{36}|\d+))?(?:\/(restore))?$/i);
 if(action){const [,id,name,sub,tail]=action,m=req.method,input=m==='GET'?undefined:await body(req,200000),only=(method,run)=>{if(m!==method||sub&&name!=='questions'&&name!=='versions')fail('Unsupported article action.',405);return run();};
  if(name==='qr.svg'){if(m!=='GET')fail('Unsupported article action.',405);const svg=await store.qrSvg(session,id,origin);res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(svg);return true;}
  if(name==='questions'){if(!sub&&m==='POST')json(201,await store.ask(session,id,input));else if(sub&&m==='PUT')json(200,await store.answer(session,id,sub,input));else if(sub&&m==='DELETE')json(200,await store.removeQuestion(session,id,sub));else fail('Unsupported question action.',405);return true;}
  if(name==='versions'){if(!sub&&m==='GET')json(200,await store.versions(session,id));else if(sub&&tail==='restore'&&m==='POST')json(200,await store.restore(session,id,Number(sub),input));else fail('Unsupported version action.',405);return true;}
  if(tail)fail('Unsupported article action.',405);
  const handlers={favourite:['PUT',()=>store.favourite(session,id,input)],viewed:['POST',()=>store.viewed(session,id)],feedback:['PUT',()=>store.feedback(session,id,input)],confirm:['POST',()=>store.confirmRead(session,id,input)],check:['POST',()=>store.takeCheck(session,id,input)],reviewed:['POST',()=>store.reviewed(session,id,input)],publish:['POST',()=>store.publish(session,id,input)],approval:['POST',()=>store.requestApproval(session,id,input)],draft:['DELETE',()=>store.discardDraft(session,id,input)]};
  const [method,run]=handlers[name];json(200,await only(method,run));return true;}
 const article=url.match(/^\/api\/knowledge-library\/([a-f0-9-]{36})$/i);
 if(article){if(req.method==='GET')json(200,await store.get(session,article[1]));else if(req.method==='PUT')json(200,await store.save(session,await body(req,512000),article[1]));else if(req.method==='DELETE')json(200,await store.remove(session,article[1],await body(req)));else fail('Unsupported article action.',405);return true;}
 fail('Article not found.',404);
}
module.exports={route};
