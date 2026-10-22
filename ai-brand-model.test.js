const test=require('node:test'),assert=require('node:assert/strict'),model=require('./public/ai-brand-model'),mail=require('./scheduled-report-email');
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const luminance=rgb=>rgb.map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
test('intelligence palette and tint limits reject arbitrary styling and retain the existing default',()=>{
 assert.equal(model.palettes.length,5);assert.equal(model.palettes[0].gradient,'linear-gradient(135deg, #0E7490 0%, #4F46E5 50%, #7C3AED 100%)');
 for(const value of ['url(https://example.test)',{},null,'constructor'])assert.equal(model.validPalette(value),false);
 for(const value of [99,161,105,'160',NaN])assert.equal(model.validDepth(value),false);
 assert.deepEqual(model.settings({palette:'invalid',tintDepth:Infinity}),model.defaults);
});
test('every intelligence palette and tint depth keeps labels and typed text readable through the gradient and shimmer in both themes',()=>{
 for(const palette of model.palettes)for(const dark of [false,true])for(let tintDepth=100;tintDepth<=160;tintDepth+=10){
  const value=model.variables({palette:palette.id,tintDepth},dark),stops=[...value['--ai-tint'].matchAll(/(#[0-9a-fA-F]{6})([0-9a-fA-F]{2})/g)].map(m=>[...rgb(m[1]),parseInt(m[2],16)/255]),surface=rgb(dark?'#142133':'#ffffff');
  for(let n=0;n<=200;n++){const position=n/200*(stops.length-1),index=Math.min(stops.length-2,Math.floor(position)),fraction=position-index,stop=stops[index].map((v,i)=>v*(1-fraction)+stops[index+1][i]*fraction),background=stop.slice(0,3).map((v,i)=>v*stop[3]+surface[i]*(1-stop[3]));
   for(const opacity of [0,18/255])for(const text of [value['--ai-text'],dark?'#e7edf6':'#182b3a'])assert(contrast(rgb(text),background.map(v=>v*(1-opacity)+255*opacity))>=4.5,`${palette.id} ${dark?'dark':'light'} ${tintDepth}% has insufficient contrast`);
  }
 }
});
test('report email headers use the selected palette and tint with a readable solid fallback and escaped report content',()=>{
 const run={draft:{title:'Weekly <review>',overview:'Sales & costs',sections:[],actions:[]},source:{facts:[],period:{start:'2026-10-12',end:'2026-10-18',timeZone:'Australia/Melbourne'},notes:[]}};
 for(const palette of model.palettes)for(const tintDepth of [100,160]){const brand={palette:palette.id,tintDepth},look=model.email(brand),email=mail.message(run,'https://opstack.example.test',brand);assert(email.html.includes('background-color:'+look.fallback+';background-image:'+look.gradient));assert(email.html.includes('Weekly &lt;review&gt;'));assert(email.html.includes('Space Grotesk'));assert(contrast(rgb(look.ink),rgb(look.fallback))>=4.5);for(const stop of look.gradient.matchAll(/#[0-9a-f]{6}/g))assert(contrast(rgb(look.ink),rgb(stop[0]))>=4.5);}
});
