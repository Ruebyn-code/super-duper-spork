const test=require('node:test'),assert=require('node:assert/strict'),{issuesFor,group}=require('./public/roster-award-review');
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
