/* Invoice text is data. Only explicit, reviewed stock matches can change prices. */
(function(root){
 const normal=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
 const code=value=>String(value||'').normalize('NFKC').trim().toUpperCase();
 function amount(value){const text=String(value??'').replace(/[$,\s]/g,'');if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;const [whole,fraction='']=text.split('.'),cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));return Number.isSafeInteger(cents)&&cents<=100000000?cents:null;}
 function cost(cents,factor='1'){if(!Number.isSafeInteger(cents)||cents<0||cents>100000000||!/^\d{1,7}(?:\.\d{1,6})?$/.test(String(factor)))return null;const[whole,fraction='']=String(factor).split('.'),scaled=BigInt(whole)*1000000n+BigInt(fraction.padEnd(6,'0'));if(scaled<=0n||scaled>1000000000000n)return null;const result=Number((BigInt(cents)*scaled+500000n)/1000000n);return result<=100000000?result:null;}
 const credit=text=>/^\s*(?:tax\s+)?credit\s+note\b/im.test(String(text||''));
 function extract(text){
  if(credit(text))return[];let unitColumn=null;const result=[];
  for(const raw of String(text||'').slice(0,200000).split(/\r?\n/)){
   const line=raw.trim();if(!line)continue;
   const header=line.match(/\b(?:unit\s*(?:price|cost)|price\s*(?:per|\/)|price|rate)\b/i);if(header&&/\b(?:qty|quantity|amount|total)\b/i.test(line)){const tail=line.slice(header.index+header[0].length);unitColumn={clear:/\b(?:amount|total|value|extended)\b/i.test(tail)&&!/\b(?:gst|tax|discount|qty|quantity)\b/i.test(tail)};continue;}
   if(!unitColumn||/^(?:sub\s*total|grand\s*total|total|gst|tax|freight|delivery|discount|balance|amount\s+due|payment|bank|bsb|account|invoice\b|date\b|abn\b)\b/i.test(line))continue;
   const values=[...line.matchAll(/(?:^|\s|\|)(\$?\d[\d,]*\.\d{2,6})(?=\s|\||$)/g)];if(values.length<2)continue;
   const first=values.at(-2),prefix=line.slice(0,first.index).trim();if(!/[A-Za-z]/.test(prefix)||/[-(]\s*\$?\d/.test(line.slice(first.index)))continue;
   const unitPriceCents=unitColumn.clear?amount(first[1]):null;
   const sku=prefix.match(/^([\w][\w./-]*\d[\w./-]*)\s+/)?.[1]||'';
   result.push({id:'line-'+result.length,description:prefix.slice(0,300),sku:sku.slice(0,60),unitPriceCents,factor:'1',productId:null});if(result.length===500)break;
  }return result;
 }
 function match(line,products){const withSku=products.filter(p=>p.sku&&(code(p.sku)===code(line.sku)||(' '+code(line.description).replace(/\s+/g,' ')+' ').includes(' '+code(p.sku)+' ')));if(withSku.length)return withSku.length===1?{id:withSku[0].id,by:'SKU'}:{id:null,by:'Ambiguous SKU'};const description=' '+normal(line.description)+' ',names=products.filter(p=>normal(p.name)&&description.includes(' '+normal(p.name)+' '));if(names.length===1&&line.sku&&names[0].sku&&code(line.sku)!==code(names[0].sku))return{id:null,by:'SKU does not match'};return names.length===1?{id:names[0].id,by:'Name'}:{id:null,by:names.length?'Ambiguous name':'Not matched'};}
 function lines(input){if(!Array.isArray(input)||input.length>500)throw Error('Choose up to 500 invoice items.');const ids=new Set();return input.map(row=>{if(!row||typeof row!=='object'||typeof row.id!=='string'||!/^[-\w]{1,80}$/.test(row.id)||ids.has(row.id)||typeof row.description!=='string'||row.description.length>300||typeof row.sku!=='string'||row.sku.length>60||row.unitPriceCents!==null&&(!Number.isSafeInteger(row.unitPriceCents)||row.unitPriceCents<0||row.unitPriceCents>100000000)||row.productId!==null&&(typeof row.productId!=='string'||!/^[-\w]{1,100}$/.test(row.productId))||row.factor===undefined||cost(0,row.factor)===null)throw Error('Enter valid invoice items, unit prices and conversions.');ids.add(row.id);return{id:row.id,description:row.description.trim(),sku:row.sku.trim(),unitPriceCents:row.unitPriceCents,factor:String(row.factor),productId:row.productId};});}
 const api={normal,amount,cost,credit,extract,match,lines};if(typeof module==='object'&&module.exports)module.exports=api;else root.invoicePriceModel=api;
})(globalThis);
