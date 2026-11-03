const fs=require('node:fs'),path=require('node:path');
const manifest=require('./reference-pack-manifest.json');
const file=path.join(__dirname,'public/reference-pack/OpStack-reference-pack.zip');
const fail=(message,status)=>{throw Object.assign(Error(message),{status});};
// Call only after the native tenant/console authentication and reading gates.
async function route({req,res,url,base='/api/help/reference-pack'}){
 if(url!==base&&url!==base+'/download')return false;
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD','Cache-Control':'private, no-store'});res.end();return true;}
 let stat;try{stat=await fs.promises.stat(file);}catch(error){if(error.code!=='ENOENT')throw error;fail('The reference pack is unavailable. Please try again after deployment.',503);}
 if(!stat.isFile()||stat.size!==manifest.size)fail('The reference pack is unavailable. Please try again after deployment.',503);
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
 if(url===base){const body=Buffer.from(JSON.stringify(manifest));res.writeHead(200,{...headers,'Content-Type':'application/json','Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body);return true;}
 res.writeHead(200,{...headers,'Content-Type':'application/zip','Content-Length':stat.size,'Content-Disposition':'attachment; filename="OpStack-reference-pack.zip"'});
 if(req.method==='HEAD'){res.end();return true;}
 const stream=fs.createReadStream(file);stream.on('error',error=>res.destroy(error));res.on('close',()=>stream.destroy());stream.pipe(res);return true;
}
module.exports={route};
