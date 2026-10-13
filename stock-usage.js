const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const stockCounts=require('./stock-counts'),par=require('./par-levels');
const dayMs=86400000;
function invalid(message,status=400){const error=Error(message);error.status=status;throw error;}
function week(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))invalid('Choose a valid week starting on Monday.');
 const date=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==value||date.getUTCDay()!==1)invalid('Choose a valid week starting on Monday.');
 return value;
}
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*dayMs).toISOString().slice(0,10);
function target(dir,session,value){return path.join(dir,'stock-usage',crypto.createHash('sha256').update(session.id).digest('hex')+'-'+week(value)+'.json');}
async function readWeek(dir,session,value){try{const record=JSON.parse(await fs.readFile(target(dir,session,value),'utf8'));if(record.accountId!==session.id||record.weekStart!==value)invalid('Usage record is unavailable.',500);return record;}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function eligible(countDate,weekStart,kind){return kind==='opening'?[shift(weekStart,-1),weekStart].includes(countDate):[shift(weekStart,6),shift(weekStart,7)].includes(countDate);}
async function editor(dir,session,weekStart){
 week(weekStart);const [record,counts]=await Promise.all([readWeek(dir,session,weekStart),stockCounts.list(dir,{...session,role:'user'})]);
 return {record,openingCounts:counts.filter(count=>eligible(count.countDate,weekStart,'opening')),closingCounts:counts.filter(count=>eligible(count.countDate,weekStart,'closing')),window:par.windowFor()};
}
function quantity(value){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000000||Math.abs(value*1000-Math.round(value*1000))>0.000001)invalid('Use quantities from 0 to 1,000,000, with up to three decimal places.');
 return Math.round(value*1000);
}
async function countSource(dir,session,id,weekStart,kind){
 if(id===undefined||id==='')return null;
 if(typeof id!=='string')invalid('Choose a valid saved count.');
 const record=await stockCounts.get(dir,id,{...session,role:'user'});
 if(!eligible(record.countDate,weekStart,kind))invalid('Choose a '+kind+' count from the start or end of this week.');
 return new Map(record.items.map(item=>[item.id,item.quantity]));
}
let pending=Promise.resolve();
function save(dir,session,input,catalogue){
 const operation=pending.then(async()=>{
  if(!input||typeof input!=='object')invalid('Enter valid weekly usage.');const weekStart=week(input.weekStart);
  if(weekStart>par.windowFor().currentWeekStart)invalid('Future weeks cannot be recorded yet.');
  if(input.notes!==undefined&&(typeof input.notes!=='string'||input.notes.length>1000))invalid('Keep usage notes under 1,000 characters.');
  if(!Array.isArray(input.items)||input.items.length>10000)invalid('Enter valid stock usage items.');
  const [openingCount,closingCount,previous]=await Promise.all([countSource(dir,session,input.openingCountId,weekStart,'opening'),countSource(dir,session,input.closingCountId,weekStart,'closing'),readWeek(dir,session,weekStart)]);
  const products=new Map(catalogue.products.map(product=>[product.id,product])),suppliers=new Map(catalogue.suppliers.map(supplier=>[supplier.id,supplier.name]));const seen=new Set();
  const items=input.items.map(item=>{
   const product=products.get(item?.id);if(!product||seen.has(item.id))invalid('A usage item was removed or duplicated. Refresh the stock list and try again.');seen.add(item.id);
   const opening=quantity(openingCount?openingCount.get(item.id):item.opening),received=quantity(item.received??0),closing=quantity(closingCount?closingCount.get(item.id):item.closing);
   const used=opening+received-closing;if(used<0)invalid('Closing stock exceeds opening stock plus stock received for '+product.name+'. Check the quantities.');
   return {id:product.id,name:product.name,sku:product.sku||'',supplierId:product.supplierId,supplier:suppliers.get(product.supplierId)||'',opening:opening/1000,received:received/1000,closing:closing/1000,quantity:used/1000};
  });
  // Retain snapshots of removed stock when editing other items in a saved week.
  items.push(...(previous?.items||[]).filter(item=>!products.has(item.id)));
  const record={weekStart,weekEnd:shift(weekStart,6),accountId:session.id,counterName:session.username,openingCountId:input.openingCountId||'',closingCountId:input.closingCountId||'',notes:(input.notes||'').trim(),items,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
  const file=target(dir,session,weekStart);await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(record,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}
  return record;
 });pending=operation.catch(()=>{});return operation;
}
async function parLevels(dir,session,products){
 const now=new Date(),window=par.windowFor(now),records=await Promise.all([1,2,3,4].map(index=>readWeek(dir,session,shift(window.currentWeekStart,-7*index))));
 return par.calculate(records,products,session,{now});
}
module.exports={week,shift,editor,readWeek,save,parLevels};
