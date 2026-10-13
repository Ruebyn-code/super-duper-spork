const fs=require('node:fs/promises');const path=require('node:path');const crypto=require('node:crypto');
const secretFields=['RESEND_API_KEY','TWILIO_AUTH_TOKEN','SUPPLIER_SYSTEM_TOKEN'];
const textFields=['ORDER_FROM_EMAIL','TWILIO_ACCOUNT_SID','ORDER_SMS_FROM'];
const toggles=['DELIVERY_EMAIL_ENABLED','DELIVERY_SMS_ENABLED','DELIVERY_SYSTEM_ENABLED'];
async function read(dir){try{return JSON.parse(await fs.readFile(path.join(dir,'delivery-settings.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
async function deliveryEnvironment(dir){return {...process.env,...await read(dir)};}
function summary(env){return {values:Object.fromEntries(textFields.map(key=>[key,env[key]||''])),secrets:Object.fromEntries(secretFields.map(key=>[key,Boolean(env[key])])),enabled:Object.fromEntries(toggles.map(key=>[key,env[key]==='true']))};}
async function save(dir,input){if(!input||typeof input!=='object')throw Error('Enter valid delivery settings.');const saved=await read(dir);for(const key of [...secretFields,...textFields]){if(input[key]===undefined)continue;if(typeof input[key]!=='string'||input[key].length>1000||/[\r\n]/.test(input[key]))throw Error('Invalid sending-service value.');if(secretFields.includes(key)&&input[key]==='')continue;saved[key]=input[key].trim();}for(const key of toggles){if(typeof input[key]!=='boolean')throw Error('Choose which sending methods to enable.');saved[key]=String(input[key]);}await fs.mkdir(dir,{recursive:true});const target=path.join(dir,'delivery-settings.json'),temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(saved),{mode:0o600});await fs.rename(temp,target);return summary({...process.env,...saved});}
module.exports={deliveryEnvironment,summary,save};
