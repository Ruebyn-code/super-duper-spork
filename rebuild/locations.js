// Locations for the rebuilt app: reads are scoped to the actor, and creation is
// a guarded write (locations.manage + locations.create inside a reachable
// company).
const crypto=require('node:crypto');
const permissions=require('./permissions');
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function createLocations({store,now=Date.now}){
 async function list(actor){
  const [companies,locations]=await Promise.all([store.read('companies'),store.read('locations')]);
  const names=new Map(companies.map(company=>[company.id,company.name]));
  return permissions.accessibleLocations(actor,locations).map(location=>({...location,companyName:names.get(location.companyId)||''}));
 }
 async function create(actor,input){
  const displayName=typeof input?.name==='string'?input.name.trim():'';
  if(!displayName||displayName.length>100)fail('Enter a location name of 1–100 characters.');
  permissions.requirePermission(actor,'locations.manage');
  permissions.requirePermission(actor,'locations.create');
  const company=permissions.company(actor,input.companyId,await store.read('companies'));
  return store.change('locations',locations=>{
   if(locations.some(location=>location.companyId===company.id&&!location.archived&&location.name.toLowerCase()===displayName.toLowerCase()))fail('That location already exists in this company.',409);
   const record={id:crypto.randomUUID(),companyId:company.id,name:displayName,archived:false,createdAt:new Date(now()).toISOString()};
   locations.push(record);
   return record;
  });
 }
 return {list,create};
}
module.exports={createLocations};
