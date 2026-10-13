async function refreshLogo(){try{const response=await fetch('/logo');if(!response.ok)return;const blob=await response.blob();const source=URL.createObjectURL(blob);for(const brand of document.querySelectorAll('.brand')){const image=document.createElement('img');image.src=source;image.alt='Souvlaki GR';image.className='app-logo';brand.setAttribute('aria-label','Souvlaki Gr ordering — home');brand.replaceChildren(image);}}catch{}}
if(window.appBootstrap?.hasLogo===undefined)refreshLogo();

const appearanceFonts=appearanceStyles.fonts;
function applyAppearance(settings){
 const css=appearanceStyles.build(settings);if(!css)return;
 let style=document.getElementById('appearance-style');if(!style){style=document.createElement('style');style.id='appearance-style';document.head.append(style);}if(style.textContent!==css)style.textContent=css;
}
async function refreshAppearance(){try{const response=await fetch('/appearance');if(response.ok)applyAppearance(await response.json());}catch{}}
if(!document.getElementById('appearance-style'))refreshAppearance();
