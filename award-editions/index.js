'use strict';
// Award rate editions are reviewed data files, one per Fair Work edition (usually each 1 July).
// Each file must be checked against the official award PDF before it is added; see docs/awards/README.md.
const fs=require('node:fs'),path=require('node:path');
const keys=['1','2','3-one','3-many'],allowanceKeys=['brokenHill','cold','freezer','meal','furtherMeal','laundryFullTime','laundryShift','deliveryKm','otherKm'];
const date=/^\d{4}-\d{2}-\d{2}$/;
function fail(file,message){throw Error('Award edition '+file+': '+message);}
function validate(value,file){
 if(!value||typeof value!=='object'||Array.isArray(value))fail(file,'must be an object.');
 if(typeof value.id!=='string'||!/^MA000003-\d{4}-\d{2}-v\d+$/.test(value.id))fail(file,'needs an id such as MA000003-2027-07-v1.');
 if(value.code!=='MA000003')fail(file,'must be the Fast Food Industry Award (MA000003).');
 for(const key of ['title','label','url'])if(typeof value[key]!=='string'||!value[key].trim())fail(file,'needs '+key+'.');
 if(!value.url.startsWith('https://'))fail(file,'needs an https source URL.');
 if(!date.test(value.effectiveFrom||'')||!date.test(value.reviewBy||'')||value.reviewBy<=value.effectiveFrom)fail(file,'needs effectiveFrom and a later reviewBy date.');
 if(!/^[a-f0-9]{64}$/.test(value.sha256||''))fail(file,'needs the SHA-256 of the reviewed source document.');
 if(!Array.isArray(value.amendments)||value.amendments.some(item=>typeof item!=='string'||!item))fail(file,'needs its amendment references.');
 for(const key of keys){const weekly=value.weeklyRates?.[key],hourly=value.adultRates?.[key];
  if(!Number.isSafeInteger(weekly)||weekly<=0||!Number.isSafeInteger(hourly)||hourly<=0)fail(file,'needs whole-cent weekly and adult hourly rates for every classification.');
  // Clause 15.1: the adult hourly rate is the weekly rate divided by 38, rounded to the nearest cent.
  if(Math.floor((weekly*100+1900)/3800)!==hourly)fail(file,'adult hourly rate for '+key+' does not equal its weekly rate ÷ 38.');}
 if(Object.keys(value.weeklyRates).length!==keys.length||Object.keys(value.adultRates).length!==keys.length)fail(file,'has unexpected classifications.');
 for(const key of allowanceKeys)if(!Number.isSafeInteger(value.allowances?.[key])||value.allowances[key]<=0)fail(file,'needs a positive whole-cent '+key+' allowance.');
 if(Object.keys(value.allowances).length!==allowanceKeys.length)fail(file,'has unexpected allowances.');
 return Object.freeze({...value,amendments:Object.freeze([...value.amendments]),weeklyRates:Object.freeze({...value.weeklyRates}),adultRates:Object.freeze({...value.adultRates}),allowances:Object.freeze({...value.allowances})});
}
function load(dirs=[__dirname]){
 const editions=[];
 for(const dir of dirs)for(const name of fs.readdirSync(dir).filter(item=>item.endsWith('.json')).sort())editions.push(validate(JSON.parse(fs.readFileSync(path.join(dir,name),'utf8')),name));
 editions.sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom));
 if(!editions.length)throw Error('No award editions are available.');
 for(let i=1;i<editions.length;i++){if(editions[i].effectiveFrom===editions[i-1].effectiveFrom)throw Error('Two award editions start on '+editions[i].effectiveFrom+'.');}
 if(new Set(editions.map(item=>item.id)).size!==editions.length)throw Error('Award edition ids must be unique.');
 return Object.freeze(editions);
}
// Tests can add synthetic editions from an extra directory; production only reads the reviewed files here.
module.exports={editions:load(process.env.OPSTACK_TEST_AWARD_EDITIONS?[__dirname,process.env.OPSTACK_TEST_AWARD_EDITIONS]:[__dirname]),validate,load};
