// Phase 8 — cut-over.
//
// Cut-over is refused until the latest migration run reconciled with no
// unresolved records. Signing off records who retired the current app to
// read-only and which migration run they relied on; it never deletes the
// source data, so `rollback()` can return the rebuild to rehearsal while the
// old data stays exactly where it is.
const crypto=require('node:crypto');

function createCutover({store,now=Date.now}){
 const stamp=()=>new Date(now()).toISOString();

 async function status(){
  const [runs,records]=await Promise.all([store.read('migrationRuns'),store.read('cutover')]);
  const latestRun=runs.at(-1)||null;
  const current=records.at(-1)||null;
  const blockers=[];
  if(!latestRun)blockers.push('Run a migration dry run and apply it before cut-over.');
  else{
   if(latestRun.status!=='reconciled')blockers.push('The latest migration run did not reconcile.');
   if(latestRun.orphans?.length)blockers.push(latestRun.orphans.length+' migrated records are unresolved.');
  }
  return {migration:latestRun,cutover:current,phase:current?.phase||'rehearsal',ready:blockers.length===0,blockers};
 }

 async function retire({actor,signedOffBy,runId}={}){
  const state=await status();
  if(state.phase==='read-only')throw Object.assign(Error('The current app is already retired to read-only.'),{status:409});
  if(!state.migration)throw Object.assign(Error('Run the migration before cut-over.'),{status:409});
  if(runId&&runId!==state.migration.id)throw Object.assign(Error('That migration run is not the latest one.'),{status:409});
  if(!state.ready)throw Object.assign(Error('Cut-over is blocked: '+state.blockers.join(' ')),{status:409});
  const record={id:crypto.randomUUID(),phase:'read-only',at:stamp(),migrationRunId:state.migration.id,
   signedOffBy:String(signedOffBy||actor?.name||'Unnamed'),signedOffById:actor?.id||null,
   note:'The current app is now the read-only reference. Its data is untouched and remains the rollback source.'};
  await store.change('cutover',list=>{list.push(record);});
  return record;
 }

 async function rollback({actor,reason}={}){
  const state=await status();
  if(state.phase!=='read-only')throw Object.assign(Error('The current app is not retired; there is nothing to roll back.'),{status:409});
  const record={id:crypto.randomUUID(),phase:'rehearsal',at:stamp(),rolledBackFrom:state.cutover.id,
   signedOffBy:String(actor?.name||'Unnamed'),reason:String(reason||'').trim().slice(0,500)};
  await store.change('cutover',list=>{list.push(record);});
  return record;
 }

 return {status,retire,rollback};
}
module.exports={createCutover};
