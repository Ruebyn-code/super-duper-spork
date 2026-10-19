const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const defaults=require('./new-network-defaults'),appearance=require('./appearance'),customisations=require('./company-customisations'),text=require('./interface-text'),elements=require('./element-overrides');
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'opstack-defaults-migration-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;}
async function put(dir,name,value){await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,name),JSON.stringify(value));}
const read=(dir,name)=>fs.readFile(path.join(dir,name),'utf8');
test('untouched legacy networks and all their companies migrate once, preserving business data and subsequent edits',async t=>{
 const root=await fixture(t),company=customisations.folder(root,'other');
 await put(root,'companies.json',[{id:'default',name:'Original'},{id:'other',name:'Other'}]);
 await put(root,'appearance.json',appearance.defaults);await put(company,'appearance.json',{...appearance.defaults,primary:'#0D74C0'});await put(company,'interface-text.json',{'Yassou,':'Yassou,'});
 const records={accounts:[{id:'employee'}],orders:[{id:'placed-order'}],catalogue:{suppliers:[{id:'supplier'}],products:[{id:'item'}]}};
 for(const [name,value]of Object.entries(records))await put(root,name+'.json',value);
 await Promise.all([defaults.migrate(root),defaults.migrate(root)]);
 const expected=defaults.files(await defaults.read(root))['appearance.json'];
 for(const scope of [root,company]){assert.deepEqual(JSON.parse(await read(scope,'appearance.json')),expected);assert.deepEqual(JSON.parse(await read(scope,'interface-text.json')),{});}
 for(const [name,value]of Object.entries(records))assert.deepEqual(JSON.parse(await read(root,name+'.json')),value);
 assert.equal(JSON.parse(await read(root,'defaults-migration-v2.json')).status,'updated');
 await put(company,'appearance.json',{...expected,primary:'#123456'});await defaults.migrate(root);assert.equal(JSON.parse(await read(company,'appearance.json')).primary,'#123456');
});
test('any custom formatting in any existing company protects the entire network byte for byte',async t=>{
 const cases={greeting:['home-greeting.json',{revision:1,text:'Hi {user}'}],home:['home-dashboard.json',{revision:1,sections:[]}],colours:['appearance.json',{...appearance.defaults,primary:'#123456'}],font:['appearance.json',{...appearance.defaults,fonts:{...appearance.defaults.fonts,headings:'verdana'}}],background:['appearance.json',{...appearance.defaults,backgrounds:{page:'#112233'}}],image:['appearance.json',{...appearance.defaults,backgroundImages:{page:'saved-image'}}],text:['interface-text.json',{Cart:'My basket'}],blank:['interface-text.json',{Hello:null}],element:['element-overrides.json',{'home-greeting-intro':{fontColour:'#112233'}}],layout:['layouts.json',{home:{revision:1,groups:{'home-main':['home-actions','home-overview']}}}],logo:['logo.json',{type:'image/png',data:'saved-logo'}],sidebarLogo:['sidebar-logo.json',{type:'image/png',data:'saved-logo'}],fontUpload:['fonts.json',[{id:'custom_saved',name:'Custom font'}]]};
 for(const [name,[file,value]]of Object.entries(cases))await t.test(name,async t=>{
  const root=await fixture(t),other=customisations.folder(root,'custom');await put(root,'companies.json',[{id:'default'},{id:'custom'}]);await put(root,'appearance.json',appearance.defaults);await put(other,file,value);const before=await read(other,file),original=await read(root,'appearance.json');
  await defaults.migrate(root);assert.equal(await read(other,file),before);assert.equal(await read(root,'appearance.json'),original);assert.equal(await defaults.snapshot(root),null);assert.equal(JSON.parse(await read(root,'defaults-migration-v2.json')).status,'preserved');
  await defaults.seedCompany(root,'new');assert.deepEqual(JSON.parse(await read(customisations.folder(root,'new'),'appearance.json')),defaults.files(await defaults.read(root))['appearance.json']);
 });
});
test('new companies in preserved networks receive platform defaults and keep their own greeting and reset snapshot',async t=>{
 const root=await fixture(t),network=path.join(root,'networks','old');const starting=await defaults.read(root);await defaults.save(root,{...starting,primary:'#123456',font:'verdana',greeting:'Welcome {user}!'});
 await put(network,'appearance.json',{...appearance.defaults,primary:'#654321'});await defaults.migrate(network,root);await defaults.seedCompany(network,'new',root);
 const seeded=await defaults.companySnapshot(network,'new');assert.equal(seeded.primary,'#123456');assert.equal(seeded.greeting,'Welcome {user}!');assert.equal((await text.read(customisations.folder(network,'new'))).Hello,'Welcome');assert.equal(await defaults.companySnapshot(network,'default'),null);
 const next=await defaults.read(root);await defaults.save(root,{...next,primary:'#abcdef'});assert.equal((await defaults.companySnapshot(network,'new')).primary,'#123456');assert.equal(JSON.parse(await read(network,'appearance.json')).primary,'#654321');
});
test('a customised network snapshot is preserved even if the company has not been edited',async t=>{
 const root=await fixture(t),seed={...await defaults.read(root),primary:'#123456',greeting:'Welcome {user}!'};for(const [name,value]of Object.entries(defaults.files(seed)))await put(root,name,value);const before=await read(root,'appearance.json');await defaults.migrate(root);assert.equal(await read(root,'appearance.json'),before);assert.deepEqual(await defaults.snapshot(root),seed);assert.equal((await text.read(root)).Hello,'Welcome');
});
test('saved greeting wording and linked App edit text retain their values under the neutral Hello identity',async t=>{
 const root=await fixture(t);await put(root,'interface-text.json',{'Yassou,':'Welcome back','Yassou & username':'Personal greeting'});await put(root,'element-overrides.json',{'home-greeting-intro':{text:{original:'Yassou,',value:'Hi there'}},'type:heading':{texts:{'Yassou,':{original:'Yassou,',value:'Welcome'}}}});
 assert.deepEqual(await text.read(root),{Hello:'Welcome back','Greeting & username':'Personal greeting'});const saved=await elements.read(root);assert.equal(saved['home-greeting-intro'].text.original,'Hello');assert.equal(saved['home-greeting-intro'].text.value,'Hi there');assert.equal(saved['type:heading'].texts.Hello.value,'Welcome');assert.ok((await read(root,'element-overrides.json')).includes('Yassou,'));
 assert.deepEqual({...await text.save(root,{'Yassou,':'Hello team'})},{Hello:'Hello team'});assert.equal((await elements.patch(root,{id:'home-greeting-intro',changes:{text:{original:'Yassou,',value:'Welcome team'}}}))['home-greeting-intro'].text.original,'Hello');
});
