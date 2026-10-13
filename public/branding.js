async function refreshLogo(){try{const response=await fetch('/logo');if(!response.ok)return;const blob=await response.blob();const source=URL.createObjectURL(blob);for(const brand of document.querySelectorAll('.brand')){const image=document.createElement('img');image.src=source;image.alt='Souvlaki GR';image.className='app-logo';brand.setAttribute('aria-label','Souvlaki Gr ordering — home');brand.replaceChildren(image);}}catch{}}
refreshLogo();

const appearanceFonts={opsilon:"'Opsilon',sans-serif",arial:'Arial,Helvetica,sans-serif',verdana:'Verdana,sans-serif',georgia:'Georgia,serif',trebuchet:"'Trebuchet MS',sans-serif",monospace:'monospace'};
function applyAppearance(settings){
 if(!/^#[0-9a-f]{6}$/i.test(settings.primary)||!/^#[0-9a-f]{6}$/i.test(settings.secondary))return;
 document.documentElement.style.setProperty('--primary',settings.primary);document.documentElement.style.setProperty('--secondary',settings.secondary);document.documentElement.style.setProperty('--primary-hover','color-mix(in srgb, '+settings.primary+' 80%, black)');
 const selectors={body:'body',appName:'.brand',greeting:'#user-greeting',headings:'h1,h2,h3',stockNames:'.product h3,.stock-name,.cart-row>strong',buttons:'button,.product-bottom button,.submit,.admin-dropdown summary',labels:'label,.badge,.eyebrow',inputs:'input,textarea,select,.password-control .password-input,.login-page input[type=password],#account-form input[type=password]',navigation:'.header-link,.admin-nav a,.admin-dropdown nav a'};
 let css='';for(const part of ['body','headings','appName','greeting','stockNames','buttons','labels','inputs','navigation']){const font=settings.fonts?.[part];if(!Object.hasOwn(appearanceFonts,font))continue;css+=selectors[part]+'{font-family:'+appearanceFonts[font]+' !important;'+(['headings','greeting','stockNames'].includes(part)?'font-weight:'+(font==='opsilon'?400:600)+';':'')+'}';}
 let style=document.getElementById('appearance-style');if(!style){style=document.createElement('style');style.id='appearance-style';document.head.append(style);}style.textContent=css;
}
async function refreshAppearance(){try{const response=await fetch('/appearance');if(response.ok)applyAppearance(await response.json());}catch{}}
refreshAppearance();
