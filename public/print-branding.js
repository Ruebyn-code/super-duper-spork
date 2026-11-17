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
 // The company's primary colour (a plain hex/rgb value only) for the thin accent line; neutral slate otherwise.
 function accent(){try{const value=getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();if(/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(value))return value;}catch{}return '#334155';}
 // A self-contained header (inline styles) so it also works in freshly opened print windows without the app's CSS.
 function header(doc=document){
  const colour=accent(),exact='-webkit-print-color-adjust:exact;print-color-adjust:exact';
  const box=doc.createElement('div');box.className='print-brand';box.setAttribute('data-layout-ui','');
  box.style.cssText='display:block;position:static;width:auto;max-width:none;margin:0 0 22px;padding:0;border:0;background:none;box-shadow:none;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#0f172a;break-inside:avoid;page-break-inside:avoid;text-align:left';
  const bar=doc.createElement('div');bar.style.cssText='height:4px;border-radius:4px;margin:0 0 14px;background:'+colour+';'+exact;box.append(bar);
  const row=doc.createElement('div');row.style.cssText='display:flex;align-items:center;gap:16px;padding:0 0 14px;border-bottom:1px solid #e2e8f0';
  if(state.logo){const image=doc.createElement('img');image.src=state.logo;image.alt=state.company||'';image.style.cssText='display:block;flex:none;max-height:44px;max-width:170px;width:auto;height:auto;object-fit:contain;margin:0';row.append(image);}
  const text=doc.createElement('div');text.style.cssText='display:flex;flex-direction:column;gap:3px;min-width:0;flex:1';
  if(state.company){const name=doc.createElement('strong');name.textContent=state.company;name.dataset.userText='';name.style.cssText='font-size:14pt;line-height:1.15;font-weight:700;letter-spacing:-0.01em';text.append(name);}
  if(state.location){const store=doc.createElement('span');store.textContent=state.location;store.dataset.userText='';store.style.cssText='font-size:9.5pt;color:#64748b';text.append(store);}
  row.append(text);
  const printed=doc.createElement('div');printed.style.cssText='display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:none;text-align:right';
  const label=doc.createElement('span');label.textContent=word('Printed');label.style.cssText='font-size:7.5pt;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:'+colour;
  const time=doc.createElement('span');time.dataset.userText='';time.textContent=printedAt();time.style.cssText='font-size:9.5pt;color:#334155';
  printed.append(label,time);row.append(printed);box.append(row);return box;
 }
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
 // Add the header to another document (a print window) once the logo is ready; resolves when it is in place.
 async function brand(doc){try{await (loading||load());}catch{}if(!doc?.body||doc.body.querySelector(':scope > .print-brand'))return;doc.body.prepend(header(doc));const image=doc.body.querySelector('.print-brand img');if(image&&!image.complete)await new Promise(resolve=>{image.onload=image.onerror=resolve;});}
 // Printing this page: put the header at the top of whatever is actually printed, then take it away afterwards.
 const targets=['.report-print-area','body.library-printing-qr .library-qr-dialog[open]','.library-reading:not([hidden])'];
 let added=null;
 window.addEventListener('beforeprint',()=>{
  if(added||document.body?.classList.contains('no-print-brand'))return;
  const target=document.querySelector('.report-print-area')||targets.map(selector=>document.querySelector(selector)).find(node=>node&&node.getClientRects().length)||document.body;if(!target||target.querySelector(':scope > .print-brand'))return;
  added=header(document);added.classList.add('print-brand-auto');target.prepend(added);
 });
 window.addEventListener('afterprint',()=>{added?.remove();added=null;});
 window.addEventListener('app-logo-updated',()=>load());
 window.printBranding={header,brand,styles,accent,ready:()=>loading||load()};
 load();
})();
