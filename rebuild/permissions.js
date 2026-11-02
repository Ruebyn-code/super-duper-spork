// Permission and scope checks for the rebuilt app.
//
// The catalogue itself is the app's existing permission model — 63 feature
// grants plus 41 optional action limits — reused verbatim from
// public/permission-model.js so both apps answer "may this account do that?"
// identically. Everything below adds the company/location scoping that the
// rebuilt write paths call, replacing the legacy per-router ad-hoc checks.
const model=require('../public/permission-model');
const companyIds=account=>account?.companyIds?.length?account.companyIds:[account?.companyId].filter(Boolean);
const locationIds=account=>account?.locationIds?.length?account.locationIds:[account?.locationId].filter(Boolean);
const headOffice=account=>Boolean(account)&&model.can(account,'locations.all');
const companyAllowed=(account,companyId)=>companyIds(account).includes(companyId);
// Head Office reaches every location in a company it can reach; everyone else
// needs the location granted explicitly.
const locationAllowed=(account,location)=>Boolean(location)&&!location.archived&&(locationIds(account).includes(location.id)||(headOffice(account)&&companyAllowed(account,location.companyId)));
const deny=(message,status=403)=>Object.assign(Error(message),{status});
function requirePermission(account,key){
 if(!model.can(account,key))throw deny('You do not have permission to do that.');
}
function company(account,id,companies){
 const record=companies.find(item=>item.id===id);
 if(!record||!companyAllowed(account,record.id))throw deny('Company not found.',404);
 return record;
}
function location(account,id,locations){
 const record=locations.find(item=>item.id===id);
 if(!record||!locationAllowed(account,record))throw deny('Location not found.',404);
 return record;
}
const accessibleCompanies=(account,companies)=>companies.filter(item=>companyAllowed(account,item.id));
const accessibleLocations=(account,locations)=>locations.filter(item=>locationAllowed(account,item));
module.exports={...model,companyIds,locationIds,headOffice,companyAllowed,locationAllowed,accessibleCompanies,accessibleLocations,requirePermission,company,location,deny};
