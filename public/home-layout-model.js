/* Shared, allowlisted Home layout settings for server rendering and App edit. */
(function(root){
 const sections={
  'home-hero':'Greeting, location & date','home-totals':'Quarter totals & averages','home-quarter-averages':'Quarter averages',
  'home-actions':'Quick links','home-budget-panel':'Ordering budget','home-administration':'Administration'
 };
 const shortcuts={
  'home-ordering-card':'Ordering','home-cart-card':'Cart','home-stock-card':'Stock count','home-sales-card':'Sales',
  'home-roster-card':'Rostering','home-comms-card':'Comms','home-library-card':'Knowledge Library','home-reporting-card':'Reporting'
 };
 const metrics={
  'home-total-sales':'Quarter sales','home-total-orders':'Placed orders','home-total-expense':'Quarter expense %',
  'home-average-sales-metric':'Average weekly sales','home-average-cost-metric':'Average weekly cost','home-average-expense-metric':'Average weekly expense %',
  'home-budget-projection':'Projected sales','home-budget-amount':'Ordering budget','home-budget-spent':'Order costs','home-budget-remaining':'Budget after cart'
 };
 const widgets={...sections,...shortcuts,...metrics};
 const defaults={density:'compact',columns:6,gap:12,radius:14,width:'full',shortcutStyle:'cards',descriptions:false,periods:true,notes:false,hidden:[]};
 function validate(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(defaults,key)))throw Error('Choose valid Home layout settings.');
  const result={...defaults,hidden:[...defaults.hidden],...value};
  for(const [key,values] of Object.entries({density:['compact','comfortable'],width:['full','1200','1440'],shortcutStyle:['cards','list']}))if(!values.includes(result[key]))throw Error('Choose a supported '+key+' for Home.');
  for(const [key,min,max] of [['columns',2,6],['gap',6,24],['radius',0,24]])if(!Number.isInteger(result[key])||result[key]<min||result[key]>max)throw Error('Choose a valid Home '+key+'.');
  for(const key of ['descriptions','periods','notes'])if(typeof result[key]!=='boolean')throw Error('Choose whether to show Home '+key+'.');
  if(!Array.isArray(result.hidden)||result.hidden.some(id=>!Object.hasOwn(widgets,id))||new Set(result.hidden).size!==result.hidden.length)throw Error('Choose supported Home sections or cards.');
  result.hidden=[...result.hidden];return result;
 }
 function css(value){
  let settings;try{settings=validate(value||{});}catch{return '';}
  const compact=settings.density==='compact',scope='[data-edit-id="home-main"]';
  let result=scope+'{--home-columns:'+settings.columns+';--home-gap:'+settings.gap+'px;--home-radius:'+settings.radius+'px;--home-pad:'+(compact?12:18)+'px;--home-card-height:'+(compact?82:108)+'px;--home-max-width:'+(settings.width==='full'?'none':settings.width+'px')+';}';
  const hidden=[...settings.hidden.flatMap(id=>['[data-edit-id="'+id+'"]',...(Object.hasOwn(sections,id)?['.home-section:has(>.home-section-body>[data-edit-id="'+id+'"])']:[])]),...(!settings.descriptions?['.home-card-content>p']:[]),...(!settings.periods?['.home-total-period']:[]),...(!settings.notes?['.home-explanation:not([data-home-error])']:[])];
  for(const target of hidden)result+='body:not(.app-edit-mode) '+scope+' '+target+'{display:none!important;}';
  for(const id of settings.hidden)result+='body.app-edit-mode '+scope+' [data-edit-id="'+id+'"]{opacity:.45;outline:1px dashed var(--primary);outline-offset:-1px;}';
  if(settings.shortcutStyle==='list')result+=scope+' .home-actions{grid-template-columns:repeat(min(2,var(--home-columns)),minmax(0,1fr));}'+scope+' .home-action{min-height:54px;height:auto;padding:8px 12px;}'+scope+' .home-card-icon{width:32px;flex-basis:32px;height:32px;}'+scope+' .home-card-value{margin-top:2px;}';
  return result;
 }
 const api={defaults,sections,shortcuts,metrics,widgets,validate,css};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.homeLayoutModel=api;
})(globalThis);
