(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.labelLayoutModel=factory();})(globalThis,()=>{
 const sources=['itemName','preparedAt','useBy','preparedBy','locationName','notes','text'],fonts=['Arial','Verdana','Georgia','Courier New'],dateFormats=['date-time','date','time','short','iso'];
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
  return{version:1,blocks:input.blocks.map(value=>{if(!value||typeof value!=='object'||typeof value.id!=='string'||! /^[a-zA-Z0-9_-]{1,50}$/.test(value.id)||ids.has(value.id)||!sources.includes(value.source)||!fonts.includes(value.fontFamily)||!['left','center','right'].includes(value.align)||!dateFormats.includes(value.dateFormat))fail();ids.add(value.id);for(const key of ['bold','italic','underline','visible','fit'])if(typeof value[key]!=='boolean')fail();const result={id:value.id,source:value.source,text:string(value.text,400),prefix:string(value.prefix,80),x:number(value.x,0,97),y:number(value.y,0,97),width:number(value.width,3,100),height:number(value.height,3,100),fontSize:number(value.fontSize,3,32),fontFamily:value.fontFamily,align:value.align,dateFormat:value.dateFormat,...Object.fromEntries(['bold','italic','underline','visible','fit'].map(key=>[key,value[key]]))};if(result.x+result.width>100.01||result.y+result.height>100.01)fail();return result;})};
 }
 function value(batch,block){let text=block.source==='text'?block.text:batch[block.source]||'';
  if(['preparedAt','useBy'].includes(block.source)&&text){const date=new Date(text),options={timeZone:'Australia/Melbourne'};if(block.dateFormat==='iso'){const parts=new Intl.DateTimeFormat('en-CA',{...options,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date),get=type=>parts.find(part=>part.type===type)?.value; text=get('year')+'-'+get('month')+'-'+get('day')+' '+get('hour')+':'+get('minute');}else{if(block.dateFormat!=='time')Object.assign(options,{day:'2-digit',month:block.dateFormat==='short'?'2-digit':'short',year:'2-digit'});if(block.dateFormat!=='date')Object.assign(options,{hour:'numeric',minute:'2-digit'});text=new Intl.DateTimeFormat('en-AU',options).format(date);}}
  return text?block.prefix+text:'';
 }
 return{sources,fonts,dateFormats,defaultLayout,normalize,value};
});
