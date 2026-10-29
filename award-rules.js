const M=require('./public/rostering-model');
const types=['full-time','part-time','casual'];
const flexibilityTerms=['work-times','overtime','penalties','allowances','annual-leave-loading'];
const kinds={'minimum-engagement':'Minimum paid engagement','daily-hours':'Daily paid hours','weekly-hours':'Weekly paid hours','minimum-rest':'Rest between shifts','unpaid-break':'Unpaid break duration','minimum-rate':'Minimum base hourly rate'};
const exclusions=['Penalty and overtime pay','Paid rest breaks and break timing','Public holidays and allowances','Part-time variations and agreements','NES, leave and state-specific requirements'];
const fail=message=>{throw Object.assign(Error(message),{status:400});};
function object(value){if(!value||typeof value!=='object'||Array.isArray(value))fail('Enter valid award details.');return value;}
function text(value,max=200){if(typeof value!=='string'||!value.trim()||value.length>max)fail('Enter text of 1–'+max+' characters.');return value.trim();}
function integer(value,min,max,label){if(!Number.isSafeInteger(value)||value<min||value>max)fail('Enter a valid '+label+'.');return value;}
function source(value){const input=text(value,1000);let url;try{url=new URL(input);}catch{fail('Enter the HTTPS source reference.');}if(url.protocol!=='https:'||url.username||url.password)fail('Use an HTTPS source reference without credentials.');return url.href;}
function pack(input){
 object(input);if(input.schemaVersion!==1||input.awardCode!=='MA000003')fail('Choose an Opstack MA000003 rule set (schema version 1).');M.date(input.effectiveFrom);M.date(input.effectiveTo);if(input.effectiveTo<input.effectiveFrom)fail('The review end date must follow the effective date.');
 if(!Array.isArray(input.rules)||!input.rules.length||input.rules.length>300)fail('Enter 1–300 referenced rules.');
 const rules=input.rules.map((raw,index)=>{object(raw);if(!kinds[raw.kind])fail('Choose a supported check type.');const employmentType=raw.employmentType||'all',classification=raw.classification||'all';if(!['all',...types].includes(employmentType)||!['all','1','2','3'].includes(classification))fail('Choose an employment type and classification.');const rule={id:'rule-'+index,kind:raw.kind,employmentType,classification,minAge:integer(raw.minAge??0,0,120,'minimum age'),maxAge:integer(raw.maxAge??120,0,120,'maximum age'),clause:text(raw.clause,160),value:integer(raw.value,1,raw.kind==='minimum-rate'?10000000:10080,'rule amount')};if(rule.maxAge<rule.minAge)fail('The age range is reversed.');if(raw.kind==='unpaid-break')rule.afterMinutes=integer(raw.afterMinutes,1,1440,'break threshold');return rule;});
 return{schemaVersion:1,awardCode:'MA000003',label:text(input.label,100),effectiveFrom:input.effectiveFrom,effectiveTo:input.effectiveTo,sourceUrl:source(input.sourceUrl),rules};
}
function calendarDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<'1900-01-01'||value>'2100-12-31'||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('Choose a valid employee date.');return value;}
function age(dob,date){let result=Number(date.slice(0,4))-Number(dob.slice(0,4));if(date.slice(5)<dob.slice(5))result--;return result;}
function profile(input,today){object(input);M.date(input.effectiveFrom);calendarDate(input.dateOfBirth);calendarDate(input.employmentStart);if(input.dateOfBirth>today||age(input.dateOfBirth,today)>120||input.employmentStart<input.dateOfBirth)fail('Check the birth date and employment start date.');if(!types.includes(input.employmentType)||!['1','2','3'].includes(input.classification))fail('Choose an employment type and award classification.');const agreedWeeklyMinutes=input.employmentType==='part-time'&&input.agreedWeeklyMinutes!=null?integer(input.agreedWeeklyMinutes,1,10080,'agreed weekly minutes'):null;return{effectiveFrom:input.effectiveFrom,dateOfBirth:input.dateOfBirth,employmentStart:input.employmentStart,employmentType:input.employmentType,classification:input.classification,agreedWeeklyMinutes,...employmentDetails(input),...(input.flexibilityAgreements!==undefined?{flexibilityAgreements:validateFlexibilityAgreements(input.flexibilityAgreements,input,today)}:{})};}
function validateFlexibilityAgreements(input,employee,today){
 if(!Array.isArray(input)||input.length>200)fail('Enter valid Individual Flexibility Agreement records.');
 const ids=new Set();return input.map(raw=>{
  object(raw);if(typeof raw.locationId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(raw.locationId)||ids.has(raw.locationId))fail('Record one IFA per employer location in each dated employment record.');ids.add(raw.locationId);
  const reference=text(raw.reference,500),employerName=text(raw.employerName,200),variationSummary=text(raw.variationSummary,2000),betterOffOverall=text(raw.betterOffOverall,2000);
  if(reference.length<8||variationSummary.length<8||betterOffOverall.length<8)fail('Enter the signed IFA reference, varied terms and better-off-overall record (at least 8 characters each).');
  const signedOn=calendarDate(raw.signedOn),startsOn=calendarDate(raw.startsOn),endsOn=raw.endsOn?calendarDate(raw.endsOn):null;
  if(signedOn>today||signedOn<employee.employmentStart||startsOn<signedOn||endsOn&&endsOn<startsOn)fail('Check the IFA signing, employment and start/end dates.');
  if(!Array.isArray(raw.terms)||!raw.terms.length||raw.terms.some(t=>!flexibilityTerms.includes(t))||new Set(raw.terms).size!==raw.terms.length)fail('Choose the award terms covered by the signed IFA.');
  if(typeof raw.rosteredHours!=='boolean'||raw.rosteredHours&&!raw.terms.includes('work-times')||raw.confirmed!==true)fail('Confirm the signed IFA, required signatures and employee copy, and whether it permits roster-based hours.');
  return{locationId:raw.locationId,employerName,reference,signedOn,startsOn,endsOn,terms:flexibilityTerms.filter(t=>raw.terms.includes(t)),rosteredHours:raw.rosteredHours,variationSummary,betterOffOverall,confirmed:true};
 });
}
function activeFlexibilityAgreement(profile,date,locationId){return Array.isArray(profile?.flexibilityAgreements)?profile.flexibilityAgreements.find(v=>v&&v.locationId===locationId&&typeof v.startsOn==='string'&&v.startsOn<=date&&(!v.endsOn||v.endsOn>=date))||null:null;}
function rosteredHoursAgreement(profile,date,locationId,employerName){const v=activeFlexibilityAgreement(profile,date,locationId);return Boolean(v&&v.confirmed===true&&v.rosteredHours===true&&Array.isArray(v.terms)&&v.terms.length===1&&v.terms[0]==='work-times'&&v.employerName===employerName);}
function employmentDetails(input){
 const result={};
 if(input.arrangement!==undefined){if(!['standard','needs-review'].includes(input.arrangement))fail('Choose the award arrangement.');result.arrangement=input.arrangement;}
 if(input.agreementReference!==undefined){result.agreementReference=input.agreementReference?text(input.agreementReference,500):'';}if(input.employmentType==='part-time'&&input.payBasis&&(input.pattern!==undefined||input.agreedWeeklyMinutes!=null||result.agreementReference)&&(!result.agreementReference||result.agreementReference.length<8))fail('Record the written regular working hours agreement reference (at least 8 characters).');
 if(input.payBasis!==undefined){if(!['award','base-plus-penalties'].includes(input.payBasis))fail('Choose a pay arrangement.');result.payBasis=input.payBasis;result.baseRateCents=input.payBasis==='base-plus-penalties'?integer(input.baseRateCents,1,10000000,'agreed base rate'):null;}
 if(input.level3Band!==undefined){if(!['one-or-none','two-or-more',null].includes(input.level3Band))fail('Choose the Level 3 supervisory band.');result.level3Band=input.classification==='3'?input.level3Band:null;}
 for(const key of ['laundersUniform','superEligible'])if(input[key]!==undefined){if(typeof input[key]!=='boolean'&&input[key]!==null)fail('Choose the employment conditions.');result[key]=input[key];}
 result.cycleWeeks=integer(input.cycleWeeks??1,1,4,'averaging cycle');result.cycleAnchor=input.cycleAnchor||null;
 if(result.cycleWeeks>1){M.date(result.cycleAnchor);if(M.monday(result.cycleAnchor)!==result.cycleAnchor)fail('Choose a Monday cycle anchor.');}
 if(input.pattern!==undefined){if(!Array.isArray(input.pattern)||input.pattern.length!==7)fail('Enter the seven days of regular working hours.');result.pattern=input.pattern.map(day=>{if(day===null)return null;object(day);M.minutes(day.start);M.minutes(day.end);if(typeof day.overnight!=='boolean')fail('Choose whether agreed work ends the next day.');const total=M.minutes(day.end)+(day.overnight?1440:0)-M.minutes(day.start),breakMinutes=integer(day.breakMinutes,0,180,'agreed meal break');if(total<180||total>1440||total-breakMinutes<180)fail('Agreed part-time engagements must include at least three paid hours.');if(day.mealBreakStart){M.minutes(day.mealBreakStart);}if(input.payBasis&&breakMinutes>0&&!day.mealBreakStart)fail('Record when the agreed regular working hours permit the meal break.');return{start:day.start,end:day.end,overnight:day.overnight,breakMinutes,...(day.mealBreakStart?{mealBreakStart:day.mealBreakStart}:{})};});const minutes=result.pattern.reduce((sum,d)=>sum+(d?M.minutes(d.end)+(d.overnight?1440:0)-M.minutes(d.start)-d.breakMinutes:0),0);if(input.employmentType==='part-time'&&(minutes!==input.agreedWeeklyMinutes||minutes>=2280))fail('Regular working hours must match agreed weekly hours, below 38.');}
 return result;
}
function evaluate({company,items,profiles,versions,locationId,weekStart,subjectId}){
 const local=items.filter(item=>item.locationId===locationId&&M.monday(M.localParts(item.startAt).date)===weekStart&&(!subjectId||item.id===subjectId)),issues=[],coverage=new Set(),versionIds=new Set();
 const add=(item,code,message,rule,version)=>{if(issues.length>=500)return;const issue={subjectId:item.id,userId:item.userId,code,message,clause:rule?.clause||null,versionId:version?.id||null};if(!issues.some(other=>other.subjectId===issue.subjectId&&other.code===code&&other.clause===issue.clause))issues.push(issue);};
 if(!company.enabled)return{enabled:false,status:'disabled',issues:[],coverage:[],exclusions,versionIds:[],reviewRequired:false};
 for(const item of local){
  if(!item.userId){add(item,'unassigned','Assign a staff member before checking this shift.');continue;}
  const date=M.localParts(item.startAt).date,version=versions.filter(v=>v.reviewedAt&&v.effectiveFrom<=date).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)||b.reviewedAt.localeCompare(a.reviewedAt))[0];
  if(!version||version.effectiveTo<date){add(item,'no-rules','No reviewed rules cover '+date+'. Import and review a dated rule set.');continue;}versionIds.add(version.id);if(versions.some(v=>!v.reviewedAt&&v.effectiveFrom>=version.effectiveFrom&&v.effectiveFrom<=date))add(item,'unreviewed-update','An unreviewed rule update covers this shift date. Review it before relying on the existing checks.',null,version);
  const p=profiles.filter(p=>p.userId===item.userId&&p.effectiveFrom<=date).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if(!p){add(item,'no-profile','Complete this employee’s award profile for '+date+'.',null,version);continue;}
  if(date<p.employmentStart||date<p.dateOfBirth){add(item,'profile-date','This shift predates the employee’s recorded employment or birth date.',null,version);continue;}
  const years=age(p.dateOfBirth,date),related=items.filter(other=>other.userId===item.userId),day=related.filter(other=>M.localParts(other.startAt).date===date),weekly=related.filter(other=>M.monday(M.localParts(other.startAt).date)===weekStart),paid=item.paidSeconds/60,elapsed=(Date.parse(item.endAt)-Date.parse(item.startAt))/60000;
  if(p.employmentType==='part-time'&&!Number.isSafeInteger(p.agreedWeeklyMinutes)&&!rosteredHoursAgreement(p,date,locationId,company.employerName))add(item,'part-time-hours-missing','Add agreed regular working hours before checking part-time weekly hours.');
  if(p.employmentType==='part-time'&&Number.isSafeInteger(p.agreedWeeklyMinutes)&&weekly.reduce((sum,other)=>sum+other.paidSeconds/60,0)>p.agreedWeeklyMinutes)add(item,'part-time-hours','Paid hours exceed agreed part-time weekly hours. Review the written variation and overtime treatment.',null,version);
  if(M.monday(M.localParts(item.endAt).date)!==M.monday(date))add(item,'week-boundary','This shift crosses the weekly boundary. Review allocation of hours and breaks between weeks.',null,version);
  let matched=0;
  for(const rule of version.rules){
   if(rule.employmentType!=='all'&&rule.employmentType!==p.employmentType||rule.classification!=='all'&&rule.classification!==p.classification||years<rule.minAge||years>rule.maxAge)continue;
   matched++;coverage.add(kinds[rule.kind]);
   const report=message=>add(item,rule.kind,message+' Check '+rule.clause+'.',rule,version);
   if(rule.kind==='minimum-engagement'&&paid<rule.value)report('Paid time is below the configured '+rule.value+' minute minimum engagement.');
   if(rule.kind==='daily-hours'&&day.reduce((sum,other)=>sum+other.paidSeconds/60,0)>rule.value)report('Combined daily paid time exceeds the configured '+rule.value+' minute threshold across company locations. Review overtime and any permitted arrangements.');
   if(rule.kind==='weekly-hours'&&weekly.reduce((sum,other)=>sum+other.paidSeconds/60,0)>rule.value)report('Combined Monday–Sunday paid time exceeds the configured '+rule.value+' minute threshold across company locations. Review averaging and overtime.');
   if(rule.kind==='minimum-rest'&&related.some(other=>other.id!==item.id&&(Date.parse(other.endAt)<=Date.parse(item.startAt)&&(Date.parse(item.startAt)-Date.parse(other.endAt))/60000<rule.value||Date.parse(other.startAt)>=Date.parse(item.endAt)&&(Date.parse(other.startAt)-Date.parse(item.endAt))/60000<rule.value)))report('Rest between this and an adjacent shift is below the configured '+rule.value+' minutes.');
   if(rule.kind==='unpaid-break'&&elapsed>rule.afterMinutes&&item.breakMinutes<rule.value)report('Recorded unpaid break is below the configured '+rule.value+' minutes for this shift length. Actual break timing still needs review.');
   if(rule.kind==='minimum-rate'&&(item.rateCents===null||item.rateCents===undefined))report('No hourly rate is recorded for comparison with the configured base minimum.');
   else if(rule.kind==='minimum-rate'&&item.rateCents<rule.value)report('The assigned hourly rate is below the configured minimum base rate. Penalties and overtime pay are not included in this check.');
  }
  if(!matched)add(item,'no-matching-rules','No configured checks match this employee’s type, classification and age.',null,version);
 }
 if(!local.length&&!versions.some(v=>v.reviewedAt&&v.effectiveFrom<=weekStart&&v.effectiveTo>=weekStart))issues.push({subjectId:null,userId:null,code:'no-rules',message:'No reviewed rules cover this week. Import and review a dated rule set.',clause:null,versionId:null});
 return{enabled:true,status:issues.length?'review-required':local.length?'configured-checks-clear':'no-items',issues,coverage:[...coverage],exclusions,versionIds:[...versionIds],reviewRequired:issues.length>0};
}
module.exports={types,kinds,exclusions,pack,profile,evaluate,age,object,text,source,calendarDate,flexibilityTerms,activeFlexibilityAgreement,rosteredHoursAgreement};
