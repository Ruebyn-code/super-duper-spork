// Stock movement ledger for the rebuilt app.
//
// The current app treats a stock count as a physical snapshot and only lets
// confirmed transfers and counts move stock. The rebuild keeps the same count
// records and adds a movement ledger: a count sets the balance, a confirmed
// order delivery adds stock, and a transfer moves it between two locations.
// Nothing is edited in place — on-hand is the sum of a location/product's
// movements — and quantities are whole thousandths, like the current app's
// three-decimal par maths, so averages never drift.
const crypto=require('node:crypto');
const MAX_QUANTITY=1000000;
const toThousands=value=>Math.round(value*1000);
const validQuantity=(value,max=MAX_QUANTITY)=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=max&&Math.abs(value*1000-toThousands(value))<1e-6;
const key=(locationId,productId)=>locationId+'|'+productId;
function movement({companyId,locationId,productId,kind,delta,refId,at,actorId}){
 if(!Number.isInteger(delta)||delta===0)throw Error('A stock movement needs a non-zero whole-thousandths change.');
 return {id:crypto.randomUUID(),companyId,locationId,productId,kind,delta,refId:refId||null,at,actorId:actorId||null};
}
// locationId|productId -> quantity in thousandths.
function balances(movements){
 const totals=new Map();
 for(const record of movements||[]){
  if(!record||typeof record.delta!=='number'||!record.locationId||!record.productId)continue;
  const at=key(record.locationId,record.productId);
  totals.set(at,(totals.get(at)||0)+record.delta);
 }
 return totals;
}
function onHand(movements,locationId){
 const result=new Map();
 for(const [at,total] of balances(movements)){
  const split=at.indexOf('|');
  if(at.slice(0,split)===locationId)result.set(at.slice(split+1),total/1000);
 }
 return result;
}
module.exports={MAX_QUANTITY,toThousands,validQuantity,key,movement,balances,onHand};
