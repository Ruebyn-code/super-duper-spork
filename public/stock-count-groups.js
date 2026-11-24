// Stock count groups. Each company may save its own ordered list (catalogue.countGroups, set through
// PUT /api/products/count-groups); without one the five built-in storage areas are used. Items keep their group in
// product.stockCountGroup; 'none' (or a group that no longer exists) shows under Not grouped. Counts snapshot the group
// ID and name, so saved reports keep the name the group had when they were counted. Grouping is a display choice only.
(function(root){
 const groups=[
  {id:'cool-room',name:'Cool Room Stock',icon:'fridge'},
  {id:'freezer',name:'Freezer Stock',icon:'snowflake'},
  {id:'packaging',name:'Packaging',icon:'package'},
  {id:'chemical',name:'Chemical',icon:'spray-can'},
  {id:'dry',name:'Dry Stock',icon:'wheat'}
 ];
 const NONE='none',noneGroup={id:NONE,name:'Not grouped'},MAX=40;
 // Optional group icons come from the shared category icon list (omitted means no icon).
 const icons=()=>typeof module==='object'&&module.exports&&typeof require==='function'?require('./category-icons'):root.categoryIcons;
 const idPattern=/^[a-z0-9][a-z0-9-]{0,39}$/;
 // The group list for a catalogue (or a list), falling back to the built-in areas.
 // Saved built-in areas without an icon setting show their default icon; an explicit null means it was removed.
 function list(source){const saved=Array.isArray(source)?source:source?.countGroups;if(!Array.isArray(saved)||!saved.length)return groups;return saved.map(group=>group.icon===undefined&&groups.some(builtIn=>builtIn.id===group.id)?{...group,icon:groups.find(builtIn=>builtIn.id===group.id).icon}:group);}
 const valid=(value,source)=>typeof value==='string'&&list(source).some(group=>group.id===value);
 // The original automatic area for an item (used for new items and older data).
 function automatic(product={}){
  const category=String(product.category||'').trim().toLowerCase().replace(/[-_]/g,' ');
  const aliases={'cool room':'cool-room','cool room stock':'cool-room',chilled:'cool-room',refrigerated:'cool-room',freezer:'freezer','freezer stock':'freezer',frozen:'freezer',packaging:'packaging',chemical:'chemical',chemicals:'chemical',cleaning:'chemical','dry stock':'dry',dry:'dry'};
  if(Object.hasOwn(aliases,category))return aliases[category];
  const text=(String(product.name||'')+' '+String(product.description||'')).toLowerCase();
  if(/\b(cleaner|cleaning|bleach|soap|saniti[sz]er|disinfectant|detergent|degreaser|chemicals?|dishwash\w*|chux|sponges?|gloves|rubbish)\b|\b(hand towel|toilet paper|bin (bags?|liners?))\b/.test(text))return 'chemical';
  if(/\b(frozen|freezer|fries|squid|nuggets|falafel|loukaniko|loukoumades|bougatsa|pita)\b|\b(ice cream|spin(?:ach|age) and feta|breaky roll)\b/.test(text)&&!(/\b(pita bags?|souvlaki bags?|wrapping paper)\b/.test(text)))return 'freezer';
  if(/\b(packaging|containers?|lids?|napkins?|cutlery|foil)\b|\b(cling (wrap|film)|wrapping paper|wooden forks?|take ?away bags?|souvlaki bags?|pita bags?|(?:sml|med|chip|frepe|frappe|coffee|drink) cups?|(?:burger|chips|gyros|sandwich|shipping) box(?:es)?)\b/.test(text))return 'packaging';
  if(/\b(cheese|hom+us|hummus|chicken|lamb|beef|pork|sausages?|tzatziki|tarama|tirokafteri|eggplant|saganaki|feta|onions?|lettuce|tomatoes|lemons|cucumbers?|strawberr(?:y|ies)|milk|yogh?urt|cream)\b|\b(garlic sauce|fresh (tomato|lemon))\b/.test(text))return 'cool-room';
  return 'dry';
 }
 // The group an item shows under: its saved group when that still exists, else its automatic area when the list has
 // it, else Not grouped.
 function resolve(product={},source){
  const current=list(source);if(product.stockCountGroup===NONE)return NONE;
  if(valid(product.stockCountGroup,current))return product.stockCountGroup;
  if(typeof product.stockCountGroup==='string'&&product.stockCountGroup&&current!==groups)return NONE; // a deleted group
  const auto=automatic(product);return current.some(group=>group.id===auto)?auto:NONE;
 }
 const name=(id,source)=>id===NONE?noneGroup.name:list(source).find(group=>group.id===id)?.name||'';
 const key=(product={},by='area',source)=>by==='supplier'?(product.supplierId?'supplier-'+product.supplierId:'missing-supplier'):resolve(product,source);
 // Sections in list order, then Not grouped. For saved counts (saved=true), items whose group has since been removed keep
 // their own section under the name they were counted with (stockCountGroupName, or the built-in area name).
 function sections(items=[],by='area',source,saved=false){
  if(by!=='supplier'){
   const current=list(source),known=new Set(current.map(group=>group.id)),result=current.map(group=>({...group,items:[]})),extra=new Map(),none={...noneGroup,items:[]};
   for(const item of items){
    const builtIn=saved&&groups.find(group=>group.id===item.stockCountGroup),snapshotName=typeof item.stockCountGroupName==='string'&&item.stockCountGroupName?item.stockCountGroupName:builtIn?.name,snapshot=saved&&snapshotName&&typeof item.stockCountGroup==='string'?item.stockCountGroup:null;
    if(snapshot&&snapshot!==NONE&&!known.has(snapshot)){if(!extra.has(snapshot))extra.set(snapshot,{id:snapshot,name:snapshotName,items:[]});extra.get(snapshot).items.push(item);continue;}
    const id=snapshot||resolve(item,current);(id===NONE?none:result.find(group=>group.id===id)).items.push(item);
   }
   return[...result,...extra.values(),none];
  }
  const suppliers=new Map();for(const item of items){const id=key(item,by);if(!suppliers.has(id))suppliers.set(id,{id,name:item.supplier|| (item.supplierId?'Supplier removed':'Unassigned supplier'),items:[]});suppliers.get(id).items.push(item);}
  return[...suppliers.values()].sort((a,b)=>a.name.localeCompare(b.name,'en-AU')||a.id.localeCompare(b.id));
 }
 // Validates a submitted list: 1–40 groups, names 1–40 characters, unique (ignoring case), optional allowlisted icon. Valid unique IDs are kept;
 // groups without one get a new ID from their name.
 function normalizeList(input,existing=[]){
  if(!Array.isArray(input)||!input.length||input.length>MAX)throw Object.assign(Error('Keep between 1 and '+MAX+' groups.'),{status:400});
  const seenNames=new Set(),seenIds=new Set([NONE]),known=new Set(list(existing).map(group=>group.id)),result=[];
  for(const entry of input){
   const groupName=typeof entry?.name==='string'?entry.name.trim().replace(/\s+/g,' '):'';
   if(!groupName||groupName.length>40||/[\x00-\x1f\x7f\u2028\u2029]/.test(groupName))throw Object.assign(Error('Give every group a name of up to 40 characters.'),{status:400});
   if(seenNames.has(groupName.toLowerCase()))throw Object.assign(Error('Two groups are called '+groupName+'. Use different names.'),{status:400});seenNames.add(groupName.toLowerCase());
   let id=typeof entry.id==='string'&&idPattern.test(entry.id)&&!seenIds.has(entry.id)?entry.id:null; // browsers propose IDs for new groups so item choices can refer to them
   if(!id){const base=groupName.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,30)||'group',taken=candidate=>seenIds.has(candidate)||known.has(candidate)||input.some(other=>other!==entry&&other?.id===candidate);id=base;for(let n=2;taken(id);n++)id=base+'-'+n;}
   if(entry.icon!==undefined&&entry.icon!==null&&!icons()?.valid(entry.icon))throw Object.assign(Error('Choose an icon from the list for '+groupName+'.'),{status:400});
   const icon=entry.icon===undefined?list(existing).find(group=>group.id===id)?.icon:entry.icon; // omitted keeps the saved icon; null removes it
   seenIds.add(id);result.push({id,name:groupName,...(icon?{icon}:groups.some(builtIn=>builtIn.id===id)?{icon:null}:{})});
  }
  return result;
 }
 const api={groups,defaults:groups,NONE,noneGroup,list,valid,automatic,resolve,name,key,sections,normalizeList};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.stockCountGroups=api;
})(typeof window==='undefined'?globalThis:window);
