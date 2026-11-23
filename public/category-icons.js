// Category icons shared by the Knowledge centre and Prep & labels (browser and server). A fixed, allowlisted set of line
// icons (24 × 24, stroke currentColor) grouped for the picker; categories save only an icon ID, never SVG. The server uses
// `valid` to reject unknown IDs. `pick` (browser only) opens a searchable picker popup and never saves by itself.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.categoryIcons=api;})(typeof globalThis==='object'?globalThis:this,function(){
 const groups=[
  ['food','Food',[
   ['burger','Burger','food meal',`<path d="M4 10a8 5 0 0 1 16 0Z"/><path d="M3 14h18M5 18h14a1 1 0 0 0 1-1v-1H4v1a1 1 0 0 0 1 1Z"/>`],
   ['pizza','Pizza','slice',`<path d="M12 21 3 6a14 9 0 0 1 18 0Z"/><circle cx="10" cy="10" r="1"/><circle cx="14" cy="13" r="1"/>`],
   ['skewer','Skewer','souvlaki kebab grill meat',`<path d="M4 20 20 4"/><rect x="7.5" y="10.5" width="4" height="4" rx="1" transform="rotate(45 9.5 12.5)"/><rect x="12.5" y="5.5" width="4" height="4" rx="1" transform="rotate(45 14.5 7.5)"/>`],
   ['wrap','Wrap','souvlaki pita gyros roll',`<path d="M7 21 4 9c4-4 12-4 16 0l-3 12Z"/><path d="M6 11c3 2 9 2 12 0M8 6l1-3M12 5V2M16 6l-1-3"/>`],
   ['bread','Bread','bakery loaf pita',`<path d="M5 11a7 4 0 0 1 14 0v8H5Z"/><path d="M9 11v8M15 11v8"/>`],
   ['sandwich','Sandwich','toast lunch',`<path d="M3 15 12 6l9 9Z"/><path d="M3 15v3h18v-3"/>`],
   ['cheese','Cheese','dairy feta',`<path d="M3 17V9l12-5 6 5v8Z"/><path d="M3 9h18"/><circle cx="9" cy="13" r="1.3"/><circle cx="15" cy="14" r="1"/>`],
   ['egg','Egg','breakfast',`<path d="M12 3c4 0 7 7 7 11a7 7 0 0 1-14 0c0-4 3-11 7-11Z"/>`],
   ['meat','Meat','chicken drumstick poultry',`<path d="M15 4a5 5 0 0 1 3 9l-5 1-3 3a2 2 0 1 1-3-3l3-3 1-5a5 5 0 0 1 4-2Z"/>`],
   ['fish','Fish','seafood squid',`<path d="M3 12c4-6 10-6 14 0-4 6-10 6-14 0Z"/><path d="m17 12 4-4v8Z"/><circle cx="8" cy="11" r="1"/>`],
   ['salad','Salad','leaf greens vegetables',`<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15Z"/><path d="M5 19 14 10"/>`],
   ['fruit','Fruit','apple',`<path d="M12 7c-4-2-8 1-8 6s3 8 5 8c1 0 2-1 3-1s2 1 3 1c2 0 5-3 5-8s-4-8-8-6Z"/><path d="M12 7c0-2 1-4 3-4"/>`],
   ['carrot','Carrot','vegetable',`<path d="M15 9 4 20l2-8 6-6c2-1 4 1 3 3Z"/><path d="M15 6l3-3M17 8l3-1M14 5l1-3"/>`],
   ['chilli','Chilli','hot spicy pepper',`<path d="M18 6c-1 6-6 12-14 13 5-4 7-9 9-13Z"/><path d="M18 6c1-2 2-3 3-3"/>`],
   ['sauce','Sauce','bottle condiment dressing',`<path d="M10 3h4v4l2 3v11H8V10l2-3Z"/><path d="M8 14h8"/>`],
   ['dip','Dip','jar tub tzatziki',`<path d="M6 8h12v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"/><path d="M5 5h14v3H5Z"/>`],
   ['fries','Fries','chips',`<path d="M6 10h12l-2 11H8Z"/><path d="M8 10V4M11 10V3M14 10V4M17 10V6"/>`],
   ['soup','Soup','bowl hot',`<path d="M3 11h18a9 7 0 0 1-18 0Z"/><path d="M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4"/>`],
   ['rice','Grain','rice wheat flour',`<path d="M12 21V7"/><path d="M12 7c-2-1-3-3-2-5 2 1 3 3 2 5ZM12 12c-3 0-5-2-5-4 3 0 5 2 5 4ZM12 12c3 0 5-2 5-4-3 0-5 2-5 4ZM12 17c-3 0-5-2-5-4 3 0 5 2 5 4ZM12 17c3 0 5-2 5-4-3 0-5 2-5 4Z"/>`],
   ['cake','Cake','dessert birthday',`<path d="M4 21h16v-8H4Z"/><path d="M4 16c2 1 3 1 4 0s3-1 4 0 3 1 4 0 3-1 4 0M12 13V9M12 5v1"/>`],
   ['icecream','Ice cream','dessert cone gelato',`<path d="M8 11 12 21l4-10"/><path d="M7 11a5 5 0 1 1 10 0Z"/>`],
   ['cookie','Cookie','biscuit snack',`<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="10" r="1"/><circle cx="11" cy="15" r="1"/>`],
   ['allergen','Allergens','nut peanut allergy',`<path d="M12 3a4 4 0 0 0-3 7 4 4 0 1 0 6 0 4 4 0 0 0-3-7Z"/><path d="M11 7h.01M13 15h.01"/>`]
  ]],
  ['drinks','Drinks',[
   ['coffee','Coffee','mug cafe espresso',`<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z"/><path d="M17 10h1a3 3 0 0 1 0 6h-1M8 2v3M12 2v3"/>`],
   ['takeaway','Takeaway cup','coffee cup lid',`<path d="M6 7h12l-1.5 14h-9Z"/><path d="M5 4h14v3H5Z"/>`],
   ['tea','Tea','cup hot',`<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5Z"/><path d="M17 11h1a2 2 0 0 1 0 4h-1M11 9V5l2-2"/>`],
   ['soda','Can','soft drink soda',`<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M7 7h10M7 17h10"/>`],
   ['water','Bottle','water drink',`<path d="M10 2h4v3l2 2v14H8V7l2-2Z"/><path d="M8 11h8"/>`],
   ['juice','Juice','glass drink',`<path d="M6 4h12l-2 17H8Z"/><path d="M7 9h10M14 4l2-2"/>`],
   ['smoothie','Smoothie','shake straw frappe',`<path d="M7 8h10l-1 13H8Z"/><path d="M12 8l3-6M6 8h12"/>`],
   ['milk','Milk','carton dairy',`<path d="M8 2h8v3l2 3v14H6V8l2-3Z"/><path d="M6 12h12"/>`],
   ['wine','Wine','glass alcohol',`<path d="M8 3h8v5a4 4 0 0 1-8 0Z"/><path d="M12 12v9M8 21h8"/>`],
   ['beer','Beer','pint alcohol',`<path d="M5 7h10v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1Z"/><path d="M15 10h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M5 7a3 3 0 0 1 5-3 3 3 0 0 1 5 3"/>`]
  ]],
  ['kitchen','Kitchen & equipment',[
   ['chef','Chef','hat cook kitchen',`<path d="M7 17v4h10v-4"/><path d="M7 17a4 4 0 0 1-1-8 5 5 0 0 1 9-3 4 4 0 0 1 3 7v4Z"/>`],
   ['utensils','Utensils','fork knife cutlery dining',`<path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11"/><path d="M17 3c-2 2-2 7 0 9v9"/>`],
   ['knife','Knife','cut prep',`<path d="M3 21 21 3c1 3-1 7-5 9l-9 9Z"/>`],
   ['pot','Pot','saucepan cook',`<path d="M4 10h16v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z"/><path d="M2 10h20M10 6h4"/>`],
   ['pan','Pan','frying skillet',`<circle cx="9" cy="12" r="6"/><path d="M15 12h7"/>`],
   ['grill','Grill','bbq barbecue',`<path d="M4 10h16a8 7 0 0 1-16 0Z"/><path d="M8 17l-2 4M16 17l2 4M9 6V4M12 6V3M15 6V4"/>`],
   ['fryer','Fryer','deep fryer oil',`<path d="M4 9h16v10H4Z"/><path d="M8 9V5h8v4M4 13h16"/>`],
   ['oven','Oven','bake',`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 8h18M7 12h10v6H7Z"/>`],
   ['microwave','Microwave','reheat',`<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h9v6H6ZM18 9v.01M18 13v.01"/>`],
   ['fridge','Fridge','cool room refrigerator chilled',`<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 9h14M9 5v2M9 12v3"/>`],
   ['freezer','Freezer','frozen snowflake cold',`<path d="M12 2v20M3 7l18 10M3 17 21 7"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>`],
   ['thermometer','Temperature','thermometer probe',`<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 9v6"/>`],
   ['flame','Heat','fire hot cook',`<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-13-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 5 3 8 7 8Z"/>`],
   ['timer','Timer','time stopwatch',`<circle cx="12" cy="13" r="8"/><path d="M12 13V9M10 2h4M19 6l1-1"/>`],
   ['blender','Blender','mixer',`<path d="M7 3h10l-2 11H9Z"/><path d="M8 14h8l1 7H7Z"/>`],
   ['coffeemachine','Coffee machine','espresso barista',`<path d="M5 3h14v4H5ZM6 7v14h12V7"/><path d="M9 13h6v4H9Z"/>`],
   ['plate','Plate','dish serve',`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/>`],
   ['wrench','Maintenance','tools repair wrench',`<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4Z"/>`],
   ['plug','Electrical','power plug',`<path d="M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0ZM12 18v4"/>`],
   ['bulb','Ideas','light bulb tips',`<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 13v1h8v-1a7 7 0 0 0-4-13Z"/>`]
  ]],
  ['safety','Cleaning & safety',[
   ['spray','Spray','cleaning chemical sanitiser',`<path d="M9 9h6v12H9Z"/><path d="M9 9V6h4l3 2M13 6V4h-3M18 4l2-1M18 7h2"/>`],
   ['broom','Broom','sweep cleaning',`<path d="M20 3 11 12"/><path d="M11 12c-3 0-6 2-7 9 7-1 9-4 9-7Z"/><path d="M7 15l2 2"/>`],
   ['bucket','Bucket','mop cleaning',`<path d="M4 7h16l-2 14H6Z"/><path d="M4 7c0-3 4-5 8-5s8 2 8 5"/>`],
   ['bubbles','Washing','soap bubbles dishes',`<circle cx="8" cy="15" r="4"/><circle cx="16" cy="9" r="5"/><circle cx="18" cy="18" r="2"/>`],
   ['hand','Hand wash','hygiene hands',`<path d="M7 11V5a1.5 1.5 0 0 1 3 0v5M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v7M16 12V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-4l-2-4a1.5 1.5 0 0 1 3-1l2 2"/>`],
   ['shield','Food safety','shield safe protection',`<path d="M12 3 4 6v6c0 5 3 8 8 9 5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>`],
   ['warning','Warning','hazard caution alert',`<path d="M12 3 2 21h20Z"/><path d="M12 10v5M12 18v.01"/>`],
   ['firstaid','First aid','medical kit injury',`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M12 10v7M8.5 13.5h7"/>`],
   ['extinguisher','Fire safety','extinguisher emergency',`<path d="M8 8h6v13H8Z"/><path d="M8 8a3 3 0 0 1 6 0M11 5V3h4M15 3l3 3"/>`],
   ['mask','PPE','mask protective',`<path d="M4 9c4-2 12-2 16 0v4c-2 4-6 6-8 6s-6-2-8-6Z"/><path d="M4 9 2 8M20 9l2-1M8 13h8"/>`],
   ['bin','Waste','rubbish bin trash',`<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15"/><path d="M10 10v7M14 10v7"/>`],
   ['recycle','Recycling','recycle environment',`<path d="M7 19H4l3-5M17 19h3l-3-5M9 6l3-4 3 4M10 19h4M8 13 5 8M16 13l3-5"/>`],
   ['audit','Audit','clipboard inspection check',`<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 2h6v4H9ZM9 13l2 2 4-4"/>`]
  ]],
  ['stock','Stock & storage',[
   ['box','Box','package carton stock',`<path d="M3 7 12 3l9 4v10l-9 4-9-4Z"/><path d="M3 7l9 4 9-4M12 11v10"/>`],
   ['boxes','Boxes','stock pallets storage',`<rect x="3" y="12" width="8" height="8"/><rect x="13" y="12" width="8" height="8"/><rect x="8" y="4" width="8" height="8"/>`],
   ['shelf','Shelving','dry store shelf',`<path d="M4 3v18M20 3v18M4 9h16M4 15h16"/><rect x="6" y="5" width="3" height="4"/><rect x="13" y="11" width="4" height="4"/>`],
   ['bag','Bag','packaging takeaway',`<path d="M5 8h14l1 13H4Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>`],
   ['truck','Delivery','truck supplier order',`<path d="M2 6h11v10H2ZM13 9h5l4 4v3h-9Z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>`],
   ['tag','Tag','price label',`<path d="M3 12V3h9l9 9-9 9Z"/><circle cx="8" cy="8" r="1.5"/>`],
   ['sticker','Label','sticker',`<path d="M4 4h16v11l-5 5H4Z"/><path d="M15 20v-5h5"/>`],
   ['barcode','Barcode','scan sku',`<path d="M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14"/>`],
   ['weight','Weight','kg scale',`<path d="M6 21 8 8h8l2 13Z"/><circle cx="12" cy="5" r="2"/>`],
   ['scale','Scales','weigh balance',`<path d="M12 3v18M5 21h14"/><path d="M5 7h14M5 7l-3 6a3 3 0 0 0 6 0ZM19 7l-3 6a3 3 0 0 0 6 0Z"/>`],
   ['calendar','Date','calendar use by expiry',`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>`],
   ['clock','Time','clock hours',`<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`],
   ['hourglass','Shelf life','hourglass expiry',`<path d="M6 2h12M6 22h12M7 2c0 6 10 6 10 10S7 16 7 22M17 2c0 6-10 6-10 10s10 4 10 10"/>`]
  ]],
  ['people','People & training',[
   ['person','Person','staff employee',`<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>`],
   ['team','Team','staff people group',`<circle cx="9" cy="8" r="3.5"/><path d="M2 20a7 7 0 0 1 14 0"/><circle cx="17" cy="7" r="2.5"/><path d="M17 13a5 5 0 0 1 5 6"/>`],
   ['graduation','Training','learning course',`<path d="m2 9 10-5 10 5-10 5Z"/><path d="M6 11v6c4 3 8 3 12 0v-6M22 9v7"/>`],
   ['book','Guides','book manual handbook',`<path d="M12 5C9 3 5 3 2 4v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Z"/><path d="M12 5v16"/>`],
   ['idcard','HR','id card staff details',`<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 0 1 6 0M14 10h4M14 14h3"/>`],
   ['star','Star','favourite highlight',`<path d="m12 3 3 6 6 1-4.5 4.5 1 6.5L12 18l-5.5 3 1-6.5L3 10l6-1Z"/>`],
   ['heart','Wellbeing','heart care',`<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11Z"/>`],
   ['smile','Customer service','smile happy customer',`<circle cx="12" cy="12" r="9"/><path d="M8 14c2 2 6 2 8 0M9 9v.01M15 9v.01"/>`],
   ['trophy','Awards','trophy winner',`<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>`],
   ['medal','Achievement','medal badge',`<circle cx="12" cy="15" r="6"/><path d="M8 3h8l-2 6M8 3l2 6"/>`],
   ['chat','Communication','chat message',`<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 0 1-1-5 9 9 0 0 1 18 0Z"/>`],
   ['megaphone','Announcements','news megaphone',`<path d="M3 10v4h4l9 5V5L7 10Z"/><path d="M19 9a4 4 0 0 1 0 6"/>`],
   ['bell','Alerts','notification bell',`<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Z"/><path d="M10 20a2 2 0 0 0 4 0"/>`]
  ]],
  ['business','Business & admin',[
   ['document','Document','file page',`<path d="M14 3H6v18h12V7Z"/><path d="M14 3v4h4M9 12h6M9 16h4"/>`],
   ['folder','Folder','files',`<path d="M3 7V5h7l2 2h9v13H3Z"/>`],
   ['policy','Policy','rules law justice',`<path d="M12 3v18M7 21h10M4 7h16"/><path d="M6 7l-3 7h6ZM18 7l-3 7h6Z"/>`],
   ['checklist','Checklist','list tasks procedure',`<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/>`],
   ['money','Cash','money notes till',`<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>`],
   ['coin','Finance','dollar coin pricing',`<circle cx="12" cy="12" r="9"/><path d="M15 9a3 3 0 0 0-3-1c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2a3 3 0 0 1-3-1M12 6v12"/>`],
   ['card','Payments','card eftpos',`<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>`],
   ['receipt','Receipt','invoice bill',`<path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z"/><path d="M9 8h6M9 12h6M9 16h3"/>`],
   ['chart','Reports','chart bar sales',`<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>`],
   ['trend','Growth','trend up sales',`<path d="M3 17 9 11l4 4 8-8"/><path d="M15 7h6v6"/>`],
   ['pie','Breakdown','pie chart',`<path d="M12 3v9h9a9 9 0 1 1-9-9Z"/><path d="M15 3a6 6 0 0 1 6 6h-6Z"/>`],
   ['briefcase','Management','briefcase office',`<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V4h6v3M3 12h18"/>`],
   ['key','Access','key opening closing',`<circle cx="7" cy="15" r="4"/><path d="m10 12 10-10M17 5l3 3M14 8l2 2"/>`],
   ['lock','Security','lock closing',`<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>`],
   ['pen','Forms','pen write sign',`<path d="m16 3 5 5-12 12-6 1 1-6Z"/>`],
   ['gear','Settings','gear setup',`<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>`],
   ['phone','Phone','call contact',`<path d="M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z"/>`],
   ['mail','Email','mail letter',`<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>`],
   ['computer','Systems','computer pos tech',`<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>`],
   ['printer','Printer','print labels',`<path d="M6 9V3h12v6M6 17H4v-8h16v8h-2"/><path d="M6 14h12v7H6Z"/>`],
   ['camera','Photos','camera picture',`<path d="M3 8h4l2-3h6l2 3h4v12H3Z"/><circle cx="12" cy="13" r="4"/>`],
   ['video','Videos','video film',`<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>`],
   ['wifi','Wi-Fi','internet network',`<path d="M2 9a15 15 0 0 1 20 0M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0"/><path d="M12 20v.01"/>`],
   ['qr','QR code','scan qr',`<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3ZM20 14v.01M17 20h4v-3"/>`]
  ]],
  ['places','Places & events',[
   ['store','Store','shop front counter',`<path d="M3 9 5 4h14l2 5"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v9h14v-9M10 21v-5h4v5"/>`],
   ['home','Home','house',`<path d="M3 11 12 3l9 8"/><path d="M5 9v12h14V9M10 21v-6h4v6"/>`],
   ['building','Head office','building office',`<rect x="5" y="3" width="14" height="18"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/>`],
   ['pin','Location','map pin place',`<path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>`],
   ['car','Car','drive through parking',`<path d="M3 16v-4l2-5h14l2 5v4Z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M3 12h18"/>`],
   ['scooter','Delivery rider','uber doordash scooter',`<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h6l3-6h3M10 11h4"/>`],
   ['globe','Network','globe world',`<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18"/>`],
   ['door','Opening & closing','door open close',`<path d="M5 21V3h11v18M3 21h18"/><path d="M13 12v.01"/>`],
   ['sun','Morning','sun day opening',`<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>`],
   ['moon','Night','moon closing evening',`<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>`],
   ['party','Events','party celebration',`<path d="m4 20 5-14 9 9Z"/><path d="M14 4v2M18 6l-1 1M20 10h-2"/>`],
   ['gift','Promotions','gift offer deal',`<rect x="3" y="8" width="18" height="5"/><path d="M5 13v8h14v-8M12 8v13M12 8C10 4 6 4 7 7s5 1 5 1Zm0 0c2-4 6-4 5-1s-5 1-5 1Z"/>`],
   ['music','Music','music sound',`<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>`],
   ['plant','Plants','plant garden',`<path d="M7 14h10l-1 7H8Z"/><path d="M12 14V8M12 8c-3 0-5-2-5-5 3 0 5 2 5 5ZM12 10c3 0 5-2 5-5-3 0-5 2-5 5Z"/>`]
  ]],
  ['general','General',[
   ['flag','Flag','important mark',`<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>`],
   ['pushpin','Pinned','pin sticky',`<path d="M9 3h6l-1 6 3 3H7l3-3ZM12 12v9"/>`],
   ['bookmark','Bookmark','saved',`<path d="M6 3h12v18l-6-4-6 4Z"/>`],
   ['info','Information','info about',`<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.01"/>`],
   ['question','Questions','help faq',`<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7M12 17v.01"/>`],
   ['check','Done','check complete tick',`<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>`],
   ['bolt','Quick','lightning fast energy',`<path d="M13 2 4 14h7l-1 8 9-12h-7Z"/>`],
   ['grid','Grid','all apps',`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`],
   ['list','List','items',`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`],
   ['link','Link','links resources',`<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>`],
   ['eye','View','eye visual display',`<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>`],
   ['search','Search','find',`<circle cx="11" cy="11" r="7"/><path d="m21 21-5-5"/>`],
   ['target','Targets','goal target',`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>`],
   ['rocket','Launch','new rocket',`<path d="M12 15c-2-1-3-2-4-4 2-6 6-8 11-8 0 5-2 9-7 12Z"/><path d="M8 11H4l3-4h4M12 15v5l4-3v-4"/><circle cx="15" cy="8" r="1.5"/>`],
   ['crown','Premium','crown vip',`<path d="m3 8 4 4 5-7 5 7 4-4-2 11H5Z"/>`],
   ['diamond','Quality','diamond premium',`<path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M2 9h20"/>`]
  ]]
 ];
 const list=[],byId=new Map();for(const [groupId,groupName,icons] of groups)for(const [id,name,keywords,svg] of icons){const icon={id,name,keywords,svg,group:groupId,groupName};list.push(icon);byId.set(id,icon);}
 const valid=id=>typeof id==='string'&&byId.has(id),svg=id=>byId.get(id)?.svg||'';
 // An <svg> element for an icon ID (or the fallback markup), sized by CSS.
 function element(id,fallback){if(typeof document==='undefined')return null;const node=document.createElementNS('http://www.w3.org/2000/svg','svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('fill','none');node.setAttribute('stroke','currentColor');node.setAttribute('stroke-width','1.8');node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');node.setAttribute('aria-hidden','true');node.classList.add('category-icon');node.innerHTML=svg(id)||fallback||'';return node;}
 // Searchable picker popup. options: {current, title, onPick(id|null)}. Choosing only calls onPick; nothing is saved here.
 function pick(options={}){
  if(typeof document==='undefined')return;const word=(text,values={})=>typeof interfaceLabel==='function'?interfaceLabel(text,values):text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]??''));
  const opener=document.activeElement,dialog=document.createElement('dialog');dialog.className='category-icon-picker';dialog.setAttribute('aria-label',word(options.title||'Choose an icon'));
  const head=document.createElement('div');head.className='category-icon-head';const title=document.createElement('h2');title.textContent=word(options.title||'Choose an icon');const close=document.createElement('button');close.type='button';close.className='category-icon-close';close.textContent='×';close.setAttribute('aria-label',word('Close'));head.append(title,close);
  const search=document.createElement('input');search.type='search';search.className='category-icon-search';search.placeholder=word('Search {count} icons',{count:list.length});search.setAttribute('aria-label',word('Search icons'));search.autocomplete='off';
  const body=document.createElement('div');body.className='category-icon-body';const foot=document.createElement('div');foot.className='category-icon-foot';const none=document.createElement('button');none.type='button';none.className='category-icon-none';none.textContent=word('No icon');const count=document.createElement('span');count.className='category-icon-count';count.setAttribute('aria-live','polite');foot.append(none,count);
  dialog.append(head,search,body,foot);document.body.append(dialog);
  const choose=id=>{dialog.close();options.onPick?.(id);};
  function render(){const query=search.value.trim().toLowerCase();body.replaceChildren();let shown=0;
   for(const [groupId,groupName] of groups){const icons=list.filter(icon=>icon.group===groupId&&(!query||(icon.name+' '+icon.keywords+' '+groupName).toLowerCase().includes(query)));if(!icons.length)continue;
    const section=document.createElement('section');const label=document.createElement('h3');label.textContent=word(groupName);const grid=document.createElement('div');grid.className='category-icon-grid';
    for(const icon of icons){const button=document.createElement('button');button.type='button';button.className='category-icon-option';button.title=word(icon.name);button.setAttribute('aria-label',word(icon.name));button.setAttribute('aria-pressed',String(icon.id===options.current));button.append(element(icon.id));const name=document.createElement('span');name.textContent=word(icon.name);button.append(name);button.onclick=()=>choose(icon.id);grid.append(button);shown++;}
    section.append(label,grid);body.append(section);}
   if(!shown){const empty=document.createElement('p');empty.className='category-icon-empty';empty.textContent=word('No icons match.');body.append(empty);}
   count.textContent=word(shown===1?'1 icon':'{count} icons',{count:shown});}
  search.oninput=render;none.onclick=()=>choose(null);close.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{dialog.remove();opener?.focus?.();});dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dialog.close();}});dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.close();});dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  render();dialog.showModal();search.focus();
  // Arrow keys move between icons in the grid.
  body.addEventListener('keydown',event=>{if(!['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(event.key))return;const buttons=[...body.querySelectorAll('.category-icon-option')],index=buttons.indexOf(document.activeElement);if(index<0)return;const columns=Math.max(1,Math.round(body.querySelector('.category-icon-grid').clientWidth/(buttons[0].offsetWidth||1)));const step={ArrowRight:1,ArrowLeft:-1,ArrowDown:columns,ArrowUp:-columns}[event.key];const next=buttons[Math.min(buttons.length-1,Math.max(0,index+step))];next?.focus();event.preventDefault();});
 }
 return{groups:groups.map(([id,name])=>({id,name})),list,valid,svg,element,pick};
});
