const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('./public/prep-label-model.js');
// Expands ZPL ASCII-compressed ^GFA data back to plain hex rows.
function expand(data,rowChars){const rows=[];let row='',repeat=0;const flush=()=>{rows.push(row.padEnd(rowChars,'0'));row='';};
 for(const ch of data){if(ch===':'){rows.push(rows[rows.length-1]);continue;}if(ch===','){flush();continue;}
  if(ch>='G'&&ch<='Y'){repeat+=ch.charCodeAt(0)-70;continue;}if(ch>='g'&&ch<='z'){repeat+=(ch.charCodeAt(0)-102)*20;continue;}
  row+=ch.repeat(repeat||1);repeat=0;if(row.length===rowChars)flush();}
 if(row)flush();return rows.join('');}
test('Bluetooth ZPL compression decodes to exactly the same raster',()=>{
 for(const [width,height] of [[9,2],[400,200],[203,97]]){
  const image=new Uint8ClampedArray(width*height*4).fill(255);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){const dark=(y>20&&y<40)||(x%37<3&&y%5)||((x*y)%101===0);if(dark){const at=(y*width+x)*4;image[at]=image[at+1]=image[at+2]=0;}}
  const plain=model.zpl(image,width,height,2),packed=model.zpl(image,width,height,2,{compress:true});
  const field=text=>text.match(/\^GFA,(\d+),(\d+),(\d+),([^^]*)\^FS/);const a=field(plain),b=field(packed);
  assert.deepEqual(b.slice(1,4),a.slice(1,4),'byte counts stay uncompressed totals');
  assert.equal(expand(b[4],Number(a[3])*2),a[4]);assert.match(packed,/\^PQ2\n\^XZ\n$/);
  if(width===400)assert(b[4].length<a[4].length/4,'mostly white labels shrink a lot');
 }
});
function load(bluetooth,userAgent='Mozilla/5.0 (Linux; Android 14)'){const window={isSecureContext:true};const context={window,navigator:{bluetooth,userAgent},TextEncoder,console,setTimeout};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'public/label-bluetooth.js'),'utf8'),context);return window.labelBluetooth;}
test('Bluetooth printing only connects through the chooser and sends in ordered chunks',async()=>{
 const written=[];let requests=0,options;
 const characteristic={properties:{write:true},writeValueWithResponse:async chunk=>{written.push(Buffer.from(chunk).toString());}};
 const gatt={connected:false,connect:async()=>{gatt.connected=true;return gatt;},disconnect(){gatt.connected=false;},getPrimaryService:async uuid=>{if(uuid!=='38eb4a80-c570-11e3-9507-0002a5d5c51b')throw Error('none');return{getCharacteristic:async()=>characteristic,getCharacteristics:async()=>[characteristic]};}};
 const device={name:'ZD411-Front',gatt,addEventListener(){}};
 const printer=load({requestDevice:async value=>{requests++;options=value;return device;}});
 assert.equal(requests,0,'loading never connects');assert.equal(printer.connected(),false);
 await assert.rejects(printer.send('^XA^XZ'),/Connect a Bluetooth printer first/);
 assert.equal(await printer.connect(),'ZD411-Front');assert.equal(requests,1);assert.equal(options.acceptAllDevices,true,'printers named by serial number still appear');assert(options.optionalServices.includes('38eb4a80-c570-11e3-9507-0002a5d5c51b'));assert(options.optionalServices.includes('0000fe79-0000-1000-8000-00805f9b34fb'));
 const text='^XA'+'A'.repeat(1000)+'^XZ';let last=0;await printer.send(text,share=>{assert(share>last);last=share;});
 assert.equal(written.join(''),text);assert(written.every(chunk=>chunk.length<=180));assert.equal(last,1);
 printer.disconnect();assert.equal(printer.connected(),false);assert.equal(gatt.connected,false);
});
test('Bluetooth printing explains unsupported browsers and a cancelled chooser',async()=>{
 await assert.rejects(load(undefined).connect(),/Chrome or Edge/);
 const printer=load({requestDevice:async()=>{throw Object.assign(Error('cancel'),{name:'NotFoundError'});}});
 await assert.rejects(printer.connect(),/No printer was chosen/);assert.equal(printer.hasDevice(),false);
});
test('Bluetooth printing finds a writable channel on an unknown service and explains real failures',async()=>{
 const written=[];const characteristic={properties:{write:false,writeWithoutResponse:true},writeValueWithoutResponse:async chunk=>{written.push(Buffer.from(chunk).toString());}};
 const other={getCharacteristics:async()=>[{properties:{read:true}},characteristic]};
 const gatt={connected:false,connect:async()=>{gatt.connected=true;return gatt;},disconnect(){gatt.connected=false;},getPrimaryService:async()=>{throw Object.assign(Error('No Services matching UUID'),{name:'NotFoundError'});},getPrimaryServices:async()=>[other]};
 const printer=load({requestDevice:async()=>({name:'D4J213303411',gatt,addEventListener(){}})});
 assert.equal(await printer.connect(),'D4J213303411');await printer.send('^XA^XZ');assert.equal(written.join(''),'^XA^XZ');assert(written.every(chunk=>chunk.length<=20));
 const failing=load({requestDevice:async()=>{throw Object.assign(Error('Bluetooth adapter not available.'),{name:'NotFoundError'});}});
 await assert.rejects(failing.connect(),/No Bluetooth printer was found.*Bluetooth adapter not available/);
 const broken={connected:false,connect:async()=>{throw Object.assign(Error('Connection attempt failed.'),{name:'NetworkError'});},disconnect(){}};
 await assert.rejects(load({requestDevice:async()=>({name:'ZD411',gatt:broken,addEventListener(){}})}).connect(),/Could not connect to the printer.*NetworkError: Connection attempt failed/);
 await assert.rejects(load(undefined,'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)').connect(),/iPhone and iPad browsers/);
});
