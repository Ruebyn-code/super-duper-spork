/* Local PDF/photo preparation; source pages leave the browser only on explicit Read report. */
window.hourlyReportSource=async(file,numbers)=>{
 if(file.size>5000000)throw Error('Choose a report up to 5 MB.');
 const selected=numbers.split(',').map(value=>Number(value.trim()));if(!selected.length||selected.length>3||new Set(selected).size!==selected.length||selected.some(value=>!Number.isInteger(value)||value<1||value>20))throw Error('Choose up to three page numbers from 1 to 20.');
 // Greyscale with a 1–99% contrast stretch: dark print gets darker and paper whiter, without changing the layout.
 function enhance(context,width,height){try{const frame=context.getImageData(0,0,width,height),pixels=frame.data,levels=new Uint32Array(256);for(let i=0;i<pixels.length;i+=4){const grey=Math.round(pixels[i]*.299+pixels[i+1]*.587+pixels[i+2]*.114);pixels[i]=grey;levels[grey]++;}const total=width*height;let low=0,high=255,seen=0;for(;low<255&&(seen+=levels[low])<total*.01;low++);seen=0;for(;high>0&&(seen+=levels[high])<total*.01;high--);if(high-low<40){low=Math.max(0,low-20);high=Math.min(255,high+20);}const span=Math.max(1,high-low);for(let i=0;i<pixels.length;i+=4){const value=Math.max(0,Math.min(255,Math.round((pixels[i]-low)*255/span)));pixels[i]=pixels[i+1]=pixels[i+2]=value;}context.putImageData(frame,0,0);}catch{}}
 const encode=(canvas,page)=>{const data=canvas.toDataURL('image/jpeg',.85).split(',')[1];if(data.length>2000000)throw Error('This page is too detailed. Try a smaller image.');return{page,mime:'image/jpeg',data};};
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
  const library=await import('/vendor/invoice/pdf.min.mjs');library.GlobalWorkerOptions.workerSrc='/vendor/invoice/pdf.worker.min.mjs';const task=library.getDocument({data:new Uint8Array(await file.arrayBuffer()),standardFontDataUrl:'/vendor/invoice/standard_fonts/',isEvalSupported:false}),pdf=await task.promise;
  try{if(selected.some(number=>number>pdf.numPages))throw Error('A selected page is outside this report.');const images=[],lines=[];for(const number of selected){const page=await pdf.getPage(number),base=page.getViewport({scale:1}),view=page.getViewport({scale:Math.min(2.5,2000/Math.max(base.width,base.height))}),canvas=document.createElement('canvas');canvas.width=Math.floor(view.width);canvas.height=Math.floor(view.height);try{const text=await page.getTextContent();lines.push('Page '+number,...text.items.map(item=>item.str+(item.hasEOL?'\n':' ')));await page.render({canvasContext:canvas.getContext('2d'),viewport:view,background:'white'}).promise;images.push(encode(canvas,number));}finally{canvas.width=canvas.height=0;page.cleanup();}}const sourceText=lines.join('\n');if(sourceText.length>60000)throw Error('Choose fewer PDF pages (up to 60,000 characters).');return{sourceText,images};}finally{await pdf.destroy();}
 }
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||selected.length!==1||selected[0]!==1)throw Error('Choose a PDF, JPEG, PNG or WebP report. A photo has only page 1.');
 // Photos: boost contrast for faint thermal print, and send a long receipt as up to three overlapping full-resolution
 // slices (top to bottom) instead of one shrunken image, so small text stays readable.
 const url=URL.createObjectURL(file),image=new Image();try{image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>40000000)throw Error('Choose a smaller report photo.');
  const width=image.naturalWidth,height=image.naturalHeight,count=Math.max(1,Math.min(3,Math.ceil(height/width/1.6))),overlap=count>1?Math.round(height*0.04):0,slice=Math.ceil(height/count)+overlap,images=[];
  for(let index=0;index<count;index++){
   const top=Math.max(0,Math.min(height-slice,Math.round(index*height/count)-(index?overlap:0))),part=Math.min(slice,height-top),scale=Math.min(1,2000/Math.max(width,part)),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.floor(width*scale));canvas.height=Math.max(1,Math.floor(part*scale));
   try{const context=canvas.getContext('2d',{willReadFrequently:true});context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.imageSmoothingQuality='high';context.drawImage(image,0,top,width,part,0,0,canvas.width,canvas.height);enhance(context,canvas.width,canvas.height);images.push(encode(canvas,index+1));}finally{canvas.width=canvas.height=0;}
  }
  return{sourceText:'',images};
 }finally{URL.revokeObjectURL(url);}
};
