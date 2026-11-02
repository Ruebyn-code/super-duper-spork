// Seeds a demo catalogue and four weeks of Sunday counts for the rebuilt app.
//
// The current app's real catalogue (catalogue/book2.json) is the source, so the
// order sheet shows realistic items, suppliers, prices and ordering rules before
// Phase 7 imports production records. Counts are deterministic: the same data
// directory always produces the same target levels and suggestions.
const crypto=require('node:crypto');
const book=require('../catalogue/book2.json');
const par=require('../par-levels');

const dayMs=86400000;
const hash=value=>{let total=7;for(const char of String(value))total=(total*31+char.charCodeAt(0))%9973;return total;};
const unitOf=name=>/\(\s*[\d.]+\s*kg\b/i.test(name)?'box':/\bkg\b/i.test(name)?'kg':'each';
function rulesFor(id){
 const seed=hash(id);
 if(seed%11===0)return {orderRule:'cutoff',minimumOrder:12,roundingCutoff:6};
 if(seed%5===0)return {orderRule:'multiples',minimumOrder:6};
 return {orderRule:'minimum',minimumOrder:1};
}
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*dayMs).toISOString().slice(0,10);

async function seedOrdering({store,companies,locations,accounts,now=Date.now}){
 const [harbour,riverside]=companies;
 const harbourLocations=locations.filter(location=>location.companyId===harbour?.id);
 const riversideLocation=locations.find(location=>location.companyId===riverside?.id);
 if(!harbour||!harbourLocations.length)return {products:[],suppliers:[]};
 const stamp=new Date(now()).toISOString();
 const suppliers=book.suppliers.map(supplier=>({id:crypto.randomUUID(),companyId:harbour.id,name:supplier.name,archived:false,createdAt:stamp}));
 const supplierIds=new Map(book.suppliers.map((supplier,index)=>[supplier.id,suppliers[index].id]));
 if(riverside){
  suppliers.push({id:crypto.randomUUID(),companyId:riverside.id,name:'Riverside Wholesale',archived:false,createdAt:stamp});
 }
 const products=book.products.map(product=>{
  const {orderRule,minimumOrder,roundingCutoff}=rulesFor(product.id);
  return {
   id:crypto.randomUUID(),companyId:harbour.id,sku:product.sku||'',name:product.name,
   category:product.category||'General',supplierId:supplierIds.get(product.supplierId)||suppliers[0].id,
   unit:unitOf(product.name),unitPriceCents:Number.isSafeInteger(product.price)?product.price:null,
   orderRule,minimumOrder,roundingCutoff:orderRule==='cutoff'?roundingCutoff:null,
   roundDownThreshold:null,roundUpThreshold:null,archived:false,createdAt:stamp,updatedAt:stamp
  };
 });
 if(riverside&&riversideLocation){
  const supplierId=suppliers.find(supplier=>supplier.companyId===riverside.id).id;
  for(const item of [{name:'House blend coffee beans (1kg bag)',price:3200},{name:'Oat milk (12 x 1L)',price:2850},{name:'Takeaway cups (1000)',price:4600}]){
   products.push({id:crypto.randomUUID(),companyId:riverside.id,sku:'',name:item.name,category:'General',supplierId,unit:unitOf(item.name),unitPriceCents:item.price,orderRule:'minimum',minimumOrder:1,roundingCutoff:null,roundDownThreshold:null,roundUpThreshold:null,archived:false,createdAt:stamp,updatedAt:stamp});
  }
 }
 await store.change('suppliers',list=>{list.push(...suppliers);});
 await store.change('products',list=>{list.push(...products);});

 // Four completed Sunday–Saturday cycles ending last Sunday, the same window the
 // usage calculation reads. The most recent count is the stock on hand today.
 const window=par.windowFor(new Date(now()),par.defaultTimeZone);
 const sundays=[0,1,2,3].map(week=>shift(window.startDate,week*7));
 const counter=accounts?.[0]||{id:null,name:'Seed'};
 const counts=[],movements=[];
 for(const location of harbourLocations){
  const catalogue=products.filter(product=>product.companyId===harbour.id);
  for(const [week,countDate] of sundays.entries()){
   const items=[];
   for(const product of catalogue){
    const seed=hash(product.id);
    const base=2+(seed%8);
    const quantity=week===3?base:base+1+(seed>>(week+1))%3;
    items.push({productId:product.id,name:product.name,sku:product.sku,unit:product.unit,quantity});
   }
   const record={id:crypto.randomUUID(),companyId:harbour.id,locationId:location.id,locationName:location.name,countDate,note:'Seeded Sunday count',counterId:counter.id,counterName:counter.name,items,createdAt:new Date(Date.parse(countDate+'T20:00:00Z')).toISOString()};
   counts.push(record);
   if(week===3)for(const item of items)movements.push({id:crypto.randomUUID(),companyId:harbour.id,locationId:location.id,productId:item.productId,kind:'count',delta:Math.round(item.quantity*1000),refId:record.id,at:record.createdAt,actorId:counter.id});
  }
 }
 await store.change('counts',list=>{list.push(...counts);});
 await store.change('stock',list=>{list.push(...movements);});
 return {products,suppliers,counts};
}
module.exports={seedOrdering,rulesFor};
