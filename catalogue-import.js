const imported=require('./catalogue/book2.json');
function mergeSpreadsheet(catalogue){
 if(catalogue.imports?.includes('book2-v1'))return catalogue;
 const normalize=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
 const mapping=new Map();
 for(const supplier of imported.suppliers){let existing=catalogue.suppliers.find(s=>normalize(s.name)===normalize(supplier.name));if(!existing){existing={...supplier};catalogue.suppliers.push(existing);}mapping.set(supplier.id,existing.id);}
 for(const product of imported.products){const supplierId=mapping.get(product.supplierId);if(!catalogue.products.some(p=>p.supplierId===supplierId&&normalize(p.name)===normalize(product.name)))catalogue.products.push({...product,supplierId});}
 catalogue.imports=[...(catalogue.imports||[]),'book2-v1'];return catalogue;
}
module.exports={mergeSpreadsheet};
