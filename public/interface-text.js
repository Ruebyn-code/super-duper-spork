let interfaceOverrides=window.appBootstrap?.interfaceText||{};const originalNodes=new WeakMap(),originalAttributes=new WeakMap();
// Keep earlier custom wording and edit identities while shortening default user menus.
const interfaceDefaults={'Accounts & permissions':'Users','Manage accounts':'Users','Create / edit account':'Create user','Create account':'Create user','Edit account':'Edit user','Save account':'Save user','Suppliers & delivery':'Suppliers','Saving account…':'Saving user…','Account removed.':'User removed.','Account saved. Location, permission or password changes require that user to sign in again.':'User saved. Location, permission or password changes require that user to sign in again.','Administrator — full access, including accounts':'Administrator — full access, including users','Assign users to locations and choose their permissions. Users at the same location share sales, stock counts, par levels and the ordering budget. Only administrators can manage locations, users and sender emails.':'Manage users, permissions and location access.','Add suppliers, then add their stock. Changes are saved on this computer.':'Manage suppliers, stock and order email.','Select a location to set its sender email and sending credentials. All users assigned to that location send orders through this setup. Only administrators can change it.':'Choose a location, then edit its order email settings.'};
function applyInterfaceText(root=document){
 const replacements={...interfaceDefaults,...interfaceOverrides};
 if(root.nodeType===Node.TEXT_NODE)root=root.parentElement;if(!root)return;
 const ignored=element=>element?.closest('script,style,[data-local-wording],[data-copy-editor],[data-user-text],#menu h3,#menu .sku,#menu .description,.stock-name,.supplier-title h3,.cart-row>strong,input,textarea');
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(ignored(node.parentElement))continue;const actual=node.nodeValue;let original=originalNodes.get(node);if(!original||actual!==original.rendered){original={source:actual,rendered:actual};originalNodes.set(node,original);}const key=original.source.trim().replace(/\s+/g,' ');const value=Object.hasOwn(replacements,key)?original.source.replace(original.source.trim(),(replacements[key]??'')):original.source;if(node.nodeValue!==value)node.nodeValue=value;original.rendered=value;}
 const elements=[...(root.matches?.('[placeholder],[title]')?[root]:[]),...(root.querySelectorAll?.('[placeholder],[title]')||[])];for(const element of elements){if(element.closest('[data-copy-editor]')||element.hasAttribute('data-local-wording'))continue;let source=originalAttributes.get(element);if(!source){source={};for(const attr of ['placeholder','title'])if(element.hasAttribute(attr))source[attr]=element.getAttribute(attr);originalAttributes.set(element,source);}for(const [attr,value] of Object.entries(source))element.setAttribute(attr,Object.hasOwn(interfaceOverrides,value)?(interfaceOverrides[value]??''):value);}
}
async function refreshInterfaceText(){try{const response=await fetch('/interface-text');if(response.ok){interfaceOverrides=await response.json();applyInterfaceText();window.dispatchEvent(new Event('interface-text-updated'));}}catch{}}
const textRoots=new Set();let scheduled=false;
function queueInterfaceRoot(node){const root=node.nodeType===Node.TEXT_NODE?node.parentElement:node;if(!root||root.nodeType!==Node.ELEMENT_NODE||root.closest('script,style,[data-copy-editor],[data-user-text],[data-local-wording]'))return;textRoots.add(root);}
const textObserver=new MutationObserver(records=>{
 for(const record of records){if(record.type==='characterData')queueInterfaceRoot(record.target);else for(const node of record.addedNodes)queueInterfaceRoot(node);}
 if(scheduled||!textRoots.size)return;scheduled=true;queueMicrotask(()=>{
  scheduled=false;const roots=[...textRoots].filter(root=>root.isConnected);textRoots.clear();textObserver.disconnect();
  try{for(const root of roots)if(!roots.some(other=>other!==root&&other.contains(root)))applyInterfaceText(root);}finally{textObserver.observe(document.documentElement,{subtree:true,childList:true,characterData:true});}
 });
});
textObserver.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
if(window.appBootstrap&&Object.hasOwn(window.appBootstrap,'interfaceText'))applyInterfaceText();else refreshInterfaceText();

function interfaceLabel(original,values={}){const template=Object.hasOwn(interfaceOverrides,original)?(interfaceOverrides[original]??''):(interfaceDefaults[original]??original);return template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}'));}
