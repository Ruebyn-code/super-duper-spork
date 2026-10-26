const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const pending={id:crypto.randomUUID(),revision:1,from:{id:'from',name:'North',companyId:'company',companyName:'Company'},to:{id:'to',name:'South',companyId:'company',companyName:'Company'},createdAt:'2026-10-26T01:00:00Z',senderName:'Sender',notes:'',moveCosts:false,items:[{source:{name:'Cups',unitAmount:'Box'},target:{name:'Cups',unitAmount:'Box'},quantity:2,targetQuantity:2}]};
const reply=(transfers=[pending])=>({companyId:'company',locationId:'to',transfers});
const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>value});
const flush=async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));};
async function client(handler){
 const nodes=new Map(),calls=[],values=new Map();let active;
 function node(tag='div'){
  const listeners=new Map();let id='',text='';const n={tagName:tag.toUpperCase(),dataset:{},children:[],parentElement:null,hidden:false,disabled:false,open:false,
   get id(){return id;},set id(value){id=value;nodes.set(value,n);},get textContent(){return text+this.children.map(child=>child.textContent||'').join('');},set textContent(value){text=String(value);this.children=[];},
   append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}},replaceChildren(...children){for(const c of this.children)c.parentElement=null;this.children=[];text='';this.append(...children);},after(child){this.parentElement.append(child);},
   setAttribute(key,value){if(key==='id')this.id=value;else this[key]=value;},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);},
   closest(selector){for(let part=this;part;part=part.parentElement)if(selector==='[data-home-transfer]'&&part.dataset.homeTransfer)return part;return null;},focus(){active=this;},get isConnected(){return Boolean(this.parentElement);},showModal(){this.open=true;},close(){this.open=false;this.dispatchEvent(new Event('close'));}
  };return n;
 }
 const body=node('body'),root=node('section'),feedback=node('p');root.id='home-transfer-approvals';feedback.id='home-transfer-feedback';body.append(root,feedback);root.hidden=feedback.hidden=true;active=body;
 const document=node('document');document.createElement=node;document.getElementById=id=>nodes.get(id);Object.defineProperty(document,'activeElement',{get:()=>active});document.hidden=false;
 const window=node('window'),actor={id:'manager',companyId:'company',locationId:'to',locationName:'South',csrf:'csrf',permissions:['home.view','transfers.view','transfers.receive']};
 const fetch=async(url,options)=>{const call={url,...options,input:options.body?JSON.parse(options.body):undefined};calls.push(call);return handler?handler(call,calls):response(reply());};
 vm.runInNewContext(fs.readFileSync(require.resolve('./public/home-transfer-approvals.js'),'utf8'),{window,document,fetch,appAccess:{can:(key,user)=>user.permissions.includes(key),initialSession:async()=>actor},localStorage:{setItem:(key,value)=>values.set(key,value)},crypto,Intl,Event,setInterval:()=>0});
 await flush();const list=root.children[1],confirm=nodes.get('home-transfer-confirm'),dialog=nodes.get('home-transfer-dialog'),message=nodes.get('home-transfer-message');
 return{root,list,confirm,dialog,message,body:dialog.children[1],calls,window,values,review:()=>list.children[0].children[1].onclick(),close:()=>nodes.get('home-transfer-close').onclick()};
}

test('Home reads and opening/cancelling the transfer review never approve stock',async()=>{
 const c=await client();assert.equal(c.list.children.length,1);c.review();assert.equal(c.dialog.open,true);c.close();assert.equal(c.dialog.open,false);assert.equal(c.calls.filter(call=>call.method==='POST').length,0);assert.equal(c.list.children.length,1);
});

test('a lost receipt response keeps one request ID for an explicit retry and removes the approved row',async()=>{
 let committed=false,attempts=0;const c=await client(call=>{
  if(call.method==='POST'){attempts++;if(!committed){committed=true;throw TypeError('Failed to fetch');}return response({id:pending.id,status:'received',revision:2,from:{id:'from'},to:{id:'to'}});}
  return response(reply(committed?[]:[pending]));
 });c.review();await c.confirm.onclick();assert.match(c.message.textContent,/Retry approval/);assert.equal(c.confirm.disabled,false);assert.equal(c.dialog.open,true);
 await c.confirm.onclick();const posts=c.calls.filter(call=>call.method==='POST');assert.equal(attempts,2);assert.deepEqual(posts[0].input,posts[1].input);assert.equal(c.dialog.open,false);assert.equal(c.list.children.length,0);assert.equal(c.root.hidden,true);assert(c.values.has('souvlaki-usage-updated-location-to'));
});

test('a pending read begun before receipt cannot restore the approved transfer afterwards',async()=>{
 let hold,reads=0,committed=false;const delayed=new Promise(resolve=>hold=resolve);
 const c=await client(call=>{if(call.method==='POST'){committed=true;return response({id:pending.id,status:'received',revision:2,from:{id:'from'},to:{id:'to'}});}reads++;return reads===2?delayed:response(reply(committed?[]:[pending]));});
 c.window.dispatchEvent(new Event('focus'));await flush();c.review();await c.confirm.onclick();assert.equal(c.list.children.length,0);hold(response(reply()));await flush();assert.equal(c.list.children.length,0);assert.equal(c.root.hidden,true);
});

test('revoked Home manager access clears pending details and closes the open review',async()=>{
 let denied=false;const c=await client(()=>denied?response({error:'Assigned managers only'},403):response(reply()));c.review();denied=true;c.window.dispatchEvent(new Event('focus'));await flush();assert.equal(c.root.hidden,true);assert.equal(c.list.children.length,0);assert.equal(c.dialog.open,false);assert.equal(c.body.children.length,0);assert.equal(c.calls.filter(call=>call.method==='POST').length,0);
});
