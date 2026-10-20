/* Automatic matches are rebuilt from the invoice text, never client mappings. */
const M=require('./public/invoice-price-model');
const supplierName=value=>M.normal(value).replace(/\b(?:pty|proprietary|ltd|limited)\b/g,'').trim().replace(/\s+/g,' ');
const measures={kg:['weight',1000],kgs:['weight',1000],kilogram:['weight',1000],kilograms:['weight',1000],g:['weight',1],grams:['weight',1],gram:['weight',1],l:['volume',1000],lt:['volume',1000],litre:['volume',1000],litres:['volume',1000],ml:['volume',1],ea:['count',1],each:['count',1],unit:['count',1],units:['count',1]};
const measurePattern='(?:kilograms?|grams?|kgs?|g|litres?|lt|ml|l|each|ea|units?)';
function exactName(line,product){
 let description=line.description.trim();if(line.sku&&description.toUpperCase().startsWith(line.sku.toUpperCase()+' '))description=description.slice(line.sku.length).trim();
 const names=[M.normal(description)];
 description=description.replace(new RegExp('\\s+\\d+(?:\\.\\d+)?(?:\\s+'+measurePattern+')?\\s*$','i'),'');names.push(M.normal(description));
 description=description.replace(new RegExp('\\s+(?:per\\s+|/\\s*)'+measurePattern+'\\s*$','i'),'');names.push(M.normal(description));
 description=description.replace(new RegExp('\\s+(?:\\d+(?:\\.\\d+)?\\s*[x×]\\s*)?\\d+(?:\\.\\d+)?\\s*'+measurePattern+'\\s*$','i'),'');names.push(M.normal(description));
 return names.includes(M.normal(product.name));
}
function measure(text){const match=String(text||'').trim().toLowerCase().match(new RegExp('^(?:(\\d+(?:\\.\\d+)?)\\s*[x×]\\s*)?(\\d+(?:\\.\\d+)?)?\\s*('+measurePattern+')$'));if(!match)return null;const unit=measures[match[3]],size=Number(match[1]||1)*Number(match[2]||1)*unit[1];return size>0&&Number.isFinite(size)?{kind:unit[0],size}:null;}
function factor(line,product,text){
 const description=line.description.toLowerCase();
 const explicit=description.match(new RegExp('(?:\\bper\\s+|\\$/\\s*|/\\s*)('+measurePattern+')\\b'));
 const trailing=description.match(new RegExp('(?:^|\\s)\\d+(?:\\.\\d+)?\\s+('+measurePattern+')\\s*$'));
 const pack=description.match(new RegExp('(?:^|\\s)((?:\\d+(?:\\.\\d+)?\\s*[x×]\\s*)?\\d+(?:\\.\\d+)?\\s*'+measurePattern+')(?:\\s|$)'));
 const headers=String(text).split(/\r?\n/).filter(row=>/\b(?:qty|quantity)\b/i.test(row)&&/\b(?:amount|total)\b/i.test(row)&&/\bprice\b/i.test(row));
 const headerUnits=headers.map(row=>row.toLowerCase().match(/price\s*(?:per|\/)\s*([^\s|]+)/)?.[1]||'');
 const headerBasis=headerUnits.length&&new Set(headerUnits).size===1?headerUnits[0]:'';
 if(!explicit&&new Set(headerUnits).size>1)return null;
 if(!explicit&&/\bper\s+/i.test(description))return null;
 const basis=explicit?.[1]||headerBasis||trailing?.[1]||pack?.[1];
 if(!basis)return '1'; // Supplier SKU/name identifies its normal ordering unit.
 const from=measure(basis),to=measure(product.unitAmount);
 if(!from||!to||from.kind!==to.kind)return null;
 const ratio=to.size/from.size,rounded=Number(ratio.toFixed(6));
 if(Math.abs(ratio-rounded)>1e-9)return null;
 const value=String(rounded);return M.cost(line.unitPriceCents,value)===null?null:value;
}
function build(source,data,history=[]){
 const text=source.ocrText||'',rows=M.extract(text),empty={supplierId:null,lines:[],changes:[]};
 if(M.credit(text))return empty;
 const name=supplierName(source.supplier),named=data.suppliers.filter(s=>name&&supplierName(s.name)===name);
 let supplier=named.length===1?named[0]:null;
 if(!supplier){const headings=text.split(/\r?\n/).slice(0,12).map(supplierName),found=data.suppliers.filter(s=>headings.includes(supplierName(s.name)));if(found.length===1)supplier=found[0];}
 if(!supplier){const evidence=new Set();let ambiguous=false;for(const row of rows){const result=M.match(row,data.products);if(result.id)evidence.add(data.products.find(p=>p.id===result.id).supplierId);else if(result.by.startsWith('Ambiguous'))ambiguous=true;}if(!ambiguous&&evidence.size===1)supplier=data.suppliers.find(s=>s.id===[...evidence][0]);}
 if(!supplier)return empty;
 const products=data.products.filter(p=>p.supplierId===supplier.id),matched=[];
 for(const row of rows){const match=M.match(row,products),product=products.find(p=>p.id===match.id);if(!product||row.unitPriceCents===null||match.by==='Name'&&!exactName(row,product))continue;const previous=history.filter(h=>h.invoiceId===source.id&&h.locationId===source.locationId).flatMap(h=>h.changes).find(c=>c.lineId===row.id&&c.productId===product.id&&c.invoiceUnitPriceCents===row.unitPriceCents&&c.unitAmount===(product.unitAmount||'')&&c.sku===(product.sku||''));const conversion=previous?.factor??factor(row,product,text);if(conversion===null)continue;const next=M.cost(row.unitPriceCents,conversion);if(next===null)continue;matched.push({...row,productId:product.id,factor:conversion,match:match.by,name:product.name,currentPriceCents:product.price,newPriceCents:next,expectedUnitAmount:product.unitAmount||'',expectedSku:product.sku||''});}
 const grouped=new Map();for(const row of matched){const group=grouped.get(row.productId)||[];group.push(row);grouped.set(row.productId,group);}
 const lines=[...grouped.values()].filter(group=>new Set(group.map(row=>row.newPriceCents)).size===1).map(group=>group[0]);
 const confirmed=source.id&&history.some(h=>h.invoiceId===source.id&&h.locationId===source.locationId&&h.invoiceRevision===source.revision);
 const changes=source.invoiceDate&&!confirmed?lines.filter(row=>row.newPriceCents!==row.currentPriceCents&&!history.some(h=>h.invoiceDate>source.invoiceDate&&h.changes.some(c=>c.productId===row.productId))):[];
 return{supplierId:supplier.id,lines,changes};
}
module.exports={build};
