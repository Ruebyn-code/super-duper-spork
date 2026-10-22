const {fetchWithSetupSnooze:fetch}=require('./location-setup-snooze.cjs');
const fs=require('node:fs/promises'),assert=require('node:assert/strict');
const {createServer}=require('../server'),{saveAdmin}=require('../auth');
const key='sk-test-ai-secret-12345678901234567890',password='ai-test-password';
const checklist={title:'Opening checks',description:'Confirm approved opening procedures.',steps:[{type:'section',title:'Before opening',help:'',required:false},{type:'check',title:'Check the entrance',help:'Follow the approved opening procedure.',required:true},{type:'text',title:'Record issues',help:'Describe any issues for the manager.',required:false}]};
const course={title:'Team induction',description:'An introduction for new starters.',category:'Induction',minutes:10,sections:[{title:'Getting started',lessons:[{title:'Opening responsibilities',body:'Check the entrance and report issues to the manager. Follow the approved company procedure.'}],questions:[{prompt:'Who should you tell about an issue?',options:['The manager','Nobody'],correctIndex:0}]}]};
function reply(value,usage={prompt_tokens:1000,completion_tokens:1200}){return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}],usage}),{status:200,headers:{'Content-Type':'application/json'}});}
async function fixture({fetchImpl,now='2026-10-21T02:00:00Z',locationNow}={}){
 const dir=await fs.mkdtemp('/tmp/opstack-ai-test-');await saveAdmin(dir,'Office',password);let time=Date.parse(now);const calls=[];
 const server=createServer(dir,{locationNow,communicationsNow:()=>time,fetchImpl:async(url,options)=>{calls.push({url,options});return fetchImpl?fetchImpl(url,options):reply(JSON.parse(options.body).response_format.json_schema.name.endsWith('checklist')?checklist:course);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function request(actor,url,method='GET',body,headers={}){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...actor?.headers,...headers},...(body?{body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};}
 async function api(actor,url,method='GET',body,headers){const r=await request(actor,url,method,body,headers);assert(r.status>=200&&r.status<300,url+' '+JSON.stringify(r.data));return r.data;}
 async function login(username){const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(r.status,200);const actor={headers:{Cookie:r.headers.get('set-cookie').split(';')[0]}};actor.session=await api(actor,'/api/session');actor.headers['X-CSRF-Token']=actor.session.csrf;return actor;}
 const office=await login('Office'),location=office.session.locationId;
 await api(office,'/api/accounts','POST',{username:'Staff',password,role:'user',locationId:location});const staff=await login('Staff');
 async function settings(input={},actor=office){const current=await api(actor,'/api/ai/settings');return api(actor,'/api/ai/settings','PUT',{...current,apiKey:key,enabled:true,...input});}
 return{dir,server,base,calls,office,staff,location,request,api,login,settings,setTime:value=>time=Date.parse(value),close:async()=>{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}};
}
module.exports={fixture,reply,checklist,course,key,password};
