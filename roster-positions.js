const crypto=require('node:crypto');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});},key=name=>name.trim().toLocaleLowerCase('en-AU'),uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const legacyId=(companyId,name)=>crypto.createHash('sha256').update(companyId+'\0'+key(name)).digest('hex').slice(0,32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
function catalog(state,actor){
 const saved=state.positionSettings?.find(record=>record.companyId===actor.companyId),positions=(saved?.positions||[]).map(position=>({...position,aliases:[...(position.aliases||[])],used:false})),names=new Map();
 for(const position of positions)for(const name of [position.name,...position.aliases])names.set(key(name),position);
 for(const week of state.weeks.filter(week=>week.companyId===actor.companyId))for(const shift of [...week.draft,...week.published]){
  if(!shift.position)continue;let position=names.get(key(shift.position));
  if(!position){position={id:legacyId(actor.companyId,shift.position),name:shift.position,color:null,aliases:[],used:false};positions.push(position);names.set(key(position.name),position);}position.used=true;
 }
 return{revision:saved?.revision||0,positions:positions.sort((a,b)=>a.name.localeCompare(b.name))};
}
function resolve(catalog,name){return catalog.positions.find(position=>[position.name,...position.aliases].some(value=>key(value)===key(name||'')));}
function display(catalog,name){const position=resolve(catalog,name);return{position:position?.name||name||'',...(position?.color?{positionColor:position.color}:{})};}
const view=catalog=>({revision:catalog.revision,positions:catalog.positions.map(({aliases,...position})=>position)});
function save(state,actor,input,stamp){
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter valid position settings.');const previous=catalog(state,actor);
 if(input.revision!==previous.revision)fail('Positions changed. Reload before saving.',409);
 if(!Array.isArray(input.positions)||input.positions.length>1000)fail('Enter up to 1,000 positions.');
 const ids=new Set(),positions=input.positions.map(value=>{
  if(!value||typeof value!=='object'||Array.isArray(value)||!uuid.test(value.id||'')||ids.has(value.id))fail('Each position needs a unique valid ID.');ids.add(value.id);
  if(typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>80)fail('Enter a position name of up to 80 characters.');
  if(value.color!==undefined&&value.color!==null&&(typeof value.color!=='string'||!/^#[a-f0-9]{6}$/i.test(value.color)))fail('Choose a valid six-digit position colour.');
  const name=value.name.trim(),old=previous.positions.find(position=>position.id===value.id),aliases=[...new Set([...(old?.aliases||[]),...(old&&old.name!==name?[old.name]:[])])].filter(alias=>key(alias)!==key(name));
  return{id:value.id,name,color:value.color?.toLowerCase()||null,aliases};
 });
 const names=new Map();for(const position of positions)for(const name of [position.name,...position.aliases]){const owner=names.get(key(name));if(owner&&owner!==position.id)fail('Position names must be unique, including previous names.');names.set(key(name),position.id);}
 for(const old of previous.positions)if(old.used&&!ids.has(old.id))fail('A position used by rostered shifts cannot be removed. Rename it or change its colour instead.',409);
 state.positionSettings||=[];state.positionSettings=state.positionSettings.filter(record=>record.companyId!==actor.companyId);state.positionSettings.push({companyId:actor.companyId,revision:previous.revision+1,positions,updatedAt:stamp,updatedBy:actor.id});
 return view(catalog(state,actor));
}
module.exports={catalog,resolve,display,view,save};
