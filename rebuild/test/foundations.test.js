// Phase 1 gate tests for the rebuilt foundations.
//
// Each test runs against its own temporary data directory, so the sandbox's
// rebuild data and the current app's ./data are never touched.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStore}=require('../store');
const {createAccounts}=require('../accounts');
const {createLocations}=require('../locations');
const {createSessions}=require('../sessions');
const {seed}=require('../seed');
const access=require('../access');
const permissions=require('../permissions');

const password='harbour-demo-passphrase';
async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-rebuild-'));
 const store=createStore(dir);
 const data=await seed(store,{password});
 const accounts=createAccounts({store});
 const locations=createLocations({store});
 const sessions=createSessions({store});
 const actor=email=>data.accounts.find(account=>account.email===email);
 const company=name=>data.companies.find(entry=>entry.name===name);
 const location=name=>data.locations.find(entry=>entry.name===name);
 return {dir,store,data,accounts,locations,sessions,actor,company,location};
}
const rejects=async(promise,status,message)=>assert.rejects(promise,error=>{
 assert.equal(error.status,status,`expected ${status}, got ${error.status}: ${error.message}`);
 if(message)assert.match(error.message,message);
 return true;
});

test('the permission catalogue keeps its 63 grants and 41 action limits',()=>{
 assert.equal(permissions.keys.length,63);
 assert.equal(permissions.actionKeys.length,41);
 assert.equal(permissions.defaults.length,3);
});

test('sign-in rejects a wrong password and accepts the seeded one',async()=>{
 const app=await fixture();
 await rejects(app.accounts.signIn({email:'admin@harbour.test',password:'not-the-password'}),401,/Incorrect email or password/);
 const account=await app.accounts.signIn({email:'ADMIN@harbour.test ',password});
 assert.equal(account.id,app.actor('admin@harbour.test').id);
 await rejects(app.accounts.signIn({email:'nobody@harbour.test',password}),401);
});

test('a session carries the account scope and dies with its version',async()=>{
 const app=await fixture();
 const account=await app.accounts.signIn({email:'manager@harbour.test',password});
 const issued=await app.sessions.issue(account);
 const live=await app.sessions.lookup(issued.token);
 assert.equal(live.account.email,'manager@harbour.test');
 assert.equal(live.csrf,issued.csrf);
 await app.accounts.revokeSessions(account.id);
 assert.equal(await app.sessions.lookup(issued.token),null);
});

test('users only see their own company and locations',async()=>{
 const app=await fixture();
 const harbour=app.actor('admin@harbour.test');
 const riverside=app.actor('admin@riverside.test');
 assert.deepEqual((await app.locations.list(harbour)).map(item=>item.name).sort(),['Harbour Central','Harbour Street']);
 assert.deepEqual((await app.locations.list(riverside)).map(item=>item.name),['Riverside Store']);
 assert.deepEqual((await app.accounts.list(harbour)).map(item=>item.email),['manager@harbour.test']);
 assert.deepEqual((await app.accounts.list(riverside)).map(item=>item.email),[]);
});

test('a limited manager cannot invite users',async()=>{
 const app=await fixture();
 const manager=app.actor('manager@harbour.test');
 const harbour=app.company('Harbour Group');
 assert.equal(permissions.can(manager,'users.manage'),true);
 assert.equal(permissions.can(manager,'users.create'),false);
 await rejects(app.accounts.invite(manager,{name:'New Hire',email:'hire@harbour.test',role:'user',companyId:harbour.id,locationIds:[app.location('Harbour Street').id]}),403,/permission/);
});

test('Head Office can invite, and the invitation works exactly once',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const harbour=app.company('Harbour Group');
 const invited=await app.accounts.invite(admin,{name:'New Hire',email:'hire@harbour.test',role:'user',companyId:harbour.id,locationIds:[app.location('Harbour Street').id]});
 assert.equal(invited.account.pending,true);
 const stored=(await app.store.read('accounts')).find(account=>account.email==='hire@harbour.test');
 assert.ok(stored.invitation.tokenHash);
 assert.equal(JSON.stringify(stored).includes(invited.token),false,'the raw setup token must never be stored');
 await rejects(app.accounts.signIn({email:'hire@harbour.test',password}),401,/Incorrect email or password/);
 const created=await app.accounts.accept(invited.token,{name:'New Hire',password:'a-brand-new-passphrase-2026'});
 assert.equal(created.email,'hire@harbour.test');
 await rejects(app.accounts.accept(invited.token,{name:'Someone Else',password:'another-long-passphrase-2026'}),400,/expired|invalid/i);
 const signedIn=await app.accounts.signIn({email:'hire@harbour.test',password:'a-brand-new-passphrase-2026'});
 assert.equal(signedIn.id,created.id);
});

test('invitations enforce the password policy',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const invited=await app.accounts.invite(admin,{name:'Short Pass',email:'short@harbour.test',role:'user',companyId:app.company('Harbour Group').id,locationIds:[app.location('Harbour Street').id]});
 await rejects(app.accounts.accept(invited.token,{name:'Short Pass',password:'short'}),400,/15–256/);
});

test('a write cannot cross into another company',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const riverside=app.company('Riverside Group');
 await rejects(access.write({store:app.store,account:admin,permission:'users.manage',companyId:riverside.id}),404,/Company not found/);
 await rejects(access.write({store:app.store,account:admin,permission:'users.manage',companyId:app.company('Harbour Group').id,locationId:app.location('Riverside Store').id}),404,/Location not found/);
});

test('a location write needs the granted action and stays in the company',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const manager=app.actor('manager@harbour.test');
 await access.write({store:app.store,account:admin,permission:'locations.manage',companyId:app.company('Harbour Group').id});
 const created=await app.locations.create(admin,{name:'Harbour North',companyId:app.company('Harbour Group').id});
 assert.equal(created.companyId,app.company('Harbour Group').id);
 await rejects(app.locations.create(manager,{name:'Manager Store',companyId:app.company('Harbour Group').id}),403,/permission/);
 assert.deepEqual((await app.locations.list(manager)).map(item=>item.name),['Harbour Street']);
});

test('Head Office reaches a new location in its own company only',async()=>{
 const app=await fixture();
 const admin=app.actor('admin@harbour.test');
 const riversideAdmin=app.actor('admin@riverside.test');
 const created=await app.locations.create(admin,{name:'Harbour North',companyId:app.company('Harbour Group').id});
 assert.ok((await app.locations.list(admin)).some(item=>item.id===created.id));
 assert.equal((await app.locations.list(riversideAdmin)).some(item=>item.id===created.id),false);
});
