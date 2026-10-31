const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const initial=()=>({mode:'usage',salesBaseCents:null,quantityThousandths:null,revision:0});
function normalize(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||!['usage','sales'].includes(value.mode))fail('Choose a target calculation.');
 const {mode,salesBaseCents=null,quantityThousandths=null}=value;
 const empty=salesBaseCents===null&&quantityThousandths===null;
 if(!empty&&(!Number.isSafeInteger(salesBaseCents)||salesBaseCents<1||salesBaseCents>100000000||!Number.isSafeInteger(quantityThousandths)||quantityThousandths<0||quantityThousandths>1000000000))fail('Enter a sales amount from $0.01 to $1,000,000 and a quantity from 0 to 1,000,000 with up to three decimal places.');
 if(mode==='sales'&&empty)fail('Enter the sales amount and item quantity for this calculation.');
 return{mode,salesBaseCents,quantityThousandths};
}
function fileFor(dir,actor){if(!/^[a-zA-Z0-9-]{1,100}$/.test(actor?.locationId||'')||!/^[a-zA-Z0-9-]{1,100}$/.test(actor?.companyId||''))fail('Choose a location.');return path.join(dir,'target-calculations',actor.locationId+'.json');}
async function state(dir,actor){try{const value=JSON.parse(await fs.readFile(fileFor(dir,actor),'utf8'));if(value.companyId!==actor.companyId||value.locationId!==actor.locationId)fail('Target calculations belong to another location.',409);if(!value.items||typeof value.items!=='object'||Array.isArray(value.items))throw Error('Target calculations could not be read.');return value;}catch(error){if(error.code==='ENOENT')return{companyId:actor.companyId,locationId:actor.locationId,items:{}};throw error;}}
async function read(dir,actor){if(!actor.locationId)return{};const saved=await state(dir,actor);return Object.fromEntries(Object.entries(saved.items).map(([id,value])=>{if(!/^[a-zA-Z0-9-]+$/.test(id)||!Number.isSafeInteger(value.revision)||value.revision<1)throw Error('Target calculations could not be read.');return[id,{...normalize(value),revision:value.revision}];}));}
async function policy(dir,actor){if(!actor.locationId)return{mode:null,revision:0};let locations;try{locations=JSON.parse(await fs.readFile(path.join(dir,'locations.json'),'utf8'));}catch(error){if(error.code==='ENOENT')return{mode:null,revision:0};throw error;}const location=locations.find(l=>l.id===actor.locationId&&(l.companyId||'default')===actor.companyId);return{mode:['usage','sales'].includes(location?.targetCalculationMode)?location.targetCalculationMode:null,revision:location?.targetCalculationRevision||0};}
async function resolve(dir,actor,products){const [saved,location]=await Promise.all([read(dir,actor),policy(dir,actor)]);return Object.fromEntries(products.map(p=>{const value=saved[p.id]||initial();return[p.id,{...value,mode:location.mode||value.mode,locationMode:location.mode,locationRevision:location.revision}];}));}
function createStore(){
 const pending=new Map();
 async function save(dir,actor,id,input,authorize){
  if(!/^[a-zA-Z0-9-]+$/.test(id)||!Number.isSafeInteger(input?.revision)||input.revision<0)fail('Reload the item before saving its target calculation.');const config=normalize(input),file=fileFor(dir,actor);
  const operation=(pending.get(file)||Promise.resolve()).then(async()=>{
   await authorize();const saved=await state(dir,actor),previous=(await read(dir,actor))[id]||initial(),desired=config.mode==='usage'&&!Object.hasOwn(input,'salesBaseCents')&&!Object.hasOwn(input,'quantityThousandths')?{...config,salesBaseCents:previous.salesBaseCents,quantityThousandths:previous.quantityThousandths}:config;
   if(JSON.stringify(normalize(previous))===JSON.stringify(desired))return previous;
   if(previous.revision!==input.revision)fail('This target calculation changed. Reopen the stock item before saving.',409);
   const value={...desired,revision:previous.revision+1};saved.items[id]={...value,updatedAt:new Date().toISOString(),updatedBy:actor.id};
   await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(saved,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}return value;
  });
  const settled=operation.catch(()=>{});pending.set(file,settled);try{return await operation;}finally{if(pending.get(file)===settled)pending.delete(file);}
 }
 return{read,save};
}
function apply(levels,settings,projection){return Object.fromEntries(Object.entries(levels).map(([id,current])=>{
 const setting=settings[id];if(setting?.mode!=='sales')return[id,current];let level=null,reason=null;
 if(!Number.isSafeInteger(setting.quantityThousandths)||!Number.isSafeInteger(setting.salesBaseCents)||setting.salesBaseCents<1)reason='Set this item’s quantity per sales amount to calculate its target.';
 else if(!Number.isSafeInteger(projection?.projectedSalesCents)||projection.projectedSalesCents<0)reason='A complete weekly sales projection is needed for this target.';
 else{const numerator=BigInt(projection.projectedSalesCents)*BigInt(setting.quantityThousandths),base=BigInt(setting.salesBaseCents),thousandths=(numerator+base/2n)/base;if(thousandths>1000000000n)reason='The calculated target exceeds 1,000,000 ordered units.';else level=Number(thousandths)/1000;}
 return[id,{...current,source:'projected_sales',level,projectionWeekStart:projection?.weekStart||null,projectionWeekEnd:projection?.weekEnd||null,calculationReason:reason}];
}));}
module.exports={initial,normalize,read,policy,resolve,createStore,apply};
