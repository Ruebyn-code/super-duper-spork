const fs=require('node:fs/promises'),path=require('node:path');
const queues=new Map(),fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function image(input){
 if(input?.mime!=='image/jpeg'||typeof input.data!=='string'||input.data.length>350000||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))fail('Choose a JPG, PNG or WebP photo and save the square preview.');
 const bytes=Buffer.from(input.data,'base64');if(bytes.length>256000||bytes.length<20||bytes.toString('base64')!==input.data||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)fail('Choose a valid profile photo up to 256 KB.');
 let offset=2,width=0,height=0;while(offset+4<bytes.length){if(bytes[offset++]!==255)break;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===217||marker===218)break;const length=bytes.readUInt16BE(offset);if(length<2||offset+length>bytes.length)break;if([192,193,194].includes(marker)&&length>=8){height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break;}offset+=length;}
 if(!width||width!==height||width>512)fail('Save a square profile photo up to 512 pixels.');return{mime:'image/jpeg',data:input.data};
}
function createStore(dir){
 const folder=path.join(dir,'profile-photos'),file=id=>{if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(id))fail('Profile photo not found.',404);return path.join(folder,id+'.json');};
 async function read(id){try{return JSON.parse(await fs.readFile(file(id),'utf8'));}catch(error){if(error.code==='ENOENT')return{revision:0,photo:null};throw error;}}
 const summary=(id,state)=>({revision:state.revision,photoUrl:state.photo?'/api/profile-photos/'+id+'?v='+state.revision:null});
 async function describe(id){return summary(id,await read(id));}
 async function decorate(accounts){return Promise.all(accounts.map(async account=>({...account,photoUrl:(await describe(account.id)).photoUrl})));}
 async function change(id,input,remove,authorize){const target=file(id),task=(queues.get(target)||Promise.resolve()).then(async()=>{
  await authorize();const state=await read(id);if(!Number.isSafeInteger(input?.revision)||input.revision<0)fail('Reload the current profile photo before saving.');if(input.revision!==state.revision)fail('This profile photo changed. Check your selection and save again.',409);
  const next={revision:state.revision+1,photo:remove?null:image(input)};await fs.mkdir(folder,{recursive:true});const temporary=target+'.tmp';try{await fs.writeFile(temporary,JSON.stringify(next),{mode:0o600});await fs.rename(temporary,target);}finally{await fs.rm(temporary,{force:true});}return summary(id,next);
 });const settled=task.catch(()=>{});queues.set(target,settled);try{return await task;}finally{if(queues.get(target)===settled)queues.delete(target);}}
 async function bytes(id){const state=await read(id);if(!state.photo)fail('Profile photo not found.',404);return Buffer.from(state.photo.data,'base64');}
 async function purge(id){const target=file(id),task=(queues.get(target)||Promise.resolve()).then(()=>fs.rm(target,{force:true})),settled=task.catch(()=>{});queues.set(target,settled);try{await task;}finally{if(queues.get(target)===settled)queues.delete(target);}}
 return{read,describe,decorate,change,bytes,purge};
}
module.exports={createStore,image};
