// Printed pages and PDFs (browser Print / Save as PDF) carry the company's own logo, name, store and print time at the top.
// Display only: the logo is read once from the company's existing logo route (sidebar logo, then main logo) and the shared
// Opstack fallback logo is never printed as if it were the company's. Nothing is saved and no print is started from here.
(()=>{
 if(window.printBranding)return;
 const state={logo:null,company:'',location:''};let loading=null;
 const scoped=path=>typeof window.companyAssetUrl==='function'?window.companyAssetUrl(path):path;
 const dataUrl=blob=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>resolve('');reader.readAsDataURL(blob);});
 async function companyLogo(){
  for(const path of ['/sidebar-logo','/logo']){
   try{const response=await fetch(scoped(path),{cache:'no-store',headers:typeof window.companyHeaders==='function'?window.companyHeaders():{}});
    if(!response.ok||response.headers.get('X-Branding-Scope')==='platform')continue;const type=response.headers.get('Content-Type')||'';if(!/^image\/(png|jpe?g|webp|svg\+xml)/.test(type))continue;
    const url=await dataUrl(await response.blob());if(url.startsWith('data:image/'))return url;}catch{}
  }
  return null;
 }
 function load(){
  loading=(async()=>{
   try{const session=await window.appAccess?.initialSession?.();state.company=session?.companyName||window.appCompanyName||'';state.location=session?.locationName||'';}catch{state.company=window.appCompanyName||'';}
   state.logo=await companyLogo();
  })();
  return loading;
 }
 const printedAt=()=>new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Australia/Melbourne'}).format(new Date());
 const word=(text,values={})=>typeof window.interfaceLabel==='function'?window.interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>values[key]??'');
 // The company's primary colour (a plain hex/rgb value only); neutral slate otherwise.
 function accent(){try{const value=getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();if(/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value))return value;}catch{}return '#334155';}
 // A light tint of the primary colour for the header/footer bars (mixed with white in JS so it also works in margin boxes).
 function rgb(value){const hex=value.match(/^#([0-9a-f]{3,8})$/i);if(hex){let digits=hex[1];if(digits.length<6)digits=[...digits.slice(0,3)].map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(digits.slice(i,i+2),16));}const parts=value.match(/[\d.]+/g);return parts&&parts.length>=3?parts.slice(0,3).map(Number):[51,65,85];}
 function tint(amount=0.1){const [r,g,b]=rgb(accent());const mix=c=>Math.round(c*amount+255*(1-amount));return 'rgb('+mix(r)+','+mix(g)+','+mix(b)+')';}
 function deep(){const [r,g,b]=rgb(accent());const mix=c=>Math.round(c*0.55+15*0.45);return 'rgb('+mix(r)+','+mix(g)+','+mix(b)+')';}
 // Small OpStack mark for the footer, wrapped in a 13 px SVG so the margin box shows it at a fixed size.
 let mark='';(async()=>{try{const response=await fetch('/opstack-print-mark.png');if(response.ok){const png=await dataUrl(await response.blob());if(png.startsWith('data:image/png'))mark='data:image/svg+xml;base64,'+btoa('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="13" height="13" viewBox="0 0 13 13"><image width="13" height="13" href="'+png+'" xlink:href="'+png+'"/></svg>');}}catch{}})();
 const cssString=value=>'"'+String(value||'').replace(/[\\"]/g,'\\$&').replace(/[\r\n\u2028\u2029]+/g,' ').slice(0,160)+'"';
 const cleanTitle=value=>String(value||'').replace(/\s*[—–|-]\s*Opstack\s*$/i,'').replace(/^Opstack\s*[—–|-]\s*/i,'').trim();
 function info(){return [state.location,state.company].filter(Boolean).join(' · ')+(state.location||state.company?' · ':'')+word('Printed {time}',{time:printedAt()});}
 // Every printed page: a tinted footer bar (who owns the PDF, page n of N, the OpStack web address and mark), and from page 2 a
 // slim tinted top bar repeating the PDF name. Built from @page margin boxes so it repeats on every page; display only.
 function pageCss(title){
  const bar=tint(0.1),ink=deep(),site=location.host||'OpStack',owner=state.company?word('This PDF is the property of {company}',{company:state.company}):word('Printed from OpStack');
  const box='background:'+bar+';color:'+ink+';font:500 7.5pt/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;vertical-align:middle;margin-bottom:5mm;';
  const top='background:'+bar+';color:'+ink+';font:600 8pt/1.2 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;vertical-align:middle;margin-top:5mm;';
  return `@page{margin:16mm 15mm 19mm;
 @bottom-left-corner{content:"";background:${bar};margin-bottom:5mm}
 @bottom-left{content:${cssString(owner)};${box}text-align:left}
 @bottom-center{content:"${word('Page')} " counter(page) " ${word('of')} " counter(pages);${box}text-align:center;font-weight:600}
 @bottom-right{content:${cssString(site+'  ')}${mark?' url("'+mark+'")':''};${box}text-align:right}
 @bottom-right-corner{content:"";background:${bar};margin-bottom:5mm}
 @top-left-corner{content:"";background:${bar};margin-top:5mm}
 @top-left{content:${cssString(title)};${top}text-align:left}
 @top-right{content:${cssString(state.company)};${top}text-align:right;font-weight:500}
 @top-right-corner{content:"";background:${bar};margin-top:5mm}}
@page:first{@top-left-corner{content:none}@top-left{content:none}@top-right{content:none}@top-right-corner{content:none}}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@media print{html,body{background:#fff!important}}
.print-brand-hide{display:none!important}`;
 }
 // The first-page header: a rounded primary-tinted bar with the PDF name and details on the left and the company logo on the
 // right. Inline styles so it also works in freshly opened print windows without the app's CSS.
 function header(doc=document,title=''){
  const exact='-webkit-print-color-adjust:exact;print-color-adjust:exact',name=cleanTitle(title)||cleanTitle(doc.title)||state.company||'OpStack';
  const box=doc.createElement('div');box.className='print-brand';box.setAttribute('data-layout-ui','');box.dataset.title=name;
  box.style.cssText='display:flex;align-items:center;gap:18px;position:static;width:auto;max-width:none;margin:0 0 20px;padding:14px 18px;border:0;border-radius:14px;background:'+tint(0.1)+';box-shadow:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#0f172a;break-inside:avoid;page-break-inside:avoid;text-align:left;'+exact;
  const text=doc.createElement('div');text.style.cssText='display:flex;flex-direction:column;gap:4px;min-width:0;flex:1';
  const heading=doc.createElement('strong');heading.textContent=name;heading.dataset.userText='';heading.style.cssText='font-size:17pt;line-height:1.15;font-weight:750;letter-spacing:-0.02em;color:#0f172a';
  const details=doc.createElement('span');details.textContent=info();details.dataset.userText='';details.style.cssText='font-size:9pt;color:'+deep();
  text.append(heading,details);box.append(text);
  if(state.logo){const image=doc.createElement('img');image.src=state.logo;image.alt=state.company||'';image.style.cssText='display:block;flex:none;max-height:46px;max-width:180px;width:auto;height:auto;object-fit:contain;margin:0';box.append(image);}
  return box;
 }
 function pageStyle(doc,title){const style=doc.createElement('style');style.className='print-brand-page';style.textContent=pageCss(cleanTitle(title)||cleanTitle(doc.title)||state.company||'OpStack');(doc.head||doc.documentElement).append(style);return style;}
 // Shared, modern styling for freshly opened print windows (checklist runs, QR sheets): roomy margins, clear type and soft tables.
 const styles=`@page{margin:16mm 15mm}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;padding:28px 32px;font:10.5pt/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#0f172a;background:#fff}
@media print{body{padding:0}}
h1{margin:0 0 6px;font-size:20pt;line-height:1.2;font-weight:750;letter-spacing:-0.02em}
h2{margin:24px 0 8px;font-size:12pt}
.meta{margin:0 0 18px;color:#64748b;font-size:9.5pt}
.facts{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 22px;padding:0}
.fact{display:flex;flex-direction:column;gap:2px;min-width:110px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;break-inside:avoid}
.fact b{font-size:7.5pt;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#64748b}
.fact span{font-size:10pt;color:#0f172a}
table{width:100%;border-collapse:separate;border-spacing:0;margin:0 0 18px}
th{padding:8px 12px;font-size:7.5pt;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:#64748b;text-align:left;border-bottom:1.5px solid #cbd5e1}
td{padding:10px 12px;border-bottom:1px solid #edf1f5;text-align:left;vertical-align:top}
thead{display:table-header-group}
tr{break-inside:avoid;page-break-inside:avoid}
tr.section td{padding:16px 12px 8px;border-bottom:1.5px solid #cbd5e1;font-size:9pt;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#334155;background:none}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-weight:600}
.fail{display:inline-block;padding:1px 8px;border-radius:999px;font-weight:700;color:#b91c1c;background:#fee2e2}
small{display:block;margin-top:4px;color:#64748b;font-size:8.5pt}
td img{display:block;max-width:60mm;max-height:45mm;margin-top:8px;border-radius:6px;border:1px solid #e2e8f0}
.foot{margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:8pt}`;
 // Add the header and page bars to another document (a print window) once the logo is ready; resolves when they are in place.
 async function brand(doc){try{await (loading||load());}catch{}if(!doc?.body||doc.body.querySelector(':scope > .print-brand'))return;const title=doc.title||doc.querySelector('h1')?.textContent||'';doc.body.prepend(header(doc,title));if(!doc.querySelector('style.print-brand-page'))pageStyle(doc,title);const image=doc.body.querySelector('.print-brand img');if(image&&!image.complete)await new Promise(resolve=>{image.onload=image.onerror=resolve;});}
 // Printing this page: put the header at the top of whatever is actually printed (using its own heading as the PDF name, which
 // is then hidden so it is not shown twice) and the page bars around it, then take them away afterwards.
 const targets=['.report-print-area','body.library-printing-qr .library-qr-dialog[open]','.library-reading:not([hidden])'];
 let added=null,style=null,hidden=null;
 window.addEventListener('beforeprint',()=>{
  if(added||document.body?.classList.contains('no-print-brand'))return;
  const visible=node=>node&&node.getClientRects().length>0,target=document.querySelector('.report-print-area')||targets.map(selector=>document.querySelector(selector)).find(visible)||[...document.querySelectorAll('main')].find(visible)||document.body;if(!target||target.querySelector(':scope > .print-brand'))return;
  const own=target.matches('.report-print-area,.library-reading,.library-qr-dialog'),heading=[...target.querySelectorAll(own?'h1,h2':'h1')].find(node=>node.getClientRects().length&&!node.closest('dialog:not([open]),[hidden],.print-brand'))||null;const title=heading?.textContent?.trim()||document.title;
  added=header(document,title);added.classList.add('print-brand-auto');target.prepend(added);style=pageStyle(document,title);
  if(heading&&own&&heading.textContent.trim()===cleanTitle(title)){hidden=heading;heading.classList.add('print-brand-hide');}
 });
 window.addEventListener('afterprint',()=>{added?.remove();style?.remove();hidden?.classList.remove('print-brand-hide');added=style=hidden=null;});
 window.addEventListener('app-logo-updated',()=>load());
 window.printBranding={header,brand,styles,accent,tint,pageCss,ready:()=>loading||load()};
 load();
})();
