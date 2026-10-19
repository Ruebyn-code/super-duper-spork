(function(root){
 const pages=['index','home','cart','sales','reporting','stock-count','stock-transfers','admin','accounts','settings','settings-hub','award-settings','communications','rostering','knowledge-library','ops-management','labels','login','accept-invite','setup'];
 const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_.:-]{1,240}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 function key(attributes){
  for(const [attribute,kind] of [['data-product-id','product'],['data-supplier-id','supplier'],['data-account-id','account'],['data-location-id','location'],['data-company-id','company']])if(attributes[attribute])return kind+':'+attributes[attribute];
  return attributes['data-layout-key']||attributes['data-edit-id']||'';
 }
 function ordered(items,order,getKey=value=>value){const ranks=new Map((order||[]).map((id,index)=>[id,index]));return items.map((item,index)=>({item,index,rank:ranks.get(getKey(item))??Infinity})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(entry=>entry.item);}
 // Merge the visible subset into the saved order, retaining off-screen cards.
 function mergeOrder(previous,visible){const selected=new Set(visible),result=[];let index=0;for(const id of previous||[])result.push(selected.has(id)?visible[index++]:id);for(;index<visible.length;index++)result.push(visible[index]);return [...new Set(result)];}
 function validateGroups(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>2000)throw Error('Choose a valid page layout.');
  const groups=Object.create(null);let count=0;
  for(const [parent,order] of Object.entries(input)){if(!validId(parent)||!Array.isArray(order)||order.length>3000||order.some(id=>!validId(id))||new Set(order).size!==order.length||(count+=order.length)>12000)throw Error('Invalid or overly large layout.');if(order.length)groups[parent]=[...order];}
  return groups;
 }
 function attributes(source){const result={};for(const match of source.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))result[match[1]]=match[2]??match[3]??match[4]??'';return result;}
 const voidTags=new Set(['input','img','hr','br','meta','link','source','area','base','col','embed','param','track','wbr']);
 function renderMarkup(markup,groups){
  if(!Object.keys(groups||{}).length)return markup;
  const tree={children:[]},stack=[tree];let offset=0,raw='';
  for(const match of markup.matchAll(/<!--[^]*?-->|<\/?[A-Za-z][^>]*>/g)){
   let parent=stack.at(-1);if(match.index>offset)parent.children.push(markup.slice(offset,match.index));const token=match[0];offset=match.index+token.length;
   const tagMatch=token.match(/^<(\/?)([\w:-]+)/);if(!tagMatch){parent.children.push(token);continue;}const closing=tagMatch[1]==='/',tag=tagMatch[2].toLowerCase();
   if(raw){if(closing&&tag===raw){parent.end=token;stack.pop();raw='';}else parent.children.push(token);continue;}
   if(closing){if(parent.tag===tag){parent.end=token;stack.pop();}else parent.children.push(token);continue;}
   const node={tag,attributes:attributes(token.slice(tagMatch[0].length,-1)),start:token,end:'',children:[]};parent.children.push(node);if(!voidTags.has(tag)&&!token.endsWith('/>')){stack.push(node);if(['script','style','textarea'].includes(tag))raw=tag;}
  }
  if(offset<markup.length)stack.at(-1).children.push(markup.slice(offset));
  function render(node){if(typeof node==='string')return node;const order=groups[key(node.attributes||{})],children=[...node.children];
   if(order&&['main','section','article','div','nav','form','fieldset','details'].includes(node.tag)&&!/(?:^|\s)(?:app-shell|app-page|admin-sidebar|secondary-sidebar|sidebar-footer|password-control|location-picker)(?:\s|$)/.test(node.attributes.class||'')){
    const selected=new Set(order),slots=[];for(let index=0;index<children.length;index++)if(typeof children[index]!=='string'&&selected.has(key(children[index].attributes)))slots.push(index);
    const original=node.children.filter(child=>typeof child!=='string'&&key(child.attributes)).map(child=>key(child.attributes));
    if(slots.length>1){const sorted=ordered(slots.map(index=>children[index]),order,child=>key(child.attributes));slots.forEach((slot,index)=>children[slot]=sorted[index]);node.start=node.start.replace(/>$/, ' data-layout-default="'+encodeURIComponent(JSON.stringify(original))+'">');}
   }
   return (node.start||'')+children.map(render).join('')+(node.end||'');
  }
  return render(tree);
 }
 const api={pages,validId,key,ordered,mergeOrder,validateGroups,renderMarkup};if(typeof module==='object'&&module.exports)module.exports=api;else root.appLayoutModel=api;
})(globalThis);
