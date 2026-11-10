// Network feature switches strip permissions and parentless actions without blocking role assignment.
const{test}=require('node:test'),assert=require('node:assert/strict'),features=require('./public/network-features-model'),model=require('./public/permission-model');
test('switched-off features remove their permissions and detailed actions but keep saved roles assignable',()=>{
 const admin=model.defaults.find(role=>role.id==='admin'),account={id:'a',role:'admin',roleLevel:100,permissions:[...admin.permissions],networkPermissions:[...admin.permissions],actionPermissions:{}};
 const off=features.apply(account,['ordering','intelligence','labels']);
 for(const key of ['orders.view','counts.edit','transfers.receive','prep.print','ai.manage'])assert.equal(model.can(off,key),false,key);
 for(const key of ['ai.search','ai.writing','wastage.view','orders.receive'])assert.equal(model.can(off,key),false,key);
 assert.equal(model.can(off,'home.view'),true);assert.equal(model.can(off,'users.manage'),true);assert.equal(model.can(off,'learning.view'),model.can(account,'learning.view'));
 assert.deepEqual(account.permissions,admin.permissions,'the original account is not changed');assert.equal(features.apply(account,[]),account);
 assert.equal(model.canAssign(off,{role:'admin',roleLevel:100,permissions:[...admin.permissions],actionPermissions:{}}),true,'roles containing switched-off keys can still be assigned');
 assert.equal(model.canAssign({...off,disabledFeatureKeys:[]},{role:'admin',roleLevel:100,permissions:[...admin.permissions],actionPermissions:{}}),false);
 assert.throws(()=>features.normalize(['ordering','ordering']));assert.throws(()=>features.normalize(['nope']));assert.deepEqual(features.normalize(['kiosks','ordering']),['ordering','kiosks']);
});
test('Prep list and Labels are separate features that share prep permissions until both are off',()=>{
 const admin=model.defaults.find(role=>role.id==='admin'),account={id:'a',role:'admin',roleLevel:100,permissions:[...admin.permissions],networkPermissions:[...admin.permissions],actionPermissions:{}};
 const labelsOff=features.apply(account,['labels']);assert.equal(model.can(labelsOff,'prep.view'),true,'the prep list still needs prep viewing');assert.equal(model.can(labelsOff,'prep.manage'),true);assert.equal(model.can(labelsOff,'prep.print'),false,'label printing goes with Labels');
 const prepOff=features.apply(account,['prep']);for(const key of model.prepKeys)assert.equal(model.can(prepOff,key),true,key+' stays for Labels');assert.deepEqual(prepOff.disabledFeatures,['prep']);
 const both=features.apply(account,['prep','labels']);for(const key of model.prepKeys)assert.equal(model.can(both,key),false,key);
 assert.equal(features.prepLabelsName([]),'Prep & labels');assert.equal(features.prepLabelsName(['labels']),'Prep list');assert.equal(features.prepLabelsName(['prep']),'Labels');
});
test('networks that switched off the old combined feature keep prep lists off too',async t=>{
 const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),store=require('./network-features');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'features-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 await fs.writeFile(path.join(dir,'network-features.json'),JSON.stringify({revision:3,disabled:['labels']}));assert.deepEqual((await store.read(dir)).disabled,['prep','labels']);
 const saved=await store.save(dir,{revision:3,disabled:['labels']},{username:'Owner'});assert.deepEqual(saved.disabled,['labels']);assert.deepEqual((await store.read(dir)).disabled,['labels'],'after a save the choices are read as saved');
});
