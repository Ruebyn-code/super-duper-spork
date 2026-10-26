const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),calendar=require('./public/rostering-model');
const uuidFile=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$/i,cache=new Map();
const price=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000;
function file(dir,companyId){if(!/^[a-zA-Z0-9-]{1,100}$/.test(companyId))throw Error('Invalid company.');return companyId==='default'?path.join(dir,'catalogue.json'):path.join(dir,'company-catalogues',companyId+'.json');}
function plans(events){const result=new Map();for(const event of events||[])for(const order of event.orders||[]){let items=result.get(order.id);if(!items){items=new Map();result.set(order.id,items);}for(const item of order.items||[])if(price(item.price))items.set(item.id,{price:item.price,updatedAt:event.at});}return result;}
async function readPlans(dir,companyId){const target=file(dir,companyId);try{const stat=await fs.stat(target,{bigint:true}),stamp=stat.mtimeNs+':'+stat.ctimeNs+':'+stat.size,previous=cache.get(target);if(previous?.stamp===stamp)return previous.plans;const catalogue=JSON.parse(await fs.readFile(target,'utf8')),value=plans(catalogue.orderPriceUpdates);cache.set(target,{stamp,plans:value});return value;}catch(error){if(error.code==='ENOENT')return new Map();throw error;}}
function rank(record){const stamp=record.recordedAt||record.createdAt;if(!Number.isFinite(Date.parse(stamp))||!Number.isFinite(Date.parse(record.createdAt)))return null;const day=record.source==='manual_history'?record.orderDate:calendar.today(Date.parse(record.createdAt));return typeof day==='string'?day+'|'+stamp+'|'+record.id:null;}
async function capture(dir,companyId,catalogue,before,{actor,source='stock-settings',invoiceId}={}){
 const changed=new Map(catalogue.products.filter(p=>before.has(p.id)&&price(p.price)&&p.price!==before.get(p.id)).map(p=>[p.id,p]));if(!changed.size)return;
 const names=(await fs.readdir(dir)).filter(name=>uuidFile.test(name)),records=[];
 for(let offset=0;offset<names.length;offset+=32){const batch=await Promise.all(names.slice(offset,offset+32).map(async name=>{try{const record=JSON.parse(await fs.readFile(path.join(dir,name),'utf8'));return record.id===name.slice(0,-5)&&record.status==='requested'&&(record.companyId||'default')===companyId&&Array.isArray(record.items)&&rank(record)?record:null;}catch(error){if(error.code==='ENOENT')return null;throw error;}}));records.push(...batch.filter(Boolean));}
 if(!records.length)return;let locations=[];try{locations=JSON.parse(await fs.readFile(path.join(dir,'locations.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const locationOf=record=>{if(record.locationId)return record.locationId;const matches=locations.filter(location=>(location.companyId||'default')===companyId&&(location.legacyAccountIds||[]).includes(record.requestOwnerId));return matches.length===1?matches[0].id:record.requestOwnerId?'account:'+record.requestOwnerId:null;};
 const existing=plans(catalogue.orderPriceUpdates),seen=new Set(),orders=[];
 records.sort((a,b)=>rank(b).localeCompare(rank(a)));
 for(const record of records){const locationId=locationOf(record);if(!locationId)continue;const items=[];
  for(const item of record.items){const product=changed.get(item.id),key=locationId+':'+item.id;if(!product||seen.has(key))continue;seen.add(key);
   // An explicitly different pack or supplier cannot inherit a per-unit price safely.
   if(item.unitAmount&&product.unitAmount&&item.unitAmount!==product.unitAmount||item.supplierId&&product.supplierId&&item.supplierId!==product.supplierId)continue;
   const previous=existing.get(record.id)?.get(item.id)?.price??item.price;if(previous===product.price)continue;
   items.push({id:item.id,previousPrice:previous,price:product.price});
  }
  if(items.length)orders.push({id:record.id,locationId,items});
 }
 if(orders.length)(catalogue.orderPriceUpdates||=[]).push({id:crypto.randomUUID(),at:new Date().toISOString(),companyId,actorId:actor?.id||null,actorName:actor?.username||'',source,...(invoiceId?{invoiceId}:{}),orders});
}
function apply(record,plan){if(record.status!=='requested'||!plan?.size)return record;let updatedAt='',changed=false;const items=record.items.map(item=>{const update=plan.get(item.id);if(!update)return item;changed=true;if(update.updatedAt>updatedAt)updatedAt=update.updatedAt;return{...item,originalPrice:Object.hasOwn(item,'originalPrice')?item.originalPrice:item.price,price:update.price,priceUpdatedAt:update.updatedAt};});if(!changed)return record;
 const total=items.reduce((sum,item)=>sum+(item.price===null?0:item.price*item.quantity),0);if(!Number.isSafeInteger(total)||total<0)throw Error('Updated order total exceeds the supported range.');
 return{...record,items,total,pricePending:items.some(item=>item.price===null),priceAdjustment:{updatedAt,originalTotal:record.priceAdjustment?.originalTotal??record.total}};
}
async function decorate(dir,value){const list=Array.isArray(value)?value:[value],companies=new Map();for(const record of list)if(record?.status==='requested'&&Array.isArray(record.items))companies.set(record.companyId||'default',null);await Promise.all([...companies.keys()].map(async id=>companies.set(id,await readPlans(dir,id))));const result=list.map(record=>record?apply(record,companies.get(record.companyId||'default')?.get(record.id)):record);return Array.isArray(value)?result:result[0];}
module.exports={capture,decorate};
