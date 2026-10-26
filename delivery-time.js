const zones={ACT:'Australia/Sydney',NSW:'Australia/Sydney',NT:'Australia/Darwin',QLD:'Australia/Brisbane',SA:'Australia/Adelaide',TAS:'Australia/Hobart',VIC:'Australia/Melbourne',WA:'Australia/Perth'},cache=new Map();
const validDate=value=>typeof value==='string'&&/^20\d\d-\d\d-\d\d$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
function shift(date,days){return new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);}
function parts(epoch,zone='Australia/Melbourne'){let formatter=cache.get(zone);if(!formatter){formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});cache.set(zone,formatter);}const p=Object.fromEntries(formatter.formatToParts(new Date(epoch)).map(p=>[p.type,p.value]));return{date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute,second:p.second};}
// Resolve wall-clock deadlines deterministically: repeated times use the later
// instant; a skipped time moves to the first valid minute after the gap.
function instant(date,time,zone='Australia/Melbourne'){
 if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Object.assign(Error('Choose a valid delivery date and time.'),{status:400});
 const wall=Date.parse(date+'T'+time+':00Z'),offsets=new Set();for(let at=wall-36*3600000;at<=wall+36*3600000;at+=6*3600000){const p=parts(at,zone);offsets.add(Date.parse(p.date+'T'+p.time+':'+p.second+'Z')-Math.floor(at/1000)*1000);}
 const matches=[...offsets].map(offset=>wall-offset).filter(at=>{const p=parts(at,zone);return p.date===date&&p.time===time;});if(matches.length)return Math.max(...matches);
 const minute=Number(time.slice(0,2))*60+Number(time.slice(3));for(let next=minute+1;next<1440;next++){const t=String(Math.floor(next/60)).padStart(2,'0')+':'+String(next%60).padStart(2,'0');for(const offset of offsets){const at=Date.parse(date+'T'+t+':00Z')-offset,p=parts(at,zone);if(p.date===date&&p.time===t)return at;}}throw Error('The delivery time could not be resolved.');
}
module.exports={zones,validDate,shift,parts,instant,zoneFor:location=>zones[location?.publicHolidayState]||'Australia/Melbourne'};
