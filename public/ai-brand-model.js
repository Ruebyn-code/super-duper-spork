// Shared, allowlisted intelligence appearance for HTML, settings and report emails.
(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.aiBrandModel=model;})(globalThis,function(){
 const palettes=[
  {id:'default',name:'OpStack · Default',angle:135,colors:['#0E7490','#4F46E5','#7C3AED'],gradient:'linear-gradient(135deg, #0E7490 0%, #4F46E5 50%, #7C3AED 100%)',ink:'#3730a3',nightInk:'#ddd6fe',accent:'#6366f1',nightLimit:.60},
  {id:'electric',name:'Electric blue',angle:135,colors:['#0066FF','#00E5FF'],gradient:'linear-gradient(135deg, #0066FF, #00E5FF)',ink:'#003b7a',nightInk:'#dcf9ff',accent:'#0066ff',nightBase:.18,nightRange:.08,nightLimit:.36},
  {id:'midnight',name:'Midnight violet',angle:135,colors:['#1E1B4B','#7C3AED'],gradient:'linear-gradient(135deg, #1E1B4B, #7C3AED)',ink:'#31205c',nightInk:'#e9d5ff',accent:'#7c3aed',nightLimit:.64},
  {id:'spectrum',name:'Blue violet',angle:135,colors:['#2563EB','#8B5CF6'],gradient:'linear-gradient(135deg, #2563EB, #8B5CF6)',ink:'#312e81',nightInk:'#ede9fe',accent:'#6366f1',nightLimit:.60},
  {id:'ocean',name:'Ocean',angle:90,colors:['#0057FF','#00C8F8','#00E5D4'],gradient:'linear-gradient(90deg, #0057FF 0%, #00C8F8 50%, #00E5D4 100%)',ink:'#003f59',nightInk:'#d5fff8',accent:'#0057ff',nightBase:.18,nightRange:.08,nightLimit:.36}
 ];
 const defaults={palette:'default',tintDepth:100};
 const validPalette=value=>palettes.some(p=>p.id===value);
 const validDepth=value=>Number.isInteger(value)&&value>=100&&value<=160&&value%10===0;
 function settings(value={}){return{palette:validPalette(value?.palette)?value.palette:defaults.palette,tintDepth:validDepth(value?.tintDepth)?value.tintDepth:defaults.tintDepth};}
 const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 const hex=values=>'#'+values.map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');
 function stops(value,dark=false){const s=settings(value),p=palettes.find(p=>p.id===s.palette);return p.colors.map((color,i)=>{const at=i/(p.colors.length-1),base=dark?(p.nightBase??.28)+at*(p.nightRange??.12):.20+at*.08;return{color,at:at*100,alpha:Math.min(dark?p.nightLimit:1,base*s.tintDepth/100)};});}
 function variables(value,dark=false){const s=settings(value),p=palettes.find(p=>p.id===s.palette),ink=dark?p.nightInk:p.ink;return{'--ai-gradient':p.gradient,'--ai-accent':p.accent,'--ai-text':ink,'--ai-focus':dark?p.nightInk:p.ink,'--ai-line':ink+(dark?'66':'4d'),'--ai-tint':'linear-gradient('+p.angle+'deg,'+stops(s,dark).map(stop=>stop.color+Math.round(stop.alpha*255).toString(16).padStart(2,'0')+' '+stop.at+'%').join(',')+')'};}
 function css(value,preview=false){const selector=preview?'html:root #ai-brand-preview':'html:root';return[false,true].map(dark=>(dark?(preview?'html:root[data-theme=dark] #ai-brand-preview':'html:root[data-theme=dark]'):selector)+'{'+Object.entries(variables(value,dark)).map(([key,value])=>key+':'+value).join(';')+'}').join('');}
 function email(value){const s=settings(value),p=palettes.find(p=>p.id===s.palette),colors=stops(s).map(stop=>({at:stop.at,color:hex(rgb(stop.color).map(n=>n*stop.alpha+255*(1-stop.alpha)))}));return{gradient:'linear-gradient('+p.angle+'deg, '+colors.map(stop=>stop.color+' '+stop.at+'%').join(', ')+')',fallback:colors[Math.floor(colors.length/2)].color,ink:p.ink,border:p.accent};}
 return{palettes,defaults,validPalette,validDepth,settings,variables,css,email};
});
