// Effective corrections live in the private company catalogue; source orders stay immutable.
const snapshots=new WeakMap();
function plans(events){const result=new Map();for(const event of events||[])if(event?.orderId&&event.after)result.set(event.orderId,event);return result;}
function apply(record,event){
 if(!event||record.status!=='requested')return record;
 if(event.orderId!==record.id||event.companyId!==(record.companyId||'default')||(record.locationId?event.locationId!==record.locationId:event.orderOwnerId!==record.requestOwnerId))throw Error('Order edit scope mismatch.');
 const {priceAdjustment,...original}=record,items=event.after.items.map(item=>({...item})),total=items.reduce((sum,item)=>sum+(item.price===null?0:item.price*item.quantity),0);
 const result={...original,items,total,pricePending:items.some(item=>item.price===null),reference:event.after.reference,notes:event.after.notes,orderEdit:{revision:event.revision,updatedAt:event.at,updatedBy:event.actorName}};
 snapshots.set(result,event);return result;
}
function priceIsCurrent(record,itemId,version){const edit=snapshots.get(record);return !edit||edit.priceVersions?.[itemId]!==version;}
module.exports={plans,apply,priceIsCurrent};
