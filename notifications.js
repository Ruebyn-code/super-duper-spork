// Notification centre: a read-only projection of existing, permission-checked readers.
// Each source runs with the signed-in account and selected location and fails on its own.
// Only explicit Mark as read and preference changes write, to the private per-user state file.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./permissions'),model=require('./public/notification-model');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const dateText=value=>value?new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short',...(value.slice(0,4)!==String(new Date().getFullYear())?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'';
const time12=value=>{const match=/^(\d\d):(\d\d)$/.exec(value||'');if(!match)return value||'';const h=Number(match[1]);return(h%12||12)+(match[2]==='00'?'':':'+match[2])+(h<12?' am':' pm');};
function createStore(dir,{sources,now=Date.now}){
 const file=path.join(dir,'notification-state.json');let pending=Promise.resolve();
 async function read(){try{const data=JSON.parse(await fs.readFile(file,'utf8'));if(!data||typeof data.users!=='object')throw Error('Invalid notification storage.');return data;}catch(error){if(error.code==='ENOENT')return{users:{}};throw error;}}
 function mutate(change){const operation=pending.then(async()=>{const data=await read(),result=await change(data);const temp=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(dir,{recursive:true});try{await fs.writeFile(temp,JSON.stringify(data),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return result;});pending=operation.catch(()=>{});return operation;}
 const userState=(data,actor)=>data.users[actor.id]||{read:{},muted:[]};
 const need=actor=>{if(!actor||!actor.id)fail('Sign-in required.',401);if(!actor.companyId||!actor.locationId)fail('Select a location first.',403);};
 // Each collector returns notification items; categories are only offered when the account can use them.
 const collectors=[
  {name:'Your work',enabled:a=>can(a,'home.view'),run:async a=>{const data=await sources.personal(a),items=[];
   for(const t of data.tasks.items){if(t.kind==='agreement')items.push({id:'agreement:'+t.id.slice(10),category:'agreements',title:'Agreement to sign: '+t.title,detail:t.detail,href:t.href,priority:'high'});
    else if(t.kind==='course'){const overdue=t.dueDate&&t.dueDate<model.localDate(now());items.push({id:'course:'+t.id.slice(7)+(overdue?':overdue':''),category:'training',title:(overdue?'Overdue training: ':'Training assigned: ')+t.title,detail:[t.detail,t.dueDate?'Due '+dateText(t.dueDate):''].filter(Boolean).join(' · '),href:t.href,priority:overdue?'high':'normal'});}}
   for(const t of data.inStore.items)items.push({id:t.id+':'+t.status,category:'training',title:(t.kind==='signoff'?'Training to sign off: ':'In-store training: ')+t.title,detail:t.detail,href:t.href,at:t.dueAt||null,priority:t.status==='awaiting-signoff'?'high':'normal'});
   for(const row of data.approvals.locations||[])items.push({id:'timesheets:'+row.locationId+':'+row.count,category:'timesheets',title:row.count===1?'1 timesheet to approve':row.count+' timesheets to approve',detail:row.locationName,href:row.href,priority:'normal'});
   for(const c of data.comms.items||[]){if(c.kind==='post')items.push({id:'post:'+c.id.slice(5)+':'+c.updatedAt,category:'posts',title:(c.required?'Required post: ':'New post: ')+c.title,href:c.href,at:c.updatedAt,priority:c.required?'high':'normal'});
    else items.push({id:'chat:'+c.id.slice(5)+':'+c.updatedAt,category:'messages',title:(c.unread===1?'New message':c.unread+' new messages')+(c.chatKind==='direct'?' from ':' in ')+c.title,href:c.href,at:c.updatedAt,priority:'normal'});}
   return items;}},
  {name:'Rosters',enabled:a=>can(a,'rostering.view'),run:async a=>{const data=await sources.rostering(a),items=[];
   for(const w of data.weeks)items.push({id:'roster:'+a.locationId+':'+w.weekStart+':'+w.publishedAt,category:'roster',title:'Roster published for the week of '+dateText(w.weekStart),detail:(w.shifts===1?'1 shift':w.shifts+' shifts')+' · First: '+dateText(w.first.date)+', '+time12(w.first.start)+'–'+time12(w.first.end),href:'/rostering?week='+w.weekStart,at:w.publishedAt,priority:'normal'});
   for(const s of data.today)items.push({id:'shift:'+s.id+':'+s.date,category:'roster',title:'You’re working today, '+time12(s.start)+'–'+time12(s.end),detail:s.position||'',href:'/rostering?week='+model.monday(s.date),priority:'normal'});
   for(const l of data.myLeave)items.push({id:'leave:'+l.id+':'+l.status,category:'leave',title:'Leave request '+(l.status==='approved'?'approved':'declined'),detail:dateText(l.startDate)+(l.endDate&&l.endDate!==l.startDate?' – '+dateText(l.endDate):''),href:'/rostering#leave',at:l.updatedAt,priority:l.status==='approved'?'normal':'high'});
   for(const l of data.leaveReviews)items.push({id:'leave-review:'+l.id,category:'leave',title:'Leave request to review from '+l.username,detail:dateText(l.startDate)+(l.endDate&&l.endDate!==l.startDate?' – '+dateText(l.endDate):''),href:'/rostering#leave',at:l.createdAt,priority:'normal'});
   return items;}},
  {name:'Checklists',enabled:a=>can(a,'ops.view')&&can(a,'ops.complete'),run:async a=>{const data=await sources.ops(a),instant=now(),items=[];
   for(const t of data.tasks||[]){const done=t.run&&(t.run.status==='completed'||t.run.completedAt);if(done||t.locationId!==a.locationId||!t.availability?.allowed)continue;const opens=Date.parse(t.availability.opensAt||t.activeWindow?.opensAt||''),due=Date.parse(t.dueAt||'');if(Number.isFinite(opens)&&opens>instant)continue;
    const soon=Number.isFinite(due)&&due-instant<=Math.max(30,t.reminderMinutes||0)*60000;items.push({id:'checklist:'+t.plannerId+':'+t.locationId+':'+t.periodKey+(soon?':due':''),category:'checklists',title:(soon?'Checklist due soon: ':'Checklist ready: ')+t.title,detail:t.locationName||'',href:'/ops-management#active',at:Number.isFinite(opens)?new Date(opens).toISOString():null,priority:soon||t.priority==='high'?'high':'normal'});}
   return items;}},
  // Promotions on today at this location (name, offer and dates only; empty when staff awareness is switched off).
  {name:'Promotions',enabled:a=>Boolean(sources.promotions)&&can(a,'home.view'),run:async a=>(await sources.promotions(a)).map(p=>({id:'promotion:'+p.id+':'+(p.weekdays?p.date:p.startDate),category:'promotions',title:'Promotion on today: '+p.name,detail:[p.offer,p.startDate===p.endDate?'':'Until '+dateText(p.endDate)].filter(Boolean).join(' · '),href:can(a,'sales.view')?'/sales#promotions':'/home',priority:'normal'}))},
  {name:'Equipment',enabled:a=>can(a,'equipment.manage'),run:async a=>{const data=await sources.equipment(a),items=[];
   for(const e of data.items){if(e.status==='retired')continue;for(const f of e.faults.filter(f=>f.status==='open'))items.push({id:'equipment-problem:'+f.id,category:'equipment',title:'Problem reported: '+e.name,detail:f.description.slice(0,140)+' · '+f.reportedBy.name,href:'/equipment?q='+encodeURIComponent(e.name),at:f.reportedAt,priority:f.severity==='minor'?'normal':'high'});
    if(['overdue','soon'].includes(e.serviceDue.state))items.push({id:'equipment-service:'+e.id+':'+e.serviceDue.next+':'+e.serviceDue.state,category:'equipment',title:(e.serviceDue.state==='overdue'?'Service overdue: ':'Service due soon: ')+e.name,detail:'Due '+dateText(e.serviceDue.next),href:'/equipment?q='+encodeURIComponent(e.name),priority:e.serviceDue.state==='overdue'?'high':'normal'});}
   return items;}},
  {name:'Stock transfers',enabled:a=>can(a,'home.view')&&can(a,'transfers.view')&&can(a,'transfers.receive'),run:async a=>{const data=await sources.transfers(a);return data.transfers.map(t=>({id:'transfer:'+t.id,category:'transfers',title:'Stock transfer to receive from '+t.from.name,detail:(t.items.length===1?'1 item':t.items.length+' items')+' · Sent by '+t.senderName,href:'/home',at:t.createdAt,priority:'normal'}));}},
  {name:'Daily sales',enabled:a=>can(a,'home.view')&&can(a,'sales.edit')&&a.homeDashboard!=='staff',run:async a=>{const data=await sources.dailySales(a);if(!data)return[];return[{id:'daily-sales:'+a.locationId+':'+data.tradingDate,category:'sales',title:'Enter today’s sales',detail:data.locationName+' · '+dateText(data.tradingDate),href:'/sales#entry',priority:'normal'}];}},
  {name:'Reports',enabled:a=>!a.kiosk,run:async a=>{const data=await sources.reports(a);return data.inbox.filter(r=>r.email!==undefined&&r.hasReport).slice(0,20).map(r=>({id:'report:'+r.id,category:'reports',title:'New report: '+r.name,detail:'OpStack intelligence report',href:'/reporting#ai-reports',at:r.createdAt,priority:'normal'}));}}
 ];
 async function feed(actor,data){
  need(actor);const state=userState(data||await read(),actor),muted=new Set(state.muted||[]),errors=[],items=[],offered=new Set();
  const active=collectors.filter(c=>{try{return c.enabled(actor);}catch{return false;}});
  const results=await Promise.allSettled(active.map(c=>c.run(actor)));
  results.forEach((result,index)=>{if(result.status==='fulfilled')for(const item of result.value){offered.add(item.category);if(!muted.has(item.category))items.push(item);}else if(![401,403,404].includes(result.reason?.status))errors.push(active[index].name);});
  const unique=[...new Map(items.map(item=>[item.id,item])).values()].map(item=>({...item,unread:!state.read[item.id]}));
  unique.sort((a,b)=>Number(b.unread)-Number(a.unread)||Number(b.priority==='high')-Number(a.priority==='high')||String(b.at||'').localeCompare(String(a.at||''))||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
  const categories=model.categories.filter(c=>offered.has(c.id)||muted.has(c.id)||active.some(a=>model.collector[c.id]===a.name)).map(c=>({...c,muted:muted.has(c.id)}));
  return{userId:actor.id,companyId:actor.companyId,locationId:actor.locationId,checkedAt:new Date(now()).toISOString(),unread:unique.filter(i=>i.unread).length,items:unique.slice(0,100),categories,errors};
 }
 async function list(actor){return feed(actor);}
 async function markRead(actor,input){need(actor);if(!input||typeof input!=='object'||(input.all!==true&&(!Array.isArray(input.ids)||!input.ids.length||input.ids.length>200||input.ids.some(id=>typeof id!=='string'||!id||id.length>400))))fail('Choose notifications to mark as read.');
  const current=await feed(actor),ids=new Set(input.all===true?current.items.map(i=>i.id):input.ids.filter(id=>current.items.some(i=>i.id===id)));
  if(!ids.size)return current;
  return mutate(async data=>{const state=data.users[actor.id]||(data.users[actor.id]={read:{},muted:[]}),stampValue=new Date(now()).toISOString();for(const id of ids)state.read[id]=stampValue;
   // Keep the newest 3,000 read markers so the private state stays bounded.
   const entries=Object.entries(state.read).sort((a,b)=>b[1].localeCompare(a[1]));if(entries.length>3000)state.read=Object.fromEntries(entries.slice(0,3000));return feed(actor,data);});}
 async function preferences(actor,input){need(actor);if(!input||!Array.isArray(input.muted)||input.muted.length>model.categories.length||input.muted.some(id=>!model.categories.some(c=>c.id===id))||new Set(input.muted).size!==input.muted.length)fail('Choose valid notification types.');
  return mutate(async data=>{const state=data.users[actor.id]||(data.users[actor.id]={read:{},muted:[]});state.muted=model.categories.map(c=>c.id).filter(id=>input.muted.includes(id));return feed(actor,data);});}
 return{list,markRead,preferences};
}
async function route({req,url,session,store,body,json}){
 if(url!=='/api/notifications'&&!url.startsWith('/api/notifications/'))return false;if(!session)fail('Sign-in required.',401);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 if(url==='/api/notifications'&&req.method==='GET'){json(200,await store.list(session));return true;}
 if(url==='/api/notifications/read'&&req.method==='POST'){json(200,await store.markRead(session,await body(req,64000)));return true;}
 if(url==='/api/notifications/preferences'&&req.method==='PUT'){json(200,await store.preferences(session,await body(req,4000)));return true;}
 fail('Notification endpoint not found.',404);
}
module.exports={createStore,route};
