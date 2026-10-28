(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.opstackFeatureHelp=factory();})(globalThis,()=>{
 const ids=text=>text.split(/\s+/).filter(Boolean);
 const pages={
  '/home':ids('home-dashboards daily-sales overnight-sales hourly-import hourly-projections ordering-budget transfer-approvals scan-invoice intelligence-invoices invoice-prices invoice-expenses home-layout navigation switch-location profile-photo dark-mode platform-search kiosk-use sales-missing'),
  '/':ids('place-order shared-cart target-levels order-when order-rounding delivery-dates delivery-cutoffs delivery-quantities delivery-shortages receiving-orders delivery-exceptions order-confirmation order-not-sent'),
  '/cart':ids('shared-cart place-order ordering-budget order-confirmation order-not-sent'),
  '/order-history':ids('order-history receiving-orders stock-price-changes order-confirmation order-not-sent'),
  '/stock-count':ids('stock-count count-sleeves count-history target-levels order-when delivery-quantities delivery-shortages'),
  '/stock-transfers':ids('stock-transfers transfer-approvals'),
  '/sales':ids('daily-sales weekly-report weekly-import sales-projections public-holidays holiday-forecasts hourly-import hourly-projections ordering-budget platform-fees invoice-expenses weekly-costs operating-expenses sales-missing hourly-not-imported'),
  '/rostering':ids('view-roster make-roster publish-roster roster-forecasts timesheets leave-availability labour-settings shift-clock early-start clock-breaks clock-problem award-settings'),
  '/ops-management':ids('complete-checklist checklist-builder checklist-responses checklist-planners hourly-checklists checklist-audiences checklist-history intelligence-checklists intelligence-planners'),
  '/learning-centre':ids('take-course in-store-training course-builder course-questions assign-training training-reports intelligence-questions'),
  '/communications':ids('team-chat publish-post rich-content required-reading intelligence-writing'),
  '/knowledge-library':ids('read-library publish-library library-categories rich-content intelligence-writing'),
  '/reporting':ids('business-reports location-rankings operational-reports report-details report-exports scheduled-reports reports-not-arriving'),
  '/admin':ids('stock-settings supplier-contacts count-sleeves order-rounding target-levels order-when stock-price-changes delivery-dates'),
  '/admin/accounts':ids('manage-users account-invitations permissions locations location-setup trading-hours location-managers companies location-email order-confirmation delivery-dates delivery-cutoffs delivery-exceptions public-holidays'),
  '/settings':ids('permissions order-email-template account-invitations manage-kiosks award-settings intelligence-setup intelligence-appearance intelligence-limits intelligence-problem appearance'),
  '/admin/settings':ids('appearance intelligence-appearance home-layout'),
  '/email-settings':ids('location-email order-email-template order-confirmation order-not-sent'),
  '/settings/devices':ids('manage-kiosks kiosk-use'),
  '/settings/awards':ids('award-settings public-holidays'),
  '/labels':ids('print-labels label-templates label-history printer-problem'),
  '/opstack':ids('platform-console platform-settings platform-monthly account-invitations'),
  '/location-setup-step':ids('location-setup manage-users target-levels manage-kiosks'),
 };
 const common=ids('navigation switch-location profile-photo dark-mode platform-search access-problem save-conflict support-request');
 // These owned status slots also show live errors/availability messages. Hide
 // only the known explanatory copy, never the slot or an unknown/live result.
 const instructionText=[
  ['#ordering-budget-status',['Budget after this cart =']],
  ['#sales-budget-note',['Budget remaining =']],
  ['#report-status',['Showing saved weekly sales and costs.']],
  ['#report-finance-quality-note',['These totals use saved weekly reports.']],
 ];
 // Only app-owned containers are matched. Article bodies, course/checklist
 // content, message bodies, item names and business record headings are excluded.
 const bindings=[
  ['.ai-questions-dialog .ai-dialog-heading h2','intelligence-questions course-questions'],
  ['.ai-writing-dialog .ai-dialog-heading h2','intelligence-writing rich-content'],
  ['.hourly-import-dialog .ai-dialog-heading h2','hourly-import hourly-not-imported'],
  ['.ai-draft-dialog .ai-dialog-heading h2','@intelligence'],
  ['#stock-form-title','stock-settings count-sleeves order-rounding target-levels'],
  ['#account-form-title','manage-users account-invitations permissions'],
  ['#ops-editor-title','checklist-builder checklist-responses intelligence-checklists'],
  ['#ops-planner-title','checklist-planners hourly-checklists checklist-audiences intelligence-planners'],
  ['#ops-view-title','@checklists'],
  ['#ops-active-title','@checklists'],
  ['#learning-view-title','@training'],
  ['#report-detail-title','report-details report-exports'],
  ['#report-progress-title','operational-reports training-reports checklist-history'],
  ['#communications-view-title','publish-post required-reading team-chat'],
  ['#labels-view-title','print-labels label-templates'],
  ['#shift-clock-location','shift-clock early-start clock-breaks clock-problem'],
  ['#user-profile-title','profile-photo dark-mode switch-location'],
  ['#user-greeting','home-dashboards home-layout'],
  ['#users-company-name','manage-users permissions account-invitations'],
  ['.app-search-heading>span:first-child','platform-search'],
  ['#location-setup-title','location-setup'],
  ['#location-setup-step-title','location-setup'],
  ['#phone-roster-location','view-roster roster-forecasts'],
  ['.learning-canvas-toolbar h2','course-builder course-questions intelligence-questions'],
  ['.learning-properties-heading','course-questions'],
  ['.supplier-delivery-plans h3','delivery-dates delivery-cutoffs delivery-exceptions'],
  ['#ai-settings-panel h2','intelligence-setup intelligence-appearance intelligence-limits'],
 ];
 const dynamicTitles={
  'Course builder':'course-builder course-questions intelligence-questions',
  'Course planner':'assign-training', 'Assign course':'assign-training',
  'Supplier delivery days':'delivery-dates delivery-cutoffs delivery-exceptions',
  'Location settings':'locations location-setup trading-hours location-managers location-email delivery-dates',
  'Managers':'location-managers', 'Devices':'manage-kiosks',
  'Stock transfers to approve':'transfer-approvals', 'Approve stock receipt':'transfer-approvals stock-transfers',
  'Today at a glance':'home-dashboards hourly-projections roster-forecasts',
  'Delivery tracking':'receiving-orders', 'Import weekly sales':'weekly-import',
  'Double check your order':'place-order shared-cart order-confirmation',
  'OpStack intelligence reports':'scheduled-reports reports-not-arriving',
  'Manage categories':'library-categories', 'Create article':'publish-library intelligence-writing rich-content', 'Edit article':'publish-library intelligence-writing rich-content',
  'Label designer':'label-templates', 'Edit field':'label-templates',
  'Home greeting':'home-layout', 'Add a section':'home-layout', 'Add quick link':'home-layout',
  'Order delivery':'supplier-contacts order-not-sent', 'Order confirmation':'order-confirmation',
  'Order items':'order-history', 'Choose stock':'order-history',
  'Employment & award':'award-settings labour-settings', 'Written part-time work pattern':'award-settings',
  'Read invoice with OpStack intelligence':'intelligence-invoices scan-invoice invoice-prices',
  'New permission level':'permissions', 'Edit permission level':'permissions',
 };
 function resolve(value,path,hash='',title=''){
  if(value==='@page')return pages[path]||common;
  if(value==='@intelligence')return ids(/planner/i.test(title)?'intelligence-planners checklist-planners':/course/i.test(title)?'course-builder intelligence-questions':'intelligence-checklists checklist-builder');
  if(value==='@checklists')return ids(hash.includes('history')?'checklist-history':hash.includes('templates')?'checklist-builder checklist-planners':'complete-checklist checklist-history');
  if(value==='@training')return ids(hash.includes('in-store')?'in-store-training':hash.includes('progress')?'training-reports':hash.includes('builder')?'course-builder course-questions intelligence-questions':hash.includes('courses')?'assign-training course-builder':'take-course');
  return ids(value);
 }
 return{pages,common,bindings,dynamicTitles,instructionText,resolve};
});
