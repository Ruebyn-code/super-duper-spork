// Keep existing stored role IDs so upgrades retain passwords, roles and memberships.
const ranks={user:1,franchisee:2,admin:3};
const roleNames={user:'Ordering manager',franchisee:'Franchisee',admin:'Head Office'};
const locationIds=account=>account.locationIds||(account.locationId?[account.locationId]:[]);
const headOffice=account=>account?.role==='admin';
const managesUsers=account=>(ranks[account?.role]||0)>=ranks.franchisee;
function managesAccount(actor,target){const ids=locationIds(target);return headOffice(actor)||(actor?.role==='franchisee'&&(ranks[target?.role]||Infinity)<=ranks.franchisee&&ids.length>0&&ids.every(id=>locationIds(actor).includes(id)));}
module.exports={ranks,roleNames,locationIds,headOffice,managesUsers,managesAccount};
