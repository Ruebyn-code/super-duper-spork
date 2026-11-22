// Individual units for a stock item, worked out from its saved counting unit, pack description (unitAmount) and name, so
// staff can record 1 pita or 100 g of chicken instead of a whole pack. Shared by the server (to validate a chosen unit) and
// the browser (to offer it). Every unit is an ordinary stock-count-units unit: {name, perUnit} for pieces, or a gram /
// millilitre measure, converted back to ordered packs with stockCountUnits.quantity. Nothing is saved on the item.
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./stock-count-units'):root.stockCountUnits);if(typeof module==='object'&&module.exports)module.exports=api;else root.stockIndividualUnits=api;})(typeof globalThis==='object'?globalThis:this,function(units){
 const containers=new Set(['pack','packs','pk','pkt','packet','packets','box','boxes','bx','bag','bags','carton','cartons','ctn','ctns','case','cases','cs','tray','trays','tub','tubs','bundle','bundles','pcs','pc','piece','pieces','each','ea','unit','units','count','ct','x','per','of','and','with','in','sleeve-pack']);
 const measureWords=/^(kg|kgs|kilo|kilos|kilogram|kilograms|g|gm|gms|gr|gram|grams|mg|l|lt|ltr|ltrs|litre|litres|liter|liters|ml|mls|millilitre|millilitres|milliliter|milliliters|mm|cm|m|oz|lb|lbs|cl|dl)$/;
 const singular=word=>/(ss|us|is)$/.test(word)||word.length<=3?word:word.replace(/ies$/,'y').replace(/(ches|shes|xes|oes)$/,m=>m.slice(0,-2)).replace(/s$/,'');
 const title=word=>word.charAt(0).toUpperCase()+word.slice(1);
 const exact=value=>Math.round(value*1000)/1000;
 // Weight or volume in a description such as "15kg box", "2 x 5 kg", "10 x 500g" or "2L"; totals are per ordered pack.
 function measure(text){
  const match=text.match(/(?:(\d+(?:\.\d+)?)\s*[x×*]\s*)?(\d+(?:\.\d+)?)\s*(kg|kgs|kilos?|kilograms?|g|gm|gms|grams?|l|lt|ltrs?|litres?|liters?|ml|mls|millilitres?|milliliters?)\b/i);if(!match)return null;
  const count=match[1]?Number(match[1]):1,amount=Number(match[2])*count,word=match[3].toLowerCase();if(!(amount>0))return null;
  if(/^(kg|kgs|kilo|kilos|kilogram|kilograms)$/.test(word))return{name:'g',perUnit:exact(amount*1000),measure:'weight'};
  if(/^(g|gm|gms|gram|grams)$/.test(word))return{name:'g',perUnit:exact(amount),measure:'weight'};
  if(/^(l|lt|ltr|ltrs|litre|litres|liter|liters)$/.test(word))return{name:'mL',perUnit:exact(amount*1000),measure:'volume'};
  return{name:'mL',perUnit:exact(amount),measure:'volume'};
 }
 // Pieces in a description such as "Pack of 10 pita", "Box of 20 sleeves", "24 cans", "12 pack" or "10 x 500g".
 function pieces(text){
  const multi=text.match(/\b(\d{1,6})\s*[x×*]\s*\d/i);if(multi&&Number(multi[1])>1)return{name:'Each',perUnit:Number(multi[1])};
  let best=null;
  for(const match of text.matchAll(/\b(\d{1,6})\s*([a-z][a-z-]{0,24})?/gi)){
   const number=Number(match[1]),word=(match[2]||'').toLowerCase();if(!(number>1))continue;
   if(/^[.,]\d/.test(text.slice(match.index+match[1].length)))continue; // part of a decimal such as 1.5kg
   if(word&&measureWords.test(word))continue; // 15kg, 10mm, 2L are sizes, not pieces
   if(word&&!containers.has(word)){best={number,noun:word};break;}
   if(!best&&(word&&containers.has(word)||/\bof\s*$/i.test(text.slice(0,match.index))))best={number,noun:''};
  }
  if(!best)return null;return{name:best.noun?title(singular(best.noun)):'Each',perUnit:best.number};
 }
 // All extra units for a product, smallest-first preference: pieces, then grams/millilitres. Includes a gram/mL unit for
 // a saved kg/L counting unit. Duplicates of the saved counting unit are left out.
 function derive(product){
  const saved=units.normalize(product?.countUnit),found=[],add=unit=>{const normal=units.normalize(unit);if(!normal||found.some(other=>units.equal(other,normal))||saved&&units.equal(saved,normal))return;if(saved&&!saved.measure&&!normal.measure&&saved.perUnit===normal.perUnit)return;found.push(normal);};
  for(const text of [product?.unitAmount||'',product?.name||'']){const piece=pieces(String(text));if(piece){add(piece);break;}}
  if(saved?.measure==='weight')add({name:'g',perUnit:exact(saved.name==='kg'?saved.perUnit*1000:saved.perUnit),measure:'weight'});
  else if(saved?.measure==='volume')add({name:'mL',perUnit:exact(saved.name==='L'?saved.perUnit*1000:saved.perUnit),measure:'volume'});
  else for(const text of [product?.unitAmount||'',product?.name||'']){const size=measure(String(text));if(size){add(size);break;}}
  return found;
 }
 // Units a wastage entry may use: the saved counting unit plus the derived ones.
 function allowed(product){const saved=units.normalize(product?.countUnit);return[...(saved?[saved]:[]),...derive(product)];}
 // The unit to start with: the smallest individual unit (pieces first, then g/mL), else the saved counting unit.
 function individual(product){const all=allowed(product);return all.find(unit=>!unit.measure)||all.find(unit=>unit.measure&&(unit.name==='g'||unit.name==='mL'))||all[0]||null;}
 function label(unit){if(!unit)return'';if(unit.measure)return(unit.name==='g'?'Grams (g)':unit.name==='mL'?'Millilitres (mL)':unit.name)+' · '+new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(unit.perUnit)+' per pack';return unit.name+' · '+unit.perUnit+' per pack';}
 return{derive,allowed,individual,label,parsePieces:pieces,parseMeasure:measure};
});
