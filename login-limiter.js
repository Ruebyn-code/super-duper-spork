const crypto=require('node:crypto');
// Reserve synchronously so concurrent requests cannot all pass an empty counter.
module.exports=function createLimiter({now=Date.now,maxKeys=10000}={}){
 const records=new Map(),windowMs=15*60000;
 return function reserve(value,max=10){
  const at=now();for(const[key,record]of records)if(record.until<=at)records.delete(key);
  const key=crypto.createHash('sha256').update(String(value)).digest('hex');let record=records.get(key);
  if(!record){if(records.size>=maxKeys)throw Object.assign(Error('Too many sign-in attempts. Try again later.'),{status:429});record={count:0,until:at+windowMs};records.set(key,record);}
  if(record.count>=max)throw Object.assign(Error('Too many sign-in attempts. Try again in 15 minutes.'),{status:429});record.count++;
  let finished=false;return{failure(){finished=true;},success(){if(finished)return;finished=true;record.count--;if(!record.count&&records.get(key)===record)records.delete(key);}};
 };
};
