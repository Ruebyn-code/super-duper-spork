// Serve only the fixed, demo-only marketing build. Never resolve customer files.
const fs=require('node:fs/promises'),path=require('node:path');
const assets=['01-store-dashboard.png','02-roster-builder.png','03-ordering.png','04-timesheets.png','05-training.png','06-knowledge-library.png','07-communications.png','08-reporting.png','09-mobile-dashboard.png','10-mobile-sales.png','opstack-icon.png'];
const files=new Map([['/website/',['index.html','text/html; charset=utf-8']],['/website/styles.css',['styles.css','text/css; charset=utf-8']],['/website/site.js',['site.js','text/javascript; charset=utf-8']],['/website/assets/SpaceGrotesk.ttf',['assets/SpaceGrotesk.ttf','font/ttf']],['/website/assets/SpaceGrotesk-OFL.txt',['assets/SpaceGrotesk-OFL.txt','text/plain; charset=utf-8']],...assets.map(name=>['/website/assets/'+name,['assets/'+name,'image/png']])]);
async function serve(req,res,url){
 const route=url.pathname;if(route!=='/website'&&!route.startsWith('/website/'))return false;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{Allow:'GET, HEAD'});res.end();return true;}
 if(route==='/website'){res.writeHead(308,{Location:'/website/'});res.end();return true;}
 const file=files.get(route);if(!file){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:'Not found');return true;}
 const bytes=await fs.readFile(path.join(__dirname,'website',file[0]));res.writeHead(200,{'Content-Type':file[1],'Content-Length':bytes.length,'Cache-Control':route.endsWith('.png')?'public, max-age=3600':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);return true;
}
module.exports={serve};
