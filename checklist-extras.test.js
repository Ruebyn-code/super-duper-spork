const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {createServer}=require('./server'),{saveAdmin}=require('./auth'),extras=require('./checklist-extras'),model=require('./public/checklist-extras-model');
async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-cx-'));await saveAdmin(dir,'Office','office-test-password');let time=Date.parse('2026-10-19T02:00:00Z');
 const server=createServer(dir,{communicationsNow:()=>time,fetchImpl:()=>{throw Error('No provider calls in checklist feature tests');}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 async function request(actor,url,method='GET',input){const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...actor?.headers},body:input===undefined?undefined:JSON.stringify(input)}),type=response.headers.get('content-type')||'';return{status:response.status,type,data:type.includes('json')?await response.json():await response.text()};}
 async function login(username,password='member-test-password'){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(response.status,200);const actor={headers:{Cookie:response.headers.get('set-cookie').split(';')[0]}};actor.session=(await request(actor,'/api/session')).data;actor.headers['X-CSRF-Token']=actor.session.csrf;return actor;}
 const office=await login('Office','office-test-password'),first=office.session.locationId,company=(await request(office,'/api/companies','POST',{name:'Other company',locationName:'Other store'})).data,other=(await request(office,'/api/locations?all=true')).data.find(store=>store.companyId===company.id).id;
 for(const [name,ids] of [['Member',[first]],['Outside',[other]]]){const response=await request(office,'/api/accounts','POST',{username:name,password:'member-test-password',role:'user',locationId:ids[0],locationIds:ids});assert.equal(response.status,201,JSON.stringify(response.data));}
 const member=await login('Member'),outside=await login('Outside');
 const cx=(actor,route,method='GET',input)=>request(actor,'/api/checklist-extras/'+route,method,input),ops=(actor,route='',method='GET',input)=>request(actor,'/api/ops-management'+route,method,input);
 return{dir,office,member,outside,first,request,cx,ops,setTime:value=>{time=Date.parse(value);},close:async()=>{await new Promise(resolve=>server.close(resolve));await fs.rm(dir,{recursive:true,force:true});}};
}
const step=(type,extra={})=>({id:crypto.randomUUID(),type,title:type+' step',help:'',required:true,...extra});
async function checklist(app,steps){return(await app.ops(app.office,'/templates','POST',{requestId:crypto.randomUUID(),title:'Fridge checks',description:'',locationIds:[app.first],active:true,schedule:{kind:'manual',startDate:'2026-10-19'},steps})).data;}
async function complete(app,template,answers,actor=app.member){const run=(await app.ops(actor,'/runs','POST',{templateId:template.id,locationId:app.first,requestId:crypto.randomUUID()})).data;const saved=await app.ops(actor,'/runs/'+run.id,'PUT',{answers,complete:true,revision:run.revision});assert.equal(saved.status,200,JSON.stringify(saved.data));return saved.data;}

test('every starter template saves through the normal checklist API',async()=>{const app=await fixture();try{
 for(const starter of model.starters){const response=await app.ops(app.office,'/templates','POST',{contentOnly:true,requestId:crypto.randomUUID(),title:starter.title,description:starter.description,steps:starter.steps.map(item=>({...structuredClone(item),id:crypto.randomUUID()}))});assert.equal(response.status,201,starter.id+': '+JSON.stringify(response.data));}
 assert.equal(model.featureIds.length,9);assert.deepEqual(model.featureState({qr:false}).qr,false);
}finally{await app.close();}});

test('issues, alerts, reviews, logs, printing and handover notes follow permissions and never write on reads',async()=>{const app=await fixture();try{
 const temp=step('number',{title:'Cool room',format:'temperature',decimals:1,unit:'°C',passRule:{max:5}}),clean=step('yes-no-na',{title:'Floors clean',passRule:{pass:'yes'}}),template=await checklist(app,[temp,clean]);
 const run=await complete(app,template,{[temp.id]:8.5,[clean.id]:'no'}),file=path.join(app.dir,'checklist-extras',app.office.session.companyId+'.json');
 const issues=await app.cx(app.member,'issues');assert.equal(issues.status,200);assert.equal(issues.data.issues.length,2);assert.equal(issues.data.canEdit,false);
 const cool=issues.data.issues.find(issue=>issue.stepId===temp.id);assert.equal(cool.answer,'8.5 °C');assert.equal(cool.status,'open');
 await assert.rejects(fs.access(file),'reading issues never writes');
 assert.equal((await app.cx(app.member,'issues/'+run.id+'/'+temp.id,'PUT',{revision:0,status:'resolved',note:'Fixed'})).status,403,'staff cannot resolve issues');
 assert.equal((await app.cx(app.outside,'issues')).data.issues.length,0,'other companies see nothing');
 // Alerts for managers, and an assigned-issue notice for the owner.
 const feed=await app.request(app.office,'/api/notifications');assert(feed.data.items.some(item=>item.id==='checklist-failed:'+run.id+':'+temp.id),'managers are alerted to failed checks');
 const assigned=await app.cx(app.office,'issues/'+run.id+'/'+temp.id,'PUT',{revision:0,status:'open',ownerId:app.member.session.id,dueDate:'2026-10-20',note:''});assert.equal(assigned.status,200,JSON.stringify(assigned.data));
 assert.equal((await app.cx(app.office,'issues/'+run.id+'/'+temp.id,'PUT',{revision:0,status:'resolved',note:'Late'})).status,409,'stale issue revisions are rejected');
 assert.equal((await app.cx(app.office,'issues/'+run.id+'/'+temp.id,'PUT',{revision:1,status:'resolved',note:''})).status,400,'resolving needs a note');
 assert((await app.request(app.member,'/api/notifications')).data.items.some(item=>item.id.startsWith('checklist-issue:'+run.id)),'the owner is notified');
 const resolved=await app.cx(app.office,'issues/'+run.id+'/'+temp.id,'PUT',{revision:1,status:'resolved',ownerId:app.member.session.id,dueDate:'2026-10-20',note:'Thermostat reset'});assert.equal(resolved.data.status,'resolved');
 assert.equal((await app.cx(app.member,'issues')).data.issues.length,1);assert.equal((await app.cx(app.member,'issues?status=resolved')).data.issues[0].resolution.note,'Thermostat reset');
 assert(!(await app.request(app.office,'/api/notifications')).data.items.some(item=>item.id==='checklist-failed:'+run.id+':'+temp.id),'resolved checks stop alerting');
 // Reviews.
 assert.equal((await app.cx(app.member,'reviews/'+run.id,'PUT',{revision:0,status:'approved',comment:''})).status,403);
 assert.equal((await app.cx(app.office,'reviews/'+run.id,'PUT',{revision:0,status:'redo',comment:''})).status,400,'a redo needs a comment');
 const redo=await app.cx(app.office,'reviews/'+run.id,'PUT',{revision:0,status:'redo',comment:'Recheck the cool room'});assert.equal(redo.data.status,'redo');
 assert((await app.request(app.member,'/api/notifications')).data.items.some(item=>item.id==='checklist-redo:'+run.id+':1'),'the completer is asked to redo it');
 assert.equal((await app.cx(app.member,'reviews?ids='+run.id)).data.reviews[run.id].status,'redo');
 // Logs and printing.
 const logs=await app.cx(app.member,'logs?templateId='+template.id+'&stepId='+temp.id+'&days=30');assert.equal(logs.data.points.length,1);assert.equal(logs.data.points[0].passed,false);assert.deepEqual(logs.data.rule,{min:null,max:5});
 const printed=await app.cx(app.member,'print/'+run.id);assert.equal(printed.data.steps.find(item=>item.id===clean.id).answer,'No');assert.equal(printed.data.review.status,'redo');
 assert.equal((await app.cx(app.outside,'print/'+run.id)).status,404);
 // Handover notes appear on the next run.
 assert.equal((await app.cx(app.member,'handover/'+run.id,'PUT',{note:'Cool room door seal is loose'})).status,200);
 const next=(await app.ops(app.member,'/runs','POST',{templateId:template.id,locationId:app.first,requestId:crypto.randomUUID()})).data,note=await app.cx(app.member,'handover/'+next.id);assert.equal(note.data.previous.note,'Cool room door seal is loose');assert.equal(note.data.mine,null);
 // Trends.
 const trends=await app.cx(app.office,'trends?weeks=4');assert.equal(trends.data.stores.length,1);assert.equal(trends.data.stores[0].recentScore,0,'both checks failed');assert.equal(trends.data.stores[0].rank,1);
}finally{await app.close();}});

test('QR codes open their checklist, record scans and stay company-scoped',async()=>{const app=await fixture();try{
 const template=await checklist(app,[step('check')]),list=(await app.ops(app.office)).data,plan=list.planners.find(item=>item.templateId===template.id);
 assert.equal((await app.cx(app.member,'stations','POST',{requestId:crypto.randomUUID(),plannerId:plan.id,locationId:app.first,name:'Fridge'})).status,403,'staff cannot add QR codes');
 const requestId=crypto.randomUUID(),body={requestId,plannerId:plan.id,locationId:app.first,name:'Walk-in fridge',equipment:'Walk-in fridge'},made=await Promise.all([app.cx(app.office,'stations','POST',body),app.cx(app.office,'stations','POST',body)]);assert.equal(made[0].data.id,made[1].data.id,'retries add one QR code');
 const stations=(await app.cx(app.office,'stations')).data.stations;assert.equal(stations.length,1);const token=stations[0].url.split('scan=')[1];
 const svg=await app.cx(app.office,'stations/'+stations[0].id+'/qr.svg');assert.equal(svg.status,200);assert.match(svg.type,/image\/svg\+xml/);assert.match(svg.data,/<svg/);
 const scanned=await app.cx(app.member,'scan','POST',{token});assert.equal(scanned.data.plannerId,plan.id);assert.equal(scanned.data.station,'Walk-in fridge');
 assert.equal((await app.cx(app.outside,'scan','POST',{token})).status,404,'another company cannot use the code');
 const run=(await app.ops(app.member,'/runs','POST',{templateId:template.id,locationId:app.first,requestId:crypto.randomUUID()})).data;assert.equal((await app.cx(app.member,'scans/'+run.id)).data.scans[0].name,'Member');
 assert.equal((await app.cx(app.office,'stations/'+stations[0].id,'DELETE')).status,200);assert.equal((await app.cx(app.member,'scan','POST',{token})).status,404,'deleted codes stop working');
}finally{await app.close();}});

test('feature switches hide each feature without deleting saved details',async()=>{const app=await fixture();try{
 assert.equal((await app.cx(app.member,'settings','PUT',{revision:0,features:{issues:false}})).status,403);
 const off=await app.cx(app.office,'settings','PUT',{revision:0,features:Object.fromEntries(model.featureIds.map(id=>[id,false]))});assert.equal(off.data.revision,1);
 assert.equal((await app.cx(app.office,'settings','PUT',{revision:0,features:{issues:true}})).status,409);
 for(const route of ['issues','logs','trends','stations'])assert.equal((await app.cx(app.office,route)).status,403,route);
 assert.equal((await app.cx(app.office,'reviews?ids=')).data.enabled,false);assert.equal((await app.cx(app.office,'roster')).data.enabled,false);
 assert(!(await app.request(app.office,'/api/notifications')).data.items.some(item=>item.category==='checklist-alerts'));
}finally{await app.close();}});

test('roster assignment names anyone, the opening or the closing shift during the checklist window',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-cx-roster-'));try{
  const window={opensAt:'2026-10-19T06:00:00.000Z',closesAt:'2026-10-19T12:00:00.000Z'},plan='11111111-1111-4111-8111-111111111111';
  const store=extras.createStore(dir,{now:()=>Date.parse('2026-10-19T05:00:00Z'),people:async()=>[{id:'a',username:'Alex'},{id:'b',username:'Bea'},{id:'c',username:'Cy'}],
   ops:{list:async()=>({tasks:[{plannerId:plan,locationId:'loc',workDate:'2026-10-19',activeWindow:window,title:'Closing',window:'open'}],planners:[{id:plan,canManage:true,locationIds:['loc']}],locations:[{id:'loc',name:'Store'}]}),runFacts:async()=>[]},
   // Melbourne times: Alex 9 am–6 pm, Bea 4 pm–11 pm, Cy 7 am–1 pm (before the 5 pm–11 pm window).
   shifts:async()=>[{userId:'a',date:'2026-10-19',start:'09:00',end:'18:00'},{userId:'b',date:'2026-10-19',start:'16:00',end:'23:00'},{userId:'c',date:'2026-10-19',start:'07:00',end:'13:00'}]});
  const actor={id:'m',username:'Manager',role:'admin',companyId:'co',locationId:'loc',permissions:['ops.view','ops.manage','ops.complete']};
  const check=async(mode,names)=>{await store.saveRoster(actor,plan,{mode});const view=await store.rosterView(actor,{date:'2026-10-19'});assert.deepEqual((view.assigned[plan+':loc']||[]).map(person=>person.name).sort(),names,mode);};
  await check('any',['Alex','Bea']);await check('opening',['Alex']);await check('closing',['Bea']);
  await assert.rejects(store.saveRoster(actor,plan,{mode:'everyone'}),/Choose who/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
