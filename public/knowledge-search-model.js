(function(root){
 const format=typeof module==='object'&&module.exports?require('./formatted-text'):root.formattedText;
 const fold=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
 const ignored=new Set('a an the and or i we you my our your me us how what where when can could would should do does did to of for in on at is are be it this that please show find search tell about make making prepare preparing assemble assembling cook cooking recipe recipes guide guides instruction instructions learn'.split(' '));
 const words=value=>{const all=[...new Set(fold(value).match(/[\p{L}\p{N}]+/gu)||[])],terms=all.filter(word=>!ignored.has(word));return(terms.length?terms:all.filter(word=>['recipe','recipes','guide','guides','instructions'].includes(word))).slice(0,16);};
 const spanText=spans=>(spans||[]).map(span=>span.text).join('');
 const blockText=block=>block.type==='table'?block.rows.map(row=>row.map(spanText).join(' ')).join('\n'):[block.type==='accordion'?block.title:'',spanText(block.spans),...(block.assets||[]).map(asset=>asset.name)].filter(Boolean).join('\n');
 function sections(article){
  let rich;try{if(article.richText)rich=format.normalize(article.richText);}catch{}
  if(!rich){const body=String(article.body||''),parts=[];let start=0;for(const chunk of body.split(/\n\s*\n/)){const at=body.indexOf(chunk,start);if(chunk.trim())for(let i=0;i<chunk.length;i+=800)parts.push({start:at+i,end:Math.min(at+i+1200,at+chunk.length),index:parts.length,title:'',text:chunk.slice(i,i+1200),media:[],rich:false});start=at+chunk.length;}return parts;}
  const result=[],stack=[];
  for(const [index,block]of rich.blocks.entries()){
   if(block.type==='heading'){
    while(stack.length&&stack.at(-1).level>=block.level){stack.pop().end=index-1;}
    const section={index,start:index,end:rich.blocks.length-1,level:block.level,title:[...stack.map(parent=>parent.label),spanText(block.spans)].filter(Boolean).join(' · '),label:spanText(block.spans),rich:true};result.push(section);stack.push(section);
   }else if(!result.length)result.push({index:0,start:0,end:rich.blocks.findIndex(item=>item.type==='heading')-1,title:'',level:0,rich:true});
  }
  if(!rich.blocks.some(block=>block.type==='heading')&&result[0])result[0].end=rich.blocks.length-1;
  for(const section of result){
   section.text='';section.media=[];section.blocks=[];
   for(let index=section.start;index<=section.end;index++){
    const block=rich.blocks[index],text=blockText(block);section.text+=(section.text?'\n':'')+text;section.blocks.push({index,text,type:block.type});
    if(['image','gallery','video'].includes(block.type))for(const asset of block.assets)section.media.push({type:block.type==='gallery'?'image':block.type,id:asset.id,name:asset.name,mime:asset.mime,blockIndex:index});
    if(block.type==='embed')section.media.push({type:'embed',name:spanText(block.spans)||'Watch video',blockIndex:index});
   }
  }
  return result;
 }
 const coverage=(value,terms)=>{const text=fold(value);return terms.length?terms.filter(word=>text.includes(word)).length/terms.length:0;};
 function excerpt(text,terms,max=700){const folded=fold(text),positions=terms.map(word=>folded.indexOf(word)).filter(index=>index>=0),start=positions.length?Math.max(0,Math.min(...positions)-80):0;return(start?'…':'')+text.slice(start,start+max).trim()+(text.length>start+max?'…':'');}
 function match(article,query,expansions=[]){
  const original=words(query);if(!original.length)return null;const variants=[original,...expansions.map(words).filter(terms=>terms.length)],title=article.title||'',whole=title+' '+(article.body||'');if(coverage(whole,original)<.5&&!variants.some(terms=>coverage(whole,terms)===1))return null;let best;
  for(const section of sections(article)){
   const text=[title,section.title,section.text].join(' '),cover=coverage(text,original),local=coverage(section.title+' '+section.text,original),expanded=Math.max(...variants.map(terms=>coverage(text,terms))),full=cover===1,heading=coverage(section.title,original),articleTitle=coverage(title,original);
   if(cover<.5&&expanded<1)continue;
   const score=Math.round(cover*55+Math.min(local,1)*20+heading*12+articleTitle*8+(expanded===1?8:0)+(full?12:0));
   let blockIndex=section.index;if(heading<1&&section.blocks?.length)blockIndex=section.blocks.slice().sort((a,b)=>coverage(b.text,original)-coverage(a.text,original)||a.index-b.index)[0].index;
   const nearby=section.media.filter(media=>section.title||Math.abs(media.blockIndex-blockIndex)<=5).sort((a,b)=>coverage(b.name,original)-coverage(a.name,original)||Math.abs(a.blockIndex-blockIndex)-Math.abs(b.blockIndex-blockIndex)),chosen=[],image=nearby.find(media=>media.type==='image'),video=nearby.find(media=>media.type==='video'||media.type==='embed');if(image)chosen.push(image);if(video)chosen.push(video);
   const written=section.blocks?.filter(block=>!['heading','image','gallery','video','embed','audio','document','divider'].includes(block.type)),steps=written?.filter(block=>['number','bullet'].includes(block.type)),previewText=/\b(how|make|prepare|cook|assemble)\b/i.test(query)&&steps?.length?steps.map(block=>block.text).join('\n'):written?.map(block=>block.text).join('\n')||section.text;
   const candidate={score,coverage:cover,clear:full&&(heading===1||articleTitle===1||coverage(section.blocks?.find(block=>block.index===blockIndex)?.text||section.text,original)===1),section:section.title,blockIndex,text:excerpt(previewText,original),media:chosen,rich:section.rich};if(!best||candidate.score>best.score)best=candidate;
  }
  return best;
 }
 function document(article,query,expansions=[]){
  const found=match(article,query,expansions);if(!found)return null;
  const params=new URLSearchParams({search:query,block:String(found.blockIndex),revision:String(article.revision)});
  return{id:'article:'+article.id,type:'Knowledge Library',title:article.title,text:found.text,url:'/knowledge-library?'+params+'#article-'+article.id,searchMatch:{score:found.score,coverage:found.coverage,clear:found.clear},preview:{section:found.section,text:found.text,media:found.media},target:{blockIndex:found.blockIndex,revision:article.revision}};
 }
 const api={words,sections,match,document};if(typeof module==='object'&&module.exports)module.exports=api;else root.knowledgeSearch=api;
})(globalThis);
