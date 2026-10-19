const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const queues=new Map(),maximumCents=1000000000;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function month(value){if(typeof value!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value))fail('Choose a valid report month.');return value;}
function currentMonth(now=new Date()){const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit'}).formatToParts(now),part=type=>parts.find(entry=>entry.type===type).value;return part('year')+'-'+part('month');}
function createdMonth(network){return network.createdAt?currentMonth(new Date(network.createdAt)):null;}
async function read(file,fallback){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return fallback;}}
function change(file,revision,fallback,update){const task=(queues.get(file)||Promise.resolve()).then(async()=>{const previous=await read(file,fallback);if(!Number.isSafeInteger(revision)||revision<0)fail('Reload the report before saving.');if(previous.revision!==revision)fail('This report changed in another tab. Reload before saving.',409);const next={...await update(previous),revision:previous.revision+1,updatedAt:new Date().toISOString()},temporary=file+'.'+crypto.randomUUID()+'.tmp';await fs.mkdir(path.dirname(file),{recursive:true});try{await fs.writeFile(temporary,JSON.stringify(next),{mode:0o600});await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}return next;});queues.set(file,task.catch(()=>{}));return task;}
const note=value=>{if(typeof value!=='string'||value.length>500)fail('Use notes of up to 500 characters.');return value.trim();};
const amount=value=>{if(!Number.isSafeInteger(value)||value<0||value>maximumCents)fail('Enter a non-negative amount with up to two decimal places.');return value;};
const feesFile=root=>path.join(root,'opstack/monthly-location-fees.json');
const expenseFile=(root,selected)=>path.join(root,'opstack/monthly-expenses',month(selected)+'.json');
async function report(root,networks,selected=currentMonth()){
 month(selected);const [fees,expenses]=await Promise.all([read(feesFile(root),{revision:0,networks:{}}),read(expenseFile(root,selected),{revision:0,entries:[]})]);
 const rows=await Promise.all(networks.filter(network=>!createdMonth(network)||createdMonth(network)<=selected).map(async network=>{
  const dir=network.id==='default'?root:path.join(root,'networks',network.id),[locations,companies]=await Promise.all([read(path.join(dir,'locations.json'),[]),read(path.join(dir,'companies.json'),[])]);
  const entries=locations.filter(location=>!createdMonth(location)||createdMonth(location)<=selected).map(location=>{const schedule=fees.networks[network.id]?.[location.id]||[],effective=schedule.filter(entry=>entry.month<=selected).sort((a,b)=>b.month.localeCompare(a.month))[0];return{id:location.id,name:location.name,companyName:companies.find(company=>company.id===(location.companyId||'default'))?.name||'',archived:Boolean(location.archived),amountCents:effective?.amountCents??null,effectiveFrom:effective?.month||null,notes:effective?.notes||''};});
  return{networkId:network.id,name:network.name,slug:network.slug,active:network.active,createdAt:network.createdAt||null,amountCents:entries.reduce((sum,location)=>sum+(location.amountCents??0),0),missingFees:entries.filter(location=>location.amountCents===null).length,locations:entries};
 }));
 const salesCents=rows.reduce((sum,row)=>sum+row.amountCents,0),expenseCents=expenses.entries.reduce((sum,entry)=>sum+entry.amountCents,0),missingFees=rows.reduce((sum,row)=>sum+row.missingFees,0);
 if(!Number.isSafeInteger(salesCents)||!Number.isSafeInteger(expenseCents))fail('Report totals exceed the supported amount.');
 return{month:selected,currentMonth:currentMonth(),timeZone:'Australia/Melbourne',currency:'AUD',feeRevision:fees.revision,rows,expenses,totals:{salesCents,expenseCents,profitCents:missingFees?null:salesCents-expenseCents,networkCount:rows.length,locationCount:rows.reduce((sum,row)=>sum+row.locations.length,0),missingFees}};
}
async function saveFee(root,networks,id,locationId,input){
 if(!input||Object.keys(input).some(key=>!['month','revision','amountCents','notes'].includes(key)))fail('Enter a valid monthly fee.');const selected=month(input.month),network=networks.find(network=>network.id===id);if(!network)fail('Network not found.',404);if(createdMonth(network)&&selected<createdMonth(network))fail('A fee cannot start before the network was created.');
 const dir=id==='default'?root:path.join(root,'networks',id),location=(await read(path.join(dir,'locations.json'),[])).find(location=>location.id===locationId);if(!location)fail('Location not found in this network.',404);if(createdMonth(location)&&selected<createdMonth(location))fail('A fee cannot start before the location was created.');
 const entry={month:selected,amountCents:input.amountCents===null?null:amount(input.amountCents),notes:note(input.notes??'')};
 return change(feesFile(root),input.revision,{revision:0,networks:{}},previous=>({...previous,networks:{...previous.networks,[id]:{...previous.networks[id],[locationId]:[...(previous.networks[id]?.[locationId]||[]).filter(value=>value.month!==selected),entry].sort((a,b)=>a.month.localeCompare(b.month))}}}));
}
async function saveExpenses(root,input){
 if(!input||Object.keys(input).some(key=>!['month','revision','entries'].includes(key))||!Array.isArray(input.entries)||input.entries.length>100)fail('Use up to 100 expense entries per month.');const selected=month(input.month),ids=new Set();
 const entries=input.entries.map(entry=>{if(!entry||Object.keys(entry).some(key=>!['id','name','amountCents','notes'].includes(key))||typeof entry.id!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(entry.id)||ids.has(entry.id))fail('Choose valid, distinct expense entries.');ids.add(entry.id);if(typeof entry.name!=='string'||!entry.name.trim()||entry.name.length>100)fail('Enter an expense name of up to 100 characters.');return{id:entry.id,name:entry.name.trim(),amountCents:amount(entry.amountCents),notes:note(entry.notes??'')};});
 return change(expenseFile(root,selected),input.revision,{revision:0,entries:[]},()=>({month:selected,entries}));
}
module.exports={report,saveFee,saveExpenses,currentMonth};
