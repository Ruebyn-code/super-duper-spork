'use strict';
const M=require('./public/rostering-model');
const source={id:'NES-4w-SG12-2025-v1',annualLeaveWeeks:4,accrualDenominator:13,superBps:1200,effectiveFrom:'2025-07-01',reviewBy:'2027-07-01',leaveUrl:'https://www.fairwork.gov.au/leave/annual-leave',superUrl:'https://www.ato.gov.au/businesses-and-organisations/super-for-employers'};
const leavePolicy={id:'NES-annual-four-weeks-v1',denominator:13};
const round=n=>Math.round(n),permanent=type=>['full-time','part-time'].includes(type);
// Planning provisions and frozen accrual evidence. Never contribution payments or clock events.
function apply(results,config){
 const weeks=new Map(),leaveWeeks=new Map();
 for(const r of results)for(const s of r.benefitSegments||[]){const key=r.userId+':'+M.monday(s.date);weeks.set(key,(weeks.get(key)||0)+s.seconds);if(s.ordinary&&permanent(s.employmentType)){const v=leaveWeeks.get(key)||{minimum:0,weekend:0};v.minimum+=s.seconds*s.minimumBaseCents;v.weekend+=s.seconds*s.minimumBaseCents*s.weekendExtraPercent/100;leaveWeeks.set(key,v);}}
 for(const r of results){
  const segments=r.benefitSegments||[],problems=[],leaveProblems=[],accrualSlices=[];let ote=0,superNumerator=0,leaveNumerator=0,leaveMs=0;const rates=new Set(),eligibilities=new Set(),eligibleByDate=new Map();
  for(const s of segments){
   const key=r.userId+':'+M.monday(s.date),eligible=s.superEligible==null?s.adult||weeks.get(key)>108000:s.superEligible,rate=config.superBps==null?source.superBps:config.superBps;rates.add(rate);eligibilities.add(eligible);eligibleByDate.set(s.date,eligible);
   if(s.date<source.effectiveFrom||s.date>=source.reviewBy)problems.push('The benefits rules need updating for this work date.');
   if(s.ordinary){
    if(permanent(s.employmentType)){const w=leaveWeeks.get(key),loading=w?.minimum?Math.max(.175,w.weekend/w.minimum):.175;leaveNumerator+=s.seconds*(s.appliedBaseCents+s.minimumBaseCents*loading)/3600;leaveMs+=round(s.seconds*1000);accrualSlices.push({date:s.date,startAt:s.startAt,endAt:s.endAt,ordinaryMilliseconds:round(s.seconds*1000)});}
   }
  }
  for(const line of r.lines.filter(l=>l.kind==='ordinary')){if(eligibleByDate.get(line.date)===true){ote+=line.amountCents;superNumerator+=line.amountCents*(config.superBps==null?source.superBps:config.superBps)/10000;}}
  // These expense/reimbursement allowances are not ordinary earnings. Cold-work
  // allowances are ordinary earnings when all recorded work is ordinary; mixed
  // ordinary/overtime cold work needs a recorded allocation rather than a guess.
  const cold=r.lines.filter(l=>l.kind==='allowance'&&l.clause.startsWith('17.3')).reduce((n,l)=>n+l.amountCents,0),regional=r.lines.filter(l=>l.kind==='allowance'&&l.clause==='17.2').reduce((n,l)=>n+l.amountCents,0),travel=r.lines.some(l=>l.kind==='allowance'&&l.label==='Extra travelling time'&&l.amountCents);
  if(eligibilities.has(true)&&(cold&&r.overtimeSeconds>0||travel))problems.push('Super on mixed overtime cold work or extra travelling time needs a separate ordinary-earnings allocation.');
  if((cold||regional)&&eligibilities.size>1)problems.push('Super on allowances needs an allocation across this eligibility change.');const eligibleAllowance=(r.overtimeSeconds?0:cold)+regional;if(eligibleAllowance&&eligibilities.size===1&&eligibilities.has(true)&&rates.size===1){ote+=eligibleAllowance;superNumerator+=eligibleAllowance*[...rates][0]/10000;}
  if(r.minimumPaymentSeconds){const extra=r.lines.filter(l=>l.kind==='minimum-payment'&&l.ordinaryForSuper).reduce((n,l)=>n+l.amountCents,0);if(extra&&eligibilities.size>1)problems.push('Super on a minimum payment needs an allocation across this eligibility change.');if(eligibilities.size===1&&eligibilities.has(true)&&rates.size===1){ote+=extra;superNumerator+=extra*[...rates][0]/10000;}if(segments.some(s=>permanent(s.employmentType)))leaveProblems.push('Annual-leave accrual on minimum-payment top-ups needs ordinary-hours confirmation.');}
  const supported=r.complete&&segments.length>0,dateValid=segments.every(s=>s.date>=source.effectiveFrom&&s.date<source.reviewBy),leaveComplete=supported&&dateValid&&!leaveProblems.length,superComplete=supported&&!problems.length,complete=leaveComplete&&superComplete;
  r.benefits={sourceId:source.id,complete,issues:[...new Set([...problems,...leaveProblems])],annualLeave:{policyId:leavePolicy.id,complete:leaveComplete,denominator:13,numeratorMilliseconds:leaveComplete?leaveMs:null,earnedHours:leaveComplete?leaveMs/46800000:null,provisionCents:leaveComplete?round(leaveNumerator/13):null,slices:leaveComplete?accrualSlices:[]},super:{complete:superComplete,rateBps:rates.size===1?[...rates][0]:null,rateMode:config.superBps==null?'automatic':'custom',ordinaryEarningsCents:superComplete?round(ote):null,weeklyHoursBasis:'recorded employer work',uncapped:true}};
  r.superEstimateCents=superComplete?round(superNumerator):null;r.annualLeaveEstimateCents=r.benefits.annualLeave.provisionCents;
  r.employerEstimateCents=r.costCents!=null&&r.superEstimateCents!=null&&r.annualLeaveEstimateCents!=null?r.costCents+r.superEstimateCents+r.annualLeaveEstimateCents+r.oncostEstimateCents:null;
  delete r.benefitSegments;
 }
 return results;
}
module.exports={source,leavePolicy,permanent,apply};
