// Shared identities, element types and safe icon choices for App edit.
(function(root){
 const icons={
  calendar:{label:'Calendar',body:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/><g class="icon-detail"><path d="M7 14h3M14 14h3M7 18h3"/></g>'},
  filter:{label:'Filter',body:'<path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z"/><g class="icon-detail"><path d="M8 7h8"/></g>'},
  arrow:{label:'Arrow',body:'<path d="M4 12h16m-7-7 7 7-7 7"/><g class="icon-detail"><path d="M4 8v8"/></g>'},
  close:{label:'Close',body:'<circle cx="12" cy="12" r="9"/><g class="icon-detail"><path d="m8 8 8 8M16 8l-8 8"/></g>'},
  cart:{label:'Cart',body:'<path d="M3 3h2l2.4 11.4a2 2 0 0 0 2 1.6H18a2 2 0 0 0 2-1.6L21 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><g class="icon-detail"><path d="M11 9v4M16 9v4"/></g>'},
  home:{label:'Home',body:'<path d="m3 10 9-7 9 7M5 9v12h14V9"/><g class="icon-detail"><path d="M9 21v-7h6v7"/></g>'},
  stock:{label:'Stock count',body:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3h6v4H9z"/><g class="icon-detail"><path d="M9 12h6M9 16h6"/></g>'},
  reporting:{label:'Reporting',body:'<rect x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><path d="M7 16V12M12 16V7M17 16V9"/></g>'},
  sales:{label:'Sales',body:'<path d="M4 4v16h16"/><g class="icon-detail"><path d="M8 16v-4M13 16V8M18 16V5"/></g>'},
  users:{label:'Users',body:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5"/><g class="icon-detail"><path d="M7 17h4M18 17h2"/></g>'},
  location:{label:'Location',body:'<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><g class="icon-detail"><circle cx="12" cy="10" r="3"/></g>'},
  settings:{label:'Settings',body:'<rect x="3" y="3" width="18" height="18" rx="3"/><g class="icon-detail"><path d="M6 8h12M6 16h12"/><circle cx="9" cy="8" r="2"/><circle cx="15" cy="16" r="2"/></g>'},
  search:{label:'Search',body:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/><g class="icon-detail"><path d="M7 10h6"/></g>'},
  edit:{label:'Edit',body:'<path d="m16 3 5 5-12 12-6 1 1-6Z"/><g class="icon-detail"><path d="m13 6 5 5M4 16l4 4"/></g>'},
  box:{label:'Stock box',body:'<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Z"/><g class="icon-detail"><path d="m3 8 9 5 9-5M12 13v8"/></g>'},
  plus:{label:'Add',body:'<circle cx="12" cy="12" r="9"/><g class="icon-detail"><path d="M7 12h10M12 7v10"/></g>'},
  check:{label:'Check',body:'<circle cx="12" cy="12" r="9"/><g class="icon-detail"><path d="m7 12 3 3 7-7"/></g>'}
 };
 const typeLabels={page:'Pages',sidebar:'Sidebars',panel:'Content panels',container:'Containers',text:'Text','greeting-name':'Greeting names','user-name':'User names','location-name':'Location names',heading:'Headings',paragraph:'Paragraphs',caption:'Small text',badge:'Badges',metric:'Metric values',button:'Buttons',field:'Input fields','location-option':'Location options','select-option':'Dropdown options','company-option':'Company options',label:'Field labels',navigation:'Navigation links','navigation-label':'Navigation labels','stock-name':'Stock names','stock-card':'Stock cards','stock-photo':'Stock photos',logo:'Logos',image:'Images','table-row':'Table rows','table-cell':'Table cells',...Object.fromEntries(['cart','home','ordering','stock','sales','reporting','users','location','company','settings','search','edit','box','signout','collapse','more','calendar','filter','arrow','close','general'].map(name=>['icon-'+name,(name==='general'?'Other':name[0].toUpperCase()+name.slice(1))+' icons']))};
 const visualTags=new Set(['body','main','header','footer','aside','nav','section','article','div','h1','h2','h3','h4','h5','h6','p','span','strong','small','b','em','a','button','input','select','textarea','label','fieldset','legend','form','details','summary','ul','ol','li','table','thead','tbody','tr','th','td','img','svg','hr']);
 const svgChildren=new Set(['path','g','circle','rect','line','polyline','polygon','ellipse','defs','title','use','clipPath']);
 const has=(node,value)=>(node.attributes.class||'').split(/\s+/).includes(value);
 function typeFor(node,ancestors=[]){
  const chain=[node,...ancestors],inside=cls=>chain.some(n=>has(n,cls)),attr=(key)=>chain.find(n=>n.attributes[key])?.attributes[key]||'',id=attr('id');
  if(node.tag==='svg'){
   if(has(node,'cart-icon'))return 'icon-cart';if(has(node,'home-card-arrow'))return 'icon-arrow';if(has(node,'admin-close')||/close/i.test(attr('aria-label')))return 'icon-close';if(inside('date-toggle'))return 'icon-calendar';if(inside('directory-filter-toggle'))return 'icon-filter';if(has(node,'admin-pencil'))return 'icon-edit';
   const role=attr('data-sidebar-icon')||attr('data-sidebar-name').toLowerCase(),edit=attr('data-edit-id'),href=attr('href');
   if(/cart/i.test(role)||href==='/cart'||/home-cart-icon/.test(edit))return 'icon-cart';
   if(/home/i.test(role)||href==='/home')return 'icon-home';if(/ordering/i.test(role)||href==='/'||/home-ordering-icon/.test(edit))return 'icon-ordering';
   if(/stock-count/.test(role)||href.startsWith('/stock-count')||/home-stock-icon/.test(edit))return 'icon-stock';if(/reporting/i.test(role)||href.startsWith('/reporting'))return 'icon-reporting';if(/sales/i.test(role)||href.startsWith('/sales')||/home-sales-icon/.test(edit))return 'icon-sales';
   if(href.includes('#companies')||id.includes('sidebar-company'))return 'icon-company';if(/account|users/i.test(role)||href.includes('#accounts'))return 'icon-users';if(/location/i.test(role)||href.includes('#locations')||inside('location-avatar')||id.includes('sidebar-location'))return 'icon-location';
   if(/settings/i.test(role)||href.startsWith('/admin/settings'))return 'icon-settings';if(/supplier|stock/i.test(role)||href.startsWith('/admin#'))return 'icon-box';
   if(/sign-out/.test(role)||id==='logout')return 'icon-signout';if(/toggle/.test(role)||id==='sidebar-toggle')return 'icon-collapse';if(id==='mobile-more'||id==='top-admin-toggle')return 'icon-more';
   if(inside('search-toggle')||inside('users-search'))return 'icon-search';if(inside('admin-edit-button'))return 'icon-edit';return 'icon-general';
  }
  if(node.tag==='img')return has(node,'app-logo')?'logo':inside('product-art')||has(node,'stock-photo-preview')?'stock-photo':'image';
  if(node.tag==='body')return 'page';if(has(node,'admin-sidebar')||has(node,'secondary-sidebar')||has(node,'mobile-brand-header'))return 'sidebar';
  if(has(node,'product'))return 'stock-card';if(has(node,'stock-name')||(node.tag==='h3'&&inside('product'))||(node.tag==='strong'&&inside('cart-row')))return 'stock-name';
  if(has(node,'greeting-name'))return 'greeting-name';if(has(node,'user-name'))return 'user-name';if(has(node,'location-name'))return 'location-name';
  if(has(node,'sidebar-label'))return 'navigation-label';if(node.attributes.id==='top-admin-toggle'||node.tag==='a'&&(inside('admin-sidebar')||inside('secondary-sidebar')||inside('mobile-tabbar')))return 'navigation';
  if(has(node,'app-select-option'))return 'select-option';if(has(node,'location-picker-option'))return 'location-option';if(has(node,'location-select-trigger'))return 'field';
  if(['button','summary'].includes(node.tag))return 'button';if(['input','select','textarea'].includes(node.tag))return 'field';if(['label','legend'].includes(node.tag))return 'label';
  if(has(node,'management')||has(node,'ordering-budget')||has(node,'account-location-group')||has(node,'location-row'))return 'panel';
  if(/^h[1-6]$/.test(node.tag))return 'heading';if(node.tag==='strong'&&(inside('home-total-metrics')||inside('ordering-budget-metrics')))return 'metric';
  if(node.tag==='tr')return 'table-row';if(['td','th'].includes(node.tag))return 'table-cell';if(has(node,'badge')||has(node,'permission-badge'))return 'badge';if(node.tag==='small'||has(node,'small'))return 'caption';if(node.tag==='p')return 'paragraph';if(['span','strong','b','em'].includes(node.tag))return 'text';return 'container';
 }
 function info(element){return {tag:element.tagName.toLowerCase(),attributes:Object.fromEntries([...element.attributes].map(a=>[a.name,a.value]))};}
 function typeOf(element){if(!element)return '';if(Object.hasOwn(typeLabels,element.dataset.appPart))return element.dataset.appPart;const parents=[];for(let p=element.parentElement;p;p=p.parentElement)parents.push(info(p));return typeFor(info(element),parents);}
 function shortId(value){if(value.length<=240)return value;let hash=14695981039346656037n;for(const c of value){hash^=BigInt(c.charCodeAt(0));hash=BigInt.asUintN(64,hash*1099511628211n);}return value.slice(0,210)+':'+hash.toString(16);}
 function childIdentity(anchor,path){return shortId('part:'+anchor+':'+path.join('.'));}
 function attrs(source){const result={};for(const match of source.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))result[match[1]]=match[2]??match[3]??match[4]??'';return result;}
 const voidTags=new Set(['input','img','hr','br','meta','link','source','area','base','col','embed','param','track','wbr']);
 function annotate(markup,page){
  const stack=[],prefix=page.replace(/[^a-z0-9]/gi,'_');let raw='';
  return markup.replace(/<!--[^]*?-->|<\/?[A-Za-z][^>]*>/g,token=>{
   if(token.startsWith('<!--'))return token;const match=token.match(/^<(\/?)([\w:-]+)/),closing=match[1]==='/',tag=match[2].toLowerCase();
   if(raw){if(closing&&tag===raw){raw='';stack.pop();}return token;}
   if(closing){const at=stack.map(frame=>frame.node.tag).lastIndexOf(tag);if(at>=0)stack.splice(at);return token;}
   const attributes=attrs(token.slice(match[0].length,-1)),node={tag,attributes},parent=stack.at(-1),index=parent?(parent.counts[tag]||0):0;if(parent)parent.counts[tag]=index+1;
   const path=parent?[...parent.path,tag+':'+index]:[tag+':'+index],anchor=parent?.anchor||prefix,existing=attributes['data-edit-id'];
   let output=token;
   if(visualTags.has(tag)&&!stack.some(frame=>frame.node.tag==='svg'||frame.node.attributes.id==='admin-edit-controls'||has(frame.node,'unified-app-editor'))){const id=existing||childIdentity(anchor,path);attributes['data-edit-id']=id;attributes['data-app-part']=typeFor(node,[...stack].reverse().map(frame=>frame.node));const extra=(existing?'':' data-edit-id="'+id+'"')+' data-app-part="'+attributes['data-app-part']+'"';output=token.replace(/\/?>(?=$)/,end=>extra+end);}
   const frame={node,anchor:existing||anchor,path:existing?[]:path,counts:{}};if(!voidTags.has(tag)&&!token.endsWith('/>'))stack.push(frame);if(['script','style','textarea'].includes(tag))raw=tag;return output;
  });
 }
 function effective(overrides,id,type){const own=overrides?.[id]||{},shared=own.linked===false?{}:overrides?.['type:'+type]||{};return {...shared,...own};}
 function iconOriginal(svg){try{return JSON.parse(decodeURIComponent(svg.getAttribute('data-app-icon-original')||''));}catch{return {html:svg.innerHTML,viewBox:svg.getAttribute('viewBox'),fill:svg.getAttribute('fill'),stroke:svg.getAttribute('stroke'),'stroke-width':svg.getAttribute('stroke-width')};}}
 function renderIcons(markup,overrides){return markup.replace(/<svg\b([^>]*?)>([^]*?)<\/svg>/g,(all,source,body)=>{const a=attrs(source),settings=effective(overrides,a['data-edit-id'],a['data-app-part']),icon=icons[settings.icon];if(!icon)return all;const original=encodeURIComponent(JSON.stringify({html:body,viewBox:a.viewBox,fill:a.fill,stroke:a.stroke,'stroke-width':a['stroke-width']}));const cleaned=source.replace(/\s(?:viewBox|fill|stroke|stroke-width)=(?:"[^"]*"|'[^']*')/g,'');return '<svg'+cleaned+' data-app-icon-original="'+original+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+icon.body+'</svg>';});}
 function renderImages(markup,overrides){return markup.replace(/<img\b([^>]*?)\/?>/g,(all,source)=>{const a=attrs(source),settings=effective(overrides,a['data-edit-id'],a['data-app-part']);if(!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(settings.image||''))return all;const original=encodeURIComponent(a.src||'');return '<img'+source.replace(/\s+src=(?:"[^"]*"|'[^']*')/g,'')+' src="'+settings.image+'" data-app-image-original="'+original+'">';});}
 const api={icons,typeLabels,visualTags,svgChildren,typeOf,typeFor,childIdentity,annotate,effective,iconOriginal,renderIcons,renderImages};if(typeof module==='object'&&module.exports)module.exports=api;else root.appEditParts=api;
})(globalThis);
