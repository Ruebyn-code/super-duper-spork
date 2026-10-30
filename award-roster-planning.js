'use strict';
// Planning-only calendars are ephemeral. They never review payroll calendars.
const holidays=require('./australian-public-holidays');
const M=require('./public/rostering-model');
function calendarFor(config,location,year){
 const calendar=holidays.resolve(config,location.id,year,{forecast:true,state:location.publicHolidayState});
 return calendar.confirmed===true||calendar.automatic===true?calendar:null;
}
function configFor(config,locations,items){
 const calendars=new Map();
 for(const item of items){
  const location=locations.find(l=>l.id===item.locationId);if(!location)continue;
  const facts=item.awardFacts||{},ranges=[[item.startAt,item.endAt],...[['travelStartAt','travelMinutes'],['returnTravelStartAt','returnTravelMinutes']].filter(([,minutes])=>Number.isFinite(facts[minutes])&&facts[minutes]>0).map(([start,minutes])=>[facts[start],Date.parse(facts[start])+facts[minutes]*60000])];
  for(const [start,end]of ranges){
   const first=Date.parse(start),last=typeof end==='number'?end:Date.parse(end);if(!Number.isFinite(first)||!Number.isFinite(last)||last<first)continue;
   const from=Number(M.localParts(new Date(first).toISOString()).date.slice(0,4)),to=Number(M.localParts(new Date(last).toISOString()).date.slice(0,4));
   for(let year=Math.max(2000,from);year<=Math.min(2100,to);year++){
    const key=location.id+':'+year;if(calendars.has(key))continue;const calendar=calendarFor(config,location,year);if(calendar)calendars.set(key,calendar);
   }
  }
 }
 return{...config,planningCalendars:[...calendars.values()]};
}
function readiness(config,location,date,issues){
 const year=Number(date.slice(0,4)),calendar=calendarFor(config,location,year),unique=new Map(issues.map(i=>[i.code,i]));
 if(typeof config.employerName!=='string'||!config.employerName.trim())unique.set('employer-name',{code:'employer-name',message:'Add the legal employer name in this location’s Employer setup.'});
 if(!calendar)unique.set('holiday-state',{code:'holiday-state',message:'Choose this location’s state or territory in Location settings, or review its public holiday calendar.'});
 return{ready:unique.size===0,issues:[...unique.values()],calendar:calendar?{year,automatic:calendar.automatic===true,reviewed:calendar.confirmed===true,state:calendar.state||location.publicHolidayState||null}:null};
}
module.exports={configFor,readiness};
