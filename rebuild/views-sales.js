// Sales screens: the weekly entry sheet, the weekly-report import, hourly
// sales, operating expenses, the budget and the current forecast.
const {esc,money,number,layout,locationPicker,needsLocation,hero,csrf}=require('./ui');

const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const shortDate=date=>date?new Date(date+'T00:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'}):'';

function sales({account,location,locations,weekStart,weeks,record,projection,hourly,report,budget,notice}){
 if(!location)return needsLocation({account});
 const dayRow=(value,index)=>{
  const date=new Date(Date.parse(weekStart+'T00:00:00Z')+index*86400000).toISOString().slice(0,10);
  const source=record.sources?.[index]||null;
  return `<label class="field"><span>${dayNames[index]} ${esc(shortDate(date))}${source?` <em class="muted small">${esc(source==='weekly-report'?'report':'daily')}</em>`:''}</span>
   <input name="day${index}" inputmode="decimal" autocomplete="off" value="${value===null||value===undefined?'':(value/100).toFixed(2)}" placeholder="—"></label>`;
 };
 const rows=weeks.length?weeks.map(week=>`<li><a href="/sales?locationId=${esc(location.id)}&week=${esc(week.weekStart)}">Week of ${esc(shortDate(week.weekStart))}</a>
   <span class="muted small">${week.days.filter(value=>value!==null).length}/7 days${week.imported?' · imported':''}</span></li>`).join(''):'<li class="muted">No weeks saved yet.</li>';
 const projectionBlock=projection?`<article class="card"><h2>This week's forecast</h2>
   <p class="metric">${projection.projectedSalesCents===null?'Usage needed':money(projection.projectedSalesCents)}</p>
   <p class="muted small">${projection.weeksRecorded}/4 completed weeks counted. Budget ${money(projection.budgetCents)} at ${projection.budgetPercent}%.</p>
   <ul class="plain-list">${projection.dailyProjections.map((day,index)=>`<li><span>${dayNames[index]} ${esc(shortDate(day.date))}</span><span>${day.amountCents===null?'—':money(day.amountCents)}</span></li>`).join('')}</ul>
   ${report?`<p class="small">Recorded ${report.recordedDays}/7 days · sales ${money(report.salesCents)} · costs ${money(report.costCents)} · profit ${report.profitCents===null?'unknown':money(report.profitCents)}${report.marginPct===null?'':' · '+report.marginPct+'%'}</p>`:''}
  </article>`:'';
 const hourlyBlock=hourly?`<article class="card"><h2>Hourly sales · ${esc(shortDate(hourly.date))}</h2>
   <p class="small">${hourly.forecast.projectedSalesCents===null?'No forecast available':`Forecast ${money(hourly.forecast.projectedSalesCents)} · ${esc(hourly.forecast.method)}`}${hourly.forecast.reason?' · '+esc(hourly.forecast.reason):''}</p>
   <form method="post" action="/sales/hourly" class="stack">
    ${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <input type="hidden" name="date" value="${esc(hourly.date)}">
    <input type="hidden" name="revision" value="${esc(hourly.revision)}">
    <div class="hour-grid">${hourly.hours.map((value,index)=>`<label class="field"><span>${String(index).padStart(2,'0')}</span><input name="hour${index}" inputmode="decimal" autocomplete="off" value="${value===null?'':(value/100).toFixed(2)}" placeholder="—"></label>`).join('')}</div>
    <div class="actions"><button class="button" type="submit">Save hourly sales</button></div>
   </form>
  </article>`:'';
 return layout({account,title:'Sales',active:'/sales',notice,body:`${hero({eyebrow:'Sales · '+location.name,title:'Daily sales',text:'Enter what each day actually took. A saved weekly report takes priority over Daily sales for the same day.'})}
  ${locationPicker({locations,selected:location,action:'/sales'})}
  <form method="get" action="/sales" class="picker">
   <input type="hidden" name="locationId" value="${esc(location.id)}">
   <label class="field"><span>Week starting</span><select name="week">${weeks.map(week=>`<option value="${esc(week.weekStart)}"${week.weekStart===weekStart?' selected':''}>${esc(shortDate(week.weekStart))}</option>`).join('')}${weeks.some(week=>week.weekStart===weekStart)?'':`<option value="${esc(weekStart)}" selected>${esc(shortDate(weekStart))}</option>`}</select></label>
   <button class="button button-quiet" type="submit">Open</button>
  </form>
  <div class="grid">
   <form method="post" action="/sales/week" class="card">
    <h2>Week of ${esc(shortDate(weekStart))}</h2>
    ${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <input type="hidden" name="weekStart" value="${esc(weekStart)}">
    <input type="hidden" name="revision" value="${esc(record.revision)}">
    ${record.days.map(dayRow).join('')}
    <div class="actions"><button class="button" type="submit">Save week</button></div>
   </form>
   <form method="post" action="/sales/import" class="card">
    <h2>Import a weekly report</h2>
    <p class="muted small">Paste the report's CSV: date, till, Uber Eats, DoorDash, and optionally fees and the sheet's own row total. A row total that disagrees with its channels refuses the whole week.</p>
    ${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <label class="field"><span>Report name</span><input name="sourceName" maxlength="180" placeholder="Week 44 report"></label>
    <label class="field"><span>CSV</span><textarea name="csv" rows="9" required placeholder="date,till,uber_eats,door_dash,total
2026-10-05,1200.00,300.00,150.00,1650.00"></textarea></label>
    <div class="actions"><button class="button" type="submit">Import week</button></div>
   </form>
  </div>
  ${projectionBlock}
  ${hourlyBlock}
  <div class="grid">
   <article class="card"><h2>Saved weeks</h2><ul class="plain-list">${rows}</ul></article>
   <form method="post" action="/sales/budget" class="card">
    <h2>Budget · week of ${esc(shortDate(weekStart))}</h2>
    ${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <input type="hidden" name="weekStart" value="${esc(weekStart)}">
    <label class="field"><span>Sales budget ($)</span><input name="salesCents" inputmode="decimal" value="${budget?.salesCents==null?'':(budget.salesCents/100).toFixed(2)}"></label>
    <label class="field"><span>Labour budget ($)</span><input name="labourCents" inputmode="decimal" value="${budget?.labourCents==null?'':(budget.labourCents/100).toFixed(2)}"></label>
    <div class="actions"><button class="button" type="submit">Save budget</button></div>
   </form>
  </div>
  <div class="grid">
   <form method="post" action="/sales/expense" class="card">
    <h2>Add an operating expense</h2>
    ${csrf(account)}
    <input type="hidden" name="companyId" value="${esc(location.companyId)}">
    <input type="hidden" name="locationId" value="${esc(location.id)}">
    <label class="field"><span>Date</span><input type="date" name="date" value="${esc(weekStart)}" required></label>
    <label class="field"><span>Type</span><input name="type" maxlength="60" placeholder="Rent" required></label>
    <label class="field"><span>Amount ($)</span><input name="amountCents" inputmode="decimal" required></label>
    <label class="field"><span>Note</span><input name="description" maxlength="300"></label>
    <div class="actions"><button class="button" type="submit">Add expense</button></div>
   </form>
   <article class="card"><h2>Recent expenses</h2><ul class="plain-list">${(report?.expenses||[]).length?(report.expenses).map(expense=>`<li><span>${esc(expense.type)} <span class="muted small">${esc(expense.date)}</span></span><span>${money(expense.amountCents)}</span></li>`).join(''):'<li class="muted">Nothing recorded.</li>'}</ul></article>
  </div>`});
}

module.exports={sales,dayNames,shortDate};
