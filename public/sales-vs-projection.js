// Small read-only ▲/▼ badge comparing a recorded day with its projected sales.
(()=>{
 const wording=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]));
 const money=cents=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(cents/100);
 function compare(actualCents,projectedCents){
  if(!Number.isSafeInteger(actualCents)||!Number.isSafeInteger(projectedCents)||projectedCents<0)return null;
  const differenceCents=actualCents-projectedCents,state=differenceCents>0?'above':differenceCents<0?'below':'on';
  return {state,differenceCents,percent:projectedCents>0?differenceCents/projectedCents*100:null};
 }
 function badge(actualCents,projectedCents){
  const result=compare(actualCents,projectedCents);if(!result)return null;
  const node=document.createElement('span'),arrow=document.createElement('span'),value=document.createElement('span');
  node.className='sales-vs-projection';node.dataset.state=result.state;arrow.className='sales-vs-projection-arrow';arrow.setAttribute('aria-hidden','true');arrow.textContent=result.state==='above'?'▲':result.state==='below'?'▼':'●';
  const size=Math.abs(result.differenceCents);value.textContent=result.state==='on'?wording('On projection'):money(size)+(result.percent===null?'':' · '+Math.abs(result.percent).toFixed(1)+'%');value.dataset.userText='';
  const text=result.state==='on'?wording('On projection ({projected})',{projected:money(projectedCents)}):wording(result.state==='above'?'{difference} above projected {projected}':'{difference} below projected {projected}',{difference:money(size),projected:money(projectedCents)});
  node.title=text;node.setAttribute('aria-label',text);node.setAttribute('role','img');node.append(arrow,value);return node;
 }
 window.salesVsProjection={compare,badge};
})();
