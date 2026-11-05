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
