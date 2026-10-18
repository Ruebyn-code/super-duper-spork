const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {gzip}=require('node:zlib');
const {promisify}=require('node:util');
const compress=promisify(gzip);
const compressibleFile=/\.(?:js|mjs|css|svg|txt|md|ttf)$/;
const types={js:'text/javascript',mjs:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',ttf:'font/ttf',txt:'text/plain; charset=utf-8',md:'text/plain; charset=utf-8'};

function acceptsGzip(header=''){
  const encodings=new Map(header.toLowerCase().split(',').map(part=>{
    const [name,...parameters]=part.trim().split(';');
    const quality=parameters.map(value=>value.trim()).find(value=>value.startsWith('q='));
    return [name,quality===undefined?1:Number(quality.slice(2))];
  }));
  return (encodings.get('gzip')??encodings.get('*')??0)>0;
}

function createPublicAssets(directory,files){
  const cache=new Map();
  async function read(file){
    const target=path.join(directory,file),stat=await fs.stat(target),stamp=stat.mtimeMs+':'+stat.size;
    let entry=cache.get(file);
    if(!entry||entry.stamp!==stamp){
      entry={stamp,promise:(async()=>{
        const data=await fs.readFile(target),etag='"'+crypto.createHash('sha256').update(data).digest('hex')+'"';
        return {data,etag,compressed:compressibleFile.test(file)?await compress(data):null};
      })()};
      cache.set(file,entry);
    }
    try{return await entry.promise;}catch(error){if(cache.get(file)===entry)cache.delete(file);throw error;}
  }
  async function serve(req,res,url){
    const file=files[url.pathname];
    if(!['GET','HEAD'].includes(req.method)||!file||file.endsWith('.html'))return false;
    const asset=await read(file),encoded=asset.compressed&&acceptsGzip(req.headers['accept-encoding']);
    const data=encoded?asset.compressed:asset.data,etag=encoded?asset.etag.replace(/"$/,'-gzip"'):asset.etag;
    res.setHeader('ETag',etag);
    res.setHeader('Cache-Control',url.searchParams.get('v')===asset.etag.slice(1,-1)?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate');
    if(asset.compressed)res.setHeader('Vary','Accept-Encoding');
    if(encoded)res.setHeader('Content-Encoding','gzip');
    if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return true;}
    res.writeHead(200,{'Content-Type':types[path.extname(file).slice(1)]||'application/octet-stream','Content-Length':data.length,'X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);return true;
  }
  async function versionMarkup(markup){
    const pattern=/(<(?:script|link)\b[^>]*?\b(?:src|href)=)(["'])(\/[^"']*)\2/g;
    const replacements=new Map();
    await Promise.all([...markup.matchAll(pattern)].map(async([match,prefix,quote,source])=>{
      if(source.startsWith('//'))return;
      const url=new URL(source,'http://localhost'),file=files[url.pathname];
      if(!file||file.endsWith('.html'))return;
      const asset=await read(file);url.searchParams.set('v',asset.etag.slice(1,-1));
      replacements.set(match,prefix+quote+url.pathname+url.search+url.hash+quote);
    }));
    return markup.replace(pattern,match=>replacements.get(match)||match);
  }
  return {read,serve,versionMarkup};
}
module.exports={createPublicAssets};
