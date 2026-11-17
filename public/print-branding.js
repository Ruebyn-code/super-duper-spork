// Printed pages and PDFs (browser Print / Save as PDF) carry the company's own logo, name, store and print time at the top.
// Display only: the logo is read once from the company's existing logo route (main logo, then sidebar logo) and the shared
// Opstack fallback logo is never printed as if it were the company's. Nothing is saved and no print is started from here.
(()=>{
 if(window.printBranding)return;
 const state={logo:null,company:'',location:''};let loading=null;
 const scoped=path=>typeof window.companyAssetUrl==='function'?window.companyAssetUrl(path):path;
 const dataUrl=blob=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>resolve('');reader.readAsDataURL(blob);});
 async function companyLogo(){
  for(const path of ['/logo','/sidebar-logo']){
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
 // A self-contained header (inline styles) so it also works in freshly opened print windows without the app's CSS.
 function header(doc=document){
  const box=doc.createElement('header');box.className='print-brand';box.setAttribute('data-layout-ui','');
  box.style.cssText='display:flex;align-items:center;gap:14px;margin:0 0 14px;padding:0 0 10px;border-bottom:1px solid #d5dbe2;font-family:Arial,Helvetica,sans-serif;color:#111;break-inside:avoid;page-break-inside:avoid';
  if(state.logo){const image=doc.createElement('img');image.src=state.logo;image.alt=state.company||'';image.style.cssText='display:block;max-height:52px;max-width:200px;width:auto;height:auto;object-fit:contain';box.append(image);}
  const text=doc.createElement('div');text.style.cssText='display:grid;gap:2px;min-width:0';
  if(state.company){const name=doc.createElement('strong');name.textContent=state.company;name.dataset.userText='';name.style.cssText='font-size:13pt;line-height:1.2';text.append(name);}
  const meta=doc.createElement('span');meta.dataset.userText='';meta.style.cssText='font-size:9pt;color:#555';meta.textContent=[state.location,word('Printed {time}',{time:printedAt()})].filter(Boolean).join(' · ');text.append(meta);
  box.append(text);return box;
 }
 // Add the header to another document (a print window) once the logo is ready; resolves when it is in place.
 async function brand(doc){try{await (loading||load());}catch{}if(!doc?.body||doc.body.querySelector(':scope > .print-brand'))return;doc.body.prepend(header(doc));const image=doc.body.querySelector('.print-brand img');if(image&&!image.complete)await new Promise(resolve=>{image.onload=image.onerror=resolve;});}
 // Printing this page: put the header at the top of whatever is actually printed, then take it away afterwards.
 const targets=['.report-print-area','body.library-printing-qr .library-qr-dialog[open]','.library-reading:not([hidden])'];
 let added=null;
 window.addEventListener('beforeprint',()=>{
  if(added||document.body?.classList.contains('no-print-brand'))return;
  const target=targets.map(selector=>document.querySelector(selector)).find(node=>node&&node.getClientRects().length)||document.body;if(!target||target.querySelector(':scope > .print-brand'))return;
  added=header(document);added.classList.add('print-brand-auto');target.prepend(added);
 });
 window.addEventListener('afterprint',()=>{added?.remove();added=null;});
 window.addEventListener('app-logo-updated',()=>load());
 window.printBranding={header,brand,ready:()=>loading||load()};
 load();
})();
