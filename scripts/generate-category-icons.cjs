const fs=require('fs'),path=require('path');const S=process.argv[2],out=process.argv[3];
const repo=path.join(S,'lucide-repo'),nodes=require(path.join(S,'lucide/package/icon-nodes.json'));
const groupOf={'food-beverage':['food','Food & drink'],home:['kitchen','Kitchen & home'],tools:['tools','Tools & repairs'],shopping:['shopping','Shopping & money'],finance:['shopping','Shopping & money'],logistics:['transport','Transport & delivery'],transportation:['transport','Transport & delivery'],travel:['places','Places & travel'],buildings:['places','Places & travel'],navigation:['places','Places & travel'],people:['people','People & training'],account:['people','People & training'],accessibility:['people','People & training'],medical:['safety','Cleaning, safety & health'],security:['safety','Cleaning, safety & health'],weather:['weather','Weather'],nature:['nature','Nature & animals'],animals:['nature','Nature & animals'],sustainability:['nature','Nature & animals'],sports:['fun','Sports, games & emoji'],gaming:['fun','Sports, games & emoji'],emoji:['fun','Sports, games & emoji'],devices:['tech','Devices & media'],multimedia:['tech','Devices & media'],photography:['tech','Devices & media'],connectivity:['tech','Devices & media'],communication:['comms','Messages & alerts'],mail:['comms','Messages & alerts'],notifications:['comms','Messages & alerts'],social:['comms','Messages & alerts'],time:['time','Time & calendar'],education:['business','Business & office'],science:['business','Business & office'],files:['business','Business & office'],charts:['business','Business & office'],shapes:['shapes','Shapes & symbols']};
const order=['food','kitchen','safety','people','business','places','tools','shopping','transport','nature','weather','fun','tech','comms','time','shapes'];
const skip=/(-off|-dashed|-slash)$|^(arrow|chevron|align|text-|a-arrow|panel|between|move-|corner|iteration|list-|table-|pilcrow|heading|letter|git-|file-(braces|code|json|terminal|type|diff|axis|digit|key|lock|scan|symlink|volume|archive|badge|stack|cog|pen-line|output|input|minus|plus|x|check)|folder-(git|code|kanban|dot|root|symlink|tree|sync|cog|minus|plus|x|check|input|output|key|lock|pen|search|clock|archive|down|up|heart|open-dot|closed)|calendar-(arrow|fold|minus|plus|x|1|off|range|sync)|clock-(arrow|1|2|3|4|5|6|7|8|9|10|11|12)|message-(circle|square)-(code|diff|dot|more|off|plus|quote|reply|share|text|warning|x|lock|dashed|heart)|square-(arrow|chevron|dashed|split|bottom|code|function|pi|sigma|asterisk|percent|divide|equal|slash|mouse|terminal|dot|minus|plus|x|check|m|kanban|library|radical|menu|stack|scissors|power|activity|pen|round|centerline)|circle-(arrow|chevron|dashed|slash|divide|equal|minus|plus|x|check|dot|ellipsis|fading|percent|gauge|small|alert|help|question|pound|dollar|half|poll|zero|stop|off|play|pause|power|user|star|parking))/;
const seen=new Set(),groups=new Map(order.map(id=>[id,{id,label:'',items:[]}]));
for(const file of fs.readdirSync(path.join(repo,'icons')).sort()){const name=file.replace(/\.json$/,'');if(!nodes[name])continue;const meta=JSON.parse(fs.readFileSync(path.join(repo,'icons',file)));if(meta.deprecated)continue;const cat=(meta.categories||[]).find(c=>groupOf[c]);if(!cat)continue;
 if(skip.test(name))continue;
 if(seen.has(name))continue;seen.add(name);
 const markup=nodes[name].map(([tag,attrs])=>'<'+tag+Object.entries(attrs).filter(([k])=>k!=='key').map(([k,v])=>' '+k+'="'+String(v).replace(/"/g,'&quot;')+'"').join('')+'/>').join('');
 const label=name.replace(/-/g,' ').replace(/\b(\d)/g,' $1').replace(/\s+/g,' ').trim().replace(/^./,c=>c.toUpperCase());
 const [gid,glabel]=groupOf[cat];const g=groups.get(gid);g.label=glabel;g.items.push([name,label,[...new Set(meta.tags||[])].join(' ').slice(0,160),markup]);}
const list=[...groups.values()].filter(g=>g.items.length);
const total=list.reduce((n,g)=>n+g.items.length,0);
const licence=fs.readFileSync(path.join(S,'lucide/package/LICENSE'),'utf8').trim().split('\n').map(l=>'// '+l).join('\n');
const body=`// GENERATED — do not edit by hand. Extra category icons from Lucide (https://lucide.dev), selected for stores and
// operations and grouped by Lucide's own categories. category-icons.js adds them after OpStack's own icons; IDs are the
// Lucide icon names and only these allowlisted IDs are accepted by the server. Regenerate with the script in
// docs/labels.md (Icon library).
//
${licence}
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.categoryIconsLibrary=api;})(typeof globalThis==='object'?globalThis:this,function(){
 return ${JSON.stringify(list.map(g=>[g.id,g.label,g.items]))};
});
`;
fs.writeFileSync(out,body);console.log('icons',total,'bytes',body.length);for(const g of list)console.log(g.id,g.items.length);
