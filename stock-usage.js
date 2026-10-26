const stockOrderRules=require('./public/stock-order-rules');
const {belongs}=require('./location-scope');
const fs=require('node:fs/promises'),path=require('node:path');
const par=require('./par-levels'),transferEffects=require('./stock-transfer-effects'),orderNumbers=require('./order-numbers');
const dayMs=86400000,uuidFile=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i;
function invalid(message,status=400){const error=Error(message);error.status=status;throw error;}
function week(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))invalid('Choose a valid week starting on Sunday.');
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value||date.getUTCDay()!==0)invalid('Choose a valid week starting on Sunday.');
 return value;
}
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*dayMs).toISOString().slice(0,10);
const validQuantity=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1000000&&Math.abs(value*1000-Math.round(value*1000))<0.000001;

// Counts are snapshots, not transactions. The latest Sunday count for each item wins.
function derive(counts,orders,products,session,weekStarts,timeZone=par.defaultTimeZone,transfers=[]){
 const wanted=new Set(weekStarts.flatMap(start=>[start,shift(start,7)])),snapshots=new Map();
 const sorted=counts.filter(record=>belongs(record,session)&&wanted.has(record.countDate)&&Array.isArray(record.items)).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))||String(a.id).localeCompare(String(b.id)));
 for(const record of sorted){if(!snapshots.has(record.countDate))snapshots.set(record.countDate,new Map());const snapshot=snapshots.get(record.countDate);for(const item of record.items)if(item&&validQuantity(item.quantity))snapshot.set(item.id,{quantity:Math.round(item.quantity*1000),countId:record.id});}
 const totals=new Map(weekStarts.map(start=>[start,new Map()])),seen=new Set(),formatter=par.calendar(timeZone);
 for(const order of orders){
  if(!order||!belongs(order,session,'requestOwnerId')||order.status!=='requested'||typeof order.id!=='string'||seen.has(order.id)||!Array.isArray(order.items)||typeof order.createdAt!=='string')continue;
  const created=new Date(order.createdAt);if(!Number.isFinite(created.valueOf()))continue;
  const day=par.dayNumber(created,formatter),start=par.dateLabel(day-new Date(day*dayMs).getUTCDay()),weekTotals=totals.get(start);if(!weekTotals)continue;seen.add(order.id);
  for(const item of order.items){if(!item||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999)continue;const total=weekTotals.get(item.id)||{quantity:0,orders:0};total.quantity+=item.quantity*1000;total.orders++;if(!Number.isSafeInteger(total.quantity))throw Error('Ordered stock exceeds the supported range.');weekTotals.set(item.id,total);}
 }
 const transferred=new Map(weekStarts.map(start=>[start,new Map()]));
 for(const movement of transferEffects.movements(transfers,session)){
  const day=par.dayNumber(new Date(movement.createdAt),formatter),start=par.dateLabel(day-new Date(day*dayMs).getUTCDay()),totals=transferred.get(start);if(!totals)continue;
  const total=totals.get(movement.product.id)||{incoming:0,outgoing:0},quantity=Math.round(Math.abs(movement.quantity)*1000);if(movement.quantity>0)total.incoming+=quantity;else total.outgoing+=quantity;totals.set(movement.product.id,total);
 }
 return weekStarts.map(weekStart=>{
  const nextSunday=shift(weekStart,7),opening=snapshots.get(weekStart),closing=snapshots.get(nextSunday),weekTotals=totals.get(weekStart);
  const items=products.map(product=>{
   const first=opening?.get(product.id),last=closing?.get(product.id),ordered=weekTotals.get(product.id)||{quantity:0,orders:0};
   const transfer=transferred.get(weekStart).get(product.id)||{incoming:0,outgoing:0};
   const available=first?first.quantity+ordered.quantity+transfer.incoming-transfer.outgoing:null,used=first&&last?available-last.quantity:null;
   const status=!first&&!last?'missing_both_counts':!first?'missing_opening_count':!last?'missing_closing_count':used<0?'negative_usage':'complete';
   return {id:product.id,name:product.name,sku:product.sku||'',supplierId:product.supplierId,supplier:product.supplier||'',opening:first?first.quantity/1000:null,ordered:ordered.quantity/1000,transferredIn:transfer.incoming/1000,transferredOut:transfer.outgoing/1000,available:available===null?null:available/1000,closing:last?last.quantity/1000:null,quantity:status==='complete'?used/1000:null,calculatedUsage:used===null?null:used/1000,status,orderCount:ordered.orders,openingCountId:first?.countId||null,closingCountId:last?.countId||null};
  });
  return {weekStart,weekEnd:shift(weekStart,6),nextSunday,accountId:session.id,...(session.locationId?{locationId:session.locationId}:{}),source:'sunday_counts_and_orders',items};
 });
}

// Read only UUID-named count/order records, and reuse unchanged files between refreshes.
function createReader(){
 const cache=new Map();
 async function folder(dir){
  let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(error){if(error.code==='ENOENT'){for(const file of cache.keys())if(path.dirname(file)===dir)cache.delete(file);return [];}throw error;}
  const files=entries.filter(entry=>entry.isFile()&&uuidFile.test(entry.name)),present=new Set(files.map(entry=>path.join(dir,entry.name)));
  for(const file of cache.keys())if(path.dirname(file)===dir&&!present.has(file))cache.delete(file);
  const result=[];
  for(let offset=0;offset<files.length;offset+=32){const batch=await Promise.all(files.slice(offset,offset+32).map(async entry=>{
   const file=path.join(dir,entry.name);try{
    const stat=await fs.stat(file,{bigint:true}),stamp=stat.mtimeNs+':'+stat.ctimeNs+':'+stat.size;
    const previous=cache.get(file);if(previous?.stamp===stamp)return previous.record;
    const record=JSON.parse(await fs.readFile(file,'utf8'));if(record?.id!==entry.name.slice(0,-5))return null;cache.set(file,{stamp,record});return record;
   }catch(error){if(error.code==='ENOENT')return null;throw error;}
  }));result.push(...batch.filter(Boolean));}
  return result;
 }
 return async dir=>{const [counts,orders,transfers]=await Promise.all([folder(path.join(dir,'stock-counts')),folder(dir),transferEffects.read(dir)]);return {counts,orders:await orderNumbers.decorate(dir,orders.filter(order=>order.status!=='deleted')),transfers};};
}
const readHistory=createReader();
async function report(dir,session,products,weekStart,{reader=readHistory,now=new Date()}={}){
 week(weekStart);const history=await reader(dir);return {record:derive(history.counts,history.orders,products,session,[weekStart],par.defaultTimeZone,history.transfers)[0],window:par.windowFor(now)};
}
function orderingSuggestions(counts,products,session,levels,transfers=[]){
 // A new stock take is a snapshot. Omitted items remain unknown in that take.
 const latest=counts.filter(record=>belongs(record,session)&&typeof record.createdAt==='string'&&Number.isFinite(Date.parse(record.createdAt))&&Array.isArray(record.items)).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||String(b.id).localeCompare(String(a.id)))[0];
 const adjustments=new Map();for(const movement of transferEffects.movements(transfers,session)){if(!latest||movement.createdAt<=latest.createdAt)continue;adjustments.set(movement.product.id,(adjustments.get(movement.product.id)||0)+movement.quantity);}
 const quantities=new Map((latest?.items||[]).filter(item=>item&&validQuantity(item.quantity)).map(item=>[item.id,item.quantity]));
 return {stockTake:latest?{id:latest.id,countDate:latest.countDate,savedAt:latest.createdAt}:null,items:Object.fromEntries(products.map(product=>{
  const counted=quantities.has(product.id)?quantities.get(product.id):null,level=levels[product.id]?.level??null;
  const adjustment=Math.round((adjustments.get(product.id)||0)*1000)/1000,available=counted===null?null:Math.max(0,Math.round((counted+adjustment)*1000)/1000);
  const recommendation=stockOrderRules.recommendation({...product,par:levels[product.id]},level,available);
  return [product.id,{stockCount:counted,recommended:recommendation,...(adjustment?{transferAdjustment:adjustment,availableStock:available}:{})}];
 }))};
}
async function parLevels(dir,session,products,{reader=readHistory,now=new Date(),manualLevels={}}={}){
 const window=par.windowFor(now),history=await reader(dir);
 const records=derive(history.counts,history.orders,products,session,[1,2,3,4].map(index=>shift(window.currentWeekStart,-7*index)),par.defaultTimeZone,history.transfers);
 const result=par.calculate(records,products,session,{now,manualLevels});
 const suggestions=orderingSuggestions(history.counts,products,session,result.levels,history.transfers);
 return {...result,stockTake:suggestions.stockTake,suggestions:suggestions.items};
}
module.exports={week,shift,derive,createReader,report,parLevels,orderingSuggestions};
