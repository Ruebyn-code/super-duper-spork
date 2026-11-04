// Week-of-quarter/year numbering shared by Daily sales, Weekly report and Weekly overview.
const test=require('node:test'),assert=require('node:assert/strict'),{info}=require('./public/sales-week-model.js');
test('weeks belong to the quarter and year containing their Sunday',()=>{
 assert.deepEqual(info('2026-09-28'),{year:2026,quarter:4,quarterWeek:1,yearWeek:40},'Sunday 4 Oct starts Q4');
 assert.deepEqual(info('2026-09-21'),{year:2026,quarter:3,quarterWeek:13,yearWeek:39});
 assert.deepEqual(info('2025-12-29'),{year:2026,quarter:1,quarterWeek:1,yearWeek:1},'a week ending in January is week 1 of the new year');
 assert.deepEqual(info('2026-12-21'),{year:2026,quarter:4,quarterWeek:13,yearWeek:52});
 assert.deepEqual(info('2026-12-28'),{year:2027,quarter:1,quarterWeek:1,yearWeek:1});
 assert.equal(info('2027-03-29').quarter,2);assert.equal(info('2027-03-29').quarterWeek,1);
 assert.deepEqual(info('2027-12-27'),{year:2028,quarter:1,quarterWeek:1,yearWeek:1},'a year starting on Saturday counts from its first Sunday');assert.equal(info('2028-01-03').yearWeek,2);
 assert.equal(info('bad'),null);assert.equal(info(undefined),null);
});
test('every quarter has 12–14 consecutive weeks and years 52 or 53',()=>{
 let previous=null;for(let ms=Date.UTC(2024,0,1);ms<Date.UTC(2031,0,1);ms+=7*86400000){const week=info(new Date(ms).toISOString().slice(0,10));
  if(previous){if(week.quarter===previous.quarter)assert.equal(week.quarterWeek,previous.quarterWeek+1);else{assert.equal(week.quarterWeek,1);assert.ok([12,13,14].includes(previous.quarterWeek));}
   if(week.year===previous.year)assert.equal(week.yearWeek,previous.yearWeek+1);else{assert.equal(week.yearWeek,1);assert.ok([52,53].includes(previous.yearWeek));}}previous=week;}
});
