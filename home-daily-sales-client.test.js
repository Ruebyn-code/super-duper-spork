const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'public/home-daily-sales.js'),'utf8');
const snapshot=(amountCents=null,revision=0)=>({locationId:'mernda',locationName:'Mernda',checkedAt:'2026-10-25T05:30:00.000Z',entry:{tradingDate:'2026-10-25',available:true,availableAt:'2026-10-25T05:00:00.000Z',closesAt:'2026-10-25T06:00:00.000Z',expiresAt:'2026-10-25T13:00:00.000Z',amountCents,revision}});
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
async function page(fetchImpl,actorOverrides={}){
 const nodes=new Map(),events=new Map(),requests=[];
 const document={hidden:false,activeElement:null,body:{dataset:{homeDashboard:'manager'}},addEventListener(){},getElementById(id){if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,textContent:'',listeners:new Map(),setCustomValidity(value){this.invalid=value;},setAttribute(){},addEventListener(type,listener){this.listeners.set(type,listener);},blur(){if(document.activeElement===this)document.activeElement=null;}});return nodes.get(id);}};
 const actor={id:'user',csrf:'csrf-test',locationId:'mernda',dataScope:'location-mernda',...actorOverrides},window={appLocationId:'mernda',addEventListener(type,listener){if(!events.has(type))events.set(type,[]);events.get(type).push(listener);},dispatchEvent(event){for(const listener of events.get(event.type)||[])listener(event);return true;}};
 const fetch=async(url,options)=>{assert.equal(url,'/api/home-daily-sales');assert.equal(options.headers['X-Location-Id'],'mernda');assert.equal(options.headers['X-CSRF-Token'],actor.csrf);const request={method:options.method,body:options.body?JSON.parse(options.body):undefined};requests.push(request);return fetchImpl(request);};
 const form=document.getElementById('home-daily-sales-form'),input=document.getElementById('home-daily-sales-amount');form.reportValidity=()=>Boolean(input.value.trim())&&!input.invalid;
 vm.runInNewContext(source,{window,document,fetch,homeBoardModel:require('./public/home-board-model'),appAccess:{initialSession:async()=>actor,can:()=>true},Intl,Date,StorageEvent:class{constructor(type,options){this.type=type;Object.assign(this,options);}},localStorage:{setItem(){}},setInterval(){},setTimeout(){return 1;},clearTimeout(){}});
 await settle();
 return{requests,input,node:id=>document.getElementById(id),message:()=>document.getElementById('home-daily-sales-message').textContent,profile(value){window.homeProfile={actor,profile:value};document.body.dataset.homeDashboard=value;window.dispatchEvent({type:'home-dashboard-access',detail:{actor,profile:value}});},enter(value){input.value=value;document.activeElement=input;input.listeners.get('input')();},submit:()=>form.listeners.get('submit')({preventDefault(){}}),refresh:()=>events.get('focus')[0]()};
}
test('Head Office never fetches or displays daily sales entry, even before the dashboard controller publishes its mode',async()=>{
 const ui=await page(()=>{throw Error('Head Office must not request daily sales entry.');},{homeDashboard:'manager',permissions:['home.view','reporting.view','locations.all','sales.view','sales.edit']});
 assert.equal(ui.node('home-daily-sales').hidden,true);assert.equal(ui.node('home-hourly-upload').hidden,true);await ui.refresh();await ui.submit();assert.equal(ui.requests.length,0);
});
test('switching from Store to Head Office hides entry and ignores an in-flight refresh while keeping a Store draft',async()=>{
 const read=deferred();let hold=false;const ui=await page(()=>hold?read.promise:Response.json(snapshot()));ui.enter('125');hold=true;const pending=ui.refresh();ui.profile('head-office');
 read.resolve(Response.json(snapshot(10000,1)));await pending;assert.equal(ui.node('home-daily-sales').hidden,true);assert.equal(ui.node('home-hourly-upload').hidden,true);assert.equal(ui.input.value,'125');const count=ui.requests.length;await ui.refresh();await ui.submit();assert.equal(ui.requests.length,count);
 hold=false;ui.profile('manager');await settle();assert.equal(ui.node('home-daily-sales').hidden,false);assert.equal(ui.input.value,'125');assert.equal(ui.node('home-hourly-upload').hidden,false);
});
test('a refresh started before a Home save cannot clear its confirmed amount or roll the next save back to an old revision',async()=>{
 const read=deferred();let stored=snapshot(),hold=false;
 const ui=await page(async request=>{if(request.method==='GET')return hold?read.promise:Response.json(stored);stored=snapshot(request.body.amountCents,stored.entry.revision+1);return Response.json(stored);});
 hold=true;const pending=ui.refresh();ui.enter('1,234.56');await ui.submit();assert.equal(ui.input.value,'1,234.56');assert.equal(ui.message(),'Daily sales saved.');
 read.resolve(Response.json(snapshot()));await pending;assert.equal(ui.input.value,'1,234.56');assert.equal(ui.message(),'Daily sales saved.');
 ui.enter('1500');await ui.submit();assert.deepEqual(ui.requests.filter(r=>r.method==='PUT').map(r=>r.body),[{date:'2026-10-25',amountCents:123456,revision:0},{date:'2026-10-25',amountCents:150000,revision:1}]);assert.equal(ui.input.value,'1,500.00');
});
test('an obsolete background error cannot replace the confirmation for a newer successful Home save',async()=>{
 const read=deferred();let hold=false;
 const ui=await page(async request=>request.method==='GET'?(hold?read.promise:Response.json(snapshot())):Response.json(snapshot(request.body.amountCents,1)));
 hold=true;const pending=ui.refresh();ui.enter('0');await ui.submit();read.resolve(Response.json({error:'Old refresh failed.'},{status:503}));await pending;
 assert.equal(ui.input.value,'0.00');assert.equal(ui.message(),'Daily sales saved.');assert.equal(ui.node('home-daily-sales-save').disabled,false);
});
test('a lost save response retains the Home entry for an explicit idempotent retry and later refresh',async()=>{
 let stored=snapshot(),lose=true;
 const ui=await page(async request=>{if(request.method==='GET')return Response.json(stored);if(stored.entry.amountCents!==request.body.amountCents)stored=snapshot(request.body.amountCents,stored.entry.revision+1);if(lose){lose=false;throw Error('Connection interrupted.');}return Response.json(stored);});
 ui.enter('987.65');await ui.submit();assert.equal(ui.input.value,'987.65');assert.match(ui.message(),/Connection interrupted/);assert.equal(ui.node('home-daily-sales-save').disabled,false);assert.equal(ui.node('home-daily-sales-discard').hidden,false);
 await ui.submit();assert.equal(stored.entry.revision,1);assert.equal(ui.message(),'Daily sales saved.');assert.equal(ui.node('home-daily-sales-discard').hidden,true);await ui.refresh();assert.equal(ui.input.value,'987.65');assert.equal(ui.requests.filter(r=>r.method==='PUT').length,2);
});
test('fresh background sales changes preserve a different unsaved Home amount and require an explicit reload',async()=>{
 let stored=snapshot(10000,1);const ui=await page(async()=>Response.json(stored));ui.enter('120');stored=snapshot(11000,2);await ui.refresh();
 assert.equal(ui.input.value,'120');assert.match(ui.message(),/changed in another tab/);assert.equal(ui.node('home-daily-sales-reload').hidden,false);assert.equal(ui.requests.filter(r=>r.method==='PUT').length,0);
});
test('Home history links select the displayed trading week across Sunday, Monday and year boundaries',async()=>{
 for(const[tradingDate,week]of [['2026-10-25','2026-10-19'],['2026-10-26','2026-10-26'],['2026-01-04','2025-12-29']]){const value=snapshot(123456,1);value.entry.tradingDate=tradingDate;const ui=await page(async()=>Response.json(value));assert.equal(ui.node('home-daily-sales-history').href,'/sales?week='+week+'#entry');}
});
