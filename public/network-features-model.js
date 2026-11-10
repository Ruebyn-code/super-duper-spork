// Console-controlled feature switches for each network. Turning a feature off removes its permissions
// (and any parentless detailed actions) from every account in that network; saved roles keep them.
(function(root){
 const model=typeof module==='object'&&module.exports?require('./permission-model'):root.permissionModel;
 const actionsFor=prefix=>model.actionDefinitions.map(a=>a.id).filter(id=>id.startsWith(prefix));
 const features=[
  {id:'ordering',name:'Ordering & stock',description:'Ordering, cart, order history, stock counts, wastage, stock transfers, stock and supplier settings and order sending.',permissions:['orders.view','orders.place','counts.view','counts.edit','transfers.view','transfers.send','transfers.receive','stock.manage','suppliers.manage','email.manage']},
  {id:'sales',name:'Sales & finance',description:'Daily, hourly and weekly sales, projections, weekly finances and invoices.',permissions:['sales.view','sales.edit','finances.view','finances.edit','invoices.view','invoices.edit']},
  {id:'reporting',name:'Reporting',description:'Reporting pages and scheduled OpStack intelligence reports.',permissions:['reporting.view','reports.manage']},
  {id:'rostering',name:'Rostering & timesheets',description:'Rosters, shift clock, timesheets, availability, leave and award compliance.',permissions:[...model.rosteringKeys,...model.awardKeys]},
  {id:'checklists',name:'Checklists',description:'Ops management checklists, plans and history.',permissions:[...model.opsKeys]},
  {id:'learning',name:'Learning centre',description:'Courses, assignments, training reports and in-store training.',permissions:[...model.learningKeys]},
  {id:'knowledge',name:'Knowledge centre',description:'Company and network policies and information articles.',permissions:[...model.knowledgeKeys]},
  {id:'comms',name:'Comms',description:'Posts, groups, direct messages and required reading.',permissions:[...model.communicationKeys]},
  {id:'equipment',name:'Equipment',description:'Equipment register, service history and problem reports.',permissions:[...model.equipmentKeys]},
  {id:'prep',name:'Prep list',description:'Daily prep lists and the Home Today’s prep card.',permissions:['prep.view','prep.manage']},
  {id:'labels',name:'Labels',description:'Food preparation label templates, printing and printer settings.',permissions:[...model.prepKeys]},
  {id:'intelligence',name:'OpStack intelligence',description:'All OpStack intelligence tools, search and settings.',permissions:[...model.aiKeys],actions:actionsFor('ai.')},
  {id:'kiosks',name:'Kiosk devices',description:'Pairing and managing shared kiosk devices.',permissions:[...model.deviceKeys]}
 ];
 const ids=features.map(f=>f.id);
 function normalize(value){if(!Array.isArray(value)||value.length>features.length||value.some(id=>typeof id!=='string'||!ids.includes(id))||new Set(value).size!==value.length)throw Object.assign(Error('Choose valid features.'),{status:400});return ids.filter(id=>value.includes(id));}
 // A permission shared by several features (Prep list and Labels share prep.*) is removed only when all of them are off;
 // the part still on checks its own feature switch on the server and in the page.
 function blocked(disabled=[]){const chosen=features.filter(f=>disabled.includes(f.id)),permissions=[...new Set(chosen.flatMap(f=>f.permissions))].filter(key=>features.filter(f=>f.permissions.includes(key)).every(f=>disabled.includes(f.id))),own=new Set(chosen.flatMap(f=>f.actions||[]));
  // Detailed actions whose every parent is switched off are inactive too, so they never block role assignment.
  const off=new Set([...permissions,...own]);let grew=true;while(grew){grew=false;for(const action of model.actionDefinitions){const parents=[].concat(action.parent||[]);if(!off.has(action.id)&&parents.length&&parents.every(p=>off.has(p))){off.add(action.id);grew=true;}}}
  return{permissions,actions:[...own],inactive:[...off].filter(key=>!permissions.includes(key))};}
 // Removes switched-off features from an already resolved account.
 function apply(account,disabled=[]){if(!account||!disabled.length)return account;const off=blocked(disabled),drop=list=>Array.isArray(list)?list.filter(key=>!off.permissions.includes(key)):list;return{...account,permissions:drop(account.permissions),networkPermissions:drop(account.networkPermissions),actionPermissions:{...(account.actionPermissions||{}),...Object.fromEntries(off.actions.map(id=>[id,false]))},disabledFeatures:[...disabled],disabledFeatureKeys:[...off.permissions,...off.inactive]};}
 // The /labels page name follows which of its parts are switched on.
 function prepLabelsName(disabled=[]){const prep=!disabled.includes('prep'),labels=!disabled.includes('labels');return prep&&labels?'Prep & labels':prep?'Prep list':'Labels';}
 const api={features,ids,normalize,blocked,apply,prepLabelsName};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.networkFeaturesModel=api;
})(typeof window==='object'?window:globalThis);
