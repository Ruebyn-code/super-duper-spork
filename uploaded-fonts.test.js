const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {createServer}=require('./server'),{saveAdmin,saveUser}=require('./auth'),fonts=require('./uploaded-fonts');
const fixture=()=>fs.readFile(path.join(__dirname,'public/fonts/Opsilon-xRj8m.ttf'));
async function login(url,user='admin',password='font-admin-password'){const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:user,password})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0],session=await(await fetch(url+'/api/session',{headers:{Cookie:cookie}})).json();return {Cookie:cookie,'X-CSRF-Token':session.csrf,'Content-Type':'application/json'};}
async function setup(){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'font-tests-'));await saveAdmin(dir,'admin','font-admin-password');const server=createServer(dir);await new Promise(r=>server.listen(0,'127.0.0.1',r));return {dir,server,url:'http://127.0.0.1:'+server.address().port};}
async function cleanup({dir,server}){if(server.listening)await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
function woff(ttf){
 const count=ttf.readUInt16BE(4),directory=44+20*count,entries=[];let offset=directory,total=12+16*count;
 for(let i=0;i<count;i++){const at=12+16*i,original=ttf.subarray(ttf.readUInt32BE(at+8),ttf.readUInt32BE(at+8)+ttf.readUInt32BE(at+12)),compressed=zlib.deflateSync(original),data=compressed.length<original.length?compressed:original;entries.push({tag:ttf.subarray(at,at+4),checksum:ttf.readUInt32BE(at+4),offset,original:original.length,data});offset+=(data.length+3)&~3;total+=(original.length+3)&~3;}
 const result=Buffer.alloc(offset);result.write('wOFF');result.writeUInt32BE(ttf.readUInt32BE(0),4);result.writeUInt32BE(offset,8);result.writeUInt16BE(count,12);result.writeUInt32BE(total,16);
 entries.forEach((entry,i)=>{const at=44+20*i;entry.tag.copy(result,at);result.writeUInt32BE(entry.offset,at+4);result.writeUInt32BE(entry.data.length,at+8);result.writeUInt32BE(entry.original,at+12);result.writeUInt32BE(entry.checksum,at+16);entry.data.copy(result,entry.offset);});return result;
}
test('font uploads require administrator and CSRF, deduplicate files and serve immutable font assets',async()=>{
 const context=await setup();try{await saveUser(context.dir,'staff','font-staff-password');const bytes=await fixture(),input={name:'New font',fileName:'New.ttf',data:bytes.toString('base64')};const upload=headers=>fetch(context.url+'/api/fonts',{method:'POST',headers,body:JSON.stringify(input)});
 assert.equal((await upload({})).status,401);const staff=await login(context.url,'staff','font-staff-password');assert.equal((await upload(staff)).status,403);const admin=await login(context.url);assert.equal((await upload({Cookie:admin.Cookie,'Content-Type':'application/json'})).status,403);
 const first=await upload(admin);assert.equal(first.status,201);const saved=await first.json();assert.ok(fonts.isId(saved.font.id));assert.equal(saved.alreadyExists,false);const duplicate=await upload(admin);assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).font.id,saved.font.id);assert.equal((await fonts.list(context.dir)).length,1);
 const asset=await fetch(context.url+saved.font.url);assert.equal(asset.headers.get('content-type'),'font/ttf');assert.match(asset.headers.get('cache-control'),/immutable/);assert.deepEqual(Buffer.from(await asset.arrayBuffer()),bytes);assert.equal((await fetch(context.url+saved.font.url,{headers:{'If-None-Match':asset.headers.get('etag')}})).status,304);
 assert.equal((await fetch(context.url+saved.font.url.replace('.ttf','.otf'))).status,404);assert.equal((await fetch(context.url+'/api/fonts',{headers:staff})).status,403);
 }finally{await cleanup(context);}
});
test('uploaded fonts work in shared and scoped appearance, survive restart and do not leak between data directories',async()=>{
 const context=await setup(),other=await setup();try{const bytes=await fixture(),admin=await login(context.url),name='</style><script>window.injected=1</script>';
 const response=await fetch(context.url+'/api/fonts',{method:'POST',headers:admin,body:JSON.stringify({name,fileName:'display.ttf',data:bytes.toString('base64')})});const {font}=await response.json();assert.equal(response.status,201);
 assert.equal((await fetch(context.url+'/api/settings',{method:'PATCH',headers:admin,body:JSON.stringify({fonts:{headings:font.id,stockNames:font.id}})})).status,200);
 assert.equal((await fetch(context.url+'/api/element-overrides',{method:'PATCH',headers:admin,body:JSON.stringify({id:'index-7',changes:{font:font.id}})})).status,200);
 const html=await(await fetch(context.url+'/',{headers:admin})).text();assert.ok(html.includes('font-family:\'Uploaded_'+font.id.slice(7)));assert.ok(html.includes('href="'+font.url+'" as="font"'));assert.ok(html.includes('[data-edit-id="index-7"]{font-family:'));assert.ok(!html.includes(name));assert.ok(html.includes('\\u003c/style>'));
 const otherAdmin=await login(other.url);assert.equal((await fetch(other.url+'/api/settings',{method:'PATCH',headers:otherAdmin,body:JSON.stringify({fonts:{headings:font.id}})})).status,400);assert.equal((await fetch(other.url+font.url)).status,404);
 assert.equal((await fetch(context.url+'/api/element-overrides',{method:'PATCH',headers:admin,body:JSON.stringify({id:'index-7',changes:{font:'custom_'+'0'.repeat(64)}})})).status,400);
 await new Promise(r=>context.server.close(r));context.server=createServer(context.dir);await new Promise(r=>context.server.listen(0,'127.0.0.1',r));context.url='http://127.0.0.1:'+context.server.address().port;
 assert.deepEqual(Buffer.from(await(await fetch(context.url+font.url)).arrayBuffer()),bytes);const loginHtml=await(await fetch(context.url+'/login')).text();assert.ok(loginHtml.includes(font.url));assert.ok(loginHtml.includes('Uploaded_'+font.id.slice(7)));assert.equal((await fonts.list(context.dir))[0].name,name);
 }finally{await cleanup(context);await cleanup(other);}
});
test('font validation rejects wrong extensions, oversized and truncated files, malformed tables and directory traversal',async()=>{
 const context=await setup();try{const admin=await login(context.url),ttf=await fixture(),broken=Buffer.from(ttf);broken.writeUInt32BE(0xfffffff0,20);
 const inputs=[{fileName:'font.svg',bytes:ttf},{fileName:'font.otf',bytes:ttf},{fileName:'font.ttf',bytes:ttf.subarray(0,20)},{fileName:'font.ttf',bytes:broken},{fileName:'font.ttf',bytes:Buffer.alloc(2000001)},{fileName:'../font.ttf',bytes:ttf},{fileName:'font.ttf',bytes:Buffer.from('<script>') }];
 for(const input of inputs){const result=await fetch(context.url+'/api/fonts',{method:'POST',headers:admin,body:JSON.stringify({name:'Test',fileName:input.fileName,data:input.bytes.toString('base64')})});assert.equal(result.status,400,input.fileName);}
 assert.deepEqual(await fonts.list(context.dir),[]);
 const compressed=woff(ttf);fonts.validate(compressed,'woff');assert.equal((await fetch(context.url+'/api/fonts',{method:'POST',headers:admin,body:JSON.stringify({name:'Web font',fileName:'font.woff',data:compressed.toString('base64')})})).status,201);
 }finally{await cleanup(context);}
});
test('concurrent distinct font uploads preserve every font and existing built-in appearance selections',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'font-concurrent-'));try{const bytes=await fixture();await Promise.all([fonts.save(dir,{name:'TTF',fileName:'font.ttf',data:bytes.toString('base64')}),fonts.save(dir,{name:'WOFF',fileName:'font.woff',data:woff(bytes).toString('base64')})]);const library=await fonts.list(dir);assert.equal(library.length,2);const appearance=require('./appearance');const saved=await appearance.saveAppearance(dir,appearance.defaults);assert.deepEqual(saved.fonts,appearance.defaults.fonts);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
