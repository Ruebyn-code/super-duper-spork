// Reporting tables: line each column header up with its cells (left text, right amounts, centred ranks).
// Display only: it reads computed cell alignment after tables render and never changes data.
(()=>{
 const side=value=>value==='right'||value==='end'?'right':value==='center'||value==='-webkit-center'?'center':'left';
 function align(table){
  const header=table.tHead?.rows[0],body=table.tBodies[0];if(!header||!body)return;
  const sample=[...body.rows].find(row=>[...row.cells].every(cell=>cell.colSpan===1)&&row.cells.length===header.cells.length);
  [...header.cells].forEach((th,index)=>{if(th.colSpan!==1)return;const cell=sample?.cells[index];if(!cell){th.style.removeProperty('text-align');return;}const value=side(getComputedStyle(cell).textAlign);if(th.style.getPropertyValue('text-align')!==value)th.style.setProperty('text-align',value,'important');});
 }
 let pending=0;
 const run=()=>{pending=0;for(const table of document.querySelectorAll('.reporting-page table.report-table'))align(table);};
 const queue=()=>{if(!pending)pending=requestAnimationFrame(run);};
 const start=()=>{const root=document.querySelector('.reporting-page')||document.body;new MutationObserver(queue).observe(root,{childList:true,subtree:true});addEventListener('resize',queue);queue();};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
