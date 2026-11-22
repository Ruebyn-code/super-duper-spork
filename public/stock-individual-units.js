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
 const singularContainers=new Set(['pack','pk','pkt','packet','box','bx','bag','carton','ctn','case','cs','tray','tub','bundle','sleeve','roll','jar','bottle','tin','can','punnet','slab']);
 const fillers=new Set(['x','of','per','and','with','in','each','ea','pcs','pc','piece','pieces','unit','units','count','ct','inner','inners','outer']);
 const kind=word=>/^(kg|kgs|kilos?|kilograms?)$/.test(word)?['g',1000,'weight']:/^(g|gm|gms|gr|grams?)$/.test(word)?['g',1,'weight']:/^(l|lt|ltrs?|litres?|liters?)$/.test(word)?['mL',1000,'volume']:/^(ml|mls|millilitres?|milliliters?)$/.test(word)?['mL',1,'volume']:null;
 // Breaks a pack description down to its smallest count by multiplying every nested pack size, e.g.
 // "Box of 8 packs of 10 pita" → 80 pita (with 8 packs on the way), "2 x 12 x 330ml" → 24 each and 7,920 mL,
 // "Carton 6 x 1kg" → 6 each and 6,000 g, "12 pack" → 12 each, "Box of 1,000 cups" → 1,000 cups.
 function breakdown(text){
  text=String(text||'');let total=1,counted=false,noun='',size=null;const levels=[];
  for(const match of text.matchAll(/(\d{1,3}(?:,\d{3})+(?!\d)|\d+(?:\.\d+)?)\s*([a-z][a-z-]{0,24})?/gi)){
   const number=Number(match[1].replace(/,/g,'')),word=(match[2]||'').toLowerCase(),measure=word&&measureWords.test(word)?kind(word):null;
   if(word&&measureWords.test(word)){if(measure&&!size&&number>0)size={name:measure[0],amount:number*measure[1],measure:measure[2]};continue;}
   if(!Number.isInteger(number)||number<2)continue;
   if(word&&singularContainers.has(word)){total*=number;counted=true;continue;} // "12 pack" = a pack of 12
   total*=number;counted=true;
   if(word&&!fillers.has(word)&&!containers.has(singular(word))&&!containers.has(word))noun=word; // "10 pita"
   else if(word&&!fillers.has(word))levels.push({name:title(singular(word)),perUnit:total}); // "8 packs" of something smaller
  }
  if(total>1000000)return{pieces:null,size:null,levels:[]};
  const last=levels[levels.length-1],pieces=counted?{name:noun?title(singular(noun)):last&&last.perUnit===total?last.name:'Each',perUnit:total}:null;
  const weight=size?{name:size.name,perUnit:exact(size.amount*(counted?total:1)),measure:size.measure}:null;
  return{pieces,size:weight&&weight.perUnit<=1000000?weight:null,levels:levels.filter(level=>pieces&&level.perUnit<pieces.perUnit)};
 }
 const measure=text=>breakdown(text).size,pieces=text=>breakdown(text).pieces;
 // All extra units for a product, smallest-first preference: pieces, then grams/millilitres. Includes a gram/mL unit for
 // a saved kg/L counting unit. Duplicates of the saved counting unit are left out.
 function derive(product){
  const saved=units.normalize(product?.countUnit),found=[],add=unit=>{const normal=units.normalize(unit);if(!normal||found.some(other=>units.equal(other,normal))||saved&&units.equal(saved,normal))return;if(saved&&!saved.measure&&!normal.measure&&saved.perUnit===normal.perUnit)return;found.push(normal);};
  const texts=[product?.unitAmount||'',product?.name||''].map(String);
  // "10 pita per pack" on an item counted in Packs (8 per box) means 80 pita per box.
  const perSaved=text=>{if(!saved||saved.measure)return 1;const match=text.match(/\bper\s+([a-z][a-z-]*)/i);return match&&singular(match[1].toLowerCase())===singular(saved.name.toLowerCase())?saved.perUnit:1;};
  let pieceUnits=[];for(const text of texts){const parts=breakdown(text);if(parts.pieces){const times=perSaved(text);pieceUnits=[{...parts.pieces,perUnit:parts.pieces.perUnit*times},...parts.levels.map(level=>({...level,perUnit:level.perUnit*times}))];break;}}
  if(pieceUnits[0])add(pieceUnits[0]);
  if(saved?.measure==='weight')add({name:'g',perUnit:exact(saved.name==='kg'?saved.perUnit*1000:saved.perUnit),measure:'weight'});
  else if(saved?.measure==='volume')add({name:'mL',perUnit:exact(saved.name==='L'?saved.perUnit*1000:saved.perUnit),measure:'volume'});
  else for(const text of texts){const size=breakdown(text).size;if(size){add({...size,perUnit:exact(size.perUnit*perSaved(text))});break;}}
  for(const level of pieceUnits.slice(1))add(level);
  return found;
 }
 // Units a wastage entry may use: the saved counting unit plus the derived ones.
 function allowed(product){const saved=units.normalize(product?.countUnit);return[...(saved?[saved]:[]),...derive(product)];}
 // The unit to start with: the smallest piece (the most per ordered pack), then g/mL, else the saved counting unit.
 function individual(product){const all=allowed(product),counts=all.filter(unit=>!unit.measure).sort((a,b)=>b.perUnit-a.perUnit);return counts[0]||all.find(unit=>unit.measure&&(unit.name==='g'||unit.name==='mL'))||all[0]||null;}
 // What one ordered unit is called: the item's saved name for it (orderUnitName), a leading container word such as
 // "Box of …", otherwise "pack".
 function outer(product){const saved=String(product?.orderUnitName||'').trim();if(saved)return saved.toLowerCase();const lead=String(product?.unitAmount||'').trim().match(/^([a-z]+)\b/i)?.[1]?.toLowerCase();return lead&&singularContainers.has(singular(lead))?singular(lead):'pack';}
 function label(unit,product){if(!unit)return'';const per=' per '+outer(product);if(unit.measure)return(unit.name==='g'?'Grams (g)':unit.name==='mL'?'Millilitres (mL)':unit.name)+' · '+new Intl.NumberFormat('en-AU',{maximumFractionDigits:3}).format(unit.perUnit)+per;return unit.name+' · '+new Intl.NumberFormat('en-AU').format(unit.perUnit)+per;}
 return{derive,allowed,individual,label,breakdown,parsePieces:pieces,parseMeasure:measure};
});
