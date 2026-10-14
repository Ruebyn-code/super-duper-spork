const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const types={ttf:{signature:0x00010000,format:'truetype',mime:'font/ttf'},otf:{signature:0x4f54544f,format:'opentype',mime:'font/otf'},woff:{signature:0x774f4646,format:'woff',mime:'font/woff'},woff2:{signature:0x774f4632,format:'woff2',mime:'font/woff2'}};
const isId=value=>typeof value==='string'&&/^custom_[a-f0-9]{64}$/.test(value);
const queues=new Map();
async function list(dir){try{return JSON.parse(await fs.readFile(path.join(dir,'fonts.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return [];throw error;}}
function available(value,library){return isId(value)&&library.some(font=>font.id===value);}
function validate(bytes,extension){
 if(!Object.hasOwn(types,extension)||bytes.length<12||bytes.length>2000000)throw Error('Choose a valid TTF, OTF, WOFF or WOFF2 font up to 2 MB.');
 const signature=bytes.readUInt32BE(0),ttf=extension==='ttf'&&(signature===0x00010000||signature===0x74727565);
 if(!ttf&&signature!==types[extension].signature)throw Error('The font format does not match its file extension.');
 const compressed=extension.startsWith('woff'),minimum=extension==='woff2'?48:compressed?44:12;
 if(bytes.length<minimum)throw Error('The font file is incomplete.');
 const count=bytes.readUInt16BE(compressed?12:4);
 if(!count||count>256)throw Error('The font has an invalid table directory.');
 if(compressed){
  const flavor=bytes.readUInt32BE(4),size=bytes.readUInt32BE(16);
  if(![0x00010000,0x74727565,0x4f54544f].includes(flavor)||bytes.readUInt32BE(8)!==bytes.length||bytes.readUInt16BE(14)!==0||size<12+16*count||size>16000000)throw Error('The font has an invalid header.');
  if(extension==='woff2'){const length=bytes.readUInt32BE(20);if(!length||48+count*2+length>bytes.length)throw Error('The font file is incomplete.');return;}
 }
 const entrySize=compressed?20:16,end=minimum+count*entrySize,tables=new Map(),ranges=[];
 if(end>bytes.length)throw Error('The font table directory is incomplete.');
 for(let i=0;i<count;i++){
  const at=minimum+i*entrySize,tag=bytes.toString('ascii',at,at+4),offset=bytes.readUInt32BE(at+(compressed?4:8)),length=bytes.readUInt32BE(at+(compressed?8:12)),original=compressed?bytes.readUInt32BE(at+12):length;
  if(tables.has(tag)||offset<end||offset+length>bytes.length||length>original||original>16000000)throw Error('The font contains invalid tables.');
  tables.set(tag,original);if(length)ranges.push([offset,offset+length]);
 }
 if(compressed&&12+16*count+[...tables.values()].reduce((sum,length)=>sum+Math.ceil(length/4)*4,0)!==bytes.readUInt32BE(16))throw Error('The font has inconsistent table lengths.');
 ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])throw Error('The font contains overlapping tables.');
 for(const [tag,size] of [['head',54],['cmap',4],['name',6],['maxp',6]])if((tables.get(tag)||0)<size)throw Error('The font is missing required tables.');
 if(!tables.get('glyf')&&!tables.get('CFF ')&&!tables.get('CFF2'))throw Error('The font contains no glyph outlines.');
}
function save(dir,input){const operation=(queues.get(dir)||Promise.resolve()).then(async()=>{
 if(typeof input?.name!=='string'||!input.name.trim()||input.name.trim().length>80)throw Error('Enter a font name of 1–80 characters.');
 if(typeof input.fileName!=='string'||input.fileName.length>240||/[\\/]/.test(input.fileName))throw Error('Choose a font file.');
 const extension=input.fileName.match(/\.(ttf|otf|woff2?)$/i)?.[1].toLowerCase();
 if(typeof input.data!=='string'||!input.data.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(input.data))throw Error('Choose a valid font file.');
 const bytes=Buffer.from(input.data,'base64');validate(bytes,extension);
 const hash=crypto.createHash('sha256').update(bytes).digest('hex'),id='custom_'+hash,library=await list(dir),existing=library.find(font=>font.id===id);
 const directory=path.join(dir,'fonts');await fs.mkdir(directory,{recursive:true});
 try{await fs.writeFile(path.join(directory,hash+'.'+extension),bytes,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
 if(existing)return {font:existing,alreadyExists:true};
 const font={id,name:input.name.trim(),extension,format:types[extension].format,url:'/uploaded-fonts/'+hash+'.'+extension,size:bytes.length,createdAt:new Date().toISOString()};
 library.push(font);const target=path.join(dir,'fonts.json'),temp=target+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(temp,JSON.stringify(library),{mode:0o600});await fs.rename(temp,target);return {font,alreadyExists:false};
 });queues.set(dir,operation.catch(()=>{}));return operation;}
async function file(dir,hash,extension){if(!/^[a-f0-9]{64}$/.test(hash)||!types[extension])return null;const library=await list(dir);if(!library.some(font=>font.id==='custom_'+hash&&font.extension===extension))return null;return {data:await fs.readFile(path.join(dir,'fonts',hash+'.'+extension)),mime:types[extension].mime};}
module.exports={list,available,save,file,validate,isId};
