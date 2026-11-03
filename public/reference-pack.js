(()=>{
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 window.opstackReferencePack={async load(host,base='/api/help/reference-pack'){
  if(!host)return;host.hidden=false;host.setAttribute('aria-busy','true');host.replaceChildren(node('p','Loading reference pack…'));
  try{
   const response=await fetch(base,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('The reference pack is unavailable. Reload to try again.');const pack=await response.json();
   const heading=node('h2','Screenshots & platform reference'),description=node('p','Desktop and phone screenshots, key popups, a screen index and a Base44 rebuild brief. Demo data only.'),details=node('p',pack.screenshots+' screenshots · '+(pack.size/1048576).toFixed(1)+' MB · Updated '+new Date(pack.createdAt).toLocaleDateString('en-AU',{timeZone:'Australia/Melbourne'})),download=node('a','Download reference pack (ZIP)');
   heading.id=host.id+'-title';host.setAttribute('aria-labelledby',heading.id);details.className='reference-pack-details';download.href=base+'/download';download.download='OpStack-reference-pack.zip';download.className='reference-pack-download';host.replaceChildren(heading,description,details,download);
  }catch(error){host.replaceChildren(node('h2','Screenshots & platform reference'),node('p',error.message));}
  finally{host.removeAttribute('aria-busy');}
 }};
})();
