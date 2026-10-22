const point=(anchor,offsetMinutes=0)=>({anchor,offsetMinutes});
const plannerDraft={title:'Before opening',instructions:'Follow the approved opening procedure.',schedule:{kind:'daily',startDate:'',endDate:'',days:[1,2,3,4,5,6,7]},startTime:'',activeFrom:'',activeUntil:'',dueTime:'',dueAfterDays:0,reminderMinutes:30,priority:'normal',tradingHours:{start:point('opening',-30),until:point('closing'),due:point('opening')}};
module.exports={plannerDraft,point};
