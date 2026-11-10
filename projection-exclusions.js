// Unusual sales days. A completed day whose saved revenue is more than 30% above or below the average of its four
// previous normal same weekdays is left out of later projections (the same way public holidays are), unless two or
// more of the four most recent same weekdays moved the same way — then it is treated as the new normal.
// The limit is a company setting (default 30%). Saved sales, reports and totals are never changed; only which days feed a projection.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {shift}=require('./stock-usage');
const monday=date=>shift(date,-(new Date(date+'T00:00:00Z').getUTCDay()+6)%7);
const weekday=date=>(new Date(date+'T00:00:00Z').getUTCDay()+6)%7;
const valid=value=>Number.isSafeInteger(value)&&value>=0;
const realDate=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\d$/.test(value)&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const safe=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{1,100}$/.test(value);
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const queues=new Map();

// Company setting: how far from usual (in %) a day must be before projections leave it out. Default 30.
const DEFAULT_PERCENT=30,MIN_PERCENT=10,MAX_PERCENT=100;
function file(dir,session){if(!safe(session?.companyId))fail('Select a company first.',403);return path.join(dir,'projection-settings',session.companyId+'.json');}
async function readSettings(dir,session){
 if(!safe(session?.companyId))return{revision:0,unusualPercent:DEFAULT_PERCENT};
 try{const value=JSON.parse(await fs.readFile(file(dir,session),'utf8'));return{revision:Number.isSafeInteger(value.revision)?value.revision:0,unusualPercent:Number.isInteger(value.unusualPercent)&&value.unusualPercent>=MIN_PERCENT&&value.unusualPercent<=MAX_PERCENT?value.unusualPercent:DEFAULT_PERCENT,...(value.updatedAt?{updatedAt:value.updatedAt,updatedBy:value.updatedBy?.name||''}:{})};}
 catch(error){if(error.code==='ENOENT')return{revision:0,unusualPercent:DEFAULT_PERCENT};throw error;}
}
// Revision-checked save of the company limit; saving the same value again is harmless.
async function saveSettings(dir,session,input,{now=Date.now}={}){
 const target=file(dir,session);
 if(!input||!Number.isInteger(input.unusualPercent)||input.unusualPercent<MIN_PERCENT||input.unusualPercent>MAX_PERCENT)fail('Enter a whole percentage from '+MIN_PERCENT+' to '+MAX_PERCENT+'.');if(!Number.isSafeInteger(input.revision))fail('Reload the projection settings before saving.');
 const previous=queues.get(target)||Promise.resolve(),task=previous.then(async()=>{
  const state=await readSettings(dir,session);if(state.unusualPercent===input.unusualPercent&&state.revision===input.revision)return state;
  if(state.revision!==input.revision)fail('These projection settings changed since you opened them. Reload and try again.',409);
  const next={revision:state.revision+1,unusualPercent:input.unusualPercent,updatedAt:new Date(now()).toISOString(),updatedBy:{id:session.id||null,name:session.username||session.name||''}};
  await fs.mkdir(path.dirname(target),{recursive:true});const temp=target+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,JSON.stringify(next),{mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
  return{revision:next.revision,unusualPercent:next.unusualPercent,updatedAt:next.updatedAt,updatedBy:next.updatedBy.name};
 });
 queues.set(target,task.catch(()=>{}));return task;
}

// Shared classifier over weekly-first revenue. `records` are already-read weeks; more are read on demand.
function classifier({holidays=new Set(),percent=DEFAULT_PERCENT,records=[],readRevenue}){
 const limit=percent/100;
 const known=new Map(records.map(record=>[record.weekStart,record])),flags=new Map(),windows=new Map();
 async function load(dates){const need=[...new Set(dates.map(monday))].filter(start=>!known.has(start));if(!need.length)return;const found=await readRevenue(need);for(const record of found||[])known.set(record.weekStart,record);for(const start of need)if(!known.has(start))known.set(start,null);}
 const value=date=>{const amount=known.get(monday(date))?.days?.[weekday(date)];return valid(amount)?amount:null;};
 // The usual amount: the average of the four previous same weekdays that were not public holidays (within 8 weeks).
 async function usual(date){const dates=[];for(let n=1;n<=8&&dates.length<4;n++){const day=shift(date,-7*n);if(!holidays.has(day))dates.push(day);}if(dates.length<4)return null;await load(dates);const values=dates.map(value);return values.every(valid)?values.reduce((a,b)=>a+b,0)/4:null;}
 async function flag(date){
  if(flags.has(date))return flags.get(date);await load([date]);const actual=value(date);let result=null;
  if(actual!==null&&!holidays.has(date)){const base=await usual(date);if(base!==null&&base>0){const change=(actual-base)/base;if(change>limit||change<-limit)result={kind:change>0?'high':'low',usualCents:Math.round(base),actualCents:actual,changePercent:Math.round(change*100)};}}
  flags.set(date,result);return result;
 }
 // Two or more of the four most recent normal same weekdays before `before` moving the same way is the new normal.
 async function newNormal(day,before){const key=day+'|'+before;if(windows.has(key))return windows.get(key);const dates=[];for(let n=1;n<=8&&dates.length<4;n++){const date=shift(before,day-7*n);if(!holidays.has(date))dates.push(date);}const kinds=await Promise.all(dates.map(async date=>(await flag(date))?.kind));const result={high:kinds.filter(kind=>kind==='high').length>=2,low:kinds.filter(kind=>kind==='low').length>=2};windows.set(key,result);return result;}
 // Whether a completed day feeds projections made for the week starting `before`.
 async function status(date,before){
  if(holidays.has(date))return{date,used:false,reason:'holiday'};
  const unusual=await flag(date);if(!unusual)return{date,used:true,reason:null};
  const normal=await newNormal(weekday(date),before);
  return normal[unusual.kind]?{date,used:true,reason:'new-normal',...unusual}:{date,used:false,reason:unusual.kind,...unusual};
 }
 return{load,flag,status,value};
}

// Daily sales markers for one shown week: completed days with saved sales and whether projections use them.
async function weekDays(dir,session,{weekStart,today,readRevenue,holidays=new Set()}){
 const settings=await readSettings(dir,session),check=classifier({holidays,percent:settings.unusualPercent,readRevenue}),before=shift(weekStart,7),days=[];
 await check.load(Array.from({length:6},(_,index)=>shift(weekStart,-7*index)));
 for(let index=0;index<7;index++){const date=shift(weekStart,index);if(date>=today||check.value(date)===null){days.push({date,status:null});continue;}const result=await check.status(date,before);days.push({...result,status:result.used?'used':'left-out'});}
 return{weekStart,unusualPercent:settings.unusualPercent,days};
}

module.exports={DEFAULT_PERCENT,MIN_PERCENT,MAX_PERCENT,readSettings,saveSettings,classifier,weekDays};
