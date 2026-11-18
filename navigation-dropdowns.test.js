const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const model=require('./public/subpage-navigation-model'),shell=require('./persistent-shell'),{keys:permissionKeys,actionKeys}=require('./permissions');

test('main bar dropdowns list each destination\'s sub-options with known permissions',()=>{
 const keys=new Set([...permissionKeys,...(actionKeys||[])]);
 for(const path of ['/','/sales','/rostering','/communications','/ops-management','/labels','/learning-centre','/reporting','/admin/accounts']){
  const items=model.menu(path);assert.ok(items&&items.length>=2,path);
  for(const item of items){assert.match(item.href,/^\/[a-z/-]*(#[a-z-]+)?$/);for(const key of [].concat(item.permission||[]))if(keys.size)assert.ok(keys.has(key),path+' '+key);}
 }
 assert.equal(model.menu('/home'),null);
 const staff=key=>['sales.view','comms.view','ops.view'].includes(key);
 assert.deepEqual(model.menu('/sales').filter(item=>model.visible(item,staff)).map(item=>item.title),['Daily sales','Hourly sales','Projections & budget','Promotions']);
 assert.deepEqual(model.menu('/ops-management').filter(item=>model.visible(item,staff)).map(item=>item.title),['Checklists','History']);
});

test('the dropdown script runs only in the persistent shell, never in content frames',()=>{
 const page='<html><head><script src="/subpage-navigation-model.js" defer></script><script src="/navigation-dropdowns.js" defer></script></head><body></body></html>';
 assert.match(shell.render(page,false),/navigation-dropdowns\.js/);
 assert.doesNotMatch(shell.render(page,true),/navigation-dropdowns\.js/);
 const source=fs.readFileSync('public/navigation-dropdowns.js','utf8');assert.doesNotMatch(source,/fetch\(|localStorage|XMLHttpRequest/);
});
