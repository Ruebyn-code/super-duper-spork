let elementOverrides=window.appBootstrap?.elementOverrides||{};const localTextRecords=new WeakMap(),localStyleRecords=new WeakMap(),localTracked=new Set();
function elementIdentity(element){if(!element||element.closest('[data-copy-editor]'))return '';if(element.dataset.editId)return element.dataset.editId;
 const root=element.closest('[data-product-id],[data-supplier-id],[data-account-id]');if(!root)return '';const path=[];let node=element;while(node&&node!==root){const peers=[...node.parentElement.children].filter(e=>e.tagName===node.tagName);path.unshift(node.tagName.toLowerCase()+':'+peers.indexOf(node));node=node.parentElement;}
 const kind=root.dataset.productId?'product':root.dataset.supplierId?'supplier':'account';const id=root.dataset.productId||root.dataset.supplierId||root.dataset.accountId;return 'dynamic-'+location.pathname.replace(/[^a-z0-9]/gi,'_')+'-'+kind+'-'+id+'-'+(path.join('.')||'root');
}
function applyElementOverrides(root=document){
 if(root.nodeType===Node.TEXT_NODE)root=root.parentElement;if(!root)return;
 for(const element of localTracked)if(!element.isConnected)localTracked.delete(element);
 if(!Object.keys(elementOverrides).length&&!localTracked.size)return;
 const elements=new Set(root===document?localTracked:[]);
 const consider=element=>{if(element?.nodeType===Node.ELEMENT_NODE&&(element.dataset.editId||element.closest('[data-product-id],[data-supplier-id],[data-account-id]')))elements.add(element);};
 consider(root);root.querySelectorAll?.('*').forEach(consider);
 if(root!==document){let parent=root.parentElement;while(parent){consider(parent);parent=parent.parentElement;}}

 const fontFamilies={opsilon:"'Opsilon',sans-serif",arial:'Arial,Helvetica,sans-serif',verdana:'Verdana,sans-serif',georgia:'Georgia,serif',trebuchet:"'Trebuchet MS',sans-serif",monospace:'monospace'};
 for(const element of elements){if(!element.isConnected){localTracked.delete(element);continue;}if(element.closest('[data-copy-editor]'))continue;const id=elementIdentity(element);if(!id)continue;const settings=elementOverrides[id]||{};if(!Object.keys(settings).length&&!localTracked.has(element))continue;if(Object.keys(settings).length)localTracked.add(element);
  const properties={};if(Object.hasOwn(fontFamilies,settings.font)){properties['font-family']=fontFamilies[settings.font];properties['font-weight']=settings.font==='opsilon'?'400':'600';}if(/^#[0-9a-f]{6}$/i.test(settings.fontColour||''))properties.color=settings.fontColour;if(/^#[0-9a-f]{6}$/i.test(settings.background||''))properties['background-color']=settings.background;if(settings.backgroundImage==='')properties['background-image']='none';if(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(settings.backgroundImage||'')){properties['background-image']='url("'+settings.backgroundImage+'")';properties['background-size']='cover';properties['background-position']='center';properties['background-repeat']='no-repeat';}
  let styles=localStyleRecords.get(element);if(!styles){styles=new Map();localStyleRecords.set(element,styles);}for(const [property,baseline] of styles){if(!Object.hasOwn(properties,property)){if(baseline.value)element.style.setProperty(property,baseline.value,baseline.priority);else element.style.removeProperty(property);styles.delete(property);}}
  for(const [property,value] of Object.entries(properties)){if(!styles.has(property))styles.set(property,{value:element.style.getPropertyValue(property),priority:element.style.getPropertyPriority(property)});if(element.style.getPropertyValue(property)!==value||element.style.getPropertyPriority(property)!=='important')element.style.setProperty(property,value,'important');}
  const previous=localTextRecords.get(element);
  const values=()=>{try{return JSON.parse(element.dataset.appValues||'{}');}catch{return {};}};
  const formatted=(template)=>String(template??'').replace(/\{(\w+)\}/g,(_,key)=>String(values()[key]??'{'+key+'}'));
  if(settings.text){
   const spec=settings.text;
   if(spec.attribute){element.dataset.localWording=spec.original;element.setAttribute(spec.attribute,spec.value??'');localTextRecords.set(element,{attribute:spec.attribute,original:spec.original});continue;}
   let record=previous;
   if(!record?.node?.isConnected){const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let found;while(walker.nextNode()){const node=walker.currentNode;const original=(originalNodes.get(node)?.source||node.nodeValue).trim().replace(/\s+/g,' ');if(original===spec.original||(element.dataset.appTemplate===spec.original&&node.parentElement===element)){found=node;break;}}if(found){record={node:found,original:spec.original};localTextRecords.set(element,record);}}
   if(record?.node){element.dataset.localWording=spec.original;const rendered=formatted(spec.value);if(record.node.nodeValue!==rendered)record.node.nodeValue=rendered;originalNodes.set(record.node,{source:record.original,rendered});}
  }else if(previous){element.removeAttribute('data-local-wording');const value=formatted(Object.hasOwn(interfaceOverrides,previous.original)?interfaceOverrides[previous.original]:previous.original);if(previous.attribute)element.setAttribute(previous.attribute,value);else if(previous.node?.isConnected){previous.node.nodeValue=value;originalNodes.set(previous.node,{source:previous.original,rendered:value});}localTextRecords.delete(element);}

 }
}
async function refreshElementOverrides(){try{const response=await fetch('/element-overrides');if(response.ok){elementOverrides=await response.json();applyElementOverrides();}}catch{}}
const localRoots=new Set();let localScheduled=false;
function queueElementRoot(node){const root=node.nodeType===Node.TEXT_NODE?node.parentElement:node;if(!root||root.nodeType!==Node.ELEMENT_NODE||root.closest('script,style,[data-copy-editor]'))return;localRoots.add(root);}
const elementObserver=new MutationObserver(records=>{
 if(!Object.keys(elementOverrides).length&&!localTracked.size)return;
 for(const record of records){if(record.type==='characterData')queueElementRoot(record.target);else for(const node of record.addedNodes)queueElementRoot(node);}
 if(localScheduled||!localRoots.size)return;localScheduled=true;queueMicrotask(()=>{
  localScheduled=false;const roots=[...localRoots].filter(root=>root.isConnected);localRoots.clear();elementObserver.disconnect();
  try{for(const root of roots)if(!roots.some(other=>other!==root&&other.contains(root)))applyElementOverrides(root);}finally{elementObserver.observe(document.documentElement,{childList:true,characterData:true,subtree:true});}
 });
});
elementObserver.observe(document.documentElement,{childList:true,characterData:true,subtree:true});
window.addEventListener('interface-text-updated',()=>applyElementOverrides());
if(window.appBootstrap&&Object.hasOwn(window.appBootstrap,'elementOverrides')){applyElementOverrides();document.getElementById('element-appearance-style')?.remove();}else refreshElementOverrides();
