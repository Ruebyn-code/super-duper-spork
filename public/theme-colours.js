// Shared colour roles keep the original light palette as the CSS fallback.
(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.themeColours=model;})(globalThis,function(){
 function adapt(value,role){
  const original=value,normal=value.toLowerCase(),names={white:'#ffffff',black:'#000000'};
  value=names[normal]||normal;if(!/^#[0-9a-f]{3,8}$/.test(value))return original;
  let hex=value.slice(1);if(hex.length===3||hex.length===4)hex=[...hex].map(c=>c+c).join('');if(![6,8].includes(hex.length))return original;
  if(hex.length===8&&parseInt(hex.slice(6),16)/255<(role==='background'?.35:.75))return original;
  const rgb=[0,2,4].map(index=>parseInt(hex.slice(index,index+2),16)/255),high=Math.max(...rgb),low=Math.min(...rgb),light=(high+low)/2,delta=high-low,saturation=delta===0?0:delta/(1-Math.abs(2*light-1));
  let hue=0;if(delta)hue=(high===rgb[0]?(rgb[1]-rgb[2])/delta%6:high===rgb[1]?(rgb[2]-rgb[0])/delta+2:(rgb[0]-rgb[1])/delta+4)*60;if(hue<0)hue+=360;
  const semantic=hue<18||hue>=340?'danger':hue<75?'warning':hue<175?'success':'primary';let token;
  if(role==='background'){
   if(light<.72)return original;
   token=hex.length===8?'surface-glass':normal==='#f5f8fc'?'canvas':light>.97?'surface':saturation>.35?semantic+'-soft':'surface-raised';
  }else if(role==='border'){
   if(light<.6)return original;token='line';
  }else if(role==='text'){
   if(light>=.8)return original;
   token=saturation>.45?semantic+'-text':light<.32?'text':'muted';
  }else return original;
  return 'var(--theme-'+token+','+original+')';
 }
 return {adapt};
});
