// Shared sales comparison for the Sales page and cart.
(()=>{
 const $=id=>document.getElementById(id);
 const money=value=>value===null?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 const dateLabel=date=>new Intl.DateTimeFormat('en-AU',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 function template(element,text,values={}){element.dataset.appTemplate=text;element.dataset.appValues=JSON.stringify(values);element.textContent=wording(text,values);}
 function render(projection,performance=projection?.performance,{unsaved=false}={}){
  if(!$('sales-performance-actual')||!projection||!performance)return;
  $('sales-performance-actual').textContent=performance.recordedDays?money(performance.actualCents):'—';$('sales-performance-expected').textContent=money(performance.expectedCents);
  const difference=performance.differenceCents,percent=performance.differencePercent;
  $('sales-performance-difference').textContent=difference===null?'—':(difference>0?'+':'')+money(difference);
  $('sales-performance-percent').textContent=percent===null?'':(percent>0?'+':'')+new Intl.NumberFormat('en-AU',{maximumFractionDigits:1}).format(percent)+'%';
  const status=!performance.recordedDays?'Add daily sales':difference===null?'Projection unavailable':difference>0?'Ahead of projection':difference<0?'Behind projection':'On projection';
  template($('sales-performance-status'),status);const state=difference===null?'unavailable':difference<0?'behind':difference>0?'ahead':'on';$('sales-performance-status').dataset.performance=state;$('sales-performance-difference').dataset.performance=state;
  template($('sales-performance-coverage'),performance.recordedDays?(performance.recordedDays===1?'Comparing 1 recorded day through {date} with the same weekday in this week’s projection.':'Comparing {count} recorded days through {date} with the same weekdays in this week’s projection.'):'Enter this week’s daily sales to compare your progress with the projection.',{count:performance.recordedDays,date:dateLabel(projection.today)});
  const notes=[];if(performance.recordedDays&&difference===null)notes.push('Complete the previous four weeks to see the difference from projection.');
  if(performance.missingDays)notes.push(performance.missingDays===1?'1 earlier day has no sales entered and is excluded.':'{count} earlier days have no sales entered and are excluded.');
  if(unsaved)notes.push('Includes unsaved sales.');if(difference!==null&&performance.expectedCents===0)notes.push('Percentage difference is unavailable when expected sales are $0.');
  template($('sales-performance-note'),notes.join(' '),{count:performance.missingDays});$('sales-performance-note').hidden=!notes.length;
 }
 window.salesPerformanceView={render};
})();
