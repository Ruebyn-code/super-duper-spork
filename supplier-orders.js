function splitBySupplier(order){
 const grouped=new Map();
 for(const item of order.items){
  if(!item.supplierId)throw Error('Order item is missing its supplier.');
  if(!grouped.has(item.supplierId))grouped.set(item.supplierId,{orderId:order.id,supplierId:item.supplierId,supplier:item.supplier,requester:order.name,phone:order.phone,location:order.location,notes:order.notes,items:[],total:0,pricePending:false});
  const supplierOrder=grouped.get(item.supplierId);supplierOrder.items.push({...item});if(item.price===null)supplierOrder.pricePending=true;else supplierOrder.total+=item.price*item.quantity;
 }
 return [...grouped.values()];
}
module.exports={splitBySupplier};
