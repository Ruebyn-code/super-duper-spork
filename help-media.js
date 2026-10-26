const fs=require('node:fs'),path=require('node:path');
function range(value,size){const match=/^bytes=(\d*)-(\d*)$/.exec(value||'');if(!match||!match[1]&&!match[2])return null;let start,end;if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return null;start=Math.max(0,size-suffix);end=size-1;}else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;}return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start?{start,end:Math.min(end,size-1)}:null;}
function createMediaServer(directory,manifest){
 const assets=new Map();for(const guide of Object.values(manifest.guides))for(const asset of [...guide.pictures,guide.video,guide.captions])assets.set(asset.url,asset);
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/help-media/'))return false;const asset=assets.get(url.pathname);if(!asset){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Guide media not found.');return true;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return true;}
  const file=path.join(directory,path.basename(asset.url));let stat;try{stat=await fs.promises.stat(file);}catch(error){if(error.code!=='ENOENT')throw error;res.writeHead(404);res.end();return true;}if(!stat.isFile()||stat.size!==asset.size){res.writeHead(503);res.end();return true;}
  const etag='"'+asset.sha256+'"',headers={'Content-Type':asset.type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes',ETag:etag};
  if(!req.headers.range&&(req.headers['if-none-match']||'').split(/\s*,\s*/).includes(etag)){res.writeHead(304,headers);res.end();return true;}
  let slice;if(req.method==='GET'&&req.headers.range&&(!req.headers['if-range']||req.headers['if-range']===etag)){slice=range(req.headers.range,stat.size);if(!slice){res.writeHead(416,{...headers,'Content-Range':'bytes */'+stat.size});res.end();return true;}}
  const start=slice?.start||0,end=slice?.end??stat.size-1;headers['Content-Length']=String(end-start+1);if(slice)headers['Content-Range']='bytes '+start+'-'+end+'/'+stat.size;res.writeHead(slice?206:200,headers);if(req.method==='HEAD'){res.end();return true;}
  const stream=fs.createReadStream(file,{start,end});stream.on('error',error=>res.destroy(error));res.on('close',()=>stream.destroy());stream.pipe(res);return true;
 };
}
module.exports={range,createMediaServer};
