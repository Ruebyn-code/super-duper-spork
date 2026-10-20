// Content documents retain their own script lifecycle. The parent owns the
// persistent navigation, required-reading gate and shared shift clock.
const shellScripts=new Set(['network-context','theme-colours','theme','location-picker','company-context','edit-parts','appearance-style','permission-model','access','formatted-text','required-reading','message-badge','clock-model','shift-clock','layout-model','app-layout','branding','interactions','navigation-groups','app-controls','navigation','wording-model','interface-text','element-overrides','app-editor']);
const parentOnly=new Set(['required-reading','message-badge','clock-model','shift-clock','navigation-groups','app-controls','navigation']);
function render(markup,embedded){
  const filtered=markup.replace(/<script\b[^>]*\bsrc="\/([a-z0-9-]+)\.js"[^>]*><\/script>/g,(tag,name)=>embedded?(parentOnly.has(name)?'':tag):(shellScripts.has(name)?tag:''));
  const boot=embedded?'<script src="/page-bridge.js"></script><script src="/openable.js" defer></script>':'<script src="/persistent-navigation.js" defer></script>';
  return filtered.replace('<head>','<head>'+ (embedded?boot:''))
    .replace('</head>','<link rel="stylesheet" href="/persistent-navigation.css">'+(embedded?'':boot)+'</head>');
}
module.exports={render};
