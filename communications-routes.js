const {can}=require('./permissions');
async function route({req,url,params,session,store,body,json,fail}){
 if(!url.startsWith('/api/communications/'))return false;
 if(!session)fail('Sign-in required.',401);
 if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 const need=key=>{if(!can(session,key))fail('Your permission level does not allow this action.',403);};
 if(url==='/api/communications/required'&&req.method==='GET'){json(200,await store.required(session));return true;}
 const receipt=url.match(/^\/api\/communications\/posts\/([a-f0-9-]+)\/(read|snooze)$/i);
 if(receipt&&req.method==='POST'){json(200,await store.receipt(session,receipt[1],await body(req),receipt[2]));return true;}
 need('comms.view');
 if(url==='/api/communications/unread'&&req.method==='GET'){json(200,await store.unread(session));return true;}
 if(url==='/api/communications/people'&&req.method==='GET'){need('comms.chat');json(200,{people:await store.directory(session)});return true;}
 if(url==='/api/communications/posts'){
  if(req.method==='GET')json(200,await store.posts(session,Object.fromEntries(params)));
  else if(req.method==='POST')json(201,await store.savePost(session,await body(req,256000)));
  else fail('Unsupported post action.',405);return true;
 }
 const post=url.match(/^\/api\/communications\/posts\/([a-f0-9-]+)(?:\/(readers))?$/i);
 if(post){if(post[2]&&req.method==='GET')json(200,await store.readers(session,post[1]));else if(!post[2]&&req.method==='PUT')json(200,await store.savePost(session,await body(req,256000),post[1]));else if(!post[2]&&req.method==='DELETE')json(200,await store.removePost(session,post[1],await body(req)));else fail('Unsupported post action.',405);return true;}
 if(url==='/api/communications/threads'){
  if(req.method==='GET')json(200,await store.threads(session));else if(req.method==='POST'){need('comms.chat');json(201,await store.createThread(session,await body(req,24000)));}else fail('Unsupported chat action.',405);return true;
 }
 const thread=url.match(/^\/api\/communications\/threads\/([a-f0-9-]+)\/(messages|read)$/i);
 if(thread){if(thread[2]==='messages'&&req.method==='GET')json(200,await store.messages(session,thread[1],Object.fromEntries(params)));else if(thread[2]==='messages'&&req.method==='POST'){need('comms.chat');json(201,await store.send(session,thread[1],await body(req,128000)));}else if(thread[2]==='read'&&req.method==='POST')json(200,await store.readThread(session,thread[1],await body(req)));else fail('Unsupported chat action.',405);return true;}
 fail('Communication not found.',404);
}
module.exports={route};
