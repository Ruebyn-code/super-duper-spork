function apiPermission(url,method){
 const read=method==='GET';
 if(url.startsWith('/api/communications/'))return null; // Granular checks, mandatory access and CSRF are handled by its router.
 if(url==='/api/permission-levels'||url.startsWith('/api/permission-levels/'))return read?['roles.manage','users.manage']:['roles.manage'];
 if(['/api/menu','/api/catalogue'].includes(url))return['orders.view','counts.view','stock.manage','suppliers.manage'];
 if(url==='/api/home-totals')return['home.view'];
 if(url.startsWith('/api/stock-transfers'))return ['transfers.view'];
 if(url.startsWith('/api/reporting'))return['reporting.view'];
 if(url.startsWith('/api/invoices'))return[read?'invoices.view':'invoices.edit'];
 if(url.startsWith('/api/stock-counts')||url==='/api/stock-usage')return[read?'counts.view':'counts.edit'];
 if(url==='/api/sales')return[read?'sales.view':'sales.edit'];
 if(['/api/weekly-sales-reports','/api/weekly-sales-overview','/api/operating-expense-types','/api/operating-expense-schedule'].includes(url))return[read?'finances.view':'finances.edit'];
 if(url.startsWith('/api/orders'))return[read?'orders.view':'orders.place'];
 if(url.startsWith('/api/products'))return['stock.manage'];
 if(url.startsWith('/api/suppliers'))return['suppliers.manage'];
 if(url==='/api/order-email-template')return['email.manage'];
 if(/^\/api\/(accounts|locations)\/[^/]+\/email$/.test(url)||['/api/my-email-settings','/api/delivery-settings','/api/delivery-status'].includes(url))return['email.manage'];
 if(url.startsWith('/api/accounts'))return['users.manage'];
 if(url.startsWith('/api/locations'))return read?['users.manage','locations.manage','email.manage','companies.manage']:['locations.manage'];
 if(url.startsWith('/api/companies'))return read?null:['companies.manage'];
 if(['/api/logo','/api/sidebar-logo','/api/settings','/api/fonts','/api/interface-text','/api/element-overrides','/api/layout'].includes(url))return['appearance.manage'];
 return null;
}
function pagePermission(url){
 return({'/stock-transfers':['transfers.view'],'/settings/awards':['awards.manage'],'/rostering':['rostering.view'],'/knowledge-library':['knowledge.view'],'/communications':['comms.view'],'/':['orders.view'],'/cart':['orders.view'],'/stock-count':['counts.view'],'/sales':['sales.view','finances.view'],'/reporting':['reporting.view'],'/admin':['stock.manage','suppliers.manage'],'/admin/accounts':['users.manage','locations.manage','companies.manage','email.manage'],'/admin/settings':['appearance.manage'],'/admin/appearance/signin':['appearance.manage'],'/admin/appearance/setup':['appearance.manage'],'/email-settings':['email.manage'],'/settings':['appearance.manage','roles.manage','awards.manage','email.manage']})[url]||null;
}
module.exports={apiPermission,pagePermission};
