// Workforce screens: the roster week and its publication, the clock, timesheets
// and pay evidence, availability, leave and the employer/employment setup.
const {esc,money,number,layout,locationPicker,needsLocation,hero,csrf}=require('./ui');

const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const shortDate=date=>date?new Date(date+'T00:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}):'';
const duration=seconds=>`${Math.floor(seconds/3600)}h ${String(Math.round(seconds%3600/60)).padStart(2,'0')}m`;

function workforce({account,location,locations,week,timesheetWeek,pay,availability,leave,people,employer,estimate,notice}){
 if(!location)return needsLocation({account});
 const rows=week.rows||[];
 const costOf=shift=>shift.costCents!==undefined?shift.costCents:(estimate?.byShift?.[shift.id]??null);
 const shiftRow=shift=>`<li><span><strong>${esc(shift.name)}</strong> · ${esc(shift.start)}–${esc(shift.end)}${shift.overnight?' (+1)':''}
   ${shift.position?`<span class="muted small"> · ${esc(shift.position)}</span>`:''}
   ${shift.publicationId?'<span class="pill pill-ok">published</span>':'<span class="pill">draft</span>'}
   ${week.canSeeCosts&&costOf(shift)!==null&&costOf(shift)!==undefined?`<span class="muted small"> · ${money(costOf(shift))}</span>`:''}</span>
  ${week.canManage&&!shift.publicationId?`<form method="post" action="/workforce/shift/delete"><input type="hidden" name="_csrf" value="${esc(account.csrf)}"><input type="hidden" name="shiftId" value="${esc(shift.id)}"><button class="button button-quiet button-small" type="submit">Remove</button></form>`:''}</li>`;
 const dayBlocks=dayNames.map((name,index)=>{
  const day=week.days?.[index];
  const shifts=day?day.shifts:[];
  return `<article class="card"><h2>${name} ${esc(shortDate(day?.date))}</h2>${shifts.length?`<ul class="plain-list">${shifts.map(shiftRow).join('')}</ul>`:'<p class="muted small">No shifts.</p>'}</article>`;
 }).join('');
 const publication=week.publication;
 const publishBlock=week.canManage?`<section class="card"><h2>Week of ${esc(shortDate(week.weekStart))}</h2>
   ${publication?`<p class="small">Published ${esc(publication.publishedAt.slice(0,10))} by ${esc(publication.publishedByName||'')}${week.canSeeCosts?` · rostered cost ${money(publication.totalCents)}`:''}</p>
    <form method="post" action="/workforce/unpublish">${csrf(account)}<input type="hidden" name="publicationId" value="${esc(publication.id)}"><button class="button button-quiet" type="submit">Withdraw publication</button></form>`:
    `<p class="small">${week.estimate&&week.estimate.totalCents!==null?`Draft cost ${money(week.estimate.totalCents)} · `:''}Publishing freezes every shift's cost and planned breaks.</p>
     <form method="post" action="/workforce/publish">${csrf(account)}
      <input type="hidden" name="companyId" value="${esc(location.companyId)}">
      <input type="hidden" name="locationId" value="${esc(location.id)}">
      <input type="hidden" name="weekStart" value="${esc(week.weekStart)}">
      <button class="button" type="submit">Publish week</button>
     </form>`}
  </section>`:'';
 const addShift=week.canManage?`<form method="post" action="/workforce/shift" class="card">
   <h2>Add a shift</h2>
   ${csrf(account)}
   <input type="hidden" name="companyId" value="${esc(location.companyId)}">
   <input type="hidden" name="locationId" value="${esc(location.id)}">
   <input type="hidden" name="weekStart" value="${esc(week.weekStart)}">
   <div class="grid">
    <label class="field"><span>Staff</span><select name="accountId">${people.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Date</span><input type="date" name="date" value="${esc(week.weekStart)}" required></label>
    <label class="field"><span>Start</span><input name="start" placeholder="09:00" pattern="[0-2][0-9]:[0-5][0-9]" required></label>
    <label class="field"><span>Finish</span><input name="end" placeholder="17:00" pattern="[0-2][0-9]:[0-5][0-9]" required></label>
    <label class="field"><span>Position</span><input name="position" maxlength="60" placeholder="Counter"></label>
    <label class="check"><input type="checkbox" name="overnight" value="1"> <span>Ends the next day</span></label>
   </div>
   <div class="actions"><button class="button" type="submit">Save shift</button></div>
  </form>`:'';
 const clock=timesheetWeek?.clock||week.clock||null;
 const clockBlock=`<section class="card"><h2>Shift clock</h2>
   <p class="small">${clock?.clockedIn?`Clocked in${clock.onBreak?' · on a break':''} since ${esc((clock.since||'').slice(11,16))}`:'Not clocked in at this location.'}</p>
   <div class="actions">
    ${clock?.clockedIn?`${clock.onBreak?`<form method="post" action="/workforce/clock">${csrf(account)}<input type="hidden" name="companyId" value="${esc(location.companyId)}"><input type="hidden" name="locationId" value="${esc(location.id)}"><input type="hidden" name="kind" value="break-end"><button class="button" type="submit">End break</button></form>`:`<form method="post" action="/workforce/clock">${csrf(account)}<input type="hidden" name="companyId" value="${esc(location.companyId)}"><input type="hidden" name="locationId" value="${esc(location.id)}"><input type="hidden" name="kind" value="break-start"><button class="button button-quiet" type="submit">Start break</button></form>`}
     <form method="post" action="/workforce/clock">${csrf(account)}<input type="hidden" name="companyId" value="${esc(location.companyId)}"><input type="hidden" name="locationId" value="${esc(location.id)}"><input type="hidden" name="kind" value="out"><button class="button" type="submit">Clock out</button></form>`:
     `<form method="post" action="/workforce/clock">${csrf(account)}<input type="hidden" name="companyId" value="${esc(location.companyId)}"><input type="hidden" name="locationId" value="${esc(location.id)}"><input type="hidden" name="kind" value="in"><button class="button" type="submit">Clock in</button></form>`}
   </div>
  </section>`;
 const timesheetRows=(timesheetWeek?.rows||[]).map(row=>{
  const frozen=row.frozen;
  return `<tr><td>${esc(row.name||'Staff')}</td><td>${row.entries.length}</td><td>${duration(row.paidSeconds)}</td>
   <td>${frozen&&timesheetWeek.wageVisible?`${money(frozen.payCents)}<br><span class="muted small">cost ${money(frozen.costCents)}</span>`:timesheetWeek.approved?'approved':'open'}</td></tr>`;
 }).join('');
 const timesheetBlock=`<section class="card"><h2>Timesheets · week of ${esc(shortDate(timesheetWeek?.weekStart||week.weekStart))}</h2>
   <table class="table"><thead><tr><th>Staff</th><th>Entries</th><th>Paid</th><th>Approved pay</th></tr></thead><tbody>${timesheetRows||'<tr><td colspan="4" class="muted">No completed work this week.</td></tr>'}</tbody></table>
   ${timesheetWeek?.approved?`<p class="small">Approved ${esc(timesheetWeek.approved.approvedAt.slice(0,10))} by ${esc(timesheetWeek.approved.approvedByName||'')}${timesheetWeek.wageVisible?` · pay ${money(timesheetWeek.approved.payCents)} · cost ${money(timesheetWeek.approved.costCents)}`:''}. This snapshot will not change if a rate changes later.</p>`:
    timesheetWeek?.canApprove?`<form method="post" action="/workforce/timesheet/approve">${csrf(account)}
     <input type="hidden" name="companyId" value="${esc(location.companyId)}">
     <input type="hidden" name="locationId" value="${esc(location.id)}">
     <input type="hidden" name="weekStart" value="${esc(timesheetWeek.weekStart)}">
     <button class="button" type="submit">Approve timesheets</button>
    </form>`:''}
  </section>`;
 const availabilityBlock=`<details class="card"><summary><h2>Availability</h2></summary>
   <ul class="plain-list">${(availability||[]).length?availability.map(slot=>`<li><span>${esc(slot.name||'')} ${esc(dayNames[slot.weekday])}</span><span>${slot.available?`${esc(slot.start)}–${esc(slot.end)}`:'Unavailable'}</span></li>`).join(''):'<li class="muted">Nothing recorded.</li>'}</ul>
   <form method="post" action="/workforce/availability" class="stack">${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <label class="field"><span>Day</span><select name="weekday">${dayNames.map((name,index)=>`<option value="${index}">${name}</option>`).join('')}</select></label>
    <label class="field"><span>From</span><input name="start" placeholder="09:00"></label>
    <label class="field"><span>To</span><input name="end" placeholder="17:00"></label>
    <div class="actions"><button class="button" type="submit">Save availability</button></div>
   </form>
  </details>`;
 const leaveBlock=`<details class="card"><summary><h2>Leave</h2></summary>
   <ul class="plain-list">${(leave||[]).length?leave.map(request=>`<li><span>${esc(request.name)} · ${esc(request.type)}<br><span class="muted small">${esc(request.startDate)} → ${esc(request.endDate)}</span></span>
     <span>${esc(request.status)}${request.status==='pending'&&leave.length?`<form method="post" action="/workforce/leave/decide" class="inline">${csrf(account)}<input type="hidden" name="id" value="${esc(request.id)}"><input type="hidden" name="decision" value="approve"><button class="button button-small" type="submit">Approve</button></form>`:''}</span></li>`).join(''):'<li class="muted">No requests.</li>'}</ul>
   <form method="post" action="/workforce/leave" class="stack">${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <label class="field"><span>From</span><input type="date" name="startDate" required></label>
    <label class="field"><span>To</span><input type="date" name="endDate" required></label>
    <label class="field"><span>Type</span><select name="type"><option value="annual">Annual</option><option value="personal">Personal</option><option value="unpaid">Unpaid</option></select></label>
    <div class="actions"><button class="button" type="submit">Request leave</button></div>
   </form>
  </details>`;
 const award=week.canAward?`<details class="card"><summary><h2>Employer and pay setup</h2></summary>
   <p class="small">${employer?.localPayEnabled?`Calculations are on for ${esc(employer.employerName)} · super estimate ${number((employer.superBps||0)/100)}% · pay period ${esc(employer.payPeriodWeeks)} week(s) from ${esc(employer.payPeriodAnchor)}`:'Native award calculations are off for this location, so a week cannot be published or approved.'}</p>
   <form method="post" action="/workforce/employer" class="stack">${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <label class="field"><span>Employer name</span><input name="employerName" value="${esc(employer?.employerName||'')}" maxlength="200"></label>
    <label class="field"><span>Public holiday state</span><select name="publicHolidayState">${['VIC','NSW','QLD','SA','WA','TAS','NT','ACT'].map(state=>`<option value="${state}"${location.publicHolidayState===state?' selected':''}>${state}</option>`).join('')}</select></label>
    <label class="field"><span>Pay period starts</span><input type="date" name="payPeriodAnchor" value="${esc(employer?.payPeriodAnchor||week.weekStart)}"></label>
    <label class="field"><span>Super estimate (%)</span><input name="superBps" inputmode="decimal" value="${employer?number((employer.superBps||0)/100):'12'}"></label>
    <label class="check"><input type="checkbox" name="coverageConfirmed" value="1"${employer?.coverageConfirmed?' checked':''}> <span>I have reviewed MA000003 coverage and this location's public holidays</span></label>
    <div class="actions"><button class="button" type="submit">Save employer setup</button></div>
   </form>
   <form method="post" action="/workforce/terms" class="stack">${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <label class="field"><span>Staff</span><select name="accountId">${people.map(person=>`<option value="${esc(person.id)}">${esc(person.name)}</option>`).join('')}</select></label>
    <label class="field"><span>Terms from</span><input type="date" name="effectiveFrom" value="${esc(week.weekStart)}" required></label>
    <label class="field"><span>Birth date</span><input type="date" name="dateOfBirth" required></label>
    <label class="field"><span>Employment start</span><input type="date" name="employmentStart" required></label>
    <label class="field"><span>Employment type</span><select name="employmentType"><option value="full-time">Full time</option><option value="part-time">Part time</option><option value="casual">Casual</option></select></label>
    <label class="field"><span>Classification</span><select name="classification"><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></label>
    <div class="actions"><button class="button" type="submit">Save employment terms</button></div>
   </form>
  </details>`:'';
 const payBlock=pay?`<details class="card"><summary><h2>Pay evidence</h2></summary>
   <ul class="plain-list">${pay.timesheets.map(record=>`<li><span>Approved week of ${esc(shortDate(record.weekStart))}</span><span>${money(record.costCents)}</span></li>`).join('')}${pay.publications.map(record=>`<li><span>Published week of ${esc(shortDate(record.weekStart))}</span><span>${money(record.totalCents)}</span></li>`).join('')||'<li class="muted">No published weeks yet.</li>'}</ul>
  </details>`:'';
 return layout({account,title:'Workforce',active:'/workforce',notice,body:`${hero({eyebrow:'Workforce · '+location.name,title:'Roster and pay',text:'Publish a week to freeze its cost, and approve a timesheet to freeze what was actually worked.'})}
  ${locationPicker({locations,selected:location,action:'/workforce'})}
  <form method="get" action="/workforce" class="picker">
   <input type="hidden" name="locationId" value="${esc(location.id)}">
   <label class="field"><span>Week starting</span><input type="date" name="week" value="${esc(week.weekStart)}"></label>
   <button class="button button-quiet" type="submit">Open</button>
  </form>
  ${publishBlock}
  <section class="grid">${dayBlocks}</section>
  ${addShift}
  ${clockBlock}
  ${timesheetBlock}
  <section class="grid">${availabilityBlock}${leaveBlock}</section>
  ${award}
  ${payBlock}`});
}

module.exports={workforce,dayNames,shortDate,duration};
