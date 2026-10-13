// One style builder for the initial HTML and later edits in the browser.
(function(root){
 const fonts={opsilon:"'Opsilon',sans-serif",arial:'Arial,Helvetica,sans-serif',verdana:'Verdana,sans-serif',georgia:'Georgia,serif',trebuchet:"'Trebuchet MS',sans-serif",monospace:'monospace'};
 const selectors={body:'body',appName:'.brand',greeting:'#user-greeting',headings:'h1,h2,h3',stockNames:'.product h3,.stock-name,.cart-row>strong',buttons:'button,.product-bottom button,.submit,summary',labels:'label,.badge,.eyebrow',inputs:'input,textarea,select,.password-control .password-input,.login-page input[type=password],#account-form input[type=password]',navigation:'.header-link,.admin-nav a,.admin-dropdown nav a,.admin-sidebar a:not(.brand)'};
 const backgrounds={page:'html,body:not(.authentication-page)',panels:'.management,.cart-page>aside,.ordering-budget,.account-location-group,.location-row',cards:'.product',images:'.product-art',buttons:'button:not([data-copy-editor] button)',inputs:'input,textarea,select',greeting:'.hero',sidebar:'.app-shell>.admin-sidebar',signin:'.authentication-page'};
 const hex=value=>/^#[0-9a-f]{6}$/i.test(value||'');
 const colour=value=>hex(value)||['primary','secondary'].includes(value);
 const colourValue=value=>colour(value)?(['primary','secondary'].includes(value)?'var(--'+value+')':value):'';
 const resolveColour=(value,settings)=>['primary','secondary'].includes(value)?settings[value]:value;
 const image=value=>/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(value||'');
 function rule(selector,properties){return ':where('+selector+'){'+properties+'}';}
 function build(settings){
  if(!hex(settings?.primary)||!hex(settings?.secondary))return '';
  let css=':root{--primary:'+settings.primary+';--secondary:'+settings.secondary+';--primary-hover:color-mix(in srgb,'+settings.primary+' 80%,black)}';
  for(const part of ['body','headings','appName','greeting','stockNames','buttons','labels','inputs','navigation']){
   const font=settings.fonts?.[part];if(!Object.hasOwn(fonts,font))continue;
   const weight=font==='opsilon'?'font-weight:400!important;':['headings','greeting','stockNames'].includes(part)?'font-weight:600!important;':'';
   css+=rule(selectors[part],'font-family:'+fonts[font]+'!important;'+weight);
  }
  const colourSelectors={...selectors,body:'body,p,.description,.small,.info,.empty',greeting:'#user-greeting,#user-greeting *'};
  for(const part of ['body','headings','appName','greeting','stockNames','buttons','labels','inputs','navigation'])if(colour(settings.fontColours?.[part]))css+=rule(colourSelectors[part],'color:'+colourValue(settings.fontColours[part])+'!important');
  for(const [part,selector] of Object.entries(backgrounds)){
   if(colour(settings.backgrounds?.[part]))css+=rule(selector,'background-color:'+colourValue(settings.backgrounds[part])+'!important');
   if(image(settings.backgroundImages?.[part]))css+=rule(selector,'background-image:url("'+settings.backgroundImages[part]+'")!important;background-size:cover;background-position:center;background-repeat:no-repeat');
  }
  return css;
 }
 function buildElements(overrides,html){
  let css='';for(const [id,settings] of Object.entries(overrides||{})){
   if(!/^[a-zA-Z0-9_.:-]{1,240}$/.test(id)||!html.includes('data-edit-id="'+id+'"'))continue;
   let properties='';if(Object.hasOwn(fonts,settings.font))properties+='font-family:'+fonts[settings.font]+'!important;font-weight:'+(settings.font==='opsilon'?400:600)+'!important;';
   if(colour(settings.fontColour))properties+='color:'+colourValue(settings.fontColour)+'!important;';
   if(colour(settings.background))properties+='background-color:'+colourValue(settings.background)+'!important;';
   if(settings.backgroundImage==='')properties+='background-image:none!important;';
   if(image(settings.backgroundImage))properties+='background-image:url("'+settings.backgroundImage+'")!important;background-size:cover;background-position:center;background-repeat:no-repeat;';
   if(properties)css+='[data-edit-id="'+id+'"]{'+properties+'}';
  }return css;
 }
 const helpers={fonts,build,buildElements,colourValue,resolveColour};
 if(typeof module==='object'&&module.exports)module.exports=helpers;
 else{root.appearanceStyles=helpers;try{root.appBootstrap=JSON.parse(document.getElementById('app-bootstrap')?.textContent||'{}');}catch{root.appBootstrap={};}}
})(globalThis);
