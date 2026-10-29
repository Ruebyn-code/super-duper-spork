const brandImageUrls=new Map();
async function refreshLogo(){
 await Promise.all(['/logo','/sidebar-logo'].map(async path=>{try{
  const brands=[...document.querySelectorAll('.brand')].filter(brand=>Boolean(brand.closest('#app-sidebar,.mobile-brand-header'))===(path==='/sidebar-logo'));if(!brands.length)return;
  const response=await fetch(companyAssetUrl(path),{headers:companyHeaders()});
  if(!response.ok){if(response.status===404)for(const brand of brands){const visual=brand.querySelector('.company-logo-visual')||brand;visual.textContent=brand.matches('.company-logo-trigger')?window.appCompanyName:(typeof interfaceLabel==='function'?interfaceLabel('Opstack'):'Opstack');}return;}
  const source=URL.createObjectURL(await response.blob());for(const brand of brands){const image=document.createElement('img');image.src=source;image.alt=response.headers.get('X-Branding-Scope')==='platform'?'Opstack':window.appCompanyName||'Opstack';image.className='app-logo';const visual=brand.querySelector('.company-logo-visual')||brand,previous=visual.querySelector('img');if(previous?.dataset.editId)image.dataset.editId=previous.dataset.editId;else if(brand.dataset.editId&&typeof appEditParts==='object')image.dataset.editId=appEditParts.childIdentity(brand.dataset.editId,['img:0']);image.dataset.appPart='logo';if(!brand.matches('.company-logo-trigger'))brand.setAttribute('aria-label','Opstack — home');visual.replaceChildren(image);}
  if(brandImageUrls.has(path))URL.revokeObjectURL(brandImageUrls.get(path));brandImageUrls.set(path,source);
 }catch{}}));
 window.dispatchEvent(new Event('app-logo-updated'));
}
if(window.appBootstrap?.hasLogo===undefined)refreshLogo();

const appearanceFonts=appearanceStyles.fonts;
function applyFontLibrary(library){
 appearanceStyles.registerFonts(library);window.appBootstrap.fontLibrary=library;
 let style=document.getElementById('uploaded-font-faces');if(!style){style=document.createElement('style');style.id='uploaded-font-faces';document.head.append(style);}style.textContent=appearanceStyles.fontFaces(undefined,window.appCompanyId);
 window.dispatchEvent(new Event('font-library-updated'));
 if(typeof applyElementOverrides==='function')applyElementOverrides();
}
function applyAppearance(settings){
 const css=appearanceStyles.build(settings);if(!css)return;
 const surfaceStyle=settings.surfaceStyle==='liquid-glass'?'liquid-glass':'standard',surfaceChanged=document.documentElement.dataset.surfaceStyle!==surfaceStyle;document.documentElement.dataset.surfaceStyle=surfaceStyle;
 let style=document.getElementById('appearance-style');if(!style){style=document.createElement('style');style.id='appearance-style';document.head.append(style);}const changed=style.textContent!==css;if(changed)style.textContent=css;if(changed||surfaceChanged)window.dispatchEvent(new Event('app-appearance-updated'));
}
async function refreshAppearance(){try{const response=await fetch('/appearance',{headers:companyHeaders()});if(response.ok)applyAppearance(await response.json());}catch{}}
if(!document.getElementById('appearance-style'))refreshAppearance();
