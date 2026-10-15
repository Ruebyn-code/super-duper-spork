(()=>{
 const labels={tillSales:'Till sales',cash:'Cash',eftpos:'Eftpos',pettyCash:'Petty cash',uberEats:'Uber Eats',doorDash:'DoorDash'},weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 const money=value=>value===null?'—':new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(value/100);
 const percent=(cost,sales)=>cost!==null&&sales>0?(cost/sales*100).toFixed(2)+'%':'—';
 const amount=input=>input.value!==''&&input.validity.valid?Math.round(Number(input.value)*100):null;
 const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
 window.createSalesReportEntry=({host,overview,onChange,wording})=>{
  let orders={totalCents:0,pricePending:false};
  const inputs={},outputs={},rowTotals={};
  const table=el('table',undefined,'weekly-sales-table'),caption=el('caption','Weekly sales report, Monday to Sunday','visually-hidden'),head=el('thead'),heading=el('tr'),body=el('tbody');
  heading.append(el('th','Sales report'));for(let index=0;index<7;index++){const cell=el('th'),day=el('span',weekdays[index]),date=el('span',undefined,'weekly-sales-date');cell.scope='col';day.dataset.editId='weekly-day-'+index+'-label';date.id='weekly-date-'+index;date.dataset.userText='';cell.append(day,date);heading.append(cell);}const totalHeading=el('th','Totals');totalHeading.scope='col';heading.append(totalHeading);head.append(heading);table.append(caption,head,body);host.append(table);
  function currencyInput(id,label,max=10000000){const wrap=el('div',undefined,'weekly-currency-input'),symbol=el('span','$','weekly-currency-symbol'),input=el('input');symbol.setAttribute('aria-hidden','true');symbol.dataset.userText='';input.id=id;input.dataset.editId=id;input.type='number';input.min=0;input.max=max;input.step='0.01';input.inputMode='decimal';input.placeholder='—';input.setAttribute('aria-label',label);input.oninput=onChange;wrap.append(symbol,input);return {wrap,input};}
  function row(key,label,calculated=false){const tr=el('tr',undefined,'weekly-sales-row weekly-'+key),title=el('th',label);tr.dataset.editId='weekly-report-row-'+key;title.dataset.editId='weekly-report-label-'+key;title.scope='row';tr.append(title);if(calculated)outputs[key]=[];else inputs[key]=[];
   for(let index=0;index<7;index++){const cell=el('td');if(calculated){const output=el('output','—');output.id='weekly-'+key+'-'+index;output.dataset.userText='';outputs[key].push(output);cell.append(output);}else{const {wrap,input}=currencyInput('weekly-'+key+'-'+index,label+', '+weekdays[index]);inputs[key].push(input);cell.append(wrap);}tr.append(cell);}const total=el('td','—','weekly-row-total');total.id='weekly-'+key+'-total';total.dataset.userText='';tr.append(total);rowTotals[key]=total;body.append(tr);return tr;
  }
  row('total','Total sales',true);row('tillSales',labels.tillSales);row('cash',labels.cash);row('eftpos',labels.eftpos);row('pettyCash',labels.pettyCash);row('variance','Daily variance',true);row('uberEats',labels.uberEats);row('doorDash',labels.doorDash);
  function metric(id,label){const card=el('div',undefined,'weekly-report-metric'),title=el('span',label),value=el('strong','—'),note=el('span',undefined,'small');card.dataset.editId='weekly-report-'+id+'-metric';title.dataset.editId='weekly-report-'+id+'-label';value.id=id;value.dataset.userText='';note.dataset.userText='';card.append(title,value,note);overview.append(card);return {card,value,note};}
  const sales=metric('weekly-entry-total','Recorded weekly sales'),cash=metric('weekly-cash-deposit','Cash to be deposited'),stock=metric('weekly-stock','Stock orders placed'),variance=metric('weekly-variance','Weekly variance');
  function cost(id,label){const result=metric(id+'-value',label),{wrap,input}=currencyInput(id,label,70000000);result.value.replaceWith(wrap);return {...result,input};}
  const labour=cost('weekly-labour','Labour'),expenses=cost('weekly-operating-expenses','Operating expenses');
  const breakdown=()=>Object.fromEntries(weeklySalesReport.fields.map(field=>[field,inputs[field].map(amount)]));
  const summary=()=>weeklySalesReport.calculate(breakdown());
  function render(){const result=summary();for(let index=0;index<7;index++){outputs.total[index].textContent=money(result.days[index]);outputs.variance[index].textContent=money(result.variances[index]);outputs.variance[index].classList.toggle('weekly-variance-negative',result.variances[index]!==null&&result.variances[index]<0);outputs.variance[index].classList.toggle('weekly-variance-positive',result.variances[index]>0);}
   for(const [key,value] of Object.entries(result.totals))rowTotals[key==='sales'?'total':key].textContent=money(value);
   sales.value.textContent=money(result.totals.sales);cash.value.textContent=money(result.totals.cash);variance.value.textContent=money(result.totals.variance);variance.value.classList.toggle('weekly-variance-negative',result.totals.variance!==null&&result.totals.variance<0);variance.value.classList.toggle('weekly-variance-positive',result.totals.variance>0);
   stock.value.textContent=money(orders.totalCents)+(orders.pricePending?' + '+wording('prices pending'):'');stock.note.textContent=wording('Stock expense')+' · '+(orders.pricePending?'—':percent(orders.totalCents,result.totals.sales));labour.note.textContent=wording('Labour %')+' · '+percent(amount(labour.input),result.totals.sales);expenses.note.textContent=wording('OPEX %')+' · '+percent(amount(expenses.input),result.totals.sales);
   return result;
  }
  return {
   render,summary,
   setOrders(value){orders=value||{totalCents:0,pricePending:false};render();},
   setRecord(record,draft){for(const field of weeklySalesReport.fields)for(let index=0;index<7;index++)inputs[field][index].value=draft?draft.breakdown[field][index]:record.breakdown?.[field][index]===null||record.breakdown?.[field][index]===undefined?'':(record.breakdown[field][index]/100).toFixed(2);for(const [key,input] of [['labourCents',labour.input],['operatingExpensesCents',expenses.input]])input.value=draft?draft[key]:(record[key]===null||record[key]===undefined?'':(record[key]/100).toFixed(2));render();},
   setDates(weekStart){const dates=weekdays.map((_,index)=>new Date(Date.parse(weekStart+'T00:00:00Z')+index*86400000));for(let index=0;index<7;index++){const label=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'}).format(dates[index]);document.getElementById('weekly-date-'+index).textContent=label;for(const field of weeklySalesReport.fields)inputs[field][index].setAttribute('aria-label',wording(labels[field])+', '+wording(weekdays[index])+', '+label);}},
   draft(){return {breakdown:Object.fromEntries(weeklySalesReport.fields.map(field=>[field,inputs[field].map(input=>input.value)])),labourCents:labour.input.value,operatingExpensesCents:expenses.input.value};},
   validDraft(draft){return draft&&weeklySalesReport.fields.every(field=>Array.isArray(draft.breakdown?.[field])&&draft.breakdown[field].length===7&&draft.breakdown[field].every(value=>typeof value==='string'))&&['labourCents','operatingExpensesCents'].every(field=>typeof draft[field]==='string');},
   values(){return {breakdown:breakdown(),labourCents:amount(labour.input),operatingExpensesCents:amount(expenses.input)};}
  };
 };
})();
