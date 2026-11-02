// Comms for the rebuilt app: posts (including required reading) and chats.
//
// Required reading is a gate, not a badge. A post marked required stays
// outstanding until the same account explicitly acknowledges it, and every
// other private page checks `assertReadingClear()` before rendering. Reads never
// write: viewing the list cannot silently acknowledge a post, and a chat only
// records a receipt through an explicit `markRead`.
const crypto=require('node:crypto');
const permissions=require('./permissions');

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max=2000)=>String(value??'').trim().slice(0,max);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

function createComms({store,now=Date.now}){
 const stamp=()=>new Date(now()).toISOString();

 async function scope(actor,companyId){
  permissions.requirePermission(actor,'comms.view');
  const [companies,locations]=await Promise.all([store.read('companies'),store.read('locations')]);
  const company=permissions.company(actor,companyId,companies);
  return {company,locations:permissions.accessibleLocations(actor,locations).filter(location=>location.companyId===company.id)};
 }

 // Posts addressed to the whole company, or to locations the actor can reach.
 async function visible(actor,companyId){
  const {company,locations}=await scope(actor,companyId);
  const allowed=new Set(locations.map(location=>location.id));
  const [posts,reads]=await Promise.all([store.read('posts'),store.read('reads')]);
  const own=reads.filter(receipt=>receipt.kind==='post'&&receipt.accountId===actor.id);
  return posts
   .filter(post=>post.companyId===company.id&&(post.audience==='company'||post.locationIds.some(id=>allowed.has(id))))
   .filter(post=>!post.expiresAt||post.expiresAt>=stamp().slice(0,10))
   .sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
   .map(post=>{
    const receipt=own.find(item=>item.refId===post.id);
    return {...post,read:Boolean(receipt),acknowledgedAt:receipt?.acknowledgedAt||null,
     outstanding:Boolean(post.required&&!receipt?.acknowledgedAt)};
   });
 }

 async function createPost(actor,input){
  const {company,locations}=await scope(actor,input?.companyId);
  permissions.requirePermission(actor,'comms.post.company');
  if(input?.required&&!permissions.can(actor,'comms.require'))throw permissions.deny('You do not have permission to require reading.');
  const title=text(input?.title,140);
  if(!title)fail('Give the post a title.');
  const body=text(input?.body,4000);
  if(!body)fail('Write something in the post.');
  const audience=input?.audience==='location'?'location':'company';
  const locationIds=audience==='location'?[...new Set((Array.isArray(input?.locationIds)?input.locationIds:[]).filter(id=>locations.some(location=>location.id===id)))]:[];
  if(audience==='location'&&!locationIds.length)fail('Choose at least one location for a location post.');
  const expiresAt=input?.expiresAt?String(input.expiresAt):'';
  if(expiresAt&&!validDate(expiresAt))fail('Choose a valid last day for this post.');
  const record={id:crypto.randomUUID(),companyId:company.id,title,body,audience,locationIds,required:Boolean(input?.required),
   expiresAt:expiresAt||null,authorId:actor.id,authorName:actor.name,createdAt:stamp()};
  await store.change('posts',list=>{list.push(record);});
  return record;
 }

 async function acknowledge(actor,postId){
  const post=(await store.read('posts')).find(record=>record.id===postId);
  if(!post)fail('Post not found.',404);
  const list=await visible(actor,post.companyId);
  if(!list.some(item=>item.id===post.id))fail('Post not found.',404);
  if(!post.required)return {post,acknowledged:false,reason:'not-required'};
  return store.change('reads',receipts=>{
   const existing=receipts.find(receipt=>receipt.kind==='post'&&receipt.refId===post.id&&receipt.accountId===actor.id);
   if(existing?.acknowledgedAt)return {post,acknowledged:true,at:existing.acknowledgedAt};
   const at=stamp();
   if(existing){existing.readAt=existing.readAt||at;existing.acknowledgedAt=at;}
   else receipts.push({id:crypto.randomUUID(),kind:'post',refId:post.id,companyId:post.companyId,accountId:actor.id,readAt:at,acknowledgedAt:at});
   return {post,acknowledged:true,at};
  });
 }

 // Every required post this account has not acknowledged, across its companies.
 async function outstanding(actor){
  const companies=permissions.companyIds(actor);
  const result=[];
  for(const companyId of companies){
   try{
    const posts=await visible(actor,companyId);
    result.push(...posts.filter(post=>post.outstanding));
   }catch{/* a company that is not readable cannot raise a gate */}
  }
  return result;
 }

 async function assertReadingClear(actor){
  const posts=await outstanding(actor);
  if(posts.length){
   const error=fail('Read and acknowledge "'+posts[0].title+'" before continuing.',409);
   error.reading=posts.map(post=>({id:post.id,title:post.title}));
   throw error;
  }
 }

 // ------------------------------------------------------------------- chats
 async function startConversation(actor,input){
  const {company,locations}=await scope(actor,input?.companyId);
  permissions.requirePermission(actor,'comms.chat');
  const accounts=await store.read('accounts');
  const members=[...new Set([actor.id,...(Array.isArray(input?.memberIds)?input.memberIds:[])])];
  if(!members.every(id=>accounts.some(account=>account.id===id&&permissions.companyIds(account).includes(company.id))))fail('Choose people in this company.');
  const kind=input?.kind==='group'||members.length>2?'group':'direct';
  if(kind==='group'&&!text(input?.name,80))fail('Give the group a name.');
  const existing=kind==='direct'?(await store.read('conversations')).find(conversation=>conversation.companyId===company.id&&conversation.kind==='direct'&&conversation.memberIds.length===members.length&&members.every(id=>conversation.memberIds.includes(id))):null;
  if(existing)return existing;
  const record={id:crypto.randomUUID(),companyId:company.id,kind,name:kind==='group'?text(input?.name,80):'',memberIds:members,
   locationIds:locations.map(location=>location.id),createdById:actor.id,createdAt:stamp()};
  await store.change('conversations',list=>{list.push(record);});
  return record;
 }

 async function conversationList(actor,input){
  const {company}=await scope(actor,input?.companyId);
  permissions.requirePermission(actor,'comms.chat');
  const [conversations,messages,reads]=await Promise.all([store.read('conversations'),store.read('messages'),store.read('reads')]);
  return conversations
   .filter(conversation=>conversation.companyId===company.id&&conversation.memberIds.includes(actor.id))
   .map(conversation=>{
    const thread=messages.filter(message=>message.conversationId===conversation.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    const receipt=reads.find(item=>item.kind==='conversation'&&item.refId===conversation.id&&item.accountId===actor.id);
    const since=receipt?.readAt||null;
    return {...conversation,last:thread.at(-1)||null,messageCount:thread.length,
     unread:thread.filter(message=>message.accountId!==actor.id&&(!since||message.createdAt>since)).length};
   })
   .sort((a,b)=>String(b.last?.createdAt||b.createdAt).localeCompare(String(a.last?.createdAt||a.createdAt)));
 }

 async function thread(actor,input){
  const conversation=(await store.read('conversations')).find(record=>record.id===input?.conversationId);
  if(!conversation)fail('Conversation not found.',404);
  if(!conversation.memberIds.includes(actor.id))throw permissions.deny('Conversation not found.',404);
  if(!permissions.companyIds(actor).includes(conversation.companyId))throw permissions.deny('Conversation not found.',404);
  permissions.requirePermission(actor,'comms.chat');
  const messages=(await store.read('messages')).filter(message=>message.conversationId===conversation.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  return {conversation,messages};
 }

 async function sendMessage(actor,input){
  const {conversation}=await thread(actor,{conversationId:input?.conversationId});
  const body=text(input?.body,4000);
  if(!body)fail('Write a message first.');
  const record={id:crypto.randomUUID(),conversationId:conversation.id,companyId:conversation.companyId,accountId:actor.id,name:actor.name,body,createdAt:stamp()};
  await store.change('messages',list=>{list.push(record);});
  return record;
 }

 async function markRead(actor,input){
  const {conversation}=await thread(actor,{conversationId:input?.conversationId});
  const at=stamp();
  await store.change('reads',receipts=>{
   const existing=receipts.find(receipt=>receipt.kind==='conversation'&&receipt.refId===conversation.id&&receipt.accountId===actor.id);
   if(existing)existing.readAt=at;
   else receipts.push({id:crypto.randomUUID(),kind:'conversation',refId:conversation.id,companyId:conversation.companyId,accountId:actor.id,readAt:at,acknowledgedAt:null});
  });
  return {conversationId:conversation.id,readAt:at};
 }

 return {visible,createPost,acknowledge,outstanding,assertReadingClear,startConversation,conversationList,thread,sendMessage,markRead};
}
module.exports={createComms};
