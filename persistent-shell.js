// Content documents retain their own script lifecycle. The parent owns the
// persistent navigation, required-reading gate and shared shift clock.
const shellScripts=new Set(['ai-brand-model','ai-brand','kiosk-session','network-context','theme-colours','theme','location-picker','company-context','edit-parts','appearance-style','permission-model','access','formatted-text','required-reading','location-setup','message-badge','clock-model','shift-clock','layout-model','app-layout','branding','interactions','navigation-groups','app-controls','navigation','wording-model','interface-text','element-overrides','app-editor']);
const parentOnly=new Set(['kiosk-session','required-reading','location-setup','message-badge','clock-model','shift-clock','navigation-groups','app-controls','navigation']);
function render(markup,embedded){
  let filtered=markup.replace(/<script\b[^>]*\bsrc="\/([a-z0-9-]+)\.js"[^>]*><\/script>/g,(tag,name)=>embedded?(parentOnly.has(name)?'':tag):(shellScripts.has(name)?tag:''));
  if(!embedded)filtered=filtered.replace('<link rel="stylesheet" href="/ai-brand.css">','').replace('<script src="/app-controls.js"','<script src="/app-search.js" defer></script><script src="/app-controls.js"');
  const boot=embedded?'<script src="/page-bridge.js"></script><script src="/openable.js" defer></script>':'<script src="/persistent-navigation.js" defer></script>';
  return filtered.replace('<head>','<head>'+ (embedded?boot:''))
    .replace('</head>','<link rel="stylesheet" href="/persistent-navigation.css">'+(!embedded?'<link rel="stylesheet" href="/app-search.css"><link rel="stylesheet" href="/ai-brand.css">':'')+(embedded?'':boot)+'</head>');
}
module.exports={render};
