const model=require('./public/permission-model');
const ranks={user:1,franchisee:2,admin:3},roleNames={user:'Ordering manager',franchisee:'Franchisee',admin:'Head Office'};
const locationIds=account=>account.locationIds||(account.locationId?[account.locationId]:[]);
const headOffice=account=>model.can(account,'locations.all');
const managesUsers=account=>model.can(account,'users.manage');
function canAccessLocation(account,location){return locationIds(account).includes(location.id)||(headOffice(account)&&(model.can(account,'network.access')||(account.companyIds||[account.companyId||'default']).includes(location.companyId||'default')));}
function managesAccount(actor,target){const ids=locationIds(target);return managesUsers(actor)&&model.canAssign(actor,target)&&(model.can(actor,'network.access')&&headOffice(actor)||(ids.length>0&&ids.every(id=>locationIds(actor).includes(id))));}
module.exports={...model,ranks,roleNames,locationIds,headOffice,managesUsers,managesAccount,canAccessLocation};
