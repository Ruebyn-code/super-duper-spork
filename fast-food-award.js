'use strict';
// MA000003, consolidated 1 July 2026. Money is cents; percentages are integers.
// Source and supported scope are deliberately versioned with the calculator.
const M = require('./public/rostering-model');
const {age, profile: validateProfile, calendarDate, activeFlexibilityAgreement, rosteredHoursAgreement} = require('./award-rules');
const crypto = require('node:crypto');
const source = Object.freeze({
  id: 'MA000003-2026-07-v1', code: 'MA000003', title: 'Fast Food Industry Award 2020',
  effectiveFrom: '2026-07-01', reviewBy: '2027-07-01',
  amendments: ['PR799280', 'PR799284', 'PR799442'],
  sha256: 'fae4ca2b8dc7b5e902daf80ef91e63f2104637affd28be074aa79a1ce0478583',
  url: 'https://awards.fairwork.gov.au/MA000003.html',
  weeklyRates: {'1':105680,'2':111910,'3-one':113640,'3-many':115040},
  adultRates: {'1': 2781, '2': 2945, '3-one': 2991, '3-many': 3027},
  allowances: {brokenHill: 4790, cold: 38, freezer: 97, meal: 1733, furtherMeal: 1566, laundryFullTime: 642, laundryShift: 128, deliveryKm: 53, otherKm: 100}
});
const coverage = ['Adult and junior minimum rates', 'Casual loading', 'Evening, weekend and configured public holiday penalties', 'Daily and weekly/cycle overtime', 'Part-time agreed pattern, optional variations and recorded roster-hours IFAs', 'Full-time work outside the published roster', 'Minimum engagements and isolated Sunday overtime', 'Recorded break entitlements and timing', 'Configured clothing, cold work, vehicle, meal and travel allowances', 'Itemised wage estimates and approval snapshots'];
const exclusions = ['Award coverage and classification decisions', 'Six-day/four-day arrangements (five ordinary days used)', 'IFA pay variations, TOIL, supported wages and traineeships', 'Leave, accident pay, termination, redundancy and deductions', 'NES, state child-employment laws, tax, payslips and payroll lodgement', 'Super eligibility, OTE adjustments and employer on-cost obligations (estimates only)', 'Future award changes after this uploaded edition'];
const invalid=message=>Object.assign(Error(message),{status:400});
const roundRate = (cents, percent) => Math.floor((cents * percent + 50) / 100);
function baseRate(profile, date) {
  const key = profile.classification === '3' ? (profile.level3Band === 'two-or-more' ? '3-many' : profile.level3Band === 'one-or-none' ? '3-one' : null) : profile.classification;
  if (!key || !source.adultRates[key]) return null;
  const years = age(profile.dateOfBirth, date), percent = years < 16 ? 40 : years < 21 ? (years - 11) * 10 : 100;
  // Clauses 15.1 note 1 and 15.2: apply the junior percentage to the
  // unrounded weekly rate / 38, then round the junior hourly base to cents.
  return Math.floor((source.weeklyRates[key]*percent+1900)/3800);
}
function periodStart(date, anchor, weeks = 1) {
  const days = Math.floor((Date.parse(date+'T00:00:00Z') - Date.parse(anchor+'T00:00:00Z')) / 86400000);
  return M.shiftDate(anchor, Math.floor(days / (7 * weeks)) * 7 * weeks);
}
function rateEffective(config) {
  let date = periodStart(source.effectiveFrom, config.payPeriodAnchor, config.payPeriodWeeks);
  if (date < source.effectiveFrom) date = M.shiftDate(date, 7 * config.payPeriodWeeks);
  return date;
}
function ordinaryPercent(type, classification, day, minute, holiday) {
  let percent = holiday ? 225 : day === 6 ? 125 : day === 0 ? (classification === '1' ? 125 : 150) : minute < 360 ? 115 : minute >= 1320 ? 110 : 100;
  return percent + (type === 'casual' ? 25 : 0);
}
function overtimePercent(type, day, holiday, seconds) {
  return (holiday ? 250 : day === 0 || seconds >= 7200 ? 200 : 150) + (type === 'casual' ? 25 : 0);
}
// Read-only ordinary hourly estimates use the same bases, percentages and cent
// rounding as shift costing. They do not create work or replace shift facts.
function employmentIssues(profile,date,locationId,employerName){
 const issues=[],add=(code,message)=>issues.push({code,message});
  if(!profile)add('employment','Add employment details covering this date.');
  else{
    try{validateProfile({...profile,flexibilityAgreements:profile.flexibilityAgreements?.filter(v=>v.signedOn<=date)},date);if(!profile.payBasis||profile.classification==='3'&&!profile.level3Band)throw Error();}
    catch{add('employment','Complete the required employment details for this date.');}
    if(profile.effectiveFrom>date||profile.employmentStart>date||profile.dateOfBirth>date)add('employment-date','Choose a date covered by the employee’s saved employment details.');
    if(profile.arrangement==='needs-review')add('arrangement','This employee’s special arrangement requires a separately reviewed calculation.');
    if(profile.employmentType==='part-time'&&![1,4].includes(profile.cycleWeeks||1))add('averaging','Review the employee’s part-time averaging arrangement.');
  }
  const ifa=activeFlexibilityAgreement(profile,date,locationId),rosteredIFA=rosteredHoursAgreement(profile,date,locationId,employerName);
  if(ifa&&!rosteredIFA)add('ifa','This IFA requires a separately reviewed calculation. The standard calculator supports only a confirmed roster-based working-hours IFA for this employer, with unchanged award pay conditions.');
  if(profile?.employmentType==='part-time'&&!rosteredIFA&&(!Array.isArray(profile.pattern)||!profile.pattern.some(Boolean)||!profile.agreementReference||!Number.isSafeInteger(profile.agreedWeeklyMinutes)||profile.agreedWeeklyMinutes<=0))add('employment-pattern','Add written regular working hours or record a signed IFA permitting roster-based hours for this employer to calculate complete part-time shift costs.');
 if(profile){let minimum=null;try{minimum=baseRate(profile,date);}catch{}const base=profile.payBasis==='base-plus-penalties'?profile.baseRateCents:minimum;if(!Number.isSafeInteger(minimum)||!Number.isSafeInteger(base)||base<minimum)add('agreed-base','The agreed base rate is missing or below the employee’s award minimum.');}
 return issues;
}
// Ordinary hourly rates do not depend on regular working hours. Complete shift
// calculations still require the written part-time agreement and hours.
function hourlyInputIssues(profile,date,locationId,employerName){
 const issues=[],add=(code,message)=>issues.push({code,message});if(!profile)return[{code:'employment',message:'Choose the employee’s pay conditions.'}];
 try{calendarDate(profile.dateOfBirth);if(profile.dateOfBirth>date||age(profile.dateOfBirth,date)>120)throw Error();}catch{add('birth-date','Enter a valid date of birth for the rate date.');}
 if(!['full-time','part-time','casual'].includes(profile.employmentType))add('employment-type','Choose an employment type.');
 if(!['1','2','3'].includes(profile.classification)||profile.classification==='3'&&!['one-or-none','two-or-more'].includes(profile.level3Band))add('classification','Choose the classification and any Level 3 supervisory band.');
 if(!['award','base-plus-penalties'].includes(profile.payBasis))add('pay-basis','Choose a pay arrangement.');
 if(profile.arrangement&&profile.arrangement!=='standard')add('arrangement','This employee’s special arrangement requires a separately reviewed calculation.');
 if(activeFlexibilityAgreement(profile,date,locationId)&&!rosteredHoursAgreement(profile,date,locationId,employerName))add('ifa','The recorded IFA needs a separately reviewed calculation; its pay terms are not applied by the standard calculator.');
 for(const key of ['effectiveFrom','employmentStart'])if(profile[key]){try{calendarDate(profile[key]);if(profile[key]>date)add('employment-date','Choose a rate date covered by the employment details.');}catch{add('employment-date','Check the employment dates.');}}
 if(!issues.length){const minimum=baseRate(profile,date),base=profile.payBasis==='base-plus-penalties'?profile.baseRateCents:minimum;if(!Number.isSafeInteger(base)||base>10000000||base<minimum)add('agreed-base','The agreed base rate is missing or below the employee’s award minimum.');}
 return issues;
}
function hourlyRates({config, profile, date, preview=false, locationId=config.locationId}) {
  M.date(date);
  const issues=[],add=(code,message)=>issues.push({code,message});
  const enabled=config.enabled===true&&config.localPayEnabled===true;
  if(!enabled||config.coverageConfirmed!==true)add('employer-setup','Complete Employer setup in this location’s settings and enable automatic award calculations.');
  if(config.sourceId&&config.sourceId!==source.id)add('award-source','Review and activate the included award edition.');
  try{M.date(config.payPeriodAnchor);if(![1,2].includes(config.payPeriodWeeks))throw Error();if(date<rateEffective(config))add('award-date','The included award rates do not cover this pay period.');}
  catch{add('pay-period','Set the employer’s weekly or fortnightly pay-period start in this location’s Employer setup.');}
  if(date>=source.reviewBy)add('award-review','Review a newer award edition before calculating rates for this date.');
  const setupIssues=employmentIssues(profile,date,locationId,config.employerName);
  issues.push(...(preview?hourlyInputIssues(profile,date,locationId,config.employerName):setupIssues.filter(i=>i.code!=='employment-pattern')));
  const result={date,enabled,ready:false,source:{id:source.id,code:source.code,title:source.title,effectiveFrom:source.effectiveFrom,reviewBy:source.reviewBy},profileEffectiveFrom:profile?.effectiveFrom||null,payBasis:profile?.payBasis||null,issues,rates:null,setupIssues:preview?setupIssues:setupIssues.filter(i=>i.code==='employment-pattern'),...(preview?{preview:true}:{})};
  if(issues.length)return result;
  const minimumBaseCents=baseRate(profile,date),baseCents=profile.payBasis==='base-plus-penalties'?profile.baseRateCents:minimumBaseCents;
  if(!Number.isSafeInteger(minimumBaseCents)||!Number.isSafeInteger(baseCents)||baseCents<minimumBaseCents){add('agreed-base','The agreed base rate is missing or below the employee’s award minimum.');return result;}
  const ordinary=(day,minute=720,holiday=false)=>roundRate(baseCents,ordinaryPercent(profile.employmentType,profile.classification,day,minute,holiday));
  const allowanceEstimates=profile.laundersUniform===true?[{label:'Uniform laundry',amountCents:profile.employmentType==='full-time'?source.allowances.laundryFullTime:source.allowances.laundryShift,unit:profile.employmentType==='full-time'?'week':'shift'}]:[];
  return{...result,ready:true,allowanceEstimates,conditionalAllowances:require('./public/employee-allowances-model').selected(profile).filter(c=>!c.automatic).map(({id,label})=>({id,label})),rates:{minimumBaseCents,baseCents,weekdayCents:ordinary(1),saturdayCents:ordinary(6),sundayCents:ordinary(0),publicHolidayCents:ordinary(1,720,true),eveningCents:ordinary(1,1320),overnightCents:ordinary(1,0)}};
}
function calculate({config, profiles, items, mode = 'roster'}) {
  if (!config.localPayEnabled || !config.enabled) return {enabled: false, results: [], coverage: [], exclusions};
  const results = [], counters = new Map(), weeklyAllowances = new Set();
  // Adjacent records form one continuous engagement, including location moves.
  // Apply minimum payment once, on the final record, rather than per clock row.
  const engagements=new Map(),byUser=new Map(),breakData=new Map();
  for(const item of items){if(!byUser.has(item.userId))byUser.set(item.userId,[]);byUser.get(item.userId).push(item);}
  for(const entries of byUser.values()){
    let group;
    for(const item of entries.sort((a,b)=>a.startAt.localeCompare(b.startAt))){
      if(!group||group.endAt!==item.startAt)group={items:[],paidSeconds:0};
      const unpaid=item.breaks?.length?item.breaks.filter(b=>!b.paid).reduce((sum,b)=>sum+(Date.parse(b.endAt)-Date.parse(b.startAt))/1000,0):(item.breakMinutes||0)*60;
      group.paidSeconds+=item.paidSeconds??((Date.parse(item.endAt)-Date.parse(item.startAt))/1000-unpaid);
      group.items.push(item);group.endAt=item.endAt;engagements.set(item.id,group);
    }
  }
  const partsCache = new Map(), getParts = ms => {
    const key = Math.floor(ms / 60000);
    if (!partsCache.has(key)) partsCache.set(key, M.localParts(new Date(ms).toISOString()));
    return partsCache.get(key);
  };
  const getCounter = key => {if (!counters.has(key)) counters.set(key, {ordinary: 0, overtime: 0, dates: new Set()}); return counters.get(key);};
  const selectedProfile = (id, date) => profiles.filter(p => p.userId === id && p.effectiveFrom <= date).sort((a,b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  for (const item of [...items].sort((a,b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id))) {
    const start = Date.parse(item.startAt), end = Date.parse(item.endAt), firstDate = getParts(start).date;
    const result = {subjectId: item.id, userId: item.userId, locationId: item.locationId, versionId: source.id, costCents: null, wageCents: 0, allowanceCents: 0, superEstimateCents: null, oncostEstimateCents: 0, employerEstimateCents: null, paidSeconds: 0, ordinarySeconds: 0, overtimeSeconds: 0, minimumPaymentSeconds: 0, lines: [], issues: [], complete: true, estimated: mode === 'roster'};
    const issue = (code, message, clause, blocking = false) => {
      if (!result.issues.some(i => i.code === code)) result.issues.push({subjectId: item.id, userId: item.userId, code, message, clause, versionId: source.id, blocking});
      if (blocking) result.complete = false;
    };
    const add = (label, seconds, rateCents, clause, kind, date) => {
      const last = result.lines.at(-1);
      if (last && last.label === label && last.rateCents === rateCents && last.date === date && last.kind === kind) last.seconds += seconds;
      else result.lines.push({label, seconds, rateCents, clause, kind, date});
    };
    const p = selectedProfile(item.userId, firstDate);
    const firstIFA=activeFlexibilityAgreement(p,firstDate,item.locationId);
    if(firstIFA){if(rosteredHoursAgreement(p,firstDate,item.locationId,config.employerName))issue('pay-ifa-hours','The recorded signed IFA permits roster-based hours. Standard award rates, daily/weekly limits, penalties and overtime still apply.','5; 13; 20');else issue('pay-ifa-terms','Review this IFA separately. Its employer, working-hours confirmation or varied pay terms are not supported by the standard calculator.','5',true);}
    if(config.sourceId&&config.sourceId!==source.id)issue('pay-source-activation','Review and activate the included award edition before calculating new costs.','15; Schedule A',true);
    if (!p || !item.userId) issue('pay-profile', 'Complete employment details in Users for this shift date.', '12, 15', true);
    if(p?.arrangement==='needs-review')issue('pay-special-arrangement','This employee has a special arrangement. Obtain a separately reviewed calculation; the standard calculator does not interpret it.','7, 15.3–15.4, 20.7',true);
    if(p?.employmentType==='part-time'&&![1,4].includes(p.cycleWeeks||1))issue('pay-part-time-cycle','Review part-time averaging outside a weekly or four-week arrangement.','20.3',true);
    if (p && (!p.payBasis || p.classification === '3' && !p.level3Band)) issue('pay-profile', 'Review the pay arrangement and Level 3 band in Users.', '15.1', true);
    if (p && (firstDate < p.employmentStart || firstDate < p.dateOfBirth)) issue('pay-profile-date', 'Work predates the recorded employment or birth date.', '8, 15', true);
    if (!config.payPeriodAnchor || ![1,2].includes(config.payPeriodWeeks)) issue('pay-period', 'Set the employer’s weekly or fortnightly pay-period anchor.', '16.1', true);
    else if (firstDate < rateEffective(config)) issue('pay-source-date', 'The uploaded rates do not cover this pay period. Load the earlier award edition.', '15; Schedule A', true);
    if (firstDate >= source.reviewBy) issue('pay-source-review', 'Load and review a newer award edition before costing this date.', '15; Schedule A', true);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) issue('pay-period-invalid', 'Complete the shift’s start and finish times.', '13', true);
    const facts = item.awardFacts || {}, recorded = item.breaks || [];
    let breaks = recorded.filter(b => b.endAt).map(b => ({start: Date.parse(b.startAt), end: Date.parse(b.endAt), paid: b.paid === true}));
    const unpaidMinutes = item.breakMinutes || 0;
    if (!breaks.length && unpaidMinutes) {
      let breakStart;
      const plannedMeal=mode==='roster'&&!rosteredHoursAgreement(p,firstDate,item.locationId,config.employerName)?p?.pattern?.[(new Date(firstDate+'T12:00:00Z').getUTCDay()+6)%7]?.mealBreakStart:null;
      const mealBreakStart=facts.mealBreakStart||plannedMeal;
      if (mealBreakStart) {
        let date = firstDate;
        if (mealBreakStart < getParts(start).time) date = M.shiftDate(date, 1);
        try {breakStart = Date.parse(M.instant(date, mealBreakStart));} catch { /* reported below */ }
      }
      if (!Number.isFinite(breakStart)) {
        breakStart = start + ((end - start) - unpaidMinutes * 60000) / 2;
        issue('pay-break-position', mode === 'roster' ? 'Meal-break timing is estimated at the middle of this shift. Set its start in Pay details.' : 'Record the meal-break start in Pay details before approving a calculated cost.', '14', mode !== 'roster');
      }
      breaks = [{start: breakStart, end: breakStart + unpaidMinutes * 60000, paid: false}];
    }
    if (breaks.some(b => b.start < start || b.end > end || b.end <= b.start) || breaks.some((b,i) => breaks.slice(i+1).some(other => b.start < other.end && other.start < b.end))) issue('pay-break-invalid', 'Break times must be within the shift and must not overlap.', '14', true);
    breaks.sort((a,b)=>a.start-b.start);
    const unpaid = breaks.filter(b => !b.paid), paidBreaks = breaks.filter(b => b.paid);
    const paidTotal = Math.max(0, (end-start)/1000 - unpaid.reduce((sum,b) => sum+(b.end-b.start)/1000, 0));
    result.paidSeconds=paidTotal;breakData.set(item.id,{breaks,restCount:facts.restBreaksTaken??paidBreaks.filter(b=>b.end-b.start>=600000).length});
    if ((facts.coldMinutes||0)+(facts.freezerMinutes||0) > paidTotal/60) issue('pay-cold-duration','Cold work minutes cannot exceed paid time or overlap each other.','17.3',true);
    if (p && p.cycleWeeks > 1) issue('pay-averaging', 'Hours are averaged over the configured cycle. Review the completed cycle before payroll.', '9, 11.1, 13.2, 20');
    const afterFinishByDate={};
    let previousDate, windows = [], patternLimit = Infinity, rosteredIFA=false;
    for (let cursor = start; cursor < end && p && Number.isFinite(cursor);) {
      const part = getParts(cursor), date = part.date, minute = M.minutes(part.time), day = new Date(date+'T12:00:00Z').getUTCDay();
      const current = selectedProfile(item.userId, date), effectiveProfile = current || p;
      if (date !== previousDate) {
        previousDate = date;
        if(date!==firstDate)for(const problem of employmentIssues(effectiveProfile,date,item.locationId,config.employerName))issue(({'employment':'pay-profile','employment-date':'pay-profile-date','arrangement':'pay-special-arrangement','averaging':'pay-part-time-cycle','employment-pattern':'pay-pattern','ifa':'pay-ifa-terms','agreed-base':'pay-contract-rate'})[problem.code]||'pay-'+problem.code,'Employment terms for '+date+': '+problem.message,'5; 10–15; 20',true);
        if (date >= source.reviewBy) issue('pay-source-review', 'Load and review a newer award edition before costing this date.', '15; Schedule A', true);
        const calendar = (config.holidayCalendars || []).find(c => c.locationId === item.locationId && c.year === Number(date.slice(0,4)) && c.confirmed);
        if (!calendar) issue('pay-calendar', 'Review this location’s public holiday calendar in Award compliance.', '21, 27', true);
        windows = [];
        rosteredIFA=rosteredHoursAgreement(effectiveProfile,date,item.locationId,config.employerName);
        if (effectiveProfile.employmentType === 'part-time') {
          if(rosteredIFA){
            windows=mode==='roster'?[{startAt:item.startAt,endAt:item.endAt}]:(item.ordinaryWindows||[]).filter(w=>w.locationId===item.locationId);
            patternLimit=Infinity;
            if(!windows.length)issue('pay-ifa-roster','No published roster covers this IFA timesheet. Publish the agreed roster before approving its calculated cost.','5; 13; 20',true);
            if(!result.issues.some(i=>i.code==='pay-ifa-hours'))issue('pay-ifa-hours','The recorded signed IFA permits roster-based hours. Standard award rates, daily/weekly limits, penalties and overtime still apply.','5; 13; 20');
          }else{
          const regular = effectiveProfile.pattern?.[(day+6)%7], variation = facts.variation;
          const agreed = variation?.reference && variation.agreedAt && Date.parse(variation.agreedAt) <= end ? variation : regular;
          if(!effectiveProfile.agreementReference)issue('pay-pattern-reference','Record the written regular working hours agreement reference in Users.','10.3–10.7',true);
          if (!effectiveProfile.pattern) issue('pay-pattern', 'Add the written regular working hours in Users.', '10.3–10.9', true);
          if (agreed) {
            try {const from = M.instant(date, agreed.start), to = M.instant(agreed.overnight ? M.shiftDate(date,1) : date, agreed.end); windows = [{startAt: from, endAt: to}]; patternLimit = (Date.parse(to)-Date.parse(from))/1000-(agreed.breakMinutes||0)*60;} catch {issue('pay-pattern', 'Check the written regular working hours or variation.', '10.3–10.9', true);}
          } else patternLimit = 0;
          // A written overnight pattern belongs to its starting day.
          const previousPattern=effectiveProfile.pattern?.[(day+5)%7];
          if(previousPattern?.overnight){const previousDate=M.shiftDate(date,-1);windows.push({startAt:M.instant(previousDate,previousPattern.start),endAt:M.instant(date,previousPattern.end)});patternLimit=Math.max(patternLimit,(M.minutes(previousPattern.end)+1440-M.minutes(previousPattern.start)-previousPattern.breakMinutes)*60);}
          if(variation?.reference&&date!==firstDate&&variation.overnight&&Date.parse(variation.agreedAt)<=end)windows.push({startAt:M.instant(firstDate,variation.start),endAt:M.instant(M.shiftDate(firstDate,1),variation.end)});
          }
        } else if (effectiveProfile.employmentType === 'full-time' && mode === 'timesheets') {
          windows = (item.ordinaryWindows || []).filter(w=>M.localParts(w.startAt).date<=date&&M.localParts(w.endAt).date>=date);
          if (!item.ordinaryWindows?.length) issue('pay-roster', 'No published ordinary roster covers this full-time timesheet.', '20.2(b)–(c)', true);
        }
      }
      const profile = effectiveProfile, calendar = (config.holidayCalendars || []).find(c => c.locationId === item.locationId && c.year === Number(date.slice(0,4))), holiday = calendar?.dates.some(h => h.date === date && minute >= M.minutes(h.start) && minute < (h.end === '24:00' ? 1440 : M.minutes(h.end))) || false;
      const base = baseRate(profile, date);
      if (base === null || !profile.payBasis) {issue('pay-profile', 'Complete employment details in Users for all dates worked.', '12, 15', true); break;}
      const contractBase = profile.payBasis === 'base-plus-penalties' ? profile.baseRateCents : base;
      if (!Number.isInteger(contractBase) || contractBase < base) issue('pay-contract-rate', 'The agreed base rate is missing or below this employee’s award minimum.', '15', true);
      const appliedBase = Math.max(base, contractBase || base), cycleWeeks = profile.cycleWeeks || 1;
      const cycle = cycleWeeks > 1 && profile.cycleAnchor ? periodStart(date, profile.cycleAnchor, cycleWeeks) : M.monday(date);
      const weekly = getCounter(item.userId+':cycle:'+cycle), daily = getCounter(item.userId+':day:'+date), days = getCounter(item.userId+':week:'+M.monday(date));
      days.dates.add(date);
      const currentBreak = unpaid.find(b => cursor >= b.start && cursor < b.end);
      // Rates change on local clock/holiday/roster boundaries, rather than on
      // every minute. This keeps employer-wide recalculation responsive.
      let next = Math.min(end, (Math.floor(cursor/3600000)+1)*3600000);
      for(const h of calendar?.dates||[])if(h.date===date)for(const edge of [M.minutes(h.start),h.end==='24:00'?1440:M.minutes(h.end)]){
        const delta=(edge-minute)*60000-(cursor%60000);if(delta>0)next=Math.min(next,cursor+delta);
      }
      for (const b of breaks) if (b.start > cursor) next = Math.min(next, b.start); else if (b.end > cursor) next = Math.min(next,b.end);
      if (!currentBreak) {
        let overtime = daily.ordinary >= 39600 || weekly.ordinary >= 136800*cycleWeeks;
        if (profile.employmentType !== 'casual') {
          if (days.dates.size > 5) overtime = true;
          if (profile.employmentType === 'part-time') {
            if (!windows.some(w => cursor >= Date.parse(w.startAt) && cursor < Date.parse(w.endAt)) || daily.ordinary >= patternLimit) overtime = true;
            const weekAgreed = getCounter(item.userId+':part-time:'+M.monday(date));
            if (!rosteredIFA && weekAgreed.ordinary >= profile.agreedWeeklyMinutes*60 && !facts.variation?.reference) overtime = true;
          } else if (mode === 'timesheets' && !windows.some(w => cursor >= Date.parse(w.startAt) && cursor < Date.parse(w.endAt))) overtime = true;
          if (profile.employmentType==='part-time'&&mode==='timesheets'&&item.ordinaryWindows?.length&&!item.ordinaryWindows.some(w=>cursor>=Date.parse(w.startAt)&&cursor<Date.parse(w.endAt))) overtime=true;
        }
        // Split at exact counters and roster edges, including second-precision clocks.
        const remaining=overtime?7200-daily.overtime:Math.min(39600-daily.ordinary,136800*cycleWeeks-weekly.ordinary,profile.employmentType==='part-time'?patternLimit-daily.ordinary:Infinity,profile.employmentType==='part-time'&&!rosteredIFA&&!facts.variation?.reference?profile.agreedWeeklyMinutes*60-getCounter(item.userId+':part-time:'+M.monday(date)).ordinary:Infinity);
        if(remaining>0){const edge=Math.round(cursor+remaining*1000);if(edge>cursor)next=Math.min(next,edge);}
        for(const w of [...windows,...(item.ordinaryWindows||[])])for(const edge of [Date.parse(w.startAt),Date.parse(w.endAt)])if(edge>cursor)next=Math.min(next,edge);
        const seconds=(next-cursor)/1000;
        const percent = overtime ? overtimePercent(profile.employmentType,day,holiday,daily.overtime) : ordinaryPercent(profile.employmentType,profile.classification,day,minute,holiday);
        const rate = roundRate(appliedBase,percent), label = overtime ? 'Overtime '+percent+'%' : holiday ? 'Public holiday '+percent+'%' : day === 6 || day === 0 ? 'Weekend '+percent+'%' : minute < 360 || minute >= 1320 ? 'Evening '+percent+'%' : 'Ordinary '+percent+'%';
        add(label,seconds,rate,overtime?'20.6':'21; Schedule A',overtime?'overtime':'ordinary',date);
        if (overtime) {
          daily.overtime = Math.round((daily.overtime+seconds)*1000)/1000; result.overtimeSeconds += seconds;
          if (windows.length && cursor >= Math.max(...windows.map(w => Date.parse(w.endAt)))){afterFinishByDate[date]=(afterFinishByDate[date]||0)+seconds/60;}
        } else {
          daily.ordinary = Math.round((daily.ordinary+seconds)*1000)/1000; weekly.ordinary = Math.round((weekly.ordinary+seconds)*1000)/1000; const partTimeCounter=getCounter(item.userId+':part-time:'+M.monday(date));partTimeCounter.ordinary=Math.round((partTimeCounter.ordinary+seconds)*1000)/1000;
          result.ordinarySeconds += seconds;
        }
      }
      cursor = next;
    }
    if (p) {
      // Minimum payment is additional paid entitlement, never fabricated time worked.
      const engagement=engagements.get(item.id);
      if(engagement.items.at(-1).id===item.id){
        const ids=new Set(engagement.items.map(i=>i.id)),rows=[...results.filter(r=>ids.has(r.subjectId)),result],workLines=rows.flatMap(r=>r.lines.filter(l=>['ordinary','overtime'].includes(l.kind))),hasOrdinary=rows.some(r=>r.ordinarySeconds>0),hasOvertime=rows.some(r=>r.overtimeSeconds>0),firstProfile=selectedProfile(item.userId,M.localParts(engagement.items[0].startAt).date)||p,minimum=firstProfile.employmentType==='full-time'?0:10800;
        const addTopUp=(seconds,rate,clause,date)=>{if(seconds<=0||!rate)return;result.minimumPaymentSeconds+=seconds;result.lines.push({label:'Minimum payment top-up',seconds,rateCents:rate,clause,kind:'minimum-payment',date,ordinaryForSuper:!hasOvertime});};
        const sunday=new Map();for(const line of workLines)if(line.kind==='overtime'&&new Date(line.date+'T12:00:00Z').getUTCDay()===0){const day=sunday.get(line.date)||{seconds:0,rate:0};day.seconds+=line.seconds;day.rate=Math.max(day.rate,line.rateCents);sunday.set(line.date,day);}
        const recordedAdjacent=engagement.items.some(i=>i.awardFacts?.sundayAdjacentOrdinary===true);
        if(!hasOrdinary&&!recordedAdjacent)for(const [date,day]of sunday)addTopUp(Math.max(0,14400-day.seconds),day.rate,'20.5',date);
        else if(sunday.size&&recordedAdjacent&&!hasOrdinary)issue('pay-sunday-adjacent','Confirm adjacent Sunday work is ordinary time before applying the overtime minimum-payment exception.','20.5');
        addTopUp(Math.max(0,minimum-engagement.paidSeconds-result.minimumPaymentSeconds),Math.max(0,...workLines.map(l=>l.rateCents)),firstProfile.employmentType==='casual'?'11.3':'10.2',firstDate);
        if(result.minimumPaymentSeconds)issue('pay-minimum','Minimum payment has been added once for the continuous engagement without changing time worked. Review allocation when it crosses rate bands.','10.2, 11.3, 20.5');
      }
      if(engagement.items.at(-1).id===item.id){
        const paidTotal=engagement.paidSeconds,start=Date.parse(engagement.items[0].startAt),end=Date.parse(engagement.endAt),breaks=engagement.items.flatMap(i=>breakData.get(i.id)?.breaks||[]).sort((a,b)=>a.start-b.start),unpaid=breaks.filter(b=>!b.paid),paidBreaks=breaks.filter(b=>b.paid);
      const requiredRest = paidTotal >= 32400 && unpaid.length < 2 ? 2 : paidTotal >= 14400 ? 1 : 0;
      const rests=engagement.items.reduce((sum,i)=>sum+(breakData.get(i.id)?.restCount||0),0);
      if (requiredRest && (mode === 'roster' || rests < requiredRest)) issue('pay-rest-breaks', mode==='roster' ? 'Provide '+requiredRest+' paid 10-minute rest break(s); these remain paid time.' : 'Recorded paid rest breaks are below the entitlement. Confirm what was taken.', '14.1');
      if (paidTotal >= 18000 && (unpaid.length < 1 || unpaid.some(b => b.end-b.start < 1800000 || b.end-b.start > 3600000)) || paidTotal >= 32400 && unpaid.length >= 2 && unpaid.some(b => b.end-b.start < 1800000 || b.end-b.start > 3600000)) issue('pay-meal-break', 'Review unpaid meal breaks: each must be 30–60 minutes, with no more than five hours worked without a meal break.', '14.1, 14.5');
      if(requiredRest===2&&mode!=='roster'){const middle=start+(end-start)/2;if(!paidBreaks.some(b=>b.end<=middle&&b.end-b.start>=600000)||!paidBreaks.some(b=>b.start>=middle&&b.end-b.start>=600000))issue('pay-rest-timing','Confirm one paid rest break occurred in each half of this shift.','14.1');}
      const allBreaks = [...breaks].sort((a,b)=>a.start-b.start);
      if (allBreaks.some(b => b.start < start+3600000 || b.end > end-3600000) || allBreaks.some((b,i)=>i && b.start === allBreaks[i-1].end) || [...unpaid.map(b=>b.start),end].some((finish,i)=>finish-(i?unpaid[i-1].end:start)>18000000)) issue('pay-break-timing','Review break timing: no breaks in the first/last hour or joined rest/meal breaks, and no more than five hours without a meal break.','14.5');
      }
      const allowance = (label,cents,clause,date=firstDate) => {if(cents>0) result.lines.push({label,amountCents:Math.round(cents),clause,kind:'allowance',date});};
      const once = (key,action) => {if(!weeklyAllowances.has(key)){weeklyAllowances.add(key);action();}};
      const week = M.monday(firstDate), calendar = (config.holidayCalendars||[]).find(c=>c.locationId===item.locationId&&c.year===Number(firstDate.slice(0,4)));
      if (calendar?.brokenHill) once(item.userId+':broken:'+week,()=>allowance('Broken Hill weekly allowance',4790,'17.2'));
      if (p.laundersUniform) {
        if (p.employmentType==='full-time') once(item.userId+':laundry:'+week,()=>allowance('Uniform laundry — weekly',642,'17.5(b)(i)'));
        else once(item.userId+':laundry-shift:'+engagement.items[0].id,()=>allowance('Uniform laundry — shift',128,'17.5(b)(ii)'));
      }
      allowance('Cold work',(facts.coldMinutes||0)*38/60,'17.3(a)');
      allowance('Cold work below 0°C',(facts.freezerMinutes||0)*97/60,'17.3(b)');
      allowance('Own vehicle — delivery',(facts.deliveryKm||0)*53,'17.8(a)');
      allowance('Own vehicle — other duties',(facts.otherKm||0)*100,'17.8(b)');
      if ((facts.mealOvertimeMinutes||0)>result.overtimeSeconds/60) issue('pay-meal-duration','Eligible overtime meal minutes cannot exceed overtime worked.','17.4',true);
      result.mealMinutesByDate=facts.mealEligible?(facts.mealOvertimeMinutes?{[firstDate]:facts.mealOvertimeMinutes}:afterFinishByDate):{};
      if(engagement.items.at(-1).id===item.id){
        const ids=new Set(engagement.items.map(i=>i.id)),rows=[...results.filter(r=>ids.has(r.subjectId)),result],dailyMeals={};
        if(rows.reduce((sum,r)=>sum+r.overtimeSeconds,0)>3600&&rows.some(r=>r.overtimeSeconds>0&&!engagement.items.find(i=>i.id===r.subjectId)?.awardFacts?.mealConditionsReviewed))issue('pay-meal-allowance','Confirm overtime meal eligibility, notice and whether a meal was supplied in Timesheets → Pay details.','17.4');
        for(const row of rows)for(const [date,minutes]of Object.entries(row.mealMinutesByDate||{}))dailyMeals[date]=(dailyMeals[date]||0)+minutes;
        for(const [date,minutes]of Object.entries(dailyMeals))if(minutes>60){
          const supplied=engagement.items.some(i=>i.awardFacts?.mealSupplied);
          if(!supplied)allowance('Overtime meal',1733,'17.4(a)',date);
          if(minutes>240)allowance('Further overtime meal',1566,'17.4(b)',date);
        }
      }
      for(const leg of [{minutes:facts.travelMinutes,startAt:facts.travelStartAt},{minutes:facts.returnTravelMinutes,startAt:facts.returnTravelStartAt}])if(leg.minutes){
        const travelStart=Date.parse(leg.startAt),finish=travelStart+leg.minutes*60000;
        if(!Number.isFinite(travelStart)){issue('pay-travel-time','Record when extra travel occurred so Sunday and public holiday rates can be applied.','17.6',true);continue;}
        let numerator=0;
        for(let cursor=travelStart;cursor<finish;){const part=getParts(cursor),day=new Date(part.date+'T12:00:00Z').getUTCDay(),minute=M.minutes(part.time),calendar=(config.holidayCalendars||[]).find(c=>c.locationId===item.locationId&&c.year===Number(part.date.slice(0,4))&&c.confirmed),holiday=calendar?.dates.some(h=>h.date===part.date&&minute>=M.minutes(h.start)&&minute<(h.end==='24:00'?1440:M.minutes(h.end)));if(!calendar)issue('pay-calendar','Review the public holiday calendar for all extra travelling dates.','17.6, 27',true);const next=Math.min(finish,(Math.floor(cursor/60000)+1)*60000);numerator+=(next-cursor)*roundRate(baseRate(selectedProfile(item.userId,part.date)||p,part.date),day===0||holiday?150:100);cursor=next;}
        allowance('Extra travelling time',Math.floor((numerator+1800000)/3600000),'17.6(c)');
      }
      allowance('Reimbursement · '+(facts.reimbursementReason||''),facts.reimbursementCents||0,'17.5–17.10');
    }
    for (const line of result.lines) {
      if (line.kind==='allowance') result.allowanceCents += line.amountCents;
      else {line.amountCents = Math.floor((Math.round(line.seconds*1000)*line.rateCents+1800000)/3600000); result.wageCents += line.amountCents;}
    }
    const ordinaryWageCents=result.lines.filter(line=>line.kind==='ordinary'||line.kind==='minimum-payment'&&line.ordinaryForSuper).reduce((sum,line)=>sum+line.amountCents,0);
    if (config.superBps !== null && config.superBps !== undefined && p?.superEligible !== null && p?.superEligible !== undefined) result.superEstimateCents = p.superEligible ? Math.round(ordinaryWageCents*config.superBps/10000) : 0;
    result.oncostEstimateCents = Math.round((result.wageCents+result.allowanceCents)*(config.oncostBps||0)/10000);
    if (result.complete) result.costCents = result.wageCents+result.allowanceCents;
    if (result.costCents !== null && result.superEstimateCents !== null) result.employerEstimateCents = result.costCents+result.superEstimateCents+result.oncostEstimateCents;
    result.profileId = p?.id || null;
    result.fingerprint = crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex');
    results.push(result);
  }
  // Unknown work in the same employer cycle can change overtime/minimum pay.
  // Do not approve a seemingly complete row while its context is incomplete.
  const badByUser=new Map(),itemById=new Map(items.map(i=>[i.id,i]));
  for(const row of results)if(!row.complete){if(!badByUser.has(row.userId))badByUser.set(row.userId,[]);badByUser.get(row.userId).push(row);}
  for(const row of results){
    const item=itemById.get(row.subjectId),date=getParts(Date.parse(item.startAt)).date,p=selectedProfile(row.userId,date),weeks=p?.cycleWeeks||1,from=weeks>1&&p?.cycleAnchor?periodStart(date,p.cycleAnchor,weeks):M.monday(date),until=M.shiftDate(from,7*weeks),groupIds=new Set(engagements.get(item.id).items.map(i=>i.id));
    if(row.complete&&(badByUser.get(row.userId)||[]).some(other=>{const otherDate=getParts(Date.parse(itemById.get(other.subjectId).startAt)).date;return otherDate>=from&&otherDate<until||groupIds.has(other.subjectId);})){row.complete=false;row.costCents=null;row.employerEstimateCents=null;row.issues.push({subjectId:row.subjectId,userId:row.userId,code:'pay-incomplete-context',message:'Complete this employee’s other work details in the same cycle or continuous engagement before relying on overtime and minimum payments.',clause:'10, 11, 13, 20',versionId:source.id,blocking:true});}
    row.fingerprint=crypto.createHash('sha256').update(JSON.stringify({...row,fingerprint:undefined})).digest('hex');
  }
  return {enabled:true, source, results, coverage, exclusions};
}
function facts(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Enter valid pay details.');
  const result = {};
  for (const key of ['coldMinutes','freezerMinutes','travelMinutes','returnTravelMinutes','mealOvertimeMinutes','restBreaksTaken','deliveryKm','otherKm','reimbursementCents']) {
    if (input[key] === undefined) continue;
    const max = key === 'reimbursementCents' ? 100000000 : key === 'restBreaksTaken' ? 20 : 1440;
    if (!Number.isFinite(input[key]) || input[key] < 0 || input[key] > max || ['restBreaksTaken','reimbursementCents'].includes(key) && !Number.isInteger(input[key])) throw invalid('Enter a valid '+key+'.');
    result[key] = input[key];
  }
  for (const key of ['mealConditionsReviewed','mealEligible','mealSupplied','sundayAdjacentOrdinary']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') throw invalid('Choose a valid pay condition.');
    if (input[key] !== undefined) result[key] = input[key];
  }
  if (input.mealBreakStart) {M.minutes(input.mealBreakStart);result.mealBreakStart=input.mealBreakStart;}
  for(const key of ['travelStartAt','returnTravelStartAt'])if(input[key]){if(typeof input[key]!=='string'||!Number.isFinite(Date.parse(input[key])))throw invalid('Enter a valid extra travel start.');result[key]=new Date(input[key]).toISOString();}
  if (input.reimbursementCents) {
    if (typeof input.reimbursementReason !== 'string' || input.reimbursementReason.trim().length < 3 || input.reimbursementReason.length > 300) throw invalid('Describe the reimbursement.');
    result.reimbursementReason=input.reimbursementReason.trim();
  }
  if (input.variation) {
    const v=input.variation; M.minutes(v.start);M.minutes(v.end);
    if (typeof v.reference !== 'string' || v.reference.trim().length < 8 || v.reference.length > 500 || !Number.isFinite(Date.parse(v.agreedAt)) || !Number.isInteger(v.breakMinutes) || v.breakMinutes < 0 || v.breakMinutes > 180 || typeof v.overnight !== 'boolean') throw invalid('Record the written variation reference, agreement time and agreed hours.');
    result.variation={start:v.start,end:v.end,overnight:v.overnight,breakMinutes:v.breakMinutes,reference:v.reference.trim(),agreedAt:new Date(v.agreedAt).toISOString()};
  }
  return result;
}
module.exports = {source, coverage, exclusions, calculate, hourlyRates, employmentIssues, baseRate, roundRate, periodStart, rateEffective, ordinaryPercent, overtimePercent, facts};
