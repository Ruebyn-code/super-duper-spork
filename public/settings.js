const $=id=>document.getElementById(id);let csrf='';
const defaults={primary:'#0d74c0',secondary:'#e27925',fonts:{body:'arial',appName:'opsilon',greeting:'opsilon',headings:'opsilon',stockNames:'opsilon',buttons:'opsilon',labels:'arial',inputs:'arial',navigation:'arial'}};
const parts={body:'Body text & descriptions',appName:'App name',greeting:'Yassou & username',headings:'Page & section headings',stockNames:'Stock names',buttons:'Buttons & dropdown control',labels:'Form labels & captions',inputs:'Input fields',navigation:'Navigation links'};
const fonts=appearanceStyles.fontLabels();
for(const [part,title] of Object.entries(parts)){const label=document.createElement('label');label.textContent=title;const select=document.createElement('select');select.name=part;select.id='font-'+part;for(const [value,name] of Object.entries(fonts)){const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}label.append(select);$('font-settings').append(label);}
function fill(settings){$('primary-colour').value=settings.primary;$('secondary-colour').value=settings.secondary;for(const part of Object.keys(parts))$('font-'+part).value=settings.fonts[part];updateColourLabels();}
function updateColourLabels(){$('primary-value').textContent=$('primary-colour').value;$('secondary-value').textContent=$('secondary-colour').value;}
$('primary-colour').oninput=updateColourLabels;$('secondary-colour').oninput=updateColourLabels;
async function api(url,method,body){const response=await fetch(url,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href='/login';throw Error('Please sign in again.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save changes.');return data;}
$('settings-reset').onclick=()=>{fill(defaults);$('settings-message').textContent='Defaults selected. Click Save app settings to apply them.';};
$('appearance-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button[type=submit]');button.disabled=true;try{const settings={primary:$('primary-colour').value,secondary:$('secondary-colour').value,fonts:Object.fromEntries(Object.keys(parts).map(part=>[part,$('font-'+part).value]))};const saved=await api('/api/settings','PUT',settings);applyAppearance(saved);signinSettings.primary=saved.primary;signinSettings.secondary=saved.secondary;refreshSigninPreview();$('settings-message').textContent='App settings saved. Refresh other open pages to see your changes.';}catch(error){$('settings-message').textContent=error.message;}finally{button.disabled=false;}};
$('logout').onclick=async()=>{try{await api('/api/logout','POST');location.href='/login';}catch(error){$('settings-message').textContent=error.message;}};
(async()=>{try{const session=await api('/api/session','GET');if(session.role!=='admin'){location.href=session.csrf?'/':'/login';return;}csrf=session.csrf;await loadTextSettings();const saved=await api('/appearance','GET');fill(saved);fillSigninBackground(saved);}catch(error){$('settings-message').textContent=error.message;}})();
if($('logo-form'))$('logo-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const file=$('logo-file').files[0];if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size>2000000)throw Error('Choose a PNG or JPG smaller than 2 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read this image.'));reader.readAsDataURL(file);});await api('/api/logo','POST',{data});await refreshLogo();await loadLogoPreview();await loadSidebarLogoPreview();$('logo-message').textContent='Logo saved. Refresh any other open app pages to see it.';event.target.reset();}catch(error){$('logo-message').textContent=error.message;}finally{button.disabled=false;}};


let logoPreviewUrl='';
async function loadLogoPreview(){try{const response=await fetch('/logo');if(!response.ok)return;if(logoPreviewUrl)URL.revokeObjectURL(logoPreviewUrl);logoPreviewUrl=URL.createObjectURL(await response.blob());$('logo-preview').src=logoPreviewUrl;$('logo-preview').alt='Current app logo';$('logo-preview').hidden=false;$('logo-preview-caption').textContent='Current saved logo';}catch{}}
$('logo-file').onchange=()=>{const file=$('logo-file').files[0];if(!file){loadLogoPreview();return;}if(!['image/png','image/jpeg'].includes(file.type)||file.size>2000000){$('logo-message').textContent='Choose a PNG or JPG smaller than 2 MB.';$('logo-file').value='';loadLogoPreview();return;}if(logoPreviewUrl)URL.revokeObjectURL(logoPreviewUrl);logoPreviewUrl=URL.createObjectURL(file);$('logo-preview').src=logoPreviewUrl;$('logo-preview').alt='Selected logo preview';$('logo-preview').hidden=false;$('logo-preview-caption').textContent='Selected: '+file.name+' — click Save logo to apply.';$('logo-message').textContent='';};
loadLogoPreview();

let sidebarLogoPreviewUrl='',sidebarLogoPreviewGeneration=0;
function showSidebarLogoPreview(source,caption){if(sidebarLogoPreviewUrl)URL.revokeObjectURL(sidebarLogoPreviewUrl);sidebarLogoPreviewUrl=source;$('sidebar-logo-preview').src=source;$('sidebar-logo-preview').hidden=!source;$('sidebar-logo-preview-caption').textContent=caption;}
async function loadSidebarLogoPreview(){const generation=++sidebarLogoPreviewGeneration;try{const response=await fetch('/sidebar-logo');const blob=response.ok?await response.blob():null;if(generation!==sidebarLogoPreviewGeneration)return;showSidebarLogoPreview(blob?URL.createObjectURL(blob):'',blob?'Current saved sidebar logo':'No logo saved yet.');}catch{}}
$('sidebar-logo-file').onchange=()=>{sidebarLogoPreviewGeneration++;const file=$('sidebar-logo-file').files[0];if(!file){loadSidebarLogoPreview();return;}if(!['image/png','image/jpeg'].includes(file.type)||file.size>2000000){$('sidebar-logo-message').textContent='Choose a PNG or JPG smaller than 2 MB.';$('sidebar-logo-file').value='';loadSidebarLogoPreview();return;}showSidebarLogoPreview(URL.createObjectURL(file),'Selected: '+file.name+' — click Save sidebar logo to apply.');$('sidebar-logo-message').textContent='';};
async function saveSidebarLogo(reset=false){const controls=[...$('sidebar-logo-form').querySelectorAll('input,button')];controls.forEach(control=>control.disabled=true);try{if(reset){await api('/api/sidebar-logo','DELETE');}else{const file=$('sidebar-logo-file').files[0];if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size>2000000)throw Error('Choose a PNG or JPG smaller than 2 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read this image.'));reader.readAsDataURL(file);});await api('/api/sidebar-logo','POST',{data});}await refreshLogo();await loadSidebarLogoPreview();$('sidebar-logo-form').reset();$('sidebar-logo-message').textContent=reset?'The sidebar now uses the app logo.':'Sidebar logo saved. Refresh other open pages to see it.';}catch(error){$('sidebar-logo-message').textContent=error.message;}finally{controls.forEach(control=>control.disabled=false);}}
$('sidebar-logo-form').onsubmit=event=>{event.preventDefault();saveSidebarLogo();};
$('sidebar-logo-reset').onclick=()=>saveSidebarLogo(true);
loadSidebarLogoPreview();

async function loadTextSettings(){const settings=await api('/api/interface-text','GET');$('text-settings-fields').replaceChildren();for(const item of settings.labels){const row=document.createElement('div');row.className='text-setting-row';row.dataset.original=item.text;const caption=document.createElement('label');caption.textContent=item.text;const hint=document.createElement('small');hint.textContent=item.locations.join(', ');const field=document.createElement('input');field.className='text-setting-value';field.id='text-setting-'+$('text-settings-fields').children.length;caption.htmlFor=field.id;field.value=settings.overrides[item.text]??'';field.placeholder=item.text;field.maxLength=1000;const blank=document.createElement('input');blank.type='checkbox';blank.className='text-setting-blank';blank.checked=Object.hasOwn(settings.overrides,item.text)&&settings.overrides[item.text]===null;field.disabled=blank.checked;blank.onchange=()=>field.disabled=blank.checked;const blankLabel=document.createElement('label');blankLabel.className='leave-blank';blankLabel.append(blank,document.createTextNode(' Leave blank'));row.append(caption,hint,field,blankLabel);$('text-settings-fields').append(row);}}
$('text-search').oninput=()=>{const query=$('text-search').value.toLowerCase().trim();for(const row of $('text-settings-fields').children)row.hidden=!(row.dataset.original+' '+row.querySelector('.text-setting-value').value).toLowerCase().includes(query);};
$('text-defaults').onclick=()=>{for(const row of $('text-settings-fields').children){row.querySelector('.text-setting-value').value='';row.querySelector('.text-setting-value').disabled=false;row.querySelector('.text-setting-blank').checked=false;}$('text-settings-message').textContent='Original wording selected. Save to apply.';};
$('text-settings-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button[type=submit]');button.disabled=true;try{const entries=[...$('text-settings-fields').children].map(row=>[row.dataset.original,row.querySelector('.text-setting-blank').checked?null:row.querySelector('.text-setting-value').value]);await api('/api/interface-text','PUT',Object.fromEntries(entries));await refreshInterfaceText();$('text-settings-message').textContent='Interface text saved. Refresh other open pages to see it.';}catch(error){$('text-settings-message').textContent=error.message;}finally{button.disabled=false;}};


let signinSettings={},signinImageChange,signinImageGeneration=0,signinImageReading=false,signinSaving=false;
function signinColourValue(){return $('signin-colour-source').value==='custom'?$('signin-colour').value:$('signin-colour-source').value;}
function refreshSigninPreview(){
 const source=$('signin-colour-source').value;
 const colour=source==='custom'?$('signin-colour').value:(signinSettings[source]||defaults[source]);
 if(source!=='custom'){$('signin-colour').value=colour;$('signin-colour-hex').value=colour;}
 $('signin-colour').disabled=source!=='custom';$('signin-colour-hex').disabled=source!=='custom';
 const preview=$('signin-background-preview');preview.style.backgroundColor=colour;
 const image=signinImageChange===undefined?signinSettings.backgroundImages?.signin:signinImageChange;
 preview.style.backgroundImage=image?'url("'+image+'")':'none';$('signin-image-remove').disabled=!image||signinSaving;
}
function fillSigninBackground(settings){
 signinSettings=settings;signinImageChange=undefined;const colour=settings.backgrounds?.signin||'primary';
 $('signin-colour-source').value=['primary','secondary'].includes(colour)?colour:'custom';
 $('signin-colour').value=appearanceStyles.resolveColour(colour,settings);$('signin-colour-hex').value=$('signin-colour').value;
 $('signin-image').value='';$('signin-image-caption').textContent=settings.backgroundImages?.signin?'Saved background image.':'No background image selected.';refreshSigninPreview();
}
$('signin-colour-source').onchange=refreshSigninPreview;
$('signin-colour').oninput=()=>{$('signin-colour-hex').value=$('signin-colour').value;refreshSigninPreview();};
$('signin-colour-hex').oninput=()=>{if(/^#[0-9a-f]{6}$/i.test($('signin-colour-hex').value)){$('signin-colour').value=$('signin-colour-hex').value;refreshSigninPreview();}};
$('signin-image').onchange=async()=>{
 const generation=++signinImageGeneration,file=$('signin-image').files[0];if(!file){signinImageReading=false;$('signin-background-save').disabled=false;return;}
 signinImageReading=true;$('signin-background-save').disabled=true;
 try{
  if(!['image/png','image/jpeg'].includes(file.type)||file.size>2000000)throw Error('Choose a PNG or JPG under 2 MB.');
  const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Could not read this image.'));reader.readAsDataURL(file);});
  if(generation!==signinImageGeneration)return;signinImageChange=image;$('signin-image-caption').textContent='Selected: '+file.name+' — save to apply.';$('signin-background-message').textContent='';refreshSigninPreview();
 }catch(error){if(generation===signinImageGeneration){$('signin-image').value='';$('signin-background-message').textContent=error.message;}}
 finally{if(generation===signinImageGeneration){signinImageReading=false;$('signin-background-save').disabled=false;}}
};
function removeSigninImage(){signinImageGeneration++;signinImageReading=false;signinImageChange=null;$('signin-image').value='';$('signin-background-save').disabled=false;$('signin-image-caption').textContent='No background image selected. Save to apply.';refreshSigninPreview();}
$('signin-image-remove').onclick=removeSigninImage;
$('signin-background-reset').onclick=()=>{$('signin-colour-source').value='primary';removeSigninImage();$('signin-background-message').textContent='Primary colour and no image selected. Save to apply.';};
$('signin-background-form').onsubmit=async event=>{
 event.preventDefault();if(signinSaving||signinImageReading)return;signinSaving=true;$('signin-background-message').textContent='Saving sign-in background…';
 const controls=[...event.target.querySelectorAll('button,input,select')];const disabled=controls.map(element=>element.disabled);controls.forEach(element=>element.disabled=true);
 try{
  const change={backgrounds:{signin:signinColourValue()}};if(signinImageChange!==undefined)change.backgroundImages={signin:signinImageChange};
  const saved=await api('/api/settings','PATCH',change);applyAppearance(saved);fillSigninBackground(saved);$('signin-background-message').textContent='Sign-in background saved.';
 }catch(error){$('signin-background-message').textContent=error.message;}
 finally{signinSaving=false;controls.forEach((element,index)=>element.disabled=disabled[index]);refreshSigninPreview();}
};
