const tools=require('./public/ai-question-tools');
const LIMIT=60000,fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const text=(value,max,required=true)=>{if(typeof value!=='string'||value.length>max||required&&!value.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))fail('Choose valid source text.');return value.trim();};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function parameters(input){
 const types=input.questionTypes,count=input.questionCount;
 if(!Array.isArray(types)||!types.length||types.length>9||new Set(types).size!==types.length||types.some(type=>!Object.hasOwn(tools.kinds,type))||!Number.isInteger(count)||count<types.length||count>20)fail('Choose 1–20 questions, with at least one question for every selected type.');
 return{questionTypes:[...types],questionCount:count};
}
async function resolve(actor,source,library){
 if(!source||!['content','library'].includes(source.type))fail('Choose course content, pasted text or Knowledge Library articles.');
 let items,references;
 if(source.type==='content'){
  if(!Array.isArray(source.items)||!source.items.length||source.items.length>40)fail('Select 1–40 content blocks.');
  items=source.items.map(item=>({title:text(item?.title??'',180,false),text:text(item?.text,LIMIT)}));references=items.map(({title})=>({title}));
 }else{
  if(!library)fail('Knowledge Library is unavailable.',503);
  if(!Array.isArray(source.articles)||!source.articles.length||source.articles.length>10||new Set(source.articles.map(a=>a?.id)).size!==source.articles.length||source.articles.some(article=>!uuid(article?.id)||!Number.isInteger(article.revision)||article.revision<1))fail('Select 1–10 current Knowledge Library articles.');
  const articles=await Promise.all(source.articles.map(async reference=>{const article=await library.get(actor,reference.id);if(article.revision!==reference.revision)fail('A selected library article changed. Refresh the article list and select it again.',409);return article;}));
  items=articles.map(article=>({title:article.title,text:tools.contentText(article)}));references=articles.map(({id,title,revision})=>({id,title,revision}));
  if(items.some(item=>!item.text))fail('A selected article has no readable text. Choose articles with written content.');
 }
 const characters=items.reduce((sum,item)=>sum+item.title.length+item.text.length,0);if(characters>LIMIT)fail('Selected source text is too long. Choose fewer blocks or articles (up to 60,000 characters).');
 return{items,references,type:source.type,characters};
}
module.exports={parameters,resolve,LIMIT};
