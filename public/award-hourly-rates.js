(()=>{
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined){e.textContent=text;window.appWording?.label(e,text);}if(cls)e.className=cls;return e;};
 function mount(host,{userId,companyId=window.appCompanyId,locationId=window.appLocationId,date='today'}={}){
  const root=node('section',undefined,'award-hourly-rates'),heading=node('h4','Automatic award rates'),tools=node('div',undefined,'award-hourly-rate-tools'),label=node('label','Rates for'),picker=node('input'),refresh=node('button','Refresh rates'),status=node('p','','small'),rates=node('dl'),more=node('details'),extraRates=node('dl'),source=node('p','','small'),note=node('p','Ordinary hourly estimates include applicable casual loading. Shift times, overtime and allowances determine the final roster cost.','small');
  root.dataset.awardRatePreview='';heading.dataset.featureHelp='award-settings';picker.type='date';picker.value=date==='today'?'':date;refresh.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');label.append(picker);tools.append(label,refresh);more.append(node('summary','Base and late-night rates'),extraRates);root.append(heading,tools,status,rates,more,source,note);host.append(root);
  let generation=0,controller=null,disposed=false,dirty=false,followToday=date==='today';
  const money=value=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
  async function load(){
   if(disposed||dirty)return;const version=++generation;controller?.abort();controller=new AbortController();status.textContent='Calculating award rates…';rates.hidden=true;more.hidden=true;source.hidden=true;refresh.disabled=true;
   try{
    const selected=followToday?'today':picker.value;if(!selected)throw Error('Choose a date for the rates.');
    const response=await fetch('/api/awards/rates/'+encodeURIComponent(userId)+'/'+encodeURIComponent(selected),{cache:'no-store',signal:controller.signal,headers:{'X-Company-Id':companyId,...(locationId?{'X-Location-Id':locationId}:{})}}),data=await response.json();
    if(disposed||version!==generation||dirty||!root.isConnected)return;if(!response.ok)throw Error(data.error||'Unable to calculate award rates.');if(data.companyId!==companyId||data.userId!==userId||data.locationId!==locationId)throw Error('The selected company or user changed.');
    picker.value=data.date;root.dataset.ready=String(data.ready);rates.replaceChildren();extraRates.replaceChildren();
    if(!data.ready){status.textContent=data.locationName+': '+data.issues.map(issue=>issue.message).join(' ');return;}
    for(const [title,key]of [['Award minimum base','minimumBaseCents'],...(data.payBasis==='base-plus-penalties'?[['Agreed base','baseCents']]:[]),['Weekday','weekdayCents'],['Saturday','saturdayCents'],['Sunday','sundayCents'],['Public holiday','publicHolidayCents'],['Weeknight · 10pm–midnight','eveningCents'],['Weekday · midnight–6am','overnightCents']]){const term=node('dt',title),value=node('dd');value.textContent=money(data.rates[key]);value.dataset.userText='';(['minimumBaseCents','baseCents','eveningCents','overnightCents'].includes(key)?extraRates:rates).append(term,value);}
    status.textContent='Calculated from saved employment details.';rates.hidden=false;more.hidden=false;source.textContent=data.locationName+' · '+data.source.code+' · '+data.source.title+' · Edition effective '+data.source.effectiveFrom;source.dataset.userText='';source.hidden=false;
   }catch(error){if(!disposed&&version===generation&&error.name!=='AbortError'){root.dataset.ready='false';status.textContent=error.message;}}
   finally{if(!disposed&&version===generation)refresh.disabled=dirty;}
  }
  picker.onchange=()=>{followToday=false;load();};refresh.onclick=load;
  picker.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();followToday=false;load();}});
  const focus=()=>{if(!document.hidden)load();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  load();
  return{refresh:load,setDraft(value){dirty=value;if(value){generation++;controller?.abort();rates.hidden=true;more.hidden=true;source.hidden=true;refresh.disabled=true;root.dataset.ready='false';status.textContent='Save employment details to update the automatic rates.';}else load();},destroy(){disposed=true;generation++;controller?.abort();window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);root.remove();}};
 }
 window.awardHourlyRates={mount};
})();
