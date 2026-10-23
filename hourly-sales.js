const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const model=require('./hourly-sales-model'),sales=require('./sales'),hoursModel=require('./public/location-hours-model'),time=require('./public/rostering-model');
const queues=new Map(),shift=time.shiftDate,fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const normal=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const hoursHash=value=>crypto.createHash('sha256').update(JSON.stringify(hoursModel.normalize(value))).digest('hex');
function file(dir,actor){if(!actor?.id||! /^[a-zA-Z0-9-]{1,100}$/.test(actor.locationId||'')||! /^[a-zA-Z0-9-]{1,100}$/.test(actor.companyId||''))fail('Choose an accessible location.',403);return path.join(dir,'hourly-sales',actor.locationId+'.json');}
async function read(dir,actor){try{const value=JSON.parse(await fs.readFile(file(dir,actor),'utf8'));if(value.companyId!==actor.companyId||value.locationId!==actor.locationId)fail('Hourly sales are not available for this location.',404);return value;}catch(error){if(error.code==='ENOENT')return{companyId:actor.companyId,locationId:actor.locationId,revision:0,days:{},imports:[]};throw error;}}
function normalize(input,actor,tradingHours,{now=Date.now()}={}){
 if(!input||!['trading','calendar'].includes(input.basis)||typeof input.fullDays!=='boolean'||!['fill','replace'].includes(input.mode)||!Number.isSafeInteger(input.revision)||input.revision<0||typeof input.requestId!=='string'||! /^[a-f0-9-]{36}$/i.test(input.requestId)||typeof input.sourceName!=='string'||input.sourceName.length>180||/[\x00-\x1f\x7f]/.test(input.sourceName)||typeof input.sourceLocation!=='string'||input.sourceLocation.length>180)fail('Review the report dates, import options and current revision.');
 const expected=normal(actor.locationName),actual=normal(input.sourceLocation);if(actual&&actual!==expected&&!actual.endsWith(' '+expected))fail('This report names '+input.sourceLocation+'. Select that location before importing.');
 if(input.hoursHash!==hoursHash(tradingHours))fail('Location trading hours changed. Reopen the hourly import before saving.',409);
 const rows=model.days(input.days),week=hoursModel.normalize(tradingHours),today=time.today(now),converted={};
 if(input.basis==='calendar'&&week.some(day=>day===null))fail('Set all seven days of location trading hours before converting calendar-day reports.');
 for(const row of rows){
  if(row.date>today)fail('Reports cannot contain future actual sales. Correct the report date.');
  const sum=row.hours.reduce((total,value)=>total+(value??0),0);if(input.fullDays&&row.reportedTotalCents!==null&&sum!==row.reportedTotalCents)fail('Hourly amounts do not match the report total for '+row.date+'. Correct the preview or keep it as a partial report.');
  for(let hour=0;hour<24;hour++){
   const value=row.hours[hour]===null&&input.fullDays?0:row.hours[hour];if(value===null)continue;let date=row.date;
   if(input.basis==='calendar'){const previous=week[(new Date(row.date+'T00:00:00Z').getUTCDay()+5)%7];if(previous&&!previous.closed&&hoursModel.period(previous).overnight&&hour*60<time.minutes(previous.close))date=shift(date,-1);}
   if(!model.validDate(date))fail('The converted trading date is outside the supported report range.');converted[date]||=Array(24).fill(null);if(converted[date][hour]!==null&&converted[date][hour]!==value)fail('Overlapping report rows disagree for '+date+'.');converted[date][hour]=value;
  }
 }
 return{days:converted,mode:input.mode,revision:input.revision,requestId:input.requestId,sourceName:input.sourceName};
}
function preview(state,imported){
 const days=Object.entries(imported.days).map(([date,hours])=>{const saved=state.days[date]?.hours||Array(24).fill(null),conflicts=hours.some((value,i)=>value!==null&&saved[i]!==null&&saved[i]!==value),next=saved.map((value,i)=>hours[i]!==null&&(imported.mode==='replace'||value===null)?hours[i]:value),changed=JSON.stringify(saved)!==JSON.stringify(next);if(!model.amount(next.reduce((sum,value)=>sum+(value??0),0)))fail('The merged hourly sales exceed the daily supported range.');return{date,hours:next,complete:next.every(value=>value!==null),totalCents:next.reduce((sum,value)=>sum+(value??0),0),status:conflicts&&imported.mode==='fill'?'conflict':changed?'ready':'unchanged'};});
 return{revision:state.revision,days,ready:days.filter(day=>day.status==='ready').length,conflicts:days.filter(day=>day.status==='conflict').length};
}
function allocate(total,weights){
 const sum=weights.reduce((a,b)=>a+b,0);if(total===0)return weights.map(()=>0);if(!sum)return null;
 const denominator=BigInt(sum),amount=BigInt(total),parts=weights.map((value,hour)=>({hour,value:Number(amount*BigInt(value)/denominator),remainder:amount*BigInt(value)%denominator}));let remaining=total-parts.reduce((sum,item)=>sum+item.value,0);for(const item of [...parts].sort((a,b)=>a.remainder===b.remainder?a.hour-b.hour:a.remainder>b.remainder?-1:1).slice(0,remaining))parts[item.hour].value++;return parts.map(item=>item.value);
}
function forecast(state,date,projection){
 const index=(new Date(date+'T00:00:00Z').getUTCDay()+6)%7,daily=projection.daily.find(day=>day.date===date),complete=date=>state.days[date]?.hours?.length===24&&state.days[date].hours.every(model.amount),normalDates=projection.history.map(week=>shift(week.weekStart,index));let sourceDates=normalDates,method='four-weeks',reason=null;
 if(daily?.holiday?.status==='adjusted'&&complete(daily.holiday.previousDate)){sourceDates=[daily.holiday.previousDate];method='holiday';}
 else if(daily?.holiday?.status==='adjusted')reason='Last year’s matching holiday has no complete hourly report; using the four-week hourly pattern if available.';
 let amounts=null,unavailable=null;
 if(!Number.isSafeInteger(daily?.salesCents)||daily.salesCents<0)unavailable='Complete the daily sales history required by the existing forecast rules.';
 else if(!sourceDates.length||!sourceDates.every(complete))unavailable='Upload complete hourly reports for all four matching weekdays in the last four completed weeks.';
 else{const weights=Array.from({length:24},(_,hour)=>sourceDates.reduce((sum,date)=>sum+state.days[date].hours[hour],0));amounts=allocate(daily.salesCents,weights);if(!amounts)unavailable='The historical hourly reports have no sales pattern to allocate this positive daily forecast.';}
 return{date,dailySalesCents:daily?.salesCents??null,projectedSalesCents:amounts?amounts.reduce((sum,value)=>sum+value,0):null,hours:amounts,method,sourceDates,reason:unavailable||reason,holiday:daily?.holiday||null};
}
function createStore(dir,{now=Date.now}={}){
 async function report(actor,date){if(!model.validDate(date))fail('Choose an hourly sales date from 2000 to 2099.');const state=await read(dir,actor),week=sales.currentWeek(new Date(date+'T12:00:00Z')),projection=await sales.rosterProjection(dir,actor,week,{now:new Date(now())});return{locationId:actor.locationId,locationName:actor.locationName,revision:state.revision,date,today:time.today(now()),actual:state.days[date]||{hours:Array(24).fill(null),updatedAt:null},forecast:forecast(state,date,projection),history:Object.entries(state.days).sort(([a],[b])=>b.localeCompare(a)).slice(0,62).map(([date,day])=>({date,complete:day.hours.every(model.amount),totalCents:day.hours.reduce((sum,value)=>sum+(value??0),0)}))};}
 async function review(actor,input,tradingHours){return preview(await read(dir,actor),normalize(input,actor,tradingHours,{now:now()}));}
 async function save(actor,input,tradingHours){const imported=normalize(input,actor,tradingHours,{now:now()}),target=file(dir,actor),fingerprint=crypto.createHash('sha256').update(JSON.stringify([actor.id,imported.days,imported.mode,imported.sourceName])).digest('hex'),task=(queues.get(target)||Promise.resolve()).then(async()=>{
  const state=await read(dir,actor),previous=state.imports.find(item=>item.id===imported.requestId);if(previous){if(previous.fingerprint!==fingerprint)fail('This import reference was already used.',409);return previous.result;}
  if(state.revision!==imported.revision)fail('Hourly sales changed in another tab. Refresh the import preview before saving.',409);const result=preview(state,imported);if(!result.ready)return result;
  for(const day of result.days.filter(day=>day.status==='ready'))state.days[day.date]={hours:day.hours,updatedAt:new Date(now()).toISOString()};if(Object.keys(state.days).length>10000)fail('This location has reached the hourly history limit.');state.revision++;result.revision=state.revision;state.imports.push({id:imported.requestId,fingerprint,result:{...result,days:result.days.map(({hours,...day})=>day)},createdAt:new Date(now()).toISOString(),sourceName:imported.sourceName});state.imports=state.imports.slice(-100);const output=state.imports.at(-1).result;
  await fs.mkdir(path.dirname(target),{recursive:true});const temporary=target+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temporary,JSON.stringify(state),{mode:0o600});await fs.rename(temporary,target);}finally{await fs.rm(temporary,{force:true});}return output;
 });const settled=task.catch(()=>{});queues.set(target,settled);try{return await task;}finally{if(queues.get(target)===settled)queues.delete(target);}}
 return{report,review,save,read:actor=>read(dir,actor)};
}
module.exports={createStore,normalize,preview,forecast,allocate,hoursHash,read};
