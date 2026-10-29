(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.rosterDragModel=api;})(globalThis,()=>{
 function threshold(pointerType){return pointerType==='touch'?8:5;}
 function edgeVelocity(point,start,end,edge=52,speed=720){
  if(![point,start,end,edge,speed].every(Number.isFinite)||end<=start||edge<=0||speed<0)return 0;
  edge=Math.min(edge,(end-start)/2);if(point<start-edge||point>end+edge)return 0;
  if(point<start+edge)return-speed*Math.min(1,(start+edge-point)/edge)**2;
  if(point>end-edge)return speed*Math.min(1,(point-end+edge)/edge)**2;
  return 0;
 }
 function scrollStep(remainder,velocity,elapsed){
  if(![remainder,velocity,elapsed].every(Number.isFinite))return{delta:0,remainder:0};
  const distance=remainder+velocity*Math.max(0,Math.min(32,elapsed))/1000,delta=Math.trunc(distance)||0;
  return{delta,remainder:distance-delta};
 }
 return{threshold,edgeVelocity,scrollStep};
});
