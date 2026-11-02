// Phase 6 gate tests (comms): required reading blocks other pages until it is
// acknowledged, and chats only reach their own members.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createComms}=require('../comms');
const {seed}=require('../seed');
const permissions=require('../permissions');

const password='harbour-demo-passphrase';
const rejects=async(promise,status,message)=>assert.rejects(promise,error=>{
 assert.equal(error.status,status,`expected ${status}, got ${error.status}: ${error.message}`);
 if(message)assert.match(error.message,message);
 return true;
});

async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-comms-'));
 const store=createStore(dir);
 const data=await seed(store,{password});
 const comms=createComms({store});
 const actor=data.accounts.find(account=>account.email==='admin@harbour.test');
 const manager=data.accounts.find(account=>account.email==='manager@harbour.test');
 const company=data.companies.find(entry=>entry.name==='Harbour Group');
 const street=data.locations.find(entry=>entry.name==='Harbour Street');
 const central=data.locations.find(entry=>entry.name==='Harbour Central');
 const staff={id:'staff-comms',name:'Ari Staff',email:'ari@harbour.test',role:'user',
  permissions:[...permissions.defaults.find(item=>item.id==='user').permissions],actionPermissions:{},
  companyIds:[company.id],locationIds:[street.id],version:'v1'};
 await store.change('accounts',list=>{list.push(staff);});
 return {dir,store,comms,actor,manager,staff,company,street,central,data};
}

test('a required post stays outstanding until the same account acknowledges it',async()=>{
 const app=await fixture();
 const post=await app.comms.createPost(app.actor,{companyId:app.company.id,title:'Allergen update',body:'Read the new allergen matrix.',required:true});
 await rejects(app.comms.assertReadingClear(app.manager),409,/Read and acknowledge/);
 const outstanding=await app.comms.outstanding(app.manager);
 assert.deepEqual(outstanding.map(item=>item.id),[post.id]);

 // Reading the list is not acknowledging it.
 const list=await app.comms.visible(app.manager,app.company.id);
 assert.equal(list.find(item=>item.id===post.id).outstanding,true);
 const ack=await app.comms.acknowledge(app.manager,post.id);
 assert.equal(ack.acknowledged,true);
 await app.comms.assertReadingClear(app.manager);
 assert.equal((await app.comms.outstanding(app.manager)).length,0);
 // A repeated acknowledgement is idempotent.
 const again=await app.comms.acknowledge(app.manager,post.id);
 assert.equal(again.at,ack.at);
});

test('a normal post never raises the reading gate',async()=>{
 const app=await fixture();
 await app.comms.createPost(app.actor,{companyId:app.company.id,title:'Roster note',body:'Nothing to sign.'});
 await app.comms.assertReadingClear(app.manager);
});

test('a location post is visible only to that location, and posting needs the grant',async()=>{
 const app=await fixture();
 await app.comms.createPost(app.actor,{companyId:app.company.id,title:'Central only',body:'Stocktake Sunday.',audience:'location',locationIds:[app.central.id]});
 const managerPosts=await app.comms.visible(app.manager,app.company.id);
 assert.equal(managerPosts.length,0);
 const all=await app.comms.visible(app.actor,app.company.id);
 assert.equal(all.length,1);
 await rejects(app.comms.createPost(app.manager,{companyId:app.company.id,title:'Nope',body:'Nope'}),403,/permission/);
 await rejects(app.comms.createPost(app.staff,{companyId:app.company.id,title:'Required',body:'Read this.',required:true}),403,/permission/);
});

test('a chat reaches only its members and unread counts clear on an explicit read',async()=>{
 const app=await fixture();
 const conversation=await app.comms.startConversation(app.actor,{companyId:app.company.id,memberIds:[app.manager.id]});
 await app.comms.sendMessage(app.actor,{conversationId:conversation.id,body:'Deliveries moved to Tuesday.'});
 const managerList=await app.comms.conversationList(app.manager,{companyId:app.company.id});
 assert.equal(managerList.length,1);
 assert.equal(managerList[0].unread,1);
 await app.comms.markRead(app.manager,{conversationId:conversation.id});
 const after=await app.comms.conversationList(app.manager,{companyId:app.company.id});
 assert.equal(after[0].unread,0);
 await rejects(app.comms.thread(app.staff,{conversationId:conversation.id}),404,/Conversation not found/);
 await rejects(app.comms.sendMessage(app.staff,{conversationId:conversation.id,body:'Hello'}),404,/Conversation not found/);
});
