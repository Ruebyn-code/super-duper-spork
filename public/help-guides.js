(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.opstackHelp=value;})(globalThis,()=>{
 const categories=[
  ['getting-started','Getting started','Find your way around and personalise your account.','compass'],
  ['ordering','Ordering & stock','Place orders, count stock and manage your catalogue.','bag'],
  ['deliveries','Supplier deliveries','Plan deliveries, avoid shortages and record arrivals.','truck'],
  ['sales','Sales & projections','Enter sales, import reports and understand forecasts.','chart'],
  ['expenses','Invoices & expenses','Scan invoices and keep weekly costs accurate.','receipt'],
  ['rosters','Rosters & time','Plan shifts, clock work and review timesheets.','calendar'],
  ['checklists','Checklists & planners','Build procedures and schedule the right work.','check'],
  ['training','Training','Build courses, assign learning and track completion.','cap'],
  ['knowledge','Knowledge Library','Find and publish your company’s information.','book'],
  ['comms','Comms','Message your team and share important updates.','chat'],
  ['reporting','Reporting','Understand performance and compare locations.','bars'],
  ['intelligence','OpStack intelligence','Set up intelligence and review its suggestions.','sparkles'],
  ['administration','Locations & settings','Manage locations, users, permissions and appearance.','settings'],
  ['labels','Labels','Design, prepare and print prep labels.','label'],
  ['troubleshooting','Troubleshooting & support','Resolve common problems and prepare a support request.','help']
 ].map(([id,title,description,icon])=>({id,title,description,icon}));
 const articles=[];
 const add=(category,id,title,description,steps,options={})=>articles.push({category,id,title,description,steps,notes:[],related:[],keywords:[],...options});
 let c='getting-started';
 add(c,'navigation','Find your way around OpStack','Use the main navigation, permanent left subpage bar and blue account dropdown.',[
  'Use the main navigation at the top to open a feature. On phones, Home, Rostering, Comms, Checklists and More remain in the bottom bar.',
  'Use the permanent bar on the left to switch between that feature’s subpages. Larger screens show labels; phones keep a compact icon bar. The selected subpage stays highlighted.',
  'Open the blue account dropdown for User profile, Dark mode, Help & support and your available Settings.',
  'Use browser Back and Forward to return to earlier screens. Save or resolve outstanding changes before leaving an editor.'
 ],{popular:true,related:['switch-location','platform-search','permissions'],keywords:['menu','blue dropdown','phone','navigation','help support']});
 add(c,'switch-location','Switch company or location','Make sure you are working in the correct store.',[
  'Select the company logo to choose one of your accessible companies.',
  'Open the location selector and choose the store you need. The app remembers your last location within each company during your sign-in session.',
  'Check the selected company and location before entering sales, counts, orders or settings.',
  'Save or discard open drafts when prompted before switching.'
 ],{notes:['A paired kiosk is fixed to its assigned location. If a company or location is missing, ask a user manager to review your access.'],related:['companies','manage-users','kiosk-use']});
 add(c,'home-dashboards','Understand your Home dashboards','Use a company-styled business overview or a store’s daily dashboard.',[
  'Open the location selector and choose Head Office. Authorised managers can create it by selecting this option if it is missing. It opens without a store setup checklist. Selecting a store shows its Store dashboard; Staff profiles keep an operational dashboard without sales.',
  'On Head Office, choose accessible locations and a week. Use Daily or Weekly on the Sales leaderboard; gold, silver and bronze medals and row highlights mark the top three places. Daily has its own date selector. Open a location row to see Reporting for those dates.',
  'Your greeting sits at the top of the company-tinted Your work panel. The Home guide and selected store’s details sit beside the dashboard name. Review your active checklists, training and trainer sign-offs. Unread Comms is grouped into Groups, Direct messages and Posts, with avatars and unread badges. Choose an item to open its normal screen. Use Show all for more items; completing work or marking posts read removes them after refresh.',
  'On a store dashboard, use Today and This hour for projected sales and labour budget, compare saved hourly sales, and review ordering, checklists, published staff shifts and quick links.',
  'Use Edit Home on a computer to customise the company layout. Head Office, Store and Staff layouts are independent; existing custom sections and the company’s colours, fonts and logos are retained.'
 ],{route:'/home',permissions:['home.view'],notes:['The Sales leaderboard uses saved revenue: complete Weekly report channels first, otherwise Daily sales. Weekly ranks completed days through yesterday in Melbourne; past weeks include all seven days. Missing days leave a location unranked and show its coverage. Real zeroes can rank, and tied totals share a place. Custom Head Office layouts can add Sales leaderboard through Edit Home. Staff Home does not change permission to open Sales elsewhere. Head Office filters are read-only and never switch the operational location. Sales use complete saved weekly revenue channels where available, otherwise Daily sales; future days are excluded. Financial percentages use saved weekly costs divided by recorded sales, so a partial week may show a high percentage. Food cost uses saved invoices plus confirmed cost transfers, never order totals. Ordering projections keep their normal Sunday rollover and original/updated COGS rules; the Head Office budget excludes carts. Staff on now means published shifts scheduled at this time. Checklist summaries retain the existing audience and date rules. Assigned location managers still see eligible transfer approvals, and the Store daily-sales reminder retains its selected trading location. New administrative Head Office locations need no setup and are excluded from store forecasts. Head Office has no daily-sales entry panel; use Sales → Daily sales with the usual permission.'],related:['permissions','daily-sales','hourly-import','transfer-approvals','home-layout']});

 add(c,'profile-photo','Add or change your profile photo','Give your account a recognisable photo.',[
  'Open the blue account dropdown and choose User profile.',
  'Choose a photo and check its square preview.',
  'Press Save photo to apply it. Choosing a file alone does not save it.',
  'Use the photo removal control to return to initials when needed.'
 ],{notes:['Authorised user managers can also edit photos in Admin → Users. Your profile shows the company, location and access from your current session.'],related:['manage-users'],keywords:['avatar','picture','image','account']});
 add(c,'dark-mode','Switch between light and dark mode','Set the display theme for your account in this browser.',[
  'Open the blue account dropdown.',
  'Select Dark mode to change the theme.',
  'The choice follows you between app pages and synchronises with your other open tabs in this browser.'
 ],{notes:['Until you choose a mode, the app follows your device preference. Printed reports use the light palette. Company logos and uploaded images keep their original colours.'],keywords:['theme','night','appearance']});
 add(c,'platform-search','Find pages and answers with platform search','Search app features and accessible content from the shared search bar.',[
  'Use the search bar at the top. On a phone, press the search icon to expand it.',
  'Type a page name, item or question, such as “how to make gourmet souvlaki”. Ordinary matches appear as you type.',
  'Select a result to open its page, article or matching article section. Available image and video previews come from the accessible content.',
  'For an intelligence search, submit the question with the search arrow or Enter without a highlighted result. A clear single match may open automatically; otherwise choose a result.'
 ],{popular:true,notes:['Typing ordinary matches uses local search. Submitted intelligence searches use your company’s enabled intelligence settings and request allowance. Results follow your current access.'],related:['read-library','intelligence-setup'],keywords:['deep search','AI','find','article','video','recipe']});
 add(c,'kiosk-use','Use a shared kiosk','Open the normal app with your own permissions on a paired device.',[
  'At the kiosk, enter your staff PIN: the last four digits of your saved phone number, including any leading zeroes.',
  'Open the feature you need. The app uses your account’s permissions and the device’s assigned location.',
  'Use the left navigation rail, expanded search and blue account dropdown to move around.',
  'Choose Lock kiosk when finished. The kiosk also locks after two minutes without interaction.'
 ],{notes:['Clock actions require a fresh PIN check even after unlocking the kiosk. Ask a user manager to correct a missing phone number or duplicate phone ending.'],related:['manage-kiosks','shift-clock','manage-users'],keywords:['device','tablet','PIN','lock']});

 c='ordering';
 add(c,'place-order','Place an order','Build a cart and double-check it before submitting.',[
  'Select the correct location, then open Ordering → Catalogue.',
  'Choose a supplier or search for an item. Enter quantities in the item’s displayed ordering unit and add them to the cart.',
  'Open the floating Cart button, check the supplier groups, quantities, estimates and delivery dates, and add notes.',
  'Press Place order to open Double check your order. Review the breakdown, then press the final Place order button.',
  'Read each supplier’s sending result and use Order history to review the saved order.'
 ],{popular:true,route:'/',permissions:['orders.view'],notes:['A saved order and a sent supplier email are separate outcomes. “Submitted” means the sending service accepted the request, rather than proof the supplier read it.'],related:['shared-cart','order-not-sent','delivery-dates','order-history'],keywords:['purchase','submit stock request','checkout','buy']});
 add(c,'shared-cart','Use the cart across Ordering pages','Keep one cart while counting, reviewing history or managing stock.',[
  'Use the floating Cart button on Catalogue, Stock count, Order history, Transfers or stock-management pages.',
  'Adjust quantities or remove items in the popup. Stock count’s Add to cart uses the same cart.',
  'Check the weekly budget and supplier delivery guidance before ordering.',
  'Cancel the final review if you need to change anything; your cart and notes remain available.'
 ],{route:'/#cart',permissions:['orders.view'],notes:['Carts are separate for each user and location in this browser. Placing or editing quantities requires order-placing permission. Opening the cart does not place an order.'],related:['place-order','ordering-budget']});
 add(c,'order-history','Find, edit, add or delete past orders','Keep order history complete for the selected location.',[
  'Open Ordering → Order history. Filter by dates, supplier or order reference and choose View order.',
  'To correct a placed order, select Edit order. Change items, quantities, unit prices, reference or notes, then select Save changes.',
  'To add a missed order, choose Record past order, enter its original date and use the supplier/category cards to add items.',
  'Review quantities and historical prices, then choose Save to history. This records the order without emailing the supplier.',
  'To remove an incorrect order, open its details, select Delete order and confirm.'
 ],{route:'/order-history',permissions:['orders.view'],notes:['Editing, adding and deleting require order-placing permission. Edits retain the original order date and a private audit, update order-based costs and usage, and send no supplier email or confirmation. Invoice-based weekly expenses keep their saved values. Pending prices may remain blank; zero is a known zero price.','If an order, its prices or delivery tracking changes while editing, your draft is kept. Reload latest explicitly discards that draft and opens the current order. An uncertain save freezes its details for the same-request retry.','Deleting excludes the order from order-based budgets, usage and reports; it does not cancel an order with a supplier. Orders still being sent cannot be edited or deleted. A received supplier must retain at least one item.'],related:['receiving-orders','stock-price-changes'],keywords:['edit order','amend','change quantity','pending price','missed order','manual order','past','remove','SGR-MER-0001','order number']});
 add(c,'stock-count','Enter and save a stock count','Use compact rows to record the stock physically present.',[
  'Open Ordering → Stock count and select New count. Check the count date.',
  'Filter by storage group or search. Enter quantities next to each item; leave uncounted items blank and enter 0 for none.',
  'Use Enter, Down or Right to move to the next visible count field. Up, Left or Shift+Enter moves back.',
  'Review the recommended order beside Add to cart. Adding a recommendation is a separate action from saving the count.',
  'Save the count explicitly, then use History to check its saved snapshot.'
 ],{popular:true,route:'/stock-count#new',permissions:['counts.view'],notes:['Counts support three decimal places. Browser drafts help retain unfinished work, but only the save action records a shared count.'],related:['count-sleeves','target-levels','delivery-quantities','count-history'],keywords:['stocktake','inventory','quantity','input','keyboard']});
 add(c,'count-sleeves','Count sleeves or smaller packs','Convert a physical smaller-pack count into ordering units.',[
  'Open Ordering → Stock items, edit the item and choose Pack & counting.',
  'Keep Unit amount as the ordered pack, such as “Box of 1,000 cups”. Set Count in smaller packs to Sleeves and 20 per ordered unit.',
  'Save changes, then enter sleeves in Stock count. For example, 10 sleeves is 0.5 of that box.',
  'Check the conversion shown beside the count before saving.'
 ],{route:'/admin#stock',permissions:['stock.manage'],notes:['Targets, prices, recommendations and supplier orders remain in ordered packs. A changed conversion must be reviewed before an older count draft is saved.'],related:['stock-count','stock-settings'],keywords:['selves','sleeves','cups','20 x 50','pack conversion']});
 add(c,'count-history','Review count history and usage','Understand saved stock snapshots and completed usage cycles.',[
  'Open Stock count → History to find a saved count and review its item quantities and units.',
  'Open Weekly usage to inspect the Sunday–Saturday cycles and storage groups.',
  'Compare opening count, orders and confirmed transfer effects with the following Sunday’s closing count.',
  'Investigate missing counts or negative usage before relying on the automatic target.'
 ],{route:'/stock-count#usage',permissions:['counts.view'],notes:['A stock count is a snapshot, so several counts are not added together as stock on hand. Missing quantities remain unknown.'],related:['target-levels','stock-transfers']});
 add(c,'target-levels','Understand automatic and manual target levels','Use completed item usage to guide replenishment.',[
  'Review Target level beside an item in Ordering or Stock count.',
  'The ordinary weekly target averages up to four completed Sunday–Saturday usage cycles and rounds up to whole ordered packs.',
  'If no usable cycle exists, an authorised stock manager can edit the item → Ordering rules → Manual target level for the selected location.',
  'Save changes. Completed usage supersedes the manual fallback as soon as it becomes available.'
 ],{route:'/stock-count#usage',permissions:['counts.view'],notes:['Two Sunday counts can provide the first completed cycle; five consecutive Sunday counts can provide four. Zero usage is valid. An active timed delivery plan uses a delivery-coverage target for recommendations while retaining the saved weekly target.'],related:['order-when','delivery-quantities','stock-settings'],keywords:['par','manual par','four weeks','average','usage']});
 add(c,'order-when','Understand the automatic Order when level','Know when the system recommends replenishing stock.',[
  'Find Order when in the item’s Ordering details or Stock count row.',
  'Without an active timed delivery plan, it is based on average weekly usage across the available completed cycles.',
  'Above that level, the recommendation is zero. At or below it, the system recommends enough to reach the target, subject to ordering rules.',
  'Use your physical stock count and review the suggestion before adding it to the cart.'
 ],{notes:['For a target of 10 boxes with 10 in stock, no additional boxes are needed. Delivery plans replace the weekly trigger with delivery coverage. Order when is calculated automatically.'],related:['target-levels','delivery-quantities'],keywords:['reorder','trigger','minimum stock','10 boxes']});
 add(c,'stock-settings','Add or edit stock items','Keep item details, pack sizes and ordering rules together.',[
  'Open Ordering → Stock items. Choose Add new stock or the pencil beside an existing item.',
  'Use Item details for name, supplier, price, supplier SKU, category and optional photo.',
  'Use Pack & counting for unit amount, storage group and smaller-pack conversion.',
  'Use Ordering rules for minimum quantities, rounding and the selected location’s manual target.',
  'Press Save changes once for the whole popup. Correct any highlighted field if its tab opens.'
 ],{route:'/admin#stock',permissions:['stock.manage'],notes:['Close retains the current item’s draft for reopening; Cancel edit discards it. Remove stock is inside Item details → More actions. Company stock changes apply across that company.'],related:['count-sleeves','order-rounding','stock-price-changes'],keywords:['catalogue','SKU','photo','category','item settings']});
 add(c,'order-rounding','Set minimum quantities and rounding','Match recommendations and cart quantities to supplier pack rules.',[
  'Edit a stock item and open Ordering rules.',
  'Set Minimum order quantity, then choose Minimum only, Multiples of minimum, Custom cutoff or Separate up/down cutoffs.',
  'For multiples of 15, a requirement of 19 rounds to 30. For a custom cutoff of 5, 19 rounds to 15 and 20 rounds to 30.',
  'Save changes and review any cart notice about updated quantity rules.'
 ],{route:'/admin#stock',permissions:['stock.manage'],notes:['Rules apply to positive ordered quantities and use ordered units/packs. Saved historical quantities remain as recorded. The live cart limit is 999 per item.'],related:['stock-settings','place-order']});
 add(c,'supplier-contacts','Add suppliers and order recipients','Configure the supplier side of order delivery.',[
  'Open Ordering → Suppliers & delivery and add or edit a supplier.',
  'In Order delivery, select the sending method and save the correct email recipient or other required contact details.',
  'Assign stock items to the supplier in their item settings.',
  'Configure each location’s separate Sending settings and delivery schedule.'
 ],{route:'/admin#suppliers',permissions:['suppliers.manage'],notes:['Supplier contacts belong to the company catalogue. Sender email and API key belong to the location. Both sides must be configured for email sending.'],related:['location-email','delivery-dates','order-not-sent']});
 add(c,'stock-price-changes','Understand stock price updates','See how a price change affects recent order values.',[
  'Change an item’s price in Stock items, or confirm reviewed price updates from an invoice.',
  'The effective price also updates the latest non-deleted order containing that item at each compatible location in the company.',
  'Open Order history to see Stock prices updated, the original prices and the revised total.',
  'Review ordering budgets and order reports using the revised values.'
 ],{notes:['Previously sent emails retain their original estimates. Weekly financial Cost of goods uses saved invoices rather than these order totals.'],related:['invoice-prices','order-history','invoice-expenses']});
 add(c,'stock-transfers','Transfer stock between locations','Record a transfer and confirm its arrival.',[
  'Open Ordering → Stock transfers and create a transfer for an accessible destination.',
  'Choose items, check the receiving units and quantities, and review any cost movement before submitting.',
  'The receiving location reviews the pending transfer and explicitly confirms receipt.',
  'Use transfer history to check its status. Pending transfers do not move stock until confirmed.'
 ],{route:'/stock-transfers',permissions:['transfers.view'],notes:['Cross-company transfers require compatible item mapping and the appropriate access. Review snapshots carefully; receiving applies the saved movement.'],related:['transfer-approvals','stock-count']});
 add(c,'transfer-approvals','Approve incoming transfers from Home','Show receipt approvals to assigned location managers.',[
  'Assign the receiving manager under Edit location → Managers.',
  'Give that account Home, View stock transfers and Receive stock transfers permissions.',
  'With the receiving location selected, open Home and choose Review transfer in the pending panel.',
  'Check every item and choose Approve receipt only when the stock has arrived.'
 ],{route:'/home',permissions:['home.view'],notes:['Manager dashboard choice alone does not qualify. Only the first five pending transfers appear on Home; All transfers opens the full list.'],related:['location-managers','stock-transfers','permissions']});

 c='deliveries';
 add(c,'delivery-dates','Set supplier delivery days for a location','Give each store its own regular and one-off supplier schedule.',[
  'Open Admin → Locations → Edit location → Supplier delivery days.',
  'Find the supplier and select its regular Monday–Sunday delivery days.',
  'Expand Delivery timing & exceptions to add lead time, cutoff, arrival time or one-off changes.',
  'Press the location popup’s Save settings. Review the resulting estimates in Ordering and the cart.'
 ],{popular:true,route:'/admin/accounts#locations',permissions:['locations.manage'],notes:['Schedules are independent for each location. Fill all three timing fields to enable delivery-based recommendations.'],related:['delivery-cutoffs','delivery-quantities','delivery-exceptions'],keywords:['supplier','delivery schedule','Tuesday','Friday']});
 add(c,'delivery-cutoffs','Set lead time and order cutoffs','Estimate the next delivery still available to order.',[
  'Expand a supplier’s Delivery timing & exceptions in location settings.',
  'Set lead time in calendar days, Order cutoff and expected Delivery time. Same-day cutoffs must be earlier than arrival.',
  'For Tuesday/Friday delivery with one day’s lead time and a 2 pm cutoff, order before Monday 2 pm for Tuesday. After that, Friday is the next eligible estimate.',
  'Save settings and check Order by and Estimated delivery in the cart and review.'
 ],{route:'/admin/accounts#locations',permissions:['locations.manage'],notes:['Timing follows the location state’s capital-city timezone, with Melbourne used when no state is set. Cutoffs are planning guidance; placing an order remains an explicit action.'],related:['delivery-dates','delivery-exceptions']});
 add(c,'delivery-quantities','Understand delivery-based recommended quantities','Cover expected usage until the delivery after your next delivery.',[
  'Set regular delivery days and complete lead time, cutoff and arrival time for the supplier.',
  'The app estimates usage from now until the following arrival using completed item usage and available sales forecast patterns.',
  'Estimated available stock and eligible confirmed incoming quantities reduce the recommendation. For 10 needed, 3 available and 2 incoming, the starting recommendation is 5.',
  'In Stock count, enter the physical quantity to calculate the recommendation against that count. Check shortage and overdue warnings before adding it.'
 ],{notes:['Incoming stock must arrive before the end of the coverage period. Unknown or overdue deliveries need review. Ordering’s available-stock estimate needs a saved count no more than 28 days old; a fresh physical count is preferable. Missing sales uses average weekly usage spread across days; missing item usage retains the normal/manual fallback.'],related:['delivery-shortages','receiving-orders','target-levels','stock-count']});
 add(c,'delivery-shortages','Understand shortage and overdue warnings','Check whether stock can last until the next arrival.',[
  'Read May run out before delivery beneath an item in Ordering or beside its Stock count details.',
  'Check the most recent count and any received stock, then verify pending orders and their arrival dates.',
  'Use Order history to confirm an externally placed order, correct its delivery date or record its receipt.',
  'If stock is genuinely insufficient, arrange the appropriate supplier action and place an order explicitly.'
 ],{notes:['Overdue and unconfirmed orders are flagged separately instead of being treated as assured incoming stock. A recommendation cannot make a supplier deliver earlier.'],related:['delivery-quantities','receiving-orders','stock-count']});
 add(c,'receiving-orders','Confirm orders and mark deliveries received','Track each supplier’s outstanding and received goods.',[
  'Open Order history → View order → Delivery tracking.',
  'Use Confirm ordered for stock actually ordered externally or not confirmed by the sending service, and enter its expected date.',
  'Use Change delivery date to correct an outstanding estimate.',
  'When every item from that supplier arrives, choose Mark received, check the items and press Confirm received.'
 ],{popular:true,route:'/order-history',permissions:['orders.view'],notes:['Suppliers in one order can be received separately; each confirmation covers that supplier’s full delivery. Receipts enter estimated stock once, and later counts prevent double credit. Older historical receipts update history only unless an outstanding future order was explicitly included in planning. These actions do not resend supplier emails.'],related:['delivery-quantities','order-history'],keywords:['arrived','receipt','part received','confirm ordered']});
 add(c,'delivery-exceptions','Skip holidays or change a delivery date','Handle public holidays, cancelled days and extra deliveries.',[
  'Set the location’s state, then open Supplier delivery days → Delivery timing & exceptions.',
  'Turn on Skip public holidays when the supplier does not deliver on the location’s holidays.',
  'Add a dated exception and choose to skip that delivery or allow an extra delivery.',
  'Save settings and review the next eligible delivery. For an already placed order, correct its expected date separately in Order history.'
 ],{route:'/admin/accounts#locations',permissions:['locations.manage'],notes:['Dated exceptions override regular weekdays and holiday skips. A holiday calendar is required for holiday skipping; reviewed location calendars take priority.'],related:['public-holidays','delivery-dates','receiving-orders']});

 c='sales';
 add(c,'daily-sales','Enter daily sales from Home or Sales','Save a daily total and find it again in history.',[
  'Check the location and trading date shown in Home’s Daily sales reminder, or open Sales → Daily sales and select the week.',
  'Enter the daily total. Use 0 for a recorded zero-sales day and leave unknown days blank.',
  'Press Save sales and wait for confirmation.',
  'Use Daily sales history to open the matching week and verify the saved amount.'
 ],{popular:true,route:'/sales#entry',permissions:['sales.view'],notes:['The Home reminder is available on Store dashboards only. Head Office users enter daily totals through Sales → Daily sales. Daily sales and Weekly report are separate inputs. A complete Weekly report revenue breakdown takes priority for forecasting without overwriting the Daily sales entry.'],related:['overnight-sales','weekly-report','sales-projections','sales-missing'],keywords:['daily total','saved sales','homepage']});
 add(c,'overnight-sales','Enter sales for stores closing after midnight','Keep late-night sales attached to the correct trading day.',[
  'Save accurate opening and closing times for every trading day in location settings.',
  'Check Home’s displayed trading date before entering sales after midnight.',
  'An overnight period stays associated with the day it opened until its saved closing time.',
  'Use Home’s Daily sales history link to open that trading week, including Sunday-night entries saved early Monday.'
 ],{route:'/home',permissions:['home.view'],notes:['Closing exactly at midnight completes that trading period. A closing time earlier than opening is the following day; equal times represent 24 hours.'],related:['trading-hours','daily-sales','hourly-import']});
 add(c,'weekly-report','Complete a weekly sales report','Reconcile sales channels and save the week’s financial entries.',[
  'Open Sales → Weekly report and select the location and Monday–Sunday week.',
  'Enter Till sales, Cash, Eftpos, Petty cash, Uber Eats and DoorDash. Arrow keys and Enter move between entry fields.',
  'Record actual zeroes for unused channels; leave unknown amounts blank.',
  'Review the expense views and platform fee tables, then press Save weekly report.',
  'Use Overview to compare saved weekly sales, cost percentages and profit.'
 ],{route:'/sales#report',permissions:['finances.view'],notes:['Report sales = Till + Uber Eats + DoorDash. Cash variance = Cash + Eftpos + Petty cash − Till. Platform fees are shown separately from profit. Invoice totals supply Cost of goods.'],related:['weekly-import','invoice-expenses','weekly-costs','platform-fees']});
 add(c,'weekly-import','Upload a weekly sales report','Review an Excel, PDF or photo report before importing its sales and platform fees.',[
  'Open Sales → Weekly report and choose Upload sales report. Select the location the report belongs to.',
  'Choose an Excel (.xlsx), PDF, JPEG/JPG, PNG or WebP report up to 5 MB. Excel opens its preview directly. For a scan, select up to three PDF pages and check the text and images to send.',
  'For a PDF or photo, choose Read report · OpStack intelligence. Check and edit the extracted Monday–Sunday dates, sales channels, printed totals and weekly platform fees. Reading does not save sales.',
  'For a scan, check the report location, tick the location confirmation and choose Review import. Review the dated weeks and totals, then choose Import weeks to save.',
  'Check the imported week. Matching values are retained, missing values filled, and a whole week with conflicting saved figures is skipped.'
 ],{route:'/sales#report',permissions:['finances.view'],notes:['PDFs and photos require enabled company OpStack intelligence and use its request limit and budget. Excel does not use intelligence. Only reviewed sales and platform fees are imported; Daily sales, labour, operating expenses, R&O and invoices remain separate. Blank fields stay unrecorded; enter zero only when known. Recalculate and save Excel formulas before uploading if their saved values are missing.'],related:['weekly-report','sales-projections','intelligence-setup'],keywords:['Excel','XLSX','PDF','JPEG','JPG','PNG','WebP','image','photo','scan','upload workbook']});
 add(c,'sales-projections','Understand daily and weekly projected sales','See which saved sales determine the forecast.',[
  'Open Sales → Projection & budget to view the source weeks and any missing-history explanation.',
  'Normal forecasts use four completed Monday–Sunday weeks, averaging corresponding weekdays.',
  'For each past day, a complete Weekly report Till + Uber Eats + DoorDash total takes priority; otherwise the saved Daily sales amount is used.',
  'Correct missing historical sales and save. Forecasts refresh from the saved inputs.'
 ],{route:'/sales#projection',permissions:['sales.view'],notes:['At midnight Sunday in Melbourne, Home, Ordering and Sales weekly forecasts switch to the upcoming Monday–Sunday week. Actual current-week comparisons retain their dates. Holidays can use the prior-year method instead.'],related:['holiday-forecasts','ordering-budget','hourly-projections'],keywords:['four weeks','projection','next week','Sunday']});
 add(c,'public-holidays','Set automatic public holidays','Use the right Australian holiday calendar at each location.',[
  'Open Admin → Locations → Edit location → General.',
  'Choose State or territory and press Save settings.',
  'Look for a solid blue star on holiday dates in Home, Daily sales, Weekly report and Rostering.',
  'For regional or special exceptions, an authorised manager can review the location calendar in Settings → Award compliance → Public holidays.'
 ],{route:'/admin/accounts#locations',permissions:['locations.manage'],notes:['State holidays fill automatically, including Easter and substitute dates. Reviewed calendars override automatic dates for that year. Payroll award calculations still require their own reviewed calendar.'],related:['holiday-forecasts','delivery-exceptions','award-settings'],keywords:['blue star','state','territory','calendar','Easter','public holiday']});
 add(c,'holiday-forecasts','Understand holiday forecasts and yearly growth','Adjust the same named holiday’s prior-year sales for growth.',[
  'Choose the location’s state and ensure its historical sales are complete.',
  'For a holiday, the app looks for the same uniquely named holiday in the previous year, even when its date moves.',
  'It adjusts that day’s revenue by comparable total sales growth or decline since the previous holiday.',
  'Review the holiday, previous date, growth percentage or fallback explanation in the projection.'
 ],{notes:['Last year’s $2,000 holiday becomes $2,400 when the comparable sales increase is 20%. Missing or ambiguous history keeps the normal forecast with an explanation. Normal days keep the four-week method.'],related:['public-holidays','sales-projections','hourly-projections']});
 add(c,'hourly-import','Scan and submit hourly sales reports','Import reviewed hourly amounts from spreadsheets, PDFs or images.',[
  'Open Sales → Hourly sales → OpStack intelligence · Upload report, or Scan hourly sales report on Manager Home.',
  'Choose a CSV/XLSX report, PDF or supported image. Review its source text and selected pages, then press Read report.',
  'Check dates, location, printed time intervals, hourly amounts and totals. Select Trading day or Calendar day if requested.',
  'Only select the full-day option when unlisted hours truly mean $0. Use Replace differing saved hours only for an intended correction.',
  'Press Submit hourly sales in the popup footer. Wait for confirmation, then view the imported date.'
 ],{popular:true,route:'/sales#hourly',permissions:['sales.view'],ai:true,notes:['11:01–12:00 means sales in the hour starting at 11, not the hour starting at 12. Times display in AM/PM. Calendar-day conversion needs all seven trading-hour entries. Scanning alone does not save hourly sales or the Daily sales total.'],related:['hourly-projections','trading-hours','intelligence-setup','hourly-not-imported'],keywords:['submit','hourly scan','report upload','PDF','CSV','XLSX','photo']});
 add(c,'hourly-projections','Understand hourly sales projections','Distribute the daily forecast using complete hourly history.',[
  'Open Sales → Hourly sales, select a trading date and compare the chart and hourly table.',
  'Normal days use complete same-weekday hourly profiles from the same four completed weeks as the daily forecast.',
  'A matching prior holiday can supply its own hourly profile for a holiday forecast.',
  'Open Rostering’s Hourly sales projections panel to use the same forecast while planning staff.'
 ],{route:'/sales#hourly',permissions:['sales.view'],notes:['Projected hours add up to the shared daily forecast. Missing profiles show an explanation. After-midnight hours are marked +1 day and remain with the opening trading date. Forecast calculations do not make intelligence requests.'],related:['hourly-import','sales-projections','roster-forecasts']});
 add(c,'ordering-budget','Understand the weekly ordering budget','Compare forecast-based spending allowance with orders and cart.',[
  'View Projection & budget, Ordering or the cart.',
  'The ordering budget is projected weekly sales × 28%.',
  'In Ordering, review Available after cart and the budget-used bar, including saved order costs, net stock-cost transfers and this cart. Review cart opens the existing cart.',
  'Compare both COGS estimates: Original projection uses the original forecast; Updated projection adds or subtracts how much saved sales are above or below forecast so far. Each is green within budget and red over.'
 ],{route:'/sales#projection',permissions:['sales.view'],notes:['Both COGS estimates use allocated saved-order costs, including net cost transfers, plus the current cart where available. Original projection divides those costs by original projected sales; Updated projection divides them by the original weekly sales forecast plus the dollar variance so far. Each is shown as a percentage with its own budget colour. Weekly financial COGS uses saved invoices. The original forecast, 28% budget and budget-used bar keep their planning basis.','Expected sales uses complete Weekly report Till + Uber Eats + DoorDash for each recorded day, otherwise Daily sales. Subtract the holiday-adjusted forecast for those same days from actual sales. A $7,000 original week plus $400 above forecast becomes $7,400; $400 below becomes $6,600. Unrecorded days keep their original forecasts. Missing past sales remain estimated. Partial hourly reports and future-entered totals are excluded.','With no comparable sales, COGS uses the baseline forecast. Missing or zero expected sales and pending prices show a neutral dash. COGS is green at or below the budget percentage and red above it, using unrounded amounts.','On Sunday, the displayed forecast and budget move to the upcoming week. Its updated projection starts from its own forecast, without carrying the previous week’s dollar variance.','Ordering shows Near budget at 90% used and Over budget when the cart exceeds the remaining amount. The exact percentage can exceed 100%, while the bar stops at full. Retry budget reloads figures after a connection problem.','Saved orders count even if supplier sending failed. Pending prices keep the remaining budget unknown. Budget warnings are guidance and do not block an explicit order.'],related:['sales-projections','place-order','stock-transfers']});
 add(c,'platform-fees','Record Uber Eats and DoorDash fees','Check platform deductions and expected payouts separately.',[
  'Open the selected week in Weekly report.',
  'Choose the Uber Eats or DoorDash overview card.',
  'Enter Fees, Marketing and Refunds, preserving genuine credit adjustments and using 0 for unused known fees.',
  'Review Total fees and Expected pay, then Save weekly report.'
 ],{route:'/sales#report',permissions:['finances.view'],notes:['Total fees = Fees + Marketing + Refunds. Expected pay = platform sales − Total fees. These figures stay separate from the app’s profit calculation.'],related:['weekly-report','report-details']});

 c='expenses';
 add(c,'scan-invoice','Scan, review and save an invoice','Store an invoice and its GST-inclusive total in a weekly bundle.',[
  'Open Home’s Invoice scanner and choose Take photo or Upload invoice. Supported files include PDF, JPEG, PNG and WebP.',
  'Review the detected supplier, invoice number, invoice date, subtotal, GST and total against the original.',
  'Check the bundle week, which can be changed independently of the invoice date.',
  'Review any proposed stock price changes, then choose Save invoice or Confirm price updates.',
  'Reopen the saved bundle to correct details, move the invoice, download the original or delete it with confirmation.'
 ],{popular:true,route:'/home',permissions:['home.view'],notes:['Normal scanning reads the document locally. Saving an invoice is the step that contributes its total to weekly costs. A missing total leaves the financial result incomplete.'],related:['invoice-prices','invoice-expenses','intelligence-invoices'],keywords:['OCR','photo','PDF','scan','weekly bundle']});
 add(c,'invoice-prices','Confirm stock prices detected on invoices','Apply reviewed price differences to existing company items.',[
  'Scan or upload an invoice and check its invoice date and transcription.',
  'Review Price updates. Matching uses a unique SKU first, then a unique item name, and shows differing current → new prices.',
  'Correct invoice details if needed, then press Confirm price updates to save the invoice and apply the reviewed differences.',
  'If another user changed a price or pack, review the refreshed comparison before confirming again.'
 ],{notes:['Applying prices requires invoice-editing and stock-management permission. Unknown items, ambiguous matches and unclear pack/tax conversions are skipped. Older invoices cannot replace newer invoice prices.'],related:['scan-invoice','stock-price-changes','stock-settings']});
 add(c,'invoice-expenses','Understand weekly Cost of goods','Use saved invoices as the week’s expense source.',[
  'Save each invoice in the correct location’s Monday–Sunday bundle.',
  'Open Sales → Weekly report → Cost of goods to review the saved invoice totals and eligible cost transfers.',
  'Correct an invoice total or bundle week in the invoice itself; the financial view recalculates from the saved document.',
  'Check that all invoices have known totals before relying on profit.'
 ],{route:'/sales#expense-stock',permissions:['finances.view'],notes:['No saved invoices means $0 in invoice expense. Missing totals keep costs incomplete. Orders and invoices are not added together as duplicate expenses.'],related:['scan-invoice','weekly-costs','business-reports']});
 add(c,'weekly-costs','Enter Labour and R&O expenses','Record weekly cost lines and distinguish zero from missing.',[
  'Open the correct week in Sales → Weekly report.',
  'Choose Labour to enter named hours × hourly rate lines, or R&O to enter named quantity × unit cost lines.',
  'Add, edit or remove the relevant entries. Use Record no cost when the category is a confirmed zero.',
  'Review the calculated totals and press Save weekly report.'
 ],{route:'/sales#expense-labour',permissions:['finances.view'],notes:['Weekly financial labour entries are separate from roster planning and timesheet approval. Unknown costs keep full profit incomplete.'],related:['operating-expenses','invoice-expenses','weekly-report']});
 add(c,'operating-expenses','Schedule operating expense bills','Spread a saved bill across the correct weeks exactly once.',[
  'Open Weekly report → Op Ex and choose or add an expense type.',
  'Enter the bill’s total cost, Monday start week and number of covered weeks.',
  'Choose Save expense to save it across those weeks, or Save weekly report to save pending bills with the report.',
  'Use Saved bills to edit or delete an existing bill. Add a separate bill when the previous coverage ends.'
 ],{route:'/sales#expense-operating-expenses',permissions:['finances.view'],notes:['A $100 bill over two weeks contributes $50 to each, then stops. Same-type overlapping bills are rejected. Rounding distributes cents so allocations equal the original total.'],related:['weekly-costs','report-details'],keywords:['Op Ex','electricity','rent','bill','schedule','allocation']});

 c='rosters';
 add(c,'view-roster','View your roster or the team roster','Find published shifts for your location and week.',[
  'Open Rostering and choose the week using arrows or the calendar.',
  'On a phone, use My roster for your shifts and Team roster for a day’s published team schedule.',
  'Check overnight labels and shifts continuing from the previous night.',
  'Close the phone popup to return to the app; Open roster reopens it.'
 ],{route:'/rostering#roster',permissions:['rostering.view'],notes:['Ordinary staff views show published work. Manager edits remain drafts until published.'],related:['make-roster','shift-clock','leave-availability']});
 add(c,'make-roster','Build and edit a roster','Plan draft shifts using Staff, Stacked or Day view.',[
  'Open the roster maker with roster-management access and select the week.',
  'Choose Staff, Stacked or Day view. Add a shift inside a day/staff cell and set its time, person and position.',
  'Move shifts with their grip; drag a Day-view bar to change staff or time. Check overlap or availability warnings.',
  'Review the autosave status and draft costs. Select a shift’s background and use Delete or Backspace to remove it; use Undo if needed.',
  'Use Copy previous week when appropriate, review the resulting draft and publish separately.'
 ],{route:'/rostering#roster',permissions:['rostering.view','rostering.manage'],notes:['Autosaving does not publish. Vacant shifts have unknown costs until assigned and priced.'],related:['publish-roster','roster-forecasts','labour-settings']});
 add(c,'publish-roster','Publish a reviewed roster','Make saved draft shifts visible to staff.',[
  'Check people, times, positions, breaks and the selected week.',
  'Resolve invalid or overlapping shifts and review availability, leave and cost warnings.',
  'Wait for draft saves to finish, then choose Publish roster.',
  'When award checks require a review note, review the warning and enter the required note before completing publication.'
 ],{route:'/rostering#roster',permissions:['rostering.view','rostering.manage'],notes:['Previously published schedules stay visible to staff until the next publication. A copied or autosaved draft is not yet published.'],related:['make-roster','award-settings']});
 add(c,'roster-forecasts','Use hourly sales and labour forecasts on rosters','Compare demand and budget while planning shifts.',[
  'Open the roster’s sales and budget summary with the required financial summary access.',
  'Expand Hourly sales projections and select a trading date. Day view follows its selected day.',
  'Compare the chart or hourly breakdown with planned staffing and the day’s budget.',
  'Review overnight hours marked +1 day and any missing-history explanation.'
 ],{route:'/rostering#roster',permissions:['rostering.view'],notes:['These are the same forecasts as Hourly sales. Viewing them does not import sales or change shifts. Staff without summary access keep the ordinary published-roster view.'],related:['hourly-projections','labour-settings']});
 add(c,'shift-clock','Start and finish a shift','Record your actual work using your unique staff PIN.',[
  'Open the blue Shift clock and enter the last four digits of your saved phone number.',
  'Choose Start shift when your assigned published shift is available.',
  'For each later action, enter your PIN again and choose the offered break or Clock out action.',
  'After clock-out, review your pending timesheet. Submit missing or unrostered work as a manual timesheet with a reason.'
 ],{popular:true,route:'/rostering#roster',permissions:['rostering.view'],notes:['Unlocking the keypad alone records nothing. A phone number is required and its four-digit ending must be unique across the network.'],related:['early-start','clock-breaks','timesheets','clock-problem'],keywords:['clock in','clock out','PIN','start shift']});
 add(c,'early-start','Request an early start','Ask an authorised manager to approve an earlier clock-in.',[
  'On the scheduled Melbourne day, enter your own PIN and select Start shift before the scheduled start.',
  'Ask a different authorised manager to enter their PIN in Manager approval.',
  'Complete the action and check that the actual start was recorded.'
 ],{notes:['The approver needs Review timesheets access for the location. Early-start approval records who approved it and does not replace overtime or award calculations.'],related:['shift-clock','timesheets']});
 add(c,'clock-breaks','Record rest and meal breaks','Track actual break starts and finishes.',[
  'Enter your PIN in Shift clock while working and choose an available required break.',
  'Return to the clock, enter your PIN again and choose End break when it finishes.',
  'Review prompts for additional breaks if the shift runs longer.',
  'Record a required reason for a break timing exception when prompted.'
 ],{notes:['Paid rest breaks remain paid. Actual unpaid meal duration is recorded. Managers remain responsible for arranging appropriate breaks.'],related:['shift-clock','timesheets','award-settings']});
 add(c,'timesheets','Submit, correct and approve timesheets','Review worked hours and preserve the reason for corrections.',[
  'Open Rostering → Timesheets and choose the location and week.',
  'Review actual start/end times and recorded unpaid breaks. Submit a manual entry with a reason if work is missing.',
  'An authorised reviewer can approve, reject, reopen or correct an entry. Corrections require a reason and return it to pending approval.',
  'Check rates and any award warnings before approval. Use Export CSV for permitted entries.'
 ],{route:'/rostering#timesheets',permissions:['rostering.view'],notes:['Original clock events and correction history remain recorded. Approved timesheets retain their saved rate calculation after later changes.'],related:['shift-clock','labour-settings','award-settings']});
 add(c,'leave-availability','Manage availability and leave','Keep scheduling informed by when people can work.',[
  'Open Rostering → Availability to enter your recurring availability and dated changes.',
  'Open Leave to request time away and review its status.',
  'Authorised managers review requests and consider availability warnings when editing shifts.',
  'Check the published roster after changes rather than assuming an availability entry edits an existing shift.'
 ],{route:'/rostering#availability',permissions:['rostering.view'],related:['make-roster','view-roster']});
 add(c,'labour-settings','Set labour budgets, rates and positions','Configure the values used for roster planning.',[
  'Open Rostering → Labour settings with the appropriate management permission.',
  'Choose the authorised network, company or location budget scope and save the planned budget settings.',
  'Configure effective-dated employee rates where permitted and review missing-rate warnings.',
  'Use Positions to add or rename company positions and choose their shift-card colours, then Save positions.'
 ],{route:'/rostering#settings',permissions:['rostering.view'],notes:['Budget permissions differ by scope. Positions and colours are shared across the selected company’s locations. Employment and award terms are managed separately in Users.'],related:['award-settings','roster-forecasts','manage-users']});

 c='checklists';
 add(c,'complete-checklist','Complete an active checklist','Record responses and finish the work currently planned for you.',[
  'Open Checklists and select an active card for the current location and planned day.',
  'Enter the required responses, photos or other evidence and wait for saves to finish.',
  'For a checklist with one checkbox response, use the card’s tick to complete it directly.',
  'When all required responses are saved and uploads finish, completion is recorded. Review History for completed or earlier work.'
 ],{popular:true,route:'/ops-management#checklists',permissions:['ops.view'],notes:['Active cards only appear during their planned window and leave the list when it ends. History retains saved work. Opening a card alone does not complete it.'],related:['checklist-builder','checklist-planners','checklist-history'],keywords:['task','tick','one step','active']});
 add(c,'checklist-builder','Build a checklist','Create instructions and response steps before planning its use.',[
  'Open Checklists → Checklist builder and create or edit a checklist.',
  'Add sections, instructions and response steps. Choose the response type and set required fields or validation.',
  'Reorder sections with their following steps, or move individual steps as needed.',
  'Wait for valid edits to save, then open Planner to choose timing, locations and assignees.'
 ],{route:'/ops-management#templates',permissions:['ops.view','ops.manage'],notes:['Content editing and planners have their own saved settings. A draft or paused planner does not create active work.'],related:['checklist-responses','checklist-planners','intelligence-checklists']});
 add(c,'checklist-responses','Choose checklist responses and timed sections','Collect the right evidence for each task.',[
  'Select a step in Checklist builder and choose a native response type, such as checkbox, text, number, selection, photo or signature.',
  'Set required status, options or numeric precision where available.',
  'Use instructions or section headings to explain the task; these are not responses.',
  'Configure timed sections when a minimum elapsed process is needed, then review the complete checklist before planning it.'
 ],{route:'/ops-management#templates',permissions:['ops.view','ops.manage'],notes:['Step activity and completion are recorded from saved work. Required uploads and active editing must finish before completion.'],related:['checklist-builder','complete-checklist']});
 add(c,'checklist-planners','Create checklist planners','Give one checklist one or several schedules.',[
  'Open the checklist’s Planner stage and add or select a planner.',
  'Choose recurrence, dates and a fixed-time or location-trading-hours window.',
  'Use Locations and Assignees to choose who should receive that planner’s work.',
  'Review the saved planner and activate it when ready. Add another planner for a separate schedule.'
 ],{route:'/ops-management#templates',permissions:['ops.view','ops.manage'],notes:['Each planner keeps its own audience and schedule. Review paused intelligence-generated planners before activation.'],related:['hourly-checklists','checklist-audiences','intelligence-planners']});
 add(c,'hourly-checklists','Repeat checklists hourly or around trading hours','Make planned tasks follow each location’s opening and closing.',[
  'In Planner, choose Hourly recurrence for a separate checklist occurrence each hour within the window.',
  'Choose Location trading hours to base the window on saved opening/closing times, adding offsets when needed.',
  'Check the assigned locations have valid hours and review the window’s finish.',
  'Activate the planner. Active work appears only when its planned window is open.'
 ],{route:'/ops-management#templates',permissions:['ops.view','ops.manage'],notes:['Closed days are skipped; missing hours require correction. Overnight work follows its opening trading day. Existing runs retain their frozen timing when hours change.'],related:['trading-hours','checklist-planners','intelligence-planners'],keywords:['repeat hourly','opening','closing','planner','scheduled day']});
 add(c,'checklist-audiences','Choose checklist locations and assignees','Target planned work to the right team.',[
  'Open a planner’s Locations group and select accessible locations.',
  'Open Assignees and choose any permission-level or individual-user filters.',
  'Review the combined audience and save the planner.',
  'Check active work with the intended location and account context.'
 ],{route:'/ops-management#templates',permissions:['ops.view','ops.manage'],notes:['Planner audiences also apply to managers and checklist reporting. Authoring requires authority over the affected locations.'],related:['checklist-planners','permissions','checklist-history']});
 add(c,'checklist-history','Review checklist history and progress','Find saved responses, completion and overdue work.',[
  'Open Checklists → History and filter the saved records you can access.',
  'Open a record to review progress and completion attribution.',
  'Use Reporting → Checklists for filtered progress, overdue totals and location comparisons when permitted.',
  'Check work dates and planner audiences when comparing locations.'
 ],{route:'/ops-management#history',permissions:['ops.view'],notes:['Reports can show today’s eligible unstarted tasks. Earlier unstarted schedules cannot be reconstructed from the current planner settings.'],related:['operational-reports','complete-checklist']});

 c='training';
 add(c,'in-store-training','Schedule and sign off in-store training','Plan practical training and record each staff member’s demonstrated skills.',[
  'Open Learning centre → In-store training. Use the location, search and status filters to find your sessions.',
  'With training assignment access, choose New session. Set the location, trainer, date, Melbourne start time, duration, staff and practical skills, then press Create session.',
  'Open View session and choose a staff member. The appointed trainer or an authorised manager ticks only the skills demonstrated competently, adds any notes and presses Save assessment.',
  'Save partial progress until every skill is signed off. The final save records completion, the assessor and the time. Find these read-only records using the Completed filter.'
 ],{route:'/learning-centre#in-store',permissions:['learning.view'],notes:['Self sign-off is excluded. Sign off in-store training is a separate detailed permission; managers also need training assignment access to assess sessions where they are not the appointed trainer. Assessments cannot be saved before the session starts. Cancelling a session retains saved completion records. Course progress reports continue to report online courses; practical progress is shown in In-store training.'],related:['take-course','assign-training','permissions']});
 add(c,'take-course','Start and complete a training course','Work through lessons and submit your knowledge check.',[
  'Open Learning centre → My learning for assigned work, or Course library to start an available published course.',
  'Open the course and complete its sections in order. Start timed reading where required.',
  'Use each section’s transition to save answers and continue.',
  'Submit the final knowledge check. Review a failed result and retry if needed.'
 ],{popular:true,route:'/learning-centre#my-learning',permissions:['learning.view'],notes:['Courses open as a desktop popup or fullscreen on smaller devices. Closing with unsent answers asks before discarding them. A published assignment keeps its original course version.'],related:['course-builder','training-reports']});
 add(c,'course-builder','Build and preview a training course','Create lessons and questions with a live learner preview.',[
  'Open Learning centre → Course builder and create or edit a draft.',
  'Add sections and blocks from the outline or canvas insertion controls. Edit their properties in the left panel.',
  'Write lessons, insert supported media or select a Knowledge Library article, and configure section formatting, transitions and reading time.',
  'Use Test course to walk through the learner flow without recording training.',
  'Check autosave, then publish a reviewed version separately.'
 ],{route:'/learning-centre#builder',permissions:['learning.view','learning.manage'],notes:['Refreshing Library content explicitly updates a draft; later article edits do not rewrite assigned course content.'],related:['course-questions','assign-training','intelligence-questions']});
 add(c,'course-questions','Use all training question types','Configure answers, marking and answer shuffling.',[
  'In Course builder, add a Knowledge check block.',
  'Choose Multiple choice, Multiple answers, True / false, Dropdown, Short answer, Fill in the blanks, Number, Matching or Put in order.',
  'Set the answer key and points. Review accepted text variants, numeric tolerance, matching pairs or sequence where relevant.',
  'Choose the course pass mark and optional Shuffle answer choices, then test and publish.'
 ],{route:'/learning-centre#builder',permissions:['learning.view','learning.manage'],notes:['Answer keys are marked on the server. Shuffling stays stable for a learner’s assignment; existing published assignments retain their settings.'],related:['intelligence-questions','course-builder']});
 add(c,'assign-training','Publish, assign or archive training','Give staff a fixed, reviewed course version.',[
  'Publish the reviewed draft in Course builder.',
  'Use Planner in the builder or Assign on the course in Course library.',
  'Select locations, any permission-level and staff filters, a due date and required/optional status.',
  'Press Assign course explicitly. Review or cancel existing assignments in the same popup.',
  'Archive a course when it should leave the library while retaining existing learning results.'
 ],{route:'/learning-centre#courses',permissions:['learning.view'],notes:['Filters combine, and newly added staff who match an active assignment can receive it. Later draft edits do not change the version already assigned.'],related:['course-builder','training-reports','permissions']});
 add(c,'training-reports','Track training progress','Find incomplete, completed and overdue learning.',[
  'Open Learning centre → Progress reports with training-report access.',
  'Filter by person, course, location or status and review due/completion dates.',
  'Export CSV for the permitted filtered work.',
  'Use Reporting → Training for cross-location progress and rankings when you also have reporting access.'
 ],{route:'/learning-centre#progress',permissions:['learning.view','learning.report'],related:['operational-reports','take-course']});

 c='knowledge';
 add(c,'read-library','Find and read Knowledge Library articles','Browse policies, information and embedded media.',[
  'Open Knowledge Library and search a title or words inside an article.',
  'Filter by Policies or Information, audience and category.',
  'Choose Cards, List or Grid and open the article.',
  'Follow headings, expand accordions and open the permitted images, documents or videos you need.'
 ],{route:'/knowledge-library',permissions:['knowledge.view'],notes:['Company articles follow the selected company; permitted network articles appear across companies. The shared platform search can also open matching article sections.'],related:['platform-search','publish-library','library-categories']});
 add(c,'publish-library','Write and publish a Library article','Share reviewed information with the correct audience.',[
  'Open Knowledge Library with publishing permission and create or edit an article.',
  'Choose its title, Policies/Information type, category and company or authorised network audience.',
  'Use the formatting editor to add text, tables, media, accordions or callouts.',
  'Review the article and save/publish through its ordinary editor action. Refresh if another editor changed its revision.'
 ],{route:'/knowledge-library',permissions:['knowledge.view'],notes:['OpStack intelligence can prepare reviewed text inside the editor. It does not publish the article for you.'],related:['rich-content','intelligence-writing','library-categories']});
 add(c,'library-categories','Organise Library categories and views','Help staff browse related information.',[
  'Use the Categories sidebar to choose All categories, Uncategorised or a saved category.',
  'With publishing authority, choose Manage categories to add, rename or remove one.',
  'Select the appropriate category while editing an article.',
  'Use the sidebar arrow to collapse it and choose Cards, List or Grid for the results.'
 ],{route:'/knowledge-library',permissions:['knowledge.view'],notes:['Removing a category keeps its articles as Uncategorised. The sidebar and view choices are remembered for your user and company in this browser.'],related:['read-library','publish-library']});

 c='comms';
 add(c,'team-chat','Send direct messages and create group chats','Talk to the people you share access with.',[
  'Open Comms → Direct messages, expand search and select a person.',
  'Write your message. Enter sends; Shift+Enter adds a line.',
  'Use Group chats → Create group to name a group and choose participants when permitted.',
  'Pin useful conversations or react to messages using the reaction control.'
 ],{route:'/communications',permissions:['comms.view'],notes:['On phones and tablets, an open conversation fills the screen; Back returns to the list. Only participants can read a private chat. In structured blocks, use Ctrl/⌘+Enter to send.'],related:['rich-content','intelligence-writing'],keywords:['message','chat','group','direct message','pin','emoji']});
 add(c,'publish-post','Publish company or network posts','Share an update with the intended audience.',[
  'Open Comms and choose the relevant posts view.',
  'Create a post with the available company or network publishing permission.',
  'Write and format the content, check the audience and decide whether acknowledgement is required.',
  'Publish explicitly. Use your post’s edit/delete controls or Read receipts to review it later.'
 ],{route:'/communications',permissions:['comms.view'],notes:['Editing a required post creates a version that its audience must acknowledge again. Network publishing requires separate network authority.'],related:['required-reading','rich-content','intelligence-writing']});
 add(c,'rich-content','Add formatting, images, files and video','Use the shared editor in Comms, articles and lessons.',[
  'Use the compact toolbar for text formatting, safe links and emoji.',
  'Open Insert for headings, lists, tables, accordions, quotes and dividers.',
  'Choose Media for images, galleries, video/audio, documents or supported video embeds, then check captions.',
  'Use callouts for important information and Undo/redo to review changes before saving or sending.'
 ],{notes:['Select text in the writing field to format it with the toolbar beside your selection. Alt+F10 opens it from the keyboard; Escape returns to the field.','In post, article and lesson editors, Text style opens Normal text and Heading 1–3 directly. Insert also keeps the full formatting and media options.','Uploaded video supports up to 25 MB; most other files support up to 10 MB each. Access to attached files follows the saved chat, article, course or post audience.'],related:['team-chat','publish-library','course-builder']});
 add(c,'required-reading','Read or snooze required announcements','Handle an important update before continuing work.',[
  'Read the post shown over the app.',
  'Choose Mark as read & continue to acknowledge that version.',
  'If you need to finish something first, choose Snooze for 5 minutes.',
  'Handle each outstanding post separately. The prompt returns when its snooze expires.'
 ],{notes:['Required reading can apply across your accessible companies. Refreshing or signing in again does not acknowledge it. Even users without normal Comms access can acknowledge a required post.'],related:['publish-post','support-request'],keywords:['blocked','snooze','announcement','acknowledge']});

 c='reporting';
 add(c,'business-reports','Understand overall business performance','Read sales, costs, profit and margin for the chosen period.',[
  'Open Reporting → Business overview and select a date range.',
  'Choose locations when comparing stores, including accessible stores in other companies.',
  'Review sales, total costs, profit, margin and data-completeness explanations.',
  'Open a detailed report or week to investigate the figures behind the overview.'
 ],{route:'/reporting#overview',permissions:['reporting.view'],notes:['Missing values differ from zero. Financial Cost of goods uses invoices and eligible net cost transfers; draft carts do not count. Platform fees stay separate.'],related:['location-rankings','report-details','invoice-expenses']});
 add(c,'location-rankings','Compare and rank locations','Compare like-for-like dates and available data.',[
  'In Reporting, select Compare locations and choose accessible stores.',
  'Choose the report and ranking measure: financial sales/profit/margin or operational completion/overdue measures.',
  'Apply the same dates, search and status filters across the comparison.',
  'Review unranked locations for missing financial inputs or no matching work before drawing conclusions.'
 ],{route:'/reporting#overview',permissions:['reporting.view'],notes:['Head Office Home also has a Sales leaderboard. Choose Daily and a date, or Weekly for completed days of the selected week. Complete saved revenue ranks from highest to lowest; gold, silver and bronze mark places 1–3. Missing days remain unranked with coverage shown. Tied results share a rank. Reporting’s location selection does not switch the location used elsewhere in the app.'],related:['home-dashboards','business-reports','operational-reports']});
 add(c,'operational-reports','Report on training and checklists','See completion, overdue work and location comparisons.',[
  'Open Reporting and choose Training or Checklists.',
  'Select dates, accessible locations and any staff/course/checklist/status filters.',
  'Review completion rates, completed work and overdue totals, then compare locations if useful.',
  'Use the displayed date rules when checking what is included and export the filtered results.'
 ],{route:'/reporting#training',permissions:['reporting.view'],notes:['Training needs training-report access in each selected company. Checklist reporting retains planner audiences. Today’s eligible unstarted checklists may appear; historical unstarted work cannot be recreated from current planners.'],related:['training-reports','checklist-history','report-exports']});
 add(c,'report-details','Choose detailed reports and financial date rules','Trace overview totals to their source records.',[
  'Use Reporting’s Report selector for financial performance, sales reconciliation, expenses, platform fees, invoices, order lines, count details or usage cycles.',
  'Use Filters and tools for advanced filters, grouping and completeness checks.',
  'For weekly financial records, review Financial week basis: weeks ending in the period or all weeks touching it.',
  'Select View or a chart bar to inspect the corresponding week and source detail.'
 ],{route:'/reporting#overview',permissions:['reporting.view'],notes:['Weekly costs are kept as full weekly amounts rather than invented daily allocations. Complete usage cycles need both opening and following closing counts.'],related:['business-reports','report-exports','weekly-report']});
 add(c,'report-exports','Export, sort and print reports','Share the complete filtered result rather than one page.',[
  'Select the report, dates, locations and filters.',
  'Sort with table headings and choose visible Columns.',
  'Choose Export CSV for all filtered rows and fields, including rows beyond the current page.',
  'Choose Print / PDF for all filtered pages with selected columns, or Export all details for the broader dated location data.'
 ],{route:'/reporting#overview',permissions:['reporting.view'],notes:['Export all details keeps dates and locations but does not apply the current search/category/completeness filters. Check the selected scope before sharing.'],related:['report-details','operational-reports']});
 add(c,'scheduled-reports','Schedule intelligence reports and read the inbox','Deliver reviewed report schedules by email and in the app.',[
  'Configure company intelligence and the sending location’s email settings first.',
  'Open Reporting → AI reports and create a daily, weekly or monthly report.',
  'Select topics, locations, the focus and recipients by users or permission levels. Generate and review a preview.',
  'Save the enabled schedule. Scheduled runs deliver to eligible recipients by email and the Report inbox.',
  'Open Report inbox to read delivered reports; edit or pause a schedule to change future runs.'
 ],{route:'/reporting',permissions:['reporting.view'],ai:true,notes:['There is no manual Send action. Previewing uses an intelligence request but sends nothing. Recipient/source permissions are checked on each run; schedules use Melbourne time and the same company allowance.'],related:['intelligence-setup','location-email','reports-not-arriving'],keywords:['AI reports','scheduled email','inbox','recipients']});

 c='intelligence';
 add(c,'intelligence-setup','Connect OpStack intelligence','Set a company’s OpenAI key, budget and request allowance.',[
  'Select the intended company, then open blue account dropdown → Settings → OpStack intelligence.',
  'Add an OpenAI API key with access to GPT-4.1 mini.',
  'Choose the estimated monthly USD budget and request cap, enable intelligence and save.',
  'Review Cost estimates and billing against your provider’s current prices and billing controls.'
 ],{popular:true,route:'/settings#ai',permissions:['ai.manage'],ai:true,notes:['Each company has separate settings. The key stays on the server and saving settings makes no provider request. A ChatGPT subscription does not include API usage. Estimated app limits are not a guarantee of the final OpenAI bill.'],related:['intelligence-limits','intelligence-appearance','intelligence-checklists','intelligence-questions'],keywords:['API key','OpenAI','connect AI','enable','billing']});
 add(c,'intelligence-limits','Understand intelligence usage and limits','Know when a paid request happens and how previews are used.',[
  'Review the selected company’s allowance in Settings → OpStack intelligence.',
  'Only submit content you intend the provider to process; inspect the source and selected pages first.',
  'Review generated facts, procedures, answers and numbers before applying a preview.',
  'Use the ordinary editor save, publish, assignment or import action after applying a reviewed preview.'
 ],{ai:true,notes:['Limits reset monthly in Melbourne time. Uncertain provider failures may retain reserved estimated usage. Repeated uncertain failures should be investigated before starting another request. Ordinary editing and forecast calculations remain available when intelligence is disabled.'],related:['intelligence-setup','intelligence-problem']});
 add(c,'intelligence-checklists','Draft a checklist with intelligence','Turn submitted requirements into an editable checklist draft.',[
  'Open Checklist builder’s OpStack intelligence action with checklist-authoring permission.',
  'Describe the checklist and review any reference notes you paste.',
  'Generate and inspect the proposed instructions and response steps.',
  'Choose Open draft in builder to create an ordinary editable draft, then review its planners and audience before activation.'
 ],{route:'/ops-management#templates',permissions:['ops.view','ops.manage'],ai:true,notes:['Generation is a preview. It does not start work or activate schedules.'],related:['checklist-builder','intelligence-planners','intelligence-setup']});
 add(c,'intelligence-planners','Generate one or several checklist planners','Ask for repeated work or schedules around trading hours.',[
  'Open a checklist’s Planner stage and choose OpStack intelligence planners.',
  'Describe the schedules, such as “repeat hourly from opening until closing”.',
  'Review the suggested recurrence, timing and dates. Add paused planners explicitly.',
  'Check Locations, Assignees and saved trading hours, then activate the planners you want.'
 ],{route:'/ops-management#templates',permissions:['ops.view','ops.manage'],ai:true,notes:['Hourly recurrence creates its own hourly occurrences; a separate planner per clock hour is unnecessary. Suggestions can include up to twelve paused planners.'],related:['hourly-checklists','checklist-audiences','trading-hours']});
 add(c,'intelligence-questions','Generate training questions from content','Create any of the nine question types from approved written sources.',[
  'Open OpStack intelligence questions in Course builder or Add a block → Knowledge checks.',
  'Choose written course content, accessible Knowledge Library articles or pasted text, then inspect the selected source.',
  'Choose question types and a count large enough for each selected type. Generate and review questions and answers.',
  'Choose Add questions to course to insert editable draft questions, then verify and publish through the normal course workflow.'
 ],{route:'/learning-centre#builder',permissions:['learning.view','learning.manage'],ai:true,notes:['Generate up to 20 questions at a time within the course limit. Source selection excludes existing answer keys and media. Changed Library articles may need refreshing.'],related:['course-questions','course-builder','read-library']});
 add(c,'intelligence-writing','Draft Comms and Library content','Write, improve or summarise submitted text inside the editor.',[
  'Open a permitted chat, post or article editor and choose OpStack intelligence.',
  'Choose Draft new content, Improve existing text or Summarise source text.',
  'Check the visible source field and instructions before generating.',
  'Review the result and choose Use in editor, adding below or explicitly replacing text.',
  'Use the editor’s ordinary Send, Publish or Save action when ready.'
 ],{ai:true,notes:['Only the submitted text is used, rather than the full chat history or attached media. The original audience and publishing choice remain yours.'],related:['team-chat','publish-post','publish-library']});
 add(c,'intelligence-invoices','Use intelligence to help read an invoice','Review a difficult scan before applying extracted details.',[
  'Scan or upload the invoice normally on Home.',
  'Open Need help reading this invoice? → OpStack intelligence.',
  'Review the source text and up to three selected page images, then choose Read invoice.',
  'Compare the transcription and warnings with the original. Use reviewed details to fill the open form.',
  'Save the invoice and explicitly confirm any price updates through the normal actions.'
 ],{route:'/home',permissions:['home.view'],ai:true,notes:['The ordinary local scanner does not require an intelligence request. This fallback uses the company allowance and applies only the source you submit.'],related:['scan-invoice','invoice-prices','intelligence-setup']});
 add(c,'intelligence-appearance','Choose intelligence colours and tint','Give intelligence controls a separate visual identity.',[
  'Open Settings → OpStack intelligence in the selected company.',
  'Choose one of the five palettes and adjust tint depth from 100% to 160%.',
  'Review the local preview, then use the existing Save action.',
  'Check the search bar, intelligence menus and headers in your preferred theme.'
 ],{route:'/settings#ai',permissions:['ai.manage'],ai:true,notes:['Intelligence uses its own font, gradients, shimmer and interaction glow. Reduced-motion settings keep decorative effects static. Appearance previews do not make provider requests.'],related:['intelligence-setup','dark-mode']});

 c='administration';
 add(c,'locations','Create, archive or restore a location','Keep one active list sectioned by Australian state.',[
  'Open Admin → Locations and choose Add location, or edit an existing row.',
  'Set its name, state and available settings, then Save settings.',
  'Use the archive action for an inactive location when permitted.',
  'Open the separate Archived locations menu to find or restore archived stores.'
 ],{route:'/admin/accounts#locations',permissions:['locations.manage'],notes:['Head Office can be created or opened from the location selector without setup. Its administrative location has no store-settings tabs. Active locations remain one list with state sections. Archiving keeps saved settings and history; native restrictions may prevent archiving a location still in use.'],related:['location-setup','trading-hours','location-managers','delivery-dates']});
 add(c,'location-setup','Complete a new location’s setup checklist','Finish the setup tasks inside the popup.',[
  'Create a location and open its highlighted setup entry or reminder.',
  'Complete name, state, trading hours, location manager, first user, ordering email, initial/manual target levels and a new kiosk.',
  'Open each step inside the setup popup and save the actual settings there. First user can be new or an existing eligible account.',
  'Finish setup once every task is validated. Snooze the reminder for five minutes if needed.'
 ],{route:'/admin/accounts#locations',permissions:['locations.manage'],notes:['Head Office is exempt from this store setup checklist and its reminders. Setup is non-blocking. Pending locations stay highlighted and tinted until completion. Kiosk setup creates a new device for this store rather than listing other stores’ devices.'],related:['locations','location-email','manage-kiosks'],keywords:['onboarding','setup checklist','first user','snooze']});
 add(c,'trading-hours','Set trading hours and overnight closing','Save all seven days with closed and unknown days distinguished.',[
  'Open Edit location → Trading hours.',
  'Enter opening and closing in AM/PM or 24-hour text. Use Copy Monday to all if helpful, then adjust individual days.',
  'Choose Closed for a non-trading day. Leave both fields blank only when the hours are not set.',
  'Press Save settings for the location popup.'
 ],{route:'/admin/accounts#locations',permissions:['locations.manage'],notes:['11 am–4 am closes the following day. Equal opening and closing means 24 hours. These hours support overnight sales, hourly-report conversion and trading-hours checklist planners.'],related:['overnight-sales','hourly-import','hourly-checklists']});
 add(c,'location-managers','Assign location managers','Choose the people responsible for a store.',[
  'Open Edit location → Managers with location and user-management authority.',
  'Select eligible existing users and the permitted company permission level.',
  'Press the single Save settings action.',
  'Check manager names on the location list and Home. Affected users may need to sign in again.'
 ],{route:'/admin/accounts#locations',permissions:['locations.manage','users.manage'],notes:['Manager assignments and the Manager Home dashboard are separate settings. Assigning a location manager enables eligibility for Home transfer approvals when the account also has receipt permissions.'],related:['transfer-approvals','permissions','home-dashboards']});
 add(c,'companies','Manage companies and separate their settings','Keep catalogues, appearance and locations organised by company.',[
  'Open Admin → Companies with company-management authority and choose Add company.',
  'Create its first location and rename company details as needed.',
  'Switch to the company through the logo picker before adding its suppliers, stock and appearance.',
  'Give users the required location memberships and company permission assignments.'
 ],{route:'/admin/accounts#companies',permissions:['companies.manage'],notes:['New companies start with an empty catalogue. A company must retain an active location. Intelligence keys and budgets are also company-specific.'],related:['switch-location','manage-users','appearance','intelligence-setup']});
 add(c,'manage-users','Create or edit users','Assign access, credentials, phone numbers and profile details.',[
  'Open Admin → Users and choose Create user or the pencil beside an account.',
  'Set its username, permitted role, accessible locations and default location.',
  'Enter a phone number for clock/kiosk PIN access. Its last four digits must be unique across the network.',
  'Set a new password only when needed, or use the available account setup invitation workflow.',
  'Save and tell affected users to sign in again after access or credential changes.'
 ],{route:'/admin/accounts#accounts',permissions:['users.manage'],notes:['You can only manage users and grant access within your own authority. Leave an existing password blank to keep it.'],related:['permissions','account-invitations','profile-photo','award-settings']});
 add(c,'account-invitations','Send account setup invitations','Let new users set up access through an expiring invitation.',[
  'Configure account setup email sending in the available Settings or Opstack-owner controls.',
  'Create or edit the user with the correct email and location/role access.',
  'Use the available invitation action and review its sending status.',
  'The recipient opens the setup link and chooses credentials. Reissue an invitation if it expires or details need changing.'
 ],{route:'/admin/accounts#accounts',permissions:['users.manage'],notes:['Hosted network account-email settings may be managed by the Opstack owner. Ask the appropriate administrator if this control is unavailable.'],related:['manage-users','location-email','support-request']});
 add(c,'permissions','Choose detailed permission levels','Control feature access and individual actions separately from the Staff/Manager Home dashboard.',[
  'Open Settings → Permission levels. Search existing levels, edit one within your authority, or choose Duplicate to start from its current settings.',
  'Set the name, optional description and hierarchy. Choose Staff or Manager / Supervisor Home; sales access elsewhere remains a separate permission.',
  'Use Find a permission and Show to review grouped feature grants and detailed actions. For example, allow Place orders and Edit placed orders while leaving Delete orders off. Required view permissions are selected automatically.',
  'Choose This company only or, when authorised, Entire network. Press Save permission level to apply the reviewed settings. Network publishing replaces company customisations of that level.',
  'Assign the saved level through Admin → Users. Check its feature access and detailed actions; changes apply to assigned users immediately.'
 ],{route:'/settings#permissions',permissions:['roles.manage'],notes:['The 36 detailed actions cover saved orders, report imports, invoice uploads/removal, stock/supplier/user/location/company actions, kiosks, course publishing/archiving, planners, rosters, report exports, company article removal, email templates and individual intelligence tools. Existing levels retain their access until changed. Detailed actions require their underlying feature grants; they do not grant access to other companies or locations. You cannot grant more authority than you hold. In-use levels cannot be deleted and the final full network owner is protected. Cancel and Duplicate do not save anything.'],related:['home-dashboards','manage-users','access-problem','intelligence-setup'],keywords:['roles','supervisor','staff','manager','access','view','edit','delete','publish','import','duplicate','permissions']});
 add(c,'manage-kiosks','Add, pair or revoke a kiosk device','Connect a shared device to one location.',[
  'Open Settings → Kiosk devices or the location’s Devices tab.',
  'Create a new named kiosk for the intended location and obtain its expiring single-use pairing code.',
  'Open the kiosk page on that device and enter the pairing details.',
  'Test staff PIN access. Revoke the device from management when it should no longer be trusted.'
 ],{route:'/settings/devices',permissions:['devices.manage'],notes:['Pairing fixes its company/location and does not grant staff extra permissions. Browser fullscreen and operating-system kiosk lockdown are separate device settings.'],related:['kiosk-use','manage-users','location-setup']});
 add(c,'location-email','Set up a location’s order-sending email','Connect the sender address and sending service for supplier orders.',[
  'Open Admin → Locations → Edit location → Sending for the intended store.',
  'Enter its sender email and Resend API key, and enable automatic supplier emails.',
  'Press Save settings and check the saved sending status.',
  'In Suppliers & delivery, separately set each supplier to Email and save the recipient.'
 ],{route:'/admin/accounts#locations',permissions:['email.manage'],notes:['Use a sender authorised by your Resend account. An order confirmation is also sent separately to the location’s sender when its email sending is enabled. Keys should only be entered in the protected settings form.'],related:['supplier-contacts','order-confirmation','order-not-sent'],keywords:['Resend','sender','receiver','API','enable automatic supplier emails']});
 add(c,'order-confirmation','Understand confirmation emails to the sender','Review the separate receipt of a placed order.',[
  'Configure the location’s enabled order-sending settings and sender address.',
  'Place and confirm an order through the ordinary cart workflow.',
  'Check the sender mailbox for the separate order confirmation and review the app’s supplier sending outcomes.',
  'Use Order history as the saved record if the confirmation email fails.'
 ],{notes:['The confirmation reports supplier outcomes and estimated prices. It does not prove supplier acceptance or appear automatically in the sender mailbox’s Sent folder. Recording a past order does not send it.'],related:['location-email','place-order','order-not-sent']});
 add(c,'order-email-template','Customise supplier order emails','Review the company’s template before using it for new orders.',[
  'Open Settings → Order email template in the intended company.',
  'Edit the available layout and supported template fields, including company details where offered.',
  'Review the preview and save the template.',
  'Use the normal reviewed order flow for future orders.'
 ],{route:'/settings#order-email',permissions:['email.manage'],notes:['Template edits do not resend past emails or change saved order quantities. Sender and recipient configuration remains separate.'],related:['location-email','order-confirmation']});
 add(c,'appearance','Change company appearance','Set company colours, logos and fonts in the correct scope.',[
  'Select the company, then open the blue account dropdown → Settings → App appearance.',
  'Change the relevant colours, app/sidebar logo or available font settings and review the preview.',
  'Save the section’s settings and check an ordinary app page in both themes.',
  'Use authorised shared sign-in controls only when changing the platform’s sign-in appearance.'
 ],{route:'/admin/settings#colours',permissions:['appearance.manage'],notes:['Company appearance is separate from OpStack intelligence styling and shared platform sign-in settings.'],related:['home-layout','intelligence-appearance','dark-mode']});
 add(c,'home-layout','Edit Home sections and app appearance in place','Arrange supported surfaces with desktop App edit.',[
  'On a computer with appearance permission, open the blue dropdown and choose App edit.',
  'Configure or rearrange supported Home sections and their dimensions. Staff and Manager Home keep separate section layouts.',
  'Select supported surfaces for appearance changes. Select the Home greeting to change its wording while keeping {user} exactly once.',
  'Review saved changes, use Undo if needed and choose Finish editing.'
 ],{route:'/home',permissions:['home.view','appearance.manage'],notes:['Choose Head Office from the location selector before editing its dashboard. Creating Head Office needs no store setup. App edit is suspended on phones. Ordinary words, numbers and form inputs are not individual editable appearance targets.'],related:['appearance','home-dashboards']});
 add(c,'award-settings','Configure employment and award estimates','Review the settings used by native wage calculations.',[
  'Open Settings → Award compliance and review employer, pay period, rule versions and location holiday calendars.',
  'Edit employees under Admin → Users → Employment & award to set dated employment terms.',
  'Review and enable the required settings, then inspect roster and timesheet calculation warnings.',
  'Review imported rule updates before activating them; add required review notes on publish or approval.'
 ],{route:'/settings/awards',permissions:['awards.manage'],notes:['The calculator is an estimator with a defined supported scope, not complete payroll. Payroll payments, lodgements and employer review remain separate.'],related:['labour-settings','timesheets','public-holidays']});

 add(c,'platform-console','Use the Opstack owner and support console','Manage networks using a separate platform account.',[
  'Open Opstack console from the account dropdown and sign in with your Opstack owner or support credentials.',
  'An owner can create a network after configuring shared account emails, then enter its code, company, location and first Head Office user.',
  'Use Open network to enter with your own support identity. The orange support indicator links back to the console.',
  'Owners manage platform accounts and network suspension; review Activity for platform actions.'
 ],{notes:['Opstack accounts are separate from company users. A Head Office permission level does not create platform-owner access. Support cannot view private chats unless it is a participant.'],related:['platform-settings','platform-monthly','companies','account-invitations']});
 add(c,'platform-settings','Manage platform defaults and account setup emails','Set shared platform options with an Opstack owner account.',[
  'Sign in to Opstack console as an owner and open the relevant shared settings.',
  'In Account setup emails, configure the verified sender, Resend key, enablement and welcome template, then save.',
  'Use New network defaults for future starting colours, font, welcome and greeting; retain {user} once in the greeting.',
  'Use Platform appearance for shared sign-in branding. Review which scope is affected before saving.'
 ],{notes:['New defaults affect future network snapshots, preserving existing company customisations. Shared account invitations are separate from location supplier-order sending.'],related:['platform-console','account-invitations','appearance']});
 add(c,'platform-monthly','Review the Opstack monthly report','Track platform location fees and monthly platform expenses.',[
  'As an Opstack owner, open Opstack console → Monthly report and select a month.',
  'In Sales, edit each location’s recurring fee and any notes. Changes begin in the selected month and carry forward until another change.',
  'In Expenses, enter the month’s named costs and choose Save expenses.',
  'Review Sales, Expenses and Profit, resolving unconfigured fees before using the final result.'
 ],{notes:['This owner-only platform report is separate from tenant sales and expenses. It records fees and costs without sending invoices or collecting payments.'],related:['platform-console','business-reports']});

 c='labels';
 add(c,'print-labels','Prepare and print prep labels','Check calculated label details before printing.',[
  'Open Labels, filter by category and select a template card.',
  'Fill any On Print or On Label fields, check ready/discard times and choose quantity.',
  'Review the complete label preview and selected media settings.',
  'Use the available print/download action and confirm the physical output on your printer.'
 ],{route:'/labels',permissions:['prep.view'],notes:['Creating a print batch does not prove a physical printer delivered it. Saved templates determine shelf-life rules; check them before use.'],related:['label-templates','label-history'],keywords:['prep','Zebra','print','expiry','food label']});
 add(c,'label-templates','Design label templates and printer settings','Build company templates using the actual paper size.',[
  'In Labels, choose Add label template or edit through a template’s menu.',
  'Choose its category, name and company-approved timing rules.',
  'Add fields on the canvas, move or resize them and edit their properties. Use Done for a field and Save for the template.',
  'Configure the printer/media resolution and test a preview before normal printing.'
 ],{route:'/labels',permissions:['prep.view','prep.manage'],notes:['The default Zebra media is 50 × 25 mm at 203 dpi. Explicitly configure other media/resolutions. Template edits do not rewrite old print batches.'],related:['print-labels','label-history']});
 add(c,'label-history','Review printed label batches','Find the recorded template and values used for a batch.',[
  'Open Labels → History at the relevant location.',
  'Find the batch and review its saved label details and timing.',
  'Use the available reprint/download controls when appropriate and recheck the physical label.'
 ],{route:'/labels',permissions:['prep.view'],notes:['History retains fixed batch snapshots even when templates change later.'],related:['print-labels','label-templates']});

 c='troubleshooting';
 add(c,'printer-problem','A label previews but does not print correctly','Check the device’s print setup and actual media.',[
  'Use the label preview to confirm the template, preparation date, quantity and printer/media settings.',
  'In the system print dialog, select the installed printer, matching paper size, 100%/actual scale, no headers or footers and zero margins.',
  'For a Zebra-file workflow, download the ZPL and send it through your installed Zebra software or configured print service.',
  'Check the physical label for media calibration, resolution and margins. Ask your device administrator if no printer is available.'
 ],{notes:['Phone printing needs a compatible system printer or print service. A saved batch or downloaded file does not itself confirm physical printing.'],related:['print-labels','label-templates','support-request']});
 add(c,'order-not-sent','An order saved but the supplier email did not send','Check sender settings, recipient details and the actual outcome.',[
  'Open the saved order and read each supplier’s delivery message before placing anything again.',
  'Check the correct location’s Sending tab: sender, saved Resend key and Enable automatic supplier emails.',
  'Check the selected company’s supplier → Order delivery: Email and the correct saved recipient.',
  'Review the sending provider’s dashboard for rejected addresses, sender verification or API errors.',
  'If you place the order outside the app, use Confirm ordered in Delivery tracking and set its expected date.'
 ],{popular:true,notes:['Do not repeatedly submit a saved order to test email. It can create duplicate supplier orders. A “not configured” message means a required sending setting was unavailable to that order.'],related:['location-email','supplier-contacts','receiving-orders','support-request'],keywords:['delivery not configured','Mernda','Oroso','Resend','email failed']});
 add(c,'sales-missing','Saved daily sales seem to be missing','Check the trading date and the separate sales stores.',[
  'Confirm the selected company and location match where you saved.',
  'Use Home’s Daily sales history link to open the exact trading week, especially after midnight or early Monday.',
  'Look in Sales → Daily sales rather than assuming it fills Weekly report.',
  'If the save is still missing, note the displayed date, save confirmation and location, then prepare a support request.'
 ],{related:['daily-sales','overnight-sales','support-request']});
 add(c,'hourly-not-imported','A scan has not appeared in Hourly sales','Finish review and explicitly submit the extracted hours.',[
  'Keep the scan popup open and check the extracted dates and hourly values.',
  'Resolve warnings and choose Trading day or Calendar day if required.',
  'Press Submit hourly sales and read the message beside it. A scan preview alone is not a saved import.',
  'Check the earliest imported date in Hourly sales. Existing differing hours may have been skipped unless replacement was explicitly selected.'
 ],{related:['hourly-import','trading-hours','intelligence-problem'],keywords:['scan not saving','submit','incorrect hour','11:01']});
 add(c,'access-problem','A page or action is missing','Check permissions, audience and the current location.',[
  'Check your current company and location in the header.',
  'Open User profile to review your current role and accessible locations.',
  'Ask an authorised user manager to review the matching view/edit/manage permission and your location memberships.',
  'For courses, checklists or Library content, also check the assignment or audience. Sign in again after account changes.'
 ],{notes:['Choosing Manager Home does not grant sales or management access. Help guides describe all features; their screen links are offered only when your current permissions allow them.'],related:['permissions','switch-location','support-request']});
 add(c,'clock-problem','Your PIN or clock action is unavailable','Check the saved phone ending, published shift and current stage.',[
  'Ask a user manager to verify your phone number and unique last four digits.',
  'Check that the shift is assigned, published, at this location and on the correct Melbourne day.',
  'Use the action offered for the current work/break stage. Early starts require a different authorised manager’s approval.',
  'After repeated wrong PINs, allow the limit to expire or ask a user manager to reset PIN access by saving the phone number again.'
 ],{notes:['Five incorrect PIN attempts cause a 15-minute limit. Missing or unrostered work can be submitted for review as a manual timesheet with a reason.'],related:['shift-clock','early-start','timesheets','manage-users']});
 add(c,'intelligence-problem','Intelligence is disabled or a request failed','Check the selected company’s setup and allowance.',[
  'Ask an intelligence-settings manager to check the selected company’s saved key, enablement, budget and request cap.',
  'Check the provider account has API billing and access to the configured model.',
  'Review the error and keep your source or editor draft. Use ordinary manual editing if generation is unavailable.',
  'For an uncertain failed request, investigate before starting another request, since estimated usage may already be reserved.'
 ],{ai:true,related:['intelligence-setup','intelligence-limits','support-request']});
 add(c,'reports-not-arriving','Scheduled reports are not arriving','Check schedule, sender and recipient access.',[
  'Open Reporting → AI reports and confirm the schedule is enabled and its Melbourne due time has passed.',
  'Check company intelligence allowance and the selected sending location’s email setup.',
  'Review recipient selection and each recipient’s current company, location and source access.',
  'Check Report inbox and the email provider’s status. Capture the run’s visible error for support.'
 ],{related:['scheduled-reports','location-email','intelligence-setup','support-request']});
 add(c,'save-conflict','A save reports a conflict or loses connection','Preserve your draft and resolve the actual saved state.',[
  'Keep the editor open and read its save message. Record or copy unsaved work before reloading.',
  'If another user changed the record, reload the latest saved version and reapply the intended changes.',
  'If the result is uncertain and the form offers Retry, retry that same action rather than creating a second order, receipt or import.',
  'For location or stock settings with partial saves, review which sections succeeded and retry only the remaining draft.'
 ],{related:['support-request','receiving-orders','stock-settings'],keywords:['revision','offline','network','retry','not saving']});
 add(c,'support-request','Get help from your manager or support contact','Prepare useful details about a problem.',[
  'Search this help centre for the feature or exact error first.',
  'Note the company, location, page, local time and what you expected to happen.',
  'Include the visible error and relevant order reference or report date. Capture a screenshot if it helps.',
  'Use Copy support details below for a starting template, then contact your manager through Comms or your organisation’s usual support channel.'
 ],{notes:['Copying details prepares text; it does not submit a ticket. Keep API keys, passwords and PINs out of messages and screenshots.'],related:['save-conflict','access-problem'],keywords:['contact','support','bug','report issue','helpdesk']});
 return{categories,articles};
});
