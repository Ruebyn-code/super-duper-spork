window.createOpsStepFields=({ui,data,field,input,choices,onChange,upload,status,uploading})=>{
 const model=opsStepModel,el=(tag,cls)=>{const node=document.createElement(tag);if(cls)node.className=cls;return node;};
 const button=(key,action)=>{const node=ui('button',key);node.type='button';node.onclick=action;return node;};
 function render(step,answer,{readonly,run}){
  const host=el('div','ops-step-control');let read,inspect=()=>answer;
  const accessible=node=>{node.id='ops-answer-'+step.id;node.setAttribute('aria-label',step.title);node.disabled=readonly;return node;};
  if(step.type==='number'){
   const control=accessible(input('text')),wrap=el('div','ops-number-entry');let value=answer??null,invalid=false;control.inputMode=step.format==='integer'?'numeric':'decimal';control.placeholder=model.formatNumber(step,0);
   function parse(){const raw=control.value.trim().replace(/,/g,'');invalid=raw!==''&&!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw);value=raw===''?null:invalid?null:Number(raw);if(value!==null&&!model.validNumber(step,value))invalid=true;control.setAttribute('aria-invalid',String(invalid));}
   function format(){if(!invalid)control.value=model.formatNumber(step,value);}
   control.onfocus=()=>{if(!invalid)control.value=value===null?'':String(value);};control.oninput=()=>{parse();onChange();};control.onblur=format;format();wrap.append(control);host.append(wrap);
   const limits=[];if(step.min!=null)limits.push('Min '+model.formatNumber(step,step.min));if(step.max!=null)limits.push('Max '+model.formatNumber(step,step.max));if(limits.length)host.append(data('p',limits.join(' · '),'ops-help'));
   inspect=()=>invalid?NaN:value;read=({focus=false}={})=>{if(invalid){if(focus)control.focus();throw Error('Enter a number matching the format and limits for '+step.title+'.');}return value;};
  }
  if(step.type==='datetime'){
   const control=accessible(input(step.dateMode==='date'?'date':step.dateMode==='time'?'time':'datetime-local',answer));host.append(control);if(step.dateMode==='datetime')host.append(ui('p','Dates and times use Australia/Melbourne.','ops-help'));read=()=>control.value||null;inspect=read;
  }
  if(step.type==='selection'){
   const values=Array.isArray(answer)?answer:answer?[answer]:[],available=(run.selectionOptions?.[step.id]||[]).map(option=>({...option})),saved=run.selectionLabels?.[step.id]||{};
   for(const value of values)if(!available.some(option=>option.value===value)&&saved[value])available.push({value,label:saved[value]});
   if(readonly){const pills=el('div','ops-options');for(const value of values)pills.append(data('span',saved[value]||available.find(option=>option.value===value)?.label||value,'ops-badge'));host.append(pills);}
   else{const control=accessible(el('select'));control.multiple=step.multiple;choices(control,[...(!step.multiple?[['','Choose an option']]:[]),...available.map(option=>[option.value,option.label])],step.multiple?'':answer||'');if(step.multiple)for(const option of control.options)option.selected=values.includes(option.value);host.append(control);if(!available.length)host.append(ui('p','No selections are available for this location.','ops-help'));control.onchange=onChange;read=()=>step.multiple?[...control.selectedOptions].map(option=>option.value):control.value||null;inspect=read;}
  }
  if(['media','file'].includes(step.type)){
   let ids=Array.isArray(answer)?[...answer]:[];const files=el('div','ops-submissions');host.append(files);
   function list(){files.replaceChildren();for(const id of ids){const asset=run.resources?.[id];if(!asset)continue;const row=el('div','ops-submission');if(asset.mime.startsWith('image/')){const image=el('img','ops-photo');image.src=asset.url;image.alt=asset.name;row.append(image);}else if(asset.mime.startsWith('video/')){const video=el('video','ops-video');video.controls=true;video.playsInline=true;video.preload='metadata';video.src=asset.url;row.append(video);}const link=data('a',asset.name,'ops-file-link');link.href=asset.url;link.target='_blank';link.rel='noopener';row.append(link,data('small',(asset.size/1000000).toFixed(2)+' MB'));if(!readonly)row.append(button('Remove file',()=>{ids=ids.filter(value=>value!==id);list();onChange();}));files.append(row);}}
   list();if(!readonly){const control=accessible(input('file'));control.multiple=step.maxFiles>1;const photos='.png,.jpg,.jpeg,.gif,.webp',videos='.mp4,.webm,.mov';control.accept=step.type==='file'?photos+','+videos+',.pdf,.txt,.csv,.docx,.xlsx,.pptx,.zip,.mp3,.m4a,.wav,.ogg':step.mediaKind==='photo'?photos:step.mediaKind==='video'?videos:photos+','+videos;
    control.onchange=async()=>{const selected=[...control.files];if(!selected.length)return;if(ids.length+selected.length>step.maxFiles){status('This step allows up to '+step.maxFiles+' files.',true);control.value='';return;}if(selected.some(file=>file.size>(/\.(mp4|webm|mov)$/i.test(file.name)?25000000:10000000))){status('Files can be up to 10 MB; videos up to 25 MB.',true);control.value='';return;}
     control.disabled=true;files.inert=true;uploading(1);status('Uploading files…');try{for(const file of selected){const asset=await upload(step.id,file);run.resources||={};run.resources[asset.id]=asset;ids.push(asset.id);onChange();}status('Files uploaded. Saving automatically…');}catch(error){status(error.message,true);}finally{list();control.disabled=false;files.inert=false;control.value='';uploading(-1);}
    };host.append(control,ui('p','Files up to 10 MB; videos up to 25 MB.','ops-help'));}
   read=()=>ids;inspect=read;
  }
  if(step.type==='signature'){
   const saved=answer&&typeof answer==='object'?answer:null,name=accessible(input('text',saved?.name??answer??'',500));let assetId=saved?.assetId||null,ink=false,pen=false,inkVersion=0,mode=step.signatureMode==='drawn'||assetId?'drawn':'typed';host.append(field('Signer name',name));name.oninput=onChange;
   const tools=el('div','ops-signature-tools'),drawing=el('div','ops-signature-drawing'),canvas=el('canvas','ops-signature-canvas'),image=el('img','ops-signature-image');canvas.width=1000;canvas.height=260;canvas.setAttribute('aria-label','Draw your signature');image.alt='Saved signature';const context=canvas.getContext('2d');context.lineWidth=3;context.lineCap='round';context.strokeStyle='#172c3c';
   function display(){drawing.hidden=mode!=='drawn';canvas.hidden=Boolean(assetId);image.hidden=!assetId;if(assetId)image.src=run.resources?.[assetId]?.url||'/api/ops-management/media/'+assetId;}
   if(!readonly){if(step.signatureMode==='either'){const typed=button('Type name',()=>{mode='typed';display();onChange();}),draw=button('Draw signature',()=>{mode='drawn';display();onChange();});tools.append(typed,draw);}const clear=button('Clear signature',()=>{inkVersion++;assetId=null;ink=false;context.clearRect(0,0,canvas.width,canvas.height);display();onChange();});drawing.append(clear);}
   const point=event=>{const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};};
   canvas.onpointerdown=event=>{if(readonly||event.button!==0)return;event.preventDefault();pen=true;inkVersion++;canvas.setPointerCapture(event.pointerId);const{x,y}=point(event);context.beginPath();context.moveTo(x,y);context.lineTo(x+.1,y+.1);context.stroke();ink=true;onChange();};canvas.onpointermove=event=>{if(!pen)return;inkVersion++;const{x,y}=point(event);context.lineTo(x,y);context.stroke();};canvas.onpointerup=canvas.onpointercancel=()=>{if(pen){pen=false;onChange();}};drawing.prepend(canvas,image);host.append(tools,drawing);display();
   if(readonly){tools.hidden=true;canvas.hidden=true;name.disabled=true;}
   inspect=()=>mode==='typed'?name.value.trim()||null:assetId?{name:name.value,assetId}:ink?{name:name.value,drawn:true}:null;
   read=async()=>{if(mode==='typed')return name.value.trim()||null;if(pen)throw Error('Finish drawing your signature to save automatically.');if((ink||assetId)&&!name.value.trim())throw Error('Add the signer name to save the signature.');if(!ink&&!assetId){if(name.value.trim())throw Error('Draw or clear the signature to save automatically.');return null;}const signer=name.value;if(ink){const version=inkVersion,blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Unable to save the signature.');const asset=await upload(step.id,new File([blob],'signature.png',{type:'image/png'}));run.resources||={};run.resources[asset.id]=asset;if(version===inkVersion&&mode==='drawn'){assetId=asset.id;ink=false;display();}return{name:signer,assetId:asset.id};}return{name:signer,assetId};};
  }
  return{host,read,inspect};
 }
 return{render};
};
