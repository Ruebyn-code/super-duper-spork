(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.invoiceReader=factory();})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='1900-01-01'&&value<='9998-12-31'&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 function monday(value){if(!validDate(value))return null;return new Date(Date.parse(value+'T00:00:00Z')-(new Date(value+'T00:00:00Z').getUTCDay()+6)%7*86400000).toISOString().slice(0,10);}
 function money(value){const match=String(value??'').trim().replace(/^AUD\s*/i,'').replace(/^\$\s*/,'').match(/^(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d{1,2}))?$/);if(!match)return null;const cents=Number(match[1].replaceAll(',',''))*100+Number((match[2]||'').padEnd(2,'0'));return Number.isSafeInteger(cents)&&cents<=7000000000?cents:null;}
 function date(value){
  const text=String(value||'').trim();if(validDate(text))return text;let match=text.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/),year,month,day;
  if(match){day=Number(match[1]);month=Number(match[2]);year=Number(match[3]);if(year<100)year+=2000;}
  else{const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];match=text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})[ ,]+(\d{4})\b/);if(match){day=Number(match[1]);month=months.indexOf(match[2].slice(0,3).toLowerCase())+1;year=Number(match[3]);}else{const iso=text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];return validDate(iso)?iso:null;}}
  const result=String(year).padStart(4,'0')+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');return validDate(result)?result:null;
 }
 function extract(text){
  const lines=String(text||'').split(/\r?\n/).map(line=>line.replace(/\s+/g,' ').trim()).filter(Boolean),amounts=line=>[...line.matchAll(/(?:AUD\s*)?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}(?!\d|%)/gi)].map(match=>money(match[0])).filter(value=>value!==null),last=line=>amounts(line).at(-1)??null;
  const supplierLine=lines.find(line=>/^supplier\s*:/i.test(line)),supplier=supplierLine?supplierLine.replace(/^supplier\s*:\s*/i,''):lines.slice(0,8).find(line=>line.length>2&&/[A-Za-z]/.test(line)&&!/(?:^tax invoice|^invoice(?:\b|[-#])|^date\b|\babn\b|^bill(?:ed)? to|^ship to|^page\b)/i.test(line))||'';
  const number=lines.map(line=>line.match(/\binvoice\s*(?:number|no\.?|#|id|ref)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9/_-]{1,79})/i)?.[1]).find(Boolean)||lines.find(line=>/^INV[-#][A-Za-z0-9-]+$/i.test(line))||'';
  const invoiceDate=lines.filter(line=>/\bdate\b/i.test(line)&&!/\bdue\b/i.test(line)).map(date).find(Boolean)||lines.filter(line=>!/\bdue\b/i.test(line)).map(date).find(Boolean)||null;
  const subtotalCents=lines.filter(line=>/\bsub\s*-?\s*total\b|^net\s+(?:total|amount)\b/i.test(line)).map(last).find(value=>value!==null)??null,taxCents=lines.filter(line=>/^(?:(?:total|includes?|incl\.?)\s+)?(?:gst|vat|tax)\b/i.test(line)).map(last).find(value=>value!==null)??null;
  const totals=lines.filter(line=>!/\bsub\s*-?\s*total\b|\btax\b|\bgst\s*only\b/i.test(line)).map(line=>({value:last(line),priority:/^(?:grand|invoice)\s+total\b/i.test(line)?5:/^total\b/i.test(line)?4:/^amount\s+due\b/i.test(line)?3:/^balance\s+due\b/i.test(line)?2:0})).filter(row=>row.priority&&row.value!==null).sort((a,b)=>b.priority-a.priority);
  return {supplier:supplier.slice(0,120),invoiceNumber:number.slice(0,80),invoiceDate,subtotalCents,taxCents,totalCents:totals[0]?.value??null};
 }
 return {extract,money,date,validDate,monday};
});
