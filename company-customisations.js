const path=require('node:path');
function folder(dir,companyId='default'){if(typeof companyId!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(companyId))throw Object.assign(Error('Choose a valid company.'),{status:400});return companyId==='default'?dir:path.join(dir,'company-customisations',companyId);}
function assetUrl(url,companyId){return url+(url.includes('?')?'&':'?')+'company='+encodeURIComponent(companyId);}
function fontLibrary(fonts,companyId){return fonts.map(font=>({...font,url:assetUrl('/uploaded-fonts/'+font.id.slice(7)+'.'+font.extension,companyId)}));}
module.exports={folder,assetUrl,fontLibrary};
