// Small read-only ▲/▼ badge comparing a recorded day with its projected sales.
(()=>{
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 const money=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
 function compare(actualCents,projectedCents){
  if(!Number.isSafeInteger(actualCents)||!Number.isSafeInteger(projectedCents)||projectedCents<0)return null;
  const differenceCents=actualCents-projectedCents,state=differenceCents>0?'above':differenceCents<0?'below':'on';
  return {state,differenceCents,percent:projectedCents>0?differenceCents/projectedCents*100:null};
 }
 function badge(actualCents,projectedCents,{scope=''}={}){
  const result=compare(actualCents,projectedCents);if(!result)return null;
  const node=document.createElement('span'),lead=document.createElement('span'),arrow=document.createElement('span'),amount=document.createElement('span');
  node.className='sales-vs-projection';node.dataset.state=result.state;lead.className='sales-vs-projection-lead';arrow.className='sales-vs-projection-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent=result.state==='above'?'▲':result.state==='below'?'▼':'●';
  const size=Math.abs(result.differenceCents);amount.textContent=result.state==='on'?wording('On projection'):money(size);amount.dataset.userText='';lead.append(arrow,amount);node.append(lead);
  // The arrow stays with the dollar amount; only the percentage may wrap to a second line.
  if(result.state!=='on'&&result.percent!==null){const percent=document.createElement('span');percent.className='sales-vs-projection-percent';percent.textContent='· '+Math.abs(result.percent).toFixed(1)+'%';percent.dataset.userText='';node.append(' ',percent);}
  const text=(result.state==='on'?wording('On projection ({projected})',{projected:money(projectedCents)}):wording(result.state==='above'?'{difference} above projected {projected}':'{difference} below projected {projected}',{difference:money(size),projected:money(projectedCents)}))+(scope?' · '+wording(scope.text,scope.values):'');
  node.title=text;node.setAttribute('aria-label',text);node.setAttribute('role','img');return node;
 }
 // Week totals compare only the days that have an actual, so part-recorded weeks are fair.
 function weekBadge(actualDays,projectedDays){
  if(!Array.isArray(actualDays)||!Array.isArray(projectedDays))return null;let actual=0,projected=0,count=0;
  for(let index=0;index<7;index++){if(!Number.isSafeInteger(actualDays[index]))continue;if(!Number.isSafeInteger(projectedDays[index]))return null;actual+=actualDays[index];projected+=projectedDays[index];count++;}
  return count?badge(actual,projected,{scope:count===7?'':{text:'{count} recorded days',values:{count}}}):null;
 }
 window.salesVsProjection={compare,badge,weekBadge};
})();
