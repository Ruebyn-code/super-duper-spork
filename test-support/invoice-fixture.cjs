const crypto=require('node:crypto');
function input(weekStart,totalCents,extra={}){
 const id=crypto.randomUUID();
 return {id,weekStart,supplier:'Test supplier',invoiceNumber:'TEST-'+id,invoiceDate:weekStart,notes:'Synthetic test invoice',subtotalCents:totalCents,taxCents:0,totalCents,ocrText:'Test invoice',pages:1,confidence:100,preview:null,source:{name:'test-invoice.pdf',mime:'application/pdf',data:Buffer.from('%PDF-1.4\nSynthetic isolated invoice '+id+'\n%%EOF').toString('base64')},...extra};
}
async function save(dir,actor,weekStart,totalCents,extra){return require('../invoices').create(dir,actor,input(weekStart,totalCents,extra));}
module.exports={input,save};
