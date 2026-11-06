// Reporting: a plain-language line explaining the selected report, and clearer missing figures.
(()=>{
 const select=document.getElementById('report-view'),line=document.getElementById('report-view-summary');if(!select||!line)return;
 const about={
  finance:'Sales, costs, profit and margin for the chosen locations and period.',
  reconciliation:'Till, Uber Eats and DoorDash sales from weekly reports, with adjustments and refunds.',
  expenses:'Where the money went: cost of goods, labour, operating expenses and R&O.',
  platforms:'Delivery platform fees and what was paid out.',
  transfers:'Stock sent between locations and its cost.',
  'order-lines':'Every item ordered, with quantities and prices.',
  orders:'Order totals for each supplier.',
  invoices:'Supplier invoices saved in the invoice scanner.',
  bundles:'Weekly invoice bundles for each location.',
  stock:'How much of each item was used.',
  cycles:'Usage week by week, from one stock count to the next.',
  counts:'Every saved stock count, item by item.',
  'daily-overview':'Daily sales compared with what was projected.',
  sales:'Each daily sales entry as it was saved.',
  training:'Who has finished, started or is overdue on training.',
  checklists:'Checklists completed, missed and in progress.',
  activity:'What each person did and when: checklist steps, clock-ins, orders, counts, wastage, labels, training and equipment. Filter by people and time of day.'
 };
 function update(){const option=select.selectedOptions[0];if(!option){line.textContent='';return;}const group='';line.replaceChildren();const strong=document.createElement('strong');strong.textContent=group+option.textContent;line.append(strong,document.createTextNode(about[option.value]?' — '+about[option.value]:''));}
 // Mark summary figures that cannot be calculated so they read as "missing" rather than zero.
 function mark(){for(const value of document.querySelectorAll('.reporting-page .report-metric>strong')){const missing=value.textContent.trim()==='—';value.closest('.report-metric').classList.toggle('is-missing',missing);}}
 select.addEventListener('change',update);window.addEventListener('hashchange',()=>setTimeout(update));
 new MutationObserver(mark).observe(document.querySelector('.reporting-page')||document.body,{subtree:true,childList:true,characterData:true});
 update();mark();setTimeout(()=>{update();mark();},600);
})();
