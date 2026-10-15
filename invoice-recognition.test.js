const {test}=require('node:test'),assert=require('node:assert/strict'),reader=require('./public/invoice-reader'),photo=require('./public/invoice-photo');
test('photo field extraction handles abbreviated invoice labels, spaced dates and tax-inclusive totals',()=>{
 const result=reader.extract('FRESH FOODS\nInv. No. A-102\nInvoice Date: 05 / 10 / 2026\nSubtotal $100.00\nGST $10.00\nTotal (Tax Inclusive) $110.00');assert.deepEqual(result,{supplier:'FRESH FOODS',invoiceNumber:'A-102',invoiceDate:'2026-10-05',subtotalCents:10000,taxCents:1000,totalCents:11000});assert.equal(reader.extract('FOODS\nInvoice: 1\nTotal AUD 110.00').invoiceNumber,'1');assert.equal(reader.date('Date: October 5, 2026'),'2026-10-05');
});
test('amounts on the next line stay attached to their own label and do not overwrite neighbouring fields',()=>{
 const result=reader.extract('FRESH FOODS\nInvoice No\nINV-80017\nInvoice Date\n05/10/2026\nSub Total\n$1,200.00\nGST\n$120.00\nTotal Including GST\n$1,320.00');assert.equal(result.subtotalCents,120000);assert.equal(result.taxCents,12000);assert.equal(result.totalCents,132000);assert.equal(result.invoiceNumber,'INV-80017');assert.equal(result.invoiceDate,'2026-10-05');
 const missing=reader.extract('FRESH FOODS\nSubtotal\nGST $10.00\nTotal $110.00');assert.equal(missing.subtotalCents,null);assert.equal(missing.taxCents,1000);assert.equal(missing.totalCents,11000);
});
test('columns merged onto one OCR line retain subtotal, tax and total, excluding rates, quantities and paid balances',()=>{
 const result=reader.extract('FRESH FOODS\nInvoice No A-501 Date 05/10/2026\nSubtotal 100.00 GST 10.00 Total incl GST 110.00');assert.equal(result.subtotalCents,10000);assert.equal(result.taxCents,1000);assert.equal(result.totalCents,11000);
 const other=reader.extract('FOODS PTY LTD\nSubtotal (ex GST) $100.00\nGST Rate 10.00%\nGST Amount 10.00\nTotal GST 10.00\nTotal Qty 12.00\nGrand Total 110.00\nBalance Due 0.00');assert.equal(other.subtotalCents,10000);assert.equal(other.taxCents,1000);assert.equal(other.totalCents,11000);
 assert.equal(reader.extract('FOODS\nTotal Qty 12.00').totalCents,null);assert.equal(reader.extract('FOODS\nGST 10.00 %').taxCents,null);
});
test('due dates and credit values are not silently substituted for missing invoice dates or positive totals',()=>{
 assert.equal(reader.extract('FOODS\nDue Date\n21/10/2026').invoiceDate,null);assert.equal(reader.extract('FOODS\nDue Date 21/10/2026 Invoice Date 05/10/2026').invoiceDate,'2026-10-05');for(const amount of ['-$110.00','$-110.00','($110.00)'])assert.equal(reader.extract('CREDIT NOTE\nTotal '+amount).totalCents,null);assert.equal(reader.extract('FOODS\nTotal $12.345').totalCents,null);
});
test('payment instructions are not mistaken for invoice numbers when OCR reads the footer before a metadata column',()=>{
 const parsed=reader.extract('THE PRODUCE COMPANY\nPlease use invoice number as payment reference.\nTAX INVOICE\nInvoice No: P-30942\nInvoice Date: 05/10/2026\nTotal (Incl. GST) $367.95');assert.equal(parsed.invoiceNumber,'P-30942');assert.equal(parsed.totalCents,36795);assert.equal(reader.extract('THE PRODUCE COMPANY\nPlease use invoice number as payment reference.').invoiceNumber,'');
});
test('word positions reconnect separated label and amount columns without confusing adjacent rows',()=>{
 const word=(block,left,top,text)=>['5',1,block,1,1,1,left,top,90,20,95,text].join('\t'),tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'+[word(1,10,10,'FRESH FOODS'),word(1,10,100,'Subtotal'),word(1,10,140,'GST'),word(1,10,180,'Grand Total'),word(2,400,101,'100.00'),word(2,400,141,'10.00'),word(2,400,181,'110.00')].join('\n'),text=photo.textFromTsv(tsv),parsed=reader.extract(text);assert.equal(text,'FRESH FOODS\nSubtotal 100.00\nGST 10.00\nGrand Total 110.00');assert.equal(parsed.subtotalCents,10000);assert.equal(parsed.taxCents,1000);assert.equal(parsed.totalCents,11000);assert.ok(photo.score({text,confidence:90})>photo.score({text:'Subtotal\nGST\nGrand Total\n100.00\n10.00\n110.00',confidence:90}));
});
