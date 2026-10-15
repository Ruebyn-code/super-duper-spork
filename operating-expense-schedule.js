const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const report=require('./public/weekly-sales-report'),types=require('./operating-expense-types');
const maximum=7000000000,weekMs=604800000,pending=new Map();
const shift=(date,weeks)=>new Date(Date.parse(date+'T00:00:00Z')+weeks*weekMs).toISOString().slice(0,10);
const identity=(typeId,startWeek)=>'legacy-'+crypto.createHash('sha256').update(typeId+'\n'+startWeek).digest('hex').slice(0,32);
function fail(message,status=400){const error=Error(message);error.status=status;throw error;}
function validWeek(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value&&new Date(value+'T00:00:00Z').getUTCDay()===1;}
function target(dir,session){if(!/^[a-zA-Z0-9-]{1,100}$/.test(session?.locationId||''))fail('Choose an accessible location.',403);return path.join(dir,'operating-expense-schedules',session.locationId+'.json');}
async function locked(file,operation){const work=(pending.get(file)||Promise.resolve()).then(operation),settled=work.catch(()=>{});pending.set(file,settled);try{return await work;}finally{if(pending.get(file)===settled)pending.delete(file);}}
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temp=file+'.'+crypto.randomUUID()+'.tmp';try{await fs.writeFile(temp,JSON.stringify(value,null,2),{mode:0o600});await fs.rename(temp,file);}finally{await fs.rm(temp,{force:true});}}
function end(bill){const until=shift(bill.startWeek,bill.weeks);return bill.stopWeek&&bill.stopWeek<until?bill.stopWeek:until;}
function cost(bills,week){return bills.reduce((sum,bill)=>sum+(week>=end(bill)?0:report.allocationCost(bill,week)),0);}
function legacyRows(bills,week){const latest=new Map();for(const bill of bills)if(bill.startWeek<=week&&(!latest.has(bill.typeId)||bill.startWeek>latest.get(bill.typeId).startWeek))latest.set(bill.typeId,bill);return [...latest.values()].map(bill=>bill.stopWeek&&bill.stopWeek<=week?{typeId:bill.typeId,description:bill.description,totalCents:null,weeks:1,startWeek:bill.stopWeek,cleared:true}:{typeId:bill.typeId,description:bill.description,totalCents:bill.totalCents,weeks:bill.weeks,startWeek:bill.startWeek});}
function legacyChanges(schedule,allocations,week){
 const bills=schedule.bills.map(bill=>({...bill}));
 for(const row of allocations||[]){if(row.startWeek!==week||row.totalCents===null&&!row.cleared)continue;
  if(row.cleared){for(const bill of bills)if(bill.id.startsWith('legacy-')&&!bill.managed&&bill.typeId===row.typeId&&bill.startWeek<=week&&end(bill)>week)bill.stopWeek=week;continue;}
  const id=identity(row.typeId,week);if(schedule.retiredOrigins?.includes(id))continue;const index=bills.findIndex(bill=>bill.id===id),modern=bills.find(bill=>bill.typeId===row.typeId&&bill.startWeek===week&&(bill.id!==id||bill.managed)),bill={id,typeId:row.typeId,description:row.description,totalCents:row.totalCents,weeks:row.weeks,startWeek:week};
  if(modern){if(modern.totalCents!==row.totalCents||modern.weeks!==row.weeks)fail('This expense uses the new schedule. Reload the app and edit its saved bill.',409);continue;}
  if(index>=0)bills[index]={...bills[index],...bill};else bills.push(bill);
  for(const previous of bills)if(previous.id.startsWith('legacy-')&&!previous.managed&&previous.typeId===row.typeId&&previous.startWeek<week&&end(previous)>week)previous.stopWeek=week;
 }
 return {...schedule,bills};
}
async function migrate(dir,session){
 const folder=path.join(dir,'weekly-sales-reports',session.locationId);let names;try{names=(await fs.readdir(folder)).filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();}catch(error){if(error.code!=='ENOENT')throw error;names=[];}
 const selected=new Map();for(const name of names){const source=JSON.parse(await fs.readFile(path.join(folder,name),'utf8'));for(const row of source.operatingAllocations||[]){if(!validWeek(row.startWeek)||row.startWeek>source.weekStart||row.totalCents===null&&!row.cleared)continue;const key=row.typeId+'\n'+row.startWeek,previous=selected.get(key),origin=source.weekStart===row.startWeek;if(!previous||origin&&!previous.origin)selected.set(key,{row,origin});}}
 let schedule={version:2,revision:0,bills:[],migratedAt:new Date().toISOString()};
 for(const {row} of [...selected.values()].sort((a,b)=>a.row.startWeek.localeCompare(b.row.startWeek)))schedule=legacyChanges(schedule,[row],row.startWeek);
 return schedule;
}
async function load(dir,session,file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;const value=await migrate(dir,session);await write(file,value);return value;}}
async function read(dir,session){const file=target(dir,session);return locked(file,()=>load(dir,session,file));}
function validateBills(bills){
 const grouped=new Map(),events=new Map(),event=(date,change)=>events.set(date,(events.get(date)||0)+change);
 for(const bill of bills){const until=end(bill);if(until<=bill.startWeek)continue;const list=grouped.get(bill.typeId)||[];list.push(bill);grouped.set(bill.typeId,list);const base=Math.floor(bill.totalCents/bill.weeks),remainder=bill.totalCents%bill.weeks;event(bill.startWeek,base);event(until,-base);if(remainder){const extraEnd=shift(bill.startWeek,remainder)<until?shift(bill.startWeek,remainder):until;event(bill.startWeek,1);event(extraEnd,-1);}}
 for(const list of grouped.values()){list.sort((a,b)=>a.startWeek.localeCompare(b.startWeek));for(let index=1;index<list.length;index++)if(list[index].startWeek<end(list[index-1]))fail('This expense already has a bill covering those weeks. Edit that bill or choose a different start week.');}
 let total=0;for(const [,change] of [...events].sort(([a],[b])=>a.localeCompare(b))){total+=change;if(total>maximum)fail('The operating expense total exceeds the weekly limit.');}
}
async function change(dir,session,input){
 if(!input||!Number.isSafeInteger(input.revision)||input.revision<0||!Array.isArray(input.changes)||!input.changes.length||input.changes.length>100)fail('Reload operating expenses before saving.');
 const file=target(dir,session);return locked(file,async()=>{const previous=await load(dir,session,file);if(previous.revision!==input.revision){const same=input.changes.every(item=>{const bill=previous.bills.find(bill=>bill.id===item?.id);return item?.deleted===true?!bill:bill&&['typeId','totalCents','weeks','startWeek'].every(key=>bill[key]===item[key]);});if(same)return previous;fail('Operating expenses changed in another tab. Reload the saved week before saving.',409);}
  const catalogue=await types.read(dir,session),bills=previous.bills.map(bill=>({...bill})),seen=new Set(),retired=new Set(previous.retiredOrigins||[]);
  for(const item of input.changes){if(!item||typeof item.id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(item.id)||seen.has(item.id))fail('Choose a valid expense bill.');seen.add(item.id);const index=bills.findIndex(bill=>bill.id===item.id);
   if(item.deleted===true){if(index<0)fail('Expense bill not found.',404);retired.add(identity(bills[index].typeId,bills[index].startWeek));bills.splice(index,1);continue;}
   if(typeof item.typeId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(item.typeId))fail('Choose an existing expense type.');const type=catalogue.types.find(type=>type.id===item.typeId),existing=bills[index];if(!type&&existing?.typeId!==item.typeId)fail('Choose an existing expense type.');
   if(!Number.isSafeInteger(item.totalCents)||item.totalCents<0||item.totalCents>maximum||!Number.isInteger(item.weeks)||item.weeks<1||item.weeks>520||!validWeek(item.startWeek)||!/^\d{4}-\d{2}-\d{2}$/.test(shift(item.startWeek,item.weeks)))fail('Enter a total cost, a Monday start date, and 1 to 520 weeks.');
   if(existing&&(existing.startWeek!==item.startWeek||existing.typeId!==item.typeId))retired.add(identity(existing.typeId,existing.startWeek));retired.delete(identity(item.typeId,item.startWeek));const bill={id:item.id,managed:true,typeId:item.typeId,description:type?.name||existing.description,totalCents:item.totalCents,weeks:item.weeks,startWeek:item.startWeek,...(existing?.stopWeek&&existing.startWeek===item.startWeek&&existing.weeks===item.weeks?{stopWeek:existing.stopWeek}:{}),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};if(index<0)bills.push(bill);else bills[index]=bill;
  }
  if(bills.length>10000)fail('Use up to 10,000 saved expense bills.');validateBills(bills);const next={...previous,revision:previous.revision+1,bills,retiredOrigins:[...retired],updatedAt:new Date().toISOString(),updatedBy:session.username};await write(file,next);return next;
 });
}
async function applyLegacy(dir,session,schedule,allocations,week){const file=target(dir,session);return locked(file,async()=>{const previous=await load(dir,session,file);if(previous.revision!==schedule.revision)fail('Operating expenses changed in another tab. Reload the saved week before saving.',409);const next=legacyChanges(previous,allocations,week);if(JSON.stringify(previous.bills)===JSON.stringify(next.bills))return previous;validateBills(next.bills);next.revision++;next.updatedAt=new Date().toISOString();await write(file,next);return next;});}
module.exports={read,change,cost,end,validWeek,legacyRows,legacyChanges,applyLegacy};
