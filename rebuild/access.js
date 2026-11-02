// The single scope check every rebuilt read and write path calls.
//
// Phase 1's gate is that a write cannot cross a company or location the actor
// cannot reach, and cannot exceed their granted actions. Routes resolve the
// target company/location from the request body and pass them here before any
// record is touched. read() resolves the same scope without implying a
// mutation, so a listing and a write can never disagree about which location
// they mean.
const permissions=require('./permissions');
async function resolve({store,account,permission,companyId,locationId}){
 permissions.requirePermission(account,permission);
 const [companies,locations]=await Promise.all([store.read('companies'),store.read('locations')]);
 const company=permissions.company(account,companyId,companies);
 const location=locationId?permissions.location(account,locationId,locations):null;
 if(location&&location.companyId!==company.id)throw permissions.deny('That location is not in the selected company.',409);
 return {company,location};
}
module.exports={write:resolve,read:resolve};
