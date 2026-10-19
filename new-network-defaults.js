const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const appearance=require('./appearance'),customisations=require('./company-customisations');
const queues=new Map(),fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
async function read(root){try{return JSON.parse(await fs.readFile(path.join(root,'opstack/new-network-defaults.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return{revision:0,primary:'#008CFF',secondary:'#45EFC3',font:'arial',greeting:'Hello {user}',signInHeading:'Welcome to Opstack',signInMessage:'Sign in to access your workspace.'};}}
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
function files(settings){const fonts=Object.fromEntries(Object.keys(appearance.defaults.fonts).map(part=>[part,settings.font]));return{'network-defaults.json':settings,'appearance.json':{...structuredClone(appearance.defaults),primary:settings.primary,secondary:settings.secondary,fonts},'interface-text.json':{'Yassou,':settings.greeting.split('{user}')[0].trim(),'Yassou!':'Welcome!'}};}
async function snapshot(dir){try{return JSON.parse(await fs.readFile(path.join(dir,'network-defaults.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return null;}}
async function seedCompany(dir,id){const settings=await snapshot(dir);if(!settings)return;const target=customisations.folder(dir,id);await fs.mkdir(target,{recursive:true});for(const [name,value]of Object.entries(files(settings))){if(name==='network-defaults.json')continue;try{await fs.writeFile(path.join(target,name),JSON.stringify(value),{mode:0o600,flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}}}
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function welcome(markup,settings){if(!settings)return markup;for(const [id,value]of [['login-7',settings.signInHeading],['login-8',settings.signInMessage]])markup=markup.replace(new RegExp('(<(?:h1|p)\\b[^>]*data-edit-id="'+id+'"[^>]*>)[^<]*(</(?:h1|p)>)'),(_,open,close)=>open+escape(value)+close);return markup;}
module.exports={read,save,files,snapshot,seedCompany,welcome};
