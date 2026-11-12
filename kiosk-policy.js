// Kiosks use the normal app's permission checks; pairing fixes the active context.
const features=[{id:'app',name:'All app features',description:'Users have the same features and permissions as their normal account.'},{id:'training',name:'Training only',description:'Staff only get the Learning centre to do their training: their online courses and in-store sessions. Staff who can assign training may assign courses and schedule sessions; nothing can be built. Everything else is hidden on this kiosk, whatever their permission level.'}];
// Training-only kiosks keep just these of the person's own grants (never adding any they lack).
const trainingKeys=['learning.view','learning.complete','learning.signoff','learning.assign'];
const trainingPages=['/learning-centre','/help'];
const legacyFeatures=['clock','checklists','labels','roster','library'];
function trainingOnly(actor){if(!actor)return actor;const model=require('./public/permission-model'),keep=list=>(list||[]).filter(key=>trainingKeys.includes(key)),actions={...(actor.actionPermissions||{})};
 // Actions outside training are switched off, including ones without a parent permission.
 for(const action of model.actionDefinitions){const parents=Array.isArray(action.parent)?action.parent:action.parent?[action.parent]:[];if(!parents.some(parent=>trainingKeys.includes(parent)))actions[action.id]=false;}
 return{...actor,kioskTraining:true,homeDashboard:'staff',permissions:keep(actor.permissions),networkPermissions:keep(actor.networkPermissions||actor.permissions),actionPermissions:actions,networkActionPermissions:actions};}
function restrict(actor,feature='app'){const value={...actor,kiosk:true};return feature==='training'?trainingOnly(value):value;}
const home=feature=>feature==='training'?'/learning-centre':'/home';
// On a training-only kiosk every other app page opens the Learning centre instead.
const pageAllowed=(feature,path)=>feature!=='training'||trainingPages.includes(path);
function allowed(_feature,path){return !['/login','/setup','/accept-invite','/api/login','/api/setup','/api/session/location','/api/session/company'].includes(path)&&!path.startsWith('/api/invitations/')&&!path.startsWith('/api/opstack/')&&path!=='/opstack';}
module.exports={features,legacyFeatures,trainingKeys,restrict,trainingOnly,home,pageAllowed,allowed};
