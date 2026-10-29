(()=>{
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=text;window.appWording?.label(e,text);}if(cls)e.className=cls;return e;};
 function mount(host,{userId,companyId=window.appCompanyId,locationId=window.appLocationId,date='today',getDraft}={}){
  const root=node('section',undefined,'award-hourly-rates'),heading=node('h4','Pay Rates'),tools=node('div',undefined,'award-hourly-rate-tools'),label=node('label','Rates for'),picker=node('input'),refresh=node('button','Refresh rates'),status=node('p','','small'),rates=node('dl'),more=node('details'),extraRates=node('dl'),allowances=node('p','','small'),setup=node('p','','small'),source=node('p','','small'),note=node('p','Hourly estimates include applicable casual loading. Shift times, overtime and allowances determine the final roster cost.','small');
  root.dataset.awardRatePreview='';heading.dataset.featureHelp='award-settings';picker.type='date';picker.value=date==='today'?'':date;refresh.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');label.append(picker);tools.append(label,refresh);more.append(node('summary','Base and late-night rates'),extraRates);root.append(heading,tools,status,rates,more,allowances,setup,source,note);host.append(root);
  let generation=0,controller=null,disposed=false,dirty=false,followToday=date==='today',timer=null;
  const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100),headers=()=>({'X-Company-Id':companyId,...(locationId?{'X-Location-Id':locationId}:{})});
  function hideRates(){rates.hidden=more.hidden=allowances.hidden=setup.hidden=source.hidden=true;}
  async function load(){
   if(disposed||dirty&&!getDraft)return;clearTimeout(timer);const version=++generation;controller?.abort();controller=new AbortController();const signal=controller.signal,previewing=Boolean(getDraft&&dirty);status.textContent='Calculating award rates…';hideRates();refresh.disabled=true;
   try{
    const selected=followToday?'today':picker.value;if(!selected)throw Error('Choose a date for the rates.');let response;
    if(previewing){const profile=getDraft(),sessionResponse=await fetch('/api/session',{cache:'no-store',signal,headers:headers()}),session=await sessionResponse.json();if(!sessionResponse.ok||!session.csrf)throw Error('Sign in again to preview rates.');response=await fetch('/api/awards/rates/'+encodeURIComponent(userId)+'/preview',{method:'POST',cache:'no-store',signal,headers:{...headers(),'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({date:selected,profile})});}
    else response=await fetch('/api/awards/rates/'+encodeURIComponent(userId)+'/'+encodeURIComponent(selected),{cache:'no-store',signal,headers:headers()});
    const data=await response.json();if(disposed||version!==generation||dirty&&!getDraft||!root.isConnected)return;if(!response.ok)throw Error(data.error||'Unable to calculate award rates.');if(data.companyId!==companyId||data.userId!==userId||data.locationId!==locationId)throw Error('The selected company or user changed.');
    picker.value=data.date;root.dataset.ready=String(data.ready);root.dataset.preview=String(data.preview===true);rates.replaceChildren();extraRates.replaceChildren();
    if(!data.ready){status.textContent=(previewing?'Preview · ':'')+data.locationName+': '+data.issues.map(issue=>issue.message).join(' ');return;}
    for(const [title,key]of [['Award minimum base','minimumBaseCents'],...(data.payBasis==='base-plus-penalties'?[['Agreed base','baseCents']]:[]),['Weekday hourly rate','weekdayCents'],['Saturday','saturdayCents'],['Sunday','sundayCents'],['Public holiday','publicHolidayCents'],['Weeknight · 10pm–midnight','eveningCents'],['Weekday · midnight–6am','overnightCents']]){const term=node('dt',title),value=node('dd');value.textContent=money(data.rates[key])+(key==='weekdayCents'?' / hour':'');value.dataset.rate=key;value.dataset.userText='';(['minimumBaseCents','baseCents','eveningCents','overnightCents'].includes(key)?extraRates:rates).append(term,value);}
    status.textContent=previewing?'Preview from unsaved selections · Save employment details to apply.':'Calculated from saved employment details.';rates.hidden=false;more.hidden=false;
    allowances.textContent=(data.allowanceEstimates||[]).map(a=>a.label+': '+money(a.amountCents)+' / '+a.unit).join(' · ');allowances.dataset.userText='';allowances.hidden=!allowances.textContent;
    setup.textContent=data.setupIssues?.length?'Before saving: '+[...new Set(data.setupIssues.map(i=>i.message))].join(' '):'';setup.hidden=!setup.textContent;
    source.textContent=data.locationName+' · '+data.source.code+' · '+data.source.title+' · Edition effective '+data.source.effectiveFrom;source.dataset.userText='';source.hidden=false;
   }catch(error){if(!disposed&&version===generation&&error.name!=='AbortError'){root.dataset.ready='false';status.textContent=error.message;}}
   finally{if(!disposed&&version===generation)refresh.disabled=dirty&&!getDraft;}
  }
  picker.onchange=()=>{followToday=false;load();};refresh.onclick=load;picker.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();followToday=false;load();}});
  const focus=()=>{if(!document.hidden)load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);load();
  return{refresh:load,setDraft(value,{date:nextDate}={}){dirty=value;generation++;controller?.abort();clearTimeout(timer);if(nextDate!==undefined){picker.value=nextDate;followToday=false;}hideRates();root.dataset.ready='false';root.dataset.preview=String(value);refresh.disabled=value&&!getDraft;status.textContent=value?(getDraft?'Updating rate preview…':'Save employment details to update the automatic rates.'):'Calculating award rates…';if(!value)load();else if(getDraft)timer=setTimeout(load,250);},destroy(){disposed=true;generation++;clearTimeout(timer);controller?.abort();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);root.remove();}};
 }
 window.awardHourlyRates={mount};
})();
