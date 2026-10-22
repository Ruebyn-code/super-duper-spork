const {can,any}=require('./permissions');
const pages=[
 ['home','Home','Dashboard greeting quick links','/home',['home.view']],
 ['ordering','Ordering','Catalogue stock items suppliers purchase request','/',['orders.view']],
 ['cart','Cart','Review submit stock order','/#cart',['orders.view']],
 ['counts','Stock counts','Inventory stock take usage','/stock-count',['counts.view']],
 ['transfers','Stock transfers','Send receive inter company location stock','/stock-transfers',['transfers.view']],
 ['sales','Daily sales','Sales entry projections ordering budget','/sales#entry',['sales.view']],
 ['projection','Projected sales','Forecast ordering budget','/sales#projection',['sales.view']],
 ['weekly','Weekly report','Sales platform fees payouts profit expenses','/sales#report',['finances.view']],
 ['overview','Overview','Quarter year to date weekly sales','/sales#overview',['finances.view']],
 ['cogs','Cost of goods','Supplier stock costs','/sales#expense-stock',['finances.view']],
 ['labour','Labour','Hours hourly rates wages costs','/sales#expense-labour',['finances.view']],
 ['opex','Op Ex','Operating expenses allocations marketing rent','/sales#expense-operating-expenses',['finances.view']],
 ['ro','R&O','Royalties overhead expenses','/sales#expense-ro',['finances.view']],
 ['reporting','Reporting','Detailed financial performance expense breakdown exports','/reporting',['reporting.view']],
 ['training-reports','Training progress reports','Who completed training courses staff completion overdue learning','/reporting#training',['reporting.view','learning.report','learning.view'],'all'],
 ['checklist-reports','Checklist progress reports','Checklist task completion overdue performance location rankings','/reporting#checklists',['reporting.view','ops.view'],'all'],
 ['intelligence-reports','OpStack intelligence reports','Scheduled reports email report inbox','/reporting#ai-reports',['reporting.view']],
 ['roster','Rostering','Team my roster shifts schedule beta','/rostering',['rostering.view']],
 ['availability','Availability','School holiday availability','/rostering#availability',['rostering.availability']],
 ['leave','Leave','Request annual personal leave','/rostering#leave',['rostering.leave']],
 ['timesheets','Timesheets','Hours clock breaks approval','/rostering#timesheets',['rostering.view']],
 ['comms','Comms','Communications posts announcements messages chats','/communications',['comms.view']],
 ['library','Knowledge Library','Policies company information articles categories','/knowledge-library',['knowledge.view']],
 ['learning','Learning centre','Training courses assignments knowledge checks','/learning-centre',['learning.view']],
 ['ops','Ops management','Active checklists jobs tasks','/ops-management#checklists',['ops.view']],
 ['builder','Checklist builder','Templates planners schedules','/ops-management#templates',['ops.manage']],
 ['labels','Labels','Food prep label templates printing Zebra','/labels',['prep.view']],
 ['invoices','Invoices','Scanner uploads weekly bundles price updates','/home?invoices=1',['home.view','invoices.view'],'all'],
 ['stock','Stock items','Manage catalogue minimum order rounding SKU prices','/admin#stock',['stock.manage']],
 ['suppliers','Suppliers','Ordering email SMS Twilio Resend Fresho ALB Connect','/admin#suppliers',['suppliers.manage']],
 ['users','Users','Employee profiles invitations accounts','/admin/accounts#accounts',['users.manage']],
 ['locations','Locations','Trading hours managers store settings','/admin/accounts#locations',['users.manage','locations.manage','email.manage','companies.manage']],
 ['companies','Companies','Network company settings','/admin/accounts#companies',['companies.manage']],
 ['settings','Settings','App appearance permissions permission levels kiosk devices award compliance','/settings',['appearance.manage','roles.manage','awards.manage','email.manage','devices.manage']],
 ['intelligence-settings','OpStack intelligence settings','OpenAI API key intelligence search drafting budget usage limits','/settings#ai',['ai.manage']],
 ['devices','Kiosk devices','Pair revoke location device','/settings/devices',['devices.manage']],
 ['awards','Award compliance','Fast Food Award dated rule sets rates','/settings/awards',['awards.manage']]
];
const normalize=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en-AU').replace(/\s+/g,' ').trim();
const termsFor=query=>normalize(query).split(' ').filter(Boolean);
const matches=(value,terms)=>terms.every(term=>normalize(value).includes(term));
const pagesFor=actor=>pages.filter(([, , , ,permissions,mode])=>mode==='all'?permissions.every(key=>can(actor,key)):any(actor,permissions)).map(([id,title,text,url])=>({id:'page:'+id,type:'Pages',title,text,url}));
function snippet(value,terms){const text=String(value??'').replace(/\s+/g,' ').trim(),folded=normalize(text),positions=terms.map(term=>folded.indexOf(term)).filter(index=>index>=0),start=positions.length?Math.max(0,Math.min(...positions)-45):0;return(start?'…':'')+text.slice(start,start+170)+(text.length>start+170?'…':'');}
async function search(actor,query,providers={}){
 if(typeof query!=='string'||query.length>120||/[\x00-\x1f\x7f]/.test(query))throw Object.assign(Error('Enter a search of up to 120 characters.'),{status:400});
 const q=query.trim(),terms=termsFor(q),documents=pagesFor(actor);
 const failures=[];
 if(q.length>=2){
  const entries=Object.entries(providers),results=await Promise.allSettled(entries.map(([,load])=>Promise.resolve().then(()=>load(q,terms))));
  results.forEach((result,index)=>{if(result.status==='fulfilled')documents.push(...result.value);else failures.push(entries[index][0]);});
 }
 const found=documents.filter(doc=>doc.searchMatch||matches(doc.title+' '+(doc.text||''),terms)).map(doc=>({id:doc.id,type:doc.type,title:String(doc.title).slice(0,200),snippet:snippet(doc.text,terms),url:doc.url,...(doc.action?{action:doc.action}:{}),...(doc.searchMatch?{searchMatch:doc.searchMatch,preview:doc.preview,target:doc.target}:{}),score:doc.searchMatch?doc.searchMatch.score:normalize(doc.title)===normalize(q)?100:matches(doc.title,terms)?80:doc.type==='Pages'?25:40})).sort((a,b)=>b.score-a.score||a.type.localeCompare(b.type)||a.title.localeCompare(b.title));
 const counts=new Map(),results=[];for(const {score,...doc} of found){const count=counts.get(doc.type)||0;if(count>=10||results.length>=60)continue;counts.set(doc.type,count+1);results.push(doc);}
 return{query:q,destinationId:destinationFor(results,results.filter(result=>normalize(result.title)===normalize(q)).map(result=>result.id)),results,total:found.length,hasMore:found.length>results.length,unavailable:failures};
}
function destinationFor(results,pageIds=[]){
 const articles=results.filter(result=>result.searchMatch).sort((a,b)=>b.searchMatch.score-a.searchMatch.score),best=articles[0],second=articles[1];
 if(best?.searchMatch.clear&&best.searchMatch.score>=80&&(!second||best.searchMatch.score-second.searchMatch.score>=20))return best.id;
 const pages=results.filter(result=>pageIds.includes(result.id)&&result.type==='Pages');
 return pages.length===1&&(!best||best.searchMatch.score<60)&&!['page:library','page:learning','page:comms'].includes(pages[0].id)?pages[0].id:null;
}
async function intelligentSearch(actor,query,plan,providers){
 const queries=[...new Set([query,...plan.queries])],batches=await Promise.all(queries.map(value=>search(actor,value,providers))),selected=new Set(plan.pageIds),found=new Map();
 for(const page of pagesFor(actor).filter(page=>selected.has(page.id)))found.set(page.id,{id:page.id,type:page.type,title:page.title,snippet:snippet(page.text,[]),url:page.url});
 for(const batch of batches)for(const result of batch.results)if(!found.has(result.id))found.set(result.id,result);
 const ordered=[...found.values()].sort((a,b)=>(b.searchMatch?.score||0)-(a.searchMatch?.score||0));
 const counts=new Map(),results=[];for(const result of ordered){const count=counts.get(result.type)||0;if(count>=10||results.length>=60)continue;counts.set(result.type,count+1);results.push(result);}
 const destination=destinationFor(results,[...selected]);
 return{query,destinationId:destination,results,total:found.size,hasMore:found.size>results.length||batches.some(batch=>batch.hasMore),unavailable:[...new Set(batches.flatMap(batch=>batch.unavailable))],intelligence:{available:true,queries:plan.queries}};
}
module.exports={search,intelligentSearch,pagesFor,matches,snippet};
