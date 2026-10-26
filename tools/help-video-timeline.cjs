// Documentation authoring only: deterministic, frame-aligned timing shared by
// the rendered video, WebVTT captions and the player's step links.
const framesPerSecond=24,transitionSeconds=.5;
const frameTime=value=>Math.round(value*framesPerSecond)/framesPerSecond;
function timeline(steps){
 if(!steps.length)throw Error('A video needs at least one instruction.');
 let elapsed=0;
 const chapters=steps.map((instruction,index)=>{
  // Allow time to find the control as well as read the instruction. Do not
  // subtract the crossfade from this reading time.
  const duration=frameTime(Math.max(6,instruction.trim().split(/\s+/).length/3.2+1.5));
  const startSeconds=elapsed;elapsed=frameTime(elapsed+duration);
  return{startSeconds,endSeconds:elapsed,seekSeconds:frameTime(startSeconds+(index?transitionSeconds/2:0))};
 });
 return{framesPerSecond,transitionSeconds,chapters,durationSeconds:elapsed};
}
const stamp=seconds=>new Date(Math.round(seconds*1000)).toISOString().slice(11,23);
function captions(steps,chapters){
 const clean=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 return['WEBVTT','',...chapters.flatMap((chapter,index)=>[String(index+1),stamp(chapter.startSeconds)+' --> '+stamp(chapter.endSeconds),clean('Step '+(index+1)+': '+steps[index]),''])].join('\n');
}
function videoArguments(frames,points,pointer,movie,timing){
 const {chapters,durationSeconds:total}=timing,half=transitionSeconds/2,args=['-hide_banner','-loglevel','error','-y'],filters=[];
 frames.forEach((file,index)=>{
  const chapter=chapters[index],duration=chapter.endSeconds-chapter.startSeconds+(index?half:0)+(index<frames.length-1?half:0);
  args.push('-loop','1','-framerate',String(framesPerSecond),'-t',String(duration),'-i',file);
 });
 const pointed=points.flatMap((point,index)=>point?[index]:[]);
 if(pointed.length){
  args.push('-loop','1','-framerate',String(framesPerSecond),'-i',pointer);
  filters.push('['+frames.length+':v]format=rgba,split='+pointed.length+pointed.map(index=>'[pointer'+index+']').join(''));
 }
 frames.forEach((_,index)=>{
  filters.push('['+index+':v]format=yuv420p,setsar=1,settb=AVTB,setpts=PTS-STARTPTS[still'+index+']');
  const point=points[index];
  if(!point){filters.push('[still'+index+']fps='+framesPerSecond+',settb=AVTB[step'+index+']');return;}
  const previous=points[index-1]||{x:Math.min(1210,point.x+110),y:Math.min(700,point.y+70)};
  // A single, eased movement helps locate the control; the text and screen stay
  // still for reading. This pointer illustrates focus, never a real click/save.
  const ease='(min(1,t/1.15)*min(1,t/1.15)*(3-2*min(1,t/1.15)))';
  const coordinate=axis=>String(previous[axis]-(axis==='x'?12:7))+'+'+(point[axis]-previous[axis])+'*'+ease;
  filters.push('[pointer'+index+']fade=t=in:st=0:d=0.3:alpha=1[tip'+index+']');
  filters.push('[still'+index+'][tip'+index+']overlay=x=\''+coordinate('x')+'\':y=\''+coordinate('y')+'\':shortest=1:format=yuv420,fps='+framesPerSecond+',settb=AVTB[step'+index+']');
 });
 let last='step0';
 for(let index=1;index<frames.length;index++){
  const next='blend'+index;
  filters.push('['+last+'][step'+index+']xfade=transition=fade:duration='+transitionSeconds+':offset='+(chapters[index].startSeconds-half)+',fps='+framesPerSecond+',settb=AVTB['+next+']');last=next;
 }
 // Animate only the small progress strip; do not zoom the captions or pan away
 // from an action while someone is trying to read it.
 filters.push('color=c=0xd7e3ef:s=1232x6:r='+framesPerSecond+':d='+total+'[track]');
 filters.push('color=c=0x008cff:s=1232x6:r='+framesPerSecond+':d='+total+'[fill]');
 filters.push('[track][fill]overlay=x=\'-w+w*min(t/'+(total-1/framesPerSecond)+',1)\':y=0:shortest=1[progress]');
 filters.push('['+last+'][progress]overlay=x=24:y=946:shortest=1,format=yuv420p[out]');
 return[...args,'-filter_complex_threads','1','-filter_complex',filters.join(';'),'-map','[out]','-t',String(total),'-r',String(framesPerSecond),'-c:v','libx264','-preset','veryfast','-crf','24','-threads','2','-movflags','+faststart','-an',movie];
}
module.exports={timeline,captions,videoArguments,framesPerSecond,transitionSeconds};
