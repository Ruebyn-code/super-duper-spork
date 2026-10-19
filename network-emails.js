const fs=require('node:fs/promises'),path=require('node:path');
const queues=new Map();
// Keep the check and account write in one queue across all networks. Derive
// ownership from real accounts, including pending users and suspended networks.
function run(root,currentDir,change){
 const key=path.resolve(root),operation=(queues.get(key)||Promise.resolve()).then(()=>change(async value=>{
  if(typeof value!=='string'||!/^\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*$/.test(value))return;
  const email=value.trim().toLowerCase();let networks;
  try{networks=JSON.parse(await fs.readFile(path.join(root,'opstack/platform.json'),'utf8')).networks;}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const network of networks||[{id:'default'}]){
   const dir=network.id==='default'?root:path.join(root,'networks',network.id);if(currentDir&&path.resolve(dir)===path.resolve(currentDir))continue;
   const people=await require('./auth').createAuth(dir).directory();
   if(people.some(person=>[person.email,person.username].some(identity=>typeof identity==='string'&&identity.trim().toLowerCase()===email)))throw Object.assign(Error('This email is already assigned to another network. Each email can belong to only one network.'),{status:409});
  }
 }));
 queues.set(key,operation.catch(()=>{}));return operation;
}
module.exports={run};
