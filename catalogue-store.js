const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {mergeSpreadsheet}=require('./catalogue-import'),groups=require('./public/stock-count-groups');
function createStore(dir,menu){
 const initializations=new Map(),pending=new Map();
 function file(companyId){if(!/^[a-zA-Z0-9-]{1,100}$/.test(companyId))throw Error('Invalid company.');return companyId==='default'?path.join(dir,'catalogue.json'):path.join(dir,'company-catalogues',companyId+'.json');}
 async function write(target,catalogue){await fs.mkdir(path.dirname(target),{recursive:true});const temp=target+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(catalogue,null,2),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}}
 async function read(companyId='default',includePrivate=false){
  const target=file(companyId);if(!initializations.has(target))initializations.set(target,(async()=>{
   let catalogue,changed=false;try{catalogue=JSON.parse(await fs.readFile(target,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;changed=true;catalogue=companyId==='default'?{suppliers:[{id:'office',name:'Office Supplies'},{id:'packaging',name:'Packaging Supplies'},{id:'safety',name:'Safety Supplies'}],products:menu.map(product=>({...product,supplierId:product.category.toLowerCase()}))}:{suppliers:[],products:[]};}
   if(companyId==='default'&&!catalogue.imports?.includes('book2-v1')){mergeSpreadsheet(catalogue);changed=true;}
   for(const product of catalogue.products)if(!groups.valid(product.stockCountGroup)){product.stockCountGroup=groups.resolve(product);changed=true;}
   for(const product of catalogue.products)if(product.unitAmount===undefined){product.unitAmount='';changed=true;}
   for(const product of catalogue.products){for(const key of ['roundDownThreshold','roundUpThreshold'])if(product[key]===undefined){product[key]=null;changed=true;}if(product.roundingCutoff===undefined){product.roundingCutoff=1;changed=true;}if(product.minimumOrder===undefined){product.minimumOrder=1;changed=true;}if(product.orderRule===undefined){product.orderRule='minimum';changed=true;}}
   if(changed)await write(target,catalogue);
  })().catch(error=>{initializations.delete(target);throw error;}));
  await initializations.get(target);const result=JSON.parse(await fs.readFile(target,'utf8'));if(!includePrivate)delete result.invoicePriceUpdates;return result;
 }
 function mutate(companyId,change){const target=file(companyId),operation=(pending.get(target)||Promise.resolve()).then(async()=>{const catalogue=await read(companyId,true),result=await change(catalogue);await write(target,catalogue);return result;});const settled=operation.catch(()=>{});pending.set(target,settled);return operation.finally(()=>{if(pending.get(target)===settled)pending.delete(target);});}
 return {read,mutate,invoicePriceUpdates:async companyId=>(await read(companyId,true)).invoicePriceUpdates||[]};
}
module.exports={createStore};
