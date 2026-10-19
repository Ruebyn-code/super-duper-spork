(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.labelLayoutModel=factory();})(globalThis,()=>{
 const sources=['itemName','preparedAt','useBy','preparedBy','locationName','notes','text','createdAt','readyAt','shelfLife','labelText','printText'],fonts=['Arial','Verdana','Georgia','Courier New'],dateFormats=['date-time','date','time','short','iso'];
 function defaultLayout(){return{version:1,blocks:[
  {id:'name',source:'itemName',x:3.5,y:6,width:93,height:26,fontSize:9,bold:true},
  {id:'location',source:'locationName',x:3.5,y:32,width:93,height:7,fontSize:4},
  {id:'prepared',source:'preparedAt',prefix:'PREP  ',x:3.5,y:43,width:93,height:10,fontSize:5},
  {id:'expiry',source:'useBy',prefix:'USE BY  ',x:3.5,y:57,width:93,height:12,fontSize:5.5,bold:true},
  {id:'staff',source:'preparedBy',prefix:'BY  ',x:3.5,y:73,width:93,height:12,fontSize:4},
  {id:'note',source:'notes',x:3.5,y:86,width:93,height:12,fontSize:3.5}
 ].map(block=>({...block,text:'',prefix:'',fontFamily:'Arial',bold:false,italic:false,underline:false,align:'left',dateFormat:'date-time',visible:true,fit:true,...block}))};}
 function normalize(input){
  if(input==null)return null;
  const fail=()=>{throw Error('Choose a valid label design with 1–32 text fields.');},number=(value,min,max)=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)fail();return Math.round(value*100)/100;},string=(value,max)=>{if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail();return value;};
  if(input.version!==1||!Array.isArray(input.blocks)||input.blocks.length<1||input.blocks.length>32)fail();const ids=new Set();
  const result={version:1,blocks:input.blocks.map(value=>{if(!value||typeof value!=='object'||typeof value.id!=='string'||! /^[a-zA-Z0-9_-]{1,50}$/.test(value.id)||ids.has(value.id)||!sources.includes(value.source)||!fonts.includes(value.fontFamily)||!['left','center','right'].includes(value.align)||!dateFormats.includes(value.dateFormat))fail();ids.add(value.id);for(const key of ['bold','italic','underline','visible','fit'])if(typeof value[key]!=='boolean')fail();const result={id:value.id,source:value.source,text:string(value.text,400),prefix:string(value.prefix,80),x:number(value.x,0,97),y:number(value.y,0,97),width:number(value.width,3,100),height:number(value.height,3,100),fontSize:number(value.fontSize,3,32),fontFamily:value.fontFamily,align:value.align,dateFormat:value.dateFormat,...Object.fromEntries(['bold','italic','underline','visible','fit'].map(key=>[key,value[key]]))};for(const key of ['uppercase','inverse','required'])if(value[key]!==undefined){if(typeof value[key]!=='boolean')fail();result[key]=value[key];}if(value.wrap!==undefined){if(!['word','none'].includes(value.wrap))fail();result.wrap=value.wrap;}if(value.label!==undefined)result.label=string(value.label,80);if(result.x+result.width>100.01||result.y+result.height>100.01)fail();return result;})};if(input.readyDelay!=null){const delay=input.readyDelay,max={minutes:525600,hours:8760,days:365};if(!delay||!Object.hasOwn(max,delay.unit)||!Number.isInteger(delay.amount)||delay.amount<0||delay.amount>max[delay.unit])fail();result.readyDelay={amount:delay.amount,unit:delay.unit};}return result;
 }
 function value(batch,block){let text=block.source==='text'?block.text:['labelText','printText'].includes(block.source)?(Object.hasOwn(batch.fieldValues||{},block.id)?batch.fieldValues[block.id]:block.text):block.source==='shelfLife'?(batch.shelfLife==null?'':String(batch.shelfLife)+' '+(batch.shelfLife===1?String(batch.shelfLifeUnit).replace(/s$/,''):batch.shelfLifeUnit)):batch[block.source]||'';
  if(['preparedAt','useBy','readyAt','createdAt'].includes(block.source)&&text){const date=new Date(text),options={timeZone:'Australia/Melbourne'};if(block.dateFormat==='iso'){const parts=new Intl.DateTimeFormat('en-CA',{...options,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date),get=type=>parts.find(part=>part.type===type)?.value; text=get('year')+'-'+get('month')+'-'+get('day')+' '+get('hour')+':'+get('minute');}else{if(block.dateFormat!=='time')Object.assign(options,{day:'2-digit',month:block.dateFormat==='short'?'2-digit':'short',year:'2-digit'});if(block.dateFormat!=='date')Object.assign(options,{hour:'numeric',minute:'2-digit'});text=new Intl.DateTimeFormat('en-AU',options).format(date);}}
  text=text?block.prefix+text:'';return block.uppercase?text.toLocaleUpperCase('en-AU'):text;
 }

 function inputValues(input){if(input===undefined)return{};if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length>32)throw Error('Enter valid dynamic label values.');return Object.fromEntries(Object.keys(input).sort().map(id=>{const text=input[id];if(!/^[a-zA-Z0-9_-]{1,50}$/.test(id)||typeof text!=='string'||text.length>400||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text))throw Error('Enter valid dynamic label text of up to 400 characters.');return[id,text];}));}
 function fieldValues(layout,input,requireValues=true){const values=inputValues(input),fields=(layout?.blocks||[]).filter(block=>['labelText','printText'].includes(block.source));if(Object.keys(values).some(id=>!fields.some(block=>block.id===id)))throw Error('Choose values for this template’s dynamic fields only.');return Object.fromEntries(fields.map(block=>{const text=Object.hasOwn(values,block.id)?values[block.id]:block.text;if(requireValues&&block.visible&&block.required&&!text.trim())throw Error('Enter a value for '+(block.label||'the required label field')+'.');return[block.id,text];}));}
 function geometry(block,edge,dx,dy){let left=block.x,top=block.y,right=left+block.width,bottom=top+block.height;if(!edge){left=Math.max(0,Math.min(100-block.width,left+dx));top=Math.max(0,Math.min(100-block.height,top+dy));return{x:Math.round(left*100)/100,y:Math.round(top*100)/100,width:block.width,height:block.height};}if(edge.includes('w'))left=Math.max(0,Math.min(right-3,left+dx));if(edge.includes('e'))right=Math.min(100,Math.max(left+3,right+dx));if(edge.includes('n'))top=Math.max(0,Math.min(bottom-3,top+dy));if(edge.includes('s'))bottom=Math.min(100,Math.max(top+3,bottom+dy));return Object.fromEntries(Object.entries({x:left,y:top,width:right-left,height:bottom-top}).map(([key,value])=>[key,Math.round(value*100)/100]));}
 // Tolerances are percentages derived from screen pixels, so zoomed previews feel the same.
 function snapGeometry(block,edge,dx,dy,others=[],tolerance={x:1,y:1}){
  const box=geometry(block,edge,dx,dy),guides={x:null,y:null},round=value=>Math.round(value*100)/100;
  for(const [axis,size,startEdge,endEdge]of [['x','width','w','e'],['y','height','n','s']]){
   if(edge&&!edge.includes(startEdge)&&!edge.includes(endEdge))continue;
   const limit=tolerance[axis];if(!Number.isFinite(limit)||limit<0)continue;
   const targets=[0,50,100];
   for(const other of others)if(other.id!==block.id&&other.visible!==false)targets.push(other[axis],other[axis]+other[size]/2,other[axis]+other[size]);
   const start=box[axis],length=box[size],end=start+length,points=!edge?[start,start+length/2,end]:[edge.includes(startEdge)?start:end];
   let best=null;
   for(const point of points)for(const target of targets){
    const delta=target-point,distance=Math.abs(delta);if(!Number.isFinite(target)||distance>limit||(best&&distance>=best.distance))continue;
    const nextStart=!edge||edge.includes(startEdge)?start+delta:start,nextEnd=!edge||edge.includes(endEdge)?end+delta:end;
    if(nextStart<0||nextEnd>100||nextEnd-nextStart<3)continue;
    best={distance,target,start:nextStart,length:nextEnd-nextStart};
   }
   if(best){box[axis]=round(best.start);box[size]=round(best.length);guides[axis]=round(best.target);}
  }
  return{box,guides};
 }
 return{sources,fonts,dateFormats,defaultLayout,normalize,value,inputValues,fieldValues,geometry,snapGeometry};
});
