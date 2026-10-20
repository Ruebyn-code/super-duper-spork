// Kiosks use the normal app's permission checks; pairing fixes the active context.
const features=[{id:'app',name:'All app features',description:'Users have the same features and permissions as their normal account.'}];
const legacyFeatures=['clock','checklists','labels','roster','library'];
function restrict(actor){return{...actor,kiosk:true};}
function allowed(_feature,path){return !['/login','/setup','/accept-invite','/api/login','/api/setup','/api/session/location','/api/session/company'].includes(path)&&!path.startsWith('/api/invitations/')&&!path.startsWith('/api/opstack/')&&path!=='/opstack';}
module.exports={features,legacyFeatures,restrict,allowed};
