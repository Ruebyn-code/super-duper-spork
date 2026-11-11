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

test('staff step notes are lists with who/when; only authors or managers edit or delete them',async()=>{const app=await fixture();try{
 const check=step('check'),text=step('text',{required:false}),section=step('section',{required:false});
 const template=await checklist(app,[section,check,text]);
 const started=await app.ops(app.member,'/runs','POST',{templateId:template.id,locationId:app.first,requestId:crypto.randomUUID()});assert.equal(started.status,201,JSON.stringify(started.data));const run=started.data;
 const put=(actor,revision,body)=>app.ops(actor,'/runs/'+run.id,'PUT',{answers:{},complete:false,revision,...body});
 let saved=await put(app.member,run.revision,{notes:{[check.id]:[{id:'note-a',note:'  Seal on door 2 is loose  '}]}});
 assert.equal(saved.status,200,JSON.stringify(saved.data));
 const first=saved.data.notes[check.id][0];assert.equal(first.note,'Seal on door 2 is loose');assert.equal(first.by,'Member');assert.ok(first.at&&first.byId);
 // Omitted steps keep their notes; resending unchanged text keeps the author and time; a second note is added.
 app.setTime('2026-10-19T03:00:00Z');
 saved=await put(app.member,saved.data.revision,{answers:{[check.id]:true}});assert.deepEqual(saved.data.notes[check.id],[first]);
 saved=await put(app.office,saved.data.revision,{answers:{[check.id]:true},notes:{[check.id]:[{id:'note-a',note:'Seal on door 2 is loose'},{id:'note-b',note:'Called the technician'}]}});
 assert.equal(saved.status,200,JSON.stringify(saved.data));assert.deepEqual(saved.data.notes[check.id][0],first);assert.equal(saved.data.notes[check.id][1].by,'Office');
 // Staff cannot edit or delete someone else's note; the author and managers can.
 const theirs=await put(app.member,saved.data.revision,{answers:{[check.id]:true},notes:{[check.id]:[{id:'note-a',note:'Seal on door 2 is loose'},{id:'note-b',note:'Changed'}]}});assert.equal(theirs.status,403);
 const removeTheirs=await put(app.member,saved.data.revision,{answers:{[check.id]:true},notes:{[check.id]:[{id:'note-a',note:'Seal on door 2 is loose'}]}});assert.equal(removeTheirs.status,403);
 saved=await put(app.member,saved.data.revision,{answers:{[check.id]:true},notes:{[check.id]:[{id:'note-a',note:'Seal on door 2 replaced'},{id:'note-b',note:'Called the technician'}]}});
 assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.notes[check.id][0].note,'Seal on door 2 replaced');assert.ok(saved.data.notes[check.id][0].editedAt);assert.equal(saved.data.notes[check.id][0].at,first.at);
 saved=await put(app.office,saved.data.revision,{answers:{[check.id]:true},notes:{[check.id]:[{id:'note-b',note:'Called the technician'}]}});assert.equal(saved.status,200);assert.deepEqual(saved.data.notes[check.id].map(item=>item.id),['note-b']);
 // Invalid notes are rejected: sections, unknown steps, blanks, too long, duplicates, bad ids, more than 20 or not lists.
 for(const notes of [{[section.id]:[{id:'x',note:'x'}]},{nope:[]},{[check.id]:[{id:'x',note:'   '}]},{[check.id]:[{id:'x',note:'x'.repeat(1001)}]},{[check.id]:[{id:'x',note:'a'},{id:'x',note:'b'}]},{[check.id]:[{id:'bad id!',note:'a'}]},{[check.id]:Array.from({length:21},(_,i)=>({id:'n'+i,note:'a'}))},{[check.id]:'text'},[]]){const bad=await put(app.member,saved.data.revision,{answers:{[check.id]:true},notes});assert.ok([400,403].includes(bad.status),JSON.stringify(notes)+bad.status);}
 // An empty list removes the step's notes; notes are not answers.
 saved=await put(app.office,saved.data.revision,{answers:{[check.id]:true},notes:{[check.id]:[],[text.id]:[{id:'note-c',note:'Ran out of sanitiser'}]}});
 assert.equal(saved.data.notes[check.id],undefined);assert.equal(saved.data.notes[text.id][0].note,'Ran out of sanitiser');assert.equal(saved.data.answers[text.id],undefined);
 saved=await app.ops(app.member,'/runs/'+run.id,'PUT',{answers:{[check.id]:true},complete:true,revision:saved.data.revision});assert.equal(saved.status,200);
 const read=await app.ops(app.office,'/runs/'+run.id);assert.equal(read.data.notes[text.id][0].note,'Ran out of sanitiser');
 const late=await put(app.office,saved.data.revision,{answers:{[check.id]:true},notes:{[check.id]:[{id:'late',note:'Too late'}]}});assert.equal(late.status,409);
 // Lists and history summaries never carry the note text.
 const history=await app.ops(app.office,'?location=all');assert.equal(history.status,200);assert.ok(JSON.stringify(history.data).includes(run.id),'the run is listed');assert.ok(!JSON.stringify(history.data).includes('Ran out of sanitiser'));
}finally{await app.close();}});
