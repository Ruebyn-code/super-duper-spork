// Interface wording has an explicit source. A matching data value is never a label.
(function(root){
 const normal=value=>String(value).trim().replace(/\s+/g,' ');
 const excluded='script,style,input,textarea,select,option,[contenteditable]:not([contenteditable=false]),[data-user-text],.stock-name,#menu h3,#menu .sku,#menu .description,.supplier-title h3,.cart-row>strong';
 const data=element=>Boolean(element?.closest(excluded));
 const decode=value=>{try{return JSON.parse(decodeURIComponent(value||''));}catch{return null;}};
 function source(node,previous){
  const element=node?.parentElement;if(!element||data(element))return null;
  const template=element.dataset.appTemplate||element.dataset.interfaceLabel;
  if(template){let values={};try{values=JSON.parse(element.dataset.appValues||'{}');}catch{}const plain=template.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??'{'+key+'}')),rendered=typeof root.interfaceLabel==='function'?root.interfaceLabel(template,values):plain;if(![normal(plain),normal(rendered),normal(previous?.rendered??'')].includes(normal(node.nodeValue)))return null;return {key:template,source:template,values};}
  if(previous){if(node.nodeValue!==previous.rendered)return null;return {key:previous.key||normal(previous.source),source:previous.source,values:{}};}
  const key=normal(node.nodeValue),allowed=decode(element.dataset.interfaceCopy);
  if(Array.isArray(allowed)&&allowed.includes(key))return {key,source:node.nodeValue,values:{}};
  // Navigation clones already declare their original interface wording.
  if(element.dataset.localWording&&normal(element.textContent)===key)return {key:element.dataset.localWording,source:element.dataset.localWording,values:{}};
  return null;
 }
 function attribute(element,name,previous){
  if(!['placeholder','title'].includes(name)||element.closest('[data-user-text],[contenteditable]:not([contenteditable=false]),select,option'))return null;
  const value=element.getAttribute(name),allowed=decode(element.dataset.interfaceAttributes);
  if(previous&&value===previous.rendered)return previous.source;
  return allowed&&allowed[name]===value?value:null;
 }
 function label(element,key,values){element.dataset.interfaceLabel=key;if(values)element.dataset.appValues=JSON.stringify(values);return element;}
 const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0'};
 function htmlText(value){return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,key)=>{if(key[0]!=='#')return entities[key.toLowerCase()];const value=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return value>0&&value<=0x10ffff?String.fromCodePoint(value):all;});}
 function annotate(markup,labels){
  const known=new Set(labels.map(label=>typeof label==='string'?label:label.text)),stack=[],edits=[];
  const voidTags=new Set(['input','img','hr','br','meta','link','source','area','base','col','embed','param','track','wbr']);let offset=0,raw='';
  function text(value){const frame=stack.at(-1),key=normal(htmlText(value));if(frame&&!frame.protected&&known.has(key))frame.labels.add(key);}
  function finish(frame){const extra=(frame.labels.size?' data-interface-copy="'+encodeURIComponent(JSON.stringify([...frame.labels]))+'"':'')+(Object.keys(frame.attributes).length?' data-interface-attributes="'+encodeURIComponent(JSON.stringify(frame.attributes))+'"':'');if(extra)edits.push({at:frame.at,text:extra});}
  for(const match of markup.matchAll(/<!--[^]*?-->|<\/?[A-Za-z][^>]*>/g)){
   const token=match[0],part=token.match(/^<(\/?)([\w:-]+)/);if(!raw&&match.index>offset)text(markup.slice(offset,match.index));offset=match.index+token.length;if(!part)continue;
   const closing=Boolean(part[1]),tag=part[2].toLowerCase();if(raw){if(closing&&tag===raw){raw='';finish(stack.pop());}continue;}
   if(closing){const index=stack.map(frame=>frame.tag).lastIndexOf(tag);if(index>=0)for(const frame of stack.splice(index))finish(frame);continue;}
   const attributes={};for(const attr of token.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attributes[attr[1]]=htmlText(attr[2]??attr[3]);
   const protectedValue=stack.at(-1)?.protected||['script','style','textarea','select','option','svg'].includes(tag)||/\bdata-user-text(?:\s|=|>)/.test(token)||/\bcontenteditable(?:\s|=|>)/.test(token);
   const frame={tag,at:match.index+token.length-(token.endsWith('/>')?2:1),labels:new Set(),attributes:{},protected:protectedValue};
   if(!protectedValue)for(const key of ['placeholder','title'])if(known.has(attributes[key]))frame.attributes[key]=attributes[key];
   if(voidTags.has(tag)||token.endsWith('/>'))finish(frame);else stack.push(frame);if(['script','style','textarea'].includes(tag))raw=tag;
  }
  if(!raw&&offset<markup.length)text(markup.slice(offset));for(const frame of stack)finish(frame);
  for(const edit of edits.sort((a,b)=>b.at-a.at))markup=markup.slice(0,edit.at)+edit.text+markup.slice(edit.at);return markup;
 }
 const api={normal,data,source,attribute,label,annotate};if(typeof module==='object'&&module.exports)module.exports=api;else root.appWording=api;
})(globalThis);
