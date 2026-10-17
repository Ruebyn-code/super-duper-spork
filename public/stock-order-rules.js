(function(root,factory){const model=factory();if(typeof module==='object'&&module.exports)module.exports=model;else root.stockOrderRules=model;})(typeof globalThis==='object'?globalThis:this,function(){
 const limit=999;
 function minimum(product){return Number.isInteger(product?.minimumOrder)&&product.minimumOrder>=1&&product.minimumOrder<=limit?product.minimumOrder:1;}
 function multiples(product){return ['multiples','cutoff'].includes(product?.orderRule);}
 function cutoff(product){return Number.isInteger(product?.roundingCutoff)&&product.roundingCutoff>=0&&product.roundingCutoff<=minimum(product)?product.roundingCutoff:Math.min(5,minimum(product));}
 function round(product,quantity){
  if(typeof quantity!=='number'||!Number.isFinite(quantity)||quantity<0)return null;
  if(quantity===0)return 0;
  const min=minimum(product),whole=Math.ceil(quantity);
  if(product?.orderRule==='cutoff'){
   const remainder=quantity%min,base=quantity-remainder;
   return Math.max(min,base+(remainder>0&&remainder>=cutoff(product)?min:0));
  }
  return multiples(product)?Math.ceil(whole/min)*min:Math.max(min,whole);
 }
 function maximum(product){return multiples(product)?Math.floor(limit/minimum(product))*minimum(product):limit;}
 function valid(product,quantity){return Number.isInteger(quantity)&&quantity>0&&quantity<=limit&&round(product,quantity)===quantity;}
 function decrease(product,quantity){const min=minimum(product);return quantity<=min?0:Math.max(min,quantity-(multiples(product)?min:1));}
 function describe(product){const min=minimum(product);return min===1?'':product?.orderRule==='cutoff'?'Order units: '+min+' · Rounding cutoff: '+cutoff(product):multiples(product)?'Order in multiples of '+min:'Minimum order: '+min;}
 function recommendation(product,level,counted){
  if(typeof level!=='number'||!Number.isFinite(level)||level<0||typeof counted!=='number'||!Number.isFinite(counted)||counted<0)return null;
  return round(product,Math.max(0,(level*1000-Math.round(counted*1000))/1000));
 }
 return {limit,minimum,multiples,cutoff,round,maximum,valid,decrease,describe,recommendation};
});
