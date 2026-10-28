(function(root){
 const definitions=[
  ['devices.manage','Manage kiosks','Read and edit kiosk settings; use detailed actions for pairing and revoking devices','Administration'],['home.view','Home','View Home totals','Daily work'],['orders.view','Ordering','Browse stock, the cart and location order history','Daily work'],['orders.place','Place orders','Place supplier orders; past orders, corrections, deletion and deliveries have separate detailed controls','Daily work'],
  ['transfers.view','View stock transfers','Read incoming and outgoing transfers at accessible locations','Stock transfers'],['transfers.send','Send stock transfers','Send and cancel transfers from accessible locations','Stock transfers'],['transfers.receive','Receive stock transfers','Confirm stock and optional cost transfers into an accessible location','Stock transfers'],
  ['counts.view','View stock counts','Read counts, usage and target levels','Daily work'],['counts.edit','Record stock counts','Save stock counts','Daily work'],['sales.view','View daily sales','Read daily sales, projections and budgets','Daily work'],['sales.edit','Enter daily sales','Save daily sales','Daily work'],
  ['finances.view','View weekly finances','Read weekly reports, expenses and quarter overview','Finance'],['finances.edit','Edit weekly finances','Save reports, labour, Op Ex and R&O','Finance'],['reporting.view','Reporting','Run detailed reports for accessible locations','Finance'],['invoices.view','View invoices','Read and download weekly invoice bundles','Finance'],['invoices.edit','Manage invoices','Edit invoice details; uploads and removal have separate detailed controls','Finance'],
  ['stock.manage','Manage stock','Edit stock and ordering rules; creation, deletion and manual targets have separate detailed controls','Administration'],['suppliers.manage','Manage suppliers','Edit suppliers and delivery options; creation and deletion have separate detailed controls','Administration'],['users.manage','Manage users','Edit users within your hierarchy and location access; creation and deletion have detailed controls','Administration'],['locations.manage','Manage locations','Edit accessible location settings; creation, archiving and restoration have detailed controls','Administration'],['companies.manage','Manage companies','Edit accessible company details; creation has a separate detailed control','Administration'],['email.manage','Order sending settings','Edit location sender emails, SMS credentials and company order email templates','Administration'],
  ['comms.view','Comms','Read posts and your private conversations','Comms'],['comms.chat','Direct messages and chats','Start conversations and send messages','Comms'],['comms.post.company','Company posts','Publish posts to the selected company','Comms'],['comms.post.network','Network posts','Publish posts for all companies; network role only','Comms'],['comms.require','Require post acknowledgement','Block platform access until a post is read or snoozed','Comms'],
  ['prep.view','Labels','View company label templates and label history at accessible locations','Labels'],['prep.print','Print prep labels','Create and print food preparation labels','Labels'],['prep.manage','Manage prep labels','Manage company label templates, shelf lives and printer settings','Labels'],
  ['ops.view','Ops management','View company checklists at accessible locations','Ops management'],['ops.complete','Complete checklists','Start, save and complete assigned location checklists','Ops management'],['ops.manage','Manage checklists','Create and edit company checklists; planner management has a detailed control','Ops management'],
  ['learning.view','Learning centre','View company courses and your assigned training','Learning centre'],['learning.complete','Complete training','Complete lessons and submit course quizzes','Learning centre'],['learning.manage','Manage company training','Create and edit company course drafts; publishing and archiving have detailed controls','Learning centre'],['learning.assign','Assign training','Assign company courses to users, locations and permission levels within your location access','Learning centre'],['learning.report','Training progress reports','Read training progress at accessible locations; CSV export has a detailed control','Learning centre'],
  ['knowledge.view','Knowledge Library','Read company and network policies and information','Knowledge Library'],['knowledge.manage.company','Manage company library','Publish, edit and delete articles for the selected company','Knowledge Library'],['knowledge.manage.network','Manage network library','Publish, edit and delete network articles; network role only','Knowledge Library'],
  ['rostering.view','View rosters and timesheets','Read your published shifts and own timesheets','Rostering'],['rostering.manage','Manage rosters','Create and edit draft rosters and read team availability; publishing and shift removal have detailed controls','Rostering'],['rostering.clock','Clock in and out','Record your work, breaks and manual timesheets','Rostering'],['rostering.availability','Enter availability','Submit regular availability with 14 days notice and school-holiday overrides','Rostering'],['rostering.approve','Review timesheets','Approve early starts and read, correct, approve and reject location timesheets','Rostering'],['rostering.costs','Hourly rates','Set effective-dated hourly rates for location users','Rostering'],['rostering.budget.location','Location labour budget','Set or override the location labour budget','Rostering'],['rostering.budget.company','Company labour budget','Set the company default labour budget','Rostering'],['rostering.budget.network','Network labour budget','Set the network default labour budget; network role only','Rostering'],
  ['rostering.leave','Request leave','Submit and withdraw your own leave requests','Rostering'],['rostering.leave.approve','Review leave','Review location leave requests, excluding your own','Rostering'],['rostering.leave.confidential','Review confidential leave','Read and review confidential leave requests at accessible locations','Rostering'],
  ['awards.manage','Award compliance','Manage company award coverage, dated rule sets and employee award profiles','Settings'],['appearance.manage','App appearance','Change backgrounds, images, icons, layouts and the Home greeting','Settings'],['roles.manage','Permission levels','Create and edit company permission levels','Settings'],['locations.all','All company locations','Access every location within an accessible company','Location access'],['network.access','All companies','Access the whole company network; network role only','Network'],['roles.network','Network permission levels','Manage network-wide permission levels; network role only','Network']
 ].map(([id,name,description,group])=>({id,name,description,group}));
 definitions.push({id:'users.email.manage',name:'Edit user emails',description:'Change existing users’ sign-in emails within your hierarchy and location access',group:'Administration'});
 definitions.push({id:'reports.manage',name:'Scheduled OpStack intelligence reports',description:'Preview and schedule OpStack intelligence reports for authorised users and permission levels',group:'Finance'});
 definitions.push({id:'ai.manage',name:'OpStack intelligence settings',description:'Configure this company’s OpenAI key, enable OpStack intelligence and set estimated usage limits',group:'Settings'});
 definitions.push({id:'account-email.manage',name:'Account invitation email',description:'Configure the one shared sender for account setup emails across Opstack; network role only',group:'Network'});
 // Optional action limits refine existing grants. Omitted limits preserve legacy access.
 const actionDefinitions=[
  ['orders.record','Record past orders','Add a missed order to order history','orders.place'],
  ['orders.edit','Edit placed orders','Correct items, quantities and prices in saved orders','orders.place'],
  ['orders.delete','Delete orders','Remove saved orders and their reporting/usage effects','orders.place'],
  ['orders.receive','Confirm deliveries','Mark ordered stock as confirmed or received','orders.place'],
  ['hourly.import','Import hourly sales','Upload and submit hourly sales reports','sales.edit'],
  ['weekly.import','Import weekly sales','Upload and import weekly spreadsheets, PDFs and photos','finances.edit'],
  ['invoices.upload','Upload invoices','Scan or create new invoice records','invoices.edit'],
  ['invoices.delete','Delete invoices','Remove saved invoices from expenses','invoices.edit'],
  ['stock.create','Create stock items','Add stock items to the company catalogue','stock.manage'],
  ['stock.delete','Delete stock items','Remove stock items from the catalogue','stock.manage'],
  ['stock.targets','Edit manual target levels','Set manual target levels for the selected location','stock.manage'],
  ['suppliers.create','Create suppliers','Add suppliers to the company catalogue','suppliers.manage'],
  ['suppliers.delete','Delete suppliers','Remove unused suppliers','suppliers.manage'],
  ['users.create','Create and invite users','Create users and send or resend setup invitations','users.manage'],
  ['users.delete','Delete users','Remove accounts within your hierarchy and locations','users.manage'],
  ['locations.create','Create locations','Add locations in an accessible company','locations.manage'],
  ['locations.archive','Archive and restore locations','Move locations between the active and archived lists','locations.manage'],
  ['companies.create','Create companies','Create a company when network access is also granted','companies.manage'],
  ['devices.pair','Pair and re-pair kiosks','Create kiosks and issue new pairing codes','devices.manage'],
  ['devices.revoke','Revoke kiosks','Disconnect a location kiosk','devices.manage'],
  ['learning.publish','Publish training courses','Publish a reviewed course version for learners','learning.manage'],
  ['learning.archive','Archive training courses','Remove courses from the published library','learning.manage'],
  ['learning.export','Export training progress','Download training progress as CSV','learning.report'],
  ['learning.signoff','Sign off in-store training','Assess practical skills as the appointed trainer or an authorised training manager; self sign-off is excluded','learning.view'],
  ['ops.planners','Manage checklist planners','Create and change planners, locations and assignees','ops.manage'],
  ['rostering.publish','Publish rosters','Make a draft roster visible to the team','rostering.manage'],
  ['rostering.delete-shift','Delete roster shifts','Remove shifts from a draft roster','rostering.manage'],
  ['reporting.export','Export business reports','Download the filtered reporting data','reporting.view'],
  ['knowledge.delete.company','Delete company articles','Remove articles in this company’s Knowledge Library','knowledge.manage.company'],
  ['email.template','Edit order email templates','Change the company’s supplier email format','email.manage'],
  ['ai.search','Intelligence search','Submit searches to OpStack intelligence; ordinary search remains available',null],
  ['ai.checklists','Intelligence checklist builder','Generate checklist and planner drafts','ops.manage'],
  ['ai.training','Intelligence training builder','Generate courses and questions from approved content','learning.manage'],
  ['ai.writing','Intelligence writing','Draft or improve Comms and Library text',['comms.chat','comms.post.company','comms.post.network','knowledge.manage.company','knowledge.manage.network']],
  ['ai.invoices','Intelligence invoice scanning','Send reviewed invoice pages for extraction','invoices.edit'],
  ['ai.sales','Intelligence sales scanning','Read hourly and weekly sales reports',['sales.edit','finances.edit']],
  ['ai.reports','Intelligence scheduled reports','Generate previews and scheduled report summaries','reports.manage']
 ].map(([id,name,description,parent])=>({id,name,description,parent,group:id.startsWith('ai.')?'OpStack intelligence':definitions.find(d=>d.id===(Array.isArray(parent)?parent[0]:parent))?.group||'Settings',sensitive:/delete|archive|revoke|publish/.test(id)}));
 const actionKeys=actionDefinitions.map(d=>d.id),actionById=new Map(actionDefinitions.map(d=>[d.id,d]));
 const keys=definitions.map(item=>item.id),networkKeys=['network.access','roles.network','comms.post.network','knowledge.manage.network','rostering.budget.network','account-email.manage'];
 const work=['learning.view','learning.complete','prep.view','prep.print','ops.view','ops.complete','rostering.view','rostering.clock','rostering.availability','rostering.leave','knowledge.view','comms.view','comms.chat','home.view','orders.view','orders.place','counts.view','counts.edit','sales.view','sales.edit','finances.view','finances.edit','invoices.view','invoices.edit'];
 const defaults=[{id:'user',name:'Ordering manager',level:10,scope:'network',permissions:work},{id:'franchisee',name:'Franchisee',level:50,scope:'network',permissions:[...work,'learning.manage','learning.assign','learning.report','ops.manage','transfers.view','transfers.send','transfers.receive','reporting.view','reports.manage','users.manage','devices.manage','rostering.manage','rostering.approve','rostering.costs','rostering.budget.location','rostering.leave.approve']},{id:'admin',name:'Head Office',level:100,scope:'network',permissions:keys}];
 const homeDashboards=['staff','manager'];
 const homeDashboard=account=>account?.homeDashboard==='staff'?'staff':'manager';
 function can(account,key){if(!account)return false;const action=actionById.get(key);if(action){const parents=Array.isArray(action.parent)?action.parent:action.parent?[action.parent]:[];return (!parents.length||parents.some(parent=>can(account,parent)))&&account.actionPermissions?.[key]!==false;}const permissions=account.permissions||defaults.find(role=>role.id===account.role)?.permissions||[],network=account.networkPermissions||permissions;if(key==='roles.manage'&&network.includes('roles.network'))return true;return(networkKeys.includes(key)?network:permissions).includes(key);}
 const any=(account,permissions)=>permissions.some(key=>can(account,key));
 const level=account=>account?.roleLevel??defaults.find(role=>role.id===account?.role)?.level??0;
 const grants=account=>[...keys,...actionKeys].filter(key=>can(account,key));
 const canAssign=(actor,target)=>level(target)<=level(actor)&&grants(target).every(key=>can(actor,key));
 const rosteringKeys=keys.filter(key=>key.startsWith('rostering.'));
 const transferKeys=['transfers.view','transfers.send','transfers.receive'];
 const knowledgeKeys=['knowledge.view','knowledge.manage.company','knowledge.manage.network'];
 const communicationKeys=['comms.view','comms.chat','comms.post.company','comms.post.network','comms.require'];
 const learningKeys=['learning.view','learning.complete','learning.manage','learning.assign','learning.report'];
 const deviceKeys=['devices.manage'];
 const aiKeys=['ai.manage'];
 const reportKeys=['reports.manage'];
 const prepKeys=['prep.view','prep.print','prep.manage'];
 const opsKeys=['ops.view','ops.complete','ops.manage'];
 const dependencies={...Object.fromEntries(learningKeys.filter(key=>key!=='learning.view').map(key=>[key,'learning.view'])),'prep.print':'prep.view','prep.manage':'prep.view','ops.complete':'ops.view','ops.manage':'ops.view',...Object.fromEntries(rosteringKeys.filter(key=>key!=='rostering.view').map(key=>[key,'rostering.view'])),'knowledge.manage.company':'knowledge.view','knowledge.manage.network':'knowledge.view','comms.chat':'comms.view','comms.post.company':'comms.view','comms.post.network':'comms.view','comms.require':'comms.view','transfers.send':'transfers.view','transfers.receive':'transfers.view','orders.place':'orders.view','counts.edit':'counts.view','sales.edit':'sales.view','finances.edit':'finances.view','invoices.edit':'invoices.view','roles.network':'roles.manage','network.access':'locations.all'};
 dependencies['rostering.leave.confidential']='rostering.leave.approve';
 dependencies['reports.manage']='reporting.view';
 dependencies['users.email.manage']='users.manage';
 const awardKeys=['awards.manage'],leaveKeys=['rostering.leave','rostering.leave.approve','rostering.leave.confidential'];
 const userEmailKeys=['users.email.manage','account-email.manage'];
 const intelligencePermission=kind=>kind==='search'?'ai.search':['checklist','planners'].includes(kind)?'ai.checklists':['course','questions'].includes(kind)?'ai.training':['message','post','article'].includes(kind)?'ai.writing':kind==='invoice'?'ai.invoices':['hourly-sales','weekly-sales'].includes(kind)?'ai.sales':kind==='report'?'ai.reports':null;
 const api={intelligencePermission,actionDefinitions,actionKeys,homeDashboards,homeDashboard,reportKeys,aiKeys,deviceKeys,learningKeys,prepKeys,opsKeys,userEmailKeys,transferKeys,leaveKeys,awardKeys,definitions,keys,networkKeys,defaults,can,any,level,grants,canAssign,dependencies,communicationKeys,knowledgeKeys,rosteringKeys};if(typeof module==='object'&&module.exports)module.exports=api;else root.permissionModel=api;
})(globalThis);
