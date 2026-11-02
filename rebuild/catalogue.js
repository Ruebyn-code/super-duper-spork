// Company catalogue for the rebuilt app: suppliers and stock items, including
// the ordering rules the recommendation engine reads.
//
// Rules are stored in exactly the shape public/stock-order-rules.js expects
// (minimumOrder, orderRule, roundingCutoff, roundDownThreshold,
// roundUpThreshold), so minimum orders, multiples, rounding cut-offs and
// separate-unit rounding behave as they do in the current app. Prices are
// integer cents and are snapshotted onto an order when it is placed; changing
// a catalogue price never rewrites a placed order.
const crypto=require('node:crypto');
const access=require('./access');
const permissions=require('./permissions');
const rules=require('../public/stock-order-rules');

const orderRules=['minimum','multiples','cutoff','separate'];
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max=100)=>String(value??'').trim().slice(0,max);
const cents=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000000;
const optionalCount=value=>value===null||value===undefined||value===''?null:Number(value);
const count=(value,{min=0,max=rules.limit,fallback})=>{
 const number=Number(value);
 if(value===null||value===undefined||value===''||!Number.isInteger(number)||number<min||number>max)return fallback;
 return number;
};

function createCatalogue({store,now=Date.now}){
 async function list(actor,companyId){
  const {company}=await access.read({store,account:actor,permission:'orders.view',companyId});
  const [products,suppliers]=await Promise.all([store.read('products'),store.read('suppliers')]);
  return {
   company,
   products:products.filter(product=>product.companyId===company.id&&!product.archived).sort((a,b)=>String(a.category||'').localeCompare(String(b.category||''))||a.name.localeCompare(b.name)),
   suppliers:suppliers.filter(supplier=>supplier.companyId===company.id&&!supplier.archived).sort((a,b)=>a.name.localeCompare(b.name))
  };
 }

 async function createSupplier(actor,input){
  const {company}=await access.write({store,account:actor,permission:'suppliers.manage',companyId:input?.companyId});
  permissions.requirePermission(actor,'suppliers.create');
  const name=text(input.name);
  if(!name)fail('Enter a supplier name.');
  return store.change('suppliers',suppliers=>{
   if(suppliers.some(supplier=>supplier.companyId===company.id&&!supplier.archived&&supplier.name.toLowerCase()===name.toLowerCase()))fail('That supplier already exists in this company.',409);
   const record={id:crypto.randomUUID(),companyId:company.id,name,archived:false,createdAt:new Date(now()).toISOString()};
   suppliers.push(record);
   return record;
  });
 }

 // Creates a stock item, or updates the editable settings of an existing one.
  async function saveProduct(actor,input){
  const {company}=await access.write({store,account:actor,permission:'stock.manage',companyId:input?.companyId});
  const [suppliers]=await Promise.all([store.read('suppliers')]);
  const supplier=suppliers.find(candidate=>candidate.id===input.supplierId&&candidate.companyId===company.id&&!candidate.archived);
  if(!supplier)fail('Choose a supplier from this company.');
  const name=text(input.name,140);
  if(!name)fail('Enter a stock item name.');
  const unitPriceCents=Number(input.unitPriceCents);
  if(!cents(unitPriceCents))fail('Enter a price in cents between 0 and 100,000,000.');
  const orderRule=orderRules.includes(input.orderRule)?input.orderRule:'minimum';
  const minimumOrder=count(input.minimumOrder,{min:1,fallback:1});
  const min=minimumOrder;
  const roundingCutoff=orderRule==='cutoff'?count(input.roundingCutoff,{min:0,max:min,fallback:Math.min(5,min)}):null;
  const threshold=key=>{
   const value=optionalCount(input[key]);
   if(value===null)return null;
   if(!Number.isInteger(value)||value<0||value>min)fail('Rounding thresholds must be whole units between 0 and the order unit.');
   return value;
  };
  const roundDownThreshold=orderRule==='separate'?threshold('roundDownThreshold'):null;
  const roundUpThreshold=orderRule==='separate'?threshold('roundUpThreshold'):null;
  if(!input.productId)permissions.requirePermission(actor,'stock.create');
  const at=new Date(now()).toISOString();
  return store.change('products',products=>{
   const settings={name,supplierId:supplier.id,unit:text(input.unit,60),unitPriceCents,orderRule,minimumOrder,roundingCutoff,roundDownThreshold,roundUpThreshold,category:text(input.category,60)};
   const existing=input.productId?products.find(product=>product.id===input.productId&&product.companyId===company.id):null;
   if(input.productId&&!existing)fail('That stock item is not in this company catalogue.',404);
   if(existing){
    if(products.some(product=>product.id!==existing.id&&product.companyId===company.id&&!product.archived&&product.name.toLowerCase()===name.toLowerCase()))fail('Another stock item already uses that name.',409);
    Object.assign(existing,settings,{updatedAt:at});
    return existing;
   }
   if(products.some(product=>product.companyId===company.id&&!product.archived&&product.name.toLowerCase()===name.toLowerCase()))fail('That stock item already exists in this company.',409);
   const record={id:crypto.randomUUID(),companyId:company.id,sku:text(input.sku,60),archived:false,createdAt:at,updatedAt:at,...settings};
   products.push(record);
   return record;
  });
 }

 return {list,createSupplier,saveProduct};
}
module.exports={createCatalogue,orderRules};
