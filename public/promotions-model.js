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
 const maxDays=92;
 const kind=id=>kinds.find(item=>item.id===id)||null;
 const money=cents=>'$'+(cents/100).toLocaleString('en-AU',{minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2});
 // "20% off", "$5 off", "Special price $9.95", or the type name.
 function offer(promotion){const type=kind(promotion?.kind);if(!type)return'';if(type.id==='percent'&&Number.isInteger(promotion.value))return promotion.value+'% off';if(type.id==='amount'&&Number.isInteger(promotion.value))return money(promotion.value)+' off';if(type.id==='price'&&Number.isInteger(promotion.value))return'Special price '+money(promotion.value);return type.label;}
 const channelText=list=>(list||[]).map(id=>channels.find(item=>item.id===id)?.label).filter(Boolean).join(', ');
 const days=(start,end)=>Math.round((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000)+1;
 // 'upcoming', 'running' or 'finished' on a Melbourne date.
 const status=(promotion,today)=>today<promotion.startDate?'upcoming':today>promotion.endDate?'finished':'running';
 const covers=(promotion,date)=>promotion.startDate<=date&&date<=promotion.endDate;
 const overlaps=(promotion,from,to)=>promotion.startDate<=to&&promotion.endDate>=from;
 return{kinds,channels,maxDays,kind,offer,channelText,days,status,covers,overlaps,money};
});
