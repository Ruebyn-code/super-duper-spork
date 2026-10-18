const fs=require('node:fs/promises'),path=require('node:path');
const par=require('./par-levels'),orderCosts=require('./order-cost-period');
async function read(dir){try{return JSON.parse(await fs.readFile(path.join(dir,'stock-transfers.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return [];throw error;}}
function movements(records,session){
 const result=[],seen=new Set();for(const record of records||[]){if(record?.status!=='received'||seen.has(record.id)||!Array.isArray(record.items))continue;seen.add(record.id);
  const outgoing=record.from?.id===session.locationId,incoming=record.to?.id===session.locationId;if(!outgoing&&!incoming)continue;
  const createdAt=outgoing?record.createdAt:record.receivedAt;if(!Number.isFinite(Date.parse(createdAt)))continue;
  for(const [index,item] of record.items.entries()){const product=outgoing?item.source:item.target,quantity=outgoing?-item.quantity:item.targetQuantity;if(!product||!Number.isFinite(quantity))continue;result.push({id:record.id+'-'+index,transferId:record.id,createdAt,receivedAt:record.receivedAt,product,quantity,direction:outgoing?'out':'in',counterpart:outgoing?record.to:record.from,moveCosts:record.moveCosts,totalCents:record.moveCosts?(outgoing?-item.totalCents:item.totalCents):0,pricePending:false});}
 }return result;
}
function costLines(records,session,{startDate,endDate,weeks}={}){
 const formatter=par.calendar(par.defaultTimeZone);return movements(records,session).filter(row=>row.moveCosts).map(row=>({...row,...orderCosts.dates({createdAt:row.receivedAt},formatter)})).filter(row=>(!startDate||row.costDate>=startDate)&&(!endDate||row.costDate<=endDate)&&(!weeks||weeks.has(row.costWeekStart)));
}
function costs(records,session,options){const lines=costLines(records,session,options);return {totalCents:lines.reduce((sum,row)=>sum+row.totalCents,0),transferCount:new Set(lines.map(row=>row.transferId)).size,lines};}
module.exports={read,movements,costLines,costs};
