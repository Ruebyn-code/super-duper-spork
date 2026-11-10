const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./test-support/roster-hourly-fixture.cjs');
test('the company unusual-day limit is readable with sales access and changed only by company-wide sales editors',async t=>{
 const f=await fixture({seed:false});t.after(()=>f.close());
 const read=await f.api(f.office,'/api/sales/projection-settings');assert.equal(read.unusualPercent,30);assert.equal(read.canEdit,true);
 const staff=await f.request(f.staff,'/api/sales/projection-settings');if(staff.status===200){assert.equal(staff.data.canEdit,false);assert.equal((await f.request(f.staff,'/api/sales/projection-settings','PUT',{unusualPercent:50,revision:0})).status,403,'staff cannot change it');}else assert.equal(staff.status,403);
 assert.equal((await f.request(f.office,'/api/sales/projection-settings','PUT',{unusualPercent:50,revision:0},{'X-CSRF-Token':'wrong'})).status,403,'CSRF is required');
 assert.equal((await f.request(f.office,'/api/sales/projection-settings','PUT',{unusualPercent:5,revision:0})).status,400);
 const saved=await f.api(f.office,'/api/sales/projection-settings','PUT',{unusualPercent:50,revision:0});assert.equal(saved.unusualPercent,50);assert.equal(saved.revision,1);
 assert.equal((await f.request(f.office,'/api/sales/projection-settings','PUT',{unusualPercent:40,revision:0})).status,409);
 const sales=await f.api(f.office,'/api/sales');assert.equal(sales.projectionDays.unusualPercent,50);assert.equal(sales.projectionDays.days.length,7);
});
