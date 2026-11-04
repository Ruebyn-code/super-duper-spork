// Daily sales and Weekly report show each recorded day above/below its projected sales.
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {fixture}=require('./test-support/delivery-planning-fixture.cjs');

test('the comparison helper distinguishes above, below, on and missing projections',()=>{
 const window={},context=vm.createContext({window,Intl});vm.runInContext(fs.readFileSync(path.join(__dirname,'public','sales-vs-projection.js'),'utf8'),context);
 const {compare}=window.salesVsProjection;
 assert.deepEqual({...compare(135622,100000)},{state:'above',differenceCents:35622,percent:35.622});
 assert.equal(compare(90000,100000).state,'below');assert.equal(compare(100000,100000).state,'on');
 assert.equal(compare(null,100000),null,'unrecorded days have no badge');assert.equal(compare(100000,null),null,'unknown projections have no badge');
 assert.equal(compare(0,0).state,'on');assert.equal(compare(500,0).percent,null,'a zero projection has no percentage');
});

test('sales and weekly report reads include the selected week’s historical daily projection without writing',async t=>{
 const f=await fixture();t.after(()=>f.close());f.setTime('2026-11-04T01:00:00Z');
 const weeks=['2026-09-28','2026-10-05','2026-10-12','2026-10-19'],days=[100000,110000,120000,130000,150000,200000,180000];
 for(const weekStart of weeks){const current=await f.request(f.office,'/api/sales?week='+weekStart);const saved=await f.request(f.office,'/api/sales','PUT',{weekStart,days,revision:current.data.record.revision||0});assert.equal(saved.status,200,JSON.stringify(saved.data));}
 const before=await f.request(f.office,'/api/sales?week=2026-10-26');assert.equal(before.status,200);
 assert.deepEqual(before.data.dailyProjection,{weekStart:'2026-10-26',days});
 const weekly=await f.request(f.office,'/api/weekly-sales-reports?week=2026-10-26');assert.equal(weekly.status,200,JSON.stringify(weekly.data));
 assert.deepEqual(weekly.data.dailyProjection,{weekStart:'2026-10-26',days});
 const older=await f.request(f.office,'/api/sales?week=2026-10-05');assert.equal(older.data.dailyProjection.weekStart,'2026-10-05');assert.deepEqual(older.data.dailyProjection.days,Array(7).fill(null),'historical weeks only use the weeks before them');
 const again=await f.request(f.office,'/api/sales?week=2026-10-26');assert.equal(again.data.record.revision,before.data.record.revision,'reading never writes');
});
