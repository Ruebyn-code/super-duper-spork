// Sales promotions shared by the server and the Sales page: types, channels and plain-language text.
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.promotionsModel=factory();})(globalThis,()=>{
 const kinds=[
  {id:'percent',label:'% off',value:'percent'},
  {id:'amount',label:'$ off',value:'cents'},
  {id:'price',label:'Special price',value:'cents'},
  {id:'bundle',label:'Bundle or meal deal',value:null},
  {id:'bogo',label:'Buy one get one',value:null},
  {id:'free-item',label:'Free item',value:null},
  {id:'other',label:'Other',value:null}
 ];
 const channels=[{id:'in-store',label:'In store'},{id:'online',label:'Online ordering'},{id:'uber-eats',label:'Uber Eats'},{id:'doordash',label:'DoorDash'}];
 const maxDays=92,maxRepeatDays=366,maxItems=50;
 // Optional promotion features, each switched on or off per company (all on by default).
 const features=[
  {id:'results',name:'How it went summary',description:'Best and worst days, results per store and delivery versus in-store sales on each promotion.'},
  {id:'uplift',name:'Expected uplift',description:'Raise projections, ordering budgets, prep amounts and roster forecasts by a promotion’s expected lift on its days.'},
  {id:'items',name:'Promotion products',description:'Link stock items to a promotion so Ordering and Stock count flag them.'},
  {id:'staff',name:'Staff awareness',description:'Post a promotion to Comms, notify staff and show today’s promotions on checklists.'},
  {id:'reporting',name:'Leaderboard and reports',description:'Rank promotions by uplift, compare stores and include promotions in OpStack intelligence reports.'},
  {id:'repeat',name:'Repeating promotions',description:'Run a promotion only on chosen weekdays, with results for every repeat.'},
  {id:'redemptions',name:'Redemptions',description:'Record how many were redeemed each day and see the cost per redemption.'}
 ];
 const featureIds=features.map(item=>item.id);
 // Saved switches with every omitted feature on.
 const featureState=saved=>Object.fromEntries(featureIds.map(id=>[id,saved?.[id]!==false]));
 const weekdayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const weekday=date=>(new Date(date+'T12:00:00Z').getUTCDay()+6)%7;
 const repeats=promotion=>Array.isArray(promotion?.weekdays)&&promotion.weekdays.length>0&&promotion.weekdays.length<7;
 const weekdayText=list=>(list||[]).map(day=>weekdayNames[day]).filter(Boolean).join(', ');
 const kind=id=>kinds.find(item=>item.id===id)||null;
 const money=cents=>'$'+(cents/100).toLocaleString('en-AU',{minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2});
 // "20% off", "$5 off", "Special price $9.95", or the type name.
 function offer(promotion){const type=kind(promotion?.kind);if(!type)return'';if(type.id==='percent'&&Number.isInteger(promotion.value))return promotion.value+'% off';if(type.id==='amount'&&Number.isInteger(promotion.value))return money(promotion.value)+' off';if(type.id==='price'&&Number.isInteger(promotion.value))return'Special price '+money(promotion.value);return type.label;}
 const channelText=list=>(list||[]).map(id=>channels.find(item=>item.id===id)?.label).filter(Boolean).join(', ');
 const days=(start,end)=>Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1;
 // 'upcoming', 'running' or 'finished' on a Melbourne date.
 const status=(promotion,today)=>today<promotion.startDate?'upcoming':today>promotion.endDate?'finished':'running';
 // A repeating promotion only covers its chosen weekdays within its dates.
 const covers=(promotion,date)=>promotion.startDate<=date&&date<=promotion.endDate&&(!repeats(promotion)||promotion.weekdays.includes(weekday(date)));
 const overlaps=(promotion,from,to)=>promotion.startDate<=to&&promotion.endDate>=from;
 return{kinds,channels,maxDays,maxRepeatDays,maxItems,features,featureIds,featureState,weekdayNames,weekday,repeats,weekdayText,kind,offer,channelText,days,status,covers,overlaps,money};
});
