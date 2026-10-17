const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createServer}=require('./server'),{saveAdmin,saveUser}=require('./auth');
async function runtime({account='alice',storage=new Map(),dark=false,blocked=false}={}){
 const listeners={},root={dataset:{},style:{}},media={matches:dark,addEventListener(event,handler){this.change=handler;}};
 const context={window:{appThemeAccount:account,matchMedia:()=>media,addEventListener:(event,handler)=>listeners[event]=handler,dispatchEvent(){}},document:{documentElement:root,addEventListener(){}},localStorage:{getItem:key=>{if(blocked)throw Error('Unavailable');return storage.get(key)??null;},setItem:(key,value)=>{if(blocked)throw Error('Unavailable');storage.set(key,value);}},CustomEvent:class {}};
 vm.runInNewContext(await fs.readFile(path.join(__dirname,'public/theme.js'),'utf8'),context);
 return {theme:context.window.appTheme,root,media,listeners,storage};
}
test('dark mode restores before rendering, persists across pages and stays separate for each account',async()=>{
 const storage=new Map([['opstack-theme:alice','dark']]),app=await runtime({storage});assert.equal(app.root.dataset.theme,'dark');assert.equal(app.root.style.colorScheme,'dark');
 app.theme.setAccount('bob');assert.equal(app.theme.mode,'light');app.theme.toggle();assert.equal(storage.get('opstack-theme:bob'),'dark');
 app.theme.setAccount('alice');assert.equal(app.theme.mode,'dark');app.theme.toggle();assert.equal(storage.get('opstack-theme:alice'),'light');assert.equal(storage.get('opstack-theme:bob'),'dark');
 assert.equal((await runtime({account:'alice',storage,dark:true})).theme.mode,'light');assert.equal((await runtime({account:'bob',storage})).theme.mode,'dark');assert.equal((await runtime({account:'guest',storage})).theme.mode,'light');
});
test('device changes and other tabs update unsaved choices without overriding an explicit light or dark preference',async()=>{
 const app=await runtime({dark:true});assert.equal(app.theme.mode,'dark');app.media.matches=false;app.media.change();assert.equal(app.theme.mode,'light');app.theme.set('dark');app.media.change();assert.equal(app.theme.mode,'dark');
 app.storage.set('opstack-theme:alice','light');app.listeners.storage({key:'opstack-theme:alice'});assert.equal(app.theme.mode,'light');app.storage.set('opstack-theme:alice','dark');app.listeners.storage({key:'opstack-theme:bob'});assert.equal(app.theme.mode,'light');
 app.storage.clear();app.listeners.storage({key:null});assert.equal(app.theme.mode,'light');app.media.matches=true;app.media.change();assert.equal(app.theme.mode,'dark');
 app.theme.set('invalid');assert.equal(app.theme.mode,'dark');
});
test('theme controls keep working with blocked storage and remember choices while switching accounts on the page',async()=>{
 const app=await runtime({blocked:true});assert.equal(app.theme.mode,'light');app.theme.toggle();assert.equal(app.theme.mode,'dark');app.theme.setAccount('bob');assert.equal(app.theme.mode,'light');app.theme.setAccount('alice');assert.equal(app.theme.mode,'dark');
});
test('all user roles receive early theme loading while public sign-in uses its separate guest preference',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'dark-theme-'));await saveAdmin(dir,'Office','office-test-password');await saveUser(dir,'Member','member-test-password');const server=createServer(dir);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const name of ['Office','Member']){
   const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name,password:name==='Office'?'office-test-password':'member-test-password'})});assert.equal(login.status,200);const Cookie=login.headers.get('set-cookie').split(';')[0],session=await(await fetch(base+'/api/session',{headers:{Cookie}})).json();
   for(const route of ['/home','/','/cart','/sales','/communications','/rostering']){const html=await(await fetch(base+route,{headers:{Cookie}})).text();assert.ok(html.includes('window.appThemeAccount='+JSON.stringify(session.id)));assert.ok(html.indexOf('src="/theme.js"')<html.indexOf('href="/style.css"'));assert.ok(html.includes('href="/dark-mode.css"'));assert.ok(!html.includes('admin_session='));}
  }
  const login=await(await fetch(base+'/login')).text();assert.ok(login.includes('window.appThemeAccount="guest"'));for(const asset of ['/theme.js','/theme-colours.js','/dark-mode.css'])assert.equal((await fetch(base+asset)).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}
});
