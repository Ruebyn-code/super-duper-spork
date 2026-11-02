// Seeds the rebuild's own data directory.
//
// Two companies with separate users and locations, so company/location
// isolation and delegated limits can be seen in the preview (and asserted in
// tests) before Phase 7 imports the production records. Idempotent: it only
// writes when the data directory has no companies yet.
const crypto=require('node:crypto');
const path=require('node:path');
const passwordSecurity=require('../password-security');
const permissions=require('./permissions');
const {createStore}=require('./store');

const demoPassword=process.env.REBUILD_DEMO_PASSWORD||'harbour-demo-passphrase';
const demoAccounts=[
 {email:'admin@harbour.test',note:'Head Office · Harbour Group (both stores)'},
 {email:'manager@harbour.test',note:'Franchisee · Harbour Street only · cannot invite users'},
 {email:'admin@riverside.test',note:'Head Office · Riverside Group (different company)'}
];
const defaultsFor=role=>[...permissions.defaults.find(item=>item.id===role).permissions];

async function seed(store,{now=Date.now,password=demoPassword}={}){
 if((await store.read('companies')).length)return {seeded:false};
 const stamp=new Date(now()).toISOString();
 const companies=[
  {id:crypto.randomUUID(),name:'Harbour Group',createdAt:stamp},
  {id:crypto.randomUUID(),name:'Riverside Group',createdAt:stamp}
 ];
 const locations=[
  {id:crypto.randomUUID(),companyId:companies[0].id,name:'Harbour Street',archived:false,createdAt:stamp},
  {id:crypto.randomUUID(),companyId:companies[0].id,name:'Harbour Central',archived:false,createdAt:stamp},
  {id:crypto.randomUUID(),companyId:companies[1].id,name:'Riverside Store',archived:false,createdAt:stamp}
 ];
 const credentials=await passwordSecurity.credentials(password);
 const account=(name,email,role,company,locationIds,actionPermissions)=>({
  id:crypto.randomUUID(),name,email,role,permissions:defaultsFor(role),actionPermissions:actionPermissions||{},
  companyIds:[company.id],locationIds,version:crypto.randomUUID(),...credentials,createdAt:stamp
 });
 const accounts=[
  account('Hayley Chen','admin@harbour.test','admin',companies[0],[locations[0].id,locations[1].id]),
  account('Marco Rossi','manager@harbour.test','franchisee',companies[0],[locations[0].id],{'users.create':false}),
  account('Priya Nair','admin@riverside.test','admin',companies[1],[locations[2].id])
 ];
 await store.change('companies',list=>{list.push(...companies);});
 await store.change('locations',list=>{list.push(...locations);});
 await store.change('accounts',list=>{list.push(...accounts);});
 return {seeded:true,companies,locations,accounts};
}

module.exports={seed,demoPassword,demoAccounts};

if(require.main===module){
 (async()=>{
  const store=createStore(process.env.REBUILD_DATA_DIR||path.join(__dirname,'data'));
  const result=await seed(store);
  console.log(result.seeded?`Seeded ${result.companies.length} companies and ${result.accounts.length} accounts into ${store.dir}`:'Rebuild data already present; nothing seeded.');
 })().catch(error=>{console.error(error.message);process.exitCode=1;});
}
