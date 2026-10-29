const $=id=>document.getElementById(id);let csrf='';
const defaults=window.appNetworkAppearanceDefaults||{surfaceStyle:'standard',primary:'#0d74c0',secondary:'#e27925',fonts:{body:'arial',appName:'opsilon',greeting:'opsilon',headings:'opsilon',stockNames:'opsilon',buttons:'opsilon',labels:'arial',inputs:'arial',navigation:'arial'}};
let retainedFonts,appearanceSaving=false;
function fill(settings){retainedFonts??=settings.fonts;$('primary-colour').value=settings.primary;$('secondary-colour').value=settings.secondary;$('surface-style').value=settings.surfaceStyle==='liquid-glass'?'liquid-glass':'standard';window.locationPickers?.refresh($('surface-style'));updateColourLabels();}
function updateColourLabels(){$('primary-value').textContent=$('primary-colour').value;$('secondary-value').textContent=$('secondary-colour').value;updateSurfacePreview();}
function updateSurfacePreview(){const preview=$('surface-style-preview');preview.dataset.previewStyle=$('surface-style').value;preview.style.setProperty('--primary',$('primary-colour').value);preview.style.setProperty('--secondary',$('secondary-colour').value);$('surface-style-preview-name').textContent=$('surface-style').value==='liquid-glass'?'Liquid Glass':'Standard';}
$('surface-style').onchange=()=>{updateSurfacePreview();$('settings-message').textContent='Preview selected. Save app settings to apply it.';};
$('primary-colour').oninput=updateColourLabels;$('secondary-colour').oninput=updateColourLabels;
async function api(url,method,body){const response=await fetch(url,{method,headers:{...companyHeaders(),...(window.appLocationId?{'X-Location-Id':window.appLocationId}:{}),'Content-Type':'application/json','X-CSRF-Token':csrf},body:body===undefined?undefined:JSON.stringify(body)});if(response.status===401){location.href=companyLoginUrl();throw Error('Please sign in again.');}const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to save changes.');return data;}
$('settings-reset').onclick=()=>{fill(defaults);$('settings-message').textContent='Defaults selected. Click Save app settings to apply them.';};
$('appearance-form').onsubmit=async event=>{event.preventDefault();if(appearanceSaving)return;appearanceSaving=true;const controls=[...event.target.querySelectorAll('input,select,button')],disabled=controls.map(control=>control.disabled);controls.forEach(control=>control.disabled=true);try{const settings={primary:$('primary-colour').value,secondary:$('secondary-colour').value,fonts:retainedFonts||defaults.fonts,surfaceStyle:$('surface-style').value};const saved=await api('/api/settings','PUT',settings);applyAppearance(saved);if(window.appPlatformAppearance){signinSettings.primary=saved.primary;signinSettings.secondary=saved.secondary;refreshSigninPreview();}$('settings-message').textContent='App settings saved. Refresh other open pages to see your changes.';}catch(error){$('settings-message').textContent=error.message;}finally{appearanceSaving=false;controls.forEach((control,index)=>control.disabled=disabled[index]);}};
$('logout').onclick=async()=>{try{await api('/api/logout','POST');location.href=companyLoginUrl();}catch(error){$('settings-message').textContent=error.message;}};
(async()=>{try{const session=await api('/api/session','GET');if(!appAccess.can('appearance.manage',session)){location.href=session.csrf?'/':companyLoginUrl();return;}csrf=session.csrf;const saved=await api('/appearance','GET');fill(saved);if(session.opstackManaged&&!window.appPlatformAppearance){const platformLink=$('platform-appearance-link');if(platformLink)platformLink.closest('p').hidden=true;const signinForm=$('signin-background-form');if(signinForm){const panel=signinForm.closest('[data-admin-views]');panel.remove();}for(const link of document.querySelectorAll('a[href$="#sign-in"]')){link.remove();}}if(appAccess.can('network.access',session)&&(!session.opstackManaged||window.appPlatformAppearance))fillSigninBackground(window.appPlatformAppearance?saved:await api('/appearance?platform=1','GET'));}catch(error){$('settings-message').textContent=error.message;}})();
if($('logo-form'))$('logo-form').onsubmit=async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;try{const file=$('logo-file').files[0];if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size>2000000)throw Error('Choose a PNG or JPG smaller than 2 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read this image.'));reader.readAsDataURL(file);});await api('/api/logo','POST',{data});await refreshLogo();await loadLogoPreview();await loadSidebarLogoPreview();$('logo-message').textContent='Logo saved. Refresh any other open app pages to see it.';event.target.reset();}catch(error){$('logo-message').textContent=error.message;}finally{button.disabled=false;}};


let logoPreviewUrl='';
async function loadLogoPreview(){try{const response=await fetch(companyAssetUrl('/logo'),{headers:companyHeaders()});if(!response.ok)return;if(logoPreviewUrl)URL.revokeObjectURL(logoPreviewUrl);logoPreviewUrl=URL.createObjectURL(await response.blob());$('logo-preview').src=logoPreviewUrl;$('logo-preview').alt='Current app logo';$('logo-preview').hidden=false;$('logo-preview-caption').textContent='Current saved logo';}catch{}}
$('logo-file').onchange=()=>{const file=$('logo-file').files[0];if(!file){loadLogoPreview();return;}if(!['image/png','image/jpeg'].includes(file.type)||file.size>2000000){$('logo-message').textContent='Choose a PNG or JPG smaller than 2 MB.';$('logo-file').value='';loadLogoPreview();return;}if(logoPreviewUrl)URL.revokeObjectURL(logoPreviewUrl);logoPreviewUrl=URL.createObjectURL(file);$('logo-preview').src=logoPreviewUrl;$('logo-preview').alt='Selected logo preview';$('logo-preview').hidden=false;$('logo-preview-caption').textContent='Selected: '+file.name+' — click Save logo to apply.';$('logo-message').textContent='';};
loadLogoPreview();

let sidebarLogoPreviewUrl='',sidebarLogoPreviewGeneration=0;
function showSidebarLogoPreview(source,caption){if(sidebarLogoPreviewUrl)URL.revokeObjectURL(sidebarLogoPreviewUrl);sidebarLogoPreviewUrl=source;$('sidebar-logo-preview').src=source;$('sidebar-logo-preview').hidden=!source;$('sidebar-logo-preview-caption').textContent=caption;}
async function loadSidebarLogoPreview(){const generation=++sidebarLogoPreviewGeneration;try{const response=await fetch(companyAssetUrl('/sidebar-logo'),{headers:companyHeaders()});const blob=response.ok?await response.blob():null;if(generation!==sidebarLogoPreviewGeneration)return;showSidebarLogoPreview(blob?URL.createObjectURL(blob):'',blob?'Current saved sidebar logo':'No logo saved yet.');}catch{}}
$('sidebar-logo-file').onchange=()=>{sidebarLogoPreviewGeneration++;const file=$('sidebar-logo-file').files[0];if(!file){loadSidebarLogoPreview();return;}if(!['image/png','image/jpeg'].includes(file.type)||file.size>2000000){$('sidebar-logo-message').textContent='Choose a PNG or JPG smaller than 2 MB.';$('sidebar-logo-file').value='';loadSidebarLogoPreview();return;}showSidebarLogoPreview(URL.createObjectURL(file),'Selected: '+file.name+' — click Save sidebar logo to apply.');$('sidebar-logo-message').textContent='';};
async function saveSidebarLogo(reset=false){const controls=[...$('sidebar-logo-form').querySelectorAll('input,button')];controls.forEach(control=>control.disabled=true);try{if(reset){await api('/api/sidebar-logo','DELETE');}else{const file=$('sidebar-logo-file').files[0];if(!file||!['image/png','image/jpeg'].includes(file.type)||file.size>2000000)throw Error('Choose a PNG or JPG smaller than 2 MB.');const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read this image.'));reader.readAsDataURL(file);});await api('/api/sidebar-logo','POST',{data});}await refreshLogo();await loadSidebarLogoPreview();$('sidebar-logo-form').reset();$('sidebar-logo-message').textContent=reset?'The sidebar now uses the app logo.':'Sidebar logo saved. Refresh other open pages to see it.';}catch(error){$('sidebar-logo-message').textContent=error.message;}finally{controls.forEach(control=>control.disabled=false);}}
$('sidebar-logo-form').onsubmit=event=>{event.preventDefault();saveSidebarLogo();};
$('sidebar-logo-reset').onclick=()=>saveSidebarLogo(true);
loadSidebarLogoPreview();

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
  const saved=await api('/api/settings?platform=1','PATCH',change);if(window.appPlatformAppearance)applyAppearance(saved);fillSigninBackground(saved);$('signin-background-message').textContent='Sign-in background saved.';
 }catch(error){$('signin-background-message').textContent=error.message;}
 finally{signinSaving=false;controls.forEach((element,index)=>element.disabled=disabled[index]);refreshSigninPreview();}
};

const companyNotice=document.getElementById('settings-company-name');if(companyNotice)companyNotice.textContent=window.appCompanyName;const signinLink=document.getElementById('app-signin-link');if(signinLink)signinLink.href='/login';if(window.appPlatformAppearance){if(companyNotice)companyNotice.closest('p').textContent='Opstack platform appearance. These settings apply to the shared sign-in and default logos across the network.';document.querySelector('main h1').textContent='Opstack appearance';document.querySelector('[data-edit-id="settings-62"]').textContent='These platform logos appear on the shared sign-in and in companies that have not uploaded their own logos.';document.getElementById('platform-appearance-link').closest('p').hidden=true;}
