const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),draftModel=require('./ai-draft-model'),questionSources=require('./ai-question-sources');
const MODEL='gpt-4.1-mini-2025-04-14',OUTPUT_LIMIT=10000,queues=new Map(),flights=new Map();
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const canDraft=(actor,kind)=>can(actor,kind==='checklist'?'ops.view':'learning.view')&&can(actor,kind==='checklist'?'ops.manage':'learning.manage');
const month=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit'}).format(new Date(now));
const defaults=()=>({revision:0,enabled:false,apiKey:'',budgetCents:1000,draftLimit:100,inputUsdPerMillion:.4,outputUsdPerMillion:1.6,requests:[]});
const cost=(input,output,settings)=>Math.ceil(input*settings.inputUsdPerMillion+output*settings.outputUsdPerMillion);
function createStore(dir,{fetchImpl=globalThis.fetch,now=Date.now,library}={}){
 function file(companyId){if(typeof companyId!=='string'||! /^[a-zA-Z0-9-]{1,100}$/.test(companyId))fail('Choose a valid company.');return path.join(dir,'ai-assistance',companyId+'.json');}
 async function read(companyId){try{return{...defaults(),...JSON.parse(await fs.readFile(file(companyId),'utf8'))};}catch(error){if(error.code==='ENOENT')return defaults();fail('AI settings could not be read. Ask Head Office to check the saved configuration.',503);}}
 async function write(companyId,value){const target=file(companyId),temporary=target+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(target),{recursive:true});try{await fs.writeFile(temporary,JSON.stringify(value),{mode:0o600});await fs.rename(temporary,target);}finally{await fs.rm(temporary,{force:true});}}
 function serial(companyId,work){const key=file(companyId),task=(queues.get(key)||Promise.resolve()).then(work),settled=task.catch(()=>{});queues.set(key,settled);return task.finally(()=>{if(queues.get(key)===settled)queues.delete(key);});}
 function summary(companyId,value){const records=value.requests.filter(r=>r.month===month(now())),spent=records.reduce((sum,r)=>sum+r.costMicros,0);return{companyId,revision:value.revision,enabled:value.enabled,configured:Boolean(value.apiKey),model:MODEL,budgetCents:value.budgetCents,draftLimit:value.draftLimit,inputUsdPerMillion:value.inputUsdPerMillion,outputUsdPerMillion:value.outputUsdPerMillion,month:month(now()),usedDrafts:records.length,estimatedUsedMicros:spent,remainingDrafts:Math.max(0,value.draftLimit-records.length),remainingMicros:Math.max(0,value.budgetCents*10000-spent)};}
 async function status(actor){return summary(actor.companyId,await read(actor.companyId));}
 function save(actor,input){return serial(actor.companyId,async()=>{
  const current=await read(actor.companyId);if(!input||input.revision!==current.revision)fail('AI settings changed. Reload before saving.',409);
  if(typeof input.enabled!=='boolean'||!Number.isInteger(input.budgetCents)||input.budgetCents<50||input.budgetCents>100000||!Number.isInteger(input.draftLimit)||input.draftLimit<1||input.draftLimit>1000)fail('Choose a monthly USD budget from $0.50–$1,000 and 1–1,000 drafts.');
  const next={...current,enabled:input.enabled,budgetCents:input.budgetCents,draftLimit:input.draftLimit,revision:current.revision+1};
  for(const key of ['inputUsdPerMillion','outputUsdPerMillion']){const value=input[key]??current[key];if(!Number.isFinite(value)||value<=0||value>1000)fail('Enter positive token prices up to $1,000 per million tokens.');next[key]=value;}
  if(input.clearKey===true)next.apiKey='';
  if(input.apiKey!==undefined){if(typeof input.apiKey!=='string'||input.apiKey.length>1000)fail('Enter a valid OpenAI API key.');const key=input.apiKey.trim();if(key){if(!/^sk-[\x21-\x7e]{16,997}$/.test(key))fail('Enter a valid OpenAI API key.');next.apiKey=key;}}
  if(next.enabled&&!next.apiKey)fail('Add an OpenAI API key before enabling AI drafting.');
  await write(actor.companyId,next);return summary(actor.companyId,next);
 });}
 async function generate(actor,input){
  if(!input||!['checklist','course','questions'].includes(input.kind)||!uuid(input.requestId)||typeof input.prompt!=='string'||!input.prompt.trim()||input.prompt.length>4000||typeof(input.notes??'')!=='string'||(input.notes||'').length>8000)fail('Describe the draft in up to 4,000 characters, with up to 8,000 characters of reference notes.');
  if(!canDraft(actor,input.kind))fail('Builder permission required for this draft.',403);
  const parameters=input.kind==='questions'?questionSources.parameters(input):null,source=parameters?await questionSources.resolve(actor,input.source,library):null;
  const companyId=actor.companyId,key=file(companyId)+':'+input.requestId,fingerprint=crypto.createHash('sha256').update(JSON.stringify([actor.id,input.kind,input.prompt,input.notes||'',...(parameters?[parameters,source]:[])])).digest('hex');
  const pending=flights.get(key);if(pending){if(pending.fingerprint!==fingerprint)fail('This AI request reference was already used.',409);return pending.promise;}
  const promise=perform();flights.set(key,{fingerprint,promise});try{return await promise;}finally{flights.delete(key);}
  async function perform(){
   const messages=[{role:'system',content:draftModel.instruction(input.kind)},{role:'user',content:JSON.stringify({requirements:input.prompt,referenceNotes:input.notes||'',...(parameters?{...parameters,sources:source.items}:{})})}];
   // UTF-8 byte length plus per-message overhead is a conservative token bound.
   const inputBound=Buffer.byteLength(JSON.stringify(messages))+8192;
   const reservation=await serial(companyId,async()=>{
    const settings=await read(companyId),previous=settings.requests.find(r=>r.id===input.requestId);
    if(previous){if(previous.fingerprint!==fingerprint)fail('This AI request reference was already used.',409);if(previous.result)return{cached:previous.result};fail('This request has already been counted. Its result is unavailable; generate a new draft if needed.',409);}
    if(!settings.enabled||!settings.apiKey)fail('AI drafting is not configured. Ask Head Office to enable it in Settings → AI assistance.',503);
    const usage=summary(companyId,settings),reserved=cost(inputBound,OUTPUT_LIMIT,settings);
    if(usage.remainingDrafts<1||usage.remainingMicros<reserved)fail('The company AI limit has been reached, or the remaining budget is too small for another draft. Check AI assistance settings.',429);
    const record={id:input.requestId,fingerprint,month:month(now()),actorId:actor.id,createdAt:new Date(now()).toISOString(),state:'pending',costMicros:reserved};settings.requests.push(record);
    const cutoff=new Date(now());cutoff.setUTCMonth(cutoff.getUTCMonth()-3);settings.requests=settings.requests.filter(r=>r.createdAt>=cutoff.toISOString());await write(companyId,settings);return{settings,reserved};
   });
   if(reservation.cached)return reservation.cached;
   let usage,generated,errorMessage;
   try{
    const response=await fetchImpl('https://api.openai.com/v1/chat/completions',{method:'POST',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+reservation.settings.apiKey,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,messages,max_completion_tokens:OUTPUT_LIMIT,store:false,response_format:{type:'json_schema',json_schema:{name:'opstack_'+input.kind,strict:true,schema:draftModel.schemas[input.kind]}}})});
    if(!response.ok){if(response.status===401)fail('OpenAI rejected the API key. Check AI assistance settings.',502);if(response.status===429)fail('OpenAI is rate-limited or has no available credit. Check your OpenAI billing and try a new draft later.',502);fail('OpenAI could not generate this draft. Try a new draft later.',502);}
    const raw=await response.text();if(Buffer.byteLength(raw)>500000)fail('The AI response was too large. Ask for a shorter draft.',502);const result=JSON.parse(raw);usage=result.usage;
    const choice=result.choices?.[0];if(choice?.finish_reason!=='stop'||choice.message?.refusal||typeof choice.message?.content!=='string')fail('AI could not complete this draft. Ask for a shorter or clearer draft.',502);
    generated={companyId,kind:input.kind,requestId:input.requestId,draft:draftModel.normalize(input.kind,JSON.parse(choice.message.content),parameters),...(source?{source:{type:source.type,references:source.references,characters:source.characters}}:{})};
   }catch(error){errorMessage=error.status===502?error.message:'The AI request could not be completed. No automatic retry was made; check your connection or try a new draft.';}
   await serial(companyId,async()=>{
    const settings=await read(companyId),record=settings.requests.find(r=>r.id===input.requestId);if(!record)fail('AI usage record is unavailable.',503);
    const validUsage=Number.isSafeInteger(usage?.prompt_tokens)&&usage.prompt_tokens>=0&&Number.isSafeInteger(usage?.completion_tokens)&&usage.completion_tokens>=0;
    record.costMicros=validUsage?cost(usage.prompt_tokens,usage.completion_tokens,reservation.settings):reservation.reserved;record.state=generated?'complete':'failed';
    if(generated)record.result=generated;
    const cached=settings.requests.filter(r=>r.result);for(const old of cached.slice(0,-12))delete old.result;
    await write(companyId,settings);
   });
   if(errorMessage)fail(errorMessage,502);return generated;
  }
 }
 return{status,save,generate};
}
async function route({req,url,session,store,body,json}){
 if(!['/api/ai/status','/api/ai/settings','/api/ai/drafts'].includes(url))return false;
 if(!session)fail('Sign in to use AI assistance.',401);
 if(url==='/api/ai/settings'){
  if(!can(session,'ai.manage'))fail('AI settings permission required.',403);
  if(req.method==='GET'){json(200,await store.status(session));return true;}
  if(req.method!=='PUT')fail('Unsupported AI settings action.',405);
 }else{
  if(!can(session,'ai.manage')&&!canDraft(session,'checklist')&&!canDraft(session,'course'))fail('Builder permission required.',403);
  if(url==='/api/ai/status'){if(req.method!=='GET')fail('AI status is read-only.',405);json(200,await store.status(session));return true;}
  if(req.method!=='POST')fail('Generate an AI draft with POST.',405);
 }
 if(req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 const input=await body(req,400000);json(200,url==='/api/ai/settings'?await store.save(session,input):await store.generate(session,input));return true;
}
module.exports={createStore,route,MODEL,month};
