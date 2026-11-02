// Reporting and the Phase 7/8 migration console.
const permissions=require('./permissions');
const views=require('./views-learning');
const {companyFor}=require('./routes-comms');

const monday=date=>new Date(Date.parse(date+'T00:00:00Z')-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const fail=(message,status=403)=>{throw Object.assign(Error(message),{status});};

async function route(ctx){
 const {url,method,viewer,actor,services,html,redirect,readBody,assertCsrf,notice}=ctx;
 const path=url.pathname;
 if(!path.startsWith('/reporting')&&!path.startsWith('/migration'))return false;

 if(path==='/reporting'&&method==='GET'){
  permissions.requirePermission(actor,'reporting.view');
  const company=await companyFor(actor,await services.store.read('companies'),url.searchParams.get('companyId'));
  if(!company)return redirect('/home');
  const requested=url.searchParams.get('week');
  const overview=await services.reporting.overview(actor,{companyId:company.id,weekStart:validDate(requested)?monday(requested):undefined});
  return html(200,views.reporting({account:viewer,company,companies:[company],overview,notice:notice(url.searchParams.get('saved'))}));
 }

 // Migration and cut-over are company-management actions.
 if(!permissions.can(actor,'companies.manage')||actor.role!=='admin')fail('Only Head Office can run a migration.');

 if(path==='/migration'&&method==='GET'){
  const status=await services.cutover.status();
  return html(200,views.migration({account:viewer,status,report:status.migration,notice:notice(url.searchParams.get('saved'))}));
 }

 if(path==='/migration/dry-run'&&method==='POST'){
  assertCsrf(await readBody());
  const report=await services.migration.dryRun();
  const status=await services.cutover.status();
  return html(200,views.migration({account:viewer,status,report,dry:report}));
 }

 if(path==='/migration/apply'&&method==='POST'){
  assertCsrf(await readBody());
  const report=await services.migration.apply();
  const status=await services.cutover.status();
  return redirect('/migration?saved='+(report.status==='reconciled'?'migration-applied':'migration-attention'));
 }

 if(path==='/migration/cutover'&&method==='POST'){
  assertCsrf(await readBody());
  await services.cutover.retire({actor,signedOffBy:actor.name});
  return redirect('/migration?saved=cutover-done');
 }

 if(path==='/migration/rollback'&&method==='POST'){
  const form=await readBody();
  assertCsrf(form);
  await services.cutover.rollback({actor,reason:form.reason});
  return redirect('/migration?saved=rollback-done');
 }

 return false;
}
module.exports={route};
