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
 ['devices','Kiosk devices','Pair revoke location device','/settings/devices',['devices.manage']],
 ['awards','Award compliance','Fast Food Award dated rule sets rates','/settings/awards',['awards.manage']]
];
const normalize=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en-AU').replace(/\s+/g,' ').trim();
const termsFor=query=>normalize(query).split(' ').filter(Boolean);
const matches=(value,terms)=>terms.every(term=>normalize(value).includes(term));
function snippet(value,terms){const text=String(value??'').replace(/\s+/g,' ').trim(),folded=normalize(text),positions=terms.map(term=>folded.indexOf(term)).filter(index=>index>=0),start=positions.length?Math.max(0,Math.min(...positions)-45):0;return(start?'…':'')+text.slice(start,start+170)+(text.length>start+170?'…':'');}
async function search(actor,query,providers={}){
 if(typeof query!=='string'||query.length>120||/[\x00-\x1f\x7f]/.test(query))throw Object.assign(Error('Enter a search of up to 120 characters.'),{status:400});
 const q=query.trim(),terms=termsFor(q),documents=pages.filter(([, , , ,permissions,mode])=>mode==='all'?permissions.every(key=>can(actor,key)):any(actor,permissions)).map(([id,title,text,url])=>({id:'page:'+id,type:'Pages',title,text,url}));
 const failures=[];
 if(q.length>=2){
  const entries=Object.entries(providers),results=await Promise.allSettled(entries.map(([,load])=>load(q,terms)));
  results.forEach((result,index)=>{if(result.status==='fulfilled')documents.push(...result.value);else failures.push(entries[index][0]);});
 }
 const found=documents.filter(doc=>matches(doc.title+' '+(doc.text||''),terms)).map(doc=>({id:doc.id,type:doc.type,title:String(doc.title).slice(0,200),snippet:snippet(doc.text,terms),url:doc.url,...(doc.action?{action:doc.action}:{}),score:normalize(doc.title)===normalize(q)?100:matches(doc.title,terms)?80:doc.type==='Pages'?25:40})).sort((a,b)=>b.score-a.score||a.type.localeCompare(b.type)||a.title.localeCompare(b.title));
 const counts=new Map(),results=[];for(const {score,...doc} of found){const count=counts.get(doc.type)||0;if(count>=10||results.length>=60)continue;counts.set(doc.type,count+1);results.push(doc);}
 return{query:q,results,total:found.length,hasMore:found.length>results.length,unavailable:failures};
}
module.exports={search,matches,snippet};
