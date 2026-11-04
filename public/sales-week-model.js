// Shared Monday–Sunday week numbering for Daily sales, Weekly report and Weekly overview.
// A week belongs to the quarter and year containing its Sunday (the same rule as the overview),
// so the first week of a period is the one ending on the first Sunday inside it.
(function(root){
 const DAY=86400000,WEEK=7*DAY;
 const firstSunday=ms=>ms+((7-new Date(ms).getUTCDay())%7)*DAY;
 function info(weekStart){
  if(typeof weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(weekStart))return null;
  const monday=Date.parse(weekStart+'T00:00:00Z');if(!Number.isFinite(monday))return null;
  const sunday=monday+6*DAY,date=new Date(sunday),year=date.getUTCFullYear(),quarter=Math.floor(date.getUTCMonth()/3)+1;
  return{year,quarter,quarterWeek:Math.floor((sunday-firstSunday(Date.UTC(year,(quarter-1)*3,1)))/WEEK)+1,yearWeek:Math.floor((sunday-firstSunday(Date.UTC(year,0,1)))/WEEK)+1};
 }
 // Appends a small "Week 6 of Q4 · Week 45 of 2026" tag after a node's existing text.
 function tag(node,weekStart,wording=(text,values)=>text.replace(/\{(\w+)\}/g,(_,key)=>String(values[key]))){
  const week=info(weekStart);if(!node||!week||typeof document!=='object')return null;
  const span=document.createElement('span');span.className='sales-week-number';span.dataset.userText='';span.textContent=wording('Week {quarterWeek} of Q{quarter} · Week {yearWeek} of {year}',week);node.append(' ',span);return span;
 }
 const api={info,tag};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.salesWeek=api;
})(typeof window==='object'?window:this);
