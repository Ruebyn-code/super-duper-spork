(()=>{
 const form=document.getElementById('font-upload-form');if(!form)return;
 const field=document.getElementById('font-upload-file'),name=document.getElementById('font-upload-name'),save=document.getElementById('font-upload-save'),message=document.getElementById('font-upload-message'),preview=document.getElementById('font-upload-preview');
 let selectedFile=null,previewFace=null,generation=0,automaticName='',saving=false;
 const wording=text=>typeof interfaceLabel==='function'?interfaceLabel(text):text;
 function refreshSelectors(){const labels=appearanceStyles.fontLabels();document.querySelectorAll('#font-settings select').forEach(select=>{const existing=new Set([...select.options].map(option=>option.value));for(const [value,text] of Object.entries(labels))if(!existing.has(value)){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}});}
 function renderLibrary(){
  const container=document.getElementById('uploaded-font-list');container.replaceChildren();
  const library=window.appBootstrap?.fontLibrary||[];
  if(!library.length){const empty=document.createElement('p');empty.className='small';empty.textContent=wording('No additional fonts uploaded yet.');container.append(empty);return;}
  for(const font of library){
   const row=document.createElement('div');row.className='uploaded-font-row';
   const details=document.createElement('div'),title=document.createElement('strong'),info=document.createElement('p'),button=document.createElement('button');title.textContent=font.name;title.dataset.userText='';info.className='small';info.textContent=font.extension.toUpperCase()+' · '+Math.ceil(font.size/1000)+' KB';info.dataset.userText='';details.append(title,info);button.type='button';button.textContent=wording('Preview font');
   button.onclick=()=>{const savedPreview=document.getElementById('font-library-preview');savedPreview.style.fontFamily=appearanceStyles.fonts[font.id];savedPreview.hidden=false;document.getElementById('font-library-preview-caption').textContent=font.name;};row.append(details,button);container.append(row);
  }
 }
 field.onchange=async()=>{
  const version=++generation,file=field.files[0];selectedFile=null;save.disabled=true;message.textContent='';preview.hidden=true;document.getElementById('font-preview-caption').textContent='';
  if(previewFace){document.fonts.delete(previewFace);previewFace=null;}
  if(!file)return;
  const derived=file.name.replace(/\.(ttf|otf|woff2?)$/i,'').slice(0,80);if(!name.value||name.value===automaticName)name.value=derived;automaticName=derived;
  try{
   if(!/\.(ttf|otf|woff2?)$/i.test(file.name)||file.size>2000000||!file.size)throw Error('Choose a TTF, OTF, WOFF or WOFF2 font up to 2 MB.');
   const face=await new FontFace('Upload_preview_'+version,await file.arrayBuffer()).load();if(version!==generation)return;
   previewFace=face;document.fonts.add(face);preview.style.fontFamily='"'+face.family+'"';preview.hidden=false;document.getElementById('font-preview-caption').textContent=file.name;selectedFile=file;save.disabled=false;
  }catch(error){if(version===generation)message.textContent=error.message.startsWith('Choose a ')?error.message:'This font could not be opened. Choose a valid font file.';}
 };
 form.onsubmit=async event=>{
  event.preventDefault();if(!selectedFile||saving)return;saving=true;const file=selectedFile,controls=[...form.querySelectorAll('input,button')];controls.forEach(control=>control.disabled=true);message.textContent=wording('Uploading font…');
  try{
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read this font.'));reader.readAsDataURL(file);});
   const result=await api('/api/fonts','POST',{name:name.value,fileName:file.name,data});
   applyFontLibrary(await api('/api/fonts','GET'));
   preview.style.fontFamily=appearanceStyles.fonts[result.font.id];preview.hidden=false;document.getElementById('font-preview-caption').textContent=result.font.name;
   generation++;selectedFile=null;form.reset();automaticName='';message.textContent=wording(result.alreadyExists?'This font is already in your library.':'Font uploaded. Choose it for a part of the app, then save app settings.');
   if(previewFace){document.fonts.delete(previewFace);previewFace=null;}
  }catch(error){message.textContent=error.message;}
  finally{saving=false;controls.forEach(control=>control.disabled=false);save.disabled=!selectedFile;}
 };
 window.addEventListener('font-library-updated',()=>{refreshSelectors();renderLibrary();});
 refreshSelectors();renderLibrary();
})();
