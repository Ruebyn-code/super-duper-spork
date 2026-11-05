const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {fixture}=require('./test-support/stripe-fixture.cjs');
const route=(env='sandbox')=>'/api/opstack/stripe/networks/default?environment='+env;
const put=(f,body)=>f.request(f.owner,'/api/opstack/stripe/networks/default','PUT',body);
const base=(settings,extra={})=>({environment:'sandbox',revision:settings.revision,requestId:crypto.randomUUID(),automaticUpdates:true,customerId:'',basePriceId:'',userPriceId:'',automaticTax:false,...extra});

test('per-network billing settings are owner-only, revisioned, idempotent, validated and never contact Stripe',async()=>{const f=await fixture();try{
 for(const actor of [null,f.tenant])assert.equal((await f.request(actor,route())).status,401);
 const first=await f.api(f.owner,route());assert.equal(first.network.id,'default');assert.deepEqual(first.settings,{automaticUpdates:true,customerId:'',basePriceId:'',userPriceId:'',automaticTax:false,updatedAt:null});assert(first.locations.some(l=>l.id===f.tenant.session.locationId&&l.plan===null));
 assert.equal((await f.request(f.owner,'/api/opstack/stripe/networks/missing-network?environment=sandbox')).status,404);
 const input=base(first,{automaticUpdates:false,customerId:'cus_demo',basePriceId:'price_base',userPriceId:'price_user',automaticTax:true});
 assert.equal((await f.request(f.owner,'/api/opstack/stripe/networks/default','PUT',input,{'X-CSRF-Token':''})).status,403);
 for(const bad of [{basePriceId:'price_user'},{customerId:'not-a-customer'},{createPlans:['nowhere']},{extra:true},{automaticUpdates:'no'}])assert.equal((await put(f,{...input,requestId:crypto.randomUUID(),...bad})).status,400,JSON.stringify(bad));
 const saved=(await put(f,input)).data;assert.equal(saved.settings.automaticUpdates,false);assert.equal(saved.settings.customerId,'cus_demo');assert.equal(saved.settings.automaticTax,true);
 assert.equal((await put(f,input)).status,200);assert.equal((await put(f,{...input,requestId:crypto.randomUUID()})).status,409);assert.equal((await put(f,{...input,automaticUpdates:true})).status,409);
 const wizard=await f.settings();assert.equal(wizard.networks.default.basePriceId,'price_base');assert.equal(wizard.networks.default.automaticUpdates,false);assert.equal((await f.settings('live')).networks.default,undefined);
 assert.equal(f.calls.length,0);}finally{await f.close();}});

test('draft plans for unbilled locations use the network defaults, start unapproved and cannot duplicate a location',async()=>{const f=await fixture();try{
 const location=f.tenant.session.locationId,first=await f.api(f.owner,route());
 assert.equal((await put(f,base(first,{createPlans:[location]}))).status,400);
 const result=(await put(f,base(first,{customerId:'cus_demo',basePriceId:'price_base',userPriceId:'price_user',automaticTax:true,createPlans:[location]}))).data;assert.equal(result.createdPlans,1);
 const plan=result.locations.find(l=>l.id===location).plan;assert.equal(plan.customerId,'cus_demo');assert.equal(plan.approved,false);assert.equal(plan.autoSync,false);assert.equal(plan.automaticTax,true);assert.equal(plan.subscriptionId,null);
 const wizard=await f.settings();assert.equal(wizard.plans.length,1);assert.equal(wizard.plans[0].basePriceId,'price_base');
 assert.equal((await put(f,base(result,{customerId:'cus_demo',basePriceId:'price_base',userPriceId:'price_user',createPlans:[location]}))).status,409);
 assert.equal(f.calls.length,0);}finally{await f.close();}});

test('switching a network off pauses automatic quantity updates until it is switched back on',async()=>{const f=await fixture();try{
 f.subscription();const p=f.plan({subscriptionId:'sub_demo',autoSync:true});await f.save({plans:[p]});await f.request(f.owner,'/api/opstack/stripe/sync','POST',{environment:'sandbox'});await f.action(p);await f.save({enabled:true,apiKey:'',webhookSecret:''});
 let settings=await f.api(f.owner,route());assert.equal((await put(f,base(settings,{automaticUpdates:false}))).status,200);
 await f.api(f.tenant,'/api/accounts','POST',{username:'Additional Staff',password:'additional-synthetic-password',role:'user',locationId:f.tenant.session.locationId});
 const posts=f.calls.filter(c=>c.method==='POST').length;await f.server.runStripeSync();assert.equal(f.data.subscriptions.sub_demo.items.data[1].quantity,1);assert.equal(f.calls.filter(c=>c.method==='POST').length,posts);
 settings=await f.api(f.owner,route());assert.equal(settings.locations.find(l=>l.id===p.locationId).plan.userQuantity,2);
 assert.equal((await put(f,base(settings,{automaticUpdates:true}))).status,200);await f.server.runStripeSync();assert.equal(f.data.subscriptions.sub_demo.items.data[1].quantity,2);
 }finally{await f.close();}});

test('location plans can be added, edited and removed from network billing with the main Billing safeguards',async()=>{const f=await fixture();try{
 const location=f.tenant.session.locationId,edit=(extra={})=>({locationId:location,customerId:'cus_demo',basePriceId:'price_base',userPriceId:'price_user',automaticTax:false,...extra});
 let settings=await f.api(f.owner,route());
 for(const bad of [[edit({customerId:''})],[edit({basePriceId:'price_user'})],[edit({locationId:'elsewhere'})],[edit(),edit()],[edit({remove:'yes'})],[edit({extra:1})]])assert.equal((await put(f,base(settings,{plans:bad}))).status,400,JSON.stringify(bad));
 let result=(await put(f,base(settings,{plans:[edit()]}))).data;assert.equal(result.changedPlans,1);let plan=result.locations.find(l=>l.id===location).plan;assert.equal(plan.approved,false);assert.equal(plan.customerId,'cus_demo');
 result=(await put(f,base(result,{plans:[edit()]}))).data;assert.equal(result.changedPlans,0);
 result=(await put(f,base(result,{plans:[edit({automaticTax:true})]}))).data;assert.equal(result.changedPlans,1);assert.equal(result.locations.find(l=>l.id===location).plan.automaticTax,true);assert.equal(result.locations.find(l=>l.id===location).plan.id,plan.id);
 result=(await put(f,base(result,{plans:[{locationId:location,remove:true}]}))).data;assert.equal(result.locations.find(l=>l.id===location).plan,null);assert.equal((await f.settings()).plans.length,0);
 assert.equal(f.calls.length,0);
 // A connected subscription keeps its payer and cannot be removed here; an approved plan needs a fresh review after a fee change.
 f.subscription();const p=f.plan({subscriptionId:'sub_demo',autoSync:true});await f.save({plans:[p]});await f.request(f.owner,'/api/opstack/stripe/sync','POST',{environment:'sandbox'});await f.action(p);
 settings=await f.api(f.owner,route());assert.equal(settings.locations.find(l=>l.id===location).plan.approved,true);
 assert.equal((await put(f,base(settings,{plans:[{locationId:location,remove:true}]}))).status,409);
 assert.equal((await put(f,base(settings,{plans:[edit({customerId:'cus_other'})]}))).status,409);
 result=(await put(f,base(settings,{plans:[edit({automaticTax:true})]}))).data;plan=result.locations.find(l=>l.id===location).plan;assert.equal(plan.approved,false);assert.equal(plan.subscriptionId,'sub_demo');assert.equal(plan.autoSync,true);
 }finally{await f.close();}});

test('a pending checkout freezes its location plan in network billing',async()=>{const f=await fixture();try{
 const p=f.plan();await f.save({plans:[p]});await f.action(p,'checkout');const location=p.locationId,settings=await f.api(f.owner,route());assert.equal(settings.locations.find(l=>l.id===location).plan.checkoutPending,true);
 assert.equal((await put(f,base(settings,{plans:[{locationId:location,customerId:'cus_demo',basePriceId:'price_base',userPriceId:'price_user',automaticTax:true}]}))).status,409);
 assert.equal((await put(f,base(settings,{plans:[{locationId:location,remove:true}]}))).status,409);
 assert.equal((await put(f,base(settings,{plans:[{locationId:location,customerId:'cus_demo',basePriceId:'price_base',userPriceId:'price_user',automaticTax:false}]}))).status,200);
 }finally{await f.close();}});
