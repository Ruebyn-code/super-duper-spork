const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const appearance=require('./appearance'),customisations=require('./company-customisations');
const {isDeepStrictEqual}=require('node:util');
const initial={revision:0,primary:'#008CFF',secondary:'#45EFC3',font:'arial',greeting:'Hello {user}',signInHeading:'Welcome to Opstack',signInMessage:'Sign in to access your workspace.'};
const queues=new Map(),fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
async function read(root){return await jsonFile(path.join(root,'opstack/new-network-defaults.json'))||{...initial};}
async function jsonFile(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return null;}}
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temporary,JSON.stringify(value),{mode:0o600});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}}
function validate(input){
 if(!input||typeof input!=='object'||Object.keys(input).some(key=>!['revision','primary','secondary','font','greeting','signInHeading','signInMessage'].includes(key)))fail('Choose valid new network defaults.');
 if(!/^#[a-f0-9]{6}$/i.test(input.primary)||!/^#[a-f0-9]{6}$/i.test(input.secondary))fail('Choose valid primary and secondary colours.');
 if(!Object.hasOwn(appearance.fontOptions,input.font))fail('Choose a built-in font that is available to every network.');
 const values={primary:input.primary,secondary:input.secondary,font:input.font};
 for(const [key,max]of [['greeting',100],['signInHeading',180],['signInMessage',500]]){if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max)fail('Enter a valid '+({greeting:'home greeting',signInHeading:'sign-in heading',signInMessage:'sign-in message'}[key])+'.');values[key]=input[key].trim();}
 if(input.greeting.split('{user}').length!==2||/\{(?!user\})[^}]*\}/.test(input.greeting))fail('Include {user} exactly once in the greeting.');
 return values;
}
function save(root,input){const file=path.join(root,'opstack/new-network-defaults.json'),task=(queues.get(file)||Promise.resolve()).then(async()=>{const current=await read(root);if(input?.revision!==current.revision)fail('New network defaults changed. Reload before saving.',409);const next={...validate(input),revision:current.revision+1},temporary=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(temporary,JSON.stringify(next),{mode:0o600});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}return next;});queues.set(file,task.catch(()=>{}));return task;}
function files(settings){const fonts=Object.fromEntries(Object.keys(appearance.defaults.fonts).map(part=>[part,settings.font]));return{'network-defaults.json':settings,'appearance.json':{...structuredClone(appearance.defaults),primary:settings.primary,secondary:settings.secondary,fonts},'interface-text.json':settings.greeting.split('{user}')[0].trim()==='Hello'?{}:{Hello:settings.greeting.split('{user}')[0].trim()}};}
async function snapshot(dir){try{return JSON.parse(await fs.readFile(path.join(dir,'network-defaults.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return null;}}
async function companySnapshot(dir,id){return await jsonFile(path.join(customisations.folder(dir,id),'company-defaults.json'))||await snapshot(dir);}
async function seedCompany(dir,id,root=dir){const settings=await snapshot(dir)||await read(root),target=customisations.folder(dir,id);await fs.mkdir(target,{recursive:true});for(const [name,value]of Object.entries(files(settings))){const file=name==='network-defaults.json'?'company-defaults.json':name;try{await fs.writeFile(path.join(target,file),JSON.stringify(value),{mode:0o600,flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}}}
// Inspect the whole network before writing anything. A custom company protects
// every existing company; newly created companies can still use clean defaults.
function migrate(dir,root=dir){const key=path.join(dir,'defaults-migration-v2.json'),task=(queues.get(key)||Promise.resolve()).then(()=>migrateNetwork(dir,root));queues.set(key,task.catch(()=>{}));return task;}
async function migrateNetwork(dir,root){
 const marker=path.join(dir,'defaults-migration-v2.json');if(await jsonFile(marker))return;
 const seed=await snapshot(dir),settings=seed||await read(root),standard=files(initial)['appearance.json'];
 const standardSeed=!seed||['primary','secondary','font','greeting','signInHeading','signInMessage'].every(key=>seed[key]===initial[key]);
 const records=await jsonFile(path.join(dir,'companies.json'))||[],ids=new Set(['default',...records.map(company=>company.id)]);
 try{for(const entry of await fs.readdir(path.join(dir,'company-customisations'),{withFileTypes:true}))if(entry.isDirectory()&&/^[a-zA-Z0-9-]{1,100}$/.test(entry.name))ids.add(entry.name);}catch(error){if(error.code!=='ENOENT')throw error;}
 let customised=!standardSeed;
 for(const id of ids){
  const scope=customisations.folder(dir,id),saved=await jsonFile(path.join(scope,'appearance.json'));
  if(saved){const normalise=value=>({...appearance.defaults,...value,primary:(value.primary||appearance.defaults.primary).toLowerCase(),secondary:(value.secondary||appearance.defaults.secondary).toLowerCase(),fonts:{...appearance.defaults.fonts,...value.fonts},backgrounds:value.backgrounds||{},backgroundImages:value.backgroundImages||{},fontColours:value.fontColours||{}});if(![appearance.defaults,standard].some(base=>isDeepStrictEqual(normalise(saved),normalise(base))))customised=true;}
  const text=await jsonFile(path.join(scope,'interface-text.json'))||{};
  if(Object.entries(text).some(([key,value])=>value!==key&&!(['Yassou,','Hello'].includes(key)&&value==='Hello')&&!(key==='Yassou!'&&value==='Welcome!')))customised=true;
  for(const name of ['element-overrides.json','fonts.json'])if(Object.keys(await jsonFile(path.join(scope,name))||{}).length)customised=true;
  if(Object.values(await jsonFile(path.join(scope,'layouts.json'))||{}).some(page=>Object.keys(page.groups||{}).length))customised=true;
  for(const name of ['logo.json','sidebar-logo.json'])if(await jsonFile(path.join(scope,name)))customised=true;
 }
 if(!customised){
  for(const id of ids){const scope=customisations.folder(dir,id);for(const [name,value]of Object.entries(files(settings))){if(name==='network-defaults.json'&&id!=='default')continue;await write(path.join(scope,name),value);}}
 }
 await write(marker,{version:2,status:customised?'preserved':'updated'});
}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function welcome(markup,settings){if(!settings)return markup;for(const [id,value]of [['login-7',settings.signInHeading],['login-8',settings.signInMessage]])markup=markup.replace(new RegExp('(<(?:h1|p)\\b[^>]*data-edit-id="'+id+'"[^>]*>)[^<]*(</(?:h1|p)>)'),(_,open,close)=>open+escape(value)+close);return markup;}
module.exports={read,save,files,snapshot,companySnapshot,seedCompany,migrate,welcome};
