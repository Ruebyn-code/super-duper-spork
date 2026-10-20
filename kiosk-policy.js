const {can}=require('./permissions');
const features=[
 {id:'clock',name:'Time clock',description:'Clock in, take required breaks and clock out with staff PINs.',permissions:['rostering.view','rostering.clock']},
 {id:'checklists',name:'Active checklists',description:'Complete assigned checklists at this location.',permissions:['ops.view','ops.complete'],page:'/ops-management#checklists'},
 {id:'labels',name:'Labels',description:'Print company label templates.',permissions:['prep.view','prep.print'],page:'/labels#print'},
 {id:'roster',name:'Roster',description:'View published rosters without editing.',permissions:['rostering.view'],page:'/rostering#team'},
 {id:'library',name:'Knowledge Library',description:'Read company policies and information.',permissions:['knowledge.view'],page:'/knowledge-library'}
];
function restrict(actor,feature){const keys=features.find(item=>item.id===feature)?.permissions||[];return{...actor,permissions:keys.filter(key=>can(actor,key)),networkPermissions:[],locationIds:[actor.locationId],companyIds:[actor.companyId],kiosk:true};}
function allowed(feature,path,method){
 const read=method==='GET';
 if(path==='/kiosk'||path.startsWith('/api/kiosk/'))return true;
 if(read&&['/api/session','/logo','/sidebar-logo','/appearance','/interface-text','/element-overrides','/font-library','/layouts'].includes(path))return true;
 if(read&&path.startsWith('/uploaded-fonts/'))return true;
 if(read&&(path==='/api/communications/required'||/^\/api\/communications\/media\/[a-f0-9-]+$/i.test(path)))return true;
 if(method==='POST'&&/^\/api\/communications\/posts\/[a-f0-9-]+\/(read|snooze)$/i.test(path))return true;
 if(feature==='clock')return read&&path==='/api/rostering/clock-status'||method==='POST'&&['/api/rostering/clock','/api/rostering/clock-unlock'].includes(path);
 if(feature==='roster')return read&&['/rostering','/api/rostering/dashboard'].includes(path);
 if(feature==='library')return read&&(path==='/knowledge-library'||path.startsWith('/api/knowledge-library'));
 if(feature==='labels')return read&&(path==='/labels'||path.startsWith('/api/prep-labels'))||method==='POST'&&path==='/api/prep-labels/batches';
 if(feature==='checklists')return read&&(path==='/ops-management'||path.startsWith('/api/ops-management'))||['POST','PUT'].includes(method)&&(path==='/api/ops-management/runs'||/^\/api\/ops-management\/runs\/[a-f0-9-]+(?:\/(?:answers|complete|media))?$/.test(path)||path==='/api/ops-management/media');
 return false;
}
module.exports={features,restrict,allowed};
