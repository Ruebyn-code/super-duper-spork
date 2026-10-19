let interfaceOverrides=window.appBootstrap?.interfaceText||{};const originalNodes=new WeakMap(),originalAttributes=new WeakMap();
// Keep earlier custom wording and edit identities while shortening default user menus.
const interfaceDefaults={'Collapse sidebar':'Compact navigation','Keep sidebar expanded':'Keep navigation expanded','Administration':'Admin','Location totals':'Quarter totals','Loading location totals…':'Loading quarter totals…','Unable to load location totals. Try again shortly.':'Unable to load quarter totals. Try again shortly.','Count stock by supplier. Leave uncounted items blank; enter 0 for out-of-stock items.':'Count stock by storage group. Leave uncounted items blank; enter 0 for out-of-stock items.','ADMINISTRATOR ACCESS':'HEAD OFFICE ACCESS','Create your administrator':'Create your Head Office account','Create administrator':'Create Head Office account','Sign in to browse stock and place orders. Administrators can also manage suppliers and stock.':'Sign in to order, record sales and count stock. Franchisees manage users in their locations; Head Office has full access.','Administrator':'Head Office','Ordering user':'Ordering manager','Administrators can review counts from every location.':'Head Office can review counts from every location.','Only administrators can change this location’s sender email and sending credentials.':'Only Head Office can change this location’s sender email and sending credentials.','Accounts & permissions':'Users','Manage accounts':'Users','Create / edit account':'Create user','Create account':'Create user','Edit account':'Edit user','Save account':'Save user','Suppliers & delivery':'Suppliers','Saving account…':'Saving user…','Account removed.':'User removed.','Account saved. Location, permission or password changes require that user to sign in again.':'User saved. Location, permission or password changes require that user to sign in again.','Administrator — full access, including accounts':'Head Office — full access to everything','Assign users to locations and choose their permissions. Users at the same location share sales, stock counts, par levels and the ordering budget. Only administrators can manage locations, users and sender emails.':'Manage users, permissions and location access.','Add suppliers, then add their stock. Changes are saved on this computer.':'Manage suppliers, stock and order email.','Select a location to set its sender email and sending credentials. All users assigned to that location send orders through this setup. Only administrators can change it.':'Choose a location, then edit its order email settings.'};
function applyInterfaceText(root=document){
 const replacements={...interfaceDefaults,...interfaceOverrides};
 if(root.nodeType===Node.TEXT_NODE)root=root.parentElement;if(!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(walker.nextNode()){
  const node=walker.currentNode,element=node.parentElement;if(element?.closest('[data-copy-editor],[data-local-wording]'))continue;
  const origin=appWording.source(node,originalNodes.get(node));if(!origin)continue;
  const choice=Object.hasOwn(replacements,origin.key)?replacements[origin.key]:origin.key;
  const rendered=String(choice??'').replace(/\{(\w+)\}/g,(_,key)=>String(origin.values[key]??'{'+key+'}'));
  const value=origin.source===origin.key?rendered:origin.source.replace(origin.source.trim(),rendered);
  if(node.nodeValue!==value)node.nodeValue=value;originalNodes.set(node,{source:origin.source,key:origin.key,rendered:value});
 }
 const elements=[...(root.matches?.('[placeholder],[title]')?[root]:[]),...(root.querySelectorAll?.('[placeholder],[title]')||[])];
 for(const element of elements){if(element.closest('[data-copy-editor]')||element.hasAttribute('data-local-wording'))continue;const record=originalAttributes.get(element)||{};
  for(const attr of ['placeholder','title']){const key=appWording.attribute(element,attr,record[attr]);if(key===null)continue;const value=Object.hasOwn(interfaceOverrides,key)?(interfaceOverrides[key]??''):key;element.setAttribute(attr,value);record[attr]={source:key,rendered:value};}
  originalAttributes.set(element,record);
 }
}
async function refreshInterfaceText(){try{const response=await fetch('/interface-text',{headers:companyHeaders()});if(response.ok){interfaceOverrides=await response.json();applyInterfaceText();window.dispatchEvent(new Event('interface-text-updated'));}}catch{}}
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
