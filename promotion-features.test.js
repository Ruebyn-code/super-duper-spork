const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture}=require('./test-support/roster-hourly-fixture.cjs'),model=require('./public/promotions-model'),{applyUplift}=require('./promotions');
const promo=(locationIds,extra={})=>({requestId:crypto.randomUUID(),name:'Spring deal',kind:'percent',value:20,channels:['in-store'],startDate:'2026-10-19',endDate:'2026-10-25',locationIds,notes:'',...extra});

test('repeating promotions only cover their weekdays and uplift raises projections and budgets exactly',()=>{
 const weekly={startDate:'2026-10-01',endDate:'2026-12-31',weekdays:[1]};
 assert(model.covers(weekly,'2026-10-20'),'Tuesday is covered');assert(!model.covers(weekly,'2026-10-21'),'Wednesday is not');
 assert.equal(model.weekdayText([1,4]),'Tue, Fri');assert.deepEqual(model.featureState({items:false}),{results:true,uplift:true,items:false,staff:true,reporting:true,repeat:true,redemptions:true});
 const projection={projectedSalesCents:30001,budgetPercent:30,budgetCents:9000,spentCents:1000,pricePending:false,remainingCents:8000,dailyProjections:[{date:'2026-10-20',amountCents:10001},{date:'2026-10-21',amountCents:null},{date:'2026-10-22',amountCents:20000}]};
 const lifted=applyUplift(projection,{'2026-10-20':{percent:20,names:['A']},'2026-10-21':{percent:10,names:['B']}});
 assert.equal(lifted.dailyProjections[0].amountCents,12001);assert.equal(lifted.dailyProjections[0].promotion.baseCents,10001);
 assert.equal(lifted.dailyProjections[1].amountCents,null,'missing days stay missing');assert.equal(lifted.dailyProjections[2],projection.dailyProjections[2]);
 assert.equal(lifted.projectedSalesCents,32001);assert.equal(lifted.budgetCents,9600);assert.equal(lifted.remainingCents,8600);
 assert.equal(applyUplift(projection,{}),projection,'no uplift leaves the projection untouched');
});

test('promotion settings switch features on and off without deleting saved details',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const initial=await f.api(f.office,'/api/promotions/settings');assert.equal(initial.revision,0);assert(Object.values(initial.features).every(Boolean),'every feature starts on');assert(initial.canEdit);
 assert.equal((await f.request(f.staff,'/api/promotions/settings','PUT',{revision:0,features:{uplift:false}})).status,403,'staff cannot change settings');
 assert.equal((await f.request(f.office,'/api/promotions/settings','PUT',{revision:0,features:{rocket:true}})).status,400);
 const saved=await f.api(f.office,'/api/promotions','POST',promo([f.location],{expectedUplift:25,weekdays:[0,4],redemptionCostCents:300}));
 assert.equal(saved.expectedUplift,25);assert.deepEqual(saved.weekdays,[0,4]);assert.equal(saved.redemptionCostCents,300);
 const off=await f.api(f.office,'/api/promotions/settings','PUT',{revision:0,features:{uplift:false,repeat:false,redemptions:false}});assert.equal(off.revision,1);assert.equal(off.features.uplift,false);assert.equal(off.features.results,true);
 assert.equal((await f.request(f.office,'/api/promotions/settings','PUT',{revision:0,features:{uplift:true}})).status,409,'stale settings are rejected');
 // With the features off, an editor that sends them is ignored and the saved values stay.
 const edited=await f.api(f.office,'/api/promotions/'+saved.id,'PUT',{...promo([f.location]),expectedUplift:90,weekdays:[],redemptionCostCents:null,revision:1});
 assert.equal(edited.expectedUplift,25);assert.deepEqual(edited.weekdays,[0,4]);assert.equal(edited.redemptionCostCents,300);
 const listed=await f.api(f.office,'/api/promotions');assert.equal(listed.features.uplift,false);assert(listed.canEditSettings);
 assert.equal((await f.request(f.office,'/api/promotions/'+saved.id+'/redemptions','PUT',{date:'2026-10-19',count:3,previous:null})).status,403,'redemptions are off');
 await f.api(f.office,'/api/promotions/settings','PUT',{revision:1,features:{uplift:true,repeat:true,redemptions:true}});
 // Older writers that omit the new fields keep them.
 const older=await f.api(f.office,'/api/promotions/'+saved.id,'PUT',{...promo([f.location]),revision:2});
 delete older.weekdays;assert.equal(older.expectedUplift,25);assert.equal(older.redemptionCostCents,300);
 const cleared=await f.api(f.office,'/api/promotions/'+saved.id,'PUT',{...promo([f.location]),expectedUplift:null,weekdays:[],revision:3});
 assert(!Object.hasOwn(cleared,'expectedUplift'));assert(!Object.hasOwn(cleared,'weekdays'));
 for(const bad of [{expectedUplift:0},{expectedUplift:301},{expectedUplift:1.5},{weekdays:[7]},{weekdays:[1,1]},{redemptionCostCents:0},{startDate:'2026-10-20',endDate:'2026-10-20',weekdays:[3]}])assert.equal((await f.request(f.office,'/api/promotions','POST',promo([f.location],bad))).status,400,JSON.stringify(bad));
 assert.equal((await f.request(f.office,'/api/promotions','POST',promo([f.location],{startDate:'2026-01-01',endDate:'2026-10-30',weekdays:[1]}))).status,201,'repeating promotions may run up to a year');
 assert.equal((await f.request(f.office,'/api/promotions','POST',promo([f.location],{startDate:'2026-01-01',endDate:'2026-10-30'}))).status,400,'ordinary promotions keep the 92-day limit');
 assert.equal(f.calls(),0);
});

test('expected uplift raises projections on promotion days while results compare with the normal projection',async t=>{
 const f=await fixture();t.after(()=>f.close());
 const before=(await f.api(f.office,'/api/sales?week=2026-10-19')).dailyProjection.days;
 const saved=await f.api(f.office,'/api/promotions','POST',promo([f.location],{startDate:'2026-10-22',endDate:'2026-10-23',expectedUplift:50}));
 const after=(await f.api(f.office,'/api/sales?week=2026-10-19')).dailyProjection.days;
 for(const index of [0,1,2,5,6])assert.equal(after[index],before[index],'other days are unchanged');
 for(const index of [3,4]){assert(Number.isSafeInteger(before[index]));assert.equal(after[index],Math.round(before[index]*1.5),'promotion days are lifted');}
 const result=await f.api(f.office,'/api/promotions/'+saved.id+'/performance');
 assert.deepEqual(result.days.map(day=>day.projectedCents),[before[3],before[4]],'results use the normal, unlifted projection');
 await f.api(f.office,'/api/promotions/settings','PUT',{revision:0,features:{uplift:false}});
 assert.deepEqual((await f.api(f.office,'/api/sales?week=2026-10-19')).dailyProjection.days,before,'switching uplift off restores the normal projection');
 assert.equal(f.calls(),0);
});

test('results, repeats, stores, redemptions, leaderboard, products and today stay read-only and scoped',async t=>{
 const f=await fixture();t.after(()=>f.close());
 await f.api(f.office,'/api/sales','PUT',{weekStart:'2026-10-19',revision:(await f.api(f.office,'/api/sales?week=2026-10-19')).record?.revision??0,days:[12000,8000,9000,15000,null,null,null]});
 const supplier=await f.api(f.office,'/api/suppliers','POST',{name:'Promo supplier'}),product=await f.api(f.office,'/api/products','POST',{name:'Pita bread',supplierId:supplier.id,unitAmount:'20 pack',price:5});
 const productId=product.id||product.product?.id;assert(productId,'product created');
 assert.equal((await f.request(f.office,'/api/promotions','POST',promo([f.location],{itemIds:['not-a-real-item']}))).status,400,'only catalogue items can be linked');
 const weekly=await f.api(f.office,'/api/promotions','POST',promo([f.location],{name:'Tuesday wraps',kind:'amount',value:200,startDate:'2026-10-05',endDate:'2026-12-29',weekdays:[1,3],itemIds:[productId],expectedUplift:20}));
 assert.deepEqual(weekly.items,[{id:productId,name:'Pita bread'}]);
 const other=await f.api(f.office,'/api/promotions','POST',promo([f.location],{name:'Week deal'}));
 const files=path.join(f.dir,'promotions',f.office.session.companyId+'.json'),snapshot=await fs.readFile(files,'utf8');
 const result=await f.api(f.office,'/api/promotions/'+weekly.id+'/performance');
 assert(result.days.every(day=>[1,3].includes(model.weekday(day.date))),'only repeat days are compared');
 assert(result.occurrences.length>=1&&result.occurrences.every(entry=>entry.dates.length<=2),'one row per repeat week');
 assert(result.best&&result.worst,'how it went has best and worst days');
 assert.equal(result.redemptions.count,null);assert.equal(result.redemptions.costPerRedemptionCents,200,'a $ off promotion uses its amount as the redemption cost');
 const leaderboard=await f.api(f.office,'/api/promotions/leaderboard');assert.equal(leaderboard.rows.length,2);assert(leaderboard.rows.every(row=>row.rank===null||Number.isInteger(row.rank)));
 const flags=await f.api(f.staff,'/api/promotions/items');assert.equal(flags.items[productId]?.[0].name,'Tuesday wraps');assert(!JSON.stringify(flags).includes('Cents'),'item flags carry no sales figures');
 const today=await f.api(f.staff,'/api/promotions/today');assert.deepEqual(today.promotions.map(item=>item.name),['Week deal'],'Friday shows only the promotions on today');
 assert.equal(await fs.readFile(files,'utf8'),snapshot,'reads never write');
 // Redemptions are a cell-level write: the value being replaced must match.
 assert.equal((await f.request(f.office,'/api/promotions/'+weekly.id+'/redemptions','PUT',{date:'2026-10-21',count:4,previous:null})).status,400,'a Wednesday is not a repeat day');
 assert.equal((await f.request(f.office,'/api/promotions/'+weekly.id+'/redemptions','PUT',{date:'2026-10-27',count:4,previous:null})).status,400,'future days cannot be recorded');
 assert.deepEqual(await f.api(f.office,'/api/promotions/'+weekly.id+'/redemptions','PUT',{date:'2026-10-20',count:4,previous:null}),{date:'2026-10-20',count:4});
 assert.deepEqual(await f.api(f.office,'/api/promotions/'+weekly.id+'/redemptions','PUT',{date:'2026-10-20',count:4,previous:null}),{date:'2026-10-20',count:4},'repeating the same count is harmless');
 assert.equal((await f.request(f.office,'/api/promotions/'+weekly.id+'/redemptions','PUT',{date:'2026-10-20',count:9,previous:null})).status,409,'a stale value is rejected');
 const counted=await f.api(f.office,'/api/promotions/'+weekly.id+'/performance');assert.equal(counted.redemptions.count,4);assert.equal(counted.redemptions.costCents,800);
 const edited=await f.api(f.office,'/api/promotions/'+weekly.id,'PUT',{...promo([f.location],{name:'Tuesday wraps',kind:'amount',value:200,startDate:'2026-10-05',endDate:'2026-12-29'}),revision:weekly.revision});
 assert.equal((await f.api(f.office,'/api/promotions/'+weekly.id+'/performance')).redemptions.count,4,'editing keeps recorded redemptions');assert(!Object.hasOwn(edited,'redemptions'),'redemptions stay out of promotion records');
 await f.api(f.office,'/api/promotions/settings','PUT',{revision:0,features:{items:false,staff:false,reporting:false,results:false}});
 assert.deepEqual((await f.api(f.staff,'/api/promotions/items')).items,{});assert.deepEqual((await f.api(f.staff,'/api/promotions/today')).promotions,[]);
 assert.equal((await f.api(f.office,'/api/promotions/leaderboard')).enabled,false);
 const plain=await f.api(f.office,'/api/promotions/'+weekly.id+'/performance');assert(!plain.best&&!plain.stores&&plain.days.every(day=>!Object.hasOwn(day,'channels')));
 assert.equal(f.calls(),0);
});
