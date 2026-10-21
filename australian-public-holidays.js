const Holidays=require('date-holidays');
const fs=require('node:fs/promises'),path=require('node:path');
const {shift}=require('./stock-usage');
const states={ACT:'Australian Capital Territory',NSW:'New South Wales',NT:'Northern Territory',QLD:'Queensland',SA:'South Australia',TAS:'Tasmania',VIC:'Victoria',WA:'Western Australia'};
const source={name:'date-holidays',version:'3.37.0',url:'https://github.com/commenthol/date-holidays',licence:'ISC / CC BY-SA 3.0'};
const cache=new Map();
function validState(value){return typeof value==='string'&&Object.hasOwn(states,value);}
function generate(state,year){
 if(!validState(state))throw Error('Choose an Australian state or territory.');
 if(!Number.isInteger(year)||year<2000||year>2100)throw Error('Choose a holiday year from 2000 to 2100.');
 const key=state+':'+year;if(cache.has(key))return structuredClone(cache.get(key));
 const calendar=new Holidays('AU',state,{languages:['en'],types:['public']}),zone=calendar.getTimezones()[0],formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}),periods=[],notes=new Set();
 for(const holiday of calendar.getHolidays(year)){
  const first=holiday.date.slice(0,10),start=holiday.date.slice(11,16),parts=Object.fromEntries(formatter.formatToParts(holiday.end).map(part=>[part.type,part.value])),last=parts.year+'-'+parts.month+'-'+parts.day,end=parts.hour+':'+parts.minute;
  if(holiday.note)notes.add(holiday.note);
  for(let date=first;date<=last;date=shift(date,1)){
   const opening=date===first?start:'00:00',closing=date<last?'24:00':end;
   if(Number(date.slice(0,4))===year&&opening<closing)periods.push({date,start:opening,end:closing,name:holiday.name});
  }
 }
 periods.sort((a,b)=>a.date.localeCompare(b.date)||a.start.localeCompare(b.start)||a.name.localeCompare(b.name));
 const dates=[];for(const period of periods){const previous=dates.at(-1);if(previous&&previous.date===period.date&&period.start<previous.end){previous.end=previous.end>period.end?previous.end:period.end;if(!previous.name.split(' / ').includes(period.name))previous.name+=' / '+period.name;}else dates.push({...period});}
 const result={year,state,automatic:true,confirmed:false,brokenHill:false,dates,source,notes:[...notes]};cache.set(key,result);return structuredClone(result);
}
function resolve(config,locationId,year,{forecast=false,state}={}){
 const saved=config?.holidayCalendars?.find(calendar=>calendar.locationId===locationId&&calendar.year===year);
 if(saved&&(!forecast||saved.confirmed===true||!validState(state)))return {...saved,automatic:false};
 if(validState(state))return {...generate(state,year),locationId};
 return saved?{...saved,automatic:false}:{locationId,year,confirmed:false,brokenHill:false,dates:[],automatic:false};
}
async function locationCalendars(dir,session,years){
 if(!session.locationId||!session.companyId)return [];
 const read=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(path.join(dir,file),'utf8'));}catch(error){if(error.code==='ENOENT')return fallback;throw error;}};
 const [settings,locations]=await Promise.all([read('award-compliance.json',{}),read('locations.json',[])]),config=settings.companies?.find(company=>company.companyId===session.companyId),location=locations.find(location=>location.id===session.locationId&&(location.companyId||'default')===session.companyId&&!location.archived);
 return [...new Set(years)].filter(year=>Number.isInteger(year)&&year>=2000&&year<=2100).map(year=>resolve(config,session.locationId,year,{forecast:true,state:location?.publicHolidayState})).filter(calendar=>calendar.confirmed===true||calendar.automatic===true);
}
module.exports={states,source,validState,generate,resolve,locationCalendars};
