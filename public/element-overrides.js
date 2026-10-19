let elementOverrides=window.appBootstrap?.elementOverrides||{};const localTextRecords=new WeakMap(),localStyleRecords=new WeakMap(),localTracked=new Set();
const localIconRecords=new WeakMap(),localImageRecords=new WeakMap();
function elementIdentity(element){if(!element||element.closest('.unified-app-editor,.app-edit-indicator,#admin-edit-controls,[data-layout-ui]'))return '';if(element.dataset.editId)return element.dataset.editId;
 const root=element.closest('[data-product-id],[data-supplier-id],[data-account-id]');if(!root){const anchor=element.parentElement?.closest('[data-edit-id]');if(!anchor)return '';const path=[];for(let node=element;node&&node!==anchor;node=node.parentElement){const peers=[...node.parentElement.children].filter(peer=>peer.tagName===node.tagName);path.unshift(node.tagName.toLowerCase()+':'+peers.indexOf(node));}return appEditParts.childIdentity(anchor.dataset.editId,path);}const path=[];let node=element;while(node&&node!==root){const peers=[...node.parentElement.children].filter(e=>e.tagName===node.tagName);path.unshift(node.tagName.toLowerCase()+':'+peers.indexOf(node));node=node.parentElement;}
 const kind=root.dataset.productId?'product':root.dataset.supplierId?'supplier':'account';const id=root.dataset.productId||root.dataset.supplierId||root.dataset.accountId;return 'dynamic-'+location.pathname.replace(/[^a-z0-9]/gi,'_')+'-'+kind+'-'+id+'-'+(path.join('.')||'root');
}
function applyElementOverrides(root=document){
 window.homeDashboard?.apply(elementOverrides);
 if(root.nodeType===Node.TEXT_NODE)root=root.parentElement;if(!root)return;
 for(const element of localTracked)if(!element.isConnected)localTracked.delete(element);
 if(!Object.keys(elementOverrides).length&&!localTracked.size)return;
 const elements=new Set(root===document?localTracked:[]);
 const consider=element=>{if(element?.nodeType===Node.ELEMENT_NODE&&appEditParts.visualTags.has(element.tagName.toLowerCase())&&!element.closest('.unified-app-editor,.app-edit-indicator,#admin-edit-controls,[data-layout-ui]'))elements.add(element);};
 consider(root);root.querySelectorAll?.('*').forEach(consider);
 if(root!==document){let parent=root.parentElement;while(parent){consider(parent);parent=parent.parentElement;}}

 const fontFamilies=appearanceStyles.fonts;
 for(const element of elements){if(!element.isConnected){localTracked.delete(element);continue;}if(element.closest('.unified-app-editor,.app-edit-indicator,#admin-edit-controls,[data-layout-ui]'))continue;const id=elementIdentity(element);if(!id)continue;const type=appEditParts.typeOf(element);element.dataset.appPart=type;if(!element.dataset.editId)element.dataset.editId=id;const settings=appEditParts.effective(elementOverrides,id,type);if(!Object.keys(settings).length&&!localTracked.has(element))continue;if(Object.keys(settings).length)localTracked.add(element);
  const properties={};if(Object.hasOwn(fontFamilies,settings.font)){properties['font-family']=fontFamilies[settings.font];properties['font-weight']=(settings.font==='opsilon'||appearanceStyles.isUploadedFont(settings.font))?'400':'600';}if(appearanceStyles.themedColourValue(settings.fontColour,'text'))properties.color=appearanceStyles.themedColourValue(settings.fontColour,'text');if(appearanceStyles.themedColourValue(settings.background,'background'))properties['background-color']=appearanceStyles.themedColourValue(settings.background,'background');if(appearanceStyles.colourValue(settings.iconColour)){properties.color=appearanceStyles.colourValue(settings.iconColour);properties.stroke=appearanceStyles.colourValue(settings.iconColour);}if(Number.isInteger(settings.iconSize)){properties.width=settings.iconSize+'px';properties.height=settings.iconSize+'px';}if(typeof settings.iconStroke==='number')properties['stroke-width']=String(settings.iconStroke);if(settings.backgroundImage==='')properties['background-image']='none';if(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(settings.backgroundImage||'')){properties['background-image']=appearanceStyles.themedImageValue(settings.backgroundImage);properties['background-size']='cover';properties['background-position']='center';properties['background-repeat']='no-repeat';}
  let styles=localStyleRecords.get(element);if(!styles){styles=new Map();localStyleRecords.set(element,styles);}for(const [property,baseline] of styles){if(!Object.hasOwn(properties,property)){if(baseline.value)element.style.setProperty(property,baseline.value,baseline.priority);else element.style.removeProperty(property);styles.delete(property);}}
  for(const [property,value] of Object.entries(properties)){if(!styles.has(property))styles.set(property,{value:element.style.getPropertyValue(property),priority:element.style.getPropertyPriority(property)});if(element.style.getPropertyValue(property)!==value||element.style.getPropertyPriority(property)!=='important')element.style.setProperty(property,value,'important');}
  if(element.tagName.toLowerCase()==='svg'){
   let icon=localIconRecords.get(element);if(!icon){icon={original:appEditParts.iconOriginal(element),choice:'',details:new Map()};localIconRecords.set(element,icon);}
   const choice=Object.hasOwn(appEditParts.icons,settings.icon)?settings.icon:'';
   if(choice!==icon.choice){const original=icon.original;element.innerHTML=choice?appEditParts.icons[choice].body:original.html;for(const attribute of ['viewBox','fill','stroke','stroke-width']){const value=choice?({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.8'})[attribute]:original[attribute];if(value===undefined||value===null)element.removeAttribute(attribute);else element.setAttribute(attribute,value);}icon.choice=choice;icon.details.clear();}
   const detailColour=appearanceStyles.colourValue(settings.iconDetailColour);for(const node of element.querySelectorAll('.icon-detail,.icon-detail *')){if(detailColour){if(!icon.details.has(node))icon.details.set(node,{value:node.style.getPropertyValue('stroke'),priority:node.style.getPropertyPriority('stroke')});node.style.setProperty('stroke',detailColour,'important');}else if(icon.details.has(node)){const baseline=icon.details.get(node);if(baseline.value)node.style.setProperty('stroke',baseline.value,baseline.priority);else node.style.removeProperty('stroke');icon.details.delete(node);}}
  }
  if(element.tagName.toLowerCase()==='img'){
   if(settings.image&&!localImageRecords.has(element)){let original=element.getAttribute('src');try{if(element.hasAttribute('data-app-image-original'))original=decodeURIComponent(element.getAttribute('data-app-image-original'));}catch{}localImageRecords.set(element,original);}
   if(settings.image&&element.getAttribute('src')!==settings.image)element.setAttribute('src',settings.image);else if(!settings.image&&localImageRecords.has(element)){const original=localImageRecords.get(element);if(original!==null)element.setAttribute('src',original);else element.removeAttribute('src');localImageRecords.delete(element);}
  }
  const previous=localTextRecords.get(element);
  const candidates=[];const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode,origin=appWording.source(node,originalNodes.get(node));if(origin)candidates.push({node,origin});}
  let spec=settings.text;
  if(!elementOverrides[id]?.text&&settings.texts){const key=candidates.find(item=>Object.hasOwn(settings.texts,item.origin.key))?.origin.key||['placeholder','title'].map(attr=>appWording.attribute(element,attr,originalAttributes.get(element)?.[attr])).find(key=>key&&Object.hasOwn(settings.texts,key));spec=key?settings.texts[key]:undefined;}
  let applied=false;
  if(spec?.attribute){const key=appWording.attribute(element,spec.attribute,originalAttributes.get(element)?.[spec.attribute]);if(key===spec.original){const rendered=spec.value??'';element.dataset.localWording=key;element.setAttribute(spec.attribute,rendered);originalAttributes.set(element,{...(originalAttributes.get(element)||{}),[spec.attribute]:{source:key,rendered}});localTextRecords.set(element,{attribute:spec.attribute,original:key,rendered});applied=true;}}
  else if(spec){const found=candidates.find(item=>item.origin.key===spec.original);if(found){const {node,origin}=found,choice=String(spec.value??'').replace(/\{(\w+)\}/g,(_,key)=>String(origin.values[key]??'{'+key+'}')),rendered=origin.source===origin.key?choice:origin.source.replace(origin.source.trim(),choice);element.dataset.localWording=spec.original;if(node.nodeValue!==rendered)node.nodeValue=rendered;originalNodes.set(node,{source:origin.source,key:origin.key,rendered});localTextRecords.set(element,{node,original:spec.original,source:origin.source,values:origin.values,rendered});applied=true;}}
  if(!applied&&previous){element.removeAttribute('data-local-wording');
   if(previous.attribute){const key=appWording.attribute(element,previous.attribute,originalAttributes.get(element)?.[previous.attribute]);if(key===previous.original){const rendered=interfaceLabel(key);element.setAttribute(previous.attribute,rendered);originalAttributes.set(element,{...(originalAttributes.get(element)||{}),[previous.attribute]:{source:key,rendered}});}}
   else if(previous.node?.isConnected&&previous.node.nodeValue===previous.rendered&&!appWording.data(previous.node.parentElement)){const choice=interfaceLabel(previous.original,previous.values),rendered=previous.source===previous.original?choice:previous.source.replace(previous.source.trim(),choice);previous.node.nodeValue=rendered;originalNodes.set(previous.node,{source:previous.source,key:previous.original,rendered});}
   localTextRecords.delete(element);
  }

 }
}
async function refreshElementOverrides(){try{const response=await fetch('/element-overrides',{headers:companyHeaders()});if(response.ok){elementOverrides=await response.json();applyElementOverrides();}}catch{}}
const localRoots=new Set();let localScheduled=false;
function queueElementRoot(node){const root=node.nodeType===Node.TEXT_NODE?node.parentElement:node;if(!root||root.nodeType!==Node.ELEMENT_NODE||root.closest('script,style,.unified-app-editor,.app-edit-indicator,#admin-edit-controls,[data-layout-ui]'))return;localRoots.add(root);}
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
