// Original invoice files are already compressed. Stream a stored ZIP with bounded
// chunks, UTF-8 names and data descriptors instead of buffering the whole week.
const {crc32}=require('node:zlib'),crypto=require('node:crypto');
const maximum=0xffffffff,flags=0x0808;
const invalid=message=>{throw Object.assign(Error(message),{status:400});};
const extensions={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'};
function label(value){const letters=Array.from(String(value||'').normalize('NFC').replace(/[^\p{L}\p{N}._ -]/gu,'_').replace(/^[. ]+|[. ]+$/g,'')).slice(0,100);while(Buffer.byteLength(letters.join(''))>160)letters.pop();return letters.join('')||'invoice';}
function filename(record,index){const original=record.source.name.replace(/\.[^.]*$/,''),extension=extensions[record.source.mime];if(!extension)throw Error('Unsupported invoice original.');return String(index+1).padStart(4,'0')+'-'+label(original)+'.'+extension;}
function timestamp(value){const date=new Date(value),year=date.getUTCFullYear();if(!Number.isFinite(date.getTime())||year<1980||year>2107)return{date:33,time:0};return{date:((year-1980)<<9)|((date.getUTCMonth()+1)<<5)|date.getUTCDate(),time:(date.getUTCHours()<<11)|(date.getUTCMinutes()<<5)|Math.floor(date.getUTCSeconds()/2)};}
function plan(files){
 if(!files.length||files.length>=0xffff)invalid('This bundle has too many files for one ZIP.');
 let size=22;const entries=files.map((file,index)=>{const name=Buffer.from(filename(file.record,index)),stamp=timestamp(file.record.createdAt);if(!Number.isSafeInteger(file.size)||file.size<1||file.size>=maximum)invalid('Invalid invoice original size.');size+=30+name.length+file.size+16+46+name.length;return{...file,name,...stamp};});
 if(!Number.isSafeInteger(size)||size>=maximum)invalid('This bundle is too large for one ZIP.');return{entries,size};
}
async function* chunks(entries){
 let offset=0;const directory=[];
 for(const file of entries){
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(flags,6);header.writeUInt16LE(file.time,10);header.writeUInt16LE(file.date,12);header.writeUInt16LE(file.name.length,26);yield header;yield file.name;
  let checksum=0,length=0;const hash=crypto.createHash('sha256'),stream=file.handle.createReadStream({autoClose:false,start:0,end:file.size-1,highWaterMark:65536});
  try{for await(const chunk of stream){length+=chunk.length;checksum=crc32(chunk,checksum);hash.update(chunk);yield chunk;}}finally{stream.destroy();}
  if(length!==file.size||hash.digest('hex')!==file.record.source.sha256)throw Error('An invoice original changed during the download.');
  const descriptor=Buffer.alloc(16);descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(checksum,4);descriptor.writeUInt32LE(file.size,8);descriptor.writeUInt32LE(file.size,12);yield descriptor;
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(flags,8);central.writeUInt16LE(file.time,12);central.writeUInt16LE(file.date,14);central.writeUInt32LE(checksum,16);central.writeUInt32LE(file.size,20);central.writeUInt32LE(file.size,24);central.writeUInt16LE(file.name.length,28);central.writeUInt32LE(offset,42);directory.push(central,file.name);offset+=30+file.name.length+file.size+16;
 }
 const directoryOffset=offset;for(const chunk of directory){yield chunk;offset+=chunk.length;}
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(offset-directoryOffset,12);end.writeUInt32LE(directoryOffset,16);yield end;
}
module.exports={label,plan,chunks};
