const {test}=require('node:test'),assert=require('node:assert/strict'),hours=require('./public/location-hours-model');
const week=day=>[day,...Array(6).fill(null)];
test('location hours accept everyday time formats without inventing hours for unset or closed days',()=>{
 const value=hours.normalize([{open:'11am',close:'4 am'},{open:'09:00',close:'17:30'},{closed:true},null,null,null,null]);
 assert.deepEqual(value[0],{closed:false,open:'11:00',close:'04:00'});assert.deepEqual(value[1],{closed:false,open:'09:00',close:'17:30'});assert.deepEqual(value[2],{closed:true,open:'',close:''});assert.equal(value[3],null);assert.deepEqual(hours.normalize(),Array(7).fill(null));assert.deepEqual(hours.normalize(null),hours.empty());assert.equal(hours.normalize(week({open:'',close:''}))[0],null);assert.match(hours.summary(value),/2 days/);assert.equal(hours.summary(hours.empty()),'Trading hours not set');
});
test('overnight, midnight and 24-hour trading periods remain attached to their opening day',()=>{
 const overnight=hours.normalize(week({open:'11am',close:'4am'}))[0];assert.deepEqual(hours.period(overnight),{overnight:true,minutes:17*60});assert.equal(hours.describe(overnight),'11:00 am – 4:00 am (next day)');
 const midnight=hours.normalize(week({open:'11pm',close:'12am'}))[0];assert.deepEqual(hours.period(midnight),{overnight:true,minutes:60});const allDay=hours.normalize(week({open:'12am',close:'12am'}))[0];assert.deepEqual(hours.period(allDay),{overnight:true,minutes:1440});assert.match(hours.describe(allDay),/24 hours/);assert.deepEqual(hours.period(hours.normalize(week({open:'12pm',close:'4pm'}))[0]),{overnight:false,minutes:240});assert.equal(hours.period(null),null);assert.equal(hours.period({closed:true}),null);
});
test('malformed trading hours reject partial times, invalid clock values and unsupported fields',()=>{
 for(const value of [{},[],Array(6).fill(null),Array(8).fill(null),Array(7),week({open:'11am',close:''}),week({open:'25:00',close:'4am'}),week({open:'11am',close:'4:99am'}),week({open:1100,close:'4am'}),week({closed:'true'}),week({open:'11am',close:'4am',overnight:false}),week({open:'0pm',close:'4am'})])assert.throws(()=>hours.normalize(value),error=>error.status===400);
});
test('live trading status uses Melbourne opening-day hours, including overnight carry and exact boundaries',()=>{
 const schedule=hours.normalize(Array.from({length:7},()=>({open:'11am',close:'4am'}))),at=(date,time)=>require('./public/ops-planner-model').deadline(date,time);
 for(const [time,state]of [['00:00','open'],['03:59','open'],['04:00','closed'],['10:59','closed'],['11:00','open'],['23:59','open']])assert.equal(hours.status(schedule,at('2026-10-20',time)).state,state,time);
 schedule[1]={closed:true,open:'',close:''};assert.equal(hours.status(schedule,at('2026-10-20','03:59')).state,'open');assert.equal(hours.status(schedule,at('2026-10-20','04:00')).state,'closed');assert.equal(hours.status(schedule,at('2026-10-20','11:00')).state,'closed');assert.equal(hours.status(hours.empty(),at('2026-10-20','11:00')).state,'unknown');assert.equal(hours.status(schedule,at('2026-10-20','11:00'),true).state,'archived');assert.equal(hours.status(schedule,at('2026-10-19','03:00')).tradingDate,'2026-10-18');
});
test('24-hour trading and Melbourne daylight-saving transitions do not reopen a closed period',()=>{
 const all=hours.normalize(Array.from({length:7},()=>({open:'11am',close:'11am'})));for(const instant of ['2026-10-19T23:59:59+11:00','2026-10-20T04:00:00+11:00','2026-10-20T11:00:00+11:00'])assert.equal(hours.status(all,instant).state,'open');
 const week=hours.normalize(Array.from({length:7},()=>({closed:true})));week[5]={closed:false,open:'11:00',close:'02:30'};
 assert.equal(hours.status(week,'2026-04-05T02:45:00+11:00').state,'open');assert.equal(hours.status(week,'2026-04-05T02:29:59+10:00').state,'open');assert.equal(hours.status(week,'2026-04-05T02:30:00+10:00').state,'closed');assert.equal(hours.status(week,'2026-10-04T03:00:00+11:00').state,'closed');assert.throws(()=>hours.status(week,'invalid'),e=>e.status===400);
});
