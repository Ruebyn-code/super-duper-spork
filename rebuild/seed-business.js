// Seeds the demo business history the later phases need: sales weeks and a
// reconciled weekly report, invoices, an employer with a published roster and
// an approved timesheet, comms, library articles, a course and a checklist.
//
// Idempotent: it only runs when the harbour location has no sales weeks yet, so
// a data directory created by an earlier phase gains the demo history once and
// keeps whatever has been added since.
const crypto=require('node:crypto');
const {createSales}=require('./sales');
const {createInvoices}=require('./invoices');
const {createWorkforce}=require('./workforce');
const {createComms}=require('./comms');
const {createLibrary}=require('./library');
const {createLearning}=require('./learning');
const {createChecklists}=require('./checklists');
const M=require('../public/rostering-model');

const dayMs=86400000;
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*dayMs).toISOString().slice(0,10);
const dollars=cents=>(cents/100).toFixed(2);

async function seedBusiness({store,dir=null,companies,locations,accounts,now=Date.now}){
 const [harbour,riverside]=companies;
 const street=locations.find(location=>location.name==='Harbour Street');
 const riversideLocation=locations.find(location=>location.companyId===riverside?.id);
 if(!harbour||!street)return {seeded:false};
 const existing=await store.read('salesWeeks');
 if(existing.some(record=>record.locationId===street.id))return {seeded:false};
 const admin=accounts.find(account=>account.email==='admin@harbour.test');
 const manager=accounts.find(account=>account.email==='manager@harbour.test');
 if(!admin||!manager)return {seeded:false};

 const sales=createSales({store,dir:dir||store.dir});
 const invoices=createInvoices({store});
 const workforce=createWorkforce({store});
 const comms=createComms({store});
 const library=createLibrary({store});
 const learning=createLearning({store});
 const checklists=createChecklists({store});

 const today=sales.today(),weekStart=shift(today,-(new Date(today+'T00:00:00Z').getUTCDay()+6)%7);
 const todayIndex=(new Date(today+'T00:00:00Z').getUTCDay()+6)%7;

 // ---- sales: five weeks of daily sales, one imported weekly report ----------
 const base=[820000,760000,905000,880000,1120000,1480000,1210000];
 for(const offset of [4,3,2,1,0]){
  const start=shift(weekStart,-7*offset);
  const days=base.map((value,index)=>offset===0&&index>todayIndex?null:Math.round(value*(1+0.012*(4-offset))));
  await sales.saveWeek(admin,{companyId:harbour.id,locationId:street.id,weekStart:start,days,revision:0});
  if(offset===2){
   // The report disagrees slightly with Daily sales and must win for its week.
   const rows=[['date','till','uber_eats','door_dash','fees','total']];
   days.forEach((value,index)=>{
    const till=Math.round(value*0.9),uber=Math.round(value*0.07),door=value-till-uber;
    rows.push([shift(start,index),dollars(till),dollars(uber),dollars(door),'12.00',dollars(value)]);
   });
   await sales.importReport(admin,{companyId:harbour.id,locationId:street.id,csv:rows.map(row=>row.join(',')).join('\n'),sourceName:'Week '+start.slice(5)+' sales report'});
  }
 }
 await sales.saveBudget(admin,{companyId:harbour.id,locationId:street.id,weekStart,salesCents:6500000,labourCents:1850000});
 await sales.saveExpense(admin,{companyId:harbour.id,locationId:street.id,date:weekStart,type:'Rent',amountCents:320000,description:'Weekly rent'});
 await sales.saveExpense(admin,{companyId:harbour.id,locationId:street.id,date:shift(weekStart,2),type:'Utilities',amountCents:41000,description:'Electricity'});
 const todayHours=Array.from({length:24},(_,hour)=>hour>=8&&hour<=20?Math.round(30000+hour*4200):null);
 await sales.saveHourly(admin,{companyId:harbour.id,locationId:street.id,date:today,hours:todayHours,revision:0});

 // ---- invoices: one applied, one waiting on a decision ----------------------
 const catalogue=(await store.read('products')).filter(product=>product.companyId===harbour.id&&Number.isSafeInteger(product.unitPriceCents)).slice(0,3);
 if(catalogue.length>=2){
  const supplier=(await store.read('suppliers')).find(item=>item.id===catalogue[0].supplierId)||null;
  const first=await invoices.create(admin,{companyId:harbour.id,locationId:street.id,supplierId:supplier?.id||null,supplierName:supplier?.name,
   invoiceDate:shift(weekStart,-4),invoiceNumber:'INV-2041',sourceName:'Delivery docket',
   lines:catalogue.slice(0,2).map(product=>({description:product.name,sku:product.sku,quantity:6,unitPriceCents:product.unitPriceCents+200}))});
  await invoices.applyPrices(admin,{invoiceId:first.id,revision:first.revision});
  await invoices.create(admin,{companyId:harbour.id,locationId:street.id,supplierId:supplier?.id||null,supplierName:supplier?.name,
   invoiceDate:shift(weekStart,-1),invoiceNumber:'INV-2077',sourceName:'Delivery docket',
   lines:[{description:catalogue[2]?.name||catalogue[0].name,sku:catalogue[2]?.sku||catalogue[0].sku,quantity:2,unitPriceCents:(catalogue[2]?.unitPriceCents||catalogue[0].unitPriceCents)+150},
    {description:'Unlisted cleaning chemical',sku:'',quantity:1,unitPriceCents:1850}]});
 }

 // ---- workforce: employer, terms, a published week and an approved pay week --
 await workforce.saveEmployer(admin,{companyId:harbour.id,locationId:street.id,employerName:'Harbour Street Pty Ltd',
  publicHolidayState:'VIC',payPeriodAnchor:weekStart,payPeriodWeeks:1,superBps:1200,coverageConfirmed:true});
 await workforce.saveProfile(admin,{companyId:harbour.id,locationId:street.id,accountId:manager.id,effectiveFrom:'2025-02-03',
  dateOfBirth:'1998-04-12',employmentStart:'2025-02-03',employmentType:'full-time',classification:'1',payBasis:'award',cycleWeeks:1});
 for(const [day,start,end] of [[0,'09:00','17:00'],[2,'10:00','18:00'],[5,'09:00','13:00']]){
  await workforce.saveShift(admin,{companyId:harbour.id,locationId:street.id,accountId:manager.id,date:shift(weekStart,day),start,end,position:'Counter'});
 }
 await workforce.publish(admin,{companyId:harbour.id,locationId:street.id,weekStart});

 // Last week's completed work, approved so its pay snapshot is frozen evidence.
 const lastWeek=shift(weekStart,-7);
 const events=[];
 for(const [date,start,breakStart,breakEnd,end] of [[lastWeek,'09:00','12:00','12:30','17:00'],[shift(lastWeek,1),'10:00','13:00','13:30','16:00']]){
  for(const [kind,time] of [['in',start],['break-start',breakStart],['break-end',breakEnd],['out',end]]){
   events.push({id:crypto.randomUUID(),companyId:harbour.id,locationId:street.id,accountId:manager.id,name:manager.name,kind,at:M.instant(date,time)});
  }
 }
 await store.change('clockEvents',list=>{list.push(...events);});
 await workforce.approve(admin,{companyId:harbour.id,locationId:street.id,weekStart:lastWeek});

 // ---- comms -----------------------------------------------------------------
 await comms.createPost(admin,{companyId:harbour.id,title:'Winter menu starts Monday',body:'The new winter menu goes live on Monday. Print the updated prep labels before service and move the old cards to the back.'});
 const riversideAdmin=accounts.find(account=>account.email==='admin@riverside.test');
 if(riversideLocation&&riversideAdmin)await comms.createPost(riversideAdmin,{companyId:riverside.id,title:'Riverside allergen matrix',
  body:'The updated allergen matrix must be read and acknowledged before your next shift.',audience:'location',locationIds:[riversideLocation.id],required:true});
 const conversation=await comms.startConversation(admin,{companyId:harbour.id,memberIds:[manager.id]});
 await comms.sendMessage(admin,{conversationId:conversation.id,body:'Deliveries move to Tuesday from next week — the docket is in the invoice list.'});
 await comms.sendMessage(manager,{conversationId:conversation.id,body:'Noted. I will update the shelf count after the first Tuesday delivery.'});

 // ---- library ---------------------------------------------------------------
 const category=await library.saveCategory(admin,{companyId:harbour.id,name:'Operations'});
 const article=await library.saveArticle(admin,{companyId:harbour.id,categoryId:category.id,title:'Opening checklist for new starters',
  body:'Unlock the front door, switch on the fridges and check the temperatures before the first service. Log any fridge above 5°C and call the manager.'});
 await library.publishArticle(admin,article.id);
 const allergens=await library.saveArticle(admin,{companyId:harbour.id,categoryId:category.id,title:'Allergen handling',
  body:'Keep separate tongs for each allergen group, label every container and never reuse a surface without washing it first.'});
 await library.publishArticle(admin,allergens.id);

 // ---- learning --------------------------------------------------------------
 const course=await learning.saveCourse(admin,{companyId:harbour.id,title:'Allergen awareness',summary:'Annual refresher for everyone on the floor.',passPercent:80,
  lessons:[{title:'The nine declared allergens',body:'Milk, eggs, fish, crustacea, peanuts, tree nuts, soy, sesame and lupin. A guest asking about any of these must be told exactly what the dish contains.'},
   {title:'Cross-contact',body:'Separate utensils, separate boards and a clean surface. If you are unsure, stop and ask the manager.'}],
  questions:[
   {prompt:'Which of these is not a declared allergen?',options:[{text:'Sesame',correct:false},{text:'Rice',correct:true}]},
   {prompt:'What do you do if you are unsure about a dish?',options:[{text:'Guess the closest match',correct:false},{text:'Stop and ask the manager',correct:true}]}
  ]});
 await learning.publishCourse(admin,course.id);
 await learning.assign(admin,{companyId:harbour.id,courseId:course.id,accountIds:[manager.id],dueDate:shift(today,21)});

 // ---- checklists ------------------------------------------------------------
 const checklist=await checklists.saveChecklist(admin,{companyId:harbour.id,title:'Close the store',steps:[{text:'Lock the front door'},{text:'Count the till'},{text:'Set the alarm'}]});
 const run=await checklists.startRun(admin,{checklistId:checklist.id,locationId:street.id});
 for(const step of checklist.steps)await checklists.tick(admin,{runId:run.id,stepId:step.id});

 return {seeded:true};
}
module.exports={seedBusiness};
