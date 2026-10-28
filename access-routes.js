function apiPermission(url,method){
 const read=method==='GET';
 if(url.startsWith('/api/communications/'))return null; // Granular checks, mandatory access and CSRF are handled by its router.
 if(url==='/api/permission-levels'||url.startsWith('/api/permission-levels/'))return read?['roles.manage','users.manage']:['roles.manage'];
 if(['/api/menu','/api/catalogue'].includes(url))return['orders.view','counts.view','stock.manage','suppliers.manage'];
 if(url==='/api/kiosk-devices'||url.startsWith('/api/kiosk-devices/'))return['devices.manage'];
 if(url==='/api/home-orders')return['orders.view'];
 if(url==='/api/home-dashboard'||url==='/api/home-greeting')return[read?'home.view':'appearance.manage'];
 if(url==='/api/public-holidays')return['home.view','sales.view','finances.view','rostering.view'];
 if(url==='/api/home-operations')return['home.view'];
 if(url==='/api/home-totals')return['home.view'];
 if(url==='/api/home-daily-sales')return['sales.edit'];
 if(url.startsWith('/api/stock-transfers'))return ['transfers.view'];
 if(url.startsWith('/api/reporting'))return['reporting.view'];
 if(url.startsWith('/api/invoices'))return[read?'invoices.view':'invoices.edit'];
 if(url.startsWith('/api/stock-counts')||url==='/api/stock-usage')return[read?'counts.view':'counts.edit'];
 if(url.startsWith('/api/weekly-sales-import/'))return['finances.edit'];
 if(url.startsWith('/api/hourly-sales'))return[read?'sales.view':'sales.edit'];
 if(url==='/api/sales')return[read?'sales.view':'sales.edit'];
 if(['/api/weekly-sales-reports','/api/weekly-sales-overview','/api/operating-expense-types','/api/operating-expense-schedule'].includes(url))return[read?'finances.view':'finances.edit'];
 if(url.startsWith('/api/order-history'))return[read?'orders.view':'orders.place'];
 if(url.startsWith('/api/orders'))return[read?'orders.view':'orders.place'];
 if(url.startsWith('/api/products'))return['stock.manage'];
 if(url.startsWith('/api/suppliers'))return['suppliers.manage'];
 if(url==='/api/order-email-template')return['email.manage'];
 if(/^\/api\/(accounts|locations)\/[^/]+\/email$/.test(url)||['/api/my-email-settings','/api/delivery-settings','/api/delivery-status'].includes(url))return['email.manage'];
 if(url.startsWith('/api/accounts'))return['users.manage'];
 if(url==='/api/account-invitations')return['users.manage'];
 if(url==='/api/account-email-settings')return['account-email.manage'];
 if(url.startsWith('/api/locations'))return read?['users.manage','locations.manage','email.manage','companies.manage']:['locations.manage'];
 if(url.startsWith('/api/companies'))return read?null:['companies.manage'];
 if(['/api/logo','/api/sidebar-logo','/api/settings','/api/fonts','/api/interface-text','/api/element-overrides','/api/layout'].includes(url))return['appearance.manage'];
 return null;
}
function pagePermission(url){
 return({'/order-history':['orders.view'],'/learning-centre':['learning.view'],'/labels':['prep.view'],'/ops-management':['ops.view'],'/stock-transfers':['transfers.view'],'/settings/devices':['devices.manage'],'/settings/awards':['awards.manage'],'/rostering':['rostering.view'],'/knowledge-library':['knowledge.view'],'/communications':['comms.view'],'/':['orders.view'],'/cart':['orders.view'],'/stock-count':['counts.view'],'/sales':['sales.view','finances.view'],'/reporting':['reporting.view'],'/admin':['stock.manage','suppliers.manage'],'/admin/accounts':['users.manage','locations.manage','companies.manage','email.manage'],'/admin/settings':['appearance.manage'],'/admin/appearance/signin':['appearance.manage'],'/admin/appearance/setup':['appearance.manage'],'/email-settings':['email.manage'],'/settings':['ai.manage','appearance.manage','roles.manage','awards.manage','email.manage','account-email.manage','devices.manage']})[url]||null;
}
module.exports={apiPermission,pagePermission};

// Additional action limits never replace the original view, edit, hierarchy or scope checks.
function actionPermission(url,method){
 const write=method!=='GET'&&method!=='HEAD';
 if(!write){if(url==='/api/learning-centre/report.csv')return 'learning.export';return null;}
 if((url==='/api/accounts'||url==='/api/account-invitations'||/^\/api\/accounts\/[^/]+\/invitation$/.test(url))&&method==='POST')return 'users.create';
 if(/^\/api\/accounts\/[^/]+$/.test(url)&&method==='DELETE')return 'users.delete';
 if(url==='/api/search/intelligence')return 'ai.search';
 if(url.startsWith('/api/hourly-sales/'))return 'hourly.import';
 if(url.startsWith('/api/weekly-sales-import/'))return 'weekly.import';
 if(url==='/api/invoices'&&method==='POST')return 'invoices.upload';
 if(/^\/api\/invoices\/[a-f0-9-]{36}$/i.test(url)&&method==='DELETE')return 'invoices.delete';
 if(url==='/api/products'&&method==='POST')return 'stock.create';
 if(/^\/api\/products\/[^/]+$/.test(url)&&method==='DELETE')return 'stock.delete';
 if(/^\/api\/products\/[^/]+\/par$/.test(url))return 'stock.targets';
 if(url==='/api/suppliers'&&method==='POST')return 'suppliers.create';
 if(/^\/api\/suppliers\/[^/]+$/.test(url)&&method==='DELETE')return 'suppliers.delete';
 if(url==='/api/companies'&&method==='POST')return 'companies.create';
 if(url==='/api/order-email-template')return 'email.template';
 if(url==='/api/order-history'&&method==='POST')return 'orders.record';
 if(/^\/api\/order-history\/[^/]+\/delivery$/.test(url))return 'orders.receive';
 if(/^\/api\/order-history\/[^/]+$/.test(url))return method==='DELETE'?'orders.delete':method==='PUT'?'orders.edit':null;
 if(/^\/api\/learning-centre\/courses\/[^/]+\/publish$/.test(url))return 'learning.publish';
 if(/^\/api\/learning-centre\/courses\/[^/]+\/archive$/.test(url))return 'learning.archive';
 if(url==='/api/rostering/publish')return 'rostering.publish';
 if(/^\/api\/rostering\/shifts\/[^/]+$/.test(url)&&method==='DELETE')return 'rostering.delete-shift';
 if(/^\/api\/ops-management\/planners(?:\/[^/]+)?$/.test(url))return 'ops.planners';
 return null;
}
module.exports.actionPermission=actionPermission;
