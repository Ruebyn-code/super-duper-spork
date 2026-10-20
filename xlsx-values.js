/* Read bounded XLSX cell values only. Formulas, macros and external links never run. */
const zlib=require('node:zlib');
const fail=message=>{throw Object.assign(Error(message),{status:400});};
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;};
function unzip(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<22||bytes.length>5000000)fail('Choose an Excel workbook up to 5 MB.');
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 if(end<0)fail('This file is not a supported Excel workbook.');
 const count=bytes.readUInt16LE(end+10),offset=bytes.readUInt32LE(end+16),size=bytes.readUInt32LE(end+12);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||count!==bytes.readUInt16LE(end+8)||count>256||offset+size!==end)fail('This Excel archive is not supported.');
 const files=new Map();let at=offset,total=0;
 for(let i=0;i<count;i++){
  if(at+46>end||bytes.readUInt32LE(at)!==0x02014b50)fail('The Excel workbook is damaged.');
  const flags=bytes.readUInt16LE(at+8),method=bytes.readUInt16LE(at+10),crc=bytes.readUInt32LE(at+16),compressed=bytes.readUInt32LE(at+20),length=bytes.readUInt32LE(at+24),nameLength=bytes.readUInt16LE(at+28),extra=bytes.readUInt16LE(at+30),comment=bytes.readUInt16LE(at+32),local=bytes.readUInt32LE(at+42);
  if(at+46+nameLength+extra+comment>end)fail('The Excel workbook is damaged.');
  const name=bytes.subarray(at+46,at+46+nameLength).toString('utf8');at+=46+nameLength+extra+comment;
  if(!/^xl\/(?:workbook\.xml|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(name))continue;
  total+=length;if(flags&1||![0,8].includes(method)||length>5000000||total>20000000||files.has(name)||local+30>offset||bytes.readUInt32LE(local)!==0x04034b50)fail('This Excel workbook is too large or unsupported.');
  const start=local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);if(start+compressed>offset)fail('The Excel workbook is damaged.');
  let value;try{value=method===0?bytes.subarray(start,start+compressed):zlib.inflateRawSync(bytes.subarray(start,start+compressed),{maxOutputLength:5000000});}catch{fail('Unable to read the Excel workbook.');}
  if(value.length!==length||crc32(value)!==crc)fail('The Excel workbook is damaged.');
  let xml=value.toString('utf8');if(/<!DOCTYPE|<!ENTITY/i.test(xml))fail('Unsupported Excel XML.');xml=xml.replace(/<!--[\s\S]*?-->/g,'').replace(/<(\/?)[\w-]+:/g,'<$1');files.set(name,xml);
 }
 if(at!==end||!files.has('xl/workbook.xml'))fail('Choose a valid .xlsx workbook.');return files;
}
function unescapeXml(text){return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,(_,name)=>{if(name[0]==='#'){const point=name[1].toLowerCase()==='x'?parseInt(name.slice(2),16):Number(name.slice(1));if(point<1||point>0x10ffff||point>=0xd800&&point<=0xdfff)fail('Unsupported Excel text.');return String.fromCodePoint(point);}return{amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[name.toLowerCase()];});}
const attribute=(text,key)=>unescapeXml(text.match(new RegExp('(?:^|\\s)'+key+'=["\x27]([^"\x27]*)["\x27]'))?.[1]||'');
const plainText=xml=>[...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g,'').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(match=>unescapeXml(match[1])).join('');
function read(bytes){
 const files=unzip(bytes),strings=[...(files.get('xl/sharedStrings.xml')||'').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(match=>plainText(match[1]));if(strings.length>50000)fail('This workbook has too much text.');
 const sheets=[];let count=0;
 for(const[name,xml]of files){if(!name.startsWith('xl/worksheets/'))continue;if(sheets.length===12)fail('Use a workbook with up to 12 worksheets.');const cells=new Map();
  for(const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   if(++count>100000)fail('This workbook has too many cells.');const address=attribute(match[1],'r'),type=attribute(match[1],'t'),body=match[2]||'',raw=body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];if(!/^[A-Z]{1,3}[1-9]\d{0,5}$/.test(address)||cells.has(address))fail('Unsupported Excel cell reference.');
   let value=raw===undefined?null:unescapeXml(raw);if(type==='s'){if(!/^\d+$/.test(value||'')||Number(value)>=strings.length)fail('Invalid Excel shared text.');value=strings[Number(value)];}else if(type==='inlineStr')value=plainText(body);
   cells.set(address,{value,type,formula:/<f\b/.test(body)});
  }sheets.push({name,cells});
 }
 return{date1904:/<workbookPr\b[^>]*\bdate1904=["'](?:1|true)["']/.test(files.get('xl/workbook.xml')),sheets};
}
module.exports={read,crc32};
