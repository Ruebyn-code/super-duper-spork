const {can}=require('./permissions');
async function route({req,res,url,params,session,store,body,json,fail}){
 if(!url.startsWith('/api/communications/'))return false;
 if(!session)fail('Sign-in required.',401);
 if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 const need=key=>{if(!can(session,key))fail('Your permission level does not allow this action.',403);};
 if(url==='/api/communications/required'&&req.method==='GET'){json(200,await store.required(session));return true;}
 const receipt=url.match(/^\/api\/communications\/posts\/([a-f0-9-]+)\/(read|snooze)$/i);
 if(receipt&&req.method==='POST'){json(200,await store.receipt(session,receipt[1],await body(req),receipt[2]));return true;}
 const media=url.match(/^\/api\/communications\/media\/([a-f0-9-]+)$/i);
 if(media&&req.method==='GET'){const file=await store.getMedia(session,media[1]),inline=/^(image|video|audio)\//.test(file.mime),headers={'Content-Type':file.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Security-Policy':"default-src 'none'; sandbox",'Content-Disposition':(inline?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(file.name).replace(/'/g,'%27'),'Accept-Ranges':'bytes'};let start=0,end=file.data.length-1;if(req.headers.range){const match=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);if(!match||!match[1]&&!match[2])fail('Invalid file range.',416);if(!match[1])start=Math.max(0,file.data.length-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=file.data.length)fail('Invalid file range.',416);headers['Content-Range']='bytes '+start+'-'+end+'/'+file.data.length;}headers['Content-Length']=end-start+1;res.writeHead(req.headers.range?206:200,headers);res.end(file.data.subarray(start,end+1));return true;}
 need('comms.view');
 if(url==='/api/communications/media'&&req.method==='POST'){if(!can(session,'comms.chat')&&!can(session,'comms.post.company')&&!can(session,'comms.post.network'))fail('Permission to write chats or posts is required.',403);json(201,await store.uploadMedia(session,await body(req,35000000)));return true;}
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
 const pin=url.match(/^\/api\/communications\/threads\/([a-f0-9-]+)\/pin$/i);
 if(pin){if(req.method!=='PUT')fail('Unsupported pin action.',405);json(200,await store.pinThread(session,pin[1],await body(req)));return true;}
 const reaction=url.match(/^\/api\/communications\/(posts|threads)\/([a-f0-9-]+)(?:\/messages\/([a-f0-9-]+))?\/reactions$/i);
 if(reaction){if(req.method!=='PUT'||reaction[1]==='posts'&&reaction[3])fail('Unsupported reaction action.',405);if(reaction[1]==='threads')need('comms.chat');json(200,await store.react(session,reaction[1]==='posts'?'post':'thread',reaction[2],reaction[3],await body(req)));return true;}
 const thread=url.match(/^\/api\/communications\/threads\/([a-f0-9-]+)\/(messages|read)$/i);
 if(thread){if(thread[2]==='messages'&&req.method==='GET')json(200,await store.messages(session,thread[1],Object.fromEntries(params)));else if(thread[2]==='messages'&&req.method==='POST'){need('comms.chat');json(201,await store.send(session,thread[1],await body(req,128000)));}else if(thread[2]==='read'&&req.method==='POST')json(200,await store.readThread(session,thread[1],await body(req)));else fail('Unsupported chat action.',405);return true;}
 fail('Communication not found.',404);
}
module.exports={route};
