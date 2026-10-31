'use strict';
const M=require('./public/rostering-model'),cards=require('./public/timesheet-card-model');
const fail=message=>{throw Object.assign(Error(message),{status:400});};
const effectiveBreaks=entry=>entry.breaksOverride??(entry.override?[]:entry.breaks||[]);
function validateBreaks(value,period){
 if(!Array.isArray(value)||value.length>24)fail('Enter up to 24 actual breaks.');
 const start=Date.parse(period.startAt),end=Date.parse(period.endAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)fail('Complete the timesheet before editing actual breaks.');
 const rows=value.map(b=>{if(!b||typeof b!=='object'||typeof b.paid!=='boolean'||typeof b.startAt!=='string'||typeof b.endAt!=='string')fail('Choose paid rest or unpaid meal and enter both break times.');const from=Date.parse(b.startAt),to=Date.parse(b.endAt);if(!Number.isFinite(from)||!Number.isFinite(to)||from<start||to>end||to<=from)fail('Breaks must finish after they start and stay within the recorded shift.');return{startAt:new Date(from).toISOString(),endAt:new Date(to).toISOString(),paid:b.paid};}).sort((a,b)=>a.startAt.localeCompare(b.startAt));
 if(rows.some((b,i)=>i&&Date.parse(rows[i-1].endAt)>Date.parse(b.startAt)))fail('Actual breaks cannot overlap.');
 const unpaid=rows.filter(b=>!b.paid).reduce((n,b)=>n+Date.parse(b.endAt)-Date.parse(b.startAt),0);if(unpaid>=end-start)fail('Unpaid breaks must be shorter than the recorded shift.');return rows;
}
function publishedCost(shift){if(shift.paySnapshot)return Number.isSafeInteger(shift.paySnapshot.costCents)?shift.paySnapshot.costCents:null;return M.cost(M.interval(shift).paidSeconds,shift.rateCents??null);}
function referenceView(reference,id){return{id:reference.id||id,startAt:reference.startAt,endAt:reference.endAt,paidSeconds:reference.paidSeconds,position:reference.position||'',positionColor:reference.positionColor||null,basis:reference.basis||'Published roster'};}
function decorate({entries,published,weekStart,actor,money,review,now,publicBreakPlan,recordableUserIds=[]}){
 const visible=entries.filter(e=>M.monday(M.localParts(e.startAt).date)===weekStart&&(review||e.userId===actor.id)),records=visible.map(e=>{const value={...e},ref=cards.reference(e,published,entries);if(ref){value.rosterReference=referenceView(ref,e.shiftId);if(money){const linked=published.find(s=>s.id===(ref.id||e.shiftId)&&s.userId===e.userId),same=linked&&M.interval(linked).startAt===ref.startAt&&M.interval(linked).endAt===ref.endAt&&M.interval(linked).paidSeconds===ref.paidSeconds;value.rosteredCostCents=Object.hasOwn(e,'scheduledCostCents')?e.scheduledCostCents:linked&&(!e.scheduledStartAt||same)?publishedCost(linked):null;value.costVarianceCents=e.endAt&&Number.isSafeInteger(e.costCents)&&Number.isSafeInteger(value.rosteredCostCents)?e.costCents-value.rosteredCostCents:null;}}delete value.scheduledCostCents;return value;});
 const linked=new Set(entries.filter(e=>e.status!=='rejected'&&e.shiftId).map(e=>e.shiftId));for(const e of entries.filter(e=>e.status!=='rejected'&&!e.shiftId)){const r=cards.reference(e,published,entries);if(r?.id)linked.add(r.id);}
 const scheduled=published.filter(s=>s.userId&&M.monday(s.date)===weekStart&&(review||s.userId===actor.id)&&!linked.has(s.id)).map(s=>({id:'scheduled:'+s.id,shiftId:s.id,userId:s.userId,username:s.username,date:s.date,status:'scheduled',source:'roster',rosterReference:referenceView({...s,...M.interval(s)},s.id),breakMinutes:s.breakMinutes,breakPlan:s.breakPlan?publicBreakPlan(s.breakPlan):null,canRecord:review&&recordableUserIds.includes(s.userId)&&Date.parse(M.interval(s).endAt)<=now,...(money?{rosteredCostCents:publishedCost(s)}:{})}));
 return{records:records.sort((a,b)=>b.startAt.localeCompare(a.startAt)),scheduled};
}
module.exports={effectiveBreaks,validateBreaks,publishedCost,decorate};
