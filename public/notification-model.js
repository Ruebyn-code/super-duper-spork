// Notification categories shared by the server feed and the notification centre.
(function(root){
 const categories=[
  ['messages','Messages','Direct messages and group chats','Your work'],
  ['posts','Posts','Company and network posts, including required reading','Your work'],
  ['training','Training','Assigned courses, in-store training and sign-offs','Your work'],
  ['agreements','Agreements','Employment agreements waiting for your signature','Your work'],
  ['timesheets','Timesheets','Timesheets waiting for approval','Your work'],
  ['roster','Roster','Published rosters and today’s shifts','Rosters'],
  ['leave','Leave','Leave decisions and requests to review','Rosters'],
  ['checklists','Checklists','Checklists ready or due soon at this location','Checklists'],
  ['equipment','Equipment','Reported problems and services due','Equipment'],
  ['transfers','Stock transfers','Incoming stock transfers to receive','Stock transfers'],
  ['sales','Daily sales','Today’s sales entry reminder','Daily sales'],
  ['reports','Reports','New OpStack intelligence reports in your inbox','Reports']
 ].map(([id,name,description,collector])=>({id,name,description,collector}));
 const collector=Object.fromEntries(categories.map(c=>[c.id,c.collector]));
 const localDate=instant=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Melbourne',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));return['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');};
 const monday=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
 const badge=count=>count>9?'9+':String(count);
 const api={categories:categories.map(({collector:_,...c})=>c),collector,localDate,monday,badge};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.notificationModel=api;
})(typeof window==='object'?window:globalThis);
