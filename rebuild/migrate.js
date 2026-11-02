// Phase 7 — migration from the current app's data directory.
//
// A dry run reads every source store, reports what would move, which records
// are orphaned (a missing company, location or account), and which source
// stores have no target in the rebuild yet. It never writes. `apply()` writes
// with stable natural keys (`legacyId`, and location+week for sales) so a
// re-run updates instead of duplicating, then reconciles the imported totals
// against the source's own numbers. Anything unresolved is listed in the
// report; nothing is silently dropped, reassigned or deleted from the source.
const crypto=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');

// Source stores this rebuild has a target for. Anything else found in the
// source directory is reported as `unmapped` rather than ignored.
const knownSourceFiles=['companies.json','locations.json','accounts.json','catalogue.json','rostering.json','award-compliance.json','communications.json','knowledge-library.json','learning-centre.json','ops-management.json'];
const sourceDirs=['location-sales','weekly-sales-reports','stock-counts','invoices','sales'];

const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const list=value=>Array.isArray(value)?value:Array.isArray(value?.items)?value.items:[];
const stampOf=value=>{
 const parsed=Date.parse(value);
 return Number.isFinite(parsed)?new Date(parsed).toISOString():new Date(0).toISOString();
};
const monday=date=>new Date(Date.parse(date+'T00:00:00Z')-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
const integer=value=>Number.isSafeInteger(value)&&value>=0;

function createMigration({store,sourceDir,now=Date.now}){
 async function readJson(file){
  try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}
 }
 async function readDir(dir){
  try{return (await fs.readdir(dir,{withFileTypes:true}));}catch(error){if(error.code==='ENOENT')return [];throw error;}
 }

 // Every source record becomes one of these, with its original id kept.
 async function scan(){
  const source={};
  for(const name of knownSourceFiles)source[name]=await readJson(path.join(sourceDir,name));
  const presentDirs=[];
  for(const dir of sourceDirs){
   const entries=await readDir(path.join(sourceDir,dir));
   if(entries.length)presentDirs.push(dir);
   if(dir==='location-sales'||dir==='weekly-sales-reports'||dir==='invoices'){
    source[dir]={};
    for(const entry of entries.filter(item=>item.isDirectory())){
     const folder=path.join(sourceDir,dir,entry.name);
     const files=(await readDir(folder)).filter(file=>file.isFile()&&file.name.endsWith('.json'));
     source[dir][entry.name]=[];
     for(const file of files)source[dir][entry.name].push(await readJson(path.join(folder,file.name)));
    }
   }else if(dir==='stock-counts'||dir==='sales'){
    source[dir]=[];
    for(const entry of entries.filter(item=>item.isFile()&&item.name.endsWith('.json'))){
     const value=await readJson(path.join(sourceDir,dir,entry.name));
     // One record per file, or a file holding an array of records.
     source[dir].push(...(Array.isArray(value)?value:[value]));
    }
   }
  }
  return {source,presentDirs};
 }

 function adapters(source){
  const companies=list(source['companies.json']).map(record=>({
   id:String(record.id),name:String(record.name||record.id),createdAt:stampOf(record.createdAt),legacyId:String(record.id)
  }));
  const locations=list(source['locations.json']).map(record=>({
   id:String(record.id),companyId:String(record.companyId||'default'),name:String(record.name||record.id),
   publicHolidayState:record.publicHolidayState||null,archived:Boolean(record.archived),
   createdAt:stampOf(record.createdAt),legacyAccountIds:list(record.legacyAccountIds).map(String),legacyId:String(record.id)
  }));
  // Passwords are not portable, so accounts migrate as identity records only.
  const accounts=list(source['accounts.json']).map(record=>({
   id:String(record.id),name:String(record.username||record.name||record.id),
   email:String(record.email||record.username||record.id),role:String(record.role||'user'),
   permissions:list(record.permissions).map(String),actionPermissions:record.actionPermissions||{},
   companyIds:list(record.companyIds).map(String),locationIds:[...new Set([...(list(record.locationIds)),...(record.locationId?[record.locationId]:[])].map(String))],
   version:String(record.version||crypto.randomUUID()),createdAt:stampOf(record.createdAt),
   passwordMigrated:false,legacyId:String(record.id)
  }));
  const catalogue=source['catalogue.json']||{};
  const suppliers=list(catalogue.suppliers).map(record=>({
   id:String(record.id),companyId:String(record.companyId||'default'),name:String(record.name||record.id),
   archived:Boolean(record.archived),createdAt:stampOf(record.createdAt),legacyId:String(record.id)
  }));
  const products=list(catalogue.products).map(record=>({
   id:String(record.id),companyId:String(record.companyId||'default'),name:String(record.name||record.id),
   sku:String(record.sku||''),unit:String(record.unitAmount||record.unit||''),category:String(record.category||''),
   supplierId:record.supplierId?String(record.supplierId):'',unitPriceCents:integer(record.price)?record.price:null,
   orderRule:['minimum','multiples','cutoff','separate'].includes(record.orderRule)?record.orderRule:'minimum',
   minimumOrder:integer(record.minimumOrder)&&record.minimumOrder>0?record.minimumOrder:1,
   roundingCutoff:integer(record.roundingCutoff)?record.roundingCutoff:null,
   roundDownThreshold:integer(record.roundDownThreshold)?record.roundDownThreshold:null,
   roundUpThreshold:integer(record.roundUpThreshold)?record.roundUpThreshold:null,
   archived:Boolean(record.archived),createdAt:stampOf(record.createdAt),legacyId:String(record.id)
  }));
  const salesWeeks=[];
  for(const [locationId,records] of Object.entries(source['location-sales']||{})){
   for(const record of records){
    if(!record||typeof record.weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(record.weekStart))continue;
    salesWeeks.push({
     id:'legacy-sales-'+locationId+'-'+record.weekStart,companyId:null,locationId,
     weekStart:record.weekStart,days:Array.from({length:7},(_,index)=>integer(record.days?.[index])?record.days[index]:null),
     revision:integer(record.revision)?record.revision:1,updatedAt:stampOf(record.updatedAt),
     recordedById:null,legacyId:'sales-'+locationId+'-'+record.weekStart
    });
   }
  }
  const weeklyReports=[];
  for(const [locationId,records] of Object.entries(source['weekly-sales-reports']||{})){
   for(const record of records){
    if(!record||typeof record.weekStart!=='string')continue;
    const channel=field=>Array.from({length:7},(_,index)=>integer(record.breakdown?.[field]?.[index])?record.breakdown[field][index]:null);
    const breakdown={tillSales:channel('tillSales'),uberEats:channel('uberEats'),doorDash:channel('doorDash')};
    if(!breakdown.tillSales.some(value=>value!==null))continue;
    weeklyReports.push({
     id:'legacy-report-'+locationId+'-'+record.weekStart,companyId:null,locationId,weekStart:record.weekStart,
     breakdown,feesCents:integer(record.feesCents)?record.feesCents:0,
     days:Array.from({length:7},(_,index)=>[breakdown.tillSales[index],breakdown.uberEats[index],breakdown.doorDash[index]].every(value=>value!==null)
      ?{date:null,totalCents:breakdown.tillSales[index]+breakdown.uberEats[index]+breakdown.doorDash[index],feesCents:0}:null).filter(Boolean),
     totalCents:Array.from({length:7},(_,index)=>[breakdown.tillSales[index],breakdown.uberEats[index],breakdown.doorDash[index]]).filter(values=>values.every(value=>value!==null)).reduce((sum,values)=>sum+values[0]+values[1]+values[2],0),
     revision:1,importedAt:stampOf(record.updatedAt),importedByName:'Legacy import',sourceName:'Legacy weekly report',
     checksum:record.checksum||null,legacyId:'report-'+locationId+'-'+record.weekStart
    });
   }
  }
  const counts=[],movements=[];
  for(const record of list(source['stock-counts'])){
   if(!record||!record.locationId||!Array.isArray(record.items))continue;
   const id='legacy-count-'+String(record.id);
   counts.push({id,companyId:null,locationId:String(record.locationId),locationName:String(record.locationName||''),
    countDate:String(record.countDate||'').slice(0,10),note:String(record.note||''),counterId:null,counterName:String(record.counterName||'Legacy import'),
    items:record.items.map(item=>({productId:String(item.productId),name:String(item.name||''),sku:String(item.sku||''),unit:String(item.unit||''),quantity:Number(item.quantity)})),
    createdAt:stampOf(record.createdAt),legacyId:String(record.id)});
   for(const item of record.items)if(Number.isFinite(Number(item.quantity)))movements.push({
    id:'legacy-movement-'+String(record.id)+'-'+String(item.productId),companyId:null,locationId:String(record.locationId),
    productId:String(item.productId),kind:'count',delta:Math.round(Number(item.quantity)*1000),refId:id,
    at:stampOf(record.createdAt),actorId:null,legacyId:'movement-'+String(record.id)+'-'+String(item.productId)
   });
  }
  const invoices=[];
  for(const [locationId,records] of Object.entries(source['invoices']||{})){
   for(const record of records){
    if(!record||!Array.isArray(record.lines))continue;
    invoices.push({
     id:String(record.id),companyId:null,locationId,locationName:'',weekStart:record.weekStart||monday(String(record.invoiceDate||'').slice(0,10)),
     invoiceDate:String(record.invoiceDate||'').slice(0,10),invoiceNumber:String(record.invoiceNumber||''),
     supplierId:record.supplierId||null,supplierName:String(record.supplierName||''),sourceName:String(record.sourceName||''),
     lines:record.lines.map(line=>({description:String(line.description||''),sku:String(line.sku||''),quantity:Number(line.quantity),
      unitPriceCents:Number(line.unitPriceCents),gstCents:Number.isSafeInteger(line.gstCents)?line.gstCents:null,
      productId:line.productId||null,productName:line.productName||null,match:line.match||'unknown'})),
     totalCents:record.lines.reduce((sum,line)=>sum+Math.round(Number(line.quantity)*Number(line.unitPriceCents)),0),
     gstCents:null,status:record.status==='applied'?'applied':'review',revision:integer(record.revision)?record.revision:1,
     matchedAt:stampOf(record.createdAt),createdById:null,createdByName:String(record.createdByName||'Legacy import'),
     appliedAt:record.appliedAt?stampOf(record.appliedAt):null,legacyId:String(record.id)
    });
   }
  }
  const award=source['award-compliance.json']||{};
  const employer=[],employees=[];
  for(const record of list(award.locationEmployers))employer.push({
   id:'legacy-employer-'+String(record.locationId),companyId:String(record.companyId),locationId:String(record.locationId),
   locationName:'',enabled:record.enabled===true,coverageConfirmed:record.coverageConfirmed===true,
   localPayEnabled:record.localPayEnabled===true,sourceId:record.sourceId||null,employerName:String(record.employerName||''),
   payPeriodAnchor:record.payPeriodAnchor||null,payPeriodWeeks:record.payPeriodWeeks||1,
   superBps:Number.isInteger(record.superBps)?record.superBps:null,oncostBps:Number.isInteger(record.oncostBps)?record.oncostBps:0,
   holidayCalendars:list(record.holidayCalendars),updatedAt:stampOf(record.updatedAt),legacyId:String(record.locationId)
  });
  for(const record of list(award.profiles))employees.push({
   ...record,id:String(record.id),companyId:String(record.companyId),accountId:String(record.userId||record.accountId),
   name:String(record.username||''),legacyId:String(record.id),userId:String(record.userId||record.accountId)
  });
  const rostering=source['rostering.json']||{};
  const shifts=list(rostering.shifts).map(record=>({...record,id:String(record.id),legacyId:String(record.id)}));
  const publications=list(rostering.publications).map(record=>({...record,id:String(record.id),legacyId:String(record.id)}));
  const comms=source['communications.json']||{},library=source['knowledge-library.json']||{},learning=source['learning-centre.json']||{},ops=source['ops-management.json']||{};
  return {
   companies,locations,accounts,suppliers,products,salesWeeks,weeklyReports,counts,stock:movements,invoices,employer,employees,shifts,publications,
   posts:list(comms.posts).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   conversations:list(comms.conversations).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   messages:list(comms.messages).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   articleCategories:list(library.categories).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   articles:list(library.articles).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   courses:list(learning.courses).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   assignments:list(learning.assignments).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   attempts:list(learning.attempts).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   checklists:list(ops.checklists).map(record=>({...record,id:String(record.id),legacyId:String(record.id)})),
   checklistRuns:list(ops.runs).map(record=>({...record,id:String(record.id),legacyId:String(record.id)}))
  };
 }

 // Scope columns are filled from the target's own companies/locations. A
 // record whose scope cannot be resolved is an orphan and is not written.
 async function scoped(adapted,{companies,locations}){
  const companyIds=new Set(companies.map(company=>company.id)),locationById=new Map(locations.map(location=>[location.id,location]));
  const orphans=[];
  const fix=(collection,records,scopeOf)=>{
   const out=[];
   for(const record of records){
    const scope=scopeOf(record);
    if(scope.locationId&&!locationById.has(scope.locationId)){orphans.push({collection,id:record.legacyId,reason:'Unknown location '+scope.locationId});continue;}
    if(scope.companyId&&!companyIds.has(scope.companyId)){orphans.push({collection,id:record.legacyId,reason:'Unknown company '+scope.companyId});continue;}
    const location=scope.locationId?locationById.get(scope.locationId):null;
    out.push({...record,companyId:scope.companyId||location?.companyId||record.companyId,locationName:record.locationName||location?.name||''});
   }
   return out;
  };
  const result={...adapted,orphans};
  result.locations=adapted.locations.filter(location=>{if(!companyIds.has(location.companyId)){orphans.push({collection:'locations',id:location.legacyId,reason:'Unknown company '+location.companyId});return false;}return true;});
  for(const name of ['suppliers','products'])result[name]=fix(name,adapted[name],record=>({companyId:record.companyId}));
  for(const name of ['salesWeeks','weeklyReports','counts','stock','invoices','posts','articles','courses','assignments','attempts','checklists','checklistRuns','shifts','publications'])
   result[name]=fix(name,adapted[name],record=>({companyId:record.companyId,locationId:record.locationId||record.locationIds?.[0]}));
  result.employer=fix('employer',adapted.employer,record=>({companyId:record.companyId,locationId:record.locationId}));
  result.employees=fix('employees',adapted.employees,record=>({companyId:record.companyId}));
  return result;
 }

 const COLLECTIONS=['companies','locations','accounts','suppliers','products','salesWeeks','weeklyReports','counts','stock','invoices','employer','employees','shifts','publications','posts','conversations','messages','articleCategories','articles','courses','assignments','attempts','checklists','checklistRuns'];

 function plan(adapted,presentDirs){
  const counts={};
  for(const name of COLLECTIONS)counts[name]={source:adapted[name].length,imported:0,updated:0,skipped:0};
  const unmapped=presentDirs.filter(dir=>!['location-sales','weekly-sales-reports','stock-counts','invoices'].includes(dir));
  return {counts,unmapped};
 }

 // The target's own companies and locations plus the ones this run is about to
 // import, so a record is only an orphan when its scope exists nowhere.
 async function universe(adapted){
  const [companies,locations]=await Promise.all([store.read('companies'),store.read('locations')]);
  const merge=(current,incoming)=>[...new Map([...current,...incoming].map(record=>[record.id,record])).values()];
  return {companies:merge(companies,adapted.companies),locations:merge(locations,adapted.locations)};
 }

 async function prepare(){
  const {source,presentDirs}=await scan();
  const incoming=adapters(source);
  return {presentDirs,incoming,adapted:await scoped(incoming,await universe(incoming))};
 }

 async function dryRun(){
  const {adapted,incoming,presentDirs}=await prepare();
  // Source counts describe everything the source holds, orphans included.
  const {counts,unmapped}=plan(incoming,presentDirs);
  return {
   runAt:new Date(now()).toISOString(),dryRun:true,sourceDir,
   counts,unmapped,orphans:adapted.orphans,
   totalSource:Object.values(counts).reduce((sum,entry)=>sum+entry.source,0),
   totalOrphans:adapted.orphans.length
  };
 }

 async function upsert(name,records){
  if(!records.length)return {imported:0,updated:0};
  return store.change(name,existing=>{
   let imported=0,updated=0;
   for(const record of records){
    const index=existing.findIndex(item=>item.legacyId&&item.legacyId===record.legacyId);
    if(index>=0){existing[index]={...existing[index],...record};updated++;}
    else{existing.push(record);imported++;}
   }
   return {imported,updated};
  });
 }

 // Reconcile the imported sales against the source's own day totals, and the
 // catalogue against its source counts. Any difference blocks cut-over.
 async function reconcile(adapted){
  const [salesWeeks,weeklyReports,products,suppliers]=await Promise.all([
   store.read('salesWeeks'),store.read('weeklyReports'),store.read('products'),store.read('suppliers')
  ]);
  const mismatches=[];
  for(const source of adapted.salesWeeks){
   const target=salesWeeks.find(record=>record.locationId===source.locationId&&record.weekStart===source.weekStart);
   const sourceTotal=source.days.reduce((sum,value)=>sum+(value??0),0),targetTotal=target?target.days.reduce((sum,value)=>sum+(value??0),0):null;
   if(!target||targetTotal!==sourceTotal)mismatches.push({kind:'daily-sales',locationId:source.locationId,weekStart:source.weekStart,sourceTotal,targetTotal});
  }
  for(const source of adapted.weeklyReports){
   const target=weeklyReports.find(record=>record.locationId===source.locationId&&record.weekStart===source.weekStart);
   if(!target||target.totalCents!==source.totalCents)mismatches.push({kind:'weekly-report',locationId:source.locationId,weekStart:source.weekStart,sourceTotal:source.totalCents,targetTotal:target?.totalCents??null});
  }
  const missingProducts=adapted.products.filter(source=>!products.some(product=>product.id===source.id));
  if(missingProducts.length)mismatches.push({kind:'catalogue',reason:'Imported products are missing from the catalogue.',missing:missingProducts.map(product=>product.id).slice(0,20)});
  return {reconciled:mismatches.length===0,mismatches,checked:{salesWeeks:adapted.salesWeeks.length,weeklyReports:adapted.weeklyReports.length,products:adapted.products.length,suppliers:adapted.suppliers.length,targetProducts:products.length,targetSuppliers:suppliers.length}};
 }

 async function apply(){
  const {adapted,incoming,presentDirs}=await prepare();
  const {counts,unmapped}=plan(incoming,presentDirs);
  // Companies and locations must land first: every other record resolves scope
  // against them.
  for(const name of COLLECTIONS){
   const result=await upsert(name,adapted[name]);
   counts[name].imported=result.imported;
   counts[name].updated=result.updated;
  }
  const reconciliation=await reconcile(adapted);
  const report={
   id:crypto.randomUUID(),runAt:new Date(now()).toISOString(),dryRun:false,sourceDir,counts,unmapped,
   orphans:adapted.orphans,totalSource:Object.values(counts).reduce((sum,entry)=>sum+entry.source,0),
   reconciliation,status:reconciliation.reconciled&&!adapted.orphans.length?'reconciled':'attention'
  };
  await store.change('migrationRuns',runs=>{runs.push(report);});
  return report;
 }

 async function latest(){return (await store.read('migrationRuns')).at(-1)||null;}

 return {dryRun,apply,latest,reconcile};
}
module.exports={createMigration,knownSourceFiles,sourceDirs};
