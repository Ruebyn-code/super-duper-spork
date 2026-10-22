const {fixture,reply}=require('./ai-assistance-fixture.cjs');
const paragraph=text=>({type:'paragraph',spans:[{text}]}),heading=(text,level=2)=>({type:'heading',level,spans:[{text}]});
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jw4kAAAAASUVORK5CYII=';
async function setup(options={}){
 const app=await fixture({fetchImpl:options.fetchImpl||(()=>reply({queries:['gourmet souvlaki'],pageIds:['page:library']}))});await app.settings();
 const image=await app.api(app.office,'/api/knowledge-library/media','POST',{name:'gourmet-souvlaki-assembly.png',data:png}),video=await app.api(app.office,'/api/knowledge-library/media','POST',{name:'gourmet-souvlaki-demonstration.mp4',data:options.video||Buffer.from('Deep search video fixture').toString('base64')});
 const asset=file=>({id:file.id,name:file.name,mime:file.mime});
 const blocks=[heading('Store operations',1),heading('Closing procedures'),paragraph('Close the store using the approved closing checklist. '.repeat(160)),heading('Gourmet souvlaki'),heading('Ingredients',3),paragraph('Use the current approved ingredient and portion list.'),heading('Assembly',3),{type:'number',spans:[{text:'Warm the pita using the approved method.'}]},{type:'number',spans:[{text:'Layer the filling, tomato and sauce, then wrap and serve.'}]},{type:'image',assets:[asset(image)],spans:[{text:'Gourmet souvlaki assembly photo'}]},{type:'video',assets:[asset(video)],spans:[{text:'Gourmet souvlaki demonstration'}]},{type:'embed',url:'https://youtu.be/abcdefghijk',spans:[{text:'Alternative demonstration'}]},heading('Cleaning'),paragraph('Clean the preparation area following the approved procedure.')];
 const article=await app.api(app.office,'/api/knowledge-library','POST',{title:'Store operations manual',type:'information',scope:'company',richText:{version:1,blocks}});
 return Object.assign(app,{article,image,video,blocks});
}
module.exports={setup,paragraph,heading,png};
