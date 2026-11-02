// Learning, Reporting and Migration screens.
const {esc,money,number,layout,hero,csrf}=require('./ui');

const companyPicker=(companies,selected)=>companies.length>1?`<form method="get" class="picker">
  <label class="field"><span>Company</span><select name="companyId">${companies.map(company=>`<option value="${esc(company.id)}"${company.id===selected.id?' selected':''}>${esc(company.name)}</option>`).join('')}</select></label>
  <button class="button button-quiet" type="submit">View</button>
 </form>`:'';

const statusPill=status=>`<span class="pill${status==='passed'?' pill-ok':status==='failed'?' pill-warn':''}">${esc(status)}</span>`;

function learning({account,company,companies,mine,courses,progress,checklists,canManage,notice}){
 const mineRows=mine.length?mine.map(assignment=>`<li>
   <span>${esc(assignment.courseTitle)}${assignment.dueDate?` <span class="muted small">· due ${esc(assignment.dueDate)}</span>`:''}
    ${assignment.lastAttempt?.status==='failed'?`<br><span class="muted small">Last attempt scored ${assignment.lastAttempt.score}% · your answers are kept</span>`:''}</span>
   <span>${statusPill(assignment.status)}${assignment.status==='passed'?'':` <a class="button button-small" href="/learning/attempt?assignmentId=${esc(assignment.id)}">${assignment.status==='failed'?'Retake':'Start'}</a>`}</span>
  </li>`).join(''):'<li class="muted">Nothing assigned to you.</li>';
 const courseRows=courses.length?courses.map(course=>`<tr><td>${esc(course.title||course.published?.title)}</td>
   <td>${course.status==='published'?`v${esc(course.version)} · ${esc((course.published?.publishedAt||'').slice(0,10))}`:'<span class="pill">draft</span>'}</td>
   <td>${course.status==='published'?`<form method="post" action="/learning/assign" class="inline">${csrf(account)}<input type="hidden" name="companyId" value="${esc(company.id)}"><input type="hidden" name="courseId" value="${esc(course.id)}"><input type="hidden" name="accountIds" value="${esc(account.id)}"><button class="button button-small" type="submit">Assign to me</button></form>`:
    `<form method="post" action="/learning/publish" class="inline">${csrf(account)}<input type="hidden" name="courseId" value="${esc(course.id)}"><button class="button button-small" type="submit">Publish</button></form>`}</td></tr>`).join(''):'<tr><td colspan="3" class="muted">No courses yet.</td></tr>';
 const progressBlock=progress?`<section class="card"><h2>Training progress</h2>
   <p class="small">${progress.passed}/${progress.total} passed · ${progress.failed} failed · ${progress.outstanding} outstanding</p>
   <table class="table"><thead><tr><th>Learner</th><th>Course</th><th>Status</th><th>Score</th></tr></thead><tbody>${progress.rows.map(row=>`<tr><td>${esc(row.name)}</td><td>${esc(row.courseTitle)}</td><td>${statusPill(row.status)}</td><td>${row.score===null?'—':esc(row.score)+'%'}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">No assignments.</td></tr>'}</tbody></table>
  </section>`:'';
 const checklistBlock=checklists?`<section class="card"><h2>Checklists</h2>
   <table class="table"><thead><tr><th>List</th><th>Started</th><th>Completed</th><th>Rate</th></tr></thead><tbody>${checklists.map(item=>`<tr><td>${esc(item.title)}</td><td>${item.started}</td><td>${item.completed}</td><td>${item.completionPct===null?'—':esc(item.completionPct)+'%'}</td></tr>`).join('')||'<tr><td colspan="4" class="muted">No checklists.</td></tr>'}</tbody></table>
  </section>`:'';
 return layout({account,title:'Learning',active:'/learning',notice,body:`${hero({eyebrow:'Learning · '+company.name,title:'My learning',text:'A quiz is graded on the server. A failed attempt keeps the answers you submitted.'})}
  ${companyPicker(companies,company)}
  <section class="card"><h2>Assigned to me</h2><ul class="plain-list">${mineRows}</ul></section>
  ${canManage?`<section class="grid">
   <article class="card"><h2>Courses</h2><table class="table"><thead><tr><th>Course</th><th>Version</th><th></th></tr></thead><tbody>${courseRows}</tbody></table></article>
   <form method="post" action="/learning/course" class="card">${csrf(account)}<h2>New course</h2>
    <input type="hidden" name="companyId" value="${esc(company.id)}">
    <label class="field"><span>Title</span><input name="title" maxlength="140" required></label>
    <label class="field"><span>Summary</span><input name="summary" maxlength="600"></label>
    <label class="field"><span>Lesson title</span><input name="lessonTitle" maxlength="140" required></label>
    <label class="field"><span>Lesson body</span><textarea name="lessonBody" rows="4" required></textarea></label>
    <label class="field"><span>Question</span><input name="prompt" maxlength="600" required></label>
    <label class="field"><span>Correct answer</span><input name="correct" maxlength="300" required></label>
    <label class="field"><span>Wrong answer</span><input name="wrong" maxlength="300" required></label>
    <label class="field"><span>Pass mark (%)</span><input name="passPercent" inputmode="numeric" value="80"></label>
    <div class="actions"><button class="button" type="submit">Save draft</button></div>
   </form>
  </section>`:''}
  ${progressBlock}
  ${checklistBlock}`});
}

function attempt({account,course,attempt,notice,error}){
 const questions=course.questions.map(question=>`<fieldset class="card"><legend><strong>${esc(question.prompt)}</strong></legend>
   ${question.options.map(option=>`<label class="check"><input type="radio" name="answer:${esc(question.id)}" value="${esc(option.id)}"${attempt.answers?.[question.id]===option.id?' checked':''}> <span>${esc(option.text)}</span></label>`).join('')}
  </fieldset>`).join('');
 return layout({account,title:course.title,active:'/learning',notice,error,body:`${hero({eyebrow:'Learning',title:course.title,text:`${esc(course.summary||'')} · pass mark ${esc(course.passPercent)}%`})}
  <p><a class="button button-quiet" href="/learning?companyId=${esc(course.companyId)}">Back to Learning</a></p>
  <section class="card"><h2>Lessons</h2>${course.lessons.map(lesson=>`<article><h3>${esc(lesson.title)}</h3><p>${esc(lesson.body)}</p></article>`).join('')}</section>
  <form method="post" action="/learning/attempt/submit">
   ${csrf(account)}
   <input type="hidden" name="attemptId" value="${esc(attempt.id)}">
   ${questions}
   <div class="actions"><button class="button" type="submit">Submit answers</button></div>
  </form>`});
}

function reporting({account,company,companies,overview,notice}){
 const rows=overview.rows.map(row=>`<tr>
   <td>${esc(row.locationName)}${row.rank?` <span class="pill">#${esc(row.rank)}</span>`:''}</td>
   <td>${money(row.salesCents)}${row.recordedDays<7?`<br><span class="muted small">${row.recordedDays}/7 days</span>`:''}</td>
   <td>${money(row.costCents)}</td>
   <td>${row.profitCents===null?'<span class="muted">Unknown</span>':money(row.profitCents)}</td>
   <td>${row.marginPct===null?'<span class="muted">—</span>':esc(row.marginPct)+'%'}</td>
  </tr>`).join('');
 const totals=overview.totals;
 return layout({account,title:'Reporting',active:'/reporting',notice,body:`${hero({eyebrow:'Reporting · '+company.name,title:'Business overview',text:'Read-only. A location with an incomplete week shows its recorded sales but no profit or rank.'})}
  ${companyPicker(companies,company)}
  <form method="get" action="/reporting" class="picker">
   <input type="hidden" name="companyId" value="${esc(company.id)}">
   <label class="field"><span>Week starting</span><input type="date" name="week" value="${esc(overview.weekStart||'')}"></label>
   <button class="button button-quiet" type="submit">View</button>
  </form>
  ${totals?`<section class="grid"><article class="card"><h2>Sales</h2><p class="metric">${money(totals.salesCents)}</p></article>
    <article class="card"><h2>Costs</h2><p class="metric">${money(totals.costCents)}</p></article>
    <article class="card"><h2>Profit</h2><p class="metric">${money(totals.profitCents)}</p><p class="small muted">${totals.marginPct===null?'No margin':totals.marginPct+'%'}</p></article></section>`:
   '<p class="banner banner-warn">Totals are unavailable until every location has a complete week.</p>'}
  <section class="card"><h2>By location</h2><table class="table"><thead><tr><th>Location</th><th>Sales</th><th>Costs</th><th>Profit</th><th>Margin</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="muted">No locations.</td></tr>'}</tbody></table></section>
  ${overview.training?`<section class="card"><h2>Training</h2><p class="small">${overview.training.passed}/${overview.training.total} passed · ${overview.training.outstanding} outstanding</p></section>`:''}
  ${overview.checklists?`<section class="card"><h2>Checklists</h2><ul class="plain-list">${overview.checklists.map(item=>`<li><span>${esc(item.title)}</span><span>${item.completionPct===null?'—':esc(item.completionPct)+'%'}</span></li>`).join('')}</ul></section>`:''}`});
}

function migration({account,status,report,dry,notice}){
 const collectionRows=report?Object.entries(report.counts).filter(([,entry])=>entry.source).map(([name,entry])=>`<tr><td>${esc(name)}</td><td>${entry.source}</td><td>${entry.imported||0}</td><td>${entry.updated||0}</td></tr>`).join(''):'';
 return layout({account,title:'Migration',active:'/migration',notice,body:`${hero({eyebrow:'Phase 7 and 8',title:'Migration and cut-over',text:'A dry run writes nothing. Apply imports with stable legacy keys, then reconciles every total before cut-over is allowed.'})}
  <section class="card"><h2>Status</h2>
   <p class="small">${status.migration?`Last run ${esc(status.migration.runAt.slice(0,16).replace('T',' '))} · ${esc(status.migration.status)}${status.migration.dryRun?' (dry run)':''}`:'No migration has run yet.'}</p>
   <p class="small">Cut-over phase: <strong>${esc(status.phase)}</strong>${status.ready?' · ready':''}</p>
   ${status.blockers.length?`<ul class="plain-list">${status.blockers.map(blocker=>`<li class="muted">${esc(blocker)}</li>`).join('')}</ul>`:''}
   <div class="actions">
    <form method="post" action="/migration/dry-run">${csrf(account)}<button class="button button-quiet" type="submit">Dry run</button></form>
    <form method="post" action="/migration/apply">${csrf(account)}<button class="button" type="submit">Apply import</button></form>
    ${status.phase==='read-only'?`<form method="post" action="/migration/rollback">${csrf(account)}<button class="button button-danger" type="submit">Return to rehearsal</button></form>`:
      `<form method="post" action="/migration/cutover">${csrf(account)}<button class="button" type="submit"${status.ready?'':' disabled'}>Retire current app to read-only</button></form>`}
   </div>
  </section>
  ${report?`<section class="card"><h2>${report.dryRun?'Dry run':'Import'} report</h2>
   <p class="small">${report.totalSource} source records · ${report.orphans.length} unresolved${report.reconciliation?` · ${report.reconciliation.reconciled?'reconciled':'not reconciled'}`:''}</p>
   <table class="table"><thead><tr><th>Collection</th><th>Source</th><th>Imported</th><th>Updated</th></tr></thead><tbody>${collectionRows||'<tr><td colspan="4" class="muted">Nothing to import.</td></tr>'}</tbody></table>
   ${report.orphans.length?`<h3>Unresolved records</h3><ul class="plain-list">${report.orphans.slice(0,30).map(orphan=>`<li><span>${esc(orphan.collection)} · ${esc(orphan.id)}</span><span class="muted small">${esc(orphan.reason)}</span></li>`).join('')}</ul>`:''}
   ${report.reconciliation?.mismatches?.length?`<h3>Reconciliation differences</h3><ul class="plain-list">${report.reconciliation.mismatches.slice(0,20).map(mismatch=>`<li><span>${esc(mismatch.kind)} ${esc(mismatch.weekStart||'')}</span><span class="muted small">${esc(mismatch.reason||`source ${mismatch.sourceTotal} vs target ${mismatch.targetTotal}`)}</span></li>`).join('')}</ul>`:''}
   ${report.unmapped?.length?`<p class="small muted">Source stores with no target yet: ${esc(report.unmapped.join(', '))}</p>`:''}
  </section>`:''}
  ${dry?`<section class="card"><h2>This dry run</h2><p class="small">${dry.totalSource} records would move · ${dry.orphans.length} unresolved</p></section>`:''}`});
}

module.exports={learning,attempt,reporting,migration};
