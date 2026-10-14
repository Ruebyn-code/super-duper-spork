// Shared storage groups keep stock counts separate from supplier order grouping.
(function(root){
 const groups=[
  {id:'cool-room',name:'Cool Room Stock'},
  {id:'freezer',name:'Freezer Stock'},
  {id:'packaging',name:'Packaging'},
  {id:'chemical',name:'Chemical'},
  {id:'dry',name:'Dry Stock'}
 ];
 const valid=value=>groups.some(group=>group.id===value);
 function resolve(product={}){
  if(valid(product.stockCountGroup))return product.stockCountGroup;
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
 const api={groups,valid,resolve};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.stockCountGroups=api;
})(typeof window==='undefined'?globalThis:window);
