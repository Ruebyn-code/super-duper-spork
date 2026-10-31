const test=require('node:test'),assert=require('node:assert/strict'),{issuesFor,group,shiftFeedback}=require('./public/roster-award-review');
const shifts=[{id:'a',userId:'alice'},{id:'b',userId:'bob'},{id:'c',userId:'alice'},{id:'v',userId:null}],problem=(subjectId,userId,code='profile',blocking=true)=>({subjectId,userId,code,blocking,message:'Synthetic '+code,clause:'15'});
test('staff and shift award icons keep subject and employee warnings scoped while retaining general checks',()=>{
 const own=problem('a','alice'),sibling=problem('c','alice'),other=problem('b','bob'),general=problem(null,null,'source'),person=problem(null,'alice','agreement'),check={enabled:true,issues:[own,sibling,other,general,person]};
 assert.deepEqual(issuesFor(check,shifts,{userId:'alice'}),[own,sibling,general,person]);assert.deepEqual(issuesFor(check,shifts,{userId:'bob'}),[other,general]);assert.deepEqual(issuesFor(check,shifts,{shiftId:'a',userId:'alice'}),[own,general,person]);assert.deepEqual(issuesFor(check,shifts,{userId:'no-work'}),[]);
 assert.deepEqual(issuesFor({enabled:false,issues:check.issues},shifts,{userId:'alice'}),[]);assert.deepEqual(issuesFor(null,shifts,{userId:'alice'}),[]);
});
test('vacant shifts retain their own warnings without confusing general issues or absent staff with vacancies',()=>{
 const vacant=problem('v',null,'unassigned'),other=problem('a','alice'),general=problem(null,null,'feed'),orphan=problem('gone','alice','old-subject'),check={enabled:true,issues:[vacant,other,general,orphan]};
 assert.deepEqual(issuesFor(check,shifts,{userId:null}),[vacant,general]);assert.deepEqual(issuesFor(check,shifts,{shiftId:'v',userId:null}),[vacant,general]);assert.deepEqual(issuesFor(check,[],{userId:null}),[]);assert(!issuesFor(check,shifts,{userId:'alice'}).includes(orphan),'Unrepresented checks stay available for the general fallback instead of being assigned to another record');
});
test('award popup groups repeated subjects without losing blocking status, clauses or source issues',()=>{
 const issues=[problem('a','alice','meal',false),problem('a','alice'),problem('c','alice'),problem('c','alice'),{...problem('a','alice'),clause:'12'},problem('b','bob')],before=JSON.stringify(issues),groups=group(issues);
 assert.equal(groups.length,4);assert.equal(groups[0].blocking,true);assert.deepEqual(groups[0].subjectIds,['a','c']);assert.equal(groups.at(-1).blocking,false);assert.equal(JSON.stringify(issues),before);assert.deepEqual(group([]),[]);
});
test('shift borders use each saved publication snapshot rather than a published week or another shift',()=>{
 const check={enabled:false,issues:[]};
 for(const [state,expected]of [['published','published'],['changed','changed'],['draft','draft']])assert.equal(shiftFeedback(check,shifts,{...shifts[0],publication:{state},availability:'available'}).state,expected);
 assert.equal(shiftFeedback(check,shifts,{...shifts[0],publishedAt:'2026-10-26T01:00:00Z'}).state,'draft');
});
test('all relevant award and operational issues override published green without including another staff member’s checks',()=>{
 const maximum={...problem('a','alice','daily-hours',false),message:'Combined daily paid time exceeds the configured maximum.'},other=problem('b','bob'),check={enabled:true,issues:[maximum,other]},shift={...shifts[0],publication:{state:'published'},availability:'unavailable'},before=JSON.stringify([check,shift]);
 const result=shiftFeedback(check,shifts,shift);assert.equal(result.state,'error');assert.equal(result.issues.length,2);assert(result.issues.some(i=>i.code==='daily-hours'&&i.clause==='15'));assert(result.issues.some(i=>i.code==='availability'));assert(!result.issues.some(i=>i.userId==='bob'));assert.equal(JSON.stringify([check,shift]),before);
 assert.equal(shiftFeedback({enabled:false},shifts,shift).state,'error','Availability does not depend on award checks being enabled');
});
test('pending edits suppress stale publication and saved checks while failed saves retain a red actionable error',()=>{
 const shift={...shifts[0],publication:{state:'published'},availability:'unavailable',pay:{issues:[problem('a','alice')]}},check={enabled:true,issues:[problem('a','alice')]};
 assert.deepEqual(shiftFeedback(check,shifts,shift,{pending:true}),{state:'pending',issues:[]});
 const result=shiftFeedback(check,shifts,shift,{pending:true,error:'This user already has an overlapping shift.'});assert.equal(result.state,'error');assert.equal(result.issues.length,1);assert.equal(result.issues[0].origin,'save');assert.match(result.issues[0].message,/overlapping/);
});
test('saved carryover pay and unresolved break plans remain visible without duplicating identical messages',()=>{
 const issue=problem('a','alice','pay-break-plan'),shift={...shifts[0],pay:{issues:[issue]},breakPlan:{status:'review-required',issues:[{code:'agreement',message:issue.message},{code:'space',message:'There is not enough room for the required rest.'}]}};
 const result=shiftFeedback({enabled:true,issues:[issue]},shifts,shift);assert.equal(result.state,'error');assert.equal(result.issues.length,2);assert.equal(shiftFeedback(null,[],shift).issues.length,2);
});
