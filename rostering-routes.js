async function route({req,url,params,session,store,body,json,fail}){
 if(!url.startsWith('/api/rostering/'))return false;if(!session)fail('Sign-in required.',401);if(req.method!=='GET'&&req.headers['x-csrf-token']!==session.csrf)fail('Invalid session token. Sign in again.',403);
 const input=()=>body(req,512000);
 if(url==='/api/rostering/award-check'&&req.method==='GET'){json(200,await store.checkTime(session,params.get('entryId')));return true;}
 if(url==='/api/rostering/clock-status'&&req.method==='GET'){json(200,await store.clockStatus(session));return true;}
 if(url==='/api/rostering/dashboard'&&req.method==='GET'){json(200,await store.dashboard(session,params.get('week')));return true;}
 if(url==='/api/rostering/shifts'&&req.method==='POST'){json(201,await store.saveShift(session,await input()));return true;}
 const shift=url.match(/^\/api\/rostering\/shifts\/([a-f0-9-]{36})$/i);if(shift){if(req.method==='PUT')json(200,await store.saveShift(session,await input(),shift[1]));else if(req.method==='DELETE')json(200,await store.removeShift(session,shift[1],await input()));else fail('Unsupported shift action.',405);return true;}
 const operations={'/api/rostering/clock-unlock':'unlockClock','/api/rostering/publish':'publish','/api/rostering/copy-previous':'copyPrevious','/api/rostering/clock':'clock','/api/rostering/manual-time':'manualTime'};if(operations[url]&&req.method==='POST'){json(200,await store[operations[url]](session,await input()));return true;}
 if(url==='/api/rostering/availability'&&['PUT','DELETE'].includes(req.method)){json(200,await store.saveAvailability(session,await input(),req.method==='DELETE'));return true;}
 if(url==='/api/rostering/leave'&&req.method==='POST'){json(201,await store.saveLeave(session,await input()));return true;}
 const leave=url.match(/^\/api\/rostering\/leave\/([a-f0-9-]{36})$/i);if(leave&&req.method==='PUT'){json(200,await store.changeLeave(session,leave[1],await input()));return true;}
 if(url==='/api/rostering/rates'&&req.method==='PUT'){json(200,await store.saveRates(session,await input()));return true;}
 if(url==='/api/rostering/budget'&&['PUT','DELETE'].includes(req.method)){json(200,await store.saveBudget(session,await input(),req.method==='DELETE'));return true;}
 const time=url.match(/^\/api\/rostering\/timesheets\/([a-f0-9-]{36})$/i);if(time&&req.method==='PUT'){json(200,await store.reviewTime(session,time[1],await input()));return true;}
 fail('Rostering action not found.',404);
}
module.exports={route};
