const crypto=require('node:crypto');
const {fixture,password}=require('./ai-assistance-fixture.cjs');
async function homeTransfersFixture(){
 const f=await fixture({fetchImpl:()=>{throw Error('Unexpected provider request');}});
 try{
  const receiving=await f.api(f.office,'/api/locations','POST',{name:'Mernda',companyId:f.office.session.companyId});
  const managerAccount=await f.api(f.office,'/api/accounts','POST',{username:'LocationManager',password,role:'franchisee',locationId:receiving.id});
  const ordinaryAccount=await f.api(f.office,'/api/accounts','POST',{username:'OrdinarySupervisor',password,role:'franchisee',locationId:receiving.id});
  async function assign(locationId,userIds,roleId='franchisee'){
   const settings=await f.api(f.office,'/api/locations/'+locationId+'/managers');return f.api(f.office,'/api/locations/'+locationId+'/managers','PUT',{revision:settings.revision,userIds,roleId});
  }
  await assign(receiving.id,[managerAccount.id]);const manager=await f.login('LocationManager'),ordinary=await f.login('OrdinarySupervisor');
  async function send({from=f.location,to=receiving.id,moveCosts=true,quantity=2,notes='',items}={}){
   return f.api(f.office,'/api/stock-transfers','POST',{requestId:crypto.randomUUID(),destinationLocationId:to,moveCosts,notes,items:items||[{sourceProductId:'paper',targetProductId:'paper',quantity,targetQuantity:quantity}]},{'X-Location-Id':from});
  }
  return {...f,receiving,manager,managerAccount,ordinary,ordinaryAccount,assign,send};
 }catch(error){await f.close();throw error;}
}
module.exports={homeTransfersFixture,password};
