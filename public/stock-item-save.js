(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.stockItemSave=model;})(typeof globalThis==='object'?globalThis:this,function(){
 function create({id=null,body=null,level=null,calculation=null}={}){
  let signature=body===null?null:JSON.stringify(body),calculationSignature=JSON.stringify(calculation),calculationUncertain=false,partial=false;
  return {id,level,async save(body,level,{stock,target,onStock,calculation,saveCalculation}){
   let changed=false;const next=JSON.stringify(body);
   try{
    if(!this.id||signature!==next){const saved=await stock(this.id,body);this.id=saved.id;signature=next;changed=true;if(onStock)onStock(saved);}
    if(level!==undefined&&level!==this.level){await target(this.id,level);this.level=level;changed=true;}
    if(calculation!==undefined&&(calculationUncertain||JSON.stringify(calculation)!==calculationSignature)){calculationUncertain=true;await saveCalculation(this.id,calculation);calculationSignature=JSON.stringify(calculation);calculationUncertain=false;changed=true;}
    partial=false;return {id:this.id,changed};
   }catch(error){partial=partial||changed;error.partial=partial;throw error;}
  }};
 }
 return {create};
});
