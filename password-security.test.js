const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const passwords=require('./password-security'),policy=require('./public/password-policy'),{createAuth}=require('./auth');
const strong='violet river lantern orchard';
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-password-security-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return{dir,file:path.join(dir,'accounts.json')};}
test('one password policy enforces long passphrases, bounded Unicode, common/repeated choices and identity checks',()=>{
 for(const value of ['short password','Password123456789!','OpStack123456789!','passwordpassword','aaaaaaaaaaaaaaa','abcdabcdabcdabcd','1234567890123456','               ','🚀'.repeat(14),'é'.repeat(15),'x'.repeat(257)])assert(policy.issue(value),value);
 for(const value of [strong,'Sunrise! 27 cranes drift','石畳の街を歩いて青い傘を探している',strong+' '.repeat(200)])assert.equal(policy.issue(value),'');
 assert(policy.issue('EmilyGraceLynas2026!',['Emily Grace Lynas']));assert(policy.issue('emily.lynas2026!',['emily.lynas@example.test']));
 assert.throws(()=>passwords.validate('Password123456789!'),{status:400});
});
test('modern hashes use independent salts, never truncate input and reject corrupt or unsupported records safely',async()=>{
 const a=await passwords.credentials(strong),b=await passwords.credentials(strong);assert.equal(a.passwordKdf,'scrypt-v2');assert.notEqual(a.salt,b.salt);assert.notEqual(a.hash,b.hash);assert(!JSON.stringify(a).includes(strong));
 assert(await passwords.matches(strong,a));assert(!await passwords.matches(strong+'!',a));assert(!await passwords.matches('x'.repeat(257),a));
 for(const record of [null,{...a,hash:'00'},{...a,passwordKdf:'unknown'},{...a,salt:{}},{...a,hash:null},{...a,hash:[a.hash]}])assert(!await passwords.matches(strong,record));
});
test('legacy weak passwords upgrade after valid authentication without changing identity or revoking existing sessions',async t=>{
 const{dir,file}=await fixture(t),salt='legacy-salt',oldPassword='old password',hash=crypto.scryptSync(oldPassword,salt,64).toString('hex');
 await fs.writeFile(file,JSON.stringify([{id:'legacy',version:'unchanged',username:'Legacy',role:'admin',salt,hash}]));const auth=createAuth(dir),req={socket:{remoteAddress:'192.0.2.1'}},login=await auth.login(req,{username:'Legacy',password:oldPassword});
 const saved=JSON.parse(await fs.readFile(file))[0];assert.equal(saved.passwordKdf,'scrypt-v2');assert.equal(saved.version,'unchanged');assert.notEqual(saved.hash,hash);assert.equal(saved.passwordAttempts,undefined);assert.equal((await auth.session({headers:{cookie:'admin_session='+login.token}})).id,'legacy');
 assert.equal((await createAuth(dir).login(req,{username:'Legacy',password:oldPassword})).id,'legacy');
 assert(!JSON.stringify(await auth.directory()).match(/passwordKdf|passwordAttempts|salt|hash/));assert.equal((await fs.stat(file)).mode&0o777,0o600);
});
test('account throttles combine username/email, connections and restarts, expire and never trust forwarded addresses',async t=>{
 const{dir,file}=await fixture(t);let now=1000;let auth=createAuth(dir,{passwordNow:()=>now});await auth.setup({username:'Employee',password:strong});let records=JSON.parse(await fs.readFile(file));records[0].email='employee@example.test';await fs.writeFile(file,JSON.stringify(records));
 for(let n=0;n<10;n++){if(n===5)auth=createAuth(dir,{passwordNow:()=>now});await assert.rejects(()=>auth.login({socket:{remoteAddress:'192.0.2.'+n},headers:{'x-forwarded-for':'198.51.100.'+n}},{username:n%2?'Employee':'EMPLOYEE@example.test',password:'wrong password'}),{status:401});}
 auth=createAuth(dir,{passwordNow:()=>now});await assert.rejects(()=>auth.login({socket:{remoteAddress:'203.0.113.1'}},{username:'Employee',password:strong}),{status:429});
 now+=15*60000;assert.equal((await auth.login({socket:{remoteAddress:'203.0.113.1'}},{username:'employee@example.test',password:strong})).username,'Employee');assert.equal(JSON.parse(await fs.readFile(file))[0].passwordAttempts,undefined);
});
test('login reservations cap concurrent requests, preserve other failures on success and clear expired keys',()=>{
 let now=0;const reserve=require('./login-limiter')({now:()=>now,maxKeys:2});const attempts=Array.from({length:10},()=>reserve('socket'));assert.throws(()=>reserve('socket'),{status:429});attempts[0].success();attempts[0].success();reserve('socket').failure();assert.throws(()=>reserve('socket'),{status:429});reserve('other');assert.throws(()=>reserve('third'),{status:429});now+=15*60000;reserve('third').success();
});
test('concurrent guesses cannot overrun durable account reservations',async t=>{
 const{dir,file}=await fixture(t),auth=createAuth(dir);await auth.setup({username:'Employee',password:strong});
 const results=await Promise.all(Array.from({length:20},(_,n)=>auth.login({socket:{remoteAddress:'192.0.2.'+n}},{username:'Employee',password:'wrong'}).then(()=>200,error=>error.status)));
 assert.equal(results.filter(code=>code===401).length,10);assert.equal(results.filter(code=>code===429).length,10);assert.equal(JSON.parse(await fs.readFile(file))[0].passwordAttempts.count,10);
});
test('a password reset, deletion or disable during hashing cannot create a session or overwrite a newer password',async()=>{
 for(const kind of ['reset','delete','disable']){const original={id:'staff',version:'one',username:'Staff',...await passwords.credentials(strong)};let accounts=[original],changes=0;
  await assert.rejects(()=>passwords.authenticate({input:{password:strong},read:async()=>accounts,find:rows=>rows[0],change:async fn=>{if(++changes===2){if(kind==='delete')accounts=[];else if(kind==='disable')accounts[0]={...original,disabled:true};else accounts[0]={...original,version:'two',hash:'0'.repeat(128)};}return fn(accounts);}}),{status:401});
  if(kind==='reset')assert.equal(accounts[0].hash,'0'.repeat(128));
 }
});
test('platform accounts share modern hashing, legacy upgrades, persistent throttling and invitation validation',async t=>{
 const{dir}=await fixture(t),file=path.join(dir,'opstack/platform.json');let now=1000,store=require('./opstack-store').createStore(dir,{passwordNow:()=>now});
 await assert.rejects(()=>store.initialOwner({username:'Owner',email:'owner@example.test',password:'Password123456789!'}),{status:400});
 await store.initialOwner({username:'Owner',email:'owner@example.test',password:strong});let data=JSON.parse(await fs.readFile(file)),record=data.accounts[0];delete record.passwordKdf;record.hash=crypto.scryptSync('legacy pass',record.salt,64).toString('hex');await fs.writeFile(file,JSON.stringify(data));
 const account=await store.verify({email:'OWNER@example.test',password:'legacy pass'});assert.equal(account.version,record.version);assert.equal(JSON.parse(await fs.readFile(file)).accounts[0].passwordKdf,'scrypt-v2');
 const invite=await store.invite(account,{username:'Staff member',email:'staff@example.test',role:'support'});await assert.rejects(()=>store.accept({token:invite.token,password:'Password123456789!',confirmPassword:'Password123456789!'}),{status:400});await store.accept({token:invite.token,password:strong,confirmPassword:strong});
 for(let i=0;i<10;i++)await assert.rejects(()=>store.verify({email:'owner@example.test',password:'wrong'}),{status:401});store=require('./opstack-store').createStore(dir,{passwordNow:()=>now});await assert.rejects(()=>store.verify({email:'owner@example.test',password:'legacy pass'}),{status:429});now+=15*60000;assert.equal((await store.verify({email:'owner@example.test',password:'legacy pass'})).id,record.id);
 assert(!JSON.stringify(await store.summary()).match(/passwordKdf|passwordAttempts|salt|hash/));
});
