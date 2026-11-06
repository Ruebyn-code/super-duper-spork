const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./test-support/roster-hourly-fixture.cjs');
test('the Users list includes yourself and network-wide Head Office users in every company, but not other companies’ staff',async t=>{
 const f=await fixture({seed:false});t.after(()=>f.close());
 const company=await f.api(f.office,'/api/companies','POST',{name:'Second company',locationName:'Second store'}),at={'X-Location-Id':company.locationId};
 const home=(await f.api(f.office,'/api/accounts')).map(a=>a.username).sort();assert.deepEqual(home,['Office','Staff']);
 const other=(await f.api(f.office,'/api/accounts','GET',undefined,at)).map(a=>a.username);
 assert(other.includes('Office'),'a network Head Office user with no store in this company still appears in its Users list');
 assert(!other.includes('Staff'),'staff whose locations are in another company stay out of this company’s list');
 const all=(await f.api(f.office,'/api/accounts?all=true','GET',undefined,at)).map(a=>a.username).sort();assert.deepEqual(all,['Office','Staff']);
 assert.equal((await f.request(f.staff,'/api/accounts')).status,403,'people without user management still cannot list users');
});
