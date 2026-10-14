// One style builder for the initial HTML and later edits in the browser.
(function(root){
 const baseFonts={opsilon:"'Opsilon',sans-serif",arial:'Arial,Helvetica,sans-serif',verdana:'Verdana,sans-serif',georgia:'Georgia,serif',trebuchet:"'Trebuchet MS',sans-serif",monospace:'monospace'};
 const fonts={...baseFonts};let library=[];
 const baseLabels={opsilon:'Opsilon (your font)',arial:'Arial',verdana:'Verdana',georgia:'Georgia',trebuchet:'Trebuchet MS',monospace:'Monospace'};
 const formats={ttf:'truetype',otf:'opentype',woff:'woff',woff2:'woff2'};
 const isUploadedFont=value=>typeof value==='string'&&/^custom_[a-f0-9]{64}$/.test(value);
 const validFont=font=>isUploadedFont(font?.id)&&Object.hasOwn(formats,font.extension);
 const family=font=>'Uploaded_'+font.id.slice(7);
 function fontFamilies(uploaded=library){return {...baseFonts,...Object.fromEntries(uploaded.filter(validFont).map(font=>[font.id,"'"+family(font)+"',sans-serif"]))};}
 function fontLabels(uploaded=library){return {...baseLabels,...Object.fromEntries(uploaded.filter(validFont).map(font=>[font.id,String(font.name)+' (uploaded)']))};}
 function fontFaces(uploaded=library){return uploaded.filter(validFont).map(font=>'@font-face{font-family:"'+family(font)+'";src:url("/uploaded-fonts/'+font.id.slice(7)+'.'+font.extension+'") format("'+formats[font.extension]+'");font-weight:400;font-style:normal;font-display:block}').join('');}
 function registerFonts(uploaded){library=Array.isArray(uploaded)?uploaded.filter(validFont):[];for(const key of Object.keys(fonts))if(!Object.hasOwn(baseFonts,key))delete fonts[key];Object.assign(fonts,fontFamilies());return fontLabels();}
 const selectors={body:'body',appName:'.brand',greeting:'#user-greeting',headings:'h1,h2,h3',stockNames:'.product h3,.stock-name,.cart-row>strong',buttons:'button:not(.sidebar-signout),.product-bottom button,.submit,summary',labels:'label,.badge,.eyebrow',inputs:'input,textarea,select,.password-control .password-input,.login-page input[type=password],#account-form input[type=password]',navigation:'.header-link,.admin-nav a,.admin-dropdown nav a,.admin-sidebar a:not(.brand),.secondary-sidebar a,.sidebar-signout,#mobile-more'};
 const backgrounds={page:'html,body:not(.authentication-page)',panels:'.management,.cart-page>aside,.ordering-budget,.account-location-group,.location-row',cards:'.product',images:'.product-art',buttons:'button:not([data-copy-editor] button)',inputs:'input,textarea,select',greeting:'.hero',sidebar:'.app-shell>.admin-sidebar,.app-shell>.secondary-sidebar,.mobile-brand-header',signin:'.authentication-page'};
 const hex=value=>/^#[0-9a-f]{6}$/i.test(value||'');
 function parseColour(value){
  if(hex(value)||['primary','secondary'].includes(value))return {colour:value,opacity:1};
  if(typeof value==='string'&&/^#[0-9a-f]{8}$/i.test(value))return {colour:value.slice(0,7),opacity:parseInt(value.slice(7),16)/255};
  if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===2&&Object.hasOwn(value,'colour')&&Object.hasOwn(value,'opacity')&&(hex(value.colour)||['primary','secondary'].includes(value.colour))&&typeof value.opacity==='number'&&Number.isFinite(value.opacity)&&value.opacity>=0&&value.opacity<=1)return {colour:value.colour,opacity:value.opacity};
  return null;
 }
 const colour=value=>Boolean(parseColour(value));
 function colourValue(value){const parsed=parseColour(value);if(!parsed)return '';const base=['primary','secondary'].includes(parsed.colour)?'var(--'+parsed.colour+')':parsed.colour;return parsed.opacity===1?base:'color-mix(in srgb, '+base+' '+Number((parsed.opacity*100).toFixed(4))+'%, transparent)';}
 const resolveColour=(value,settings)=>{const parsed=parseColour(value);return parsed?(['primary','secondary'].includes(parsed.colour)?settings[parsed.colour]:parsed.colour):'';};
 const image=value=>/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value||'');
 function rule(selector,properties){return ':where('+selector+'){'+properties+'}';}
 function build(settings,uploaded=library){
  const families=fontFamilies(uploaded);
  if(!hex(settings?.primary)||!hex(settings?.secondary))return '';
  let css=':root{--primary:'+settings.primary+';--secondary:'+settings.secondary+';--primary-hover:color-mix(in srgb,'+settings.primary+' 80%,black)}';
  for(const part of ['body','headings','appName','greeting','stockNames','buttons','labels','inputs','navigation']){
   const font=settings.fonts?.[part];if(!Object.hasOwn(families,font))continue;
   const weight=(font==='opsilon'||isUploadedFont(font))?'font-weight:400!important;':['headings','greeting','stockNames'].includes(part)?'font-weight:600!important;':'';
   css+=rule(selectors[part],'font-family:'+families[font]+'!important;'+weight);
  }
  const colourSelectors={...selectors,body:'body,p,.description,.small,.info,.empty',greeting:'#user-greeting,#user-greeting *'};
  for(const part of ['body','headings','appName','greeting','stockNames','buttons','labels','inputs','navigation'])if(colour(settings.fontColours?.[part]))css+=rule(colourSelectors[part],'color:'+colourValue(settings.fontColours[part])+'!important');
  for(const [part,selector] of Object.entries(backgrounds)){
   if(colour(settings.backgrounds?.[part]))css+=rule(selector,'background-color:'+colourValue(settings.backgrounds[part])+'!important');
   if(image(settings.backgroundImages?.[part]))css+=rule(selector,'background-image:url("'+settings.backgroundImages[part]+'")!important;background-size:cover;background-position:center;background-repeat:no-repeat');
  }
  return css;
 }
 function buildElements(overrides,html,uploaded=library){
  const families=fontFamilies(uploaded);
  let css='';for(const [id,settings] of Object.entries(overrides||{})){
   if(!/^[a-zA-Z0-9_.:-]{1,240}$/.test(id)||!html.includes('data-edit-id="'+id+'"'))continue;
   let properties='';if(Object.hasOwn(families,settings.font))properties+='font-family:'+families[settings.font]+'!important;font-weight:'+((settings.font==='opsilon'||isUploadedFont(settings.font))?400:600)+'!important;';
   if(colour(settings.fontColour))properties+='color:'+colourValue(settings.fontColour)+'!important;';
   if(colour(settings.background))properties+='background-color:'+colourValue(settings.background)+'!important;';
   if(settings.backgroundImage==='')properties+='background-image:none!important;';
   if(image(settings.backgroundImage))properties+='background-image:url("'+settings.backgroundImage+'")!important;background-size:cover;background-position:center;background-repeat:no-repeat;';
   if(properties)css+='[data-edit-id="'+id+'"]{'+properties+'}';
  }return css;
 }
 const helpers={fonts,build,buildElements,colourValue,resolveColour,parseColour,colour,fontLabels,fontFaces,registerFonts,isUploadedFont};
 if(typeof module==='object'&&module.exports)module.exports=helpers;
 else{root.appearanceStyles=helpers;try{root.appBootstrap=JSON.parse(document.getElementById('app-bootstrap')?.textContent||'{}');}catch{root.appBootstrap={};}registerFonts(root.appBootstrap.fontLibrary||[]);}
})(globalThis);
