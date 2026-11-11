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

test('staff step notes save with who/when, survive omitted writes and stay off completed runs',async()=>{const app=await fixture();try{
 const check=step('check'),text=step('text',{required:false}),section=step('section',{required:false});
 const template=await checklist(app,[section,check,text]);
 const started=await app.ops(app.member,'/runs','POST',{templateId:template.id,locationId:app.first,requestId:crypto.randomUUID()});assert.equal(started.status,201,JSON.stringify(started.data)+JSON.stringify(template));const run=started.data;
 let saved=await app.ops(app.member,'/runs/'+run.id,'PUT',{answers:{},complete:false,revision:run.revision,notes:{[check.id]:'  Seal on door 2 is loose  '}});
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 const note=saved.data.notes[check.id];assert.equal(note.note,'Seal on door 2 is loose');assert.equal(note.by,'Member');assert.ok(note.at&&note.byId);
 // Omitted notes keep what was saved; the unchanged note keeps its original author/time.
 app.setTime('2026-10-19T03:00:00Z');
 saved=await app.ops(app.member,'/runs/'+run.id,'PUT',{answers:{[check.id]:true},complete:false,revision:saved.data.revision});assert.deepEqual(saved.data.notes[check.id],note);
 saved=await app.ops(app.office,'/runs/'+run.id,'PUT',{answers:{[check.id]:true},complete:false,revision:saved.data.revision,notes:{[check.id]:'Seal on door 2 is loose'}});assert.deepEqual(saved.data.notes[check.id],note);
 // Invalid notes are rejected: sections, unknown steps, too long or not text.
 for(const notes of [{[section.id]:'x'},{nope:'x'},{[check.id]:'x'.repeat(1001)},{[check.id]:5},[]]){const bad=await app.ops(app.member,'/runs/'+run.id,'PUT',{answers:{[check.id]:true},complete:false,revision:saved.data.revision,notes});assert.equal(bad.status,400,JSON.stringify(notes));}
 // Clearing removes it; notes are not answers and do not count toward completion.
 saved=await app.ops(app.member,'/runs/'+run.id,'PUT',{answers:{[check.id]:true},complete:false,revision:saved.data.revision,notes:{[check.id]:'',[text.id]:'Ran out of sanitiser'}});
 assert.equal(saved.data.notes[check.id],undefined);assert.equal(saved.data.notes[text.id].note,'Ran out of sanitiser');assert.equal(saved.data.answers[text.id],undefined);
 saved=await app.ops(app.member,'/runs/'+run.id,'PUT',{answers:{[check.id]:true},complete:true,revision:saved.data.revision});assert.equal(saved.status,200);
 const read=await app.ops(app.office,'/runs/'+run.id);assert.equal(read.data.notes[text.id].note,'Ran out of sanitiser');
 const late=await app.ops(app.member,'/runs/'+run.id,'PUT',{answers:{[check.id]:true},complete:false,revision:saved.data.revision,notes:{[check.id]:'Too late'}});assert.equal(late.status,409);
 // Lists and history summaries never carry the note text.
 const history=await app.ops(app.office,'?location=all');assert.equal(history.status,200);assert.ok(JSON.stringify(history.data).includes(run.id),'the run is listed');assert.ok(!JSON.stringify(history.data).includes('Ran out of sanitiser'));
}finally{await app.close();}});
