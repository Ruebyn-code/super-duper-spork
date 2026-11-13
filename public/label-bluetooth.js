// Labels: an explicit, user-chosen Bluetooth (BLE) label printer connection through Web Bluetooth.
// Connecting always goes through the browser's device chooser; nothing reconnects or prints on its own.
// The printer receives the batch's raster as ZPL, so entered text never becomes printer commands.
(()=>{
 // Known label-printer write channels: Zebra Link-OS BLE parser, then common generic BLE printer serial services.
 const channels=[
  {service:'38eb4a80-c570-11e3-9507-0002a5d5c51b',write:'38eb4a82-c570-11e3-9507-0002a5d5c51b'},
  {service:'000018f0-0000-1000-8000-00805f9b34fb',write:'00002af1-0000-1000-8000-00805f9b34fb'},
  {service:'e7810a71-73ae-499d-8c15-faa9aef0c3f2',write:'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'},
  {service:'49535343-fe7d-4ae5-8fa9-9fafd205e455',write:'49535343-8841-43f4-a8d4-ecbe34729bb3'},
  {service:'0000ff00-0000-1000-8000-00805f9b34fb',write:'0000ff02-0000-1000-8000-00805f9b34fb'},
  {service:'0000ffe0-0000-1000-8000-00805f9b34fb',write:'0000ffe1-0000-1000-8000-00805f9b34fb'}
 ];
 // Extra services the chooser may open so a printer's write channel can be found (Zebra's own 0xFE79 service included).
 const extraServices=['0000fe79-0000-1000-8000-00805f9b34fb','0000ae30-0000-1000-8000-00805f9b34fb','0000ffe5-0000-1000-8000-00805f9b34fb'];
 const reason=error=>error?.name&&error.name!=='Error'?' ('+error.name+(error.message?': '+String(error.message).slice(0,120):'')+')':error?.message?' ('+String(error.message).slice(0,120)+')':'';
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const listeners=new Set();let device=null,channel=null,reader=null,info=null,sending=false;
 // Zebra Link-OS printers answer setting queries on this channel (read-only questions, never printer changes).
 const zebraRead='38eb4a81-c570-11e3-9507-0002a5d5c51b';
 const supported=()=>Boolean(navigator.bluetooth?.requestDevice)&&window.isSecureContext!==false;
 const notify=()=>{for(const listener of listeners)try{listener();}catch{}};
 // iPhone/iPad browsers (Safari, and Chrome/Edge on iOS) have no Web Bluetooth.
 const ios=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 const unsupportedText=()=>ios()?'iPhone and iPad browsers cannot connect to Bluetooth printers. Use a Bluetooth-enabled browser app such as Bluefy, or print from an Android device or a computer with Chrome or Edge.':window.isSecureContext===false?'Bluetooth printing needs the secure (https) address of this app.':'This browser cannot connect to Bluetooth printers. Use Chrome or Edge on Android, Windows, Mac or ChromeOS.';
 const name=()=>device?(device.name||'Bluetooth printer'):'';
 const connected=()=>Boolean(device&&device.gatt?.connected&&channel);
 async function attach(){
  let server;try{server=device.gatt.connected?device.gatt:await device.gatt.connect();}catch{await pause(600);server=await device.gatt.connect();}
  reader=null;info=null;
  for(const known of channels){try{const service=await server.getPrimaryService(known.service);channel=await service.getCharacteristic(known.write);if(known===channels[0]){try{reader=await service.getCharacteristic(zebraRead);await reader.startNotifications();}catch{reader=null;}}return;}catch{}}
  // Otherwise use the first writable channel on any service the browser lets us open.
  let services=[];try{services=await server.getPrimaryServices();}catch{for(const id of[...channels.map(known=>known.service),...extraServices]){try{services.push(await server.getPrimaryService(id));}catch{}}}
  for(const service of services){try{for(const candidate of await service.getCharacteristics())if(candidate.properties.write||candidate.properties.writeWithoutResponse){channel=candidate;return;}}catch{}}
  channel=null;try{device.gatt.disconnect();}catch{}
  throw Error('This Bluetooth device does not accept label printing. Choose your label printer (a Zebra printer usually shows its serial number).');
 }
 // Must be called straight from a click or key press: the browser shows its own device chooser.
 async function connect(){
  if(!supported())throw Error(unsupportedText());
  let chosen;
  try{chosen=await navigator.bluetooth.requestDevice({acceptAllDevices:true,optionalServices:[...channels.map(known=>known.service),...extraServices]});}
  catch(error){if(error?.name==='NotFoundError'&&/cancel/i.test(error.message||''))throw Error('No printer was chosen.');if(error?.name==='NotFoundError')throw Error('No Bluetooth printer was found. Turn the printer on, make sure Bluetooth is on for this device (on Android also allow Nearby devices/Location for the browser), then try again.'+reason(error));if(error?.name==='SecurityError'||error?.name==='NotAllowedError')throw Error('Bluetooth access was blocked. Allow Bluetooth for this site in your browser settings, then try again.'+reason(error));throw Error('Bluetooth is unavailable. Turn Bluetooth on and try again.'+reason(error));}
  if(device&&device!==chosen)disconnect();
  device=chosen;channel=null;reader=null;info=null;
  if(!device.opstackWatched){device.opstackWatched=true;device.addEventListener('gattserverdisconnected',()=>{if(device===chosen){channel=null;notify();}});}
  try{await attach();}catch(error){device=null;notify();throw error.message?.startsWith('This Bluetooth')?error:Error('Could not connect to the printer. Make sure it is on, nearby and not connected to another phone or computer, then try again.'+reason(error));}
  notify();return name();
 }
 function disconnect(){const current=device;device=null;channel=null;reader=null;info=null;try{current?.gatt?.connected&&current.gatt.disconnect();}catch{}notify();}
 // Sends text in small sequential chunks; reconnects once to the chosen printer if the link dropped.
 async function send(text,progress){
  if(!device)throw Error('Connect a Bluetooth printer first.');
  if(sending)throw Error('The printer is still receiving the last labels.');
  sending=true;
  try{
   if(!connected()){try{await attach();notify();}catch(error){throw Error('The printer disconnected. Make sure it is on and nearby, then connect again.'+reason(error));}}
   const bytes=new TextEncoder().encode(text),withResponse=Boolean(channel.properties.write);
   let size=withResponse?180:20;
   const write=chunk=>withResponse?channel.writeValueWithResponse(chunk):channel.writeValueWithoutResponse(chunk);
   for(let at=0;at<bytes.length;){
    const chunk=bytes.slice(at,at+size);
    try{await write(chunk);}catch(error){if(size>20&&at===0){size=20;continue;}throw Error('Sending to the printer stopped part way. Check the printer, then print again.'+reason(error));}
    at+=chunk.length;progress?.(at/bytes.length);
   }
  }finally{sending=false;}
 }
 // Asks a Zebra printer one Set-Get-Do value (for example its print resolution). Read-only; null when unknown.
 async function ask(setting,timeout=2500){
  if(!reader||!connected()||sending)return null;
  let text='';const decoder=new TextDecoder();
  const result=new Promise(resolve=>{const timer=setTimeout(()=>done(null),timeout);function listen(event){text+=decoder.decode(event.target.value);const match=text.match(/"([^"]*)"/);if(match)done(match[1].trim());}function done(value){clearTimeout(timer);reader.removeEventListener('characteristicvaluechanged',listen);resolve(value);}reader.addEventListener('characteristicvaluechanged',listen);});
  try{const command=new TextEncoder().encode('! U1 getvar "'+setting+'"\r\n');await(channel.properties.write?channel.writeValueWithResponse(command):channel.writeValueWithoutResponse(command));}catch{return null;}
  return result;
 }
 // The connected printer's real print resolution, asked once per connection (null for printers that cannot say).
 async function printerInfo(){
  if(info)return info;if(!connected()){try{await attach();notify();}catch{return {dpi:null};}}
  const dpi=Number(await ask('head.resolution.in_dpi'));
  info={dpi:[203,300].includes(dpi)?dpi:null};return info;
 }
 window.labelBluetooth={supported,unsupportedText,connect,disconnect,send,connected,name,printerInfo,hasDevice:()=>Boolean(device),onchange:listener=>{listeners.add(listener);return()=>listeners.delete(listener);}};
})();
