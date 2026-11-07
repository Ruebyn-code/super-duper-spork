// Camera-only capture for checklist photo/video steps and corrective photos.
// Opens the device camera in a dialog (getUserMedia); where that isn't available it falls back to the
// phone's own camera through a capture-only file input. Resolves to a File, or null when cancelled.
(()=>{
 if(window.cameraCapture)return;
 const word=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
 const supported=()=>Boolean(navigator.mediaDevices?.getUserMedia)&&window.isSecureContext!==false;
 const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
 // Phone fallback: an input that asks for the camera rather than the photo library.
 function fallback(kind){return new Promise(resolve=>{const input=node('input');input.type='file';input.accept=kind==='video'?'video/*':'image/*';input.setAttribute('capture','environment');input.hidden=true;document.body.append(input);let settled=false;const done=file=>{if(settled)return;settled=true;input.remove();resolve(file||null);};input.onchange=()=>done(input.files[0]);input.oncancel=()=>done(null);input.click();});}
 function videoType(){for(const [type,ext] of [['video/mp4;codecs=avc1','mp4'],['video/mp4','mp4'],['video/webm;codecs=vp9,opus','webm'],['video/webm;codecs=vp8,opus','webm'],['video/webm','webm']])if(window.MediaRecorder?.isTypeSupported?.(type))return{type,ext};return{type:'',ext:'webm'};}
 async function capture(kind,{maxSeconds=60,parent}={}){
  if(!supported())return fallback(kind);
  let facing='environment',stream=null;
  const dialog=node('dialog',undefined,'camera-capture-dialog');dialog.dataset.layoutUi='';dialog.setAttribute('aria-label',kind==='video'?word('Record video'):word('Take photo'));
  const head=node('div',undefined,'camera-capture-head'),title=node('strong',kind==='video'?word('Record video'):word('Take photo')),close=node('button','×','camera-capture-close');close.type='button';close.setAttribute('aria-label',word('Close camera'));head.append(title,close);
  const stage=node('div',undefined,'camera-capture-stage'),live=node('video');live.autoplay=true;live.muted=true;live.playsInline=true;live.setAttribute('playsinline','');const still=node('img');still.alt=word('Captured photo');still.hidden=true;const replay=node('video');replay.controls=true;replay.playsInline=true;replay.hidden=true;const timer=node('span','', 'camera-capture-timer');timer.hidden=true;stage.append(live,still,replay,timer);
  const status=node('p','', 'camera-capture-status');status.setAttribute('role','status');
  const actions=node('div',undefined,'camera-capture-actions'),flip=node('button',word('Switch camera'),'camera-capture-secondary'),shoot=node('button',kind==='video'?word('Start recording'):word('Take photo'),'camera-capture-primary'),retake=node('button',word('Retake'),'camera-capture-secondary'),use=node('button',kind==='video'?word('Use video'):word('Use photo'),'camera-capture-primary');for(const button of [flip,shoot,retake,use,close])button.type='button';retake.hidden=use.hidden=true;actions.append(flip,shoot,retake,use);
  dialog.append(head,stage,status,actions);(parent||document.querySelector('dialog[open]')||document.body).append(dialog);
  let result=null,recorder=null,chunks=[],tick=0,blob=null;
  const stop=()=>{for(const track of stream?.getTracks()||[])track.stop();stream=null;};
  async function start(){stop();status.textContent=word('Starting camera…');try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080}},audio:kind==='video'});live.srcObject=stream;await live.play().catch(()=>{});status.textContent='';const cameras=(await navigator.mediaDevices.enumerateDevices().catch(()=>[])).filter(device=>device.kind==='videoinput');flip.hidden=cameras.length<2;}catch(error){status.textContent=error?.name==='NotAllowedError'?word('Camera access was blocked. Allow the camera in your browser settings, then try again.'):word('No camera is available on this device.');shoot.disabled=true;flip.hidden=true;}}
  function showLive(){live.hidden=false;still.hidden=true;replay.hidden=true;shoot.hidden=false;retake.hidden=use.hidden=true;blob=null;}
  flip.onclick=()=>{facing=facing==='environment'?'user':'environment';start();};
  shoot.onclick=()=>{
   if(kind==='photo'){const canvas=node('canvas');canvas.width=live.videoWidth||1280;canvas.height=live.videoHeight||720;canvas.getContext('2d').drawImage(live,0,0,canvas.width,canvas.height);canvas.toBlob(value=>{if(!value){status.textContent=word('Unable to take the photo. Try again.');return;}blob=new File([value],'camera-photo-'+stamp()+'.jpg',{type:'image/jpeg'});still.src=URL.createObjectURL(blob);live.hidden=true;still.hidden=false;shoot.hidden=true;retake.hidden=use.hidden=false;use.focus();},'image/jpeg',.88);return;}
   if(recorder?.state==='recording'){recorder.stop();return;}
   const format=videoType();chunks=[];try{recorder=new MediaRecorder(stream,{...(format.type?{mimeType:format.type}:{}),videoBitsPerSecond:2500000});}catch{status.textContent=word('This browser can’t record video.');return;}
   recorder.ondataavailable=event=>{if(event.data?.size)chunks.push(event.data);};
   recorder.onstop=()=>{clearInterval(tick);timer.hidden=true;shoot.textContent=word('Start recording');const type=recorder.mimeType||format.type||'video/webm',ext=/mp4/.test(type)?'mp4':'webm';blob=new File(chunks,'camera-video-'+stamp()+'.'+ext,{type:type.split(';')[0]});if(blob.size>25000000){status.textContent=word('That video is over 25 MB. Record a shorter clip.');blob=null;return;}replay.src=URL.createObjectURL(blob);live.hidden=true;replay.hidden=false;shoot.hidden=true;retake.hidden=use.hidden=false;use.focus();};
   recorder.start(1000);const began=Date.now();timer.hidden=false;timer.textContent='0:00';shoot.textContent=word('Stop recording');tick=setInterval(()=>{const seconds=Math.floor((Date.now()-began)/1000);timer.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');if(seconds>=maxSeconds&&recorder.state==='recording')recorder.stop();},250);
  };
  retake.onclick=()=>{if(still.src)URL.revokeObjectURL(still.src);if(replay.src)URL.revokeObjectURL(replay.src);showLive();};
  use.onclick=()=>{result=blob;dialog.close();};
  close.onclick=()=>dialog.close();
  return new Promise(resolve=>{dialog.addEventListener('close',()=>{clearInterval(tick);if(recorder?.state==='recording'){recorder.onstop=null;recorder.stop();}stop();if(still.src)URL.revokeObjectURL(still.src);if(replay.src)URL.revokeObjectURL(replay.src);dialog.remove();resolve(result);},{once:true});dialog.showModal();start();});
 }
 window.cameraCapture={photo:options=>capture('photo',options),video:options=>capture('video',options),supported,available:()=>supported()||/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||navigator.maxTouchPoints>1};
})();
