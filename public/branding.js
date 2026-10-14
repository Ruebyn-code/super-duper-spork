const brandImageUrls=new Map();
async function refreshLogo(){await Promise.all(['/logo','/sidebar-logo'].map(async path=>{try{const brands=[...document.querySelectorAll('.brand')].filter(brand=>Boolean(brand.closest('#app-sidebar,.mobile-brand-header'))===(path==='/sidebar-logo'));if(!brands.length)return;const response=await fetch(companyAssetUrl(path),{headers:companyHeaders()});if(!response.ok){if(response.status===404)for(const brand of brands)brand.textContent=typeof interfaceLabel==='function'?interfaceLabel('Souvlaki Gr ordering'):'Souvlaki Gr ordering';return;}const source=URL.createObjectURL(await response.blob());for(const brand of brands){const image=document.createElement('img');image.src=source;image.alt='Souvlaki GR';image.className='app-logo';brand.setAttribute('aria-label','Souvlaki Gr ordering — home');brand.replaceChildren(image);}if(brandImageUrls.has(path))URL.revokeObjectURL(brandImageUrls.get(path));brandImageUrls.set(path,source);}catch{}}));}
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
 let style=document.getElementById('appearance-style');if(!style){style=document.createElement('style');style.id='appearance-style';document.head.append(style);}if(style.textContent!==css)style.textContent=css;
}
async function refreshAppearance(){try{const response=await fetch('/appearance',{headers:companyHeaders()});if(response.ok)applyAppearance(await response.json());}catch{}}
if(!document.getElementById('appearance-style'))refreshAppearance();
